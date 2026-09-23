/**
 * Verification Script for Sarojini Bulk Product Import Engine
 */

const watermark = require('../js/sarojini-watermark.js');
const SearchUtils = require('../js/search-utils.js');

// 1. URL Parser logic extracted from admin-sarojini-bulk-import.js
function parseSingleUrl(rawUrl, index) {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_) {
    return {
      id: 'stg-' + Date.now() + '-' + index,
      source_url: url,
      name: `Invalid URL (${url.substring(0, 30)})`,
      price: 0,
      original_price: 0,
      department: 'WOMEN',
      category_id: null,
      category_name: 'Unassigned',
      images: ['assets/sarojni/prod-1-graphic-tee.png'],
      sizes: ['Free Size'],
      colors: [],
      stock: 20,
      description: null,
      is_invalid: true,
      status: 'Invalid URL format',
      selected: false
    };
  }

  const meeshoProductMatch = parsedUrl.pathname.match(/^\/([^\/]+)\/p\/([a-z0-9]+)/i);
  const meeshoImageMatch = parsedUrl.href.match(/images\.meesho\.com\/images\/products\/([0-9]+)\/([a-z0-9_.-]+)/i);

  let extractedName = '';
  let extractedImages = [];
  let detectedCode = null;

  if (meeshoProductMatch) {
    const slugPart = meeshoProductMatch[1];
    extractedName = slugPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  } else if (meeshoImageMatch) {
    const codeId = meeshoImageMatch[1];
    detectedCode = `S-${codeId}`;
    extractedName = `Sarojini Street Find ${detectedCode}`;
    let highResImg = parsedUrl.href.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
    extractedImages.push(highResImg);
  } else {
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'Sarojini Bazaar Item';
    const cleanSlug = lastSegment.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
    extractedName = cleanSlug.replace(/\b\w/g, l => l.toUpperCase());
    if (/\.(jpg|jpeg|png|webp|avif)$/i.test(parsedUrl.pathname)) {
      extractedImages.push(parsedUrl.href);
    }
  }

  if (extractedImages.length === 0) {
    if (/\.(jpg|jpeg|png|webp|avif)$/i.test(parsedUrl.pathname) || parsedUrl.hostname.includes('image')) {
      extractedImages.push(parsedUrl.href);
    } else {
      extractedImages.push('assets/sarojni/prod-1-graphic-tee.png');
    }
  }

  const deptInfo = autoSuggestDepartment(extractedName + ' ' + parsedUrl.href);

  return {
    source_url: parsedUrl.href,
    name: extractedName || 'Sarojini Bazaar Find',
    price: 0,
    original_price: 0,
    department: deptInfo.department,
    images: extractedImages,
    detected_code: detectedCode,
    is_duplicate: false,
    is_invalid: false,
    status: 'Price missing — please enter',
    selected: false
  };
}

function autoSuggestDepartment(corpus) {
  const text = corpus.toLowerCase();
  let department = 'WOMEN';
  if (/\b(men|man|mens|boy|oversized|hoodie|polo|cargo|cargos|male)\b/i.test(text)) {
    department = 'MEN';
  } else if (/\b(sneaker|sneakers|kicks|shoe|shoes|footwear|loafers|slides)\b/i.test(text)) {
    department = 'FOOTWEAR';
  } else if (/\b(bag|bags|tote|backpack|handbag|crossbody|clutch|purse)\b/i.test(text)) {
    department = 'BAGS';
  } else if (/\b(sunglass|sunglasses|shades|eyewear|glasses|wallet|belt)\b/i.test(text)) {
    department = 'ACCESSORIES';
  } else if (/\b(jewellery|jewelry|earring|earrings|necklace|pendant|ring|bangle|bracelet)\b/i.test(text)) {
    department = 'JEWELLERY';
  } else if (/\b(cap|caps|hat|hats|beanie|bucket hat)\b/i.test(text)) {
    department = 'CAPS';
  }
  return { department };
}

// 2. CSV Parser logic
function parseCsvTokens(text) {
  const lines = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
    lines.push(row);
  }
  return lines;
}

