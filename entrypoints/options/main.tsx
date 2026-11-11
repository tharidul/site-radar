
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../popup/style.css';
import './options.css';
import { OptionsApp } from './OptionsApp';

export { OptionsApp };

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );
}
