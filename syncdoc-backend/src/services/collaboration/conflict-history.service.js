const conflictHistory = {};

const addConflict = (documentId, conflict) => {
  if (!conflictHistory[documentId]) {
    conflictHistory[documentId] = [];
  }

  conflictHistory[documentId].push({
    ...conflict,
    detectedAt: Date.now(),
  });

  return conflictHistory[documentId];
};

const getConflicts = (documentId) => {
  return conflictHistory[documentId] || [];
};

const clearConflicts = (documentId) => {
  conflictHistory[documentId] = [];
};

module.exports = {
  addConflict,
  getConflicts,
  clearConflicts,
};