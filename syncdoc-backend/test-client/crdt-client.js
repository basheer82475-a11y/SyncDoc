const { io } = require("socket.io-client");

const socket = io(
  "http://127.0.0.1:5000",
  {
    transports: ["polling"],
  }
);

const documentId = "crdt-shared-document";
const userId = "user-a";

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

socket.on(
  "crdt-operation-confirmed",
  (data) => {
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
      "\nCRDT client test completed."
    );

    socket.disconnect();
  }
);

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
  }
);

socket.on(
  "crdt-operation-error",
  (data) => {
    console.error(
      "\nCRDT operation error:"
    );

    console.error(
      data
    );
  }
);

socket.on(
  "connect_error",
  (error) => {
    console.error(
      "Connection error:",
      error.message
    );
  }
);