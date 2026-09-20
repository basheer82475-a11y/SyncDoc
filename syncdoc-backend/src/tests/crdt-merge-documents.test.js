const {
  createCRDTDocument,
  createCRDTOperation,
  applyCRDTOperation,
  mergeCRDTDocuments,
} = require("../services/collaboration/crdt.service");

// Create two independent replicas
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

// Replica A receives A then B
documentA = applyCRDTOperation(
  documentA,
  operationA
);

documentA = applyCRDTOperation(
  documentA,
  operationB
);

// Replica B receives B then A
documentB = applyCRDTOperation(
  documentB,
  operationB
);

documentB = applyCRDTOperation(
  documentB,
  operationA
);

// Merge both replicas
const mergedDocument =
  mergeCRDTDocuments(
    documentA,
    documentB
  );

console.log(
  "\nMerged CRDT operations:"
);

console.log(
  mergedDocument.operations
);

console.log(
  "\nMerged CRDT blocks:"
);

console.log(
  JSON.stringify(
    mergedDocument.blocks,
    null,
    2
  )
);

console.log(
  "\nMerged block order:"
);

console.log(
  mergedDocument.order
);