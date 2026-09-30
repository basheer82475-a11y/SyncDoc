const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const Y = require("yjs");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const { app } = require("../server");
const collaborationSocket = require("../sockets/collaboration.socket");
const User = require("../module/user");
const Document = require("../models/Document");
const Permission = require("../models/permission");
const CRDTOperation = require("../models/crdtOperation");
const YjsUpdate = require("../models/yjsUpdate");

const waitForEvent = (socket, event) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      5_000
    );
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

const postJSON = async (url, path, body) => {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

let server;
let io;

const startServer = async () => {
  server = http.createServer(app);
  io = new Server(server);
  collaborationSocket(io);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
};

const closeServer = () =>
  new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => {
      io = undefined;
      server = undefined;
      resolve();
    });
  });

const run = async () => {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGO_URI and JWT_SECRET are required");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `Integration-${runId}-Pass`;
  const users = [];
  const cleanupEmails = [];
  const sockets = [];
  let document;

  try {
    let url = await startServer();
    const credentials = ["a", "b", "ungranted"].map((suffix) => ({
      name: `Socket Integration ${suffix}`,
      email: `socket-integration-${runId}-${suffix}@example.test`,
      password,
    }));

    for (const user of credentials) {
      const registration = await postJSON(url, "/api/auth/register", user);
      assert.strictEqual(registration.status, 201);
      cleanupEmails.push(user.email);
      const login = await postJSON(url, "/api/auth/login", {
        email: user.email,
        password: user.password,
      });
      assert.strictEqual(login.status, 200);
      assert.ok(login.body.token, "login should issue a JWT");
      users.push({ email: user.email, token: login.body.token });
    }

    const databaseUsers = await User.find({ email: { $in: users.map((u) => u.email) } });
    assert.strictEqual(databaseUsers.length, 3);
    document = await Document.create({ title: `Socket integration ${runId}` });
    await Permission.create(
      databaseUsers.slice(0, 2).map((user) => ({
        documentId: document._id,
        userId: user._id,
        permission: "editor",
      }))
    );

    const clients = users.map(({ token }) => {
      const socket = createClient(url, {
        transports: ["websocket"],
        auth: { token },
      });
      sockets.push(socket);
      return socket;
    });
    await Promise.all(clients.map((socket) => waitForEvent(socket, "connect")));

    const documentId = document._id.toString();
    const initialStates = clients.slice(0, 2).map((socket) =>
      waitForEvent(socket, "crdt-document-state")
    );
    clients.slice(0, 2).forEach((socket) => socket.emit("join-document", documentId));
    const joined = await Promise.all(initialStates);
    assert.deepStrictEqual(joined[0].ast.children, []);
    assert.deepStrictEqual(joined[1].ast.children, []);

    const deniedJoin = waitForEvent(clients[2], "operation-error");
    clients[2].emit("join-document", documentId);
    assert.match((await deniedJoin).message, /do not have access/);

    const add = {
      operationId: "initial-add",
      type: "ADD_BLOCK",
      blockId: "shared-block",
      content: "Created through an HTTP-issued JWT",
      position: 0,
    };
    const addConfirmation = waitForEvent(clients[0], "crdt-operation-confirmed");
    const addBroadcast = waitForEvent(clients[1], "crdt-operation-applied");
    clients[0].emit("crdt-operation", { documentId, operation: add });
    await Promise.all([addConfirmation, addBroadcast]);
    assert.strictEqual(await CRDTOperation.countDocuments({ documentId }), 1);

    const yjsDocument = new Y.Doc();
    yjsDocument.getMap("blocks").set("yjs-block", {
      blockId: "yjs-block",
      type: "paragraph",
      content: "Persisted Yjs content",
    });
    yjsDocument.getArray("order").push(["yjs-block"]);
    const yjsUpdate = Array.from(Y.encodeStateAsUpdate(yjsDocument));
    yjsDocument.destroy();
    const yjsConfirmation = waitForEvent(clients[0], "yjs-update-confirmed");
    const yjsBroadcast = waitForEvent(clients[1], "yjs-update-applied");
    clients[0].emit("yjs-update", { documentId, update: yjsUpdate });
    const [, yjsApplied] = await Promise.all([yjsConfirmation, yjsBroadcast]);
    assert.strictEqual(yjsApplied.state.blocks["yjs-block"].content,
      "Persisted Yjs content");
    assert.strictEqual(await YjsUpdate.countDocuments({ documentId }), 1);

    clients.forEach((socket) => socket.close());
    await closeServer();

    // A fresh Socket.IO server instance has no in-memory room state. Joining
    // after restart must rebuild the document from the MongoDB operation log.
    url = await startServer();
    const recoveredClients = users.map(({ token }) => {
      const socket = createClient(url, {
        transports: ["websocket"],
        auth: { token },
      });
      sockets.push(socket);
      return socket;
    });
    await Promise.all(recoveredClients.map((socket) => waitForEvent(socket, "connect")));
    const recoveredStates = recoveredClients.slice(0, 2).map((socket) =>
      waitForEvent(socket, "crdt-document-state")
    );
    const recoveredYjsStates = recoveredClients.slice(0, 2).map((socket) =>
      waitForEvent(socket, "yjs-document-state")
    );
    recoveredClients.slice(0, 2).forEach((socket) => socket.emit("join-document", documentId));
    const [recoveredA, recoveredB] = await Promise.all(recoveredStates);
    const [recoveredYjsA, recoveredYjsB] = await Promise.all(recoveredYjsStates);
    const expectedAST = [{
      id: "shared-block",
      type: "paragraph",
      content: "Created through an HTTP-issued JWT",
    }];
    assert.deepStrictEqual(recoveredA.ast.children, expectedAST);
    assert.deepStrictEqual(recoveredB.ast.children, expectedAST);
    assert.strictEqual(Object.keys(recoveredA.crdt.operations).length, 1);
    assert.deepStrictEqual(recoveredA.crdt, recoveredB.crdt);
    assert.strictEqual(recoveredYjsA.state.blocks["yjs-block"].content,
      "Persisted Yjs content");
    assert.deepStrictEqual(recoveredYjsA.state, recoveredYjsB.state);

    const duplicateError = waitForEvent(recoveredClients[0], "crdt-operation-error");
    recoveredClients[0].emit("crdt-operation", { documentId, operation: add });
    assert.match((await duplicateError).message, /Duplicate operation/);
    assert.strictEqual(await CRDTOperation.countDocuments({ documentId }), 1);

    const editA = {
      ...add,
      operationId: "concurrent-edit-a",
      type: "UPDATE_BLOCK",
      content: "Concurrent edit A",
    };
    const editB = {
      ...add,
      operationId: "concurrent-edit-b",
      type: "UPDATE_BLOCK",
      content: "Concurrent edit B",
    };
    const finalSnapshots = recoveredClients.slice(0, 2).map((client) =>
      new Promise((resolve) => {
        let received = 0;
        let latest;
        const update = ({ crdt }) => {
          latest = crdt;
          received += 1;
          if (received === 2) {
            client.off("crdt-operation-confirmed", update);
            client.off("crdt-operation-applied", update);
            resolve(latest);
          }
        };
        client.on("crdt-operation-confirmed", update);
        client.on("crdt-operation-applied", update);
      })
    );
    recoveredClients[0].emit("crdt-operation", { documentId, operation: editA });
    recoveredClients[1].emit("crdt-operation", { documentId, operation: editB });
    const [finalStateA, finalStateB] = await Promise.all(finalSnapshots);
    assert.deepStrictEqual(finalStateA, finalStateB);
    assert.strictEqual(Object.keys(finalStateA.operations).length, 3);

    console.log("HTTP login → MongoDB permission → Socket.IO CRDT integration passed.");
  } finally {
    sockets.forEach((socket) => socket.close());
    await closeServer();
    if (document) {
      await YjsUpdate.deleteMany({ documentId: document._id.toString() });
      await CRDTOperation.deleteMany({ documentId: document._id.toString() });
      await Permission.deleteMany({ documentId: document._id });
      await Document.deleteOne({ _id: document._id });
    }
    if (cleanupEmails.length) {
      await User.deleteMany({ email: { $in: cleanupEmails } });
    }
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
