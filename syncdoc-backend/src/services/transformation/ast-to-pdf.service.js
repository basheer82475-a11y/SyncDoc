const PDFDocument = require("pdfkit");

const addNodeToPdf = (doc, node) => {
  if (!node || !node.type) {
    return;
  }

  const content = String(node.content || "");

  switch (node.type) {
    case "heading":
      doc.fontSize(18).text(content);
      doc.moveDown(0.5);
      break;

    case "code":
      doc.fontSize(10).text(content);
      doc.moveDown(0.5);
      break;

    case "quote":
      doc.fontSize(12).text("${content}");
      doc.moveDown(0.5);
      break;

    case "paragraph":
    default:
      doc.fontSize(12).text(content);
      doc.moveDown(0.5);
      break;
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      addNodeToPdf(doc, child);
    });
  }
};

const transformAstToPdf = (ast = {}) => {
  const doc = new PDFDocument();

  const blocks = ast.blocks || ast.children || [];

  blocks.forEach((block) => {
    addNodeToPdf(doc, block);
  });

  return doc;
};

module.exports = {
  transformAstToPdf,
};