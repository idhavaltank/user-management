export { useConnectivity } from './connectivity';
export { createOfflineId, getDeviceId } from './ids';
export { IndexedDbStorageAdapter } from './indexedDbStorageAdapter';
export { MemoryStorageAdapter } from './memoryStorageAdapter';
export { createLocalCrmRepository } from './crmRepository';
export { OfflineStorageProvider, useOfflineStorage } from './OfflineStorageProvider';
export { getActiveOrganizationId, setActiveOrganizationId } from './organization';
export { createOfflineStorage, requestPersistentStorage } from './storageFactory';
export type {
  CrmEntityName,
  CrmEntityRecord,
  CrmBaseRecord,
  LocalCrmRecord,
  OfflineStorageAdapter,
  OutboxOperation,
  OutboxStatus,
} from './types';
export { nextHlc } from './hlc';

