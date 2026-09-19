const Permission = require("../models/Permission");

// Share a document with a user
const shareDocument = async (req, res) => {
  try {
    const { documentId, userId, permission } = req.body;

    if (!documentId || !userId || !permission) {
      return res.status(400).json({
        message: "documentId, userId and permission are required"
      });
    }

    if (!["viewer", "editor"].includes(permission)) {
      return res.status(400).json({
        message: "Permission must be viewer or editor"
      });
    }

    const existingPermission = await Permission.findOne({
      documentId,
      userId
    });

    if (existingPermission) {
      existingPermission.permission = permission;
      await existingPermission.save();

      return res.status(200).json({
        message: "Permission updated successfully",
        permission: existingPermission
      });
    }

    const newPermission = await Permission.create({
      documentId,
      userId,
      permission
    });

    res.status(201).json({
      message: "Document shared successfully",
      permission: newPermission
    });

  } catch (error) {
    res.status(500).json({
      message: "Error sharing document",
      error: error.message
    });
  }
};


// Get all permissions for a document
const getDocumentPermissions = async (req, res) => {
  try {
    const { documentId } = req.params;

    const permissions = await Permission.find({ documentId });

    res.status(200).json(permissions);

  } catch (error) {
    res.status(500).json({
      message: "Error getting permissions",
      error: error.message
    });
  }
};


// Update a user's permission
const updatePermission = async (req, res) => {
  try {
    const { documentId, userId } = req.params;
    const { permission } = req.body;

    if (!["viewer", "editor"].includes(permission)) {
      return res.status(400).json({
        message: "Permission must be viewer or editor"
      });
    }

    const updatedPermission = await Permission.findOneAndUpdate(
      { documentId, userId },
      { permission },
      { new: true }
    );

    if (!updatedPermission) {
      return res.status(404).json({
        message: "Permission not found"
      });
    }

    res.status(200).json({
      message: "Permission updated successfully",
      permission: updatedPermission
    });

  } catch (error) {
    res.status(500).json({
      message: "Error updating permission",
      error: error.message
    });
  }
};


// Remove a user's access
const removeUserAccess = async (req, res) => {
  try {
    const { documentId, userId } = req.params;

    const deletedPermission = await Permission.findOneAndDelete({
      documentId,
      userId
    });

    if (!deletedPermission) {
      return res.status(404).json({
        message: "Permission not found"
      });
    }

    res.status(200).json({
      message: "User access removed successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Error removing user access",
      error: error.message
    });
  }
};


module.exports = {
  shareDocument,
  getDocumentPermissions,
  updatePermission,
  removeUserAccess
};