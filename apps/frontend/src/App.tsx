import { useEffect } from 'react';

import { authLoggedOut, restoreSession } from './redux/actions/authAction';
import { useAppDispatch } from './redux/hooks';
import Router from './routes';
import ThemeProvider from './theme';
import { OfflineStorageProvider } from './offline/OfflineStorageProvider';
import { SyncProvider } from './offline/syncProvider';

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
      <OfflineStorageProvider>
        <SyncProvider>
          <Router />
        </SyncProvider>
      </OfflineStorageProvider>
    </ThemeProvider>
  );
};

export default App;
