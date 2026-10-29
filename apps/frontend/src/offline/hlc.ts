/**
 * Client-side hybrid logical clock. The server compares the physical and
 * logical parts together with the device id, so reconnect order cannot make a
 * later local edit lose to an older wall-clock timestamp.
 */
let lastPhysicalMs = 0;
let logicalCounter = 0;

export const nextHlc = (): string => {
  const physicalMs = Date.now();
  if (physicalMs > lastPhysicalMs) {
    lastPhysicalMs = physicalMs;
    logicalCounter = 0;
  } else {
    logicalCounter += 1;
  }
  return `${lastPhysicalMs}.${logicalCounter}`;
};
