// Create a document AST
const createDocumentAST = (blocks = []) => {
  return {
    type: "document",
    children: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      content: block.content,
    })),
  };
};

// Create one block
const createBlock = (
  id,
  type = "paragraph",
  content = ""
) => {
  return {
    id,
    type,
    content,
  };
};

// Add a block at a specific position
const addBlock = (
  ast,
  block,
  position = ast.children.length
) => {
  const updatedChildren = [...ast.children];

  updatedChildren.splice(position, 0, block);

  return {
    ...ast,
    children: updatedChildren,
  };
};

// Update an existing block
const updateBlock = (
  ast,
  blockId,
  newContent
) => {
  return {
    ...ast,
    children: ast.children.map((block) => {
      if (block.id === blockId) {
        return {
          ...block,
          content: newContent,
        };
      }

      return block;
    }),
  };
};

// Delete a block
const deleteBlock = (ast, blockId) => {
  return {
    ...ast,
    children: ast.children.filter(
      (block) => block.id !== blockId
    ),
  };
};

module.exports = {
  createDocumentAST,
  createBlock,
  addBlock,
  updateBlock,
  deleteBlock,
};