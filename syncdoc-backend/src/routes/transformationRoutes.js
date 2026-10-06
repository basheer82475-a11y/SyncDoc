const express = require("express");
const {
  transformDocument,
  transformDocumentToPdf,
} = require("../controllers/transformationController");

const router = express.Router();

router.post("/html", transformDocument);
router.post("/pdf", transformDocumentToPdf);

module.exports = router;