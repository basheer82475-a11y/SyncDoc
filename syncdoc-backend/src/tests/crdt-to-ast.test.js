const {
  createCRDTDocument,
  createCRDTOperation,
  applyCRDTOperation,
  crdtToAST,
} = require("../services/collaboration/crdt.service");

// Create an empty CRDT document
let document = createCRDTDocument();

// Add first block
const addOperationA = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "block-a",
  content: "Hello from User A",
  position: 0,
  userId: "user-a",
});

document = applyCRDTOperation(
  document,
  addOperationA
);

// Add second block
const addOperationB = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "block-b",
  content: "Hello from User B",
  position: 1,
  userId: "user-b",
});

document = applyCRDTOperation(
  document,
  addOperationB
);

// Convert CRDT state to AST
const ast = crdtToAST(document);

console.log("\nCRDT document:");
console.log(
  JSON.stringify(document, null, 2)
);

console.log("\nConverted AST:");
console.log(
  JSON.stringify(ast, null, 2)
);