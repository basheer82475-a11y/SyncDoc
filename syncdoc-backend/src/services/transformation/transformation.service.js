const { transformAstToHtml } = require("./ast-to-html.service");
const { sanitizeHtml } = require("./html-sanitizer.service");
const { transformAstToPdf } = require("./ast-to-pdf.service");

const transformDocumentToHtml = (ast = {}) => {
  const html = transformAstToHtml(ast);

  return sanitizeHtml(html);
};

const transformDocumentToPdf = (ast = {}) => {
  return transformAstToPdf(ast);
};

module.exports = {
  transformDocumentToHtml,
  transformDocumentToPdf,
};