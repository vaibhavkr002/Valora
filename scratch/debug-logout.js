const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8213;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/account.html';
  const filePath = path.join(BASE_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9303',
    '--disable-gpu',
    '--no-sandbox',
    `about:blank`
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch('http://127.0.0.1:9303/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page') || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

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

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Page.frameNavigated') {
        console.log('[PAGE NAVIGATED TO]', data.params.frame.url);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        if (sessionStorage.getItem('test_logged_out') === '1') {
          // Logged out state
          const emptyClient = {
            auth: {
              getSession: async () => ({ data: { session: null }, error: null }),
              getUser: async () => ({ data: { user: null }, error: null }),
              signOut: async () => ({ error: null }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
            },
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) })
          };
          window.supabaseClient = emptyClient;
          window.getSupabase = () => emptyClient;
        } else {
          const mockUser = {
            id: 'cust-uuid-4567',
            email: 'rohan.sharma@example.com',
            user_metadata: { full_name: 'Rohan Sharma' }
          };
          const mockProfile = {
            id: 'cust-uuid-4567',
            full_name: 'Rohan Sharma',
            email: 'rohan.sharma@example.com',
            role: 'customer'
          };
          const mockClient = {
            auth: {
              getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
              getUser: async () => ({ data: { user: mockUser }, error: null }),
              signOut: async () => {
                sessionStorage.setItem('test_logged_out', '1');
                return { error: null };
              },
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
            },
            from: () => ({
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockProfile, error: null }) }) })
            })
          };
          window.supabaseClient = mockClient;
          window.getSupabase = () => mockClient;
        }
      `
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/account.html` });
    await new Promise(r => setTimeout(r, 2000));

    console.log('--- Clicking logout button ---');
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const btn = document.getElementById('btn-account-logout');
          if (!btn) return 'BUTTON_NOT_FOUND';
          try {
            console.log('About to click btn...');
            btn.click();
            return 'CLICKED_OK';
          } catch (err) {
            console.error('Click error:', err);
            return 'CLICK_ERR: ' + err.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Click result:', clickRes.value);

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 300));
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log(`Poll ${i}: ${url.value}`);
      if (url.value.includes('login.html')) break;
    }

  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});
