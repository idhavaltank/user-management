import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getApiErrorMessage, organizationApi } from '../api/client';
import type {
  ApiKey,
  AuditLog,
  ImportPreviewResponse,
  Invitation,
  Job,
  OrganizationSettings,
  Permission,
  Role,
  Team,
} from '../api/clientTypes';

const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const OrganizationAdminPage = (): JSX.Element => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [lastJob, setLastJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationRoleId, setInvitationRoleId] = useState('');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>([]);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const loadAdminData = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [nextSettings, roleResponse, permissionResponse, teamResponse, invitationResponse, auditResponse, keyResponse, jobResponse] =
        await Promise.all([
          organizationApi.getSettings(id),
          organizationApi.listRoles(id),
          organizationApi.listPermissions(),
          organizationApi.listTeams(id),
          organizationApi.listInvitations(id),
          organizationApi.listAuditLogs(id),
          organizationApi.listApiKeys(id),
          organizationApi.listJobs(id),
        ]);
      setSettings(nextSettings);
      setRoles(roleResponse.items);
      setPermissions(permissionResponse.items);
      setTeams(teamResponse.items);
      setInvitations(invitationResponse.items);
      setAuditLogs(auditResponse.items);
      setApiKeys(keyResponse.items);
      setJobs(jobResponse.items);
      setInvitationRoleId((current) => current || roleResponse.items[0]?.id || '');
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    organizationApi
      .listOrganizations()
      .then((response) => {
        const organization = response.items[0];
        if (!organization) throw new Error('No active organization is available.');
        setOrganizationId(organization.id);
        return loadAdminData(organization.id);
      })
      .catch((loadError: unknown) => {
        setError(getApiErrorMessage(loadError));
        setLoading(false);
      });
  }, []);

  const refresh = async (successMessage?: string): Promise<void> => {
    if (!organizationId) return;
    await loadAdminData(organizationId);
    if (successMessage) setMessage(successMessage);
  };

  const runAction = async (key: string, action: () => Promise<void>, successMessage: string): Promise<void> => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      await refresh(successMessage);
    } catch (actionError: unknown) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async (): Promise<void> => {
    if (!organizationId || !settings) return;
    await runAction(
      'settings',
      async () => {
        const next = await organizationApi.updateSettings(organizationId, {
          defaultRoleId: settings.defaultRoleId,
          requireEmailVerification: settings.requireEmailVerification,
          allowSelfJoin: settings.allowSelfJoin,
        });
        setSettings(next);
      },
      'Organization settings saved.'
    );
  };

  const createRole = async (): Promise<void> => {
    if (!organizationId || !roleName.trim()) return;
    await runAction(
      'role-create',
      async () => {
        await organizationApi.createRole(organizationId, {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: rolePermissions,
        });
        setRoleName('');
        setRoleDescription('');
        setRolePermissions([]);
      },
      'Role created.'
    );
  };

  const createTeam = async (): Promise<void> => {
    if (!organizationId || !teamName.trim()) return;
    await runAction(
      'team-create',
      async () => {
        await organizationApi.createTeam(organizationId, {
          name: teamName.trim(),
          description: teamDescription.trim(),
        });
        setTeamName('');
        setTeamDescription('');
      },
      'Team created.'
    );
  };

  const createInvitation = async (): Promise<void> => {
    if (!organizationId || !invitationEmail.trim() || !invitationRoleId) return;
    await runAction(
      'invitation-create',
      async () => {
        await organizationApi.createInvitation(organizationId, {
          email: invitationEmail.trim(),
          roleId: invitationRoleId,
          idempotencyKey: createIdempotencyKey(),
        });
        setInvitationEmail('');
      },
      'Invitation created and handed to the configured delivery adapter.'
    );
  };

  const createApiKey = async (): Promise<void> => {
    if (!organizationId || !apiKeyName.trim() || apiKeyScopes.length === 0) return;
    await runAction(
      'api-key-create',
      async () => {
        const response = await organizationApi.createApiKey(organizationId, apiKeyName.trim(), apiKeyScopes);
        setCreatedApiKey(response.key);
        setApiKeyName('');
      },
      'API key created. Copy the secret now; it will not be shown again.'
    );
  };

  const previewImport = async (): Promise<void> => {
    if (!organizationId || !importFile) return;
    setBusy('import-preview');
    setError(null);
    setMessage(null);
    try {
      setPreview(await organizationApi.previewImport(organizationId, importFile));
      setMessage('CSV validated. Review rejected rows before committing.');
    } catch (previewError: unknown) {
      setError(getApiErrorMessage(previewError));
    } finally {
      setBusy(null);
    }
  };

  const commitImport = async (): Promise<void> => {
    if (!organizationId || !preview) return;
    await runAction(
      'import-commit',
      async () => {
        const response = await organizationApi.commitImport(organizationId, {
          previewId: preview.previewId,
          idempotencyKey: createIdempotencyKey(),
        });
        setLastJob(response.job);
        setPreview(null);
        setImportFile(null);
      },
      'Import committed.'
    );
  };

  const exportUsers = async (): Promise<void> => {
    if (!organizationId) return;
    await runAction(
      'export',
      async () => {
        const response = await organizationApi.exportUsers(organizationId);
        setLastJob(response.job);
      },
      'Export job completed locally.'
    );
  };

  const isWorking = loading || Boolean(busy);

  return (
    <Container maxWidth="xl">
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Organization administration</Typography>
          <Typography color="text.secondary">
            Manage tenant policy, authorization, invitations, audit history, keys, and data operations.
          </Typography>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        {loading && <CircularProgress size={28} />}
        {!loading && organizationId && (
          <Card>
            <Tabs value={activeTab} onChange={(_event, value: number) => setActiveTab(value)} variant="scrollable" allowScrollButtonsMobile>
              <Tab label="Settings" />
              <Tab label="Roles & permissions" />
              <Tab label="Teams" />
              <Tab label="Invitations" />
              <Tab label="Audit" />
              <Tab label="API keys" />
              <Tab label="Data operations" />
            </Tabs>
            <CardContent>
              {activeTab === 0 && settings && (
                <Stack spacing={2} maxWidth={640}>
                  <Typography variant="h6">Organization settings</Typography>
                  <TextField
                    select
                    label="Default member role"
                    value={settings.defaultRoleId}
                    onChange={(event) => setSettings({ ...settings, defaultRoleId: event.target.value })}
                  >
                    {roles.map((role) => <MenuItem value={role.id} key={role.id}>{role.name}</MenuItem>)}
                  </TextField>
                  <FormControlLabel
                    control={<Checkbox checked={settings.requireEmailVerification} onChange={(event) => setSettings({ ...settings, requireEmailVerification: event.target.checked })} />}
                    label="Require email verification for new members"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={settings.allowSelfJoin} onChange={(event) => setSettings({ ...settings, allowSelfJoin: event.target.checked })} />}
                    label="Allow self-join requests"
                  />
                  <Button variant="contained" onClick={saveSettings} disabled={isWorking}>Save settings</Button>
                </Stack>
              )}

              {activeTab === 1 && (
                <Stack spacing={3}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Create role</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}><TextField fullWidth label="Name" value={roleName} onChange={(event) => setRoleName(event.target.value)} /></Grid>
                      <Grid item xs={12} md={8}><TextField fullWidth label="Description" value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} /></Grid>
                    </Grid>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {permissions.map((permission) => (
                        <FormControlLabel
                          key={permission.id}
                          control={<Checkbox checked={rolePermissions.includes(permission.key)} onChange={(event) => setRolePermissions((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} />}
                          label={permission.key}
                        />
                      ))}
                    </Stack>
                    <Button variant="contained" onClick={createRole} disabled={isWorking || !roleName.trim()}>Create role</Button>
                  </Stack>
                  <Divider />
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Description</TableCell><TableCell>Permissions</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell>{role.name}{role.system ? ' (system)' : ''}</TableCell>
                          <TableCell>{role.description || '-'}</TableCell>
                          <TableCell>{role.permissions.join(', ') || '-'}</TableCell>
                          <TableCell><Button size="small" color="error" disabled={role.system || isWorking} onClick={() => organizationApi.deleteRole(organizationId, role.id).then(() => refresh('Role deleted.')).catch((actionError: unknown) => setError(getApiErrorMessage(actionError)))}>Delete</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
              )}

              {activeTab === 2 && (
                <Stack spacing={3}>
                  <Typography variant="h6">Teams</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}><TextField fullWidth label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Description" value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} /></Grid>
                    <Grid item xs={12} md={2}><Button fullWidth sx={{ height: '100%' }} variant="contained" onClick={createTeam} disabled={isWorking || !teamName.trim()}>Create</Button></Grid>
                  </Grid>
                  {teams.length === 0 && <Typography color="text.secondary">No teams created yet.</Typography>}
                  {teams.map((team) => (
                    <Card variant="outlined" key={team.id}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack><Typography fontWeight={600}>{team.name}</Typography><Typography color="text.secondary">{team.description || 'No description'}</Typography></Stack><Button color="error" onClick={() => organizationApi.deleteTeam(organizationId, team.id).then(() => refresh('Team deleted.')).catch((actionError: unknown) => setError(getApiErrorMessage(actionError)))}>Delete</Button></Stack></CardContent></Card>
                  ))}
                </Stack>
              )}

              {activeTab === 3 && (
                <Stack spacing={3}>
                  <Typography variant="h6">Invite a member</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={5}><TextField fullWidth type="email" label="Email address" value={invitationEmail} onChange={(event) => setInvitationEmail(event.target.value)} /></Grid>
                    <Grid item xs={12} md={4}><TextField fullWidth select label="Role" value={invitationRoleId} onChange={(event) => setInvitationRoleId(event.target.value)}>{roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} md={3}><Button fullWidth sx={{ height: '100%' }} variant="contained" onClick={createInvitation} disabled={isWorking || !invitationEmail.trim() || !invitationRoleId}>Send invitation</Button></Grid>
                  </Grid>
                  <Table size="small"><TableHead><TableRow><TableCell>Email</TableCell><TableCell>Status</TableCell><TableCell>Expires</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
                    {invitations.map((invitation) => <TableRow key={invitation.id}><TableCell>{invitation.email}</TableCell><TableCell>{invitation.status}</TableCell><TableCell>{new Date(invitation.expiresAt).toLocaleString()}</TableCell><TableCell><Button size="small" color="error" disabled={invitation.status !== 'pending'} onClick={() => organizationApi.revokeInvitation(organizationId, invitation.id).then(() => refresh('Invitation revoked.')).catch((actionError: unknown) => setError(getApiErrorMessage(actionError)))}>Revoke</Button></TableCell></TableRow>)}
                  </TableBody></Table>
                </Stack>
              )}

              {activeTab === 4 && (
                <Stack spacing={2}><Typography variant="h6">Audit history</Typography><Table size="small"><TableHead><TableRow><TableCell>When</TableCell><TableCell>Event</TableCell><TableCell>Actor</TableCell><TableCell>Target</TableCell><TableCell>Metadata</TableCell></TableRow></TableHead><TableBody>
                  {auditLogs.map((log) => <TableRow key={log.id}><TableCell>{new Date(log.occurredAt).toLocaleString()}</TableCell><TableCell>{log.eventType}</TableCell><TableCell>{log.actorType}</TableCell><TableCell>{log.targetType || '-'}</TableCell><TableCell>{log.metadata ? JSON.stringify(log.metadata) : '-'}</TableCell></TableRow>)}
                </TableBody></Table>{auditLogs.length === 0 && <Typography color="text.secondary">No audit events found.</Typography>}</Stack>
              )}

              {activeTab === 5 && (
                <Stack spacing={3}>
                  {createdApiKey && <Alert severity="warning">Copy this API key now. The server will not show the secret again.<TextField fullWidth value={createdApiKey} InputProps={{ readOnly: true }} sx={{ mt: 2 }} /></Alert>}
                  <Typography variant="h6">Create scoped API key</Typography>
                  <TextField label="Key name" value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} />
                  <Stack direction="row" flexWrap="wrap" gap={1}>{permissions.map((permission) => <FormControlLabel key={permission.id} control={<Checkbox checked={apiKeyScopes.includes(permission.key)} onChange={(event) => setApiKeyScopes((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} />} label={permission.key} />)}</Stack>
                  <Button variant="contained" onClick={createApiKey} disabled={isWorking || !apiKeyName.trim() || apiKeyScopes.length === 0}>Create API key</Button>
                  <Divider />
                  <Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Prefix</TableCell><TableCell>Scopes</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
                    {apiKeys.map((key) => <TableRow key={key.id}><TableCell>{key.name}</TableCell><TableCell>{key.prefix}</TableCell><TableCell>{key.scopes.join(', ')}</TableCell><TableCell>{key.revoked ? 'revoked' : 'active'}</TableCell><TableCell><Button size="small" color="error" disabled={key.revoked} onClick={() => organizationApi.revokeApiKey(organizationId, key.id).then(() => refresh('API key revoked.')).catch((actionError: unknown) => setError(getApiErrorMessage(actionError)))}>Revoke</Button></TableCell></TableRow>)}
                  </TableBody></Table>
                </Stack>
              )}

              {activeTab === 6 && (
                <Stack spacing={3}>
                  <Typography variant="h6">CSV import/export</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                    <Button component="label" variant="outlined">Choose CSV<input hidden type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] || null)} /></Button>
                    <Typography color="text.secondary">{importFile?.name || 'No file selected'}</Typography>
                    <Button variant="contained" onClick={previewImport} disabled={isWorking || !importFile}>Preview import</Button>
                  </Stack>
                  {preview && <Card variant="outlined"><CardContent><Stack spacing={1}><Typography>Rows: {preview.totalRows} · accepted: {preview.acceptedRows} · rejected: {preview.rejectedRows}</Typography>{preview.rows.filter((row) => !row.accepted).map((row) => <Typography color="error" key={row.rowNumber}>Row {row.rowNumber}: {row.message || row.code}</Typography>)}<Button variant="contained" onClick={commitImport} disabled={isWorking || preview.acceptedRows === 0}>Commit accepted rows</Button></Stack></CardContent></Card>}
                  <Divider />
                  <Button variant="outlined" onClick={exportUsers} disabled={isWorking}>Export users</Button>
                  {lastJob && <Paper variant="outlined" sx={{ p: 2 }}><Typography>Last job: {lastJob.kind}</Typography><Typography color="text.secondary">Status: {lastJob.status} · progress: {lastJob.progress ?? 0}%</Typography></Paper>}
                  <Divider />
                  <Typography variant="h6">Recent jobs</Typography>
                  {jobs.length === 0 && <Typography color="text.secondary">No jobs found.</Typography>}
                  {jobs.map((job) => <Paper variant="outlined" sx={{ p: 2 }} key={job.id}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography>{job.kind}</Typography><Typography color="text.secondary">{job.status} · {job.progress ?? 0}% · {new Date(job.createdAt).toLocaleString()}</Typography></Stack></Paper>)}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
};

export default OrganizationAdminPage;
