const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9345;
const HTTP_PORT = 8100;

const MIME_TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/homepage.html';
  const filePath = path.join(__dirname, '..', reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});

server.listen(HTTP_PORT, async () => {
  const edge = spawn(EDGE_PATH, ['--headless=new', '--remote-debugging-port=' + PORT, '--no-first-run', '--disable-gpu', 'http://127.0.0.1:' + HTTP_PORT + '/homepage.html']);
  await new Promise(r => setTimeout(r, 1500));
  const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
  const pages = await res.json();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };

  ws.onopen = async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Categories
    await send('Runtime.evaluate', { expression: 'document.querySelector("#categories-section").scrollIntoView({ block: "center" });' });
    await new Promise(r => setTimeout(r, 500));
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'snap_categories.png'), Buffer.from(shot.data, 'base64'));

    // 2. Why Shop With Us
    await send('Runtime.evaluate', { expression: 'document.querySelector("#why-us").scrollIntoView({ block: "start" });' });
    await new Promise(r => setTimeout(r, 500));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'snap_why_us.png'), Buffer.from(shot.data, 'base64'));

    // 3. Delivery Partners
    await send('Runtime.evaluate', { expression: 'document.querySelector("#delivery-partners").scrollIntoView({ block: "start" });' });
    await new Promise(r => setTimeout(r, 500));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'snap_delivery.png'), Buffer.from(shot.data, 'base64'));

    // 4. Newsletter
    await send('Runtime.evaluate', { expression: 'document.querySelector(".newsletter-section").scrollIntoView({ block: "center" });' });
    await new Promise(r => setTimeout(r, 500));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'snap_newsletter.png'), Buffer.from(shot.data, 'base64'));

    // Details of newsletter elements
    const nlEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const form = document.querySelector("#newsletter-form");
          const card = document.querySelector(".newsletter-card");
          return {
            formHtml: form ? form.outerHTML : null,
            formChildren: form ? Array.from(form.children).map(c => ({
              tag: c.tagName,
              type: c.type,
              className: c.className,
              rect: c.getBoundingClientRect(),
              style: {
                display: getComputedStyle(c).display,
                width: getComputedStyle(c).width,
                height: getComputedStyle(c).height,
                background: getComputedStyle(c).background
              }
            })) : []
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Newsletter details:', JSON.stringify(nlEval.result.value, null, 2));

    edge.kill();
    server.close();
    process.exit(0);
  };
});
