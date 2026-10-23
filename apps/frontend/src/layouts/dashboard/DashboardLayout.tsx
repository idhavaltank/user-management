import { styled } from '@mui/material/styles';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { logoutUser } from '../../redux/actions/authAction';
import { useAppDispatch } from '../../redux/hooks';

const Main = styled('div')(() => ({
  flexGrow: 1,
  overflow: 'auto',
  minHeight: '100%',
  paddingTop: 24,
}));

// Used Dashboard Layout as container.
const DashboardLayout = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ mr: 2, flexGrow: 1 }}>User Management</Typography>
          <Button component={Link} to="/dashboard">Dashboard</Button>
          <Button component={Link} to="/user">Users</Button>
          <Button component={Link} to="/security">Security</Button>
          <Button component={Link} to="/notifications">Notifications</Button>
          <Button component={Link} to="/admin">Administration</Button>
          <Button onClick={() => logoutUser(dispatch).finally(() => navigate('/login'))}>Sign out</Button>
        </Toolbar>
      </AppBar>
      <Main><Outlet /></Main>
    </Box>
  );
};
export default DashboardLayout;
