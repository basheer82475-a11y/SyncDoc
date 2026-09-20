// Create an empty CRDT document state
const createCRDTDocument = () => {
  return {
    type: "document",
    blocks: {},
    order: [],
    operations: {},
  };
};

// Create a unique operation ID
const createCRDTOperationId = (userId) => {
  return `${userId}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}`;
};

// Create a CRDT operation
const createCRDTOperation = ({
  type,
  documentId,
  blockId,
  content = null,
  position = null,
  userId,
}) => {
  const timestamp = Date.now();

  return {
    operationId: createCRDTOperationId(userId),
    type,
    documentId,
    blockId,
    content,
    position,
    userId,
    timestamp,
  };
};

// Create a CRDT block
const createCRDTBlock = ({
  blockId,
  type = "paragraph",
  content = "",
  operationId,
  userId,
  timestamp,
}) => {
  return {
    blockId,
    type,
    content,
    operationId,
    userId,
    timestamp,
    deleted: false,
  };
};

// Compare two CRDT operations deterministically
const compareCRDTOperations = (
  operationA,
  operationB
) => {
  if (
    operationA.timestamp !==
    operationB.timestamp
  ) {
    return (
      operationA.timestamp -
      operationB.timestamp
    );
  }

  return operationA.operationId.localeCompare(
    operationB.operationId
  );
};

// Store a CRDT operation
const addCRDTOperation = (
  crdtDocument,
  operation
) => {
  return {
    ...crdtDocument,
    operations: {
      ...crdtDocument.operations,
      [operation.operationId]: operation,
    },
  };
};

// Get CRDT operations in deterministic order
const getOrderedCRDTOperations = (
  crdtDocument
) => {
  return Object.values(
    crdtDocument.operations
  ).sort(compareCRDTOperations);
};

// Apply a single CRDT operation
const applyCRDTOperation = (
  crdtDocument,
  operation
) => {
  const updatedDocument = {
    ...crdtDocument,

    blocks: {
      ...crdtDocument.blocks,
    },

    order: [
      ...crdtDocument.order,
    ],

    operations: {
      ...crdtDocument.operations,
    },
  };

  // Ignore duplicate operations
  if (
    updatedDocument.operations[
      operation.operationId
    ]
  ) {
    return updatedDocument;
  }

  // Store the operation
  updatedDocument.operations[
    operation.operationId
  ] = operation;

  // ADD_BLOCK
  if (operation.type === "ADD_BLOCK") {
    const block = {
      blockId: operation.blockId,
      type: "paragraph",
      content: operation.content || "",
      operationId: operation.operationId,
      userId: operation.userId,
      timestamp: operation.timestamp,
      deleted: false,
    };

    updatedDocument.blocks[
      operation.blockId
    ] = block;

    if (
      !updatedDocument.order.includes(
        operation.blockId
      )
    ) {
      const position =
        operation.position ??
        updatedDocument.order.length;

      updatedDocument.order.splice(
        position,
        0,
        operation.blockId
      );
    }
  }

  // UPDATE_BLOCK
  if (operation.type === "UPDATE_BLOCK") {
    const existingBlock =
      updatedDocument.blocks[
        operation.blockId
      ];

    if (existingBlock) {
      const existingOperation = {
        operationId:
          existingBlock.operationId,
        timestamp:
          existingBlock.timestamp,
      };

      const comparison =
        compareCRDTOperations(
          existingOperation,
          operation
        );

      // Only the deterministically later
      // operation becomes the current state.
      if (comparison < 0) {
        updatedDocument.blocks[
          operation.blockId
        ] = {
          ...existingBlock,
          content:
            operation.content || "",
          operationId:
            operation.operationId,
          userId:
            operation.userId,
          timestamp:
            operation.timestamp,
          deleted: false,
        };
      }
    }
  }

  // DELETE_BLOCK
  if (operation.type === "DELETE_BLOCK") {
    const existingBlock =
      updatedDocument.blocks[
        operation.blockId
      ];

    if (existingBlock) {
      const existingOperation = {
        operationId:
          existingBlock.operationId,
        timestamp:
          existingBlock.timestamp,
      };

      const comparison =
        compareCRDTOperations(
          existingOperation,
          operation
        );

      // Only the deterministically later
      // operation becomes the current state.
      if (comparison < 0) {
        updatedDocument.blocks[
          operation.blockId
        ] = {
          ...existingBlock,
          deleted: true,
          operationId:
            operation.operationId,
          userId:
            operation.userId,
          timestamp:
            operation.timestamp,
        };
      }
    }
  }

  return updatedDocument;
};

// Merge two CRDT documents
const mergeCRDTDocuments = (
  documentA,
  documentB
) => {
  const mergedDocument =
    createCRDTDocument();

  const allOperations = [
    ...Object.values(documentA.operations),
    ...Object.values(documentB.operations),
  ];

  const uniqueOperations = {};

  for (const operation of allOperations) {
    uniqueOperations[operation.operationId] =
      operation;
  }

  const orderedOperations =
    Object.values(uniqueOperations).sort(
      compareCRDTOperations
    );

  for (const operation of orderedOperations) {
    const updatedDocument =
      applyCRDTOperation(
        mergedDocument,
        operation
      );

    mergedDocument.blocks =
      updatedDocument.blocks;

    mergedDocument.order =
      updatedDocument.order;

    mergedDocument.operations =
      updatedDocument.operations;
  }

  return mergedDocument;
};

// Convert CRDT document state into the existing AST format
const crdtToAST = (crdtDocument) => {
  const children = [];

  for (const blockId of crdtDocument.order) {
    const block =
      crdtDocument.blocks[blockId];

    if (!block) {
      continue;
    }

    // Deleted blocks are not included
    // in the visible AST.
    if (block.deleted) {
      continue;
    }

    children.push({
      id: block.blockId,
      type: block.type,
      content: block.content,
    });
  }

  return {
    type: "document",
    children,
  };
};

module.exports = {
  createCRDTDocument,
  createCRDTOperationId,
  createCRDTOperation,
  createCRDTBlock,
  addCRDTOperation,
  compareCRDTOperations,
  getOrderedCRDTOperations,
  applyCRDTOperation,
  mergeCRDTDocuments,
  crdtToAST,
};