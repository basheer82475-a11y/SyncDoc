const {
  createCRDTDocument,
  createCRDTOperation,
  applyCRDTOperation,
} = require("../services/collaboration/crdt.service");

// Create two independent CRDT documents
let documentA = createCRDTDocument();
let documentB = createCRDTDocument();

// First create the shared block
const addOperation = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Original content",
  position: 0,
  userId: "user-a",
});

// Both clients receive the original block
documentA = applyCRDTOperation(
  documentA,
  addOperation
);

documentB = applyCRDTOperation(
  documentB,
  addOperation
);

// User A updates the shared block
const operationA = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
});

// User B updates the same shared block
const operationB = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
});

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
console.log(
  "\nClient A final block:"
);

console.log(
  JSON.stringify(
    documentA.blocks["shared-block"],
    null,
    2
  )
);

console.log(
  "\nClient B final block:"
);

console.log(
  JSON.stringify(
    documentB.blocks["shared-block"],
    null,
    2
  )
);