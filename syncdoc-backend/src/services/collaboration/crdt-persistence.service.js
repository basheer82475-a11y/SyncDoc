const CRDTOperation = require("../../models/crdtOperation");

const loadDocumentOperations = async (documentId) => {
  const records = await CRDTOperation.find({ documentId })
    .sort({ "operation.timestamp": 1, operationId: 1 })
    .select("operation -_id")
    .lean();

  return records.map(({ operation }) => operation);
};

const saveDocumentOperation = async (documentId, operation, conflicts = []) => {
  try {
    const record = {
      documentId,
      operationId: operation.operationId,
      operation,
    };
    if (conflicts.length > 0) record.conflicts = conflicts;
    await CRDTOperation.create(record);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("Duplicate operation received");
    }
    throw error;
  }
};

const deleteDocumentOperation = async (documentId, operationId) => {
  await CRDTOperation.deleteOne({ documentId, operationId });
};

module.exports = {
  loadDocumentOperations,
  saveDocumentOperation,
  deleteDocumentOperation,
};
