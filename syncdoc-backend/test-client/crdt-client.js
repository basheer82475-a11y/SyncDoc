const { io } = require("socket.io-client");

const {
  createCRDTDocument,
  applyCRDTOperation,
  crdtToAST,
} = require("../src/services/collaboration/crdt.service");

const token = process.env.SOCKET_TOKEN;

if (!token) {
  throw new Error("Set SOCKET_TOKEN to a valid JWT before running this client");
}

const socket = io(
  "http://127.0.0.1:5000",
  {
    transports: ["polling"],
    auth: { token },
  }
);

const documentId = "crdt-shared-document";
const userId = "user-a";

let localCRDTDocument = createCRDTDocument();

// ==========================================
// CONNECT
// ==========================================

socket.on("connect", () => {
  console.log(
    "Connected:",
    socket.id
  );

  console.log(
    "Joining document:",
    documentId
  );

  socket.emit(
    "join-document",
    documentId
  );
});

// ==========================================
// INITIAL CRDT DOCUMENT STATE
// ==========================================

socket.on(
  "crdt-document-state",
  (data) => {
    console.log(
      "\nInitial CRDT document state:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    // A joining client must start from the server's canonical CRDT snapshot,
    // not from a fresh empty document.
    localCRDTDocument = data.crdt;

    // Create a CRDT ADD operation
    const operation = {
      operationId: `${userId}-${Date.now()}`,
      type: "ADD_BLOCK",
      documentId,
      blockId: "block-a",
      content: "Hello from CRDT User A",
      position: 0,
      userId,
      timestamp: Date.now(),
    };

    console.log(
      "\nSending CRDT operation:"
    );

    console.log(
      JSON.stringify(
        operation,
        null,
        2
      )
    );

    socket.emit(
      "crdt-operation",
      {
        documentId,
        operation,
      }
    );
  }
);

// ==========================================
// CRDT OPERATION CONFIRMED
// ==========================================

socket.on(
  "crdt-operation-confirmed",
  (data) => {
    // The confirmation carries the canonical state, including any operation
    // that reached the server immediately before this one.
    localCRDTDocument = data.crdt;

    console.log(
      "\nCRDT operation confirmed:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    console.log(
      "\nClient A local CRDT state:"
    );

    console.log(
      JSON.stringify(
        localCRDTDocument,
        null,
        2
      )
    );

    console.log(
      "\nClient A local AST:"
    );

    console.log(
      JSON.stringify(
        crdtToAST(
          localCRDTDocument
        ),
        null,
        2
      )
    );

    console.log(
      "\nCRDT Client A test completed."
    );

    socket.disconnect();
  }
);

// ==========================================
// CRDT OPERATION FROM OTHER USER
// ==========================================

socket.on(
  "crdt-operation-applied",
  (data) => {
    console.log(
      "\nCRDT operation applied:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    // Apply the received operation
    // to Client A's local CRDT.
    localCRDTDocument =
      applyCRDTOperation(
        localCRDTDocument,
        data.operation
      );

    console.log(
      "\nClient A local CRDT state:"
    );

    console.log(
      JSON.stringify(
        localCRDTDocument,
        null,
        2
      )
    );

    console.log(
      "\nClient A local AST:"
    );

    console.log(
      JSON.stringify(
        crdtToAST(
          localCRDTDocument
        ),
        null,
        2
      )
    );
  }
);

// ==========================================
// CRDT ERROR
// ==========================================

socket.on(
  "crdt-operation-error",
  (data) => {
    console.error(
      "\nCRDT operation error:"
    );

    console.error(data);
  }
);

// ==========================================
// CONNECTION ERROR
// ==========================================

socket.on(
  "connect_error",
  (error) => {
    console.error(
      "Connection error:",
      error.message
    );
  }
);
