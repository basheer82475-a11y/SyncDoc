const escapeHtml = (text = "") => {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const transformNodeToHtml = (node) => {
  if (!node || !node.type) {
    return "";
  }

  const content = escapeHtml(node.content || "");

  switch (node.type) {
    case "heading":
      return `<h1>${content}</h1>`;

    case "paragraph":
      return `<p>${content}</p>`;

    case "code":
      return `<pre><code>${content}</code></pre>`;

    case "quote":
      return `<blockquote>${content}</blockquote>`;

    default:
      return `<div>${content}</div>`;
  }
};

const transformAstToHtml = (ast = {}) => {
  const blocks = ast.blocks || ast.children || [];

  return blocks.map(transformNodeToHtml).join("\n");
};

module.exports = {
  escapeHtml,
  transformNodeToHtml,
  transformAstToHtml,
};
