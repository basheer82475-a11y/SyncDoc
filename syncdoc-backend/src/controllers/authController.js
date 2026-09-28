const User = require("../module/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const createToken = (user) => jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
);

const publicUser = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status || "active"
});

// Register
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = String(email || "").trim().toLowerCase();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword
        });

        const token = createToken(user);
        res.status(201).json({
            message: "User registered successfully",
            token,
            user: publicUser(user)
        });

    } catch (error) {
        res.status(500).json({
            message: "Registration failed",
            error: error.message
        });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.trim().toLowerCase() });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        if (user.status === "blocked" || user.status === "banned") {
            return res.status(403).json({
                message: user.status === "banned" ? "This account has been banned" : "This account has been blocked"
            });
        }

        res.json({
            message: "Login successful",
            token: createToken(user),
            user: publicUser(user)
        });

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};

const getCurrentUser = (req, res) => res.json(publicUser(req.user));
const logout = (req, res) => res.status(204).end();

module.exports = {
    register,
    login,
    getCurrentUser,
    logout
};
