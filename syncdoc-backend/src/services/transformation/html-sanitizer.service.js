const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const sanitizeHtml = (html = "") => {
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "p",
      "pre",
      "code",
      "blockquote",
      "div",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "br",
    ],
    ALLOWED_ATTR: [],
  });
};

module.exports = {
  sanitizeHtml,
};