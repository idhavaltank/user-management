import type { CrmAccount, CrmAccountCreateRequest, CrmAccountUpdateRequest } from '../../api/clientTypes';
import { crmApi } from '../../api/crmApi';
import { createOfflineId } from '../../offline/ids';
import CrmEntityPage from './CrmEntityPage';

const statusOptions = [
  { label: 'Prospect', value: 'prospect' },
  { label: 'Customer', value: 'customer' },
  { label: 'Inactive', value: 'inactive' },
];

const optional = (value: string): string | undefined => value.trim() || undefined;
const nullable = (value: string): string | null => value.trim() || null;
const localAccount = (organizationId: string, form: Record<string, string>): CrmAccount => {
  const now = new Date().toISOString();
  return {
    id: createOfflineId(),
    organizationId,
    name: form.name.trim(),
    industry: nullable(form.industry),
    website: nullable(form.website),
    phone: nullable(form.phone),
    address: nullable(form.address),
    status: form.status as CrmAccount['status'],
    notes: nullable(form.notes),
    createdAt: now,
    updatedAt: now,
  };
};

const updateLocalAccount = (row: CrmAccount, form: Record<string, string>): CrmAccount => ({
  ...localAccount(row.organizationId, form),
  id: row.id,
  createdAt: row.createdAt,
});

const AccountsPage = (): JSX.Element => (
  <CrmEntityPage<CrmAccount>
    title="Accounts"
    description="Companies, customers, and prospects in your workspace."
    addLabel="Add account"
    emptyLabel="No accounts yet"
    entity="accounts"
    fields={[
      { key: 'name', label: 'Account name', required: true },
      { key: 'industry', label: 'Industry' },
      { key: 'website', label: 'Website' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'status', label: 'Status', type: 'select', options: statusOptions },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]}
    initialForm={{ name: '', industry: '', website: '', phone: '', address: '', status: 'prospect', notes: '' }}
    columns={[
      { key: 'name', label: 'Account', render: (row) => row.name },
      { key: 'industry', label: 'Industry', render: (row) => row.industry || '—' },
      { key: 'status', label: 'Status', render: (row) => row.status },
      { key: 'website', label: 'Website', render: (row) => row.website || '—' },
      { key: 'updatedAt', label: 'Updated', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
    ]}
    load={(organizationId, search) => crmApi.listAccounts(organizationId, { search }).then((result) => result)}
    create={(organizationId, form) => {
      const payload: CrmAccountCreateRequest = {
        name: form.name.trim(),
        industry: optional(form.industry),
        website: optional(form.website),
        phone: optional(form.phone),
        address: optional(form.address),
        status: form.status as CrmAccountCreateRequest['status'],
        notes: optional(form.notes),
      };
      return crmApi.createAccount(organizationId, payload);
    }}
    update={(organizationId, id, form) => {
      const payload: CrmAccountUpdateRequest = {
        name: form.name.trim(),
        industry: nullable(form.industry),
        website: nullable(form.website),
        phone: nullable(form.phone),
        address: nullable(form.address),
        status: form.status as CrmAccountUpdateRequest['status'],
        notes: nullable(form.notes),
      };
      return crmApi.updateAccount(organizationId, id, payload);
    }}
    remove={(organizationId, id) => crmApi.deleteAccount(organizationId, id)}
    createLocal={localAccount}
    updateLocal={updateLocalAccount}
    toForm={(row) => ({
      name: row.name,
      industry: row.industry || '',
      website: row.website || '',
      phone: row.phone || '',
      address: row.address || '',
      status: row.status,
      notes: row.notes || '',
    })}
  />
);

export default AccountsPage;
