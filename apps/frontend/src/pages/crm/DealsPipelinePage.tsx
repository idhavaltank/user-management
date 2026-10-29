import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { crmApi } from '../../api/crmApi';
import type { CrmDeal, FlowDealStage } from '../../api/clientTypes';
import { DealStageColumn } from '../../components/crm/DealStageColumn';
import { useConnectivity } from '../../offline/connectivity';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import { createLocalCrmRepository } from '../../offline/crmRepository';
import { getActiveOrganizationId, setActiveOrganizationId } from '../../offline/organization';
import { createOfflineId } from '../../offline/ids';
import { organizationApi } from '../../api/organizationApi';

const stages: FlowDealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const DealsPipelinePage = (): JSX.Element => {
  const { online } = useConnectivity();
  const { adapter, ready } = useOfflineStorage();
  const [organizationId, setOrganizationId] = useState(getActiveOrganizationId());
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [dragged, setDragged] = useState<CrmDeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const repository = useMemo(() => adapter ? createLocalCrmRepository<CrmDeal>(adapter, 'deals') : null, [adapter]);

  const load = useCallback(async (): Promise<void> => {
    if (!ready || !adapter) return;
    let scope = organizationId;
    if (!scope && online) {
      const result = await organizationApi.listOrganizations();
      scope = result.items[0]?.id || null;
      if (scope) { setOrganizationId(scope); setActiveOrganizationId(scope); }
    }
    if (!scope) { setError('Connect once to select an organization before using the pipeline.'); setLoading(false); return; }
    setLoading(true);
    try {
      if (online) {
        const result = await crmApi.listDeals(scope, { pageSize: 100 });
        await Promise.all(result.items.map((deal) => repository?.cacheFromServer(deal)));
        setDeals(result.items);
      } else {
        setDeals(await repository!.list(scope));
      }
    } catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : 'Unable to load pipeline.'); }
    finally { setLoading(false); }
  }, [adapter, online, organizationId, ready, repository]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const moveDeal = async (stage: FlowDealStage): Promise<void> => {
    if (!dragged || !organizationId || dragged.stage === stage || !repository) return;
    const previous = dragged;
    const optimistic = { ...dragged, stage, updatedAt: new Date().toISOString() };
    setDeals((current) => current.map((deal) => deal.id === dragged.id ? optimistic : deal));
    setDragged(null);
    try {
      if (online) {
        const saved = await crmApi.updateDeal(organizationId, dragged.id, { stage });
        await repository.cacheFromServer(saved);
        setDeals((current) => current.map((deal) => deal.id === saved.id ? saved : deal));
      } else {
        await repository.write(optimistic, { stage }, createOfflineId());
      }
    } catch (moveError: unknown) {
      setDeals((current) => current.map((deal) => deal.id === previous.id ? previous : deal));
      setError(moveError instanceof Error ? moveError.message : 'Unable to move deal.');
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
        <Stack><Typography variant="h4">Deals pipeline</Typography><Typography color="text.secondary">Move opportunities through the sales stages.</Typography></Stack>
        <Button variant="outlined" onClick={() => { load().catch(() => undefined); }}>Refresh</Button>
      </Stack>
      {!online && <Alert severity="warning">Offline mode: stage moves are queued locally.</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <CircularProgress /> : <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', alignItems: 'stretch', pb: 2 }}>
        {stages.map((stage) => <DealStageColumn key={stage} stage={stage} deals={deals.filter((deal) => deal.stage === stage)} onDragStart={setDragged} onDrop={(next) => { moveDeal(next).catch(() => undefined); }} />)}
      </Stack>}
    </Stack>
  );
};

export default DealsPipelinePage;
