const {
  createCRDTDocument,
  applyCRDTOperation,
  crdtToAST,
} = require("../services/collaboration/crdt.service");
const jwt = require("jsonwebtoken");
const {
  hasDocumentAccess,
} = require("../services/collaboration/document-access.service");

// Cached AST snapshots are kept for backwards-compatible clients.  The CRDT
// document is the authoritative state for every room.
const {
  createYjsDocument,
  applyYjsUpdate,
  getYjsDocumentState,
} = require("../services/collaboration/yjs.service");
const { loadDocumentOperations, saveDocumentOperation } = require("../services/collaboration/crdt-persistence.service");
const { loadYjsUpdates, saveYjsUpdate } = require("../services/collaboration/yjs-persistence.service");

const SUPPORTED_OPERATION_TYPES = new Set([
  "ADD_BLOCK",
  "UPDATE_BLOCK",
  "DELETE_BLOCK",
]);

const MAX_DOCUMENT_ID_LENGTH = 200;
const MAX_BLOCK_ID_LENGTH = 200;
const MAX_OPERATION_ID_LENGTH = 200;
const MAX_CONTENT_LENGTH = 100_000;
const MAX_YJS_UPDATE_BYTES = 1_000_000;

const isSafeIdentifier = (value, maxLength) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maxLength &&
  value.trim() === value &&
  !/[\u0000-\u001F\u007F]/.test(value);

const validateOperation = (socket, documentId, operation, label) => {
  const prefix = label ? `${label} ` : "";

  if (!isSafeIdentifier(documentId, MAX_DOCUMENT_ID_LENGTH)) {
    throw new Error("A valid document ID is required");
  }

  if (!socket.rooms.has(documentId)) {
    throw new Error("Join the document before sending operations");
  }

  if (!operation) {
    throw new Error(`${prefix}operation is required`);
  }

  if (!isSafeIdentifier(operation.operationId, MAX_OPERATION_ID_LENGTH)) {
    throw new Error(`${prefix}operation ID is required`);
  }

  if (!SUPPORTED_OPERATION_TYPES.has(operation.type)) {
    throw new Error(`Unsupported operation type: ${operation.type}`);
  }

  if (!isSafeIdentifier(operation.blockId, MAX_BLOCK_ID_LENGTH)) {
    throw new Error(`${prefix}block ID is required`);
  }

  if (operation.documentId && operation.documentId !== documentId) {
    throw new Error(`${prefix}operation document ID must match the room`);
  }

  if (
    (operation.type === "ADD_BLOCK" || operation.type === "UPDATE_BLOCK") &&
    (typeof operation.content !== "string" ||
      operation.content.length > MAX_CONTENT_LENGTH)
  ) {
    throw new Error(`${prefix}operation content must be a string of at most ${MAX_CONTENT_LENGTH} characters`);
  }

  if (
    operation.position !== null &&
    operation.position !== undefined &&
    (!Number.isSafeInteger(operation.position) || operation.position < 0)
  ) {
    throw new Error(`${prefix}operation position must be a non-negative integer`);
  }
};

const getHandshakeToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  return scheme === "Bearer" && token ? token : null;
};

const authenticateSocket = (socket, next) => {
  const token = getHandshakeToken(socket);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    next(new Error("Socket authentication is not configured"));
    return;
  }

  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload.userId !== "string" || !payload.userId) {
      throw new Error("Invalid token subject");
    }

    socket.data.user = {
      userId: payload.userId,
      role: payload.role,
    };
    next();
  } catch {
    next(new Error("Authentication failed"));
  }
};

