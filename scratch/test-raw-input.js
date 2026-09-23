/**
 * Test end-to-end extraction and fallback logic
 */

async function processRawUrlInput(rawLines, categories = []) {
  const staged = [];
  const codeToProductIndex = new Map();

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Check if line contains pipe/semicolon separated image URLs
    const parts = line.split(/[|;]+/).map(p => p.trim()).filter(Boolean);
    const isMultiImageLine = parts.length > 1;
    const isDirectImage = parts.every(p => /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(p) || p.includes('images.meesho.com/images/products/'));

    if (isDirectImage) {
      // 1. DIRECT IMAGE URL(S)
      const highResImgs = parts.map(u => {
        let clean = u;
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) clean = 'https://' + clean;
        return clean.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
      });

      // Check if any image has Meesho S-code
      let sCode = null;
      for (const img of highResImgs) {
        const m = img.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
        if (m) {
          sCode = `S-${m[1]}`;
          break;
        }
      }

      // If we already have a product with this S-code in current batch, append images!
      if (sCode && codeToProductIndex.has(sCode)) {
        const existingIdx = codeToProductIndex.get(sCode);
        highResImgs.forEach(img => {
          if (!staged[existingIdx].images.includes(img)) {
            staged[existingIdx].images.push(img);
          }
        });
        continue;
      }

      const prodName = sCode ? `Sarojini Street Find ${sCode}` : `Sarojini Bazaar Item ${staged.length + 1}`;
      const item = {
        id: 'stg-' + Date.now() + '-' + staged.length,
        source_url: highResImgs[0],
        name: prodName,
        title_source: sCode ? 'code' : 'default',
        description: null,
        price: null,
        original_price: null,
        department: 'WOMEN',
        category_id: null,
        images: highResImgs,
        sizes: [],
        colors: [],
        stock: 25,
        stock_source: 'default',
        detected_code: sCode,
        is_direct_image: true,
        fetch_failed: false,
        status: 'Price missing — please enter',
        selected: false // Cannot import without price
      };

      if (sCode) codeToProductIndex.set(sCode, staged.length);
      staged.push(item);

    } else {
      // 2. PRODUCT PAGE URL
      let url = line;
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (_) {
        staged.push({
          id: 'stg-' + Date.now() + '-' + staged.length,
          source_url: url,
          name: `Invalid URL (${url.substring(0, 30)})`,
          is_invalid: true,
          price: null,
          original_price: null,
          images: [],
          sizes: [],
          colors: [],
          description: null,
          status: 'Invalid URL format',
          selected: false
        });
        continue;
      }

      // Check for Meesho slug pattern: /<slug>/p/<id>
      const meeshoMatch = parsedUrl.pathname.match(/^\/([^\/]+)\/p\/([a-z0-9]+)/i);
      let extractedTitle = null;
      if (meeshoMatch) {
        extractedTitle = meeshoMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      } else {
        const segs = parsedUrl.pathname.split('/').filter(Boolean);
        if (segs.length > 0) {
          extractedTitle = segs[segs.length - 1].replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
      }

      // Attempt to fetch page
      let fetchedData = null;
      let blockedOrFailed = false;

      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(3000)
        });

        if (resp.ok) {
          const html = await resp.text();
          if (html.includes('<TITLE>Access Denied</TITLE>') || html.includes('errors.edgesuite.net') || html.includes('Cloudflare')) {
            blockedOrFailed = true;
          } else {
            // Parse JSON-LD or OpenGraph
            fetchedData = parseHtmlMetadata(html, url);
          }
        } else {
          blockedOrFailed = true;
        }
      } catch (_) {
        blockedOrFailed = true;
      }

      if (fetchedData && fetchedData.success) {
        staged.push({
          id: 'stg-' + Date.now() + '-' + staged.length,
          source_url: url,
          name: fetchedData.name || extractedTitle || 'Imported Product',
          title_source: fetchedData.name ? 'fetched' : 'slug',
          description: fetchedData.description || null,
          price: fetchedData.price,
          original_price: fetchedData.original_price,
          department: 'MEN',
          category_id: null,
          images: fetchedData.images || [],
          sizes: fetchedData.sizes || [],
          colors: fetchedData.colors || [],
          stock: 25,
          stock_source: 'default',
          fetch_failed: false,
          status: fetchedData.price && fetchedData.images.length > 0 ? 'Ready' : 'Incomplete data',
          selected: Boolean(fetchedData.price && fetchedData.images.length > 0)
        });
      } else {
        // Blocked / automated fetch failed: NO FAKE PLACEHOLDERS!
        staged.push({
          id: 'stg-' + Date.now() + '-' + staged.length,
          source_url: url,
          name: extractedTitle || 'Sarojini Product',
          title_source: 'slug',
          description: null, // NO FAKE DESCRIPTION
          price: null, // NO FAKE PRICE
          original_price: null, // NO FAKE MRP
          department: 'WOMEN',
          category_id: null,
          images: [], // NO FAKE PLACEHOLDER IMAGE
          sizes: [], // NO FAKE SIZES
          colors: [],
          stock: 25,
          stock_source: 'default',
          fetch_failed: true,
          fetch_error: 'Could not fetch product data automatically (source blocked automated access). Use CSV / direct image fallback.',
          status: 'Could not fetch product data automatically',
          selected: false // Cannot import without price and images
        });
      }
    }
  }

  return staged;
}

function parseHtmlMetadata(html, url) {
  // basic stub for testing
  return { success: false };
}

async function run() {
  const lines = [
    'https://www.meesho.com/men-oversized-cotton-t-shirt/p/6n3h2k',
    'https://images.meesho.com/images/products/1084290722/ylpxd_512.avif',
    'https://images.meesho.com/images/products/1084290722/2_512.avif',
    'invalid-url-example'
  ];

  console.log('Processing input lines...');
  const result = await processRawUrlInput(lines);
  console.log('Result count:', result.length);
  console.log(JSON.stringify(result, null, 2));
}

run();

