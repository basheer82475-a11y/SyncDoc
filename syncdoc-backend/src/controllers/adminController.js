const User = require("../module/user");

const getRegisteredUsers = async (req, res) => {
  try {
    const users = await User.find({}, "name email role status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || "active",
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to load registered users:", error);
    return res.status(500).json({ message: "Unable to load registered users" });
  }
};

const setUserStatus = async (req, res) => {
  const { status } = req.body;
  if (!["active", "blocked", "banned"].includes(status)) {
    return res.status(400).json({ message: "Status must be active, blocked, or banned" });
  }
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ message: "You cannot change your own account status" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).select("name email role status createdAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || "active",
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to update user status:", error);
    return res.status(500).json({ message: "Unable to update user status" });
  }
};

module.exports = { getRegisteredUsers, setUserStatus };
