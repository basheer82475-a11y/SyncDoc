const mongoose = require("mongoose");

const yjsUpdateSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    update: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("YjsUpdate", yjsUpdateSchema);
