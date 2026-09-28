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
  await YjsUpdate.create({ documentId, userId, update: Buffer.from(update) });
};

module.exports = { loadYjsUpdates, saveYjsUpdate };
