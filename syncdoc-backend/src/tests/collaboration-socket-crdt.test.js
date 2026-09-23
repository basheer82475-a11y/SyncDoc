const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-test-secret";

const waitForEvent = (socket, event) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 2_000);

    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

const close = (server, io, sockets) =>
  new Promise((resolve) => {
    for (const socket of sockets) {
      socket.close();
    }

    io.close(() => server.close(resolve));
  });

const run = async () => {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: "*" } });
  collaborationSocket(io, { canAccessDocument: async () => true });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  const clientA = createClient(url, {
    transports: ["websocket"],
    auth: { token: jwt.sign({ userId: "user-a" }, process.env.JWT_SECRET) },
  });
  const clientB = createClient(url, {
    transports: ["websocket"],
    auth: { token: jwt.sign({ userId: "user-b" }, process.env.JWT_SECRET) },
  });

  try {
    await Promise.all([
      waitForEvent(clientA, "connect"),
      waitForEvent(clientB, "connect"),
    ]);

    const documentId = "socket-crdt-document";
    const aInitialState = waitForEvent(clientA, "crdt-document-state");
    clientA.emit("join-document", documentId);
    assert.deepStrictEqual((await aInitialState).ast.children, []);

    const add = {
      operationId: "a-add-1",
      type: "ADD_BLOCK",
      documentId,
      blockId: "block-a",
      content: "Created by A",
      position: 0,
      userId: "a",
      timestamp: 1,
    };
    const addConfirmation = waitForEvent(clientA, "crdt-operation-confirmed");
    clientA.emit("crdt-operation", { documentId, operation: add });
    const addResult = await addConfirmation;
    assert.strictEqual(addResult.ast.children[0].content, add.content);

    const bInitialState = waitForEvent(clientB, "crdt-document-state");
    clientB.emit("join-document", documentId);
    const joinedState = await bInitialState;
    assert.deepStrictEqual(joinedState.ast.children, [
      { id: "block-a", type: "paragraph", content: "Created by A" },
    ]);
    assert.ok(joinedState.crdt.operations[addResult.operation.operationId]);

    const update = {
      ...add,
      operationId: "a-update-2",
      type: "UPDATE_BLOCK",
      content: "Updated in real time",
      timestamp: 2,
    };
    const bUpdate = waitForEvent(clientB, "crdt-operation-applied");
    const updateConfirmation = waitForEvent(clientA, "crdt-operation-confirmed");
    clientA.emit("crdt-operation", { documentId, operation: update });

    assert.strictEqual((await bUpdate).ast.children[0].content, update.content);
    const updateResult = await updateConfirmation;
    assert.strictEqual(
      updateResult.crdt.operations[updateResult.operation.operationId].content,
      update.content
    );

    let latestStateA = updateResult.crdt;
    let latestStateB = joinedState.crdt;
    clientA.on("crdt-operation-confirmed", (data) => {
      latestStateA = data.crdt;
    });
    clientA.on("crdt-operation-applied", (data) => {
      latestStateA = data.crdt;
    });
    clientB.on("crdt-operation-confirmed", (data) => {
      latestStateB = data.crdt;
    });
    clientB.on("crdt-operation-applied", (data) => {
      latestStateB = data.crdt;
    });

    const concurrentA = {
      ...add,
      operationId: "a-concurrent-3",
      type: "UPDATE_BLOCK",
      content: "Concurrent edit from A",
    };
    const concurrentB = {
      ...add,
      operationId: "b-concurrent-3",
      type: "UPDATE_BLOCK",
      content: "Concurrent edit from B",
    };
    const concurrentEvents = [
      waitForEvent(clientA, "crdt-operation-confirmed"),
      waitForEvent(clientA, "crdt-operation-applied"),
      waitForEvent(clientB, "crdt-operation-confirmed"),
      waitForEvent(clientB, "crdt-operation-applied"),
    ];

    // Emit without waiting for either confirmation to model concurrent edits.
    clientA.emit("crdt-operation", { documentId, operation: concurrentA });
    clientB.emit("crdt-operation", { documentId, operation: concurrentB });
    await Promise.all(concurrentEvents);

    assert.deepStrictEqual(latestStateA, latestStateB);
    assert.strictEqual(
      latestStateA.blocks["block-a"].content,
      latestStateB.blocks["block-a"].content
    );

    console.log("CRDT join and real-time synchronization passed.");
  } finally {
    await close(server, io, [clientA, clientB]);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
