const Document = require("../../models/Document");
const {
  createCRDTDocument,
  applyCRDTOperation,
  crdtToAST,
} = require("./crdt.service");

// Serialize writes per document so an older snapshot cannot overwrite a newer
// one when multiple socket events arrive at nearly the same time.
const writeQueues = new Map();

const requireDatabase = () => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Document database is unavailable");
  }
};

const documentBlocksToCRDT = (blocks, documentId) => {
  let state = createCRDTDocument();
  (blocks || []).forEach((block, index) => {
    const operation = {
      operationId: `recovery:${documentId}:${block.blockId}`,
      type: "ADD_BLOCK",
      documentId,
      blockId: block.blockId,
      content: block.content || "",
      position: index,
      userId: "document-recovery",
      timestamp: index + 1,
    };
    state = applyCRDTOperation(state, operation);
  });
  return state;
};

const toYjsUpdateBuffer = (value) => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value._bsontype === "Binary" && Buffer.isBuffer(value.buffer)) {
    const byteLength = Number.isInteger(value.position)
      ? value.position
      : value.buffer.length;
    return Buffer.from(value.buffer.subarray(0, byteLength));
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error("Stored Yjs state is not binary data");
};

const loadDocumentState = async (documentId) => {
  requireDatabase();
  const document = await Document.findById(documentId)
    .select("blocks collaborationState collaborationYjsState")
    .lean();
  if (!document) throw new Error("Document was not found");
  return {
    crdt: document.collaborationState || documentBlocksToCRDT(document.blocks, documentId),
    yjsUpdate: toYjsUpdateBuffer(document.collaborationYjsState),
  };
};

const persistDocumentState = (documentId, crdt, yjsUpdate) => {
  const snapshot = JSON.parse(JSON.stringify(crdt));
  const previous = writeQueues.get(documentId) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    requireDatabase();
    const update = {
      collaborationState: snapshot,
      blocks: crdtToAST(snapshot).children.map((block) => ({
        blockId: block.id,
        type: block.type,
        content: block.content,
      })),
    };
    if (yjsUpdate !== undefined && yjsUpdate !== null) {
      update.collaborationYjsState = Buffer.from(yjsUpdate);
    }
    const result = await Document.updateOne({ _id: documentId }, { $set: update });
    if (result.matchedCount !== 1) throw new Error("Document was not found");
  });
  writeQueues.set(documentId, write);
  return write.finally(() => {
    if (writeQueues.get(documentId) === write) writeQueues.delete(documentId);
  });
};

module.exports = { loadDocumentState, persistDocumentState };
