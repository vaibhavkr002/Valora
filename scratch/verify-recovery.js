const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8198;
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
  if (reqPath === '/') reqPath = '/homepage.html';
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
  console.log(`Verification Server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9289',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/homepage.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9289/json');
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

    ws.onopen = async () => {
      await send('Runtime.enable');
      await send('Page.enable');

      // Add alert bypass and mock admin for protected admin tests
      await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          window.alert = function(msg) { console.log('[HEADLESS DIALOG]:', msg); };
          window.confirm = function() { return true; };
          if (window.location.pathname.includes('/admin/products.html') || window.location.pathname.includes('/admin/dashboard.html')) {
            window._mockAdminSession = true;
          }
        `
      });

      console.log('\n=== RECOVERY TEST 1: STOREFRONT HOMEPAGE PRODUCT SYNC ===');
      await send('Page.navigate', { url: `http://localhost:${PORT}/homepage.html` });
      
      // Wait for Supabase sync
      let test1Result = null;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 300));
        test1Result = await send('Runtime.evaluate', {
          returnByValue: true,
          expression: `
            (() => {
              const products = window.PRODUCTS_DATA || [];
              const adminUploaded = products.filter(p => !p.id.startsWith('prod-') && !p.id.startsWith('d0000000-'));
              return {
                totalCount: products.length,
                adminUploadedCount: adminUploaded.length,
                sampleAdminProduct: adminUploaded[0] ? { id: adminUploaded[0].id, name: adminUploaded[0].name, price: adminUploaded[0].price } : null
              };
            })()
          `
        });
        if (test1Result && test1Result.value && test1Result.value.totalCount >= 70) break;
      }
      console.log('1. Homepage Products In Memory:', test1Result.value);

      console.log('\n=== RECOVERY TEST 2: SHOP PAGE PRODUCT LISTING ===');
      await send('Page.navigate', { url: `http://localhost:${PORT}/shop.html` });
      let test2Result = null;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 300));
        test2Result = await send('Runtime.evaluate', {
          returnByValue: true,
          expression: `
            (() => {
              const grid = document.getElementById('products-grid') || document.querySelector('.products-grid');
              const cards = grid ? grid.querySelectorAll('.product-card') : [];
              return {
                productsDataCount: (window.PRODUCTS_DATA || []).length,
                renderedCardsCount: cards.length
              };
            })()
          `
        });
        if (test2Result && test2Result.value && test2Result.value.productsDataCount >= 70) break;
      }
      console.log('2. Shop Page Products:', test2Result.value);

      console.log('\n=== RECOVERY TEST 3: ADMIN-UPLOADED PRODUCT DETAILS PAGE (PDP) ===');
      // Load one of the real admin-uploaded products
      const testAdminId = 'b289ced2-84b0-4126-b495-ef473dce33ff';
      await send('Page.navigate', { url: `http://localhost:${PORT}/product.html?id=${testAdminId}` });
      let test3Result = null;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 300));
        test3Result = await send('Runtime.evaluate', {
          returnByValue: true,
          expression: `
            (() => {
              const titleEl = document.getElementById('detail-title');
              const priceEl = document.getElementById('detail-current-price');
              const mainView = document.getElementById('product-main-view');
              const notFoundView = document.getElementById('product-not-found-view');
              const specsBody = document.getElementById('specs-table-body');
              return {
                titleText: titleEl ? titleEl.textContent.trim() : null,
                priceText: priceEl ? priceEl.textContent.trim() : null,
                mainViewVisible: mainView ? (mainView.style.display !== 'none') : false,
                notFoundVisible: notFoundView ? (notFoundView.style.display !== 'none') : false,
                specsRendered: specsBody ? !specsBody.innerHTML.includes('Loading') : false
              };
            })()
          `
        });
        if (test3Result && test3Result.value && test3Result.value.titleText && test3Result.value.titleText.includes('Superstar')) break;
      }
      console.log('3. Admin-Uploaded PDP Rendered:', test3Result.value);

      console.log('\n=== RECOVERY TEST 4: ADMIN LOGIN AUTH INITIALIZATION ===');
      await send('Page.navigate', { url: `http://localhost:${PORT}/admin/index.html` });
      await new Promise(r => setTimeout(r, 800));
      const test4Result = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `
          (() => {
            return {
              adminAuthDefined: typeof window.AdminAuth === 'object' && window.AdminAuth !== null,
              hasCheckAdmin: typeof window.AdminAuth?.checkAdmin === 'function',
              hasLogin: typeof window.AdminAuth?.login === 'function',
              hasGuardRoute: typeof window.AdminAuth?.guardRoute === 'function'
            };
          })()
        `
      });
      console.log('4. Admin Auth Module State:', test4Result.value);

      console.log('\n=== ALL RECOVERY TESTS COMPLETED ===\n');

      ws.close();
      edgeProc.kill();
      server.close();
      process.exit(0);
    };
  } catch (err) {
    console.error('Test execution error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});

