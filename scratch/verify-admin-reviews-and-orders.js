const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8452;
const CDP_PORT = 9352;
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result && data.result.result ? data.result.result : data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise(res => ws.addEventListener('open', res, { once: true }));

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    // Inject mock
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const mockAdminUser = { id: 'admin-uuid-1', email: 'admin@velora.com' };
        const mockAdminProfile = { id: 'admin-uuid-1', role: 'admin', full_name: 'Store Admin' };

        window.mockProducts = [
          { id: 'p-1', name: 'Velora Silk Evening Gown', brand: 'VELORA', price: 2999, rating: 4.8, review_count: 5, category_id: 'cat-1', categories: { id: 'cat-1', name: 'Dresses' } },
          { id: 'p-2', name: 'Velora Tailored Blazer', brand: 'VELORA', price: 4499, rating: 4.5, review_count: 2, category_id: 'cat-2', categories: { id: 'cat-2', name: 'Outerwear' } }
        ];

        window.mockReviews = [
          { id: 'r-1', product_id: 'p-1', user_name: 'Priya Patel', rating: 5, status: 'approved', comment: 'Spectacular quality and drape! Fits like a dream.', created_at: '2026-09-15T12:00:00Z' },
          { id: 'r-2', product_id: 'p-1', user_name: 'Ananya Roy', rating: 4, status: 'approved', comment: 'Gorgeous color, fits true to size.', created_at: '2026-09-16T14:00:00Z' }
        ];

        window.mockOrders = [
          { id: 'ord-1', order_number: 'VEL-2026-001', delivery_full_name: 'Rohan Sharma', total_amount: 3200, status: 'pending', payment_method: 'Cash on Delivery', created_at: '2026-09-16T10:00:00Z' }
        ];

        const mockClient = {
          auth: {
            getUser: () => Promise.resolve({ data: { user: mockAdminUser }, error: null }),
            signOut: () => Promise.resolve({ error: null })
          },
          from: (tbl) => ({
            select: (cols) => ({
              order: (col, opt) => Promise.resolve({
                data: tbl === 'products' ? window.mockProducts : (tbl === 'reviews' ? window.mockReviews : (tbl === 'orders' ? window.mockOrders : [{ id: 'cat-1', name: 'Dresses' }])),
                error: null
              }),
              eq: (col, val) => ({
                order: () => Promise.resolve({
                  data: tbl === 'reviews' ? window.mockReviews.filter(r => r[col] === val) : [],
                  error: null
                }),
                select: () => Promise.resolve({
                  data: tbl === 'reviews' ? window.mockReviews.filter(r => r[col] === val) : [],
                  error: null
                }),
                maybeSingle: () => Promise.resolve({
                  data: tbl === 'profiles' ? mockAdminProfile : (tbl === 'orders' ? window.mockOrders[0] : null),
                  error: null
                }),
                single: () => Promise.resolve({
                  data: tbl === 'profiles' ? mockAdminProfile : (tbl === 'orders' ? window.mockOrders[0] : null),
                  error: null
                })
              })
            }),
            insert: (rows) => {
              if (tbl === 'reviews') window.mockReviews.push(...rows);
              return Promise.resolve({ error: null });
            },
            update: (fields) => ({ eq: (col, val) => Promise.resolve({ error: null }) }),
            delete: () => ({ eq: (col, val) => Promise.resolve({ error: null }) })
          }),
          rpc: () => Promise.resolve({ data: { success: true }, error: null })
        };

        Object.defineProperty(window, 'supabaseClient', {
          get: () => mockClient,
          set: () => {},
          configurable: true
        });

        window.getSupabase = () => mockClient;
        window.showToast = (m) => console.log('[TOAST]:', m);
      `
    });

    console.log('\n--- VERIFYING VIEW 2 (PRODUCT REVIEWS MANAGEMENT) ---');
    await send('Page.navigate', { url: `http://localhost:${PORT}/admin/reviews.html` });
    await new Promise(r => setTimeout(r, 2500));

    // Click "Manage Reviews" on the first product
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.btn-manage-reviews').click()`
    });
    await new Promise(r => setTimeout(r, 1500));

    const view2Eval = await send('Runtime.evaluate', {
      expression: `({
        viewProductsHidden: document.getElementById('view-products').style.display === 'none',
        viewProductReviewsVisible: document.getElementById('view-product-reviews').style.display === 'block',
        productNameInBanner: document.getElementById('detail-product-name').textContent,
        productRatingInBanner: document.getElementById('detail-product-rating').textContent,
        reviewsRendered: document.querySelectorAll('.review-item-card').length,
        hasEditBtn: !!document.querySelector('.btn-edit-review'),
        hasDeleteBtn: !!document.querySelector('.btn-delete-review')
      })`,
      returnByValue: true
    });
    console.log('View 2 Verification:', JSON.stringify(view2Eval.value, null, 2));

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const view2Screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'admin-reviews-view2-verified.png'), Buffer.from(view2Screenshot.data, 'base64'));
    console.log('Screenshot saved to scratch/admin-reviews-view2-verified.png');

    // Click "+ Add Review" modal
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-open-add-review').click()`
    });
    await new Promise(r => setTimeout(r, 800));

    const modalEval = await send('Runtime.evaluate', {
      expression: `({
        addModalHasShowClass: document.getElementById('modal-add-review').classList.contains('show'),
        modalProductTitle: document.getElementById('add-modal-product-title').textContent
      })`,
      returnByValue: true
    });
    console.log('Add Modal Verification:', JSON.stringify(modalEval.value, null, 2));

    const modalScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'admin-reviews-modal-verified.png'), Buffer.from(modalScreenshot.data, 'base64'));
    console.log('Screenshot saved to scratch/admin-reviews-modal-verified.png');

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

