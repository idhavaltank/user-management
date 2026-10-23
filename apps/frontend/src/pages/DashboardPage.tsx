import { Alert, Card, CardContent, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getApiErrorMessage, organizationApi } from '../api/client';
import type { DashboardResponse } from '../api/clientTypes';

const DashboardPage = (): JSX.Element => {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    organizationApi
      .listOrganizations()
      .then((response) => {
        const organization = response.items[0];
        if (!organization) throw new Error('No active organization is available.');
        return organizationApi.getDashboard(organization.id);
      })
      .then(setDashboard)
      .catch((loadError: unknown) => setError(getApiErrorMessage(loadError)));
  }, []);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">Organization activity at a glance.</Typography>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!dashboard && !error && <CircularProgress size={28} />}
      {dashboard && (
        <Grid container spacing={2}>
          {[
            ['Total users', dashboard.totalUsers],
            ['Active users', dashboard.activeUsers],
            ['Pending users', dashboard.pendingUsers],
            ['Suspended users', dashboard.suspendedUsers],
            ['Teams', dashboard.teams],
          ].map(([label, value]) => (
            <Grid item xs={12} sm={6} md={4} key={String(label)}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {label}
                  </Typography>
                  <Typography variant="h3">{value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
};

export default DashboardPage;
