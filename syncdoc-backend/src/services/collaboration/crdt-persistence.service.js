const CRDTOperation = require("../../models/crdtOperation");

const loadDocumentOperations = async (documentId) => {
  const records = await CRDTOperation.find({ documentId })
    .sort({ "operation.timestamp": 1, operationId: 1 })
    .select("operation -_id")
    .lean();

  return records.map(({ operation }) => operation);
};

const saveDocumentOperation = async (documentId, operation) => {
  try {
    await CRDTOperation.create({
      documentId,
      operationId: operation.operationId,
      operation,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("Duplicate operation received");
    }
    throw error;
  }
};

module.exports = { loadDocumentOperations, saveDocumentOperation };
