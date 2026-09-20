const {
  createCRDTDocument,
  createCRDTOperation,
  applyCRDTOperation,
  mergeCRDTDocuments,
} = require("../services/collaboration/crdt.service");

// Create the original block
const addOperation = createCRDTOperation({
  type: "ADD_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Original content",
  position: 0,
  userId: "user-a",
});

// Create two independent replicas
let documentA = createCRDTDocument();
let documentB = createCRDTDocument();

// Both replicas receive the original block
documentA = applyCRDTOperation(
  documentA,
  addOperation
);

documentB = applyCRDTOperation(
  documentB,
  addOperation
);

// User A makes an update
const operationA = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
});

// User B makes a concurrent update
const operationB = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
});

// Replica A receives only User A's update
documentA = applyCRDTOperation(
  documentA,
  operationA
);

// Replica B receives only User B's update
documentB = applyCRDTOperation(
  documentB,
  operationB
);

// Merge the two replicas
const mergedDocument =
  mergeCRDTDocuments(
    documentA,
    documentB
  );

console.log(
  "\nMerged shared block:"
);

console.log(
  JSON.stringify(
    mergedDocument.blocks["shared-block"],
    null,
    2
  )
);

// Merge in the opposite direction
const reverseMergedDocument =
  mergeCRDTDocuments(
    documentB,
    documentA
  );

console.log(
  "\nReverse merged shared block:"
);

console.log(
  JSON.stringify(
    reverseMergedDocument.blocks[
      "shared-block"
    ],
    null,
    2
  )
);

// Verify convergence
const firstResult =
  mergedDocument.blocks["shared-block"];

const secondResult =
  reverseMergedDocument.blocks[
    "shared-block"
  ];

const converged =
  firstResult.content ===
    secondResult.content &&
  firstResult.operationId ===
    secondResult.operationId;

console.log(
  "\nCRDT convergence:",
  converged
);