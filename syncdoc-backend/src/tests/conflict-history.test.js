const {
  addConflict,
  getConflicts,
  clearConflicts,
} = require("../services/collaboration/conflict-history.service");

const documentId = "document-1";

// Start clean
clearConflicts(documentId);

// Add one conflict
addConflict(documentId, {
  operationA: "operation-a",
  operationB: "operation-b",
  blockId: "shared-block",
  typeA: "UPDATE_BLOCK",
  typeB: "UPDATE_BLOCK",
});

// Get stored conflicts
const conflicts = getConflicts(documentId);

console.log("Stored conflicts:");
console.log(JSON.stringify(conflicts, null, 2));

console.log("\nConflict count:", conflicts.length);