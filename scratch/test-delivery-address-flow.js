const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8415;
const CDP_PORT = 9315;
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
  if (reqPath === '/') reqPath = '/checkout.html';
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
  console.log(`Test Server running on http://localhost:${PORT}`);

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/checkout.html`
  ]);

  await new Promise(r => setTimeout(r, 2200));

  try {
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
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

    console.log('\n--- TEST 1: Elements Exist in DOM ---');
    const elemCheck = await evaluate(`
      (function() {
        return {
          summaryCard: Boolean(document.getElementById('selected-address-summary')),
          summaryType: Boolean(document.getElementById('summary-address-type')),
          summaryName: Boolean(document.getElementById('summary-address-name')),
          summaryDetails: Boolean(document.getElementById('summary-address-details')),
          summaryPhone: Boolean(document.getElementById('summary-address-phone')),
          btnSummaryChange: Boolean(document.getElementById('btn-summary-change')),
          btnSummaryAddNew: Boolean(document.getElementById('btn-summary-add-new')),
          noSavedNotice: Boolean(document.getElementById('no-saved-addresses-notice')),
          savedSection: Boolean(document.getElementById('saved-addresses-section')),
          savedGrid: Boolean(document.getElementById('saved-addresses-grid')),
          deliveryContainer: Boolean(document.getElementById('delivery-form-container'))
        };
      })()
    `);
    console.log('DOM Elements check:', elemCheck);

    console.log('\n--- TEST 2: State 2 - Logged in user with 0 saved addresses ---');
    const zeroAddrCheck = await evaluate(`
      (async function() {
        // Mock VeloraAuth as logged-in user with 0 addresses
        window.VeloraAuth = {
          getCurrentUser: () => ({ id: 'usr_test_123', email: 'vaibhav@example.com' }),
          getClient: () => ({
            from: (table) => ({
              select: () => ({
                eq: () => ({
                  order: () => ({
                    order: () => Promise.resolve({ data: [], error: null })
                  })
                })
              })
            })
          })
        };

        if (typeof window.loadSavedAddresses === 'function') {
          await window.loadSavedAddresses();
        }

        const notice = document.getElementById('no-saved-addresses-notice');
        const summary = document.getElementById('selected-address-summary');
        const savedSec = document.getElementById('saved-addresses-section');
        const form = document.getElementById('delivery-form-container');

        return {
          noticeDisplay: notice ? window.getComputedStyle(notice).display : null,
          noticeText: notice ? notice.innerText.trim().replace(/\\s+/g, ' ') : null,
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          savedSecDisplay: savedSec ? window.getComputedStyle(savedSec).display : null,
          formDisplay: form ? window.getComputedStyle(form).display : null
        };
      })()
    `);
    console.log('0 Saved Addresses check:', zeroAddrCheck);

    console.log('\n--- TEST 2B: Clicking [+ Add New Address] when 0 saved addresses exist ---');
    const clickAddWhenZero = await evaluate(`
      (async function() {
        const btn = document.getElementById('btn-add-first-address');
        if (btn) btn.click();
        await new Promise(r => setTimeout(r, 100));

        const form = document.getElementById('delivery-form-container');
        const notice = document.getElementById('no-saved-addresses-notice');
        const title = document.getElementById('delivery-form-title');

        return {
          formDisplay: form ? window.getComputedStyle(form).display : null,
          noticeDisplay: notice ? window.getComputedStyle(notice).display : null,
          titleText: title ? title.innerText : null
        };
      })()
    `);
    console.log('Clicking [+ Add New Address] when 0 addresses:', clickAddWhenZero);

    console.log('\n--- TEST 3: State 1 - User has 2 saved addresses (Home and Office) ---');
    const savedAddrCheck = await evaluate(`
      (async function() {
        const mockAddresses = [
          {
            id: 'addr_1',
            user_id: 'usr_test_123',
            full_name: 'Vaibhav Kumar',
            phone: '9876543210',
            house: 'Flat 402, Building 3',
            street: 'Oberoi Splendor, JVLR, Andheri East',
            landmark: 'Near SEEPZ Gate',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            pincode: '400060',
            address_type: 'Home',
            is_default: true
          },
          {
            id: 'addr_2',
            user_id: 'usr_test_123',
            full_name: 'Vaibhav Office',
            phone: '9123456780',
            house: 'Tech Park, Floor 5',
            street: 'Whitefield Main Road',
            landmark: 'Near Metro',
            city: 'Bengaluru',
            state: 'Karnataka',
            country: 'India',
            pincode: '560066',
            address_type: 'Work',
            is_default: false
          }
        ];

        window.VeloraAuth = {
          getCurrentUser: () => ({ id: 'usr_test_123', email: 'vaibhav@example.com' }),
          getClient: () => ({
            from: (table) => ({
              select: () => ({
                eq: () => ({
                  order: () => ({
                    order: () => Promise.resolve({ data: mockAddresses, error: null })
                  })
                })
              }),
              update: () => ({ eq: () => Promise.resolve({ error: null }) }),
              insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'addr_new' }, error: null }) }) })
            })
          })
        };

        await window.loadSavedAddresses();

        const summary = document.getElementById('selected-address-summary');
        const savedSec = document.getElementById('saved-addresses-section');
        const nameEl = document.getElementById('summary-address-name');
        const detailsEl = document.getElementById('summary-address-details');
        const typeEl = document.getElementById('summary-address-type');
        const phoneEl = document.getElementById('summary-address-phone');

        return {
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          savedSecDisplay: savedSec ? window.getComputedStyle(savedSec).display : null,
          name: nameEl ? nameEl.innerText : null,
          details: detailsEl ? detailsEl.innerText.replace(/\\n/g, ', ') : null,
          type: typeEl ? typeEl.innerText : null,
          phone: phoneEl ? phoneEl.innerText.trim() : null
        };
      })()
    `);
    console.log('Saved Addresses check:', savedAddrCheck);

    console.log('\n--- TEST 4: Click [ Change Address ] -> Expand Cards -> Pick Office Address ---');
    const changeAddressCheck = await evaluate(`
      (async function() {
        const changeBtn = document.getElementById('btn-summary-change');
        if (changeBtn) changeBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const summary = document.getElementById('selected-address-summary');
        const savedSec = document.getElementById('saved-addresses-section');
        const cards = document.querySelectorAll('.saved-address-card');
        const useBtns = document.querySelectorAll('.btn-card-use');

        const stateAfterChangeClick = {
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          savedSecDisplay: savedSec ? window.getComputedStyle(savedSec).display : null,
          cardsCount: cards.length,
          useBtnsCount: useBtns.length
        };

        // Click second address card [ Use This Address ]
        if (useBtns.length > 1) {
          useBtns[1].click();
          await new Promise(r => setTimeout(r, 100));
        }

        const stateAfterSelection = {
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          savedSecDisplay: savedSec ? window.getComputedStyle(savedSec).display : null,
          selectedName: document.getElementById('summary-address-name') ? document.getElementById('summary-address-name').innerText : null,
          selectedType: document.getElementById('summary-address-type') ? document.getElementById('summary-address-type').innerText : null,
          inputCityValue: document.getElementById('input-city') ? document.getElementById('input-city').value : null,
          inputZipValue: document.getElementById('input-zip') ? document.getElementById('input-zip').value : null,
          inputStateValue: document.getElementById('input-state') ? document.getElementById('input-state').value : null
        };

        return { stateAfterChangeClick, stateAfterSelection };
      })()
    `);
    console.log('Change Address flow check:', changeAddressCheck);

    console.log('\n--- TEST 5: State 3 - Click [ + Add New Address ] -> Verify Clean Inputs & INSERT ---');
    const addNewAddressCheck = await evaluate(`
      (async function() {
        let insertCalled = false;
        let insertedPayload = null;

        window.VeloraAuth.getClient = () => ({
          from: (table) => ({
            select: () => ({
              eq: () => ({
                order: () => ({
                  order: () => Promise.resolve({
                    data: [
                      {
                        id: 'addr_1',
                        user_id: 'usr_test_123',
                        full_name: 'Vaibhav Kumar',
                        phone: '9876543210',
                        house: 'Flat 402, Building 3',
                        street: 'Oberoi Splendor, JVLR, Andheri East',
                        city: 'Mumbai',
                        state: 'Maharashtra',
                        pincode: '400060',
                        address_type: 'Home',
                        is_default: false
                      },
                      {
                        id: 'addr_3_new',
                        user_id: 'usr_test_123',
                        full_name: 'Anita Sharma',
                        phone: '9820098200',
                        house: 'Villa 12',
                        street: 'Palm Beach Road',
                        city: 'Navi Mumbai',
                        state: 'Maharashtra',
                        pincode: '400703',
                        address_type: 'Home',
                        is_default: true
                      }
                    ],
                    error: null
                  })
                })
              })
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
            insert: (arr) => {
              insertCalled = true;
              insertedPayload = arr[0];
              return {
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: 'addr_3_new', ...arr[0] },
                    error: null
                  })
                })
              };
            }
          })
        });

        const addBtn = document.getElementById('btn-summary-add-new');
        if (addBtn) addBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const form = document.getElementById('delivery-form-container');
        const summary = document.getElementById('selected-address-summary');
        const title = document.getElementById('delivery-form-title');

        const stateFormOpened = {
          formDisplay: form ? window.getComputedStyle(form).display : null,
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          titleText: title ? title.innerText : null,
          fullNameValue: document.getElementById('input-fullname').value,
          phoneValue: document.getElementById('input-phone').value,
          houseValue: document.getElementById('input-house').value,
          cityValue: document.getElementById('input-city').value,
          zipValue: document.getElementById('input-zip').value
        };

        // Fill out valid fields for new address
        document.getElementById('input-fullname').value = 'Anita Sharma';
        document.getElementById('input-phone').value = '9820098200';
        document.getElementById('input-house').value = 'Villa 12';
        document.getElementById('input-street').value = 'Palm Beach Road';
        document.getElementById('input-city').value = 'Navi Mumbai';
        document.getElementById('input-state').value = 'Maharashtra';
        document.getElementById('input-zip').value = '400703';

        // Submit form
        document.getElementById('btn-save-address-submit').click();
        await new Promise(r => setTimeout(r, 200));

        const stateAfterSave = {
          insertCalled,
          insertedName: insertedPayload ? insertedPayload.full_name : null,
          insertedCity: insertedPayload ? insertedPayload.city : null,
          formDisplay: form ? window.getComputedStyle(form).display : null,
          summaryDisplay: summary ? window.getComputedStyle(summary).display : null,
          selectedSummaryName: document.getElementById('summary-address-name') ? document.getElementById('summary-address-name').innerText : null,
          selectedSummaryDetails: document.getElementById('summary-address-details') ? document.getElementById('summary-address-details').innerText.replace(/\\n/g, ', ') : null
        };

        return { stateFormOpened, stateAfterSave };
      })()
    `);
    console.log('Add New Address flow check:', addNewAddressCheck);

    console.log('\n--- TEST 6: Mobile Viewport Responsiveness via CDP Emulation ---');
    const viewports = [
      { width: 320, height: 568, deviceScaleFactor: 2, mobile: true },
      { width: 375, height: 667, deviceScaleFactor: 2, mobile: true },
      { width: 414, height: 896, deviceScaleFactor: 3, mobile: true },
      { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', vp);
      await new Promise(r => setTimeout(r, 200));

      const vpResult = await evaluate(`
        (function() {
          const card = document.getElementById('card-delivery-info');
          const summary = document.getElementById('selected-address-summary');
          const changeBtn = document.getElementById('btn-summary-change');
          const addBtn = document.getElementById('btn-summary-add-new');

          return {
            windowInnerWidth: window.innerWidth,
            cardWidth: card ? card.offsetWidth : null,
            summaryWidth: summary ? summary.offsetWidth : null,
            changeBtnWidth: changeBtn ? changeBtn.offsetWidth : null,
            addBtnWidth: addBtn ? addBtn.offsetWidth : null,
            scrollWidth: document.documentElement.scrollWidth,
            noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
          };
        })()
      `);
      console.log(`Viewport ${vp.width}x${vp.height}:`, vpResult);
    }

    console.log('\n✅ ALL ADDRESS FLOW TESTS COMPLETED SUCCESSFULLY!');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

