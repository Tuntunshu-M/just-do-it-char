import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer((request, response) => {
  const relative = request.url === '/' ? 'qa/preview.html' : request.url.slice(1);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root)) { response.statusCode = 403; response.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.statusCode = 404; response.end(); return; }
    response.setHeader('Content-Type', mime[path.extname(file)] ?? 'text/plain');
    response.end(data);
  });
}).listen(4173);