const collaborationSocket = (
  io,
  {
    canAccessDocument = hasDocumentAccess,
    loadDocumentOperations: loadPersistedOperations = loadDocumentOperations,
    saveDocumentOperation: savePersistedOperation = saveDocumentOperation,
    loadYjsUpdates: loadPersistedYjsUpdates = loadYjsUpdates,
    saveYjsUpdate: savePersistedYjsUpdate = saveYjsUpdate,
  } = {}
) => {
  io.use(authenticateSocket);

  const documentStates = new Map();
  const crdtDocumentStates = new Map();
  const yjsDocumentStates = new Map();
  const documentLoads = new Map();
  const yjsDocumentLoads = new Map();

  const ensureDocumentState = (documentId) => {
    if (!crdtDocumentStates.has(documentId)) {
      crdtDocumentStates.set(documentId, createCRDTDocument());
    }
    const crdt = crdtDocumentStates.get(documentId);
    const ast = crdtToAST(crdt);
    documentStates.set(documentId, ast);
    return { crdt, ast };
  };

  const loadDocumentState = async (documentId) => {
    if (crdtDocumentStates.has(documentId)) {
      return ensureDocumentState(documentId);
    }
    if (!documentLoads.has(documentId)) {
      const load = (async () => {
        const operations = await loadPersistedOperations(documentId);
        const crdt = operations.reduce(
          (state, operation) => applyCRDTOperation(state, operation),
          createCRDTDocument()
        );
        crdtDocumentStates.set(documentId, crdt);
        return ensureDocumentState(documentId);
      })().finally(() => documentLoads.delete(documentId));
      documentLoads.set(documentId, load);
    }
    return documentLoads.get(documentId);
  };

  const loadYjsDocumentState = async (documentId) => {
    if (yjsDocumentStates.has(documentId)) {
      return yjsDocumentStates.get(documentId);
    }
    if (!yjsDocumentLoads.has(documentId)) {
      const load = (async () => {
        const yjsDocument = createYjsDocument();
        const updates = await loadPersistedYjsUpdates(documentId);
        for (const update of updates) {
          applyYjsUpdate(yjsDocument, new Uint8Array(update));
        }
        yjsDocumentStates.set(documentId, yjsDocument);
        return yjsDocument;
      })().finally(() => yjsDocumentLoads.delete(documentId));
      yjsDocumentLoads.set(documentId, load);
    }
    return yjsDocumentLoads.get(documentId);
  };

  const applyDocumentOperation = (documentId, operation) => {
    const { crdt } = ensureDocumentState(documentId);
    if (crdt.operations[operation.operationId]) {
      throw new Error("Duplicate operation received");
    }
    const updated = applyCRDTOperation(crdt, operation);
    crdtDocumentStates.set(documentId, updated);
    const ast = crdtToAST(updated);
    documentStates.set(documentId, ast);
    return { crdt: updated, ast };
  };

  const assertOperationIsNew = (documentId, operation) => {
    const { crdt } = ensureDocumentState(documentId);
    if (crdt.operations[operation.operationId]) {
      throw new Error("Duplicate operation received");
    }
  };

  const canonicalizeOperation = (socket, documentId, operation) => {
    const { crdt } = ensureDocumentState(documentId);
    const latestTimestamp = Object.values(crdt.operations).reduce(
      (latest, existingOperation) => Math.max(latest, existingOperation.timestamp),
      0
    );
    return {
      ...operation,
      // Scope client operation IDs to the authenticated actor. Unlike a socket
      // ID this remains stable across reconnects and server restarts, making
      // retries idempotent against both memory and MongoDB's unique index.
      operationId: `${socket.data.user.userId}:${operation.operationId}`,
      documentId,
      userId: socket.data.user.userId,
      timestamp: Math.max(Date.now(), latestTimestamp + 1),
    };
  };

  io.on("connection", (socket) => {
    console.log(
      "User connected:",
      socket.id
    );

    const requireDocumentAccess = async (documentId, permission) => {
      const isAllowed = await canAccessDocument({
        user: socket.data.user,
        documentId,
        permission,
      });

      if (!isAllowed) {
        throw new Error("You do not have access to this document");
      }
    };

    // ==========================================
    // JOIN DOCUMENT
    // ==========================================

    socket.on(
      "join-document",
      async (documentId) => {
        try {
          if (!isSafeIdentifier(documentId, MAX_DOCUMENT_ID_LENGTH)) {
            throw new Error("A valid document ID is required");
          }

          await requireDocumentAccess(documentId, "viewer");

          const state = await loadDocumentState(documentId);
          socket.join(documentId);

          const yjsDocument = await loadYjsDocumentState(documentId);

          console.log(`${socket.id} joined document room: ${documentId}`);

          // Send current states to the joining client.
          socket.emit("document-state", {
            documentId,
            ast: state.ast,
          });

          socket.emit(
            "crdt-document-state",
            {
              documentId,
              ast: state.ast,
              crdt: state.crdt,
            }
          );

          socket.emit("yjs-document-state", {
            documentId,
            state: getYjsDocumentState(yjsDocument),
          });

          // Notify existing room members after the new member has received
          // their initial state.
          socket
            .to(documentId)
            .emit(
              "user-joined",
              {
                userId: socket.data.user.userId,
                documentId,
              }
            );
        } catch (error) {
          socket.emit("operation-error", { message: error.message });
        }
      }
    );

    // ==========================================
    // EXISTING OPERATION SYSTEM
    // ==========================================

    socket.on(
      "edit-operation",
      async ({ documentId, operation } = {}) => {
        try {
          validateOperation(socket, documentId, operation, "");
          await requireDocumentAccess(documentId, "editor");
          await loadDocumentState(documentId);
          const canonicalOperation = canonicalizeOperation(
            socket,
            documentId,
            operation
          );

          assertOperationIsNew(documentId, canonicalOperation);
          await savePersistedOperation(documentId, canonicalOperation);

          const { ast: updatedAST, crdt } = applyDocumentOperation(
            documentId,
            canonicalOperation
          );

          console.log(
            "Operation received:",
            canonicalOperation
          );

          console.log(
            "Total CRDT operations:",
            Object.keys(crdt.operations).length
          );

          // Broadcast to other users
          socket
            .to(documentId)
            .emit(
              "operation-applied",
              {
                documentId,
                operation: canonicalOperation,
                ast: updatedAST,
                crdt,
              }
            );

          // CRDT clients receive the same canonical update when a legacy
          // client edits the document.
          socket.to(documentId).emit("crdt-operation-applied", {
            documentId,
            operation: canonicalOperation,
            ast: updatedAST,
            crdt,
          });

          // Confirm to sender
          socket.emit(
            "operation-confirmed",
            {
              documentId,
              operation: canonicalOperation,
              ast: updatedAST,
              crdt,
            }
          );
        } catch (error) {
          console.error(
            "Operation error:",
            error.message
          );

          socket.emit(
            "operation-error",
            {
              message: error.message,
            }
          );
        }
      }
    );
    // ==========================================
    // YJS UPDATE
    // ==========================================

    socket.on(
      "yjs-update",
      async ({ documentId, update } = {}) => {
        try {
          if (!isSafeIdentifier(documentId, MAX_DOCUMENT_ID_LENGTH)) {
            throw new Error("A valid document ID is required");
          }

          if (!socket.rooms.has(documentId)) {
            throw new Error("Join the document before sending updates");
          }

          await requireDocumentAccess(documentId, "editor");

          // Validate Yjs update
          if (
            !(Array.isArray(update) || update instanceof Uint8Array) ||
            update.length === 0 ||
            update.length > MAX_YJS_UPDATE_BYTES ||
            Array.from(update).some(
              (byte) => !Number.isInteger(byte) || byte < 0 || byte > 255
            )
          ) {
            throw new Error(`Yjs update must contain 1 to ${MAX_YJS_UPDATE_BYTES} bytes`);
          }

          const yjsUpdate = new Uint8Array(update);

          // Reject malformed Yjs payloads before they enter the durable log.
          const validationDocument = createYjsDocument();
          try {
            applyYjsUpdate(validationDocument, yjsUpdate);
          } finally {
            validationDocument.doc.destroy();
          }

          const yjsDocument = await loadYjsDocumentState(documentId);
          await savePersistedYjsUpdate(
            documentId,
            socket.data.user.userId,
            yjsUpdate
          );

          // Apply update to server-side Yjs document
          applyYjsUpdate(yjsDocument, yjsUpdate);

          // Get updated state
          const updatedState =
            getYjsDocumentState(yjsDocument);

          console.log(
            "Yjs update received for document:",
            documentId
          );

          // Send update to other users
          socket
            .to(documentId)
            .emit(
              "yjs-update-applied",
              {
                documentId,
                update: Array.from(yjsUpdate),
                state: updatedState,
              }
            );

          // Confirm update to sender
          socket.emit(
            "yjs-update-confirmed",
            {
              documentId,
              state: updatedState,
            }
          );
        } catch (error) {
          console.error(
            "Yjs update error:",
            error.message
          );

          socket.emit(
            "yjs-update-error",
            {
              message: error.message,
            }
          );
        }
      }
    );

    // ==========================================
    // CRDT OPERATION
    // ==========================================

    socket.on(
      "crdt-operation",
      async ({ documentId, operation } = {}) => {
        try {
          validateOperation(socket, documentId, operation, "CRDT");
          await requireDocumentAccess(documentId, "editor");
          await loadDocumentState(documentId);
          const canonicalOperation = canonicalizeOperation(
            socket,
            documentId,
            operation
          );

          assertOperationIsNew(documentId, canonicalOperation);
          await savePersistedOperation(documentId, canonicalOperation);

          const { ast: updatedAST, crdt: updatedCRDTDocument } =
            applyDocumentOperation(documentId, canonicalOperation);

          console.log(
            "CRDT operation received:",
            canonicalOperation
          );

          console.log(
            "Total CRDT operations:",
            Object.keys(
              updatedCRDTDocument.operations
            ).length
          );

          // Send CRDT operation to other users
          socket
            .to(documentId)
            .emit(
              "crdt-operation-applied",
              {
                documentId,
                operation: canonicalOperation,
                ast: updatedAST,
                crdt: updatedCRDTDocument,
              }
            );

          // Keep clients that still consume the original collaboration event
          // in sync with CRDT-originated changes.
          socket.to(documentId).emit("operation-applied", {
            documentId,
            operation: canonicalOperation,
            ast: updatedAST,
            crdt: updatedCRDTDocument,
          });

          // Confirm CRDT operation to sender
          socket.emit(
            "crdt-operation-confirmed",
            {
              documentId,
              operation: canonicalOperation,
              ast: updatedAST,
              crdt: updatedCRDTDocument,
            }
          );
        } catch (error) {
          console.error(
            "CRDT operation error:",
            error.message
          );

          socket.emit(
            "crdt-operation-error",
            {
              message: error.message,
            }
          );
        }
      }
    );

    // ==========================================
    // LEAVE DOCUMENT
    // ==========================================

    socket.on(
      "leave-document",
      (documentId) => {
        socket.leave(documentId);

        console.log(
          `${socket.id} left document room: ${documentId}`
        );
      }
    );

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on(
      "disconnect",
      () => {
        console.log(
          "User disconnected:",
          socket.id
        );
      }
    );
  });
};

module.exports =
  collaborationSocket;
