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

// Create two replicas
let documentA = createCRDTDocument();
let documentB = createCRDTDocument();

documentA = applyCRDTOperation(
  documentA,
  addOperation
);

documentB = applyCRDTOperation(
  documentB,
  addOperation
);

// User A updates the block
const updateOperation = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated content",
  userId: "user-a",
});

// User B deletes the same block
const deleteOperation = createCRDTOperation({
  type: "DELETE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  userId: "user-b",
});

// Replica A receives UPDATE
documentA = applyCRDTOperation(
  documentA,
  updateOperation
);

// Replica B receives DELETE
documentB = applyCRDTOperation(
  documentB,
  deleteOperation
);

// Merge both replicas
const mergedDocument =
  mergeCRDTDocuments(
    documentA,
    documentB
  );

console.log("\nMerged shared block:");

console.log(
  JSON.stringify(
    mergedDocument.blocks["shared-block"],
    null,
    2
  )
);

// Merge in reverse order
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

// Check convergence
const firstResult =
  mergedDocument.blocks["shared-block"];

const secondResult =
  reverseMergedDocument.blocks[
    "shared-block"
  ];

const converged =
  firstResult.deleted ===
    secondResult.deleted &&
  firstResult.operationId ===
    secondResult.operationId;

console.log(
  "\nDELETE conflict convergence:",
  converged
);

// Check AST output
console.log("\nFinal AST:");

console.log(
  JSON.stringify(
    require("../services/collaboration/crdt.service")
      .crdtToAST(mergedDocument),
    null,
    2
  )
);