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
const userId = "user-b";
let localCRDTDocument = createCRDTDocument();
socket.on("connect", () => {
  console.log(
    "Client B connected:",
    socket.id
  );

  console.log(
    "Client B joining:",
    documentId
  );

  socket.emit(
    "join-document",
    documentId
  );
});

socket.on(
  "crdt-document-state",
  (data) => {
    console.log(
      "\nClient B initial state:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    // Hydrate from the canonical room state before applying live operations.
    localCRDTDocument = data.crdt;

    // User B creates a block
    const operation = {
      operationId: `${userId}-${Date.now()}`,
      type: "ADD_BLOCK",
      documentId,
      blockId: "block-b",
      content: "Hello from User B",
      position: 1,
      userId,
      timestamp: Date.now(),
    };

    console.log(
      "\nClient B sending operation:"
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

socket.on(
  "crdt-operation-applied",
  (data) => {
    console.log(
      "\nClient B received operation:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    // Apply the received operation to Client B's local CRDT
    localCRDTDocument =
      applyCRDTOperation(
        localCRDTDocument,
        data.operation
      );

    console.log(
      "\nClient B local CRDT state:"
    );

    console.log(
      JSON.stringify(
        localCRDTDocument,
        null,
        2
      )
    );

    console.log(
      "\nClient B local AST:"
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

socket.on(
  "crdt-operation-confirmed",
  (data) => {
    // Adopt the authoritative snapshot after our own operation, since the
    // sender does not receive its operation through the room broadcast.
    localCRDTDocument = data.crdt;

    console.log(
      "\nClient B operation confirmed:"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    console.log(
      "\nClient B test completed."
    );

    socket.disconnect();
  }
);

socket.on(
  "crdt-operation-error",
  (data) => {
    console.error(
      "\nClient B CRDT error:"
    );

    console.error(data);
  }
);

socket.on(
  "connect_error",
  (error) => {
    console.error(
      "Client B connection error:",
      error.message
    );
  }
);
