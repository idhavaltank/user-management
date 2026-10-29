import type {
  CrmAccount,
  CrmAccountCreateRequest,
  CrmAccountListResponse,
  CrmAccountUpdateRequest,
  CrmActivity,
  CrmActivityCreateRequest,
  CrmActivityListResponse,
  CrmActivityUpdateRequest,
  CrmContact,
  CrmContactCreateRequest,
  CrmContactListResponse,
  CrmContactUpdateRequest,
  CrmDashboardResponse,
  CrmDeal,
  CrmDealCreateRequest,
  CrmDealListResponse,
  CrmDealUpdateRequest,
  FlowAccountStatus,
  FlowActivityStatus,
  FlowContactStatus,
  FlowDealStage,
} from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

/** Shared server-side list controls for the four CRM collections. */
export interface CrmListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CrmApi {
  getDashboard(organizationId: string): Promise<CrmDashboardResponse>;
  listAccounts(organizationId: string, query?: CrmListQuery & { status?: FlowAccountStatus }): Promise<CrmAccountListResponse>;
  createAccount(organizationId: string, payload: CrmAccountCreateRequest): Promise<CrmAccount>;
  getAccount(organizationId: string, accountId: string): Promise<CrmAccount>;
  updateAccount(organizationId: string, accountId: string, payload: CrmAccountUpdateRequest): Promise<CrmAccount>;
  deleteAccount(organizationId: string, accountId: string): Promise<void>;
  uploadAccountProfileImage(organizationId: string, accountId: string, file: File): Promise<CrmAccount>;
  deleteAccountProfileImage(organizationId: string, accountId: string): Promise<void>;
  listContacts(organizationId: string, query?: CrmListQuery & { status?: FlowContactStatus }): Promise<CrmContactListResponse>;
  createContact(organizationId: string, payload: CrmContactCreateRequest): Promise<CrmContact>;
  getContact(organizationId: string, contactId: string): Promise<CrmContact>;
  updateContact(organizationId: string, contactId: string, payload: CrmContactUpdateRequest): Promise<CrmContact>;
  deleteContact(organizationId: string, contactId: string): Promise<void>;
  uploadContactProfileImage(organizationId: string, contactId: string, file: File): Promise<CrmContact>;
  deleteContactProfileImage(organizationId: string, contactId: string): Promise<void>;
  listDeals(organizationId: string, query?: CrmListQuery & { stage?: FlowDealStage }): Promise<CrmDealListResponse>;
  createDeal(organizationId: string, payload: CrmDealCreateRequest): Promise<CrmDeal>;
  getDeal(organizationId: string, dealId: string): Promise<CrmDeal>;
  updateDeal(organizationId: string, dealId: string, payload: CrmDealUpdateRequest): Promise<CrmDeal>;
  deleteDeal(organizationId: string, dealId: string): Promise<void>;
  listActivities(organizationId: string, query?: CrmListQuery & { status?: FlowActivityStatus }): Promise<CrmActivityListResponse>;
  createActivity(organizationId: string, payload: CrmActivityCreateRequest): Promise<CrmActivity>;
  getActivity(organizationId: string, activityId: string): Promise<CrmActivity>;
  updateActivity(organizationId: string, activityId: string, payload: CrmActivityUpdateRequest): Promise<CrmActivity>;
  deleteActivity(organizationId: string, activityId: string): Promise<void>;
}

const segment = (value: string): string => encodeURIComponent(value);

const queryString = (query: object): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

const collectionPath = (organizationId: string, resource: string): string =>
  `/api/v1/organizations/${segment(organizationId)}/${resource}`;

