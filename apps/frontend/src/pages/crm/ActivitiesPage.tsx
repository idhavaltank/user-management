import type { CrmActivity, CrmActivityCreateRequest, CrmActivityUpdateRequest } from '../../api/clientTypes';
import { crmApi } from '../../api/crmApi';
import { createOfflineId } from '../../offline/ids';
import CrmEntityPage from './CrmEntityPage';

const kindOptions = [
  { label: 'Call', value: 'call' },
  { label: 'Email', value: 'email' },
  { label: 'Meeting', value: 'meeting' },
  { label: 'Task', value: 'task' },
  { label: 'Note', value: 'note' },
];
const statusOptions = [
  { label: 'Planned', value: 'planned' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const nullable = (value: string): string | null => value.trim() || null;
const localActivity = (organizationId: string, form: Record<string, string>): CrmActivity => {
  const now = new Date().toISOString();
  return {
    id: createOfflineId(),
    organizationId,
    subject: form.subject.trim(),
    kind: form.kind as CrmActivity['kind'],
    status: form.status as CrmActivity['status'],
    dueAt: form.dueAt ? new Date(`${form.dueAt}T09:00:00`).toISOString() : null,
    description: nullable(form.description),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

const updateLocalActivity = (row: CrmActivity, form: Record<string, string>): CrmActivity => ({
  ...localActivity(row.organizationId, form),
  id: row.id,
  accountId: row.accountId,
  contactId: row.contactId,
  dealId: row.dealId,
  ownerId: row.ownerId,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
});

const ActivitiesPage = (): JSX.Element => (
  <CrmEntityPage<CrmActivity>
    title="Activities"
    description="Keep calls, meetings, tasks, and notes in one timeline."
    addLabel="Add activity"
    emptyLabel="No activities yet"
    entity="activities"
    fields={[
      { key: 'subject', label: 'Subject', required: true },
      { key: 'kind', label: 'Type', type: 'select', options: kindOptions, required: true },
      { key: 'status', label: 'Status', type: 'select', options: statusOptions },
      { key: 'dueAt', label: 'Due date', type: 'date' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ]}
    initialForm={{ subject: '', kind: 'task', status: 'planned', dueAt: '', description: '' }}
    columns={[
      { key: 'subject', label: 'Activity', render: (row) => row.subject },
      { key: 'kind', label: 'Type', render: (row) => row.kind },
      { key: 'status', label: 'Status', render: (row) => row.status },
      { key: 'dueAt', label: 'Due', render: (row) => row.dueAt ? new Date(row.dueAt).toLocaleDateString() : '—' },
      { key: 'updatedAt', label: 'Updated', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
    ]}
    load={(organizationId, search) => crmApi.listActivities(organizationId, { search }).then((result) => result)}
    create={(organizationId, form) => {
      const payload: CrmActivityCreateRequest = {
        subject: form.subject.trim(),
        kind: form.kind as CrmActivityCreateRequest['kind'],
        status: form.status as CrmActivityCreateRequest['status'],
        dueAt: form.dueAt ? new Date(`${form.dueAt}T09:00:00`).toISOString() : undefined,
        description: nullable(form.description) || undefined,
      };
      return crmApi.createActivity(organizationId, payload);
    }}
    update={(organizationId, id, form) => {
      const payload: CrmActivityUpdateRequest = {
        subject: form.subject.trim(),
        kind: form.kind as CrmActivityUpdateRequest['kind'],
        status: form.status as CrmActivityUpdateRequest['status'],
        dueAt: form.dueAt ? new Date(`${form.dueAt}T09:00:00`).toISOString() : null,
        description: nullable(form.description),
      };
      return crmApi.updateActivity(organizationId, id, payload);
    }}
    remove={(organizationId, id) => crmApi.deleteActivity(organizationId, id)}
    createLocal={localActivity}
    updateLocal={updateLocalActivity}
    toForm={(row) => ({
      subject: row.subject,
      kind: row.kind,
      status: row.status,
      dueAt: row.dueAt ? row.dueAt.slice(0, 10) : '',
      description: row.description || '',
    })}
  />
);

export default ActivitiesPage;
