const { transformDocumentToHtml } = require("../services/transformation/transformation.service");

const testAst = {
  blocks: [
    {
      type: "heading",
      content: "Hello SyncDoc",
    },
    {
      type: "paragraph",
      content: "This is a test document.",
    },
    {
      type: "paragraph",
      content: "<script>alert('XSS')</script>",
    },
  ],
};

const result = transformDocumentToHtml(testAst);

console.log("Transformation Result:");
console.log(result);

if (!result.includes("<h1>Hello SyncDoc</h1>")) {
  throw new Error("Heading transformation failed");
}

if (!result.includes("<p>This is a test document.</p>")) {
  throw new Error("Paragraph transformation failed");
}

if (result.includes("<script>")) {
  throw new Error("Unsafe script tag was not sanitized");
}

console.log("Transformation tests passed!");