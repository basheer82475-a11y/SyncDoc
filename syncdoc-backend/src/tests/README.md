# Collaboration socket tests

Run the collaboration socket checks from `syncdoc-backend` with:

```sh
npm run test:collaboration
```

The command runs the existing two-client CRDT synchronization and socket
security checks, then tests block lock ownership, permissions, expiry, edit
exclusion, and disconnect cleanup. The ten-client stress check creates an
ephemeral local Socket.IO server, authenticates ten clients with test JWTs,
submits concurrent CRDT operations, rejects an invalid operation, and compares
each client's post-join state. It uses isolated in-memory test permissions; it
does not connect to MongoDB or claim to verify document persistence/recovery.

Run the MongoDB-backed persistence and recovery integration with:

```sh
npm run test:persistence
```

It requires `MONGO_URI` in the environment or `.env`. The test overrides the
URI database name with a process-specific `syncdoc_collaboration_test_*` name,
creates temporary document and permission records there, simulates a fresh
socket process, checks CRDT and Yjs recovery, then drops only that generated
test database.

Collaboration snapshots and Yjs update bytes are stored on the existing
document record. CRDT state is authoritative for CRDT operations; its visible
blocks are also written to the document's existing `blocks` field.
