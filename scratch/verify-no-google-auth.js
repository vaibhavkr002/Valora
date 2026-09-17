const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 8415;
const BASE_DIR = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
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
    '--remote-debugging-port=9315',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/login.html`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9315/json');
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

    async function navigate(url) {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1200));
    }

    // 1. Check Login Page
    console.log('\n--- 1. Testing Login Page (login.html) ---');
    const loginData = await evaluate(`
      (function() {
        const text = document.body.innerText;
        const html = document.body.innerHTML;
        const googleBtn = document.getElementById('btn-google-login');
        const divider = document.querySelector('.auth-divider');
        const googleIcons = document.querySelectorAll('.google-icon');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const submitBtn = document.getElementById('btn-login-submit');
        const forgotLink = document.querySelector('.auth-forgot-link');
        const switchLink = document.querySelector('.auth-switch-link');

        return {
          hasGoogleText: text.toLowerCase().includes('google'),
          hasGoogleInHtml: html.includes('btn-google') || html.includes('Continue with Google') || html.includes('Sign up with Google'),
          hasGoogleBtn: Boolean(googleBtn),
          hasDivider: Boolean(divider),
          googleIconsCount: googleIcons.length,
          hasEmailInput: Boolean(emailInput),
          hasPasswordInput: Boolean(passwordInput),
          hasSubmitBtn: Boolean(submitBtn),
          submitBtnText: submitBtn ? submitBtn.innerText.trim() : '',
          hasForgotLink: Boolean(forgotLink),
          hasSwitchLink: Boolean(switchLink),
          switchText: switchLink ? switchLink.innerText.trim() : ''
        };
      })()
    `);
    console.log('Login Page Evaluation:', loginData);

    // 2. Check Signup Page
    console.log('\n--- 2. Testing Signup Page (signup.html) ---');
    await navigate(`http://localhost:${PORT}/signup.html`);
    const signupData = await evaluate(`
      (function() {
        const text = document.body.innerText;
        const html = document.body.innerHTML;
        const googleBtn = document.getElementById('btn-google-signup');
        const divider = document.querySelector('.auth-divider');
        const googleIcons = document.querySelectorAll('.google-icon');
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const phoneInput = document.getElementById('signup-phone');
        const passwordInput = document.getElementById('signup-password');
        const confirmInput = document.getElementById('signup-confirm-password');
        const submitBtn = document.getElementById('btn-signup-submit');
        const switchLink = document.querySelector('.auth-switch-link');

        return {
          hasGoogleText: text.toLowerCase().includes('google'),
          hasGoogleInHtml: html.includes('btn-google') || html.includes('Continue with Google') || html.includes('Sign up with Google'),
          hasGoogleBtn: Boolean(googleBtn),
          hasDivider: Boolean(divider),
          googleIconsCount: googleIcons.length,
          hasNameInput: Boolean(nameInput),
          hasEmailInput: Boolean(emailInput),
          hasPhoneInput: Boolean(phoneInput),
          hasPasswordInput: Boolean(passwordInput),
          hasConfirmInput: Boolean(confirmInput),
          hasSubmitBtn: Boolean(submitBtn),
          submitBtnText: submitBtn ? submitBtn.innerText.trim() : '',
          hasSwitchLink: Boolean(switchLink),
          switchText: switchLink ? switchLink.innerText.trim() : ''
        };
      })()
    `);
    console.log('Signup Page Evaluation:', signupData);

    console.log('\n--- VERIFICATION CHECKS ---');
    console.log('Login: Google button absent:', !loginData.hasGoogleBtn);
    console.log('Login: Divider absent:', !loginData.hasDivider);
    console.log('Login: Google text absent from DOM text:', !loginData.hasGoogleText);
    console.log('Login: Email, Password, Submit, Forgot Password intact:', loginData.hasEmailInput && loginData.hasPasswordInput && loginData.hasSubmitBtn && loginData.hasForgotLink);
    console.log('Signup: Google button absent:', !signupData.hasGoogleBtn);
    console.log('Signup: Divider absent:', !signupData.hasDivider);
    console.log('Signup: Google text absent from DOM text:', !signupData.hasGoogleText);
    console.log('Signup: Name, Email, Password, Confirm, Submit intact:', signupData.hasNameInput && signupData.hasEmailInput && signupData.hasPasswordInput && signupData.hasConfirmInput && signupData.hasSubmitBtn);

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    process.exit(0);
  }
});

