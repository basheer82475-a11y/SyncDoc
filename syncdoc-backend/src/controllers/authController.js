const User = require("../module/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    res.json({ message: "Register route working" });
};

const login = async (req, res) => {
    res.json({ message: "Login route working" });
};

module.exports = {
    register,
    login
};