import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationApi } from '../../api/organizationApi';
import { ApiError, getApiErrorMessage } from '../../api/httpClient';
import Iconify from '../../components/iconify/Iconify';
import { createLocalCrmRepository } from '../../offline/crmRepository';
import { getActiveOrganizationId, setActiveOrganizationId } from '../../offline/organization';
import { useConnectivity } from '../../offline/connectivity';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import type { CrmEntityName } from '../../offline/types';

export interface CrmField {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface CrmColumn<T> {
  key: string;
  label: string;
  render: (row: T) => string;
}

export interface CrmListResult<T> {
  items: T[];
  total: number;
}

interface CrmEntityPageProps<T extends { id: string; organizationId: string; createdAt: string; updatedAt: string }> {
  title: string;
  description: string;
  addLabel: string;
  emptyLabel: string;
  columns: CrmColumn<T>[];
  fields: CrmField[];
  initialForm: Record<string, string>;
  entity: CrmEntityName;
  load: (organizationId: string, search: string) => Promise<CrmListResult<T>>;
  create: (organizationId: string, form: Record<string, string>) => Promise<T>;
  update: (organizationId: string, id: string, form: Record<string, string>) => Promise<T>;
  remove: (organizationId: string, id: string) => Promise<void>;
  createLocal: (organizationId: string, form: Record<string, string>) => T;
  updateLocal: (row: T, form: Record<string, string>) => T;
  toForm: (row: T) => Record<string, string>;
}

const isRecoverableOfflineFailure = (error: unknown, online: boolean): boolean => (
  !online || error instanceof TypeError || (error instanceof ApiError && error.status >= 500)
);

const CrmEntityPage = <T extends { id: string; organizationId: string; createdAt: string; updatedAt: string }>({
  title,
  description,
  addLabel,
  emptyLabel,
  columns,
  fields,
  initialForm,
  entity,
  load,
  create,
  update,
  remove,
  createLocal,
  updateLocal,
  toForm,
}: CrmEntityPageProps<T>): JSX.Element => {
  const { adapter, ready } = useOfflineStorage();
  const navigate = useNavigate();
  const { online } = useConnectivity();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [rows, setRows] = useState<T[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<T | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const repository = useMemo(
    () => (adapter ? createLocalCrmRepository<T>(adapter, entity) : null),
    [adapter, entity]
  );

  const refreshPendingCount = useCallback(async (): Promise<void> => {
    if (!repository || !organizationId) return;
    setPendingCount((await repository.pending(organizationId)).length);
  }, [organizationId, repository]);

  const loadRows = useCallback(async ({ preserveNotice = false }: { preserveNotice?: boolean } = {}): Promise<void> => {
    if (!organizationId || !ready || !repository) return;
    setLoading(true);
    setError(null);

    try {
      if (!online) {
        const localRows = await repository.list(organizationId, search);
        setRows(localRows);
        setTotal(localRows.length);
        return;
      }

      try {
        const result = await load(organizationId, search);
        await Promise.all(result.items.map((row) => repository.cacheFromServer(row)));
        setRows(result.items);
        setTotal(result.total);
        setNotice(null);
      } catch (loadError: unknown) {
        if (!isRecoverableOfflineFailure(loadError, online)) throw loadError;
        const localRows = await repository.list(organizationId, search);
        setRows(localRows);
        setTotal(localRows.length);
        if (!preserveNotice) setNotice('Connection unavailable: showing cached CRM data.');
      }
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError));
    } finally {
      await refreshPendingCount();
      setLoading(false);
    }
  }, [load, online, organizationId, ready, refreshPendingCount, repository, search]);

