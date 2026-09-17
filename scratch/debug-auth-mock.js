const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8211;
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
    '--remote-debugging-port=9301',
    '--disable-gpu',
    '--no-sandbox',
    `about:blank`
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch('http://127.0.0.1:9301/json');
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
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Intercept Supabase createClient right from the start
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const mockUser = {
          id: 'cust-uuid-4567',
          email: 'rohan.sharma@example.com',
          user_metadata: {
            full_name: 'Rohan Sharma',
            phone: '+91 98765 12345'
          }
        };

        const mockProfile = {
          id: 'cust-uuid-4567',
          full_name: 'Rohan Sharma',
          email: 'rohan.sharma@example.com',
          phone: '+91 98765 12345',
          role: 'customer'
        };

        // Define mock client BEFORE supabaseClient.js or auth.js runs
        const mockClient = {
          auth: {
            getSession: async () => ({
              data: { session: { user: mockUser, access_token: 'valid-mock-token' } },
              error: null
            }),
            getUser: async () => ({
              data: { user: mockUser },
              error: null
            }),
            signOut: async () => ({
              error: null
            }),
            updateUser: async () => ({
              data: { user: mockUser },
              error: null
            }),
            onAuthStateChange: () => ({
              data: { subscription: { unsubscribe: () => {} } }
            })
          },
          from: (table) => {
            if (table === 'profiles') {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockProfile, error: null }),
                    single: async () => ({ data: mockProfile, error: null })
                  })
                }),
                upsert: () => ({
                  select: () => ({
                    maybeSingle: async () => ({ data: mockProfile, error: null })
                  })
                }),
                update: () => ({
                  eq: async () => ({ error: null })
                })
              };
            }
            if (table === 'orders') {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null })
                  })
                })
              };
            }
            if (table === 'addresses') {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null })
                  })
                })
              };
            }
            return {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) })
            };
          },
          channel: () => ({
            on: () => ({ subscribe: () => {} })
          })
        };

        window.supabaseClient = mockClient;
        window.getSupabase = () => mockClient;

        // Ensure supabase CDN doesn't overwrite it
        Object.defineProperty(window, 'supabaseClient', {
          get: () => mockClient,
          set: () => {},
          configurable: false
        });
      `
    });

    await send('Page.navigate', { url: `http://localhost:${PORT}/account.html` });
    await new Promise(r => setTimeout(r, 2000));

    const check = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            url: window.location.href,
            name: document.getElementById('account-user-name')?.textContent,
            email: document.getElementById('account-user-email')?.textContent,
            avatar: document.getElementById('account-avatar-circle')?.textContent,
            nameInput: document.getElementById('profile-name-input')?.value,
            spinnerDisplay: document.getElementById('profile-loading-indicator')?.style.display
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Result:', JSON.stringify(check.value, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

