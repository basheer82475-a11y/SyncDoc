const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const Document = require("../models/Document");
const Permission = require("../models/permission");
const CRDTOperation = require("../models/crdtOperation");
const persistence = require("../services/collaboration/persistence.service");
const crdtPersistence = require("../services/collaboration/crdt-persistence.service");
const yjsPersistence = require("../services/collaboration/yjs-persistence.service");
const collaborationSocket = require("../sockets/collaboration.socket");

require("dotenv").config();
process.env.JWT_SECRET = "collaboration-race-regression-secret";

const databaseName = `syncdoc_collaboration_race_test_${process.pid}`;
const failureDocumentId = new mongoose.Types.ObjectId();
const recoveryDocumentId = new mongoose.Types.ObjectId();
const editorUserId = new mongoose.Types.ObjectId();

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const waitFor = (socket, event, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
  socket.once("connect_error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
});

const startServer = (collaborationOptions) => {
  const server = http.createServer();
  const io = new Server(server);
  collaborationSocket(io, collaborationOptions);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    server,
    io,
    url: `http://127.0.0.1:${server.address().port}`,
  })));
};

const closeServer = ({ server, io }, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  io.close(() => server.close(resolve));
});

const makeClient = (url) => createClient(url, {
  transports: ["websocket"],
  auth: {
    token: jwt.sign({ userId: editorUserId.toString() }, process.env.JWT_SECRET),
  },
});

const join = async (socket, documentId) => {
  const state = waitFor(socket, "crdt-document-state");
  socket.emit("join-document", documentId.toString());
  return state;
};

const addBlock = (socket, documentId, operationId, blockId, content) => {
  const confirmation = waitFor(socket, "crdt-operation-confirmed");
  socket.emit("crdt-operation", {
    documentId: documentId.toString(),
    operation: {
      operationId,
      type: "ADD_BLOCK",
      blockId,
      content,
      position: 0,
    },
  });
  return confirmation;
};

async function testPersistenceFailureDoesNotRollbackLaterMutation() {
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();
  let writeCount = 0;
  const persistenceOptions = {
    persistence,
    loadDocumentOperations: crdtPersistence.loadDocumentOperations,
    saveDocumentOperation: async (...args) => {
      writeCount += 1;
      if (writeCount === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
        throw new Error("Injected operation persistence failure");
      }
      return crdtPersistence.saveDocumentOperation(...args);
    },
    loadYjsUpdates: yjsPersistence.loadYjsUpdates,
    saveYjsUpdate: yjsPersistence.saveYjsUpdate,
  };

  let server;
  const clients = [];
  try {
    await Document.create({ _id: failureDocumentId, title: "Mutation failure regression" });
    await Permission.create({
      documentId: failureDocumentId,
      userId: editorUserId,
      permission: "editor",
    });

    server = await startServer(persistenceOptions);
    const editor = makeClient(server.url);
    clients.push(editor);
    await waitFor(editor, "connect");
    await join(editor, failureDocumentId);
    const acknowledgements = [];
    editor.on("crdt-operation-confirmed", (payload) => acknowledgements.push(payload));

    const firstError = waitFor(editor, "crdt-operation-error");
    const firstOperationId = "must-fail-to-persist";
    editor.emit("crdt-operation", {
      documentId: failureDocumentId.toString(),
      operation: {
        operationId: firstOperationId,
        type: "ADD_BLOCK",
        blockId: "failed-block",
        content: "This edit must roll back",
        position: 0,
      },
    });
    await firstWriteStarted.promise;

    const laterConfirmation = addBlock(
      editor,
      failureDocumentId,
      "later-valid-operation",
      "surviving-block",
      "This later edit must survive",
    );
    releaseFirstWrite.resolve();

    const failedResult = await firstError;
    assert.match(failedResult.message, /Injected operation persistence failure/);
    const confirmed = await laterConfirmation;
    assert.ok(
      acknowledgements.every((payload) => !payload.operation.operationId.endsWith(firstOperationId)),
      "the failed mutation must not receive a success acknowledgement",
    );
    assert.deepStrictEqual(
      confirmed.ast.children.map((block) => block.id),
      ["surviving-block"],
      "the successful later mutation must not include the failed block",
    );
    assert.strictEqual(
      confirmed.crdt.blocks["failed-block"],
      undefined,
      "the failed mutation must be absent from the final in-memory CRDT state",
    );

    const saved = await Document.findById(failureDocumentId).lean();
    assert.strictEqual(saved.collaborationState.blocks["failed-block"], undefined);
    assert.strictEqual(
      saved.collaborationState.blocks["surviving-block"].content,
      "This later edit must survive",
    );
    assert.deepStrictEqual(saved.blocks.map((block) => block.blockId), ["surviving-block"]);
    const persistedOperations = await CRDTOperation.find({
      documentId: failureDocumentId.toString(),
    }).lean();
    assert.deepStrictEqual(
      persistedOperations.map((record) => record.operation.blockId),
      ["surviving-block"],
      "the failed operation must not enter the durable operation log",
    );
    console.log("Persistence failure/concurrent mutation regression passed.");
  } finally {
    releaseFirstWrite.resolve();
    if (server) await closeServer(server, clients);
  }
}

