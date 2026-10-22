import { useEffect } from 'react';

import { authLoggedOut, restoreSession } from './redux/actions/authAction';
import { useAppDispatch } from './redux/hooks';
import Router from './routes';
import ThemeProvider from './theme';

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    restoreSession(dispatch);
  }, [dispatch]);

  useEffect(() => {
    const handleUnauthorized = () => dispatch(authLoggedOut());
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  return (
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  );
};

export default App;
