const mongoose = require("mongoose");

// Nested document block schema
const blockSchema = new mongoose.Schema(
  {
    blockId: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      default: "paragraph",
    },

    content: {
      type: String,
      default: "",
    },

    parentId: {
      type: String,
      default: null,
    },

    children: [],
  },
  {
    _id: false,
  }
);

// Recursively trace parent-child relationships
const updateParentRelationships = (blocks, parentId = null) => {
  if (!Array.isArray(blocks)) {
    return;
  }

  blocks.forEach((block) => {
    block.parentId = parentId;

    if (Array.isArray(block.children)) {
      updateParentRelationships(
        block.children,
        block.blockId
      );
    }
  });
};

// Document schema
const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },

    // Nested AST blocks
    blocks: {
      type: [blockSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Recursive pre-save hook
documentSchema.pre("save", function (next) {
  updateParentRelationships(this.blocks);
  next();
});

module.exports = mongoose.model(
  "Document",
  documentSchema
);