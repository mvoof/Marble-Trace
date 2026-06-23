#!/usr/bin/env node
// Usage: node screenshot.mjs [windowId] [--out-dir <dir>] [--crop]
//   windowId      - "overlay" or "main" (default: overlay)
//   --out-dir <d> - directory for the full screenshot (default: docs/assets/screenshots/overlay/)
//   --crop        - also crop each visible widget into <out-dir>/<widgetId>.png

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import WebSocket from 'ws';

const args = process.argv.slice(2);

const cropFlag = args.includes('--crop');

const outDirIndex = args.indexOf('--out-dir');
const defaultOutDir = cropFlag
  ? path.join(process.cwd(), 'docs', 'assets', 'screenshots', 'widgets')
  : path.join(process.cwd(), 'docs', 'assets', 'screenshots', 'overlay');

const outDir =
  outDirIndex !== -1 && args[outDirIndex + 1]
    ? path.resolve(args[outDirIndex + 1])
    : defaultOutDir;

const positional = args.filter(
  (a, i) => a !== '--crop' && a !== '--out-dir' && args[i - 1] !== '--out-dir'
);

const windowId = positional[0] || 'overlay';

mkdirSync(outDir, { recursive: true });

const outputPath = path.join(outDir, `screenshot-${Date.now()}.png`);

const ws = new WebSocket('ws://localhost:9223');

ws.on('open', () => {
  const screenshotId = `req_${Date.now()}_screenshot`;
  ws.send(
    JSON.stringify({
      id: screenshotId,
      command: 'capture_native_screenshot',
      args: { format: 'png', windowLabel: windowId },
    })
  );

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id !== screenshotId) return;

      if (!msg.success) {
        console.error('Error:', msg.error);
        ws.close();
        process.exit(1);
      }

      const base64 = msg.data.replace(/^data:image\/\w+;base64,/, '');
      const pngBuffer = Buffer.from(base64, 'base64');
      writeFileSync(outputPath, pngBuffer);
      console.log('Saved:', outputPath);

      if (!cropFlag) {
        ws.close();
        return;
      }

      await cropWidgets(ws, pngBuffer, outDir);
      ws.close();
    } catch (err) {
      console.error('Failed:', err.message);
      ws.close();
      process.exit(1);
    }
  });
});

ws.on('error', (err) => {
  console.error('Connection failed:', err.message);
  console.error('Make sure the app is running in dev mode (npm run tauri dev)');
  process.exit(1);
});

async function cropWidgets(ws, pngBuffer, baseDir) {
  const { default: sharp } = await import('sharp');

  const jsCode = `
    (function() {
      const els = document.querySelectorAll('[data-widget-id]');
      const result = [];
      for (const el of els) {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.push({
            id: el.dataset.widgetId,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
      return JSON.stringify(result);
    })()
  `;

  const jsId = `req_${Date.now()}_js`;

  return new Promise((resolve, reject) => {
    const onMessage = async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id !== jsId) return;
        ws.off('message', onMessage);

        if (!msg.success) {
          console.error('JS execution failed:', msg.error);
          reject(new Error(msg.error));
          return;
        }

        const widgets = JSON.parse(msg.data);
        if (!widgets.length) {
          console.log('No visible widgets found to crop.');
          resolve();
          return;
        }

        mkdirSync(baseDir, { recursive: true });

        const meta = await sharp(pngBuffer).metadata();
        const imgWidth = meta.width;
        const imgHeight = meta.height;

        for (const widget of widgets) {
          const left = Math.max(0, widget.x);
          const top = Math.max(0, widget.y);
          const right = Math.min(imgWidth, widget.x + widget.width);
          const bottom = Math.min(imgHeight, widget.y + widget.height);
          const width = right - left;
          const height = bottom - top;

          if (width <= 0 || height <= 0) continue;

          const outFile = path.join(baseDir, `${widget.id}.png`);
          await sharp(pngBuffer)
            .extract({ left, top, width, height })
            .toFile(outFile);

          console.log(`  Cropped: ${widget.id} → ${outFile}`);
        }

        resolve();
      } catch (err) {
        ws.off('message', onMessage);
        reject(err);
      }
    };

    ws.on('message', onMessage);
    ws.send(
      JSON.stringify({
        id: jsId,
        command: 'execute_js',
        args: { script: jsCode, windowLabel: 'overlay' },
      })
    );
  });
}
