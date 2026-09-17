const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8417;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

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
  if (reqPath === '/') reqPath = '/login.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, async () => {
  console.log(`Verification server running on port ${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9317',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/login.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9317/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page' && (t.url.includes(String(PORT)) || !t.url.startsWith('chrome'))) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const msgId = id++;
        const handler = e => {
          const d = JSON.parse(e.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(d.result && d.result.result ? d.result.result : d.result);
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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 768
      });
      await new Promise(r => setTimeout(r, 400));
    }

    async function navigate(url) {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1200));
    }

    // --- TEST 1: Desktop Login Page (1280px) ---
    console.log('\n=== TEST 1: Desktop Login Page (1280px) ===');
    await setViewport(1280, 800);

    const desktopLoginData = await evaluate(`
      (function() {
        const slot = document.getElementById('auth-3d-ad-slot');
        const card = slot ? slot.querySelector('.auth-3d-card-wrapper') : null;
        const badge = slot ? slot.querySelector('.auth-3d-badge') : null;
        const title = slot ? slot.querySelector('.auth-3d-title') : null;
        const subtitle = slot ? slot.querySelector('.auth-3d-subtitle') : null;
        const cta = slot ? slot.querySelector('.auth-3d-cta') : null;
        const img = slot ? slot.querySelector('.auth-3d-image') : null;
        const dots = slot ? slot.querySelectorAll('.auth-3d-dot') : [];
        const leftPanel = document.querySelector('.auth-visual-col');

        const slotRect = slot ? slot.getBoundingClientRect() : {};
        const cardRect = card ? card.getBoundingClientRect() : {};
        const leftRect = leftPanel ? leftPanel.getBoundingClientRect() : {};

        return {
          slotExists: Boolean(slot),
          slotVisible: slot ? window.getComputedStyle(slot).display !== 'none' : false,
          cardWidth: Math.round(cardRect.width),
          cardHeight: Math.round(cardRect.height),
          leftPanelWidth: Math.round(leftRect.width),
          widthRatio: leftRect.width > 0 ? (cardRect.width / leftRect.width).toFixed(2) : '0',
          badgeText: badge ? badge.innerText.trim() : '',
          titleText: title ? title.innerText.trim() : '',
          subtitleText: subtitle ? subtitle.innerText.trim() : '',
          ctaText: cta ? cta.innerText.trim() : '',
          hasImage: Boolean(img && img.src),
          imageObjectFit: img ? window.getComputedStyle(img).objectFit : '',
          dotsCount: dots.length,
          noGoogleBtn: !document.getElementById('btn-google-login'),
          emailIntact: Boolean(document.getElementById('login-email')),
          passIntact: Boolean(document.getElementById('login-password')),
          submitIntact: Boolean(document.getElementById('btn-login-submit'))
        };
      })()
    `);
    console.log('Desktop Login Result:', desktopLoginData);

    // --- TEST 2: Rotation on Desktop ---
    console.log('\n=== TEST 2: Ad Rotation Verification ===');
    const initialTitle = desktopLoginData.titleText;
    // Trigger slide switch via dot click
    const rotationResult = await evaluate(`
      (function() {
        const dots = document.querySelectorAll('.auth-3d-dot');
        if (dots.length > 1) {
          dots[1].click();
        }
        const activeSlide = document.querySelector('.auth-3d-slide.active');
        const activeTitle = activeSlide ? activeSlide.querySelector('.auth-3d-title') : null;
        return {
          switchedTitle: activeTitle ? activeTitle.innerText.trim() : '',
          activeDotIndex: Array.from(dots).findIndex(d => d.classList.contains('active'))
        };
      })()
    `);
    console.log('Slide Switch Result:', rotationResult);

    // --- TEST 3: Desktop Signup Page (1280px) ---
    console.log('\n=== TEST 3: Desktop Signup Page (1280px) ===');
    await navigate(`http://localhost:${PORT}/signup.html`);
    await setViewport(1280, 850);

    const desktopSignupData = await evaluate(`
      (function() {
        const slot = document.getElementById('auth-3d-ad-slot');
        const card = slot ? slot.querySelector('.auth-3d-card-wrapper') : null;
        const badge = slot ? slot.querySelector('.auth-3d-badge') : null;
        const title = slot ? slot.querySelector('.auth-3d-title') : null;
        const cta = slot ? slot.querySelector('.auth-3d-cta') : null;
        const cardRect = card ? card.getBoundingClientRect() : {};

        return {
          slotExists: Boolean(slot),
          slotVisible: slot ? window.getComputedStyle(slot).display !== 'none' : false,
          cardWidth: Math.round(cardRect.width),
          cardHeight: Math.round(cardRect.height),
          badgeText: badge ? badge.innerText.trim() : '',
          titleText: title ? title.innerText.trim() : '',
          ctaText: cta ? cta.innerText.trim() : '',
          noGoogleBtn: !document.getElementById('btn-google-signup'),
          nameIntact: Boolean(document.getElementById('signup-name')),
          submitIntact: Boolean(document.getElementById('btn-signup-submit'))
        };
      })()
    `);
    console.log('Desktop Signup Result:', desktopSignupData);

    // --- TEST 4: Viewport Safety Across Mobile & Tablet Screens ---
    console.log('\n=== TEST 4: Responsive Viewport Safety Checks ===');
    const viewports = [320, 360, 375, 390, 430, 768, 1024, 1366, 1440];
    for (const w of viewports) {
      await setViewport(w, 750);
      const vpData = await evaluate(`
        (function() {
          const docEl = document.documentElement;
          const body = document.body;
          const leftCol = document.querySelector('.auth-visual-col');
          const slot = document.getElementById('auth-3d-ad-slot');
          const formCol = document.querySelector('.auth-form-col');

          const hasHorizScroll = (docEl.scrollWidth > docEl.clientWidth + 1) || (body.scrollWidth > body.clientWidth + 1);
          const leftColVisible = leftCol ? window.getComputedStyle(leftCol).display !== 'none' : false;

          return {
            hasHorizScroll,
            leftColVisible,
            slotVisible: slot ? window.getComputedStyle(slot).display !== 'none' : false,
            formVisible: formCol ? window.getComputedStyle(formCol).display !== 'none' : false
          };
        })()
      `);
      console.log(`Viewport ${w}px -> HorizScroll: ${vpData.hasHorizScroll}, LeftColVisible: ${vpData.leftColVisible}, FormVisible: ${vpData.formVisible}`);
    }

    // Capture screenshots for visual confirmation
    const resDesktop = await send('Page.captureScreenshot', { format: 'png' });
    if (resDesktop && resDesktop.data) {
      fs.writeFileSync(path.join(BASE_DIR, 'scratch', 'auth-3d-ad-desktop-verified.png'), Buffer.from(resDesktop.data, 'base64'));
      console.log('\nSaved verification screenshot: scratch/auth-3d-ad-desktop-verified.png');
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

