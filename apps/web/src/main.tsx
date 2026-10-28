import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// A gestão privada só é aberta no build Docker (modo normal).
// O GitHub Pages (mode pages) continua exclusivamente demonstrativo.
const PrivatePortal = React.lazy(() => import('./private/PrivatePortal'));
const privateRoute = import.meta.env.MODE !== 'pages'
  && window.location.pathname.replace(/\/$/, '') === '/gestao';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {privateRoute
      ? <React.Suspense fallback={<p style={{padding: 32}}>A carregar a área privada…</p>}>
          <PrivatePortal />
        </React.Suspense>
      : <App />}
  </React.StrictMode>,
);
