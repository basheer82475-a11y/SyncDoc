const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-test-secret";
const waitFor = (socket, event, timeoutMs = 2000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
});
const connect = (url, userId) => createClient(url, {
  transports: ["websocket"], auth: { token: jwt.sign({ userId }, process.env.JWT_SECRET) },
});
const close = (server, io, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  io.close(() => server.close(resolve));
});

async function run() {
  const server = http.createServer();
  const io = new Server(server);
  const operations = new Map();
  collaborationSocket(io, {
    blockLockDurationMs: 120,
    canAccessDocument: async ({ user, permission }) =>
      user.userId !== "denied" && (permission === "viewer" || user.userId !== "viewer"),
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
  const owner = connect(url, "owner");
  const other = connect(url, "other");
  const viewer = connect(url, "viewer");
  const denied = connect(url, "denied");
  const clients = [owner, other, viewer, denied];
  const documentId = "lock-test-document";
  const blockId = "block-1";
  try {
    await Promise.all(clients.map((client) => waitFor(client, "connect")));
    await Promise.all([owner, other, viewer].map((client) => {
      const joined = waitFor(client, "crdt-document-state");
      client.emit("join-document", documentId);
      return joined;
    }));
    const add = waitFor(owner, "crdt-operation-confirmed");
    owner.emit("crdt-operation", { documentId, operation: {
      operationId: "seed", type: "ADD_BLOCK", blockId, content: "seed", position: 0,
    } });
    await add;

    const locked = waitFor(other, "block-locked");
    owner.emit("lock-block", { documentId, blockId });
    assert.strictEqual((await locked).userId, "owner");
    let error = waitFor(other, "block-lock-error");
    other.emit("lock-block", { documentId, blockId });
    assert.match((await error).message, /already locked/);
    error = waitFor(other, "crdt-operation-error");
    other.emit("crdt-operation", { documentId, operation: {
      operationId: "blocked-edit", type: "UPDATE_BLOCK", blockId, content: "bad",
    } });
    assert.match((await error).message, /locked/);
    error = waitFor(other, "yjs-update-error");
    other.emit("yjs-update", { documentId, update: [] });
    assert.match((await error).message, /Yjs updates are paused/);
    error = waitFor(viewer, "block-lock-error");
    viewer.emit("lock-block", { documentId, blockId: "viewer-block" });
    assert.match((await error).message, /access/);
    error = waitFor(denied, "operation-error");
    denied.emit("join-document", documentId);
    assert.match((await error).message, /access/);
    error = waitFor(other, "block-lock-error");
    other.emit("unlock-block", { documentId, blockId });
    assert.match((await error).message, /Only the lock owner/);

    await new Promise((resolve) => setTimeout(resolve, 150));
    const relocked = waitFor(other, "block-locked");
    other.emit("lock-block", { documentId, blockId });
    await relocked;
    const unlockedOnDisconnect = waitFor(owner, "block-unlocked");
    other.disconnect();
    assert.strictEqual((await unlockedOnDisconnect).reason, "disconnected");
    const relockAfterDisconnect = waitFor(owner, "block-locked");
    owner.emit("lock-block", { documentId, blockId });
    await relockAfterDisconnect;
    const unlocked = waitFor(owner, "block-unlocked");
    owner.emit("unlock-block", { documentId, blockId });
    await unlocked;
    console.log("Block locking tests passed (ownership, conflict, expiry, permissions, edits, disconnect).");
  } finally {
    await close(server, io, clients);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
