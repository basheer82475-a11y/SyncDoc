const {
  createCRDTDocument,
  createCRDTOperation,
  addCRDTOperation,
  getOrderedCRDTOperations,
} = require("../services/collaboration/crdt.service");

// Create an empty CRDT document
let crdtDocument = createCRDTDocument();

console.log("Initial CRDT document:");
console.log(
  JSON.stringify(crdtDocument, null, 2)
);

// Create operation from User A
const operationA = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
});

// Create operation from User B
const operationB = createCRDTOperation({
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
});

// Add both operations
crdtDocument = addCRDTOperation(
  crdtDocument,
  operationA
);

crdtDocument = addCRDTOperation(
  crdtDocument,
  operationB
);

// Get deterministic operation order
const orderedOperations =
  getOrderedCRDTOperations(
    crdtDocument
  );

console.log("\nOrdered CRDT operations:");

orderedOperations.forEach(
  (operation, index) => {
    console.log(
      `${index + 1}.`,
      operation.operationId,
      "|",
      operation.userId,
      "|",
      operation.content
    );
  }
);

console.log(
  "\nTotal operations:",
  orderedOperations.length
);