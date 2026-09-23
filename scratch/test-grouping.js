// Test grouping of multiple image URLs by product ID / supplier code
function groupUrls(lines) {
  const products = [];
  const codeToProduct = new Map();

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Check if line contains pipe or semicolon separated images
    const parts = line.split(/[|;]+/).map(p => p.trim()).filter(Boolean);

    for (let url of parts) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Check if it's a Meesho image URL with a product ID
      const meeshoImgMatch = url.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
      const sCode = meeshoImgMatch ? `S-${meeshoImgMatch[1]}` : null;

      let highRes = url.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');

      if (sCode && codeToProduct.has(sCode)) {
        // Add to existing product gallery!
        const existing = codeToProduct.get(sCode);
        if (!existing.images.includes(highRes)) {
          existing.images.push(highRes);
        }
      } else {
        const item = {
          source_url: url,
          detected_code: sCode,
          images: [highRes],
          isImage: true
        };
        if (sCode) codeToProduct.set(sCode, item);
        products.push(item);
      }
    }
  }

  return products;
}

const sampleLines = [
  'https://images.meesho.com/images/products/1084290722/ylpxd_512.avif',
  'https://images.meesho.com/images/products/1084290722/2_512.avif',
  'https://images.meesho.com/images/products/1084290722/3_512.avif',
  'https://images.meesho.com/images/products/990006640/8nyjx_512.avif|https://images.meesho.com/images/products/990006640/2_512.avif'
];

const grouped = groupUrls(sampleLines);
console.log('Grouped products count:', grouped.length);
grouped.forEach((p, idx) => {
  console.log(`Product ${idx + 1}: Code=${p.detected_code}, Images (${p.images.length})=`, p.images);
});

