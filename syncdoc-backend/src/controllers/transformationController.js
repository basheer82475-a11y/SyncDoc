const { transformDocumentToHtml } = require("../services/transformation/transformation.service");

const transformDocument = async (req, res) => {
  try {
    const ast = req.body;

    if (!ast || !Array.isArray(ast.blocks)) {
      return res.status(400).json({
        message: "Valid AST with blocks is required",
      });
    }

    const html = transformDocumentToHtml(ast);

    res.status(200).json({
      html,
    });
  } catch (error) {
    console.error("Error transforming document:", error);

    res.status(500).json({
      message: "Failed to transform document",
    });
  }
};

module.exports = {
  transformDocument,
};