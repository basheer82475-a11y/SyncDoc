const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    permission: {
      type: String,
      enum: ["viewer", "editor"],
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Permission", permissionSchema);