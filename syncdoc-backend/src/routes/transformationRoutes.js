const express = require("express");
const { transformDocument } = require("../controllers/transformationController");

const router = express.Router();

router.post("/html", transformDocument);

module.exports = router;
