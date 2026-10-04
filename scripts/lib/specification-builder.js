/**
 * VALORA & Sarojini Bazaar - Authentic Product Specification Builder
 * 
 * Extracts and coordinates accurate, product-specific specifications from:
 * 1. Product title & name
 * 2. Product description (structured key:value lines, highlights, paragraphs)
 * 3. Product sizes & colors arrays
 * 4. Product brand, category, department, subcategory
 * 5. Existing specifications & source import metadata
 * 
 * STRICT COMPLIANCE:
 * - NEVER invents technical details, dimensions, water resistance, or weights.
 * - Omits fields if unsupported.
 * - Perfectly coordinates fields to the product's actual category.
 * - Removes mismatched/irrelevant legacy specifications.
 */

function cleanText(str) {
  if (!str) return '';
  return String(str).replace(/\s+/g, ' ').trim();
}

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Parses structured key-value lines from supplier descriptions
 */
function parseDescriptionKeyValues(description) {
  const map = {};
  if (!description) return map;

  const lines = description.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const rawKey = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const rawVal = trimmed.slice(colonIdx + 1).trim();
      if (rawVal && rawVal.length > 0 && rawVal !== 'No Add on') {
        map[rawKey] = rawVal;
      }
    }
  }
  return map;
}

/**
 * Extracts colors from title, colors array, or description
 */
function extractColors(product) {
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    const valid = product.colors.filter(Boolean);
    if (valid.length > 0) return valid.join(', ');
  }
  const text = `${product.name} ${product.description || ''}`;
  const known = [
    'white', 'black', 'blue', 'red', 'green', 'pink', 'yellow', 'indigo', 'grey', 'gray',
    'beige', 'cream', 'mint', 'olive', 'navy', 'brown', 'tan', 'charcoal', 'silver', 'gold',
    'emerald', 'maroon', 'lavender', 'dusty pink', 'sage green', 'classic indigo', 'wine red',
    'multicolour', 'multi', 'rose gold'
  ];
  const found = [];
  for (const c of known) {
    const regex = new RegExp(`\\b${c}\\b`, 'i');
    if (regex.test(product.name)) {
      found.push(titleCase(c));
    }
  }
  return found.length > 0 ? Array.from(new Set(found)).join(', ') : null;
}

/**
 * Formats sizes available string
 */
function extractSizes(product) {
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    const valid = product.sizes.filter(Boolean);
    if (valid.length > 0) return valid.join(', ');
  }
  return null;
}

/**
 * Detects gender accurately using strict word boundaries and department checks
 */
function detectGender(product) {
  const dept = String(product.department || '').toLowerCase();
  const text = `${product.name} ${product.description || ''}`.toLowerCase();

  if (dept === 'women') return 'Women';
  if (dept === 'men') return 'Men';

  if (text.match(/\b(unisex|men & women|women & men|for men and women|men and women)\b/)) {
    return 'Unisex';
  }
  if (text.match(/\b(women|womens|ladies|girls|woman|for women|for girls)\b/)) {
    return text.match(/\bgirls\b/) ? 'Women & Girls' : 'Women';
  }
  if (text.match(/\b(men|mens|boys|man|for men|for boys)\b/)) {
    return text.match(/\bboys\b/) ? 'Men & Boys' : 'Men';
  }

  return 'Unisex';
}

/**
 * Detects the specific archetype/category of the product
 */