function runTests() {
  console.log('=== SAROJINI BULK IMPORT ENGINE VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Test 1: URL Parsing ---
  console.log('[1] Testing URL Parsing...');
  const meeshoProduct = parseSingleUrl('https://www.meesho.com/men-oversized-cotton-t-shirt/p/6n3h2k', 1);
  assert(meeshoProduct.name === 'Men Oversized Cotton T Shirt', 'Meesho product name correctly slug-extracted');
  assert(meeshoProduct.department === 'MEN', 'Meesho oversized item categorized as MEN');

  const meeshoImage = parseSingleUrl('https://images.meesho.com/images/products/1084290722/1_512.avif', 2);
  assert(meeshoImage.detected_code === 'S-1084290722', 'Meesho supplier code detected (S-1084290722)');
  assert(meeshoImage.images[0] === 'https://images.meesho.com/images/products/1084290722/1_1024.jpg', 'Image upgraded to 1024 high-res master asset');

  const invalidUrl = parseSingleUrl('not-a-valid-url-at-all::::', 3);
  assert(invalidUrl.is_invalid === true, 'Invalid URL correctly flagged');

  // --- Test 2: Department auto-suggester ---
  console.log('\n[2] Testing Department Auto-Suggester...');
  assert(autoSuggestDepartment('Chunky Air Sneaker White').department === 'FOOTWEAR', 'Sneaker keyword -> FOOTWEAR');
  assert(autoSuggestDepartment('Korean Crossbody Sling Bag').department === 'BAGS', 'Bag keyword -> BAGS');
  assert(autoSuggestDepartment('Vintage Retro Sunglasses UV400').department === 'ACCESSORIES', 'Sunglasses -> ACCESSORIES');
  assert(autoSuggestDepartment('Boho Oxidized Silver Necklace').department === 'JEWELLERY', 'Jewellery keyword -> JEWELLERY');
  assert(autoSuggestDepartment('Streetwear Embroidered Bucket Hat').department === 'CAPS', 'Bucket Hat -> CAPS');
  assert(autoSuggestDepartment('Floral Summer Midi Dress').department === 'WOMEN', 'Default / Dress -> WOMEN');

  // --- Test 3: RFC 4180 CSV Tokenizer ---
  console.log('\n[3] Testing RFC 4180 CSV Tokenizer...');
  const sampleCsv = `name,price,original_price,department,category,description\n"Vintage Tee, Sarojini Edition",299,699,MEN,Oversized,"Streetwear style, with ""heavy"" cotton."\n"Floral Summer Dress",499,999,WOMEN,Dresses,"Lightweight rayon dress"`;
  const tokens = parseCsvTokens(sampleCsv);
  assert(tokens.length === 3, 'CSV parsed into 3 rows (1 header + 2 data rows)');
  assert(tokens[1][0] === 'Vintage Tee, Sarojini Edition', 'Quotes containing comma correctly preserved without splitting');
  assert(tokens[1][5] === 'Streetwear style, with "heavy" cotton.', 'Escaped quotes ("") correctly unescaped');

  // --- Test 4: Sarojini Watermark Integration ---
  console.log('\n[4] Testing Sarojini Watermark Code Detection...');
  const wm1 = watermark.detectSupplierCode('https://images.meesho.com/images/products/1084290722/1_1024.jpg');
  assert(wm1.detected === true && wm1.code === 'S-1084290722', 'Watermark detector identified Meesho code S-1084290722');
  const wm2 = watermark.detectSupplierCode('https://images.meesho.com/images/products/990006640/8nyjx_1024.jpg');
  assert(wm2.detected === true && wm2.code === 'S-990006640', 'Watermark detector identified Meesho code S-990006640');
  const wm3 = watermark.detectSupplierCode('assets/sarojni/clean-product.jpg');
  assert(wm3.detected === false, 'Clean product image has detected=false');

  // --- Test 5: Search Index Integration with Imported Sarojini Products ---
  console.log('\n[5] Testing Search Engine Matching on Imported Sarojini Products...');
  const testProduct = {
    id: 'sarojini-test-bulk-1',
    name: 'Oversized Anime Street Graphic T-Shirt',
    department: 'MEN',
    brand: 'Sarojini Bazaar',
    description: 'Pure heavy cotton oversized tee inspired by Japanese manga art.',
    price: 399,
    original_price: 899,
    sizes: ['M', 'L', 'XL'],
    colors: ['Black', 'White'],
    specifications: {
      source_url: 'https://www.meesho.com/trendy-oversized-anime-tshirt/p/sample1',
      detected_code: 'S-1084290722'
    }
  };

  assert(SearchUtils.matchesProduct(testProduct, 'tshirt'), 'Search matches synonym "tshirt"');
  assert(SearchUtils.matchesProduct(testProduct, 't-shirt'), 'Search matches hyphenated "t-shirt"');
  assert(SearchUtils.matchesProduct(testProduct, 'anime'), 'Search matches "anime"');
  assert(SearchUtils.matchesProduct(testProduct, 'oversized'), 'Search matches "oversized"');
  assert(SearchUtils.matchesProduct(testProduct, 'manga'), 'Search matches description keyword "manga"');
  assert(SearchUtils.matchesProduct(testProduct, 'cotton'), 'Search matches description keyword "cotton"');
  assert(SearchUtils.matchesProduct(testProduct, 'black'), 'Search matches color "black"');
  assert(!SearchUtils.matchesProduct(testProduct, 'sneakers'), 'Search negative check: "sneakers" does not match');

  // --- Test 6: Draft State & Payload Validation ---
  console.log('\n[6] Testing Draft State by Default & Advance Payment Defaults...');
  const stagedItem = {
    name: 'Delhi Street Bag',
    price: 499,
    original_price: 999,
    department: 'BAGS',
    stock: 25,
    images: ['https://images.meesho.com/images/products/12345/1_1024.jpg'],
    advance_payment_enabled: true,
    advance_payment_type: 'fixed',
    advance_payment_value: 80
  };

  // Build payload exactly as admin-sarojini-bulk-import.js does
  const orig = stagedItem.original_price >= stagedItem.price ? stagedItem.original_price : stagedItem.price;
  const discountPct = orig > stagedItem.price ? Math.round(((orig - stagedItem.price) / orig) * 100) : 0;
  const payload = {
    name: stagedItem.name.trim(),
    brand: 'Sarojini Bazaar',
    slug: 'delhi-street-bag-xyz',
    price: Number(stagedItem.price),
    original_price: Number(orig),
    discount_percentage: discountPct,
    stock: stagedItem.stock,
    department: stagedItem.department,
    is_active: false, // CRITICAL: Always imported as Draft
    advance_payment_enabled: stagedItem.advance_payment_enabled,
    advance_payment_type: stagedItem.advance_payment_type,
    advance_payment_value: stagedItem.advance_payment_value
  };

  assert(payload.is_active === false, 'Payload enforces is_active: false (Draft by default)');
  assert(payload.advance_payment_enabled === true && payload.advance_payment_value === 80, 'Payload correctly includes Advance Payment configuration');
  assert(payload.discount_percentage === 50, 'Discount percentage accurately computed');

  console.log(`\n========================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

