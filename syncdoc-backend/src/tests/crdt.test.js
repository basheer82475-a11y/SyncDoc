console.log("=================================");
console.log("       SyncDoc CRDT Test Suite");
console.log("=================================\n");

console.log("1. Basic CRDT merge");
require("./crdt-merge.test.js");

console.log("\n---------------------------------\n");

console.log("2. CRDT conflict resolution");
require("./crdt-conflict.test.js");

console.log("\n---------------------------------\n");

console.log("3. CRDT document merge");
require("./crdt-merge-documents.test.js");

console.log("\n---------------------------------\n");

console.log("4. CRDT merge conflict");
require("./crdt-merge-conflict.test.js");

console.log("\n---------------------------------\n");

console.log("5. CRDT to AST conversion");
require("./crdt-to-ast.test.js");

console.log("\n---------------------------------\n");

console.log("6. CRDT DELETE conflict");
require("./crdt-delete-conflict.test.js");

console.log("\n=================================");
console.log("       CRDT tests completed");
console.log("=================================");