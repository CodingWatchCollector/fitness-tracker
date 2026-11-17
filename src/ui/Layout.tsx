import { Link, Outlet } from 'react-router-dom';
import { StatusGate } from '../app/DataStoreContext';
import { strings } from '../strings';

export function Layout() {
  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          <Link to="/">{strings.appName}</Link>
        </h1>
      </header>
      <main className="app-main">
        <StatusGate>
          <Outlet />
        </StatusGate>
      </main>
    </>
  );
}
