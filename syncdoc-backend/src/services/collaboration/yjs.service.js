const Y = require("yjs");

// Create a Yjs document
const createYjsDocument = () => {
  const doc = new Y.Doc();

  const blocks = doc.getMap("blocks");
  const order = doc.getArray("order");

  return {
    doc,
    blocks,
    order,
  };
};

// Add or update a block
const setYjsBlock = (yjsDocument, block) => {
  yjsDocument.blocks.set(block.blockId, {
    blockId: block.blockId,
    type: block.type || "paragraph",
    content: block.content || "",
  });

  if (!yjsDocument.order.toArray().includes(block.blockId)) {
    yjsDocument.order.push([block.blockId]);
  }
};

// Delete a block
const deleteYjsBlock = (yjsDocument, blockId) => {
  yjsDocument.blocks.delete(blockId);

  const currentOrder = yjsDocument.order.toArray();
  const index = currentOrder.indexOf(blockId);

  if (index !== -1) {
    yjsDocument.order.delete(index, 1);
  }
};

// Get current document state
const getYjsDocumentState = (yjsDocument) => {
  return {
    blocks: Object.fromEntries(yjsDocument.blocks.entries()),
    order: yjsDocument.order.toArray(),
  };
};

// Create a Yjs update
const encodeYjsUpdate = (yjsDocument) => {
  return Y.encodeStateAsUpdate(yjsDocument.doc);
};

// Apply a Yjs update to another document
const applyYjsUpdate = (yjsDocument, update) => {
  Y.applyUpdate(yjsDocument.doc, update);
};

module.exports = {
  createYjsDocument,
  setYjsBlock,
  deleteYjsBlock,
  getYjsDocumentState,
  encodeYjsUpdate,
  applyYjsUpdate,
};