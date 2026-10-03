const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const Y = require("yjs");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-snapshot-recovery-test-secret";

const operationRecords = new Map();
const yjsRecords = new Map();
const documentSnapshots = new Map();
const failSnapshotsFor = new Set();
let nextYjsRecordId = 0;

const clone = (value) => JSON.parse(JSON.stringify(value));
const getRecords = (map, documentId) => map.get(documentId) || [];

const persistence = {
  loadDocumentState: async (documentId) => {
    const saved = documentSnapshots.get(documentId);
    return saved ? {
      crdt: clone(saved.crdt),
      yjsUpdate: saved.yjsUpdate ? Buffer.from(saved.yjsUpdate) : null,
    } : null;
  },
  persistDocumentState: async (documentId, crdt, yjsUpdate) => {
    if (failSnapshotsFor.delete(documentId)) {
      throw new Error(`Injected snapshot failure for ${documentId}`);
    }
    documentSnapshots.set(documentId, {
      crdt: clone(crdt),
      yjsUpdate: yjsUpdate ? Buffer.from(yjsUpdate) : null,
    });
  },
};

const loadDocumentOperations = async (documentId) =>
  getRecords(operationRecords, documentId).map(({ operation }) => operation);

const saveDocumentOperation = async (documentId, operation) => {
  const records = getRecords(operationRecords, documentId);
  records.push({ operation: clone(operation) });
  operationRecords.set(documentId, records);
};

const deleteDocumentOperation = async (documentId, operationId) => {
  operationRecords.set(documentId, getRecords(operationRecords, documentId).filter(
    ({ operation }) => operation.operationId !== operationId,
  ));
};

const loadYjsUpdates = async (documentId) =>
  getRecords(yjsRecords, documentId).map(({ update }) => Buffer.from(update));

const saveYjsUpdate = async (documentId, userId, update) => {
  const id = `yjs-record-${++nextYjsRecordId}`;
  const records = getRecords(yjsRecords, documentId);
  records.push({ id, userId, update: Buffer.from(update) });
  yjsRecords.set(documentId, records);
  return id;
};

const deleteYjsUpdate = async (documentId, updateId) => {
  yjsRecords.set(documentId, getRecords(yjsRecords, documentId).filter(
    ({ id }) => id !== updateId,
  ));
};

const waitFor = (socket, event, timeoutMs = 3000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
});

const expectNoEvents = async (events) => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.deepStrictEqual(events, []);
};

const startServer = async () => {
  const server = http.createServer();
  const io = new Server(server);
  collaborationSocket(io, {
    persistence,
    canAccessDocument: async () => true,
    loadDocumentOperations,
    saveDocumentOperation,
    deleteDocumentOperation,
    loadYjsUpdates,
    saveYjsUpdate,
    deleteYjsUpdate,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, io, url: `http://127.0.0.1:${server.address().port}` };
};

const closeServer = (instance, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  instance.io.close(() => instance.server.close(resolve));
});

const makeClient = (url, userId) => createClient(url, {
  transports: ["websocket"],
  auth: { token: jwt.sign({ userId }, process.env.JWT_SECRET) },
});

const join = async (socket, documentId) => {
  const crdtState = waitFor(socket, "crdt-document-state");
  const yjsState = waitFor(socket, "yjs-document-state");
  socket.emit("join-document", documentId);
  return Promise.all([crdtState, yjsState]);
};

