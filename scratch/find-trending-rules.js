const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/homepage.html';
  
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
      const el = document.querySelector('#trending-grid');
      const matched = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && (rule.selectorText.includes('trending-grid') || rule.selectorText.includes('products-grid'))) {
              matched.push({
                href: sheet.href ? sheet.href.split('/').pop() : 'inline',
                selector: rule.selectorText,
                cssText: rule.cssText
              });
            }
          }
        } catch(e) {
          matched.push({ error: e.message });
        }
      }

      const container = document.querySelector('.container');
      const containerRules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && (rule.selectorText === '.container' || rule.selectorText.endsWith('.container'))) {
              containerRules.push({
                href: sheet.href ? sheet.href.split('/').pop() : 'inline',
                selector: rule.selectorText,
                cssText: rule.cssText
              });
            }
          }
        } catch(e) {
          containerRules.push({ error: e.message });
        }
      }

      const pre = document.createElement('pre');
      pre.id = 'rule-diagnostics';
      pre.textContent = JSON.stringify({ 
        computedGrid: {
          display: getComputedStyle(el).display,
          gridTemplateColumns: getComputedStyle(el).gridTemplateColumns,
          width: getComputedStyle(el).width
        },
        computedContainer: {
          width: getComputedStyle(container).width,
          maxWidth: getComputedStyle(container).maxWidth,
          marginLeft: getComputedStyle(container).marginLeft,
          marginRight: getComputedStyle(container).marginRight
        },
        matched,
        containerRules 
      }, null, 2);
      document.body.appendChild(pre);
    });
    </script>
    `;
    content = Buffer.from(html.replace('</body>', injection + '</body>'));
  }

  res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
  res.end(content);
});

server.listen(48291, () => {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    '--dump-dom',
    '--virtual-time-budget=2000',
    'http://localhost:48291/homepage.html'
  ];

  execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
    server.close();
    if (err) {
      console.error(err);
      return;
    }
    const match = stdout.match(/<pre id="rule-diagnostics">([\s\S]*?)<\/pre>/);
    if (match) {
      console.log(match[1]);
    } else {
      console.log('No diagnostics output in HTML');
    }
  });
});

