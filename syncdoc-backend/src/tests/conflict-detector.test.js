const {
  isConflictingOperation,
} = require("../services/collaboration/conflict.service");

// User A updates the shared block
const operationA = {
  operationId: "operation-a",
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User A",
  userId: "user-a",
};

// User B updates the same shared block
const operationB = {
  operationId: "operation-b",
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "shared-block",
  content: "Updated by User B",
  userId: "user-b",
};

// User C updates a different block
const operationC = {
  operationId: "operation-c",
  type: "UPDATE_BLOCK",
  documentId: "document-1",
  blockId: "different-block",
  content: "Updated by User C",
  userId: "user-c",
};

console.log(
  "A vs B:",
  isConflictingOperation(
    operationA,
    operationB
  )
);

console.log(
  "A vs C:",
  isConflictingOperation(
    operationA,
    operationC
  )
);