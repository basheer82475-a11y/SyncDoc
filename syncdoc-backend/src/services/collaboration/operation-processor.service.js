const {
  addConflict,
} = require("./conflict-history.service");
const {
  addBlock,
  updateBlock,
  deleteBlock,
} = require("./ast.service");

const {
  isConflictingOperation,
} = require("./conflict.service");

const applyOperation = (
  ast,
  operation,
  previousOperations = []
) => {
  // Check the new operation against previous operations
  for (const previousOperation of previousOperations) {
    if (
  isConflictingOperation(
    previousOperation,
    operation
  )
) {
  console.log(
    "Conflict detected:",
    previousOperation.operationId,
    "vs",
    operation.operationId
  );

  addConflict(operation.documentId, {
    operationA: previousOperation.operationId,
    operationB: operation.operationId,
    blockId: operation.blockId,
    typeA: previousOperation.type,
    typeB: operation.type,
  });
}
  }

  switch (operation.type) {
    case "ADD_BLOCK": {
      const block = {
        id: operation.blockId,
        type: "paragraph",
        content: operation.content || "",
      };

      return addBlock(
        ast,
        block,
        operation.position ?? ast.children.length
      );
    }

    case "UPDATE_BLOCK": {
      return updateBlock(
        ast,
        operation.blockId,
        operation.content || ""
      );
    }

    case "DELETE_BLOCK": {
      return deleteBlock(
        ast,
        operation.blockId
      );
    }

    default:
      throw new Error(
        `Unsupported operation type: ${operation.type}`
      );
  }
};

module.exports = {
  applyOperation,
};