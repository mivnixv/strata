import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const sourceRoot = resolve(import.meta.dirname, 'src');
const standaloneRoot = resolve(import.meta.dirname, 'standalone');
const outputRoot = resolve(import.meta.dirname, 'dist');
const iconsRoot = resolve(import.meta.dirname, 'icons');
const mime = { '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const offline = pathname.startsWith('/standalone/');
  const generated = pathname.startsWith('/dist/');
  const asset = pathname.startsWith('/assets/icons/');
  const root = asset ? iconsRoot : generated ? outputRoot : offline ? standaloneRoot : sourceRoot;
  const prefix = asset ? '/assets/icons' : generated ? '/dist' : offline ? '/standalone' : pathname.startsWith('/src/') ? '/src' : '';
  const relative = pathname.slice(prefix.length);
  const path = resolve(root, '.' + relative.replace(/\/$/, '/index.html'));

  if (!path.startsWith(root + '/')) {
    res.writeHead(403).end(); return;
  }

  try {
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
