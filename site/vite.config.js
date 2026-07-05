import { defineConfig } from 'vite';

// Relative base so the built site works from any location: domain root,
// a sub-path (e.g. GitHub Pages /Marble-Trace/), or opened straight from disk.
export default defineConfig({
  base: './',
});
