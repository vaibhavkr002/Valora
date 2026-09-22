const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const filePath = "file:///" + path.resolve(__dirname, '..', 'account.html').replace(/\\/g, '/');

console.log("Edge path:", edgePath);
console.log("File path:", filePath);

// Start Edge with remote debugging
const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  filePath
]);

edge.stderr.on('data', d => console.log('Edge stderr:', d.toString()));
edge.stdout.on('data', d => console.log('Edge stdout:', d.toString()));

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await wait(2000);
  console.log("Checking CDP targets...");
  http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Targets:', data);
      edge.kill();
      process.exit(0);
    });
  }).on('error', (err) => {
    console.error('CDP error:', err.message);
    edge.kill();
    process.exit(1);
  });
}

run();

