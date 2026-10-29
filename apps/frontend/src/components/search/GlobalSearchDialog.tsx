import { Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmApi } from '../../api/crmApi';
import type { CrmAccount, CrmContact, CrmDeal } from '../../api/clientTypes';
import { useConnectivity } from '../../offline/connectivity';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import { createLocalCrmRepository } from '../../offline/crmRepository';
import { getActiveOrganizationId } from '../../offline/organization';
import { organizationApi } from '../../api/organizationApi';

interface SearchResult { id: string; entity: 'accounts' | 'contacts' | 'deals'; title: string; detail: string; }

interface GlobalSearchDialogProps { open: boolean; onClose: () => void; }

const GlobalSearchDialog = ({ open, onClose }: GlobalSearchDialogProps): JSX.Element => {
  const navigate = useNavigate();
  const { online } = useConnectivity();
  const { adapter, ready } = useOfflineStorage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    let active = true;
    if (!open) { setQuery(''); setResults([]); return () => { active = false; }; }
    const term = query.trim();
    if (!term || !ready || !adapter) { setResults([]); return () => { active = false; }; }
    const load = async (): Promise<void> => {
      const scope = getActiveOrganizationId() || (online ? (await organizationApi.listOrganizations()).items[0]?.id : undefined);
      if (!scope) return;
      if (online) {
        const [accounts, contacts, deals] = await Promise.all([
          crmApi.listAccounts(scope, { search: term, pageSize: 8 }),
          crmApi.listContacts(scope, { search: term, pageSize: 8 }),
          crmApi.listDeals(scope, { search: term, pageSize: 8 }),
        ]);
        if (!active) return;
        setResults([
          ...accounts.items.map((row: CrmAccount) => ({ id: row.id, entity: 'accounts' as const, title: row.name, detail: `Account · ${row.status}` })),
          ...contacts.items.map((row: CrmContact) => ({ id: row.id, entity: 'contacts' as const, title: `${row.firstName} ${row.lastName}`, detail: `Contact · ${row.email || 'no email'}` })),
          ...deals.items.map((row: CrmDeal) => ({ id: row.id, entity: 'deals' as const, title: row.name, detail: `Deal · ${row.stage}` })),
        ]);
      } else {
        const [accounts, contacts, deals] = await Promise.all([
          createLocalCrmRepository<CrmAccount>(adapter, 'accounts').list(scope, term),
          createLocalCrmRepository<CrmContact>(adapter, 'contacts').list(scope, term),
          createLocalCrmRepository<CrmDeal>(adapter, 'deals').list(scope, term),
        ]);
        if (!active) return;
        setResults([
          ...accounts.slice(0, 8).map((row) => ({ id: row.id, entity: 'accounts' as const, title: row.name, detail: `Account · ${row.status}` })),
          ...contacts.slice(0, 8).map((row) => ({ id: row.id, entity: 'contacts' as const, title: `${row.firstName} ${row.lastName}`, detail: `Contact · ${row.email || 'no email'}` })),
          ...deals.slice(0, 8).map((row) => ({ id: row.id, entity: 'deals' as const, title: row.name, detail: `Deal · ${row.stage}` })),
        ]);
      }
    };
    load().catch(() => { if (active) setResults([]); });
    return () => { active = false; };
  }, [adapter, online, open, query, ready]);

  const select = (result: SearchResult): void => { onClose(); navigate(`/${result.entity}/${result.id}`); };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="global-search-title">
      <DialogTitle id="global-search-title">Search FlowSync</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth label="Search accounts, contacts, and deals" value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && results.length === 0 ? <Typography color="text.secondary" sx={{ py: 3 }}>No matching records.</Typography> : (
          <List aria-label="Global search results">{results.map((result) => <ListItemButton key={`${result.entity}-${result.id}`} onClick={() => select(result)}><ListItemText primary={result.title} secondary={result.detail} /></ListItemButton>)}</List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchDialog;