async function testConcurrentFirstJoinsShareRecoveryLoad() {
  const recoveryStarted = deferred();
  const releaseRecovery = deferred();
  let loadCount = 0;
  const delayedLoadOptions = {
    loadDocumentOperations: async (documentId) => {
      loadCount += 1;
      const saved = await crdtPersistence.loadDocumentOperations(documentId);
      recoveryStarted.resolve();
      await releaseRecovery.promise;
      return saved;
    },
    saveDocumentOperation: crdtPersistence.saveDocumentOperation,
    loadYjsUpdates: yjsPersistence.loadYjsUpdates,
    saveYjsUpdate: yjsPersistence.saveYjsUpdate,
  };

  let recoveringServer;
  const clients = [];
  try {
    await Document.create({ _id: recoveryDocumentId, title: "Concurrent recovery regression" });
    await crdtPersistence.saveDocumentOperation(recoveryDocumentId.toString(), {
      operationId: "persisted-operation",
      type: "ADD_BLOCK",
      documentId: recoveryDocumentId.toString(),
      blockId: "persisted-block",
      content: "Persisted version",
      position: 0,
      userId: editorUserId.toString(),
      timestamp: 1,
    });
    await Permission.create({
      documentId: recoveryDocumentId,
      userId: editorUserId,
      permission: "editor",
    });

    recoveringServer = await startServer(delayedLoadOptions);
    const recoveringClientA = makeClient(recoveringServer.url);
    const recoveringClientB = makeClient(recoveringServer.url);
    clients.push(recoveringClientA, recoveringClientB);
    await Promise.all([waitFor(recoveringClientA, "connect"), waitFor(recoveringClientB, "connect")]);

    const recoveredStateA = waitFor(recoveringClientA, "crdt-document-state");
    const recoveredStateB = waitFor(recoveringClientB, "crdt-document-state");
    recoveringClientA.emit("join-document", recoveryDocumentId.toString());
    recoveringClientB.emit("join-document", recoveryDocumentId.toString());
    await recoveryStarted.promise;

    releaseRecovery.resolve();
    const [stateA, stateB] = await Promise.all([recoveredStateA, recoveredStateB]);
    assert.strictEqual(loadCount, 1, "concurrent first joins must share one state load");
    assert.deepStrictEqual(stateA.ast, stateB.ast, "both joining clients must receive the same state");
    assert.deepStrictEqual(
      stateA.ast.children.map((block) => [block.id, block.content]),
      [["persisted-block", "Persisted version"]],
      "both clients must receive the correct recovered state from the single load",
    );
    console.log("Concurrent first joins share one correct recovery load.");
  } finally {
    releaseRecovery.resolve();
    if (recoveringServer) await closeServer(recoveringServer, clients);
  }
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required; test writes only to its generated isolated test database");
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: databaseName });
    await testPersistenceFailureDoesNotRollbackLaterMutation();
    await testConcurrentFirstJoinsShareRecoveryLoad();
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (!databaseName.startsWith("syncdoc_collaboration_race_test_")) {
        throw new Error("Refusing to drop a non-test database");
      }
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
