const createOperation = ({
  type,
  documentId,
  blockId = null,
  content = null,
  position = null,
  userId = null,
}) => {
  return {
    operationId: `operation-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`,
    type,
    documentId,
    blockId,
    content,
    position,
    userId,
    timestamp: Date.now(),
  };
};

module.exports = {
  createOperation,
};