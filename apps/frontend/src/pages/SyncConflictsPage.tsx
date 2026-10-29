import { Alert, Button, Card, CardContent, Chip, CircularProgress, Divider, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { syncConflictApi } from '../api/syncConflictApi';
import { getApiErrorMessage } from '../api/httpClient';
import { createOfflineId } from '../offline/ids';
import { getActiveOrganizationId } from '../offline/organization';
import { organizationApi } from '../api/organizationApi';
import type { SyncConflict } from '../api/clientTypes';

const SyncConflictsPage = (): JSX.Element => {
  const [organizationId, setOrganizationId] = useState(getActiveOrganizationId());
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      let scope = organizationId;
      if (!scope) { scope = (await organizationApi.listOrganizations()).items[0]?.id || null; setOrganizationId(scope); }
      if (!scope) throw new Error('No organization is available.');
      setConflicts((await syncConflictApi.list(scope)).items);
    } catch (loadError: unknown) { setError(getApiErrorMessage(loadError)); }
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const resolve = async (conflict: SyncConflict, choice: 'mine' | 'theirs'): Promise<void> => {
    if (!organizationId) return;
    try {
      await syncConflictApi.resolve(organizationId, conflict.id, { choice, deviceId: createOfflineId(), hlc: `${Date.now()}.0` });
      await load();
    } catch (resolveError: unknown) { setError(getApiErrorMessage(resolveError)); }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><BoxTitle /><Button variant="outlined" onClick={() => { load().catch(() => undefined); }}>Refresh</Button></Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <CircularProgress /> : conflicts.length === 0 ? <Alert severity="success">No open sync conflicts.</Alert> : conflicts.map((conflict) => (
        <Card key={conflict.id}><CardContent><Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between"><Typography variant="h6">{conflict.entity} · {conflict.field}</Typography><Chip label="Needs review" color="warning" size="small" /></Stack>
          <Divider />
          <Typography variant="body2">Current value: <strong>{String(conflict.localValue ?? 'empty')}</strong></Typography>
          <Typography variant="body2">Incoming value: <strong>{String(conflict.remoteValue ?? 'empty')}</strong></Typography>
          <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => { resolve(conflict, 'mine').catch(() => undefined); }}>Keep mine</Button><Button variant="contained" onClick={() => { resolve(conflict, 'theirs').catch(() => undefined); }}>Use incoming</Button><Select size="small" value="" displayEmpty onChange={() => undefined}><MenuItem value="">Review history in detail</MenuItem></Select></Stack>
        </Stack></CardContent></Card>
      ))}
    </Stack>
  );
};

const BoxTitle = (): JSX.Element => <Stack><Typography variant="h4">Sync conflicts</Typography><Typography color="text.secondary">Review changes that require an explicit decision.</Typography></Stack>;

export default SyncConflictsPage;
