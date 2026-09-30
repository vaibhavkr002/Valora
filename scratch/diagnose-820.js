const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8263;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9323',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  try {
    const listRes = await fetch('http://127.0.0.1:9323/json');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result && data.result.result ? data.result.result : data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }
    await new Promise(r => ws.addEventListener('open', r));

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res ? res.value : null;
    }

    await send('Page.navigate', { url: 'http://localhost:' + PORT + '/index.html' });
    await new Promise(r => setTimeout(r, 1200));

    const vps = [
      { width: 320, height: 600, mobile: true },
      { width: 360, height: 740, mobile: true },
      { width: 375, height: 812, mobile: true },
      { width: 390, height: 844, mobile: true },
      { width: 393, height: 852, mobile: true },
      { width: 414, height: 896, mobile: true },
      { width: 430, height: 932, mobile: true },
      { width: 600, height: 960, mobile: true },
      { width: 768, height: 1024, mobile: true },
      { width: 820, height: 1180, mobile: false }
    ];

    for (const v of vps) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: v.width,
        height: v.height,
        deviceScaleFactor: 2,
        mobile: v.mobile
      });
      await new Promise(r => setTimeout(r, 200));
    }

    const diagnosis = await evaluate(`
      (() => {
        const clientW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const overflowing = [];
        const all = document.querySelectorAll('*');
        for (const el of all) {
          if (['SCRIPT','STYLE','LINK','META','NOSCRIPT'].includes(el.tagName)) continue;
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (rect.right > clientW + 2) {
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            if (el.className && typeof el.className === 'string') sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
            overflowing.push({
              selector: sel,
              width: Math.round(rect.width),
              right: Math.round(rect.right),
              clientW: clientW,
              overflow: Math.round(rect.right - clientW),
              position: cs.position,
              display: cs.display
            });
          }
        }
        return { clientW, scrollW, count: overflowing.length, items: overflowing.slice(0, 15) };
      })()
    `);

    console.log('Sequence Diagnosis:');
    console.log(JSON.stringify(diagnosis, null, 2));

    ws.close();
  } catch(e) { console.error(e); }
  finally { edgeProc.kill(); server.close(); process.exit(0); }
});
