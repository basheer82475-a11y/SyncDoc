const isConflictingOperation = (
  operationA,
  operationB
) => {
  // Operations must belong to the same document
  if (
    operationA.documentId !==
    operationB.documentId
  ) {
    return false;
  }

  // Operations on different blocks do not conflict
  if (
    operationA.blockId !==
    operationB.blockId
  ) {
    return false;
  }

  // Two updates to the same block conflict
  if (
    operationA.type === "UPDATE_BLOCK" &&
    operationB.type === "UPDATE_BLOCK"
  ) {
    return true;
  }

  // Delete vs update on the same block conflicts
  if (
    (
      operationA.type === "DELETE_BLOCK" &&
      operationB.type === "UPDATE_BLOCK"
    ) ||
    (
      operationA.type === "UPDATE_BLOCK" &&
      operationB.type === "DELETE_BLOCK"
    )
  ) {
    return true;
  }

  return false;
};

module.exports = {
  isConflictingOperation,
};