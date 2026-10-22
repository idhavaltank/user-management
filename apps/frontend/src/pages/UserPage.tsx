import {
  Alert,
  Button,
  Card,
  CircularProgress,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { useSnackbar } from 'notistack';
import Iconify from '../components/iconify/Iconify';
import Scrollbar from '../components/scrollbar';
import AddEditUserModal from '../modals/AddEditUserModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import { getApiErrorMessage, type ListUsersQuery, type User } from '../api/client';
import { deleteUser, fetchUsers } from '../redux/actions/userAction';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import UserListHead from '../sections/user/UserListHead';
import UserListToolbar from '../sections/user/UserListToolbar';
import TABLE_HEAD from '../utils/TABLE_HEAD';
import {
  downloadLegacyBackup,
  migrateLegacyUsers,
  pendingLegacyUsers,
  type LegacyUser,
} from '../utils/localStorageMigration';

type SortField = NonNullable<ListUsersQuery['sort']>;
type SortOrder = NonNullable<ListUsersQuery['order']>;
type ModalKey = 'actionMenu' | 'addEditModal' | 'confirmationModal';
type OpenState = {
  actionMenu: HTMLElement | null;
  addEditModal: boolean;
  confirmationModal: boolean;
};
type OpenPayload = {
  key: ModalKey;
  status?: boolean;
  event?: MouseEvent<HTMLElement>;
  data?: User | null;
};

const SERVER_SORT_FIELDS: readonly SortField[] = [
  'name',
  'email',
  'birthDate',
  'createdAt',
  'updatedAt',
];

const UserPage = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { list: users, total, status, error } = useAppSelector((state) => state.user);
  const [opens, setOpens] = useState<OpenState>({
    actionMenu: null,
    addEditModal: false,
    confirmationModal: false,
  });
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<SortOrder>('desc');
  const [orderBy, setOrderBy] = useState<SortField>('createdAt');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [migrationUsers, setMigrationUsers] = useState<LegacyUser[]>(() => pendingLegacyUsers());
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(dispatch, {
      page: page + 1,
      pageSize: rowsPerPage,
      search: filterName,
      sort: SERVER_SORT_FIELDS.includes(orderBy) ? orderBy : 'createdAt',
      order,
    }, controller.signal).catch(() => undefined);

    return () => controller.abort();
  }, [dispatch, filterName, order, orderBy, page, rowsPerPage]);

  const refreshUsers = (): void => {
    fetchUsers(dispatch, {
      page: page + 1,
      pageSize: rowsPerPage,
      search: filterName,
      sort: SERVER_SORT_FIELDS.includes(orderBy) ? orderBy : 'createdAt',
      order,
    }).catch(() => undefined);
  };

  const handleOpen = ({ key, status: nextStatus, event, data }: OpenPayload): void => {
    setOpens((current) => ({
      ...current,
      [key]: key === 'actionMenu' ? event?.currentTarget || null : Boolean(nextStatus),
    } as OpenState));
    if (data !== undefined) setSelectedUser(data);
  };

  const handleClose = ({ key, status: nextStatus }: Pick<OpenPayload, 'key' | 'status'>): void => {
    setOpens((current) => ({
      ...current,
      [key]: key === 'actionMenu' ? null : Boolean(nextStatus),
    } as OpenState));
  };

  const handleRequestSort = (_event: MouseEvent<HTMLElement>, property: string): void => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(SERVER_SORT_FIELDS.includes(property as SortField) ? property as SortField : 'createdAt');
  };

  const handleFilterByName = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setPage(0);
    setFilterName(event.target.value);
  };

  const handleRowsPerPage = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const removedUser = async () => {
    handleClose({ key: 'actionMenu' });
    handleClose({ key: 'confirmationModal' });
    if (!selectedUser?.id) return;
    try {
      await deleteUser(dispatch, selectedUser.id);
      enqueueSnackbar('User deleted successfully');
      setSelectedUser(null);
      refreshUsers();
    } catch (deleteError: unknown) {
      enqueueSnackbar(getApiErrorMessage(deleteError), { variant: 'error' });
    }
  };

  const runMigration = async () => {
    setMigrationRunning(true);
    setMigrationMessage('');
    try {
      const result = await migrateLegacyUsers(dispatch);
      setMigrationUsers(pendingLegacyUsers());
      setMigrationMessage(
        `Imported ${result.imported}, skipped ${result.duplicates} duplicate(s), failed ${result.failed}.`
      );
      refreshUsers();
    } catch (migrationError: unknown) {
      setMigrationMessage(getApiErrorMessage(migrationError));
    } finally {
      setMigrationRunning(false);
    }
  };

  const isLoading = status === 'loading';
  const isNotFound = status === 'succeeded' && !users.length && Boolean(filterName);

  return (
    <>
      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
          <Typography variant="h4">User Management</Typography>
          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:plus-fill" />}
            onClick={() => handleOpen({ key: 'addEditModal', status: true, data: null })}
          >
            New User
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {migrationUsers.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }} action={<Stack direction="row" spacing={1}><Button color="inherit" size="small" onClick={downloadLegacyBackup}>Download backup</Button><Button color="inherit" size="small" onClick={runMigration} disabled={migrationRunning}>{migrationRunning ? 'Importing…' : 'Import local users'}</Button></Stack>}>
            {migrationUsers.length} browser-local user record(s) are ready for one-time server import. A backup is kept before upload.
          </Alert>
        )}
        {migrationMessage && <Alert severity="success" sx={{ mb: 2 }}>{migrationMessage}</Alert>}
        <Card>
          <UserListToolbar filterName={filterName} onFilterName={handleFilterByName} />
          <Scrollbar>
            <TableContainer sx={{ minWidth: 400 }}>
              <Table>
                <UserListHead order={order} orderBy={orderBy} headLabel={TABLE_HEAD} onRequestSort={handleRequestSort} />
                <TableBody>
                  {users.map((row) => (
                    <TableRow hover key={row.id} tabIndex={-1}>
                      <TableCell component="th" scope="row">{row.name || '-'}</TableCell>
                      <TableCell align="left">{row.email || '-'}</TableCell>
                      <TableCell align="left">{row.gender || '-'}</TableCell>
                      <TableCell align="left">{row.birthDate ? new Date(row.birthDate).toLocaleDateString('en-IN') : '-'}</TableCell>
                      <TableCell align="left">{row.college || '-'}</TableCell>
                      <TableCell align="left">{row.address || '-'}</TableCell>
                      <TableCell align="left">{[...(row.hobbies || []), ...(row.customHobbies || [])].join(', ') || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="large" color="inherit" onClick={(event) => handleOpen({ key: 'actionMenu', event, data: row })}>
                          <Iconify icon="eva:more-vertical-fill" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {isLoading && (
                    <TableRow><TableCell align="center" colSpan={TABLE_HEAD.length}><CircularProgress size={24} /></TableCell></TableRow>
                  )}
                  {isNotFound && (
                    <TableRow><TableCell align="center" colSpan={TABLE_HEAD.length} sx={{ py: 5 }}><Paper sx={{ textAlign: 'center', boxShadow: 'none' }}><Typography variant="h4">Not found</Typography></Paper></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={handleRowsPerPage}
          />
        </Card>
      </Container>

      <Popover
        open={Boolean(opens.actionMenu)}
        anchorEl={opens.actionMenu}
        onClose={() => handleClose({ key: 'actionMenu' })}
      transitionDuration={0}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { p: 1, width: 140, '& .MuiMenuItem-root': { px: 1, typography: 'body2', borderRadius: 0.75 } } }}
      >
        <MenuItem onClick={() => { handleClose({ key: 'actionMenu' }); handleOpen({ key: 'addEditModal', status: true }); }}>
          <Iconify icon="eva:edit-fill" sx={{ mr: 2 }} /> Edit
        </MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { handleClose({ key: 'actionMenu' }); handleOpen({ key: 'confirmationModal', status: true }); }}>
          <Iconify icon="eva:trash-2-outline" sx={{ mr: 2 }} /> Delete
        </MenuItem>
      </Popover>
      <AddEditUserModal
        currentUser={selectedUser}
        open={opens.addEditModal}
        handleClose={handleClose}
        onSaved={refreshUsers}
      />
      <ConfirmationModal open={opens.confirmationModal} handleClose={handleClose} handleConfirm={removedUser} />
    </>
  );
};

export default UserPage;
