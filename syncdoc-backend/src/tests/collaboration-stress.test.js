const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-test-secret";
const waitFor = (socket, event, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
  socket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
});
const close = (server, io, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  io.close(() => server.close(resolve));
});

async function run() {
  const server = http.createServer();
  const io = new Server(server);
  const operations = new Map();
  // Socket permissions are isolated test grants; JWT verification and identity
  // extraction still run through the production authentication middleware.
  collaborationSocket(io, {
    canAccessDocument: async ({ user, permission }) =>
      user.userId.startsWith("stress-user-") && ["viewer", "editor"].includes(permission),
    loadDocumentOperations: async (documentId) => operations.get(documentId) || [],
    saveDocumentOperation: async (documentId, operation) => {
      const current = operations.get(documentId) || [];
      current.push(operation);
      operations.set(documentId, current);
    },
    loadYjsUpdates: async () => [],
    saveYjsUpdate: async () => {},
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const documentId = "ten-client-stress-document";
  const clients = Array.from({ length: 10 }, (_, index) => createClient(url, {
    transports: ["websocket"],
    auth: { token: jwt.sign({ userId: `stress-user-${index}` }, process.env.JWT_SECRET) },
  }));
  try {
    await Promise.all(clients.map((client) => waitFor(client, "connect")));
    const initialStates = clients.map((client) => waitFor(client, "crdt-document-state"));
    clients.forEach((client) => client.emit("join-document", documentId));
    await Promise.all(initialStates);
    console.log("Stress test: 10/10 authenticated clients connected and joined.");

    const count = 40;
    const confirmations = [];
    const errors = [];
    for (const client of clients) {
      client.on("crdt-operation-error", (error) => errors.push(error));
      for (let index = 0; index < count / clients.length; index += 1) {
        const clientIndex = clients.indexOf(client);
        const blockId = index === 0 ? "shared-block" : `block-${clientIndex}-${index}`;
        const type = index === 0 && clientIndex > 0 ? "UPDATE_BLOCK" : "ADD_BLOCK";
        const operationId = `operation-${clientIndex}-${index}`;
        const confirmation = waitFor(client, "crdt-operation-confirmed");
        confirmations.push(confirmation);
        client.emit("crdt-operation", { documentId, operation: {
          operationId, type, blockId,
          content: `${clientIndex}:${index}`,
          position: 0,
        } });
      }
    }
    const accepted = await Promise.all(confirmations);
    assert.strictEqual(accepted.length, count);
    assert.deepStrictEqual(errors, []);

    const invalid = waitFor(clients[0], "crdt-operation-error");
    clients[0].emit("crdt-operation", { documentId, operation: {
      operationId: "invalid-operation", type: "NOT_SUPPORTED", blockId: "bad-block",
    } });
    assert.match((await invalid).message, /Unsupported operation/);

    // Fetch an authoritative snapshot from each socket after all broadcasts settle.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const fullStates = await Promise.all(clients.map((client) => new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      client.once("crdt-document-state", (payload) => { clearTimeout(timer); resolve(payload.crdt); });
      client.emit("join-document", documentId);
    })));
    assert.ok(fullStates.every(Boolean), "all clients must receive an authoritative CRDT state");
    const canonical = JSON.stringify(fullStates[0]);
    assert.ok(fullStates.every((state) => JSON.stringify(state) === canonical), "clients diverged");
    assert.strictEqual(Object.keys(fullStates[0].operations).length, count);
    console.log(`Stress test passed: 10 clients, ${count} accepted operations, converged state, invalid operation rejected.`);
  } finally {
    await close(server, io, clients);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
