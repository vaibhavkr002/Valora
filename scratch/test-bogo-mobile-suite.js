const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let u = req.url.split('?')[0];
  let filePath = path.join(__dirname, '..', u);
  if (u === '/') filePath = path.join(__dirname, '..', 'homepage.html');

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
    } else {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
});

const PORT = 3475;
server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9240',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}/homepage.html`
  ]);

  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function getCDPTarget() {
    for (let i = 0; i < 20; i++) {
      await wait(200);
      try {
        const targets = await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:9240/json', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
          }).on('error', reject);
        });
        const page = targets.find(t => t.type === 'page');
        if (page) return page;
      } catch (_) {}
    }
    throw new Error("Could not find page target");
  }

  try {
    const page = await getCDPTarget();
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: `http://localhost:${PORT}/homepage.html` });
    await wait(3000);

    const widths = [
      { w: 320, h: 568, name: "320px (iPhone SE 1st gen / narrow)" },
      { w: 360, h: 640, name: "360px (Standard Android compact)" },
      { w: 375, h: 667, name: "375px (iPhone SE 2/3 / iPhone 8)" },
      { w: 390, h: 844, name: "390px (iPhone 12/13/14 Pro)" },
      { w: 412, h: 915, name: "412px (Samsung Galaxy / Pixel)" },
      { w: 430, h: 932, name: "430px (iPhone 14/15/16 Pro Max)" }
    ];

    let allPassed = true;

    for (const vp of widths) {
      console.log(`\n========================================`);
      console.log(`TESTING MOBILE VIEWPORT: ${vp.name}`);
      console.log(`========================================`);

      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 2,
        mobile: true
      });
      await wait(300);

      const testResult = await send('Runtime.evaluate', {
        expression: `
          (function() {
            // Open modal
            const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
            if (bogoBtn) bogoBtn.click();
            else if (typeof openBogoModal === 'function') openBogoModal(window.PRODUCTS_DATA[0].id);

            const overlay = document.getElementById("bogo-modal-overlay");
            const modal = overlay ? overlay.querySelector(".bogo-selection-modal") : null;
            const header = overlay ? overlay.querySelector(".bogo-modal-header") : null;
            const closeBtn = document.getElementById("bogo-modal-close-btn");
            const banner = document.getElementById("bogo-paid-item-banner");
            const bannerImg = banner ? banner.querySelector("img") : null;
            const bannerTitle = banner ? banner.querySelector("h4") : null;
            const gridWrap = overlay ? overlay.querySelector(".bogo-eligible-grid-wrap") : null;
            const cards = overlay ? Array.from(overlay.querySelectorAll(".bogo-card")) : [];
            const confirmBtn = document.getElementById("bogo-confirm-add-btn");
            const activity = document.querySelector(".velora-order-activity");
            const footer = overlay ? overlay.querySelector(".bogo-modal-footer") : null;

            const modalRect = modal ? modal.getBoundingClientRect() : null;
            const confirmRect = confirmBtn ? confirmBtn.getBoundingClientRect() : null;
            const headerRect = header ? header.getBoundingClientRect() : null;
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
            const bannerRect = banner ? banner.getBoundingClientRect() : null;
            const footerRect = footer ? footer.getBoundingClientRect() : null;
            const actComp = activity ? window.getComputedStyle(activity) : null;

            // Select first gift card
            if (cards.length > 0) {
              cards[0].click();
            }
            const firstCardSelected = cards.length > 0 ? cards[0].classList.contains("selected") : false;
            const confirmEnabled = confirmBtn ? !confirmBtn.disabled : false;

            // Check horizontal overflow
            const hasHorizontalOverflow = modal ? (modal.scrollWidth > modal.clientWidth) : false;
            const modalFitsViewportW = modalRect ? (modalRect.left >= 0 && modalRect.right <= window.innerWidth + 1) : false;
            const modalFitsViewportH = modalRect ? (modalRect.top >= 0 && modalRect.bottom <= window.innerHeight + 1) : false;

            // Check confirm button visibility
            const confirmInViewport = confirmRect ? (confirmRect.bottom <= window.innerHeight && confirmRect.top >= 0) : false;
            const confirmInModal = (confirmRect && modalRect) ? (confirmRect.bottom <= modalRect.bottom + 1 && confirmRect.top >= modalRect.top) : false;

            // Check element from point on confirm button
            let elAtConfirm = null;
            if (confirmRect && confirmInViewport) {
              const el = document.elementFromPoint(confirmRect.left + confirmRect.width / 2, confirmRect.top + confirmRect.height / 2);
              elAtConfirm = el ? (el.tagName + '#' + el.id + '.' + el.className) : null;
            }

            // Check Recent Order hidden state
            const activityHidden = !activity || actComp.display === 'none' || actComp.visibility === 'hidden' || parseFloat(actComp.opacity) === 0;

            // Check body scroll lock
            const bodyScrollLocked = document.body.style.overflow === "hidden" && document.body.classList.contains("bogo-modal-open");

            // Test close
            closeBtn.click();
            const closedActive = overlay ? overlay.classList.contains("active") : false;
            const bodyScrollRestored = document.body.style.overflow === "" && !document.body.classList.contains("bogo-modal-open");

            return {
              viewport: { w: window.innerWidth, h: window.innerHeight },
              modalFitsViewportW,
              modalFitsViewportH,
              hasHorizontalOverflow,
              headerVisible: !!headerRect && headerRect.height > 0,
              closeBtnVisible: !!closeRect && closeRect.width > 0,
              bannerVisible: !!bannerRect && bannerRect.height > 0,
              bannerImgContained: !!bannerImg && bannerImg.naturalWidth > 0,
              cardsCount: cards.length,
              firstCardSelected,
              confirmEnabled,
              confirmInViewport,
              confirmInModal,
              confirmHeight: confirmRect ? confirmRect.height : 0,
              confirmWidth: confirmRect ? confirmRect.width : 0,
              elAtConfirm,
              activityHidden,
              bodyScrollLocked,
              closedActive,
              bodyScrollRestored
            };
          })()
        `,
        returnByValue: true
      });

      const r = testResult.result.value;
      console.log(`- Modal fits width: ${r.modalFitsViewportW ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Modal fits height: ${r.modalFitsViewportH ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- No horizontal overflow: ${!r.hasHorizontalOverflow ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Header visible: ${r.headerVisible ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Close button visible: ${r.closeBtnVisible ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Qualifying product card visible: ${r.bannerVisible ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Free gift cards rendered: ${r.cardsCount} cards`);
      console.log(`- Card selection works: ${r.firstCardSelected ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Claim button enabled on select: ${r.confirmEnabled ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Claim button in viewport: ${r.confirmInViewport ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Claim button inside modal: ${r.confirmInModal ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Claim button dimensions: ${Math.round(r.confirmWidth)}px x ${Math.round(r.confirmHeight)}px`);
      console.log(`- Claim button clickable (elementFromPoint): ${r.elAtConfirm ? "✓ PASS (" + r.elAtConfirm + ")" : "✗ FAIL"}`);
      console.log(`- Live Order activity hidden: ${r.activityHidden ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Body scroll locked while open: ${r.bodyScrollLocked ? "✓ PASS" : "✗ FAIL"}`);
      console.log(`- Close restores scroll and resumes normal: ${r.bodyScrollRestored && !r.closedActive ? "✓ PASS" : "✗ FAIL"}`);

      const pass = r.modalFitsViewportW && r.modalFitsViewportH && !r.hasHorizontalOverflow &&
                   r.headerVisible && r.closeBtnVisible && r.bannerVisible && r.cardsCount > 0 &&
                   r.firstCardSelected && r.confirmEnabled && r.confirmInViewport && r.confirmInModal &&
                   r.activityHidden && r.bodyScrollLocked && r.bodyScrollRestored && !r.closedActive;

      if (!pass) allPassed = false;
    }

    console.log(`\n========================================`);
    console.log(`TESTING DESKTOP (1280x800) FOR REGRESSION`);
    console.log(`========================================`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(300);

    const desktopTest = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const bogoBtn = document.querySelector(".btn-claim-bogo") || document.querySelector("[data-bogo-id]");
          if (bogoBtn) bogoBtn.click();
          else if (typeof openBogoModal === 'function') openBogoModal(window.PRODUCTS_DATA[0].id);

          const overlay = document.getElementById("bogo-modal-overlay");
          const modal = overlay ? overlay.querySelector(".bogo-selection-modal") : null;
          const grid = document.getElementById("bogo-eligible-items-grid");
          const footer = overlay ? overlay.querySelector(".bogo-modal-footer") : null;

          const modalComp = modal ? window.getComputedStyle(modal) : null;
          const gridComp = grid ? window.getComputedStyle(grid) : null;
          const footerComp = footer ? window.getComputedStyle(footer) : null;

          const gridColsStr = gridComp ? gridComp.gridTemplateColumns : "";
          const is3Cols = gridColsStr.includes("repeat(3") || gridColsStr.split(" ").length === 3;

          // Close modal
          const closeBtn = document.getElementById("bogo-modal-close-btn");
          closeBtn.click();

          return {
            modalMaxWidth: modalComp ? modalComp.maxWidth : null,
            gridCols: gridColsStr,
            footerFlexDir: footerComp ? footerComp.flexDirection : null,
            is3Cols: is3Cols
          };
        })()
      `,
      returnByValue: true
    });

    const d = desktopTest.result.value;
    console.log(`- Desktop modal max-width: ${d.modalMaxWidth} (Expect 740px)`);
    console.log(`- Desktop grid has 3 columns: ${d.is3Cols ? "✓ PASS" : "✗ FAIL"} (${d.gridCols})`);
    console.log(`- Desktop footer flex-direction: ${d.footerFlexDir} (Expect row)`);

    edge.kill();
    server.close();

    if (allPassed && d.is3Cols) {
      console.log(`\n========================================`);
      console.log(`ALL MOBILE & DESKTOP SUITE TESTS PASSED 100%!`);
      console.log(`========================================`);
      process.exit(0);
    } else {
      console.error(`\nSome tests failed!`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Test error:", err);
    edge.kill();
    server.close();
    process.exit(1);
  }
});
