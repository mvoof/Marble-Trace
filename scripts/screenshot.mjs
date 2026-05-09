#!/usr/bin/env node
// Usage: node screenshot.mjs [windowId] [outputPath]
//   windowId  - "overlay" or "main" (default: overlay)
//   outputPath - where to save PNG (default: docs/assets/screenshots/overlay/screenshot-<timestamp>.png)

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import WebSocket from 'ws';

const windowId = process.argv[2] || 'overlay';
const defaultDir = path.join(
  process.cwd(),
  'docs',
  'assets',
  'screenshots',
  'overlay'
);
const outputPath =
  process.argv[3] || path.join(defaultDir, `screenshot-${Date.now()}.png`);

// Ensure directory exists
try {
  mkdirSync(path.dirname(outputPath), { recursive: true });
} catch {
  // Ignore if directory already exists
}

const ws = new WebSocket('ws://localhost:9223');

ws.on('open', () => {
  const id = `req_${Date.now()}_screenshot`;
  ws.send(
    JSON.stringify({
      id,
      command: 'capture_native_screenshot',
      args: { format: 'png', windowLabel: windowId },
    })
  );

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id !== id) return;
      ws.close();

      if (!msg.success) {
        console.error('Error:', msg.error);
        process.exit(1);
      }

      // data is a base64 data URL: "data:image/png;base64,..."
      const base64 = msg.data.replace(/^data:image\/\w+;base64,/, '');
      writeFileSync(outputPath, Buffer.from(base64, 'base64'));
      console.log('Saved:', outputPath);
    } catch (err) {
      console.error('Failed to parse message:', err.message);
      process.exit(1);
    }
  });
});

ws.on('error', (err) => {
  console.error('Connection failed:', err.message);
  console.error('Make sure the app is running in dev mode (npm run tauri dev)');
  process.exit(1);
});
