const mongoose = require("mongoose");
const Permission = require("../../models/permission");

const hasDocumentAccess = async ({ user, documentId, permission }) => {
  if (!user?.userId || !documentId || !permission) {
    return false;
  }

  // Administrators retain access for support and moderation workflows.
  if (user.role === "admin") {
    return true;
  }

  // Do not buffer an authorization query when the database is unavailable.
  // A collaboration request must fail closed instead.
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  try {
    const grant = await Permission.findOne({
      documentId,
      userId: user.userId,
    })
      .select("permission")
      .lean();

    if (!grant) {
      return false;
    }

    return permission === "viewer"
      ? ["viewer", "editor"].includes(grant.permission)
      : grant.permission === "editor";
  } catch {
    return false;
  }
};

module.exports = { hasDocumentAccess };
