const {
  addBlock,
  updateBlock,
  deleteBlock,
} = require("./ast.service");

const applyOperation = (ast, operation) => {
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