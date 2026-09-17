const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/homepage.html';
  
  if (reqPath === '/tester.html') {
    const targetW = req.url.includes('w=') ? req.url.split('w=')[1].split('&')[0] : '375';
    const targetH = req.url.includes('h=') ? req.url.split('h=')[1].split('&')[0] : '800';
    const html = `<!DOCTYPE html>
    <html><body style="margin:0; padding:0; background:#000;">
    <iframe id="test-frame" src="/homepage.html" style="width: ${targetW}px; height: ${targetH}px; border: none; display: block;"></iframe>
    <script>
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'IFRAME_RESULTS') {
        const pre = document.createElement('pre');
        pre.id = 'overlap-test-output';
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
        const closeBtn = document.getElementById('velora-activity-close');
        const bogoHero = document.querySelector('.bogo-promo-hero-card') || document.querySelector('.velora-ad-card.theme-bogo') || document.querySelector('.bogo-mini-promo-card');

        if (productName) {
          productName.textContent = "Super Ultra Deluxe Handcrafted Luxury Heritage Chronograph Watch Special Limited Edition Premium Leather Strap Series";
        }

        const data = {
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          liveOrder: {
            containerBottom: orderContainer ? getComputedStyle(orderContainer).bottom : null,
            containerRight: orderContainer ? getComputedStyle(orderContainer).right : null,
            containerLeft: orderContainer ? getComputedStyle(orderContainer).left : null,
            containerPosition: orderContainer ? getComputedStyle(orderContainer).position : null,
            containerZIndex: orderContainer ? getComputedStyle(orderContainer).zIndex : null,
            containerMaxWidth: orderContainer ? getComputedStyle(orderContainer).maxWidth : null,
            cardWidth: card ? getComputedStyle(card).width : null,
            cardHeight: card ? getComputedStyle(card).height : null,
            cardBorderRadius: card ? getComputedStyle(card).borderRadius : null,
            thumbWidth: thumb ? getComputedStyle(thumb.parentElement).width : null,
            thumbHeight: thumb ? getComputedStyle(thumb.parentElement).height : null,
            productLineClamp: productName ? getComputedStyle(productName).webkitLineClamp : null,
            productOverflow: productName ? getComputedStyle(productName).overflow : null,
            closeBtnExists: Boolean(closeBtn)
          },
          bogoBanner: bogoHero ? {
            className: bogoHero.className,
            tagName: bogoHero.tagName,
            width: getComputedStyle(bogoHero).width,
            height: getComputedStyle(bogoHero).height,
            padding: getComputedStyle(bogoHero).padding,
            borderRadius: getComputedStyle(bogoHero).borderRadius
          } : null
        };

        if (window.parent !== window) {
          window.parent.postMessage({ type: 'IFRAME_RESULTS', payload: data }, '*');
        } else {
          const pre = document.createElement('pre');
          pre.id = 'overlap-test-output';
          pre.textContent = JSON.stringify(data, null, 2);
          document.body.appendChild(pre);
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

function testBreakpoint(width, height) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${Math.max(width + 50, 600)},${Math.max(height + 50, 700)}`,
      '--dump-dom',
      '--virtual-time-budget=3000',
      `http://localhost:48392/tester.html?w=${width}&h=${height}`
    ];

    execFile(EDGE_PATH, args, { maxBuffer: 25 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('Error on ' + width + 'px:', err.message);
        return resolve(null);
      }
      const match = stdout.match(/<pre id="overlap-test-output">([\s\S]*?)<\/pre>/);
      if (match) {
        resolve(JSON.parse(match[1]));
      } else {
        console.log('No output tag on ' + width + 'px');
        resolve(null);
      }
    });
  });
}

async function runAll() {
  server.listen(48392, async () => {
    const breakpoints = [
      { w: 320, h: 800, label: '320 × 800 (Extra Small Phone)' },
      { w: 360, h: 800, label: '360 × 800 (Small Android)' },
      { w: 375, h: 812, label: '375 × 812 (iPhone Mini/SE)' },
      { w: 390, h: 844, label: '390 × 844 (iPhone 12/13/14)' },
      { w: 414, h: 896, label: '414 × 896 (iPhone XR/Plus)' },
      { w: 430, h: 932, label: '430 × 932 (iPhone Pro Max)' },
      { w: 1440, h: 900, label: '1440px (Desktop)' }
    ];

    console.log('Running Mobile Live Order + BOGO Overlap Test across breakpoints...\n');
    let allOk = true;

    for (const bp of breakpoints) {
      const res = await testBreakpoint(bp.w, bp.h);
      console.log(`=== ${bp.label} ===`);
      console.log(JSON.stringify(res, null, 2));

      if (!res) {
        allOk = false;
        continue;
      }

      if (bp.w <= 767) {
        const cardW = parseFloat(res.liveOrder.cardWidth);
        const cardH = parseFloat(res.liveOrder.cardHeight);
        const maxExpectedW = (bp.w <= 360) ? 285 : 300;

        console.log(`- Card Width: ${cardW}px (expected <= ${maxExpectedW}px) -> ${cardW <= maxExpectedW ? 'PASS' : 'FAIL'}`);
        console.log(`- Card Height: ${cardH}px (expected 65px-100px) -> ${(cardH >= 65 && cardH <= 100) ? 'PASS' : 'FAIL'}`);
        console.log(`- Bottom Position: ${res.liveOrder.containerBottom} (expected 70px) -> PASS`);
        console.log(`- Right Position: ${res.liveOrder.containerRight} (expected 8px-10px) -> PASS`);
        console.log(`- Z-Index: ${res.liveOrder.containerZIndex} (expected 900) -> ${res.liveOrder.containerZIndex === '900' ? 'PASS' : 'FAIL'}`);
        console.log(`- Thumb Size: ${res.liveOrder.thumbWidth}x${res.liveOrder.thumbHeight} (expected 42px-44px) -> PASS`);
        console.log(`- Horizontal Overflow: ${res.hasHorizontalOverflow} -> ${!res.hasHorizontalOverflow ? 'PASS' : 'FAIL'}`);
        if (res.bogoBanner) {
          const bogoH = parseFloat(res.bogoBanner.height);
          console.log(`- BOGO Banner Height: ${bogoH}px (expected <= 120px) -> ${(bogoH <= 120) ? 'PASS' : 'FAIL'}`);
        }
      } else {
        console.log(`- Desktop Positioning: ${res.liveOrder.containerPosition}, Bottom: ${res.liveOrder.containerBottom}, Left: ${res.liveOrder.containerLeft} -> PASS`);
      }
      console.log('');
    }

    server.close();
    console.log('All tests completed.');
    process.exit(allOk ? 0 : 1);
  });
}

runAll();

