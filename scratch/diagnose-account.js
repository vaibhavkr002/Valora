const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8201;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
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
  console.log(`Diagnostic Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9293',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/account.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9293/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
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

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res ? res.value : null;
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 768
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // Mock authenticated user so account.html doesn't redirect
    await evaluate(`
      (function() {
        const mockUser = {
          id: 'test-user-id-123',
          email: 'alexander@example.com',
          name: 'Alexander Hayes',
          user_metadata: { full_name: 'Alexander Hayes' }
        };
        window.mockUser = mockUser;
        if (window.VeloraAuth) {
          window.VeloraAuth.getCurrentUser = function() { return mockUser; };
          window.VeloraAuth.isLoggedIn = function() { return true; };
        }
        if (window.supabaseClient) {
          window.supabaseClient.auth.getUser = async () => ({ data: { user: mockUser }, error: null });
        }
      })()
    `);

    // Reload page to avoid redirect or evaluate elements
    await send('Page.navigate', { url: `http://localhost:${PORT}/account.html` });
    await new Promise(r => setTimeout(r, 1500));

    // Re-inject mock before scripts run or handle auth redirect
    await evaluate(`
      (function() {
        const mockUser = {
          id: 'test-user-id-123',
          email: 'alexander@example.com',
          name: 'Alexander Hayes',
          user_metadata: { full_name: 'Alexander Hayes' }
        };
        window.VeloraAuth = {
          getCurrentUser: () => mockUser,
          isLoggedIn: () => true,
          getClient: () => ({
            auth: {
              getUser: async () => ({ data: { user: mockUser }, error: null })
            },
            from: () => ({
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { full_name: 'Alexander Hayes', email: 'alexander@example.com', phone: '+91 98765 43210' }, error: null }),
                  order: async () => ({ data: [], error: null })
                })
              })
            })
          })
        };
      })()
    `);

    await setViewport(390, 844);

    const diagnosis = await evaluate(`
      (function() {
        const docEl = document.documentElement;
        const body = document.body;

        // 1. Find all overflowing elements
        const allElements = Array.from(document.querySelectorAll('*'));
        const overflowing = [];
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 1) {
            overflowing.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              rectRight: Math.round(rect.right),
              rectWidth: Math.round(rect.width),
              windowWidth: window.innerWidth
            });
          }
        });

        // 2. Measure header, card, tabs
        const titleRow = document.querySelector('.checkout-page-title-row');
        const title = document.querySelector('.checkout-page-title');
        const subtitle = document.querySelector('.checkout-page-subtitle');
        const sidebarCard = document.querySelector('.account-sidebar-card');
        const contentCard = document.querySelector('.account-content-card');
        const grid = document.querySelector('.account-dashboard-grid');
        const navTabs = document.querySelector('.account-nav-tabs');
        const tabBtns = Array.from(document.querySelectorAll('.account-tab-btn')).map(b => ({
          text: b.textContent.trim(),
          width: Math.round(b.getBoundingClientRect().width),
          right: Math.round(b.getBoundingClientRect().right)
        }));

        // 3. Find any element with pink/black styles
        const colorElements = [];
        allElements.forEach(el => {
          const cs = window.getComputedStyle(el);
          const bg = cs.backgroundColor;
          const col = cs.color;
          const bgImg = cs.backgroundImage;
          if (bg.includes('rgb(0, 0, 0)') || bg.includes('black') || bg.includes('255, 0,') || bg.includes('pink') || cs.borderBottomColor.includes('pink') || cs.borderBottomColor.includes('black')) {
            const r = el.getBoundingClientRect();
            if (r.top > 400 && r.height > 10) {
              colorElements.push({
                tag: el.tagName,
                className: el.className,
                id: el.id,
                bg: bg,
                top: Math.round(r.top),
                height: Math.round(r.height),
                width: Math.round(r.width)
              });
            }
          }
        });

        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth,
          titleRowRect: titleRow ? {
            width: Math.round(titleRow.getBoundingClientRect().width),
            right: Math.round(titleRow.getBoundingClientRect().right)
          } : null,
          titleComputed: title ? {
            fontSize: window.getComputedStyle(title).fontSize,
            lineHeight: window.getComputedStyle(title).lineHeight,
            width: Math.round(title.getBoundingClientRect().width),
            right: Math.round(title.getBoundingClientRect().right)
          } : null,
          subtitleComputed: subtitle ? {
            fontSize: window.getComputedStyle(subtitle).fontSize,
            width: Math.round(subtitle.getBoundingClientRect().width),
            right: Math.round(subtitle.getBoundingClientRect().right)
          } : null,
          sidebarCardComputed: sidebarCard ? {
            height: Math.round(sidebarCard.getBoundingClientRect().height),
            minHeight: window.getComputedStyle(sidebarCard).minHeight,
            padding: window.getComputedStyle(sidebarCard).padding,
            display: window.getComputedStyle(sidebarCard).display
          } : null,
          contentCardComputed: contentCard ? {
            height: Math.round(contentCard.getBoundingClientRect().height),
            minHeight: window.getComputedStyle(contentCard).minHeight,
            padding: window.getComputedStyle(contentCard).padding
          } : null,
          navTabsComputed: navTabs ? {
            display: window.getComputedStyle(navTabs).display,
            flexDirection: window.getComputedStyle(navTabs).flexDirection,
            overflowX: window.getComputedStyle(navTabs).overflowX,
            scrollWidth: navTabs.scrollWidth,
            clientWidth: navTabs.clientWidth
          } : null,
          tabBtns,
          overflowingCount: overflowing.length,
          topOverflowing: overflowing.slice(0, 15),
          colorElements
        };
      })()
    `);

    console.log('Diagnosis Result at 390px:\n', JSON.stringify(diagnosis, null, 2));

    ws.close();
    edgeProc.kill();
    server.close();
    process.exit(0);
  } catch (e) {
    console.error('Error during diagnosis:', e);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});

