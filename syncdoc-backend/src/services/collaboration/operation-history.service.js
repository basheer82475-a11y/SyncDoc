const operationHistory = {};

const addOperation = (documentId, operation) => {
  if (!operationHistory[documentId]) {
    operationHistory[documentId] = [];
  }

  operationHistory[documentId].push(operation);

  return operationHistory[documentId];
};

const getOperations = (documentId) => {
  return operationHistory[documentId] || [];
};

const clearOperations = (documentId) => {
  operationHistory[documentId] = [];
};

module.exports = {
  addOperation,
  getOperations,
  clearOperations,
};