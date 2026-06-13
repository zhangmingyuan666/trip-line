import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import FootprintPage from './pages/FootprintPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FootprintPage />
  </React.StrictMode>,
);
