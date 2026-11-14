import { Outlet } from 'react-router-dom';
import { StatusGate } from '../app/DataStoreContext';
import { strings } from '../strings';

export function Layout() {
  return (
    <>
      <header className="app-header">
        <h1 className="app-title">{strings.appName}</h1>
      </header>
      <main className="app-main">
        <StatusGate>
          <Outlet />
        </StatusGate>
      </main>
    </>
  );
}
