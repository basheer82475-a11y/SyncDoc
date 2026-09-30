const express = require("express");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { getRegisteredUsers, setUserStatus } = require("../controllers/adminController");

const router = express.Router();
router.get("/users", authenticate, requireAdmin, getRegisteredUsers);
router.patch("/users/:id/status", authenticate, requireAdmin, setUserStatus);

module.exports = router;
