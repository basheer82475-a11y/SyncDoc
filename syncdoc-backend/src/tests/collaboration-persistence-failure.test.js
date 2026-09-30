const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const Y = require("yjs");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-failure-test-secret";

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

const expectNoEvent = async (events, milliseconds = 150) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  assert.deepStrictEqual(events, []);
};

const close = (server, io, sockets) =>
  new Promise((resolve) => {
    sockets.forEach((socket) => socket.close());
    io.close(() => server.close(resolve));
  });

const run = async () => {
  const server = http.createServer();
  const io = new Server(server);
  const clients = [];
  collaborationSocket(io, {
    canAccessDocument: async () => true,
    loadDocumentOperations: async () => [],
    saveDocumentOperation: async () => {
      throw new Error("MongoDB operation write failed");
    },
    loadYjsUpdates: async () => [],
    saveYjsUpdate: async () => {
      throw new Error("MongoDB Yjs write failed");
    },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const makeClient = (userId) => {
    const socket = createClient(url, {
      transports: ["websocket"],
      auth: { token: jwt.sign({ userId }, process.env.JWT_SECRET) },
    });
    clients.push(socket);
    return socket;
  };
  const sender = makeClient("persistence-sender");
  const peer = makeClient("persistence-peer");
  const recoveryClient = makeClient("persistence-recovery");

  try {
    await Promise.all(
      clients.map((socket) => waitForEvent(socket, "connect"))
    );

    const documentId = "persistence-failure-document";
    const senderJoined = waitForEvent(sender, "crdt-document-state");
    const peerJoined = waitForEvent(peer, "crdt-document-state");
    sender.emit("join-document", documentId);
    peer.emit("join-document", documentId);
    await Promise.all([senderJoined, peerJoined]);

    const crdtDeliveries = [];
    sender.on("crdt-operation-confirmed", (value) => crdtDeliveries.push(value));
    peer.on("crdt-operation-applied", (value) => crdtDeliveries.push(value));
    const operationError = waitForEvent(sender, "crdt-operation-error");
    sender.emit("crdt-operation", {
      documentId,
      operation: {
        operationId: "must-not-apply",
        type: "ADD_BLOCK",
        blockId: "failed-block",
        content: "This write must fail",
        position: 0,
      },
    });
    assert.match((await operationError).message, /MongoDB operation write failed/);
    await expectNoEvent(crdtDeliveries);

    const yjsDocument = new Y.Doc();
    yjsDocument.getMap("blocks").set("failed-yjs-block", {
      blockId: "failed-yjs-block",
      type: "paragraph",
      content: "This write must fail",
    });
    yjsDocument.getArray("order").push(["failed-yjs-block"]);
    const update = Array.from(Y.encodeStateAsUpdate(yjsDocument));
    yjsDocument.destroy();

    const yjsDeliveries = [];
    sender.on("yjs-update-confirmed", (value) => yjsDeliveries.push(value));
    peer.on("yjs-update-applied", (value) => yjsDeliveries.push(value));
    const yjsError = waitForEvent(sender, "yjs-update-error");
    sender.emit("yjs-update", { documentId, update });
    assert.match((await yjsError).message, /MongoDB Yjs write failed/);
    await expectNoEvent(yjsDeliveries);

    const recoveredCRDT = waitForEvent(recoveryClient, "crdt-document-state");
    const recoveredYjs = waitForEvent(recoveryClient, "yjs-document-state");
    recoveryClient.emit("join-document", documentId);
    const [crdtState, yjsState] = await Promise.all([recoveredCRDT, recoveredYjs]);
    assert.deepStrictEqual(crdtState.ast.children, []);
    assert.deepStrictEqual(crdtState.crdt.operations, {});
    assert.deepStrictEqual(yjsState.state, { blocks: {}, order: [] });

    console.log("Persistence failures do not apply, confirm, or broadcast CRDT/Yjs updates.");
  } finally {
    await close(server, io, clients);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
