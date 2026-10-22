import { styled } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';

const Main = styled('div')(() => ({
  flexGrow: 1,
  overflow: 'auto',
  minHeight: '100%',
  paddingTop: 24,
}));

// Used Dashboard Layout as container.
const DashboardLayout = (): JSX.Element => (
  <Main>
    <Outlet />
  </Main>
);
export default DashboardLayout;
