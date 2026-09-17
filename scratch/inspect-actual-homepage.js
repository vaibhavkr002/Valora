const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

// Let's create a wrapper that loads homepage.html, waits for products to render, and dumps computed styles
const originalHtml = fs.readFileSync(path.join(ROOT_DIR, 'homepage.html'), 'utf8');

const injection = `
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const container = document.querySelector('.container');
    const trendingGrid = document.querySelector('#trending-grid');
    const firstCard = trendingGrid ? trendingGrid.querySelector('.product-card') : null;
    const media = firstCard ? firstCard.querySelector('.product-card-media') : null;
    const img = firstCard ? firstCard.querySelector('.product-card-img') : null;
    
    const info = {
      windowWidth: window.innerWidth,
      container: container ? {
        width: getComputedStyle(container).width,
        maxWidth: getComputedStyle(container).maxWidth,
        marginLeft: getComputedStyle(container).marginLeft,
        marginRight: getComputedStyle(container).marginRight
      } : null,
      trendingGrid: trendingGrid ? {
        display: getComputedStyle(trendingGrid).display,
        gridTemplateColumns: getComputedStyle(trendingGrid).gridTemplateColumns,
        gap: getComputedStyle(trendingGrid).gap,
        width: getComputedStyle(trendingGrid).width,
        childCount: trendingGrid.children.length
      } : null,
      firstCard: firstCard ? {
        width: getComputedStyle(firstCard).width,
        height: getComputedStyle(firstCard).height,
        display: getComputedStyle(firstCard).display,
        flexDirection: getComputedStyle(firstCard).flexDirection
      } : null,
      media: media ? {
        width: getComputedStyle(media).width,
        height: getComputedStyle(media).height,
        aspectRatio: getComputedStyle(media).aspectRatio
      } : null,
      img: img ? {
        width: getComputedStyle(img).width,
        height: getComputedStyle(img).height,
        objectFit: getComputedStyle(img).objectFit
      } : null
    };
    
    const pre = document.createElement('pre');
    pre.id = 'actual-homepage-diagnostics';
    pre.textContent = JSON.stringify(info, null, 2);
    document.body.appendChild(pre);
  }, 2000);
});
</script>
</body>`;

const testHtml = originalHtml.replace('</body>', injection);
fs.writeFileSync(path.join(ROOT_DIR, 'scratch', 'test-actual-homepage.html'), testHtml);

function runViewport(width, height) {
  return new Promise((resolve) => {
    const fileUrl = 'file:///' + path.join(ROOT_DIR, 'scratch', 'test-actual-homepage.html').replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      '--dump-dom',
      '--virtual-time-budget=4000',
      fileUrl
    ];
    execFile(EDGE_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('Error:', err);
        return resolve(null);
      }
      const match = stdout.match(/<pre id="actual-homepage-diagnostics">([\s\S]*?)<\/pre>/);
      if (match) {
        resolve(JSON.parse(match[1]));
      } else {
        console.log('No diagnostics pre tag found');
        resolve(null);
      }
    });
  });
}

async function main() {
  console.log('--- Actual Homepage at Desktop 1440x900 ---');
  const desk = await runViewport(1440, 900);
  console.log(JSON.stringify(desk, null, 2));

  console.log('--- Actual Homepage at Mobile 390x844 ---');
  const mob = await runViewport(390, 844);
  console.log(JSON.stringify(mob, null, 2));
}

main();

