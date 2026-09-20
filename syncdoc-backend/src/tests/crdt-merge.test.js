const {
  createCRDTDocument,
  createCRDTOperation,
  applyCRDTOperation,
  getOrderedCRDTOperations,
} = require("../services/collaboration/crdt.service");

// Create two independent CRDT documents
let documentA = createCRDTDocument();
let documentB = createCRDTDocument();

// Create two concurrent operations
const operationA = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "block-a",
  content: "Hello from User A",
  position: 0,
  userId: "user-a",
});

const operationB = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "block-b",
  content: "Hello from User B",
  position: 1,
  userId: "user-b",
});

// Apply operations in different orders

// Client A receives A then B
documentA = applyCRDTOperation(
  documentA,
  operationA
);

documentA = applyCRDTOperation(
  documentA,
  operationB
);

// Client B receives B then A
documentB = applyCRDTOperation(
  documentB,
  operationB
);

documentB = applyCRDTOperation(
  documentB,
  operationA
);

// Display results
console.log("Client A operations:");

console.log(
  getOrderedCRDTOperations(documentA)
);

console.log("\nClient B operations:");

console.log(
  getOrderedCRDTOperations(documentB)
);

console.log("\nClient A blocks:");

console.log(
  JSON.stringify(documentA.blocks, null, 2)
);

console.log("\nClient B blocks:");

console.log(
  JSON.stringify(documentB.blocks, null, 2)
);