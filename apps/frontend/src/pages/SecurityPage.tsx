import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { authApi, getApiErrorMessage } from '../api/client';
import type { Session } from '../api/clientTypes';

const SecurityPage = (): JSX.Element => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = (): void => {
    setLoading(true);
    authApi
      .listSessions()
      .then((response) => setSessions(response.items))
      .catch((loadError: unknown) => setError(getApiErrorMessage(loadError)))
      .finally(() => setLoading(false));
  };

  useEffect(() => refresh(), []);

  const changePassword = async (): Promise<void> => {
    setError(null);
    setMessage(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed. Other sessions were revoked.');
      refresh();
    } catch (changeError: unknown) {
      setError(getApiErrorMessage(changeError));
    }
  };

  const revokeOthers = async (): Promise<void> => {
    try {
      await authApi.revokeOtherSessions();
      refresh();
    } catch (revokeError: unknown) {
      setError(getApiErrorMessage(revokeError));
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Security</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Change password</Typography>
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              helperText="Use at least 12 characters."
            />
            <Button variant="contained" onClick={changePassword} disabled={!currentPassword || newPassword.length < 12}>
              Change password
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Active sessions</Typography>
              <Button onClick={revokeOthers} disabled={sessions.filter((session) => !session.current && !session.revoked).length === 0}>
                Revoke other sessions
              </Button>
            </Stack>
            {loading && <CircularProgress size={24} />}
            {!loading && sessions.length === 0 && <Typography color="text.secondary">No sessions found.</Typography>}
            {sessions.map((session) => (
              <Stack key={session.id} spacing={0.5}>
                <Typography>{session.current ? 'Current browser session' : session.userAgent || 'Unknown device'}</Typography>
                <Typography color="text.secondary" variant="body2">
                  Expires {new Date(session.expiresAt).toLocaleString()} {session.revoked ? '· revoked' : ''}
                </Typography>
                {!session.current && !session.revoked && (
                  <Button size="small" onClick={() => authApi.revokeSession(session.id).then(refresh).catch((revokeError: unknown) => setError(getApiErrorMessage(revokeError)))}>
                    Revoke
                  </Button>
                )}
                <Divider />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default SecurityPage;
