import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css' // ★ この行を追加！

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
