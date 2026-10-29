import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { CrmDashboardResponse } from '../api/clientTypes';
import { crmApi } from '../api/crmApi';
import { getApiErrorMessage } from '../api/httpClient';
import { organizationApi } from '../api/organizationApi';
import Iconify from '../components/iconify/Iconify';

const stageLabels: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const currency = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const DashboardPage = (): JSX.Element => {
  const [dashboard, setDashboard] = useState<CrmDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    organizationApi
      .listOrganizations()
      .then((response) => {
        const organization = response.items[0];
        if (!organization) throw new Error('No active organization is available.');
        return crmApi.getDashboard(organization.id);
      })
      .then(setDashboard)
      .catch((loadError: unknown) => setError(getApiErrorMessage(loadError)));
  }, []);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Good morning, welcome back.</Typography>
          <Typography color="text.secondary">Here is the pulse of your FlowSync workspace.</Typography>
        </Box>
        <Chip icon={<Iconify icon="eva:checkmark-circle-2-fill" />} label="Workspace synced" color="success" variant="outlined" />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {!dashboard && !error && <Stack alignItems="center" py={10}><CircularProgress size={28} /></Stack>}

      {dashboard && (
        <>
          <Grid container spacing={2}>
            {[
              { label: 'Accounts', value: dashboard.totalAccounts, detail: `${dashboard.activeAccounts} active`, icon: 'eva:briefcase-fill', color: 'primary.main' },
              { label: 'Contacts', value: dashboard.totalContacts, detail: 'relationships', icon: 'eva:people-fill', color: 'secondary.main' },
              { label: 'Open deals', value: dashboard.openDeals, detail: currency(dashboard.pipelineValue), icon: 'eva:trending-up-fill', color: 'warning.main' },
              { label: 'Upcoming activities', value: dashboard.upcomingActivities, detail: 'planned follow-ups', icon: 'eva:calendar-fill', color: 'info.main' },
            ].map((metric) => (
              <Grid item xs={12} sm={6} lg={3} key={metric.label}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography color="text.secondary" variant="body2">{metric.label}</Typography>
                        <Typography variant="h3" sx={{ mt: 1 }}>{metric.value}</Typography>
                        <Typography color="text.secondary" variant="caption">{metric.detail}</Typography>
                      </Box>
                      <Box sx={{ bgcolor: metric.color, color: 'common.white', borderRadius: 2, p: 1 }}>
                        <Iconify icon={metric.icon} width={22} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box>
                      <Typography variant="h6">Pipeline health</Typography>
                      <Typography variant="body2" color="text.secondary">Where your opportunities stand today.</Typography>
                    </Box>
                    <Typography variant="h5">{currency(dashboard.pipelineValue)}</Typography>
                  </Stack>
                  <Stack spacing={2.25}>
                    {dashboard.pipeline.map((stage) => {
                      const percentage = dashboard.totalDeals ? (stage.count / dashboard.totalDeals) * 100 : 0;
                      return (
                        <Box key={stage.stage}>
                          <Stack direction="row" justifyContent="space-between" mb={0.75}>
                            <Typography variant="body2">{stageLabels[stage.stage] || stage.stage}</Typography>
                            <Typography variant="body2" color="text.secondary">{stage.count} · {currency(stage.value)}</Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={percentage} sx={{ height: 8, borderRadius: 4 }} />
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6">Won revenue</Typography>
                  <Typography color="text.secondary" variant="body2">Closed-won value captured.</Typography>
                  <Typography variant="h2" sx={{ mt: 4, color: 'primary.main' }}>{currency(dashboard.wonValue)}</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>{dashboard.totalDeals} total deals in the workspace</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
};

export default DashboardPage;
