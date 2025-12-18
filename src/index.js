import React from 'react';
import ReactDOM from 'react-dom/client';
import './assets/styles/index.css';
import App from './app/App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

import { AuthProvider } from './features/auth/contexts/AuthContext';
import './utils/testUnifiedSearch';
import './utils/testLocalLemmatization';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Register service worker for PWA support
// Only register in production to avoid caching issues in development
if (process.env.NODE_ENV === 'production') {
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      // 当发现新版本时，触发自定义事件通知 UI
      if (registration && registration.waiting) {
        window.dispatchEvent(
          new CustomEvent('SW_UPDATE_AVAILABLE', { detail: registration })
        );
      }
    },
  });
} else {
  // In development, always unregister to ensure latest code is served
  serviceWorkerRegistration.unregister();
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

