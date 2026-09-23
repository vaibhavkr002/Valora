/**
 * Test multi-tier product extractor:
 * 1. JSON-LD
 * 2. OpenGraph
 * 3. HTML meta & content
 * 4. Image URL lists & Meesho CDN patterns
 */

function extractProductFromHtml(html, sourceUrl) {
  if (!html || typeof html !== 'string') {
    return { success: false, error: 'Empty response' };
  }

  // Check for Akamai / Cloudflare / Access Denied
  if (
    html.includes('<TITLE>Access Denied</TITLE>') ||
    html.includes('errors.edgesuite.net') ||
    html.includes('Attention Required! | Cloudflare') ||
    html.includes('Just a moment...')
  ) {
    return {
      success: false,
      blocked: true,
      error: 'Could not fetch product data automatically (source blocked automated access).'
    };
  }

  let name = null;
  let description = null;
  let price = null;
  let original_price = null;
  let images = [];
  let sizes = [];
  let colors = [];
  let stock = null;
  let brand = null;
  let currency = 'INR';

  // 1. Try JSON-LD
  const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const item of items) {
        if (item['@type'] === 'Product' || item.name) {
          if (!name && item.name) name = item.name.trim();
          if (!description && item.description) description = item.description.trim();
          if (item.image) {
            const rawImgs = Array.isArray(item.image) ? item.image : [item.image];
            rawImgs.forEach(img => {
              const url = typeof img === 'string' ? img : img.url || img.contentUrl;
              if (url && !images.includes(url)) images.push(url);
            });
          }
          if (item.brand) {
            brand = typeof item.brand === 'string' ? item.brand : item.brand.name;
          }
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            const firstOffer = offers[0];
            if (firstOffer) {
              if (firstOffer.price) price = parseFloat(firstOffer.price);
              if (firstOffer.priceCurrency) currency = firstOffer.priceCurrency;
              if (firstOffer.priceSpecification?.price) {
                original_price = parseFloat(firstOffer.priceSpecification.price);
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  // 2. Try OpenGraph
  if (!name) {
    const ogTitle = html.match(/<meta\s+[^>]*property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                    html.match(/<meta\s+[^>]*name=["']twitter:title["']\s+content=["'](.*?)["']/i);
    if (ogTitle) name = ogTitle[1].trim();
  }
  if (!description) {
    const ogDesc = html.match(/<meta\s+[^>]*property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                   html.match(/<meta\s+[^>]*name=["']description["']\s+content=["'](.*?)["']/i);
    if (ogDesc) description = ogDesc[1].trim();
  }
  if (images.length === 0) {
    const ogImages = html.matchAll(/<meta\s+[^>]*property=["']og:image(?::secure_url)?["']\s+content=["'](.*?)["']/gi);
    for (const m of ogImages) {
      if (m[1] && !images.includes(m[1])) images.push(m[1]);
    }
  }
  if (price === null) {
    const ogPrice = html.match(/<meta\s+[^>]*property=["']product:price:amount["']\s+content=["'](.*?)["']/i);
    if (ogPrice) price = parseFloat(ogPrice[1]);
  }

  // 3. Try <title> as fallback for name
  if (!name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      name = titleMatch[1].replace(/[-|•].*$/, '').trim();
    }
  }

  // 4. Upgrade any Meesho images to high-res master assets
  images = images.map(img => {
    if (img.includes('images.meesho.com')) {
      return img.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
    }
    return img;
  });

  return {
    success: Boolean(name || images.length > 0 || price !== null),
    name,
    description,
    price,
    original_price,
    images,
    sizes,
    colors,
    brand,
    source_url: sourceUrl
  };
}

// Test with mock JSON-LD HTML
const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Trendy Men Oversized Cotton Graphic T-Shirt - Buy Online</title>
  <meta property="og:title" content="Trendy Men Oversized Cotton Graphic T-Shirt" />
  <meta property="og:description" content="100% premium bio-washed cotton oversized t-shirt for Delhi streetwear aesthetic." />
  <meta property="og:image" content="https://images.meesho.com/images/products/1084290722/ylpxd_512.avif" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Trendy Men Oversized Cotton Graphic T-Shirt",
    "image": [
      "https://images.meesho.com/images/products/1084290722/ylpxd_512.avif",
      "https://images.meesho.com/images/products/1084290722/2_512.avif"
    ],
    "description": "100% premium bio-washed cotton oversized t-shirt for Delhi streetwear aesthetic.",
    "brand": { "@type": "Brand", "name": "Sarojini Bazaar" },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": "349",
      "priceSpecification": {
        "price": "899"
      }
    }
  }
  </script>
</head>
<body></body>
</html>
`;

const result = extractProductFromHtml(sampleHtml, 'https://www.meesho.com/sample/p/123');
console.log('Extraction Result:', JSON.stringify(result, null, 2));

// Test blocked response
const blockedResult = extractProductFromHtml('<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD></HTML>', 'https://www.meesho.com/sample/p/123');
console.log('\nBlocked Result:', JSON.stringify(blockedResult, null, 2));

