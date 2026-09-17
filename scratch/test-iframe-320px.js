const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/homepage.html';
  
  if (reqPath === '/iframe-tester.html') {
    const html = `<!DOCTYPE html>
    <html><body>
    <iframe id="test-frame-320" src="/homepage.html" style="width: 320px; height: 600px; border: none;"></iframe>
    <script>
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'IFRAME_RESULTS') {
        const pre = document.createElement('pre');
        pre.id = 'iframe-output';
        pre.textContent = JSON.stringify(e.data.payload, null, 2);
        document.body.appendChild(pre);
      }
    });
    </script>
    </body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  const filePath = path.join(ROOT_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  const ext = path.extname(filePath);
  const mimeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };
  
  let content = fs.readFileSync(filePath);
  if (reqPath === '/homepage.html') {
    let html = content.toString('utf8');
    const injection = `
    <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const orderContainer = document.getElementById('velora-order-activity');
        const card = document.getElementById('velora-activity-card');
        const thumb = document.getElementById('velora-activity-img');
        const productName = document.getElementById('velora-activity-productname');

        const payload = {
          frameWidth: window.innerWidth,
          containerMaxWidth: orderContainer ? getComputedStyle(orderContainer).maxWidth : null,
          cardWidth: card ? getComputedStyle(card).width : null,
          cardHeight: card ? getComputedStyle(card).height : null,
          thumbWidth: thumb ? getComputedStyle(thumb.parentElement).width : null,
          thumbHeight: thumb ? getComputedStyle(thumb.parentElement).height : null,
          productLineClamp: productName ? getComputedStyle(productName).webkitLineClamp : null,
          productOverflow: productName ? getComputedStyle(productName).overflow : null
        };

        if (window.parent !== window) {
          window.parent.postMessage({ type: 'IFRAME_RESULTS', payload }, '*');
        }
      }, 1500);
    });
    </script>
    `;
    content = Buffer.from(html.replace('</body>', injection + '</body>'));
  }

  res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
  res.end(content);
});

server.listen(48395, () => {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--window-size=800,800',
    '--dump-dom',
    '--virtual-time-budget=3000',
    'http://localhost:48395/iframe-tester.html'
  ];

  execFile(EDGE_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
    server.close();
    if (err) {
      console.error(err);
      return;
    }
    const match = stdout.match(/<pre id="iframe-output">([\s\S]*?)<\/pre>/);
    if (match) {
      console.log('=== 320px Iframe Test Result ===');
      console.log(match[1]);
    } else {
      console.log('No iframe output found');
    }
  });
});

