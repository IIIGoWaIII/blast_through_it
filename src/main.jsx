import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const perf = performance;
perf.mark('bundle-start');

// Initial paint marker
requestAnimationFrame(() => {
  perf.mark('first-paint');
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Log timing after paint
const logTiming = () => {
  const bundleTime = perf.now();
  perf.mark('interactive');
  perf.measure('bundle-startup', 'bundle-start', 'first-paint');
  perf.measure('first-render', 'first-paint', 'interactive');
  const measures = perf.getEntriesByType('measure');
  console.log(`[Perf] Bundle startup: ${(measures.find(m => m.name === 'bundle-startup')?.duration || 0).toFixed(1)}ms`);
  console.log(`[Perf] First render: ${(measures.find(m => m.name === 'first-render')?.duration || 0).toFixed(1)}ms`);
  console.log(`[Perf] Interactive: ${bundleTime.toFixed(1)}ms`);
  perf.clearMarks();
  perf.clearMeasures();
};

if ('requestIdleCallback' in window) {
  requestIdleCallback(logTiming);
} else {
  setTimeout(logTiming, 500);
}
