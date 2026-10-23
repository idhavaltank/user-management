import { Alert, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getApiErrorMessage, organizationApi } from '../api/client';
import type { NotificationPreferences } from '../api/clientTypes';

const NotificationPreferencesPage = (): JSX.Element => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    organizationApi
      .listOrganizations()
      .then((response) => {
        const organization = response.items[0];
        if (!organization) throw new Error('No active organization is available.');
        setOrganizationId(organization.id);
        return organizationApi.getNotificationPreferences(organization.id);
      })
      .then(setPreferences)
      .catch((loadError: unknown) => setError(getApiErrorMessage(loadError)));
  }, []);

  const save = async (): Promise<void> => {
    if (!organizationId || !preferences) return;
    setError(null);
    setSaved(false);
    try {
      setPreferences(await organizationApi.updateNotificationPreferences(organizationId, preferences));
      setSaved(true);
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError));
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Notification preferences</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Preferences saved.</Alert>}
      {!preferences && !error && <CircularProgress size={28} />}
      {preferences && (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              {([
                ['emailSecurity', 'Security email'],
                ['emailProduct', 'Product email'],
                ['inAppSecurity', 'In-app security'],
                ['inAppProduct', 'In-app product'],
              ] as const).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={<Checkbox checked={preferences[key]} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} />}
                  label={label}
                />
              ))}
              <Button variant="contained" onClick={save}>Save preferences</Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default NotificationPreferencesPage;