export const createCrmApi = (client: HttpClient): CrmApi => ({
  getDashboard: (organizationId) =>
    client.request<CrmDashboardResponse>(`${collectionPath(organizationId, 'crm')}/dashboard`),

  listAccounts: (organizationId, query = {}) =>
    client.request<CrmAccountListResponse>(
      `${collectionPath(organizationId, 'accounts')}${queryString(query)}`
    ),
  createAccount: (organizationId, payload) =>
    client.request<CrmAccount>(collectionPath(organizationId, 'accounts'), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAccount: (organizationId, accountId) =>
    client.request<CrmAccount>(`${collectionPath(organizationId, 'accounts')}/${segment(accountId)}`),
  updateAccount: (organizationId, accountId, payload) =>
    client.request<CrmAccount>(`${collectionPath(organizationId, 'accounts')}/${segment(accountId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAccount: (organizationId, accountId) =>
    client.request<void>(`${collectionPath(organizationId, 'accounts')}/${segment(accountId)}`, {
      method: 'DELETE',
    }),
  uploadAccountProfileImage: (organizationId, accountId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.request<CrmAccount>(
      `${collectionPath(organizationId, 'accounts')}/${segment(accountId)}/profile-image`,
      { method: 'POST', body: formData },
    );
  },
  deleteAccountProfileImage: (organizationId, accountId) =>
    client.request<void>(
      `${collectionPath(organizationId, 'accounts')}/${segment(accountId)}/profile-image`,
      { method: 'DELETE' },
    ),

  listContacts: (organizationId, query = {}) =>
    client.request<CrmContactListResponse>(
      `${collectionPath(organizationId, 'contacts')}${queryString(query)}`
    ),
  createContact: (organizationId, payload) =>
    client.request<CrmContact>(collectionPath(organizationId, 'contacts'), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getContact: (organizationId, contactId) =>
    client.request<CrmContact>(`${collectionPath(organizationId, 'contacts')}/${segment(contactId)}`),
  updateContact: (organizationId, contactId, payload) =>
    client.request<CrmContact>(`${collectionPath(organizationId, 'contacts')}/${segment(contactId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteContact: (organizationId, contactId) =>
    client.request<void>(`${collectionPath(organizationId, 'contacts')}/${segment(contactId)}`, {
      method: 'DELETE',
    }),
  uploadContactProfileImage: (organizationId, contactId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.request<CrmContact>(
      `${collectionPath(organizationId, 'contacts')}/${segment(contactId)}/profile-image`,
      { method: 'POST', body: formData },
    );
  },
  deleteContactProfileImage: (organizationId, contactId) =>
    client.request<void>(
      `${collectionPath(organizationId, 'contacts')}/${segment(contactId)}/profile-image`,
      { method: 'DELETE' },
    ),

  listDeals: (organizationId, query = {}) =>
    client.request<CrmDealListResponse>(`${collectionPath(organizationId, 'deals')}${queryString(query)}`),
  createDeal: (organizationId, payload) =>
    client.request<CrmDeal>(collectionPath(organizationId, 'deals'), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getDeal: (organizationId, dealId) =>
    client.request<CrmDeal>(`${collectionPath(organizationId, 'deals')}/${segment(dealId)}`),
  updateDeal: (organizationId, dealId, payload) =>
    client.request<CrmDeal>(`${collectionPath(organizationId, 'deals')}/${segment(dealId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteDeal: (organizationId, dealId) =>
    client.request<void>(`${collectionPath(organizationId, 'deals')}/${segment(dealId)}`, {
      method: 'DELETE',
    }),

  listActivities: (organizationId, query = {}) =>
    client.request<CrmActivityListResponse>(
      `${collectionPath(organizationId, 'activities')}${queryString(query)}`
    ),
  createActivity: (organizationId, payload) =>
    client.request<CrmActivity>(collectionPath(organizationId, 'activities'), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getActivity: (organizationId, activityId) =>
    client.request<CrmActivity>(`${collectionPath(organizationId, 'activities')}/${segment(activityId)}`),
  updateActivity: (organizationId, activityId, payload) =>
    client.request<CrmActivity>(`${collectionPath(organizationId, 'activities')}/${segment(activityId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteActivity: (organizationId, activityId) =>
    client.request<void>(`${collectionPath(organizationId, 'activities')}/${segment(activityId)}`, {
      method: 'DELETE',
    }),
});

export const crmApi = createCrmApi(httpClient);
