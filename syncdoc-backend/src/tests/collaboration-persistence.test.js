const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const Y = require("yjs");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const Document = require("../models/Document");
const Permission = require("../models/permission");
const persistence = require("../services/collaboration/persistence.service");

require("dotenv").config();
process.env.JWT_SECRET = "collaboration-persistence-test-secret";
const databaseName = `syncdoc_collaboration_test_${process.pid}`;
const documentId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const waitFor = (socket, event, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  socket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
});
const startServer = (collaborationSocket) => {
  const server = http.createServer();
  const io = new Server(server);
  collaborationSocket(io, { persistence });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    server, io, url: `http://127.0.0.1:${server.address().port}`,
  })));
};
const closeServer = ({ server, io }, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  io.close(() => server.close(resolve));
});
const makeClient = (url) => createClient(url, {
  transports: ["websocket"],
  auth: { token: jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET) },
});

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required; test writes only to its generated isolated test database");
  }
  let firstServer;
  let secondServer;
  const clients = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: databaseName });
    const doc = await Document.create({ _id: documentId, title: "Persistence integration test" });
    await Permission.create({ documentId, userId, permission: "editor" });

    let socketModulePath = require.resolve("../sockets/collaboration.socket");
    let collaborationSocket = require(socketModulePath);
    firstServer = await startServer(collaborationSocket);
    const firstClient = makeClient(firstServer.url);
    clients.push(firstClient);
    await waitFor(firstClient, "connect");
    const firstCRDTState = waitFor(firstClient, "crdt-document-state");
    const firstYjsState = waitFor(firstClient, "yjs-document-state");
    firstClient.emit("join-document", documentId.toString());
    await Promise.all([firstCRDTState, firstYjsState]);

    const confirmation = waitFor(firstClient, "crdt-operation-confirmed");
    firstClient.emit("crdt-operation", { documentId: documentId.toString(), operation: {
      operationId: "persisted-add",
      type: "ADD_BLOCK",
      blockId: "persisted-block",
      content: "Stored in MongoDB",
      position: 0,
    } });
    await confirmation;

    const ydoc = new Y.Doc();
    ydoc.getMap("blocks").set("yjs-block", {
      blockId: "yjs-block", type: "paragraph", content: "Yjs survived restart",
    });
    ydoc.getArray("order").push(["yjs-block"]);
    const yjsConfirmation = waitFor(firstClient, "yjs-update-confirmed");
    firstClient.emit("yjs-update", {
      documentId: documentId.toString(),
      update: Array.from(Y.encodeStateAsUpdate(ydoc)),
    });
    await yjsConfirmation;

    const saved = await Document.findById(documentId).lean();
    assert.strictEqual(saved.collaborationState.blocks["persisted-block"].content, "Stored in MongoDB");
    assert.strictEqual(saved.blocks[0].blockId, "persisted-block");
    const persistedYjsState = saved.collaborationYjsState;
    const persistedYjsLength = Buffer.isBuffer(persistedYjsState)
      ? persistedYjsState.length
      : typeof persistedYjsState?.length === "function"
        ? persistedYjsState.length()
        : persistedYjsState?.buffer?.length;
    assert.ok(
      (Buffer.isBuffer(persistedYjsState) || persistedYjsState?._bsontype === "Binary") &&
        persistedYjsLength > 0,
      "Yjs state must be stored as non-empty Buffer or BSON Binary data"
    );
    await closeServer(firstServer, [firstClient]);
    firstServer = null;

    // Loading a fresh module simulates a server process restart: its in-memory
    // CRDT/Yjs room caches are empty, so join must recover from MongoDB.
    delete require.cache[socketModulePath];
    collaborationSocket = require(socketModulePath);
    secondServer = await startServer(collaborationSocket);
    const recoveredClient = makeClient(secondServer.url);
    clients.push(recoveredClient);
    await waitFor(recoveredClient, "connect");
    const recoveredCRDT = waitFor(recoveredClient, "crdt-document-state");
    const recoveredYjs = waitFor(recoveredClient, "yjs-document-state");
    recoveredClient.emit("join-document", documentId.toString());
    const [crdtState, yjsState] = await Promise.all([recoveredCRDT, recoveredYjs]);
    assert.strictEqual(crdtState.ast.children[0].content, "Stored in MongoDB");
    assert.ok(crdtState.crdt.operations);
    assert.strictEqual(yjsState.state.blocks["yjs-block"].content, "Yjs survived restart");

    console.log(`Persistence and recovery passed using isolated database ${databaseName}.`);
  } finally {
    if (firstServer) await closeServer(firstServer, clients);
    if (secondServer) await closeServer(secondServer, clients);
    if (mongoose.connection.readyState === 1) {
      // This name is generated by this test and is never the configured DB name.
      if (!databaseName.startsWith("syncdoc_collaboration_test_")) {
        throw new Error("Refusing to drop a non-test database");
      }
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
