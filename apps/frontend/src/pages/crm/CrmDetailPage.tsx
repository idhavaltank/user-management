import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crmApi } from '../../api/crmApi';
import type { CrmAccount, CrmActivity, CrmContact, CrmDeal } from '../../api/clientTypes';
import ActivityTimeline from '../../components/crm/ActivityTimeline';
import { getApiErrorMessage, resolveApiAssetUrl } from '../../api/httpClient';
import { createLocalCrmRepository } from '../../offline/crmRepository';
import { getActiveOrganizationId, setActiveOrganizationId } from '../../offline/organization';
import { useConnectivity } from '../../offline/connectivity';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import { organizationApi } from '../../api/organizationApi';

type DetailRecord = CrmAccount | CrmContact | CrmDeal;
type DetailEntity = 'accounts' | 'contacts' | 'deals';

const labels: Record<string, string> = {
  name: 'Name', firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone',
  industry: 'Industry', website: 'Website', jobTitle: 'Job title', status: 'Status', stage: 'Stage',
  amount: 'Amount', currency: 'Currency', expectedCloseDate: 'Expected close', notes: 'Notes',
};

const profileInitials = (record: CrmAccount | CrmContact): string => (
  'name' in record
    ? record.name.slice(0, 2).toUpperCase()
    : ((record.firstName[0] || '') + (record.lastName[0] || '')).toUpperCase()
);

const DetailFields = ({ record }: { record: DetailRecord }): JSX.Element => {
  const ignored = new Set([
    'id',
    'organizationId',
    'createdAt',
    'updatedAt',
    'accountId',
    'contactId',
    'ownerId',
    'profileImageUrl',
  ]);
  const values = Object.entries(record).filter(([key, value]) => !ignored.has(key) && value !== null && value !== undefined && value !== '');
  return (
    <Grid container spacing={2}>
      {values.map(([key, value]) => (
        <Grid item xs={12} sm={6} key={key}>
          <Typography variant="caption" color="text.secondary">{labels[key] || key}</Typography>
          <Typography>{String(value)}</Typography>
        </Grid>
      ))}
    </Grid>
  );
};

const CrmDetailPage = ({ entity }: { entity: DetailEntity }): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { online } = useConnectivity();
  const { adapter, ready } = useOfflineStorage();
  const [organizationId, setOrganizationId] = useState<string | null>(getActiveOrganizationId());
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const repository = useMemo(() => adapter ? createLocalCrmRepository<DetailRecord>(adapter, entity) : null, [adapter, entity]);

  const load = useCallback(async (): Promise<void> => {
    if (!id || !ready || !repository) return;
    let scope = organizationId;
    if (!scope && online) {
      const organizations = await organizationApi.listOrganizations();
      scope = organizations.items[0]?.id || null;
      if (scope) {
        setActiveOrganizationId(scope);
        setOrganizationId(scope);
      }
    }
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      let next: DetailRecord | null = null;
      if (online) {
        next = entity === 'accounts'
          ? await crmApi.getAccount(scope, id)
          : entity === 'contacts' ? await crmApi.getContact(scope, id) : await crmApi.getDeal(scope, id);
        await repository.cacheFromServer(next);
      } else {
        next = await repository.get(scope, id) as DetailRecord | null;
      }
      if (!next) throw new Error('This CRM record is not available in the current local cache.');
      setRecord(next);
      const result = online
        ? await crmApi.listActivities(scope, { pageSize: 100 })
        : { items: await createLocalCrmRepository<CrmActivity>(adapter!, 'activities').list(scope) };
      setActivities(result.items.filter((activity) => activity.accountId === id || activity.contactId === id || activity.dealId === id));
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [adapter, entity, id, online, organizationId, ready, repository]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const profileRecord = entity === 'deals' ? null : record as CrmAccount | CrmContact | null;
  const profileImageUrl = resolveApiAssetUrl(profileRecord?.profileImageUrl);

  const handleProfileImageUpload = async (file: File | undefined): Promise<void> => {
    if (!file || !id || !organizationId || !online || !profileRecord) return;
    if (file.size > 5_242_880) {
      setError('Profile images must be 5 MB or smaller.');
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const saved = entity === 'accounts'
        ? await crmApi.uploadAccountProfileImage(organizationId, id, file)
        : await crmApi.uploadContactProfileImage(organizationId, id, file);
      await repository?.cacheFromServer(saved);
      setRecord(saved);
    } catch (uploadError: unknown) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleProfileImageDelete = async (): Promise<void> => {
    if (!id || !organizationId || !online || !profileRecord) return;
    setUploadingImage(true);
    setError(null);
    try {
      if (entity === 'accounts') {
        await crmApi.deleteAccountProfileImage(organizationId, id);
      } else {
        await crmApi.deleteContactProfileImage(organizationId, id);
      }
      const updated = { ...profileRecord, profileImageUrl: null };
      await repository?.cacheFromServer(updated);
      setRecord(updated);
    } catch (deleteError: unknown) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Button onClick={() => navigate(-1)} sx={{ alignSelf: 'flex-start' }}>← Back</Button>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><CircularProgress /></Box> : record && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
            <Box><Typography variant="h4">{entity.slice(0, -1)} detail</Typography><Typography color="text.secondary">{online ? 'Server record' : 'Cached local record'}</Typography></Box>
            <Button variant="outlined" onClick={() => { load().catch(() => undefined); }}>Refresh</Button>
          </Stack>
          {profileRecord && (
            <Card>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                  <Avatar src={profileImageUrl} alt="Profile image" sx={{ width: 72, height: 72 }}>
                    {profileInitials(profileRecord)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">Profile image</Typography>
                    <Typography variant="body2" color="text.secondary">
                      JPEG, PNG, or WebP up to 5 MB. Uploads are online-only and organization-scoped.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button component="label" variant="outlined" disabled={!online || uploadingImage}>
                      {uploadingImage ? 'Uploading…' : 'Upload image'}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          handleProfileImageUpload(event.target.files?.[0]).catch(() => undefined);
                          event.currentTarget.value = '';
                        }}
                      />
                    </Button>
                    {profileImageUrl && (
                      <Button color="error" onClick={() => { handleProfileImageDelete().catch(() => undefined); }} disabled={!online || uploadingImage}>
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}
          <Card><CardContent><Stack spacing={2}><Typography variant="h6">Overview</Typography><Divider /><DetailFields record={record} /></Stack></CardContent></Card>
          <Card><CardContent><Stack spacing={2}><Typography variant="h6">Activity timeline</Typography><Divider /><ActivityTimeline activities={activities} /></Stack></CardContent></Card>
        </>
      )}
    </Stack>
  );
};

export default CrmDetailPage;
