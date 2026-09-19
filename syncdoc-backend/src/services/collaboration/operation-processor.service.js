const {
  addBlock,
  updateBlock,
  deleteBlock,
} = require("./ast.service");

const validateOperation = (ast, operation) => {
  if (!operation) {
    throw new Error("Operation is required");
  }

  if (!operation.type) {
    throw new Error("Operation type is required");
  }

  if (!operation.documentId) {
    throw new Error("Document ID is required");
  }

  const existingBlock = ast.children.find(
    (block) => block.id === operation.blockId
  );

  switch (operation.type) {
    case "ADD_BLOCK": {
      if (!operation.blockId) {
        throw new Error("Block ID is required for ADD_BLOCK");
      }

      if (existingBlock) {
        throw new Error(
          `Block already exists: ${operation.blockId}`
        );
      }

      break;
    }

    case "UPDATE_BLOCK": {
      if (!operation.blockId) {
        throw new Error("Block ID is required for UPDATE_BLOCK");
      }

      if (!existingBlock) {
        throw new Error(
          `Cannot update missing block: ${operation.blockId}`
        );
      }

      break;
    }

    case "DELETE_BLOCK": {
      if (!operation.blockId) {
        throw new Error("Block ID is required for DELETE_BLOCK");
      }

      if (!existingBlock) {
        throw new Error(
          `Cannot delete missing block: ${operation.blockId}`
        );
      }

      break;
    }

    default:
      throw new Error(
        `Unsupported operation type: ${operation.type}`
      );
  }
};

const applyOperation = (ast, operation) => {
  validateOperation(ast, operation);

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
  validateOperation,
  applyOperation,
};