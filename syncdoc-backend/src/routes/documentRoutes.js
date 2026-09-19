const express = require("express");

const {
  createDocument,
  getDocuments,
} = require("../controllers/documentController");

const router = express.Router();

router.post("/", createDocument);
router.get("/", getDocuments);

module.exports = router;