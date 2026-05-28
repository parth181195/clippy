import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import './styles/tokens.css';
import { initSentryRenderer } from './sentry';
import { App } from './App';

initSentryRenderer();

// Pre-apply dark theme before first paint so CSS vars resolve immediately.
document.documentElement.dataset.theme = 'dark';

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
