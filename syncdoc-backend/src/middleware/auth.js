const jwt = require("jsonwebtoken");
const User = require("../module/user");

const authenticate = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("name email role status");
    if (!user) return res.status(401).json({ message: "User account no longer exists" });
    if (user.status === "blocked" || user.status === "banned") {
      return res.status(403).json({ message: user.status === "banned" ? "This account has been banned" : "This account has been blocked" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Administrator access required" });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
