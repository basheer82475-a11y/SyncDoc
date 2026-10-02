const assert = require("assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const { isConflictingOperation } = require("../services/collaboration/conflict.service");
const collaborationSocket = require("../sockets/collaboration.socket");

process.env.JWT_SECRET = "collaboration-conflict-path-secret";

const waitFor = (socket, event, timeoutMs = 3000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
});

const expectNoEvent = async (events, milliseconds = 150) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  assert.deepStrictEqual(events, []);
};

const close = (server, io, clients) => new Promise((resolve) => {
  clients.forEach((client) => client.close());
  io.close(() => server.close(resolve));
});

async function run() {
  const server = http.createServer();
  const io = new Server(server);
  const records = new Map();
  let failNextSave = false;
  let failNextSnapshot = false;

  collaborationSocket(io, {
    persistence: {
      loadDocumentState: async () => null,
      persistDocumentState: async () => {
        if (failNextSnapshot) {
          failNextSnapshot = false;
          throw new Error("Injected conflict snapshot persistence failure");
        }
      },
    },
    canAccessDocument: async () => true,
    loadDocumentOperations: async (documentId) =>
      (records.get(documentId) || []).map((record) => record.operation),
    saveDocumentOperation: async (documentId, operation, conflicts = []) => {
      if (failNextSave) {
        failNextSave = false;
        throw new Error("Injected conflict operation persistence failure");
      }
      const documentRecords = records.get(documentId) || [];
      documentRecords.push({
        operation,
        ...(conflicts.length > 0 ? { conflicts } : {}),
      });
      records.set(documentId, documentRecords);
    },
    deleteDocumentOperation: async (documentId, operationId) => {
      records.set(documentId, (records.get(documentId) || []).filter(
        (record) => record.operation.operationId !== operationId,
      ));
    },
    loadYjsUpdates: async () => [],
    saveYjsUpdate: async () => {},
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const clients = ["conflict-a", "conflict-b"].map((userId) => createClient(url, {
    transports: ["websocket"],
    auth: { token: jwt.sign({ userId }, process.env.JWT_SECRET) },
  }));
  const [clientA, clientB] = clients;

  const join = async (client, documentId) => {
    const state = waitFor(client, "crdt-document-state");
    client.emit("join-document", documentId);
    return state;
  };
  const send = async (client, documentId, operation) => {
    const confirmation = waitFor(client, "crdt-operation-confirmed");
    client.emit("crdt-operation", { documentId, operation });
    return confirmation;
  };

  try {
    await Promise.all(clients.map((client) => waitFor(client, "connect")));
    const documentId = "conflict-document";
    await Promise.all([join(clientA, documentId), join(clientB, documentId)]);

    const added = await send(clientA, documentId, {
      operationId: "add-shared",
      type: "ADD_BLOCK",
      blockId: "shared-block",
      content: "initial",
      position: 0,
    });
    assert.deepStrictEqual(added.conflicts, []);
    assert.strictEqual(
      records.get(documentId).find((record) => record.operation.operationId === added.operation.operationId).conflicts,
      undefined,
      "conflict-free operations should omit persisted conflict metadata",
    );

    const firstUpdate = await send(clientA, documentId, {
      operationId: "first-update",
      type: "UPDATE_BLOCK",
      blockId: "shared-block",
      content: "first update",
    });
    assert.deepStrictEqual(firstUpdate.conflicts, []);

    const appliedSecondUpdate = waitFor(clientA, "crdt-operation-applied");
    const secondUpdatePromise = send(clientB, documentId, {
      operationId: "second-update",
      type: "UPDATE_BLOCK",
      blockId: "shared-block",
      content: "second update",
    });
    const [secondUpdate, applied] = await Promise.all([secondUpdatePromise, appliedSecondUpdate]);
    assert.strictEqual(secondUpdate.conflicts.length, 1);
    const updateConflict = secondUpdate.conflicts[0];
    assert.deepStrictEqual(
      {
        documentId: updateConflict.documentId,
        operationA: updateConflict.operationA,
        operationB: updateConflict.operationB,
        blockId: updateConflict.blockId,
        typeA: updateConflict.typeA,
        typeB: updateConflict.typeB,
        winnerOperationId: updateConflict.winnerOperationId,
      },
      {
        documentId,
        operationA: firstUpdate.operation.operationId,
        operationB: secondUpdate.operation.operationId,
        blockId: "shared-block",
        typeA: "UPDATE_BLOCK",
        typeB: "UPDATE_BLOCK",
        winnerOperationId: secondUpdate.crdt.blocks["shared-block"].operationId,
      },
    );
    assert.strictEqual(typeof updateConflict.detectedAt, "number");
    assert.deepStrictEqual(applied.conflicts, secondUpdate.conflicts);
    const secondRecord = records.get(documentId).find(
      (record) => record.operation.operationId === secondUpdate.operation.operationId,
    );
    assert.deepStrictEqual(secondRecord.conflicts, secondUpdate.conflicts);

    const thirdUpdate = await send(clientA, documentId, {
      operationId: "third-update",
      type: "UPDATE_BLOCK",
      blockId: "shared-block",
      content: "third update",
    });
    assert.strictEqual(thirdUpdate.conflicts.length, 2);
    assert.strictEqual(
      new Set(thirdUpdate.conflicts.map((conflict) => conflict.operationA)).size,
      2,
      "all prior conflicting updates should be recorded exactly once",
    );
    assert.ok(thirdUpdate.conflicts.every((conflict) =>
      conflict.winnerOperationId === thirdUpdate.crdt.blocks["shared-block"].operationId,
    ), "every conflict winner should match the resolved CRDT block operation");

    const deletion = await send(clientB, documentId, {
      operationId: "delete-shared",
      type: "DELETE_BLOCK",
      blockId: "shared-block",
    });
    assert.ok(deletion.conflicts.length >= 1);
    assert.ok(deletion.conflicts.every((conflict) =>
      conflict.typeA === "UPDATE_BLOCK" && conflict.typeB === "DELETE_BLOCK",
    ));
    assert.ok(deletion.conflicts.every((conflict) =>
      conflict.winnerOperationId === deletion.crdt.blocks["shared-block"].operationId,
    ));
    assert.strictEqual(
      deletion.crdt.blocks["shared-block"].operationId,
      deletion.operation.operationId,
      "the existing deterministic ordering should continue selecting the canonical later delete",
    );

    const otherBlock = await send(clientA, documentId, {
      operationId: "add-other",
      type: "ADD_BLOCK",
      blockId: "other-block",
      content: "other",
      position: 1,
    });
    assert.deepStrictEqual(otherBlock.conflicts, []);
    const otherBlockUpdate = await send(clientB, documentId, {
      operationId: "update-other",
      type: "UPDATE_BLOCK",
      blockId: "other-block",
      content: "other updated",
    });
    assert.deepStrictEqual(otherBlockUpdate.conflicts, []);

    const secondDocument = "other-conflict-document";
    await join(clientA, secondDocument);
    const secondDocumentAdd = await send(clientA, secondDocument, {
      operationId: "other-document-add",
      type: "ADD_BLOCK",
      blockId: "shared-block",
      content: "separate document",
      position: 0,
    });
    assert.deepStrictEqual(secondDocumentAdd.conflicts, []);
    const secondDocumentUpdate = await send(clientA, secondDocument, {
      operationId: "other-document-update",
      type: "UPDATE_BLOCK",
      blockId: "shared-block",
      content: "separate document updated",
    });
    assert.deepStrictEqual(secondDocumentUpdate.conflicts, []);

    const orphanUpdate = await send(clientA, documentId, {
      operationId: "orphan-update",
      type: "UPDATE_BLOCK",
      blockId: "missing-conflict-block",
      content: "update on missing block",
    });
    assert.strictEqual(orphanUpdate.crdt.blocks["missing-conflict-block"], undefined);
    const orphanDelete = await send(clientB, documentId, {
      operationId: "orphan-delete",
      type: "DELETE_BLOCK",
      blockId: "missing-conflict-block",
    });
    assert.strictEqual(orphanDelete.crdt.blocks["missing-conflict-block"], undefined);
    assert.strictEqual(orphanDelete.conflicts.length, 1);
    assert.strictEqual(orphanDelete.conflicts[0].operationA, orphanUpdate.operation.operationId);
    assert.strictEqual(orphanDelete.conflicts[0].operationB, orphanDelete.operation.operationId);
    assert.strictEqual(
      orphanDelete.conflicts[0].winnerOperationId,
      orphanDelete.operation.operationId,
      "missing-block conflicts should use timestamp + operation ID ordering without fabricating a block",
    );
    assert.ok(orphanDelete.conflicts.every((conflict) =>
      typeof conflict.winnerOperationId === "string" && conflict.winnerOperationId.length > 0,
    ));
    const orphanRecord = records.get(documentId).find(
      (record) => record.operation.operationId === orphanDelete.operation.operationId,
    );
    assert.deepStrictEqual(orphanRecord.conflicts, orphanDelete.conflicts);

    const orphanDeleteFirst = await send(clientA, documentId, {
      operationId: "orphan-delete-first",
      type: "DELETE_BLOCK",
      blockId: "another-missing-block",
    });
    const orphanUpdateSecond = await send(clientB, documentId, {
      operationId: "orphan-update-second",
      type: "UPDATE_BLOCK",
      blockId: "another-missing-block",
      content: "update after delete on missing block",
    });
    assert.strictEqual(orphanUpdateSecond.crdt.blocks["another-missing-block"], undefined);
    assert.strictEqual(orphanUpdateSecond.conflicts.length, 1);
    assert.strictEqual(
      orphanUpdateSecond.conflicts[0].winnerOperationId,
      orphanUpdateSecond.operation.operationId,
      "the incoming later update should win by the existing deterministic order",
    );
    assert.ok(orphanUpdateSecond.conflicts.every((conflict) => conflict.winnerOperationId));

    const conflictShape = {
      documentId,
      blockId: "shared-block",
      type: "UPDATE_BLOCK",
    };
    assert.strictEqual(isConflictingOperation(
      { ...conflictShape, operationId: "old", type: "UPDATE_BLOCK" },
      { ...conflictShape, operationId: "new", type: "DELETE_BLOCK" },
    ), true);
    assert.strictEqual(isConflictingOperation(
      { ...conflictShape, operationId: "old", type: "UPDATE_BLOCK" },
      { ...conflictShape, documentId: secondDocument, operationId: "new", type: "UPDATE_BLOCK" },
    ), false);
    assert.strictEqual(isConflictingOperation(
      { ...conflictShape, operationId: "old", type: "UPDATE_BLOCK" },
      { ...conflictShape, operationId: "new", blockId: "other-block", type: "UPDATE_BLOCK" },
    ), false);
    assert.strictEqual(isConflictingOperation(
      { ...conflictShape, operationId: "old", type: "ADD_BLOCK" },
      { ...conflictShape, operationId: "new", type: "ADD_BLOCK" },
    ), false);

    const seedForFailure = await send(clientA, documentId, {
      operationId: "failure-seed-add",
      type: "ADD_BLOCK",
      blockId: "failure-block",
      content: "stable before failure",
      position: 2,
    });
    await send(clientA, documentId, {
      operationId: "failure-seed-update",
      type: "UPDATE_BLOCK",
      blockId: "failure-block",
      content: "stable before failure",
    });
    failNextSave = true;
    const noSuccessEvents = [];
    const failedConfirmationListener = (payload) => noSuccessEvents.push(payload);
    const failedBroadcastListener = (payload) => noSuccessEvents.push(payload);
    clientB.on("crdt-operation-confirmed", failedConfirmationListener);
    clientA.on("crdt-operation-applied", failedBroadcastListener);
    const failure = waitFor(clientB, "crdt-operation-error");
    clientB.emit("crdt-operation", { documentId, operation: {
      operationId: "conflict-write-failure",
      type: "UPDATE_BLOCK",
      blockId: "failure-block",
      content: "must not persist",
    } });
    assert.match((await failure).message, /Injected conflict operation persistence failure/);
    await expectNoEvent(noSuccessEvents);
    clientB.off("crdt-operation-confirmed", failedConfirmationListener);
    clientA.off("crdt-operation-applied", failedBroadcastListener);

    const stateAfterFailure = await join(clientB, documentId);
    assert.strictEqual(
      stateAfterFailure.crdt.blocks["failure-block"].content,
      "stable before failure",
    );
    assert.ok(records.get(documentId).every(
      (record) => record.operation.operationId !== `conflict-b:conflict-write-failure`,
    ));
    assert.strictEqual(seedForFailure.conflicts.length, 0);

    failNextSnapshot = true;
    const noSnapshotSuccessEvents = [];
    const failedSnapshotConfirmation = (payload) => noSnapshotSuccessEvents.push(payload);
    const failedSnapshotBroadcast = (payload) => noSnapshotSuccessEvents.push(payload);
    clientB.on("crdt-operation-confirmed", failedSnapshotConfirmation);
    clientA.on("crdt-operation-applied", failedSnapshotBroadcast);
    const snapshotFailure = waitFor(clientB, "crdt-operation-error");
    clientB.emit("crdt-operation", { documentId, operation: {
      operationId: "conflict-snapshot-failure",
      type: "UPDATE_BLOCK",
      blockId: "failure-block",
      content: "must also roll back",
    } });
    assert.match((await snapshotFailure).message, /Injected conflict snapshot persistence failure/);
    await expectNoEvent(noSnapshotSuccessEvents);
    clientB.off("crdt-operation-confirmed", failedSnapshotConfirmation);
    clientA.off("crdt-operation-applied", failedSnapshotBroadcast);
    assert.ok(records.get(documentId).every(
      (record) => record.operation.operationId !== `conflict-b:conflict-snapshot-failure`,
    ), "a snapshot failure must remove the operation and its conflict metadata from the operation log");
    const stateAfterSnapshotFailure = await join(clientB, documentId);
    assert.strictEqual(
      stateAfterSnapshotFailure.crdt.blocks["failure-block"].content,
      "stable before failure",
    );

    console.log("Live CRDT conflict detection, persistence metadata, and failure behavior passed.");
  } finally {
    await close(server, io, clients);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
