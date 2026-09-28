const express = require("express");
const router = express.Router();

const { register, login, getCurrentUser, logout } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getCurrentUser);
router.post("/logout", authenticate, logout);

module.exports = router;
