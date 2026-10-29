import type { CrmDeal, CrmDealCreateRequest, CrmDealUpdateRequest } from '../../api/clientTypes';
import { crmApi } from '../../api/crmApi';
import { createOfflineId } from '../../offline/ids';
import CrmEntityPage from './CrmEntityPage';

const stageOptions = [
  { label: 'Lead', value: 'lead' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
];

const nullable = (value: string): string | null => value.trim() || null;
const localDeal = (organizationId: string, form: Record<string, string>): CrmDeal => {
  const now = new Date().toISOString();
  return {
    id: createOfflineId(),
    organizationId,
    name: form.name.trim(),
    amount: Number(form.amount || 0),
    currency: (form.currency || 'USD').trim().toUpperCase(),
    stage: form.stage as CrmDeal['stage'],
    expectedCloseDate: nullable(form.expectedCloseDate),
    notes: nullable(form.notes),
    createdAt: now,
    updatedAt: now,
  };
};

const updateLocalDeal = (row: CrmDeal, form: Record<string, string>): CrmDeal => ({
  ...localDeal(row.organizationId, form),
  id: row.id,
  accountId: row.accountId,
  contactId: row.contactId,
  ownerId: row.ownerId,
  createdAt: row.createdAt,
});

const DealsPage = (): JSX.Element => (
  <CrmEntityPage<CrmDeal>
    title="Deals"
    description="Track opportunities from first conversation to close."
    addLabel="Add deal"
    emptyLabel="No deals yet"
    entity="deals"
    fields={[
      { key: 'name', label: 'Deal name', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'currency', label: 'Currency', required: true },
      { key: 'stage', label: 'Stage', type: 'select', options: stageOptions },
      { key: 'expectedCloseDate', label: 'Expected close', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]}
    initialForm={{ name: '', amount: '0', currency: 'USD', stage: 'lead', expectedCloseDate: '', notes: '' }}
    columns={[
      { key: 'name', label: 'Deal', render: (row) => row.name },
      { key: 'stage', label: 'Stage', render: (row) => row.stage },
      { key: 'amount', label: 'Value', render: (row) => `${row.currency} ${row.amount.toLocaleString()}` },
      { key: 'expectedCloseDate', label: 'Close date', render: (row) => row.expectedCloseDate || '—' },
      { key: 'updatedAt', label: 'Updated', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
    ]}
    load={(organizationId, search) => crmApi.listDeals(organizationId, { search }).then((result) => result)}
    create={(organizationId, form) => {
      const payload: CrmDealCreateRequest = {
        name: form.name.trim(),
        amount: Number(form.amount || 0),
        currency: (form.currency || 'USD').trim().toUpperCase(),
        stage: form.stage as CrmDealCreateRequest['stage'],
        expectedCloseDate: form.expectedCloseDate || undefined,
        notes: nullable(form.notes) || undefined,
      };
      return crmApi.createDeal(organizationId, payload);
    }}
    update={(organizationId, id, form) => {
      const payload: CrmDealUpdateRequest = {
        name: form.name.trim(),
        amount: Number(form.amount || 0),
        currency: (form.currency || 'USD').trim().toUpperCase(),
        stage: form.stage as CrmDealUpdateRequest['stage'],
        expectedCloseDate: form.expectedCloseDate || null,
        notes: nullable(form.notes),
      };
      return crmApi.updateDeal(organizationId, id, payload);
    }}
    remove={(organizationId, id) => crmApi.deleteDeal(organizationId, id)}
    createLocal={localDeal}
    updateLocal={updateLocalDeal}
    toForm={(row) => ({
      name: row.name,
      amount: String(row.amount),
      currency: row.currency,
      stage: row.stage,
      expectedCloseDate: row.expectedCloseDate || '',
      notes: row.notes || '',
    })}
  />
);

export default DealsPage;
