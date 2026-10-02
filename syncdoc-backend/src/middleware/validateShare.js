const validateShare = (req, res, next) => {
  const { documentId, userId, permission } = req.body;

  if (!documentId) {
    return res.status(400).json({
      success: false,
      message: "documentId is required"
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required"
    });
  }

  if (!permission) {
    return res.status(400).json({
      success: false,
      message: "permission is required"
    });
  }

  const allowedPermissions = ["view", "edit"];

  if (!allowedPermissions.includes(permission)) {
    return res.status(400).json({
      success: false,
      message: "permission must be view or edit"
    });
  }

  next();
};

module.exports = validateShare;