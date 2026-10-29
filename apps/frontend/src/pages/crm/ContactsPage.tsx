import type { CrmContact, CrmContactCreateRequest, CrmContactUpdateRequest } from '../../api/clientTypes';
import { crmApi } from '../../api/crmApi';
import { createOfflineId } from '../../offline/ids';
import CrmEntityPage from './CrmEntityPage';

const statusOptions = [
  { label: 'Lead', value: 'lead' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const optional = (value: string): string | undefined => value.trim() || undefined;
const nullable = (value: string): string | null => value.trim() || null;
const localContact = (organizationId: string, form: Record<string, string>): CrmContact => {
  const now = new Date().toISOString();
  return {
    id: createOfflineId(),
    organizationId,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: nullable(form.email),
    phone: nullable(form.phone),
    jobTitle: nullable(form.jobTitle),
    status: form.status as CrmContact['status'],
    notes: nullable(form.notes),
    createdAt: now,
    updatedAt: now,
  };
};

const updateLocalContact = (row: CrmContact, form: Record<string, string>): CrmContact => ({
  ...localContact(row.organizationId, form),
  id: row.id,
  accountId: row.accountId,
  ownerId: row.ownerId,
  createdAt: row.createdAt,
});

const ContactsPage = (): JSX.Element => (
  <CrmEntityPage<CrmContact>
    title="Contacts"
    description="People and relationship owners connected to your accounts."
    addLabel="Add contact"
    emptyLabel="No contacts yet"
    entity="contacts"
    fields={[
      { key: 'firstName', label: 'First name', required: true },
      { key: 'lastName', label: 'Last name', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone' },
      { key: 'jobTitle', label: 'Job title' },
      { key: 'status', label: 'Status', type: 'select', options: statusOptions },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ]}
    initialForm={{ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', status: 'lead', notes: '' }}
    columns={[
      { key: 'name', label: 'Contact', render: (row) => `${row.firstName} ${row.lastName}` },
      { key: 'email', label: 'Email', render: (row) => row.email || '—' },
      { key: 'jobTitle', label: 'Role', render: (row) => row.jobTitle || '—' },
      { key: 'status', label: 'Status', render: (row) => row.status },
      { key: 'updatedAt', label: 'Updated', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
    ]}
    load={(organizationId, search) => crmApi.listContacts(organizationId, { search }).then((result) => result)}
    create={(organizationId, form) => {
      const payload: CrmContactCreateRequest = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: optional(form.email),
        phone: optional(form.phone),
        jobTitle: optional(form.jobTitle),
        status: form.status as CrmContactCreateRequest['status'],
        notes: optional(form.notes),
      };
      return crmApi.createContact(organizationId, payload);
    }}
    update={(organizationId, id, form) => {
      const payload: CrmContactUpdateRequest = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: nullable(form.email),
        phone: nullable(form.phone),
        jobTitle: nullable(form.jobTitle),
        status: form.status as CrmContactUpdateRequest['status'],
        notes: nullable(form.notes),
      };
      return crmApi.updateContact(organizationId, id, payload);
    }}
    remove={(organizationId, id) => crmApi.deleteContact(organizationId, id)}
    createLocal={localContact}
    updateLocal={updateLocalContact}
    toForm={(row) => ({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email || '',
      phone: row.phone || '',
      jobTitle: row.jobTitle || '',
      status: row.status,
      notes: row.notes || '',
    })}
  />
);

export default ContactsPage;
