const mongoose = require("mongoose");

const crdtOperationSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true },
    operationId: { type: String, required: true },
    operation: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

crdtOperationSchema.index(
  { documentId: 1, operationId: 1 },
  { unique: true }
);

module.exports = mongoose.model("CRDTOperation", crdtOperationSchema);
