const { transformAstToHtml } = require("./ast-to-html.service");
const { sanitizeHtml } = require("./html-sanitizer.service");

const transformDocumentToHtml = (ast = {}) => {
  const html = transformAstToHtml(ast);

  return sanitizeHtml(html);
};

module.exports = {
  transformDocumentToHtml,
};