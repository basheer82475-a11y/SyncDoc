const express = require("express");

const {
  createDocument,
  getDocuments,
  getDocumentById,
} = require("../controllers/documentController");

const router = express.Router();

router.post("/", createDocument);
router.get("/", getDocuments);
router.get("/:id",getDocumentById);

module.exports = router;