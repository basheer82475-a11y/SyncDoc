const YjsUpdate = require("../../models/yjsUpdate");

const loadYjsUpdates = async (documentId) => {
  const records = await YjsUpdate.find({ documentId })
    .sort({ createdAt: 1, _id: 1 })
    .select("update -_id")
    .lean();

  return records.map(({ update }) =>
    Buffer.isBuffer(update) ? update : Buffer.from(update.value())
  );
};

const saveYjsUpdate = async (documentId, userId, update) => {
  const record = await YjsUpdate.create({
    documentId,
    userId,
    update: Buffer.from(update),
  });
  return record._id.toString();
};

const deleteYjsUpdate = async (documentId, updateId) => {
  await YjsUpdate.deleteOne({ _id: updateId, documentId });
};

module.exports = { loadYjsUpdates, saveYjsUpdate, deleteYjsUpdate };
