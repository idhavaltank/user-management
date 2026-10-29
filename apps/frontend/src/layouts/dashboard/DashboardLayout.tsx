import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import Iconify from '../../components/iconify/Iconify';
import { logoutUser } from '../../redux/actions/authAction';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useConnectivity } from '../../offline/connectivity';
import { getActiveOrganizationId } from '../../offline/organization';
import { useOfflineStorage } from '../../offline/OfflineStorageProvider';
import { useSync } from '../../offline/syncProvider';
import GlobalSearchDialog from '../../components/search/GlobalSearchDialog';
import SyncDiagnosticsDialog from '../../components/sync/SyncDiagnosticsDialog';

const DRAWER_WIDTH = 240;

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

const workspaceItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'eva:grid-fill' },
  { label: 'Accounts', path: '/accounts', icon: 'eva:briefcase-fill' },
  { label: 'Contacts', path: '/contacts', icon: 'eva:people-fill' },
  { label: 'Deals', path: '/deals', icon: 'eva:trending-up-fill' },
  { label: 'Pipeline', path: '/deals/pipeline', icon: 'eva:shuffle-2-fill' },
  { label: 'Activities', path: '/activities', icon: 'eva:calendar-fill' },
  { label: 'Conflicts', path: '/conflicts', icon: 'eva:alert-triangle-fill' },
  { label: 'Users', path: '/user', icon: 'eva:people-fill' },
  { label: 'Security', path: '/security', icon: 'eva:shield-fill' },
  { label: 'Notifications', path: '/notifications', icon: 'eva:bell-fill' },
];

const administrationItems: NavigationItem[] = [
  { label: 'Administration', path: '/admin', icon: 'eva:settings-2-fill' },
];

interface NavigationSectionProps {
  items: NavigationItem[];
  label: string;
  onNavigate: (path: string) => void;
  currentPath: string;
}

const NavigationSection = ({ items, label, onNavigate, currentPath }: NavigationSectionProps): JSX.Element => (
  <Box sx={{ px: 1.5, pt: 2 }}>
    <Typography
      variant="overline"
      sx={{ display: 'block', px: 1.5, color: 'rgba(245, 245, 220, 0.55)', letterSpacing: '0.12em' }}
    >
      {label}
    </Typography>
    <List disablePadding>
      {items.map((item) => {
        const selected = currentPath === item.path;
        return (
          <ListItemButton
            key={item.path}
            selected={selected}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onNavigate(item.path)}
            sx={{
              minHeight: 42,
              mb: 0.5,
              borderRadius: '0 8px 8px 0',
              color: selected ? 'common.white' : 'rgba(245, 245, 220, 0.78)',
              borderLeft: selected ? '3px solid #D47E30' : '3px solid transparent',
              '&.Mui-selected': {
                bgcolor: 'rgba(245, 245, 220, 0.15)',
                color: 'common.white',
              },
              '&.Mui-selected:hover': { bgcolor: 'rgba(245, 245, 220, 0.2)' },
              '&:hover': { bgcolor: 'rgba(245, 245, 220, 0.1)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
              <Iconify icon={item.icon} width={19} height={19} />
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }} />
          </ListItemButton>
        );
      })}
    </List>
  </Box>
);

const DashboardLayout = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const currentUser = useAppSelector((state) => state.auth.user);
  const outlet = useOutlet();
  const { online } = useConnectivity();
  const { adapter } = useOfflineStorage();
  const { snapshot: syncSnapshot, syncNow } = useSync();

  const handleNavigate = (path: string): void => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleLogout = (): void => {
    const organizationId = getActiveOrganizationId();
    const wipe = organizationId && adapter ? adapter.clearOrganization(organizationId) : Promise.resolve();
    wipe.finally(() => logoutUser(dispatch).finally(() => navigate('/login')));
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'secondary.main', color: 'common.white' }}>
      <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: 'primary.main', display: 'grid', placeItems: 'center' }}>
          <Iconify icon="eva:flash-fill" width={20} height={20} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: 'common.white', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            FlowSync
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(245, 245, 220, 0.68)', letterSpacing: '0.12em' }}>
            LOCAL CRM
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(245, 245, 220, 0.16)' }} />
      <NavigationSection
        items={workspaceItems}
        label="Workspace"
        currentPath={location.pathname}
        onNavigate={handleNavigate}
      />
      <NavigationSection
        items={administrationItems}
        label="Manage"
        currentPath={location.pathname}
        onNavigate={handleNavigate}
      />
      <Box sx={{ mt: 'auto', p: 1.5 }}>
        <Divider sx={{ mb: 1.5, borderColor: 'rgba(245, 245, 220, 0.16)' }} />
        <ListItemButton onClick={handleLogout} sx={{ color: 'rgba(245, 245, 220, 0.82)', borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
            <Iconify icon="eva:log-out-fill" width={19} height={19} />
          </ListItemIcon>
          <ListItemText primary="Sign out" />
        </ListItemButton>
        <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: 'rgba(245, 245, 220, 0.1)' }}>
          <Typography variant="body2" sx={{ color: 'common.white', fontWeight: 600 }} noWrap>
            Local workspace
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(245, 245, 220, 0.62)' }} noWrap>
            {online ? 'Online workspace' : 'Offline mode'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(245, 245, 220, 0.94)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {isMobile && (
            <IconButton aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Iconify icon="eva:menu-2-fill" />
            </IconButton>
          )}
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setSearchOpen(true)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSearchOpen(true); }}
            sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            aria-label="Search FlowSync"
          >
            <Iconify icon="eva:search-fill" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Search FlowSync
            </Typography>
            <Chip label="Ctrl K" size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: 'background.paper' }} />
          </Box>
          <Chip
            icon={<Iconify icon={online ? 'eva:checkmark-circle-2-fill' : 'eva:cloud-offline-fill'} width={16} height={16} />}
            label={online ? 'Online' : 'Offline'}
            size="small"
            color={online ? 'success' : 'warning'}
            variant="outlined"
          />
          <Chip
            clickable
            onClick={() => { syncNow().catch(() => undefined); }}
            label={syncSnapshot.pendingCount > 0 ? `${syncSnapshot.pendingCount} pending` : syncSnapshot.status === 'syncing' ? 'Syncing…' : syncSnapshot.status === 'error' ? 'Sync error' : 'Synced'}
            size="small"
            color={syncSnapshot.status === 'error' ? 'error' : syncSnapshot.pendingCount > 0 ? 'warning' : 'default'}
            variant="outlined"
            title="Click to sync now"
          />
          <IconButton aria-label="Open sync diagnostics" onClick={() => setDiagnosticsOpen(true)}>
            <Iconify icon="eva:info-outline" />
          </IconButton>
          <IconButton aria-label="Notifications">
            <Iconify icon="eva:bell-fill" />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {currentUser?.name?.[0] || 'F'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {currentUser?.name || 'FlowSync user'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Workspace member
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" aria-label="FlowSync navigation">
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 0,
              bgcolor: 'secondary.main',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ ml: { md: `${DRAWER_WIDTH}px` }, pt: 10, px: { xs: 2, md: 4 }, pb: 4 }}>
        {outlet}
      </Box>
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SyncDiagnosticsDialog open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
    </Box>
  );
};

export default DashboardLayout;
