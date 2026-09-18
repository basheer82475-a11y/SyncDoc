const {
  createDocumentAST,
} = require("../services/collaboration/ast.service");

const {
  createOperation,
} = require("../services/collaboration/operation.service");

const {
  applyOperation,
} = require("../services/collaboration/operation-processor.service");

// Start with an empty AST
let ast = createDocumentAST([]);

console.log("Initial AST:");
console.log(JSON.stringify(ast, null, 2));

// Create an ADD_BLOCK operation
const addOperation = createOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "block-1",
  content: "Hello from User A",
  position: 0,
  userId: "user-a",
});

// Apply ADD_BLOCK
ast = applyOperation(ast, addOperation);

console.log("\nAfter ADD_BLOCK:");
console.log(JSON.stringify(ast, null, 2));

// Create an UPDATE_BLOCK operation
const updateOperation = createOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "block-1",
  content: "Updated by User B",
  userId: "user-b",
});

// Apply UPDATE_BLOCK
ast = applyOperation(ast, updateOperation);

console.log("\nAfter UPDATE_BLOCK:");
console.log(JSON.stringify(ast, null, 2));

// Create a DELETE_BLOCK operation
const deleteOperation = createOperation({
  type: "DELETE_BLOCK",
  documentId: "document-1",
  blockId: "block-1",
  userId: "user-a",
});

// Apply DELETE_BLOCK
ast = applyOperation(ast, deleteOperation);

console.log("\nAfter DELETE_BLOCK:");
console.log(JSON.stringify(ast, null, 2));