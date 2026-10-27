
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EditEntry from './pages/EditEntry';
import Vote from './pages/Vote';
import HostResults from './pages/HostResults';

import PartyRouteGuard from './components/PartyRouteGuard';

function App() {
  return (
      <BrowserRouter>
        <Routes>
          {/* Homepage is always available */}
          <Route path="/" element={<Home />} />

          {/* Registration phase only */}
          <Route
              path="/register"
              element={
                <PartyRouteGuard allowedPhases={['registration']}>
                  <Register />
                </PartyRouteGuard>
              }
          />

          {/* Costume dashboard remains available */}
          <Route
              path="/dashboard"
              element={<Dashboard />}
          />

          {/* Editing closes when voting begins */}
          <Route
              path="/edit-entry"
              element={
                <PartyRouteGuard allowedPhases={['registration']}>
                  <EditEntry />
                </PartyRouteGuard>
              }
          />

          {/* Voting phase only */}
          <Route
              path="/vote"
              element={
                <PartyRouteGuard allowedPhases={['voting']}>
                  <Vote />
                </PartyRouteGuard>
              }
          />

          {/* Host results */}
          <Route
              path="/meeting-of-the-midnight-coven"
              element={<HostResults />}
          />

          {/* Unknown routes */}
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;
