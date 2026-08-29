import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { useRoute } from './lib/router';
import Home from './pages/Home';
import Incident from './pages/Incident';
import Demo from './pages/Demo';

function App() {
  const { path, params } = useRoute();

  if (path === '/incident') return <Incident params={params} />;
  if (path === '/demo') return <Demo />;
  return <Home />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
