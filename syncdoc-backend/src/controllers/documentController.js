const Document = require("../models/Document");

const createDocument = async (req, res) => {
  try {
    const { title, content, blocks } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const document = await Document.create({
      title,
      content: content || "",
      blocks: blocks || [],
    });

    res.status(201).json({
      message: "Document created successfully",
      document,
    });
  } catch (error) {
    console.error("Error creating document:", error);

    res.status(500).json({
      message: "Failed to create document",
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });

    res.status(200).json({
      documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);

    res.status(500).json({
      message: "Failed to fetch documents",
    });
  }
};

const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    res.status(200).json({
      document,
    });
  } catch (error) {
    console.error("Error fetching document:", error);

    res.status(500).json({
      message: "Failed to fetch document",
    });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
};