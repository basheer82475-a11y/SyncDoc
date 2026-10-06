const {
  transformDocumentToHtml,
  transformDocumentToPdf: generatePdf,
} = require("../services/transformation/transformation.service");

const validateAst = (ast) => {
  return ast && Array.isArray(ast.blocks) && ast.blocks.length > 0;
};

const transformDocument = async (req, res) => {
  try {
    const ast = req.body;

    if (!validateAst(ast)) {
      return res.status(400).json({
        message: "Valid AST with at least one block is required",
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

const transformDocumentToPdf = async (req, res) => {
  try {
    const ast = req.body;

    if (!validateAst(ast)) {
      return res.status(400).json({
        message: "Valid AST with at least one block is required",
      });
    }

    const pdfDocument = generatePdf(ast);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="syncdoc-document.pdf"'
    );

    pdfDocument.pipe(res);
    pdfDocument.end();
  } catch (error) {
    console.error("Error generating PDF:", error);

    res.status(500).json({
      message: "Failed to generate PDF",
    });
  }
};

module.exports = {
  transformDocument,
  transformDocumentToPdf,
};