const makeYjsUpdate = (blockId, content) => {
  const doc = new Y.Doc();
  doc.getMap("blocks").set(blockId, { blockId, type: "paragraph", content });
  doc.getArray("order").push([blockId]);
  const update = Array.from(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return update;
};

async function run() {
  let firstServer;
  let recoveryServer;
  const firstClients = [];
  const recoveryClients = [];
  const legacyDocumentId = "snapshot-failure-legacy";
  const yjsDocumentId = "snapshot-failure-yjs";

  try {
    firstServer = await startServer();
    const sender = makeClient(firstServer.url, "snapshot-sender");
    const peer = makeClient(firstServer.url, "snapshot-peer");
    firstClients.push(sender, peer);
    await Promise.all([waitFor(sender, "connect"), waitFor(peer, "connect")]);
    await Promise.all([
      join(sender, legacyDocumentId),
      join(peer, legacyDocumentId),
    ]);
    await Promise.all([
      join(sender, yjsDocumentId),
      join(peer, yjsDocumentId),
    ]);

    const legacySuccess = waitFor(sender, "operation-confirmed");
    sender.emit("edit-operation", { documentId: legacyDocumentId, operation: {
      operationId: "legacy-success",
      type: "ADD_BLOCK",
      blockId: "legacy-kept",
      content: "Persisted legacy operation",
      position: 0,
    } });
    await legacySuccess;

    const legacyEvents = [];
    const onOperationConfirmed = (payload) => legacyEvents.push(payload);
    const onOperationApplied = (payload) => legacyEvents.push(payload);
    const onCRDTOperationApplied = (payload) => legacyEvents.push(payload);
    sender.on("operation-confirmed", onOperationConfirmed);
    peer.on("operation-applied", onOperationApplied);
    peer.on("crdt-operation-applied", onCRDTOperationApplied);
    failSnapshotsFor.add(legacyDocumentId);
    const legacyFailure = waitFor(sender, "operation-error");
    sender.emit("edit-operation", { documentId: legacyDocumentId, operation: {
      operationId: "legacy-snapshot-failure",
      type: "ADD_BLOCK",
      blockId: "legacy-rejected",
      content: "Must not return after recovery",
      position: 1,
    } });
    assert.match((await legacyFailure).message, /Injected snapshot failure/);
    await expectNoEvents(legacyEvents);
    sender.off("operation-confirmed", onOperationConfirmed);
    peer.off("operation-applied", onOperationApplied);
    peer.off("crdt-operation-applied", onCRDTOperationApplied);
    const [legacyStateAfterFailure] = await join(sender, legacyDocumentId);
    assert.ok(legacyStateAfterFailure.ast.children.some((block) => block.id === "legacy-kept"));
    assert.ok(!legacyStateAfterFailure.ast.children.some((block) => block.id === "legacy-rejected"));
    assert.deepStrictEqual(
      getRecords(operationRecords, legacyDocumentId).map(({ operation }) => operation.operationId),
      ["snapshot-sender:legacy-success"],
      "only the exact failed legacy operation must be removed",
    );

    const yjsSuccessEvents = [];
    const onYjsSuccess = (payload) => yjsSuccessEvents.push(payload);
    sender.on("yjs-update-confirmed", onYjsSuccess);
    const successfulYjsUpdate = makeYjsUpdate("yjs-kept", "Persisted Yjs update");
    const successfulYjsConfirmation = waitFor(sender, "yjs-update-confirmed");
    sender.emit("yjs-update", { documentId: yjsDocumentId, update: successfulYjsUpdate });
    await successfulYjsConfirmation;
    sender.off("yjs-update-confirmed", onYjsSuccess);

    const yjsEvents = [];
    const onYjsConfirmed = (payload) => yjsEvents.push(payload);
    const onYjsApplied = (payload) => yjsEvents.push(payload);
    sender.on("yjs-update-confirmed", onYjsConfirmed);
    peer.on("yjs-update-applied", onYjsApplied);
    failSnapshotsFor.add(yjsDocumentId);
    const failedYjsUpdate = makeYjsUpdate("yjs-rejected", "Must not return after recovery");
    const yjsFailure = waitFor(sender, "yjs-update-error");
    sender.emit("yjs-update", { documentId: yjsDocumentId, update: failedYjsUpdate });
    assert.match((await yjsFailure).message, /Injected snapshot failure/);
    await expectNoEvents(yjsEvents);
    sender.off("yjs-update-confirmed", onYjsConfirmed);
    peer.off("yjs-update-applied", onYjsApplied);
    const [, yjsStateAfterFailure] = await join(sender, yjsDocumentId);
    assert.strictEqual(yjsStateAfterFailure.state.blocks["yjs-kept"].content, "Persisted Yjs update");
    assert.strictEqual(yjsStateAfterFailure.state.blocks["yjs-rejected"], undefined);
    const savedYjsRecords = getRecords(yjsRecords, yjsDocumentId);
    assert.strictEqual(savedYjsRecords.length, 1, "the exact failed Yjs record must be removed");
    assert.strictEqual(savedYjsRecords[0].id, "yjs-record-1");

    await closeServer(firstServer, firstClients);
    firstServer = null;

    recoveryServer = await startServer();
    const recoveryClient = makeClient(recoveryServer.url, "snapshot-recovery");
    recoveryClients.push(recoveryClient);
    await waitFor(recoveryClient, "connect");
    const [legacyCRDT] = await join(recoveryClient, legacyDocumentId);
    const [, recoveredYjs] = await join(recoveryClient, yjsDocumentId);

    assert.ok(legacyCRDT.ast.children.some((block) => block.id === "legacy-kept"));
    assert.ok(!legacyCRDT.ast.children.some((block) => block.id === "legacy-rejected"));
    assert.ok(legacyCRDT.crdt.operations["snapshot-sender:legacy-success"]);
    assert.ok(!legacyCRDT.crdt.operations["snapshot-sender:legacy-snapshot-failure"]);
    assert.strictEqual(recoveredYjs.state.blocks["yjs-kept"].content, "Persisted Yjs update");
    assert.strictEqual(recoveredYjs.state.blocks["yjs-rejected"], undefined);

    console.log("Snapshot failure cleanup and fresh-process recovery passed for legacy operations and Yjs updates.");
  } finally {
    if (firstServer) await closeServer(firstServer, firstClients);
    if (recoveryServer) await closeServer(recoveryServer, recoveryClients);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
