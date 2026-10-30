import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.md': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const servedPath = pathname === '/' ? '/index.html'
      : pathname === '/map' || pathname === '/map/' ? '/dist/map/index.html'
      : pathname.startsWith('/map/assets/') ? '/dist' + pathname
      : pathname;
    const filename = path.resolve(root, '.' + servedPath);
    if (!filename.startsWith(root) || pathname.split('/').some(p => p.startsWith('.'))) {
      res.writeHead(403); return res.end('Forbidden');
    }
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT) || 4173, '0.0.0.0', () => console.log('Meow Munchies · http://localhost:' + server.address().port));