  useEffect(() => {
    let active = true;
    const cachedOrganizationId = getActiveOrganizationId();

    if (!online) {
      if (cachedOrganizationId) {
        setOrganizationId(cachedOrganizationId);
      } else {
        setError('Connect once to choose an organization before using CRM offline.');
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }

    organizationApi
      .listOrganizations()
      .then((result) => {
        if (!result.items[0]) throw new Error('No active organization is available.');
        if (!active) return;
        setActiveOrganizationId(result.items[0].id);
        setOrganizationId(result.items[0].id);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getApiErrorMessage(loadError));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [online]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const dialogTitle = editing ? `Edit ${title.toLowerCase().replace(/s$/, '')}` : addLabel;
  const canSubmit = useMemo(
    () => fields.every((field) => !field.required || form[field.key]?.trim()),
    [fields, form]
  );

  const openCreate = (): void => {
    setEditing(null);
    setForm({ ...initialForm });
    setDialogOpen(true);
  };

  const openEdit = (row: T): void => {
    setEditing(row);
    setForm(toForm(row));
    setDialogOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!organizationId || !canSubmit || !repository) return;
    setSaving(true);
    setError(null);
    const wasEditing = Boolean(editing);
    const localRecord = wasEditing && editing ? updateLocal(editing, form) : createLocal(organizationId, form);
    let saveNotice = wasEditing ? 'Record updated.' : 'Record created.';

    try {
      if (online) {
        try {
          const saved = wasEditing && editing
            ? await update(organizationId, editing.id, form)
            : await create(organizationId, form);
          await repository.cacheFromServer(saved);
          // Online writes also enter the outbox so other devices receive the
          // same operation stream and future reconnects remain idempotent.
          await repository.write(saved, saved);
        } catch (saveError: unknown) {
          if (!isRecoverableOfflineFailure(saveError, online)) throw saveError;
          await repository.write(localRecord, localRecord);
          saveNotice = 'Saved locally. It will sync when the connection returns.';
        }
      } else {
        await repository.write(localRecord, localRecord);
        saveNotice = 'Saved locally. It will sync when the connection returns.';
      }
      setEditing(null);
      setDialogOpen(false);
      setNotice(saveNotice);
      await loadRows({ preserveNotice: true });
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: T): Promise<void> => {
    if (!organizationId || !window.confirm('Delete this record?') || !repository) return;
    try {
      if (online) {
        try {
          await remove(organizationId, row.id);
          await repository.remove(row);
          setNotice('Record deleted.');
        } catch (deleteError: unknown) {
          if (!isRecoverableOfflineFailure(deleteError, online)) throw deleteError;
          await repository.remove(row);
          setNotice('Deleted locally. It will sync when the connection returns.');
        }
      } else {
        await repository.remove(row);
        setNotice('Deleted locally. It will sync when the connection returns.');
      }
      await loadRows({ preserveNotice: true });
    } catch (deleteError: unknown) {
      setError(getApiErrorMessage(deleteError));
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">{title}</Typography>
          <Typography color="text.secondary">{description}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Iconify icon="eva:plus-fill" />} onClick={openCreate}>
          {addLabel}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {!online && <Alert severity="warning">You are offline. CRM changes are saved locally and queued for sync.</Alert>}

      <Paper sx={{ overflow: 'hidden' }}>
        <Toolbar sx={{ gap: 2, px: { xs: 2, md: 3 } }}>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            sx={{ maxWidth: 360, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="body2" color="text.secondary">
            {rows.length} of {total}
          </Typography>
          {pendingCount > 0 && <Chip size="small" color="warning" label={`${pendingCount} pending`} />}
        </Toolbar>
        {loading ? (
          <Stack alignItems="center" py={8}><CircularProgress size={28} /></Stack>
        ) : rows.length === 0 ? (
          <Stack alignItems="center" spacing={1} py={10} px={3}>
            <Iconify icon="eva:folder-remove-outline" width={42} color="text.disabled" />
            <Typography variant="h6">{emptyLabel}</Typography>
            <Typography color="text.secondary">Create your first record to start building the workspace.</Typography>
          </Stack>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => <TableCell key={column.key}>{column.label}</TableCell>)}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    hover
                    key={row.id}
                    tabIndex={0}
                    onClick={() => navigate(`/${entity}/${row.id}`)}
                    onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/${entity}/${row.id}`); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    {columns.map((column) => <TableCell key={column.key}>{column.render(row)}</TableCell>)}
                    <TableCell align="right">
                      <IconButton aria-label="Edit" onClick={(event) => { event.stopPropagation(); openEdit(row); }}><Iconify icon="eva:edit-2-outline" /></IconButton>
                      <IconButton aria-label="Delete" color="error" onClick={(event) => { event.stopPropagation(); handleDelete(row).catch(() => undefined); }}><Iconify icon="eva:trash-2-outline" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            {fields.map((field) => (
              <TextField
                key={field.key}
                fullWidth
                required={field.required}
                label={field.label}
                type={field.type === 'textarea' ? 'text' : field.type || 'text'}
                multiline={field.type === 'textarea'}
                minRows={field.type === 'textarea' ? 3 : undefined}
                select={field.type === 'select'}
                value={form[field.key] || ''}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
              >
                {field.options?.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </TextField>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit || saving} onClick={() => handleSave()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice(null)} message={notice} />
    </Stack>
  );
};

export default CrmEntityPage;
