const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT_DIR = path.resolve(__dirname, '..');

// Let's create a temporary test page that loads homepage.html styles and a mock product grid
// and evaluates computed styles at desktop (1440px) and mobile (390px)
const testHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="stylesheet" href="../css/auth.css">
  <link rel="stylesheet" href="../css/premium-3d.css">
  <link rel="stylesheet" href="../css/mobile-app.css">
  <link rel="stylesheet" href="../css/order-activity.css">
  <link rel="stylesheet" href="../css/promotions.css">
</head>
<body>
  <div class="container">
    <div id="trending-grid" class="products-grid products-grid-5col">
      <div class="product-card" id="test-card-1">
        <div class="product-card-media">
          <img class="product-card-img" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1200'></svg>">
        </div>
        <div class="product-card-body">
          <h4 class="product-card-name">Test Product 1</h4>
          <div class="product-card-price-row"><span class="price-current">₹2,499</span></div>
        </div>
      </div>
      <div class="product-card"><div class="product-card-media"><img class="product-card-img" src=""></div></div>
      <div class="product-card"><div class="product-card-media"><img class="product-card-img" src=""></div></div>
      <div class="product-card"><div class="product-card-media"><img class="product-card-img" src=""></div></div>
      <div class="product-card"><div class="product-card-media"><img class="product-card-img" src=""></div></div>
    </div>
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      const container = document.querySelector('.container');
      const grid = document.querySelector('#trending-grid');
      const card = document.querySelector('#test-card-1');
      const media = document.querySelector('.product-card-media');
      const img = document.querySelector('.product-card-img');
      
      const res = {
        viewportWidth: window.innerWidth,
        container: {
          width: getComputedStyle(container).width,
          maxWidth: getComputedStyle(container).maxWidth,
          marginLeft: getComputedStyle(container).marginLeft,
          marginRight: getComputedStyle(container).marginRight
        },
        grid: {
          display: getComputedStyle(grid).display,
          gridTemplateColumns: getComputedStyle(grid).gridTemplateColumns,
          gap: getComputedStyle(grid).gap,
          width: getComputedStyle(grid).width
        },
        card: {
          width: getComputedStyle(card).width,
          height: getComputedStyle(card).height
        },
        media: {
          width: getComputedStyle(media).width,
          height: getComputedStyle(media).height,
          aspectRatio: getComputedStyle(media).aspectRatio
        },
        img: {
          width: getComputedStyle(img).width,
          height: getComputedStyle(img).height,
          objectFit: getComputedStyle(img).objectFit
        }
      };
      const out = document.createElement('pre');
      out.id = 'computed-output';
      out.textContent = JSON.stringify(res, null, 2);
      document.body.appendChild(out);
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT_DIR, 'scratch', 'test-viewport.html'), testHtml);

function runViewport(width, height) {
  return new Promise((resolve) => {
    const fileUrl = 'file:///' + path.join(ROOT_DIR, 'scratch', 'test-viewport.html').replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      '--dump-dom',
      '--virtual-time-budget=1000',
      fileUrl
    ];
    execFile(EDGE_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('Failed:', err);
        return resolve(null);
      }
      const match = stdout.match(/<pre id="computed-output">([\s\S]*?)<\/pre>/);
      if (match) {
        resolve(JSON.parse(match[1]));
      } else {
        console.log('No pre found in stdout');
        resolve(null);
      }
    });
  });
}

async function main() {
  console.log('--- Current Unfixed State at Desktop 1440x900 ---');
  const desk = await runViewport(1440, 900);
  console.log(JSON.stringify(desk, null, 2));

  console.log('--- Current Unfixed State at Mobile 390x844 ---');
  const mob = await runViewport(390, 844);
  console.log(JSON.stringify(mob, null, 2));
}

main();

