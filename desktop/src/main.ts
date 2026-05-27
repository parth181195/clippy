import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// Apply dark theme immediately so first paint has correct CSS vars,
// before SettingsStore.load() returns asynchronously.
document.documentElement.dataset.theme = 'dark';

const app = mount(App, { target: document.getElementById('app')! });
export default app;
