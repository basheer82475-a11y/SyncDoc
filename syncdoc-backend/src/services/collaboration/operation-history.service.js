// Temporary in-memory operation history
const operationHistory = {};

// Add an operation to a document's history
const addOperationToHistory = (documentId, operation) => {
  if (!operationHistory[documentId]) {
    operationHistory[documentId] = [];
  }

  operationHistory[documentId].push(operation);
};

// Get all operations for a document
const getOperationHistory = (documentId) => {
  return operationHistory[documentId] || [];
};

// Check whether an operation was already received
const hasOperation = (documentId, operationId) => {
  const history = operationHistory[documentId] || [];

  return history.some(
    (operation) => operation.operationId === operationId
  );
};

module.exports = {
  addOperationToHistory,
  getOperationHistory,
  hasOperation,
};