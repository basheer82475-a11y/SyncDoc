const {
  createDocumentAST,
} = require("../services/collaboration/ast.service");

const {
  applyOperation,
} = require("../services/collaboration/operation-processor.service");

const {
  addOperation,
  getOperations,
} = require("../services/collaboration/operation-history.service");

const {
  createCRDTDocument,
  applyCRDTOperation,
  crdtToAST,
} = require("../services/collaboration/crdt.service");

const {
  createYjsDocument,
  encodeYjsUpdate,
  applyYjsUpdate,
  getYjsDocumentState,
} = require("../services/collaboration/yjs.service");

// Temporary in-memory state for active document rooms
const documentStates = {};

// CRDT state for active document rooms
const crdtDocumentStates = {};
//Yjs state for active document rooms
const yjsDocumentStates ={};

const collaborationSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(
      "User connected:",
      socket.id
    );

    // ==========================================
    // JOIN DOCUMENT
    // ==========================================

    socket.on(
      "join-document",
      (documentId) => {
        socket.join(documentId);

        // Create traditional AST state
        if (!documentStates[documentId]) {
          documentStates[documentId] =
            createDocumentAST([]);
        }

        // Create CRDT state
        if (!crdtDocumentStates[documentId]) {
          crdtDocumentStates[documentId] =
            createCRDTDocument();
        }

        // Create Yjs state
        if (!yjsDocumentStates[documentId]) {
          yjsDocumentStates[documentId] =
            createYjsDocument();
}

        console.log(
          `${socket.id} joined document room: ${documentId}`
        );

        // Send current AST to joining user
        socket.emit(
          "document-state",
          {
            documentId,
            ast: documentStates[documentId],
          }
        );

        // Send current CRDT-derived AST
        socket.emit(
          "crdt-document-state",
          {
            documentId,
            ast: crdtToAST(
              crdtDocumentStates[documentId]
            ),
          }
        );
        // Send current Yjs state
        socket.emit(
          "yjs-document-state",
          {
            documentId,
            state: getYjsDocumentState(
              yjsDocumentStates[documentId]
            )
          }
        );

        // Notify other users
        socket
          .to(documentId)
          .emit(
            "user-joined",
            {
              userId: socket.id,
            }
          );
      }
    );

    // ==========================================
    // EXISTING OPERATION SYSTEM
    // ==========================================

    socket.on(
      "edit-operation",
      ({ documentId, operation }) => {
        try {
          // Validate document ID
          if (!documentId) {
            throw new Error(
              "Document ID is required"
            );
          }

          // Validate operation
          if (!operation) {
            throw new Error(
              "Operation is required"
            );
          }

          if (!operation.operationId) {
            throw new Error(
              "Operation ID is required"
            );
          }

          if (!operation.type) {
            throw new Error(
              "Operation type is required"
            );
          }

          // Create AST state if needed
          if (!documentStates[documentId]) {
            documentStates[documentId] =
              createDocumentAST([]);
          }

          // Check duplicate operation
          const existingOperations =
            getOperations(documentId);

          const duplicateOperation =
            existingOperations.some(
              (existingOperation) =>
                existingOperation.operationId ===
                operation.operationId
            );

          if (duplicateOperation) {
            throw new Error(
              "Duplicate operation received"
            );
          }

          // Get previous operations
          const previousOperations =
            getOperations(documentId);

          // Apply operation
          const updatedAST =
            applyOperation(
              documentStates[documentId],
              operation,
              previousOperations
            );

          // Save AST state
          documentStates[documentId] =
            updatedAST;

          // Save operation history
          addOperation(
            documentId,
            operation
          );

          console.log(
            "Operation received:",
            operation
          );

          console.log(
            "Total operations:",
            getOperations(
              documentId
            ).length
          );

          // Broadcast to other users
          socket
            .to(documentId)
            .emit(
              "operation-applied",
              {
                operation,
                ast: updatedAST,
              }
            );

          // Confirm to sender
          socket.emit(
            "operation-confirmed",
            {
              operation,
              ast: updatedAST,
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
      ({ documentId, update }) => {
        try {
          // Validate document ID
          if (!documentId) {
            throw new Error(
              "Document ID is required"
            );
          }

          // Validate Yjs update
          if (!update) {
            throw new Error(
              "Yjs update is required"
            );
          }

          // Create Yjs state if needed
          if (!yjsDocumentStates[documentId]) {
            yjsDocumentStates[documentId] =
              createYjsDocument();
          }

          // Convert incoming update to Uint8Array
          const yjsUpdate =
            new Uint8Array(update);

          // Apply update to server-side Yjs document
          applyYjsUpdate(
            yjsDocumentStates[documentId],
            yjsUpdate
          );

          // Get updated state
          const updatedState =
            getYjsDocumentState(
              yjsDocumentStates[documentId]
            );

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
      ({ documentId, operation }) => {
        try {
          // Validate document ID
          if (!documentId) {
            throw new Error(
              "Document ID is required"
            );
          }

          // Validate operation
          if (!operation) {
            throw new Error(
              "CRDT operation is required"
            );
          }

          if (!operation.operationId) {
            throw new Error(
              "CRDT operation ID is required"
            );
          }

          if (!operation.type) {
            throw new Error(
              "CRDT operation type is required"
            );
          }

          if (!operation.blockId) {
            throw new Error(
              "CRDT block ID is required"
            );
          }

          // Create CRDT state if needed
          if (!crdtDocumentStates[documentId]) {
            crdtDocumentStates[documentId] =
              createCRDTDocument();
          }

          // Check duplicate operation
          const existingOperation =
            crdtDocumentStates[documentId]
              .operations[
                operation.operationId
              ];

          if (existingOperation) {
            throw new Error(
              "Duplicate CRDT operation received"
            );
          }

          // Apply CRDT operation
          const updatedCRDTDocument =
            applyCRDTOperation(
              crdtDocumentStates[documentId],
              operation
            );

          // Save CRDT state
          crdtDocumentStates[documentId] =
            updatedCRDTDocument;

          // Convert CRDT state to AST
          const updatedAST =
            crdtToAST(
              updatedCRDTDocument
            );

          console.log(
            "CRDT operation received:",
            operation
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
                operation,
                ast: updatedAST,
              }
            );

          // Confirm CRDT operation to sender
          socket.emit(
            "crdt-operation-confirmed",
            {
              operation,
              ast: updatedAST,
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