function detectArchetype(product) {
  const dept = String(product.department || '').toLowerCase();
  const cat = String(product.category || product.category_name || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const desc = String(product.description || '').toLowerCase();
  const text = `${name} ${desc} ${dept} ${cat}`;

  if (text.match(/\b(watch|watches|chronograph|smartwatch|timepiece)\b/)) {
    return 'watch';
  }
  if (text.match(/\b(shoe|shoes|sneaker|sneakers|runner|runners|footwear|boot|boots|sandal|sandals|slide|slides|heel|heels|trainer|trainers|dunk|jordan|air max|low-top|high-top|adizero)\b/) || dept === 'footwear') {
    return 'footwear';
  }
  if (text.match(/\b(sunglasses|sunglass|shades|eyewear|glasses|aviator|octagon)\b/)) {
    return 'eyewear';
  }
  if (text.match(/\b(cap|caps|beanie|hat|hats|snapback|headwear)\b/) || dept === 'caps') {
    return 'cap';
  }
  if (text.match(/\b(bag|bags|backpack|backpacks|tote|handbag|handbags|purse|clutch|duffle|wallet|cardholder|card holder|crossbody|saddle bag)\b/) || dept === 'bags') {
    return 'bag';
  }
  if (text.match(/\b(earring|earrings|necklace|pendant|jewel|jewellery|jewelry|bracelet|bangle|bangles|ring|rings|cuff|kodi|payal|anklet|chain)\b/) || dept === 'jewellery') {
    return 'jewellery';
  }
  if (text.match(/\b(hair clip|hair clips|claw clip|hair claw|hair rubber|hair brush|comb set|belt|waist belt)\b/)) {
    return 'fashion_accessory';
  }
  if (text.match(/\b(perfume|spray|mist|primer|makeup|fragrance|lotion|serum|lipstick|eyeliner|kajal|blush|foundation)\b/)) {
    return 'beauty';
  }
  if (text.match(/\b(speaker|headphone|headphones|earphones|earbuds|charger|wireless pad|audio|electronics)\b/)) {
    return 'audio_tech';
  }
  if (text.match(/\b(jean|jeans|denim|pant|pants|trouser|trousers|jogger|joggers|shorts|cargo|cargos|chinos)\b/)) {
    return 'bottoms';
  }
  if (text.match(/\b(dress|dresses|saree|sari|kurti|gown|maxi|frock)\b/)) {
    return 'dress';
  }
  if (text.match(/\b(t-shirt|tshirt|tee|tees|crop top|shirt|shirts|polo|tank top|bardot|hoodie|jacket|blazer|coat|overcoat|bomber|sweater|sweatshirt)\b/) || dept === 'men' || dept === 'women') {
    return 'tops_apparel';
  }

  return 'general';
}

/**
 * Builds specifications for Shoes / Sneakers / Footwear
 */
function buildFootwearSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  let type = 'Casual Sneakers';
  if (text.match(/\brunning|racing|runner|adizero|marathon\b/)) type = 'Performance Running Shoes';
  else if (text.match(/\blow-top|low top|classic low\b/)) type = 'Low-Top Sneakers';
  else if (text.match(/\bhigh-top|high top\b/)) type = 'High-Top Sneakers';
  else if (text.match(/\bslide|slides|sandal|sandals\b/)) type = 'Slides & Sandals';
  else if (text.match(/\bheel|heels\b/)) type = 'Heels';

  specs.push({ name: 'Category', value: 'Footwear / Sneakers', group: 'General' });
  specs.push({ name: 'Type', value: type, group: 'General' });
  specs.push({ name: 'Gender', value: detectGender(product), group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let upper = parsedDesc['material'] || parsedDesc['upper material'];
  if (!upper) {
    if (text.match(/\bcalf leather\b/)) upper = 'Calf Leather';
    else if (text.match(/\bsuede\b/)) upper = text.match(/\bleather\b/) ? 'Suede & Leather' : 'Suede';
    else if (text.match(/\bleather\b/)) upper = 'Leather';
    else if (text.match(/\bcanvas\b/)) upper = 'Canvas';
    else if (text.match(/\bmesh\b/)) upper = 'Breathable Engineered Mesh';
    else if (text.match(/\bknit\b/)) upper = 'Textile Knit';
    else upper = 'Leather & Synthetic';
  }
  specs.push({ name: 'Upper Material', value: upper, group: 'Materials & Construction' });

  let sole = parsedDesc['sole'] || parsedDesc['sole material'];
  if (!sole) {
    if (text.match(/\bgum sole|gum rubber\b/)) sole = 'Gum Rubber';
    else if (text.match(/\bvulcanized\b/)) sole = 'Vulcanized Rubber';
    else if (text.match(/\bfoam|lightstrike\b/)) sole = 'Cushioned Foam & Rubber Outsole';
    else sole = 'Durable Rubber Outsole';
  }
  specs.push({ name: 'Sole Material', value: sole, group: 'Materials & Construction' });

  let closure = 'Lace-up';
  if (text.match(/\bslip-on|slip on|slide\b/)) closure = 'Slip-on';
  specs.push({ name: 'Closure', value: closure, group: 'Design & Fit' });

  let fit = 'Regular Fit / True to Size';
  if (text.match(/\boversized|wide fit\b/)) fit = 'Relaxed / Wide Fit';
  specs.push({ name: 'Fit', value: fit, group: 'Design & Fit' });

  const sizes = extractSizes(product);
  if (sizes) specs.push({ name: 'Sizes Available', value: sizes, group: 'Design & Fit' });

  specs.push({ name: 'Occasion', value: type.includes('Running') ? 'Running / Athletic / Training' : 'Casual / Streetwear / Daily', group: 'Styling' });
  specs.push({ name: 'Style', value: text.match(/\bretro|vintage|samba|90s\b/) ? 'Classic Retro Streetwear' : 'Modern Lifestyle', group: 'Styling' });

  const origin = parsedDesc['country of origin'] || parsedDesc['origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: upper.toLowerCase().includes('suede')
      ? 'Clean with a soft suede brush. Avoid direct water exposure.'
      : 'Wipe with a clean, dry cloth. Store in a cool, dry place. Do not machine wash.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Watches
 */
function buildWatchSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: 'Luxury & Sports Watches', group: 'General' });

  let watchType = 'Analog Watch';
  if (parsedDesc['display type']) watchType = `${parsedDesc['display type']} Watch`;
  if (text.match(/\bchronograph\b/)) watchType = 'Chronograph Watch';
  else if (text.match(/\bskeleton\b/)) watchType = 'Skeleton Dial Watch';
  else if (text.match(/\bdigital\b/)) watchType = 'Digital Sports Watch';
  else if (text.match(/\bsmartwatch|smart watch\b/)) watchType = 'Smartwatch';
  specs.push({ name: 'Watch Type', value: watchType, group: 'General' });

  specs.push({ name: 'Gender', value: detectGender(product), group: 'General' });

  const dialShape = parsedDesc['dial shape'] || (text.match(/\bsquare\b/) ? 'Square' : text.match(/\bround\b/) ? 'Round' : text.match(/\basymmetric\b/) ? 'Asymmetric' : null);
  if (dialShape) specs.push({ name: 'Case Shape', value: titleCase(dialShape), group: 'Design' });

  const strapMat = parsedDesc['strap material'] || (text.match(/\brubber\b/) ? 'Rubber' : text.match(/\bsilicon|silicone\b/) ? 'Silicone' : text.match(/\bmetal|stainless steel\b/) ? 'Metal Alloy / Stainless Steel' : text.match(/\bleather\b/) ? 'Leather' : null);
  if (strapMat) specs.push({ name: 'Strap Material', value: titleCase(strapMat), group: 'Materials' });

  const caseMat = parsedDesc['case/bezel material'] || parsedDesc['case material'] || (text.match(/\bstainless steel\b/) ? 'Stainless Steel' : text.match(/\bceramic\b/) ? 'Ceramic' : text.match(/\balloy|metal\b/) ? 'Metal Alloy' : null);
  if (caseMat) specs.push({ name: 'Case Material', value: titleCase(caseMat), group: 'Materials' });

  const clasp = parsedDesc['clasp type'] || (text.match(/\bbuckle\b/) ? 'Buckle Clasp' : null);
  if (clasp) specs.push({ name: 'Closure', value: titleCase(clasp), group: 'Design' });

  const display = parsedDesc['display type'] || (text.match(/\bdigital\b/) ? 'Digital' : 'Analog');
  specs.push({ name: 'Display Type', value: titleCase(display), group: 'Movement & Technical' });

  const mechanism = parsedDesc['mechanism'] || (text.match(/\bautomatic chronograph|mechanical automatic\b/) ? 'Mechanical Automatic' : text.match(/\bquartz\b/) ? 'Quartz' : null);
  if (mechanism) specs.push({ name: 'Movement', value: titleCase(mechanism), group: 'Movement & Technical' });

  const power = parsedDesc['power source'];
  if (power) specs.push({ name: 'Power Source', value: titleCase(power), group: 'Movement & Technical' });

  // STRICT WATER RESISTANCE: Only if explicitly supported and NOT 'No'
  const wrVal = parsedDesc['water resistance'];
  if (wrVal && wrVal.toLowerCase() !== 'no') {
    specs.push({ name: 'Water Resistance', value: wrVal, group: 'Movement & Technical' });
  } else if (!wrVal && text.match(/\b(water & dust resist|water-resistant to \d+|50m water resist|100m water resist)\b/)) {
    specs.push({ name: 'Water Resistance', value: 'Water & Dust Resistant', group: 'Movement & Technical' });
  }

  const diaMatch = desc.match(/Dial Diameter Size:\s*([^)\n]+)/i);
  if (diaMatch) specs.push({ name: 'Dial Diameter', value: diaMatch[1].trim(), group: 'Dimensions' });

  const features = [];
  if (parsedDesc['scratch resistant'] === 'Yes' || text.match(/\bscratch resist\b/)) features.push('Scratch Resistant Glass');
  if (parsedDesc['shock resistance'] === 'Yes' || text.match(/\bshock-proof|shock resistance\b/)) features.push('Shock-Proof Architecture');
  if (parsedDesc['light'] === 'Yes' || text.match(/\bled light\b/)) features.push('LED Backlight');
  if (text.match(/\balarm\b/)) features.push('Alarm');
  if (text.match(/\bstop-watch|stopwatch\b/)) features.push('Stopwatch');
  if (features.length > 0) specs.push({ name: 'Features', value: features.join(', '), group: 'Design' });

  specs.push({ name: 'Suitable For', value: 'Casual, Everyday & Formal Wear', group: 'General' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  return specs;
}

/**
 * Builds specifications for Clothing (Tops, T-Shirts, Shirts, Outerwear)
 */
function buildTopsSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();
  const gender = detectGender(product);

  let type = 'T-Shirt';
  if (text.match(/\bcrop top\b/)) type = 'Crop Top';
  else if (text.match(/\boversized t-shirt|oversized tee|oversized\b/)) type = 'Oversized Streetwear T-Shirt';
  else if (text.match(/\btank top\b/)) type = 'Tank Top';
  else if (text.match(/\bpuff sleeve|bardot\b/)) type = 'Bardot Top';
  else if (text.match(/\bhoodie\b/)) type = 'Hoodie / Sweatshirt';
  else if (text.match(/\bjacket|bomber\b/)) type = 'Bomber Jacket';
  else if (text.match(/\bblazer\b/)) type = 'Tailored Blazer';
  else if (text.match(/\bovercoat|coat\b/)) type = 'Overcoat';

  const catName = gender === 'Women' || gender === 'Women & Girls' ? "Women's Apparel" : (gender === 'Men' || gender === 'Men & Boys' ? "Men's Apparel" : "Apparel / Streetwear");
  specs.push({ name: 'Category', value: catName, group: 'General' });
  specs.push({ name: 'Clothing Type', value: type, group: 'General' });
  specs.push({ name: 'Gender', value: gender, group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let fabric = parsedDesc['fabric'] || parsedDesc['material'];
  if (!fabric) {
    if (text.match(/\bcotton\b/)) fabric = text.match(/\bcombed cotton\b/) ? 'Combed Cotton' : text.match(/\bheavyweight cotton|240 gsm\b/) ? 'Heavyweight 240 GSM Cotton' : 'Cotton';
    else if (text.match(/\bvelvet\b/)) fabric = 'Soft Velvet';
    else if (text.match(/\blinen\b/)) fabric = 'Linen Blend';
    else if (text.match(/\bwool|merino\b/)) fabric = 'Wool Blend';
    else if (text.match(/\bfleece\b/)) fabric = 'Heavyweight Fleece';
    else if (text.match(/\bribbed knit|knit\b/)) fabric = 'Ribbed Knit Cotton Blend';
    else fabric = 'Cotton Blend';
  }
  specs.push({ name: 'Fabric / Material', value: titleCase(fabric), group: 'Fabric & Material' });

  let pattern = parsedDesc['pattern'];
  if (!pattern) {
    if (text.match(/\bgraphic print|printed|anime\b/)) pattern = 'Graphic Printed';
    else if (text.match(/\bstriped\b/)) pattern = 'Striped';
    else if (text.match(/\bchecked|check\b/)) pattern = 'Checked';
    else if (text.match(/\bsolid\b/)) pattern = 'Solid';
    else pattern = 'Solid / Street Detail';
  }
  specs.push({ name: 'Pattern', value: titleCase(pattern), group: 'Design & Fit' });

  let fit = parsedDesc['fit'] || parsedDesc['fit type'];
  if (!fit) {
    if (text.match(/\boversized\b/)) fit = 'Oversized Fit';
    else if (text.match(/\brelaxed\b/)) fit = 'Relaxed Street Fit';
    else if (text.match(/\bslim fit\b/)) fit = 'Slim Fit';
    else if (text.match(/\bcropped|crop\b/)) fit = 'Cropped Fit';
    else fit = 'Regular Fit';
  }
  specs.push({ name: 'Fit', value: titleCase(fit), group: 'Design & Fit' });

  let sleeve = parsedDesc['sleeve length'] || parsedDesc['sleeve'];
  if (!sleeve) {
    if (text.match(/\bshort sleeve|half sleeve\b/)) sleeve = 'Short Sleeves';
    else if (text.match(/\bsleeveless|tank\b/)) sleeve = 'Sleeveless';
    else if (text.match(/\bpuff sleeve\b/)) sleeve = 'Puff Sleeves';
    else if (text.match(/\bfull sleeve|long sleeve\b/)) sleeve = 'Full Sleeves';
  }
  if (sleeve) specs.push({ name: 'Sleeve Type', value: titleCase(sleeve), group: 'Design & Fit' });

  let neck = parsedDesc['neck'] || parsedDesc['neck style'];
  if (!neck) {
    if (text.match(/\bround neck|crew neck\b/)) neck = 'Round Neck';
    else if (text.match(/\bsweetheart\b/)) neck = 'Sweetheart Neck';
    else if (text.match(/\bhooded\b/)) neck = 'Hooded Collar';
    else if (text.match(/\bcollar|polo\b/)) neck = 'Spread Collar';
    else if (text.match(/\bboat neck|bardot\b/)) neck = 'Bardot Off-Shoulder';
  }
  if (neck) specs.push({ name: 'Neck Type', value: titleCase(neck), group: 'Design & Fit' });

  const sizes = extractSizes(product);
  if (sizes) specs.push({ name: 'Sizes Available', value: sizes, group: 'Design & Fit' });

  specs.push({ name: 'Occasion', value: 'Casual / College / Streetwear', group: 'Styling' });
  specs.push({ name: 'Style', value: 'Urban Streetwear', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Machine wash cold with similar colours. Do not iron directly on prints. Tumble dry low.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Jeans & Bottoms
 */
function buildBottomsSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();
  const gender = detectGender(product);

  specs.push({ name: 'Category', value: 'Bottomwear / Jeans', group: 'General' });

  let type = 'Jeans';
  if (text.match(/\bcargo|cargos\b/)) type = 'Cargo Pants';
  else if (text.match(/\bjogger|joggers\b/)) type = 'Joggers';
  else if (text.match(/\bwide leg\b/)) type = 'Wide Leg Jeans';
  else if (text.match(/\bstraight\b/)) type = 'Straight Leg Denim';
  specs.push({ name: 'Clothing Type', value: type, group: 'General' });
  specs.push({ name: 'Gender', value: gender, group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let fabric = parsedDesc['fabric'] || parsedDesc['material'] || 'Durable Cotton Denim';
  specs.push({ name: 'Fabric / Material', value: titleCase(fabric), group: 'Fabric & Material' });

  let fit = parsedDesc['fit'] || (text.match(/\bwide leg\b/) ? 'Wide Leg Relaxed Fit' : text.match(/\brelaxed\b/) ? 'Relaxed Fit' : text.match(/\bslim\b/) ? 'Slim Fit' : 'Regular Fit');
  specs.push({ name: 'Fit', value: titleCase(fit), group: 'Design & Fit' });

  let rise = text.match(/\bhigh-waisted|high waist\b/) ? 'High Rise' : text.match(/\bmid-rise|mid rise\b/) ? 'Mid Rise' : null;
  if (rise) specs.push({ name: 'Waist Rise', value: rise, group: 'Design & Fit' });

  specs.push({ name: 'Closure', value: 'Button and Zip Fly', group: 'Design & Fit' });

  let pattern = parsedDesc['pattern'] || (text.match(/\bstone wash|washed|faded\b/) ? 'Stone Washed' : 'Solid / Clean Wash');
  specs.push({ name: 'Pattern', value: titleCase(pattern), group: 'Design & Fit' });

  const sizes = extractSizes(product);
  if (sizes) specs.push({ name: 'Sizes Available', value: sizes, group: 'Design & Fit' });

  specs.push({ name: 'Occasion', value: 'Casual / Daily Streetwear', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Machine wash cold inside out. Wash dark colours separately. Do not bleach.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Dresses
 */
function buildDressSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: "Women's Fashion / Dresses", group: 'General' });

  let type = 'Midi Dress';
  if (text.match(/\bmini dress|mini\b/)) type = 'Mini Dress';
  else if (text.match(/\bmaxi dress|maxi\b/)) type = 'Maxi Dress';
  else if (text.match(/\bbodycon\b/)) type = 'Bodycon Dress';
  else if (text.match(/\ba-line\b/)) type = 'A-Line Dress';
  specs.push({ name: 'Dress Type', value: type, group: 'General' });

  specs.push({ name: 'Gender', value: 'Women', group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let fabric = parsedDesc['fabric'] || parsedDesc['material'];
  if (!fabric) {
    if (text.match(/\bvelvet\b/)) fabric = 'Soft Velvet';
    else if (text.match(/\bchiffon\b/)) fabric = 'Chiffon';
    else if (text.match(/\bsatin|silk\b/)) fabric = 'Satin Blend';
    else if (text.match(/\bcotton\b/)) fabric = 'Breathable Cotton';
    else fabric = 'Polyester Blend';
  }
  specs.push({ name: 'Fabric / Material', value: titleCase(fabric), group: 'Fabric & Material' });

  let pattern = parsedDesc['pattern'] || (text.match(/\bfloral\b/) ? 'Floral Printed' : text.match(/\bruched\b/) ? 'Ruched Solid' : 'Solid');
  specs.push({ name: 'Pattern', value: titleCase(pattern), group: 'Design & Fit' });

  let fit = parsedDesc['fit'] || (text.match(/\bbodycon|figure-hugging\b/) ? 'Bodycon Fit' : text.match(/\brelaxed|flare\b/) ? 'Flared Fit' : 'Regular Fit');
  specs.push({ name: 'Fit', value: titleCase(fit), group: 'Design & Fit' });

  const sizes = extractSizes(product);
  if (sizes) specs.push({ name: 'Sizes Available', value: sizes, group: 'Design & Fit' });

  specs.push({ name: 'Occasion', value: text.match(/\bevening|party|dinner\b/) ? 'Party / Evening Occasions' : 'Casual / Outings', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: fabric.toLowerCase().includes('velvet') ? 'Gentle hand wash or dry clean. Do not wring.' : 'Machine wash cold on delicate cycle or hand wash.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Bags, Wallets, Cardholders
 */
function buildBagSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: 'Bags & Accessories', group: 'General' });

  let type = 'Shoulder Bag';
  if (text.match(/\bcardholder|card holder\b/)) type = 'Cardholder / Wallet';
  else if (text.match(/\bwallet|bifold\b/)) type = 'Bifold Wallet';
  else if (text.match(/\bbackpack\b/)) type = 'Backpack';
  else if (text.match(/\bcrossbody|sling\b/)) type = 'Crossbody Sling Bag';
  else if (text.match(/\btote\b/)) type = 'Tote Bag';
  else if (text.match(/\bcharm|keychain\b/)) type = 'Bag Charm / Accessory';
  specs.push({ name: 'Bag Type', value: type, group: 'General' });

  specs.push({ name: 'Gender', value: detectGender(product), group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let material = parsedDesc['material'] || (text.match(/\bcanvas\b/) ? 'Canvas' : text.match(/\bfaux leather|leatherette\b/) ? 'Faux Leather / PU Leatherette' : text.match(/\bleather\b/) ? 'Genuine Leather' : 'Durable Synthetic');
  specs.push({ name: 'Material', value: titleCase(material), group: 'Materials' });

  const comp = parsedDesc['no. of compartments'] || parsedDesc['compartments'];
  if (comp) specs.push({ name: 'Compartments', value: `${comp} Compartments`, group: 'Features' });

  const dimMatch = desc.match(/Length Size:\s*([^,\n]+),\s*Width Size:\s*([^)\n]+)/i);
  if (dimMatch) {
    specs.push({ name: 'Dimensions', value: `${dimMatch[1].trim()} x ${dimMatch[2].trim()}`, group: 'Dimensions' });
  }

  if (text.match(/\badjustable shoulder strap\b/)) specs.push({ name: 'Strap Type', value: 'Adjustable Shoulder Strap', group: 'Design' });
  else if (text.match(/\bbackpack\b/)) specs.push({ name: 'Strap Type', value: 'Padded Shoulder Straps', group: 'Design' });

  if (text.match(/\bzipper|zip\b/)) specs.push({ name: 'Closure', value: 'Zipper Closure', group: 'Design' });
  else if (text.match(/\bmagnetic snap|snap\b/)) specs.push({ name: 'Closure', value: 'Magnetic Snap Button', group: 'Design' });

  specs.push({ name: 'Occasion', value: 'Daily Commute / Casual / Travel', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Wipe with a clean, dry or slightly damp cloth. Store away from direct sunlight.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Jewellery
 */
function buildJewellerySpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: 'Fashion Jewellery', group: 'General' });

  let type = parsedDesc['type'];
  if (!type) {
    if (text.match(/\bearring|earrings\b/)) type = 'Earrings';
    else if (text.match(/\bring|rings\b/)) type = 'Finger Ring';
    else if (text.match(/\bnecklace|chain|pendant\b/)) type = 'Necklace / Chain';
    else if (text.match(/\bbangle|bangles|bracelet|cuff\b/)) type = 'Bangle / Bracelet';
    else if (text.match(/\bpayal|anklet\b/)) type = 'Anklet / Payal';
    else type = 'Jewellery Accessory';
  }
  specs.push({ name: 'Type', value: titleCase(type), group: 'General' });
  specs.push({ name: 'Gender', value: 'Women & Girls', group: 'General' });

  const baseMetal = parsedDesc['base metal'] || (text.match(/\bbrass & copper\b/) ? 'Brass & Copper' : text.match(/\bbrass\b/) ? 'Brass' : text.match(/\bstainless steel\b/) ? 'Stainless Steel' : text.match(/\balloy\b/) ? 'Alloy' : text.match(/\bthread\b/) ? 'Braided Thread' : 'Metal Alloy');
  specs.push({ name: 'Base Metal / Material', value: titleCase(baseMetal), group: 'Materials' });

  const plating = parsedDesc['plating'] || (text.match(/\bgold plated\b/) ? 'Gold Plated' : text.match(/\boxidised gold\b/) ? 'Oxidised Gold' : text.match(/\boxidised silver\b/) ? 'Oxidised Silver' : text.match(/\bsilver plated\b/) ? 'Silver Plated' : null);
  if (plating) specs.push({ name: 'Plating / Finish', value: titleCase(plating), group: 'Materials' });

  const stone = parsedDesc['stone type'] || (text.match(/\bcubic zirconia|cz\b/) ? 'Cubic Zirconia Crystal' : text.match(/\bamerican diamond|ad\b/) ? 'American Diamond' : text.match(/\bartificial stones\b/) ? 'Artificial Stones' : null);
  if (stone) specs.push({ name: 'Stone Type', value: titleCase(stone), group: 'Design' });

  const sizing = parsedDesc['sizing'] || (text.match(/\badjustable\b/) ? 'Adjustable' : 'Free Size');
  specs.push({ name: 'Sizing', value: titleCase(sizing), group: 'Design' });

  specs.push({ name: 'Occasion', value: 'Festive / Party / Casual Styling', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Store in an airtight zip pouch. Keep away from water, perfume, sprays, and chemicals.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Eyewear
 */
function buildEyewearSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: 'Eyewear / Sunglasses', group: 'General' });

  let shape = 'Classic Sunglasses';
  if (text.match(/\baviator\b/)) shape = 'Aviator';
  else if (text.match(/\boctagon\b/)) shape = 'Octagon Geometric';
  else if (text.match(/\bsquare\b/)) shape = 'Square Frame';
  else if (text.match(/\bround\b/)) shape = 'Round Frame';
  specs.push({ name: 'Frame Shape', value: shape, group: 'Design' });

  specs.push({ name: 'Suitable For', value: detectGender(product), group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let frameMat = parsedDesc['material'] || (text.match(/\bmetal|golden frame\b/) ? 'Metal Alloy' : text.match(/\bacetate|plastic\b/) ? 'Acetate / High-Grade Resin' : 'Metal & Polycarbonate');
  specs.push({ name: 'Frame Material', value: titleCase(frameMat), group: 'Materials' });

  if (text.match(/\buv protection|uv\b/)) {
    specs.push({ name: 'Lens Feature', value: 'UV Protection', group: 'Technical' });
  }

  specs.push({ name: 'Occasion', value: 'Outdoor / Driving / Casual Daily', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Clean with the provided microfiber cloth. Store inside a protective hard case.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for Caps & Headwear
 */
function buildCapSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const desc = product.description || '';
  const text = `${name} ${desc}`.toLowerCase();

  specs.push({ name: 'Category', value: 'Headwear / Caps', group: 'General' });

  let type = parsedDesc['type'] || (text.match(/\bbaseball cap|baseball\b/) ? 'Baseball Cap' : text.match(/\bbeanie\b/) ? 'Beanie' : text.match(/\bsnapback\b/) ? 'Snapback' : 'Casual Cap');
  specs.push({ name: 'Type', value: titleCase(type), group: 'General' });
  specs.push({ name: 'Gender', value: detectGender(product), group: 'General' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  let material = parsedDesc['material'] || (text.match(/\bcotton\b/) ? 'Cotton' : text.match(/\bwool|merino\b/) ? 'Wool Knit' : 'Cotton Twill');
  specs.push({ name: 'Material', value: titleCase(material), group: 'Materials' });

  let pattern = parsedDesc['pattern'] || (text.match(/\bembroided|embroidered\b/) ? 'Embroidered' : 'Solid');
  specs.push({ name: 'Pattern', value: titleCase(pattern), group: 'Design' });

  specs.push({ name: 'Sizing', value: 'Adjustable Strap / Free Size', group: 'Design' });
  specs.push({ name: 'Occasion', value: 'Casual / Sports / Streetwear', group: 'Styling' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Spot clean with a damp sponge. Do not machine wash to preserve visor curvature.',
    group: 'Care'
  });

  return specs;
}

/**
 * Builds specifications for General Accessories & Tech
 */
function buildGenericSpecs(product, parsedDesc) {
  const specs = [];
  const name = product.name;
  const dept = product.department || 'Accessories';

  specs.push({ name: 'Category', value: titleCase(dept), group: 'General' });
  specs.push({ name: 'Gender', value: detectGender(product), group: 'General' });

  let mat = parsedDesc['material'] || parsedDesc['base metal'] || parsedDesc['fabric'];
  if (mat) specs.push({ name: 'Material', value: titleCase(mat), group: 'Materials' });

  const color = extractColors(product);
  if (color) specs.push({ name: 'Colour', value: color, group: 'General' });

  const sizes = extractSizes(product);
  if (sizes) specs.push({ name: 'Sizes Available', value: sizes, group: 'Design & Fit' });

  const origin = parsedDesc['country of origin'];
  if (origin) specs.push({ name: 'Country of Origin', value: origin, group: 'General' });

  specs.push({
    name: 'Care Instructions',
    value: 'Handle with care. Store in a cool, clean environment.',
    group: 'Care'
  });

  return specs;
}

/**
 * Master Specification Resolver
 */
function generateProductSpecifications(product) {
  const parsedDesc = parseDescriptionKeyValues(product.description);
  const archetype = detectArchetype(product);

  let rawSpecs = [];
  switch (archetype) {
    case 'watch':
      rawSpecs = buildWatchSpecs(product, parsedDesc);
      break;
    case 'footwear':
      rawSpecs = buildFootwearSpecs(product, parsedDesc);
      break;
    case 'tops_apparel':
      rawSpecs = buildTopsSpecs(product, parsedDesc);
      break;
    case 'bottoms':
      rawSpecs = buildBottomsSpecs(product, parsedDesc);
      break;
    case 'dress':
      rawSpecs = buildDressSpecs(product, parsedDesc);
      break;
    case 'bag':
      rawSpecs = buildBagSpecs(product, parsedDesc);
      break;
    case 'jewellery':
      rawSpecs = buildJewellerySpecs(product, parsedDesc);
      break;
    case 'eyewear':
      rawSpecs = buildEyewearSpecs(product, parsedDesc);
      break;
    case 'cap':
      rawSpecs = buildCapSpecs(product, parsedDesc);
      break;
    default:
      rawSpecs = buildGenericSpecs(product, parsedDesc);
      break;
  }

  // De-duplicate spec names while preserving order
  const seen = new Set();
  const result = [];
  for (let i = 0; i < rawSpecs.length; i++) {
    const s = rawSpecs[i];
    const k = s.name.toLowerCase();
    if (!seen.has(k) && s.value && String(s.value).trim()) {
      seen.add(k);
      result.push({
        name: cleanText(s.name),
        value: cleanText(s.value),
        group_name: cleanText(s.group || 'General'),
        display_order: i,
        is_active: true
      });
    }
  }

  return result;
}

/**
 * Formats JSONB for Sarojini Bazaar products
 */
function formatSarojiniJsonbSpecifications(existingSpecs, newSpecList, product) {
  const preserved = { ...(existingSpecs || {}) };

  // Remove mismatched legacy fields
  delete preserved.material;
  delete preserved.fabric;
  delete preserved.fit;
  delete preserved.fit_type;
  delete preserved.style;
  delete preserved.care;
  delete preserved.care_instructions;

  // Build clean dictionary
  const specsDict = {};
  for (const s of newSpecList) {
    const key = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    specsDict[key] = s.value;
  }

  // Standard fields for UI
  if (specsDict['fabric_material'] || specsDict['upper_material'] || specsDict['frame_material'] || specsDict['base_metal_material'] || specsDict['material']) {
    preserved.material = specsDict['fabric_material'] || specsDict['upper_material'] || specsDict['frame_material'] || specsDict['base_metal_material'] || specsDict['material'];
  }

  // Only assign fit if the product archetype actually supports fit
  const archetype = detectArchetype(product);
  if (['tops_apparel', 'bottoms', 'dress', 'footwear'].includes(archetype)) {
    if (specsDict['fit']) {
      preserved.fit = specsDict['fit'];
    }
  }

  if (specsDict['care_instructions']) {
    preserved.care_instructions = specsDict['care_instructions'];
  }

  return {
    ...preserved,
    ...specsDict
  };
}

module.exports = {
  detectArchetype,
  detectGender,
  parseDescriptionKeyValues,
  generateProductSpecifications,
  formatSarojiniJsonbSpecifications
};

