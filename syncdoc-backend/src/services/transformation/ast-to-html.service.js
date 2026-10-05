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

  let html;

  switch (node.type) {
    case "heading":
      html = `<h1>${content}</h1>`;
      break;

    case "paragraph":
      html = `<p>${content}</p>`;
      break;

    case "code":
      html = `<pre><code>${content}</code></pre>`;
      break;

    case "quote":
      html = `<blockquote>${content}</blockquote>`;
      break;

    default:
      html = `<div>${content}</div>`;
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    const childrenHtml = node.children
      .map(transformNodeToHtml)
      .filter(Boolean)
      .join("\n");

    return `${html}\n${childrenHtml}`;
  }

  return html;
};

const transformAstToHtml = (ast = {}) => {
  const blocks = ast.blocks || ast.children || [];

  return blocks
    .map(transformNodeToHtml)
    .filter(Boolean)
    .join("\n");
};

module.exports = {
  escapeHtml,
  transformNodeToHtml,
  transformAstToHtml,
};