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

const {
  getConflicts,
  clearConflicts,
} = require("../services/collaboration/conflict-history.service");

const documentId = "document-1";

// Start with a clean conflict history
clearConflicts(documentId);

// Create a document with one shared block
let ast = createDocumentAST([
  createBlock(
    "shared-block",
    "paragraph",
    "Original content"
  ),
]);

// User A updates the shared block
const operationA = createOperation({
  type: "UPDATE_BLOCK",
  documentId,
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
});

// User B updates the same shared block
const operationB = createOperation({
  type: "UPDATE_BLOCK",
  documentId,
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
});

// Apply User A's operation
ast = applyOperation(ast, operationA);

// Apply User B's operation
// Pass User A's operation as a previous operation
ast = applyOperation(
  ast,
  operationB,
  [operationA]
);

// Get stored conflicts
const conflicts = getConflicts(documentId);

console.log("Stored conflicts:");
console.log(JSON.stringify(conflicts, null, 2));

console.log("\nConflict count:", conflicts.length);