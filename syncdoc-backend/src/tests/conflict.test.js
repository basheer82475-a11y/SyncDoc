const {
  createDocumentAST,
  createBlock,
} = require("../services/collaboration/ast.service");

const {
  createOperation,
} = require("../services/collaboration/operation.service");

const {
  applyOperation,
} = require("../services/collaboration/operation-processor.service");

// Create a document with one shared block
let ast = createDocumentAST([
  createBlock(
    "shared-block",
    "paragraph",
    "Original content"
  ),
]);

console.log("Initial AST:");
console.log(JSON.stringify(ast, null, 2));

// User A updates the shared block
const operationA = createOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
});

// User B updates the same shared block
const operationB = createOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
});

// Apply User A's operation
ast = applyOperation(ast, operationA);

console.log("\nAfter User A operation:");
console.log(JSON.stringify(ast, null, 2));

// Apply User B's operation
ast = applyOperation(ast, operationB);

console.log("\nAfter User B operation:");
console.log(JSON.stringify(ast, null, 2));