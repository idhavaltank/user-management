import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { getActiveOrganizationId } from '../../offline/organization';
import { getDeviceId } from '../../offline/ids';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import { createRejectedOperationExport, downloadDiagnostics, readOfflineDiagnostics, type OfflineDiagnostics } from '../../offline/storageDiagnostics';
import { useSync } from '../../offline/syncProvider';

interface SyncDiagnosticsDialogProps {
  open: boolean;
  onClose: () => void;
}

const formatBytes = (value: number | null): string => {
  if (value === null) return 'Not available';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const SyncDiagnosticsDialog = ({ open, onClose }: SyncDiagnosticsDialogProps): JSX.Element => {
  const { adapter, backend, persistentStorageGranted } = useOfflineStorage();
  const { snapshot } = useSync();
  const [diagnostics, setDiagnostics] = useState<OfflineDiagnostics | null>(null);
  const [operations, setOperations] = useState<Awaited<ReturnType<NonNullable<typeof adapter>['pendingOutbox']>>>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const organizationId = getActiveOrganizationId();
    if (!adapter || !backend || !organizationId) return;
    try {
      const pending = await adapter.pendingOutbox(organizationId);
      setOperations(pending);
      setDiagnostics(await readOfflineDiagnostics(
        adapter,
        backend,
        persistentStorageGranted,
        organizationId,
        getDeviceId(),
        snapshot.cursor,
        snapshot.lastError,
      ));
      setError(null);
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to read local diagnostics.');
    }
  }, [adapter, backend, persistentStorageGranted, snapshot.cursor, snapshot.lastError]);

  useEffect(() => {
    if (open) refresh().catch(() => undefined);
  }, [open, refresh]);

  const exportRejected = (): void => {
    if (!diagnostics) return;
    downloadDiagnostics(
      `flowsync-rejected-operations-${new Date().toISOString().slice(0, 10)}.json`,
      createRejectedOperationExport(operations, diagnostics),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Sync diagnostics</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            Local-only support information. CRM field values are excluded from the rejected-operation export.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {diagnostics && (
            <Stack spacing={1}>
              <Typography variant="body2"><strong>Storage:</strong> {diagnostics.backend}</Typography>
              <Typography variant="body2"><strong>Persistent storage:</strong> {diagnostics.persistentStorageGranted ? 'granted' : 'not granted'}</Typography>
              <Typography variant="body2"><strong>Sync status:</strong> {snapshot.status}</Typography>
              <Typography variant="body2"><strong>Pending operations:</strong> {diagnostics.pendingCount} ({diagnostics.failedCount} failed)</Typography>
              <Typography variant="body2"><strong>Cursor:</strong> {diagnostics.cursor || 'not initialized'}</Typography>
              <Typography variant="body2"><strong>Storage usage:</strong> {formatBytes(diagnostics.estimate.usageBytes)} / {formatBytes(diagnostics.estimate.quotaBytes)}{diagnostics.estimate.usagePercent === null ? '' : ` (${diagnostics.estimate.usagePercent.toFixed(1)}%)`}</Typography>
              {diagnostics.lastError && <Alert severity="warning">Last sync error: {diagnostics.lastError}</Alert>}
            </Stack>
          )}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Device identity is included only when you explicitly export failed-operation metadata.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { refresh().catch(() => undefined); }}>Refresh</Button>
        <Button onClick={exportRejected} disabled={!diagnostics || diagnostics.failedCount === 0}>Export failed operations</Button>
        <Button variant="contained" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SyncDiagnosticsDialog;
