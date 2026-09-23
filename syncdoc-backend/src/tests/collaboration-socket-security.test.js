const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-test-secret";

const waitForEvent = (socket, event) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      2_000
    );
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

const close = (server, io, sockets) =>
  new Promise((resolve) => {
    sockets.forEach((socket) => socket.close());
    io.close(() => server.close(resolve));
  });

const run = async () => {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: "*" } });
  collaborationSocket(io, {
    canAccessDocument: async ({ user, permission }) =>
      user.userId === "authenticated-user" ||
      (user.userId === "viewer-user" && permission === "viewer"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  const token = jwt.sign({ userId: "authenticated-user" }, process.env.JWT_SECRET);
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    auth: { token },
  });
  const otherClient = createClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    auth: { token: jwt.sign({ userId: "other-user" }, process.env.JWT_SECRET) },
  });
  const viewerClient = createClient(url, {
    transports: ["websocket"],
    auth: {
      token: jwt.sign({ userId: "viewer-user" }, process.env.JWT_SECRET),
    },
  });
  const documentId = "security-test-document";
  const baseOperation = {
    operationId: "client-operation-1",
    type: "ADD_BLOCK",
    documentId,
    blockId: "block-1",
    content: "safe content",
    position: 0,
    userId: "forged-admin-id",
    timestamp: Number.MAX_SAFE_INTEGER,
  };

  try {
    await Promise.all([
      waitForEvent(client, "connect"),
      waitForEvent(otherClient, "connect"),
      waitForEvent(viewerClient, "connect"),
    ]);

    let error = waitForEvent(client, "crdt-operation-error");
    client.emit("crdt-operation", { documentId, operation: baseOperation });
    assert.match((await error).message, /Join the document/);

    error = waitForEvent(client, "operation-error");
    client.emit("join-document", " invalid-room ");
    assert.match((await error).message, /valid document ID/);

    const joined = waitForEvent(client, "crdt-document-state");
    client.emit("join-document", documentId);
    await joined;

    error = waitForEvent(otherClient, "operation-error");
    otherClient.emit("join-document", documentId);
    assert.match((await error).message, /do not have access/);

    const viewerJoined = waitForEvent(viewerClient, "crdt-document-state");
    viewerClient.emit("join-document", documentId);
    await viewerJoined;

    error = waitForEvent(viewerClient, "crdt-operation-error");
    viewerClient.emit("crdt-operation", { documentId, operation: baseOperation });
    assert.match((await error).message, /do not have access/);

    error = waitForEvent(client, "crdt-operation-error");
    client.emit("crdt-operation", {
      documentId,
      operation: { ...baseOperation, content: { html: "<script>" } },
    });
    assert.match((await error).message, /content must be a string/);

    error = waitForEvent(client, "crdt-operation-error");
    client.emit("crdt-operation", {
      documentId,
      operation: { ...baseOperation, documentId: "another-document" },
    });
    assert.match((await error).message, /document ID must match/);

    const confirmation = waitForEvent(client, "crdt-operation-confirmed");
    client.emit("crdt-operation", { documentId, operation: baseOperation });
    const accepted = await confirmation;
    assert.strictEqual(accepted.operation.userId, "authenticated-user");
    assert.notStrictEqual(accepted.operation.timestamp, baseOperation.timestamp);
    assert.match(accepted.operation.operationId, new RegExp(`^${client.id}:`));

    error = waitForEvent(client, "crdt-operation-error");
    client.emit("crdt-operation", { documentId, operation: baseOperation });
    assert.match((await error).message, /Duplicate operation/);

    error = waitForEvent(otherClient, "crdt-operation-error");
    otherClient.emit("crdt-operation", { documentId, operation: baseOperation });
    assert.match((await error).message, /Join the document/);

    const missingTokenClient = createClient(url, {
      transports: ["websocket"],
      reconnection: false,
    });
    const missingTokenError = await waitForEvent(missingTokenClient, "connect_error");
    assert.match(missingTokenError.message, /Authentication required/);
    missingTokenClient.close();

    const invalidTokenClient = createClient(url, {
      transports: ["websocket"],
      auth: { token: "not-a-jwt" },
      reconnection: false,
    });
    const invalidTokenError = await waitForEvent(invalidTokenClient, "connect_error");
    assert.match(invalidTokenError.message, /Authentication failed/);
    invalidTokenClient.close();

    console.log("Collaboration validation and protocol security tests passed.");
  } finally {
    await close(server, io, [client, otherClient, viewerClient]);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
