const express = require("express");

const {
  shareDocument,
  getDocumentPermissions,
  updatePermission,
  removeUserAccess
} = require("../controllers/sharingController");

const router = express.Router();

// Share document
router.post("/share", shareDocument);

// Get document permissions
router.get("/:documentId", getDocumentPermissions);

// Update permission
router.put("/:documentId/:userId", updatePermission);

// Remove user access
router.delete("/:documentId/:userId", removeUserAccess);

module.exports = router;