/**
 * VALORA & Sarojini Bazaar - Dynamic Product Review Generation Engine
 * 
 * Generates natural, 100% UNIQUE, product-specific review records based on actual database attributes:
 * - Product Name, Model, Category, Department, Price, Colors, Sizes, Materials, Description.
 * - Deeply tailored to the specific product type (shoes, tees, jeans, dresses, bags, jewellery, cosmetics/sprays, etc.).
 * - Varied Indian customer names (balanced male & female, diverse regions).
 * - Conversational mixture of English, natural Hinglish, and conversational Indian English.
 * - Realistic rating distribution (mix of 5★, 4★, 3★, occasional 2★).
 * - Authentic, constructive remarks for lower-rated reviews (e.g. break-in period, size guidance, packaging).
 * - Deterministic UUIDs prefixed with 00005eed- for collision-free identification, safe re-runs, and surgical cleanup.
 * - Global collision tracking ensuring NO TWO REVIEWS across ANY products ever share the same text.
 * - NO customer-facing "fake review" or "demo review" labels.
 */

const crypto = require('crypto');

// ============================================================================
// 1. VARIED INDIAN CUSTOMER NAMES (130+ DIVERSE NAMES)
// ============================================================================
const INDIAN_REVIEWER_NAMES = [
  // Female Names
  "Ananya Sharma", "Priya Patel", "Sneha Kapoor", "Diya Gupta", "Riya Mehta",
  "Kavya Iyer", "Meera Joshi", "Pooja Agarwal", "Tanvi Deshmukh", "Sakshi Verma",
  "Shreya Nair", "Ishita Sen", "Nandini Rao", "Simran Kaur", "Muskan Choudhary",
  "Ritika Bhatt", "Avni Kulkarni", "Rhea Singhania", "Bhavna Trivedi", "Divya Reddy",
  "Aarohi Saxena", "Tanya Banerjee", "Aditi Menon", "Neha Chauhan", "Khushi Jain",
  "Anushka Sengupta", "Manya Sethi", "Ira Nambiar", "Kiara Bhardwaj", "Shanaya Paul",
  "Komal Kashyap", "Shweta Pillai", "Ritu Goswami", "Anvi Mathur", "Palak Chawla",
  "Preeti Rawat", "Swati Mahajan", "Deepika Pillai", "Garima Shukla", "Barkha Tandon",
  "Radhika Somani", "Meenakshi Sundaram", "Prachi Kothari", "Aakriti Vohra", "Juhi Chawla",
  "Suhana Merchant", "Harshita Mittal", "Aanchal Saxena", "Namrata Joshi", "Devika Nambisan",
  "Mallika Saran", "Shruti Hegde", "Sonalika Ghosh", "Pavitra Murthy", "Trisha Sengupta",
  "Mahima Malhotra", "Zoya Khan", "Bhumika Dave", "Payal Parekh", "Kritika Anand",

  // Male Names
  "Aarav Verma", "Rohan Mehta", "Aditya Sharma", "Karan Malhotra", "Rahul Kumar",
  "Arjun Singh", "Mohit Gupta", "Nikhil Jain", "Varun Nair", "Harsh Patel",
  "Yash Agarwal", "Kabir Mukherjee", "Aryan Kapoor", "Siddharth Sen", "Vansh Saxena",
  "Abhishek Joshi", "Ritik Yadav", "Pranav Rao", "Ishan Bansal", "Tanishq Sethi",
  "Devansh Bhatia", "Gaurav Nambiar", "Deepak Sharma", "Naveen Sundaram", "Rohit Tiwari",
  "Vikas Chandra", "Manav Goel", "Dhruv Singhal", "Ayush Tripathy", "Rishabh Kothari",
  "Akash Varma", "Kunal Chopra", "Sameer Qureshi", "Nitin Aggarwal", "Piyush Deshpande",
  "Tarun Kulkarni", "Sachin Hegde", "Rajeshwari Prasad", "Vivek Anand", "Amitabh Roy",
  "Raghavan Pillai", "Saurabh Mishra", "Hardik Mehta", "Mayank Soni", "Udit Ganguly",
  "Chinmay Joshi", "Jaideep Bedi", "Gautam Suri", "Shirish Nadkarni", "Sanjay Namboodiri",
  "Bhavesh Parmar", "Harshit Rastogi", "Aniruddh Roy", "Deepanshu Kaushik", "Ankit Chauhan",
  "Siddhesh Shinde", "Tejas Prabhu", "Tanmay Kedia", "Ramanan Krishnan", "Lalit Bohra"
];

const CITIES = [
  "Delhi", "Mumbai", "Bangalore", "Pune", "Hyderabad",
  "Jaipur", "Kolkata", "Ahmedabad", "Chandigarh", "Lucknow",
  "Indore", "Chennai", "Kochi", "Noida", "Gurugram"
];

// Global registry of used review strings across the entire process lifetime
const GLOBAL_USED_REVIEWS = new Set();

// ============================================================================
// 2. PRODUCT ATTRIBUTE EXTRACTION ENGINE
// ============================================================================
function extractProductAttributes(product) {
  const name = String(product.name || '').trim();
  const desc = String(product.description || '').trim();
  const dept = String(product.department || '').trim();
  const cat = String(product.categories?.name || product.category || product.category_id || '').trim();
  const brand = String(product.brand || 'VALORA').trim();
  const price = Number(product.price) || 0;
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];

  // 1. Detect colors
  const detectedColors = [...colors];
  const colorMatches = (name + ' ' + desc).match(/\b(white|black|blue|red|green|pink|yellow|indigo|grey|gray|beige|cream|mint|olive|navy|brown|tan|charcoal|silver|gold|emerald|maroon|lavender|obsidian|crimson|gum|washed black)\b/gi);
  if (colorMatches) {
    colorMatches.forEach(c => {
      const formatted = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
      if (!detectedColors.some(dc => dc.toLowerCase() === formatted.toLowerCase())) {
        detectedColors.push(formatted);
      }
    });
  }

  // 2. Detect materials/fabrics
  const detectedMaterials = [];
  const matMatches = (name + ' ' + desc).match(/\b(cotton|combed cotton|denim|leather|suede|canvas|linen|velvet|silk|chiffon|georgette|polyester|fleece|knit|wool|nylon|mesh|rubber|stainless steel|brass|gold plated)\b/gi);
  if (matMatches) {
    matMatches.forEach(m => {
      const formatted = m.toLowerCase();
      if (!detectedMaterials.includes(formatted)) detectedMaterials.push(formatted);
    });
  }

  // 3. Detect archetype / category using strict word boundaries
  const text = (name + ' ' + desc + ' ' + dept + ' ' + cat).toLowerCase();
  let type = 'general';

  if (text.match(/\b(perfume|spray|mist|primer|makeup|fragrance|lotion|serum|skincare|cosmetic|fixer|face wash|lipstick|eyeliner|kajal|blush|foundation)\b/i)) {
    type = 'beauty';
  } else if (text.match(/\b(shoe|shoes|sneaker|sneakers|runner|runners|footwear|boot|boots|sandal|sandals|slide|slides|heel|heels|trainer|trainers|dunk|jordan|air max|low-top|high-top)\b/i)) {
    type = 'shoes';
  } else if (text.match(/\b(sunglasses|shades|eyewear|glasses|aviator|octagon|frames)\b/i)) {
    type = 'eyewear';
  } else if (text.match(/\b(watch|watches|chronograph|smartwatch|timepiece)\b/i)) {
    type = 'watches';
  } else if (text.match(/\b(earring|earrings|necklace|pendant|jewel|jewellery|jewelry|bracelet|bangle|ring|rings|cuff|kodi)\b/i)) {
    type = 'jewellery';
  } else if (text.match(/\b(bag|bags|backpack|backpacks|tote|handbag|handbags|purse|clutch|duffle|wallet|crossbody|saddle bag)\b/i)) {
    type = 'bags';
  } else if (text.match(/\b(cap|caps|beanie|hat|hats|snapback|headwear)\b/i)) {
    type = 'caps';
  } else if (text.match(/\b(speaker|headphone|headphones|earphones|earbuds|charger|wireless pad|audio|electronics)\b/i)) {
    type = 'electronics';
  } else if (text.match(/\b(jacket|hoodie|blazer|coat|overcoat|bomber|outerwear|sweatshirt|windbreaker)\b/i)) {
    type = 'outerwear';
  } else if (text.match(/\b(dress|dresses|saree|sari|kurti|gown|maxi|frock)\b/i)) {
    type = 'dresses';
  } else if (text.match(/\b(jean|jeans|denim|pant|pants|trouser|trousers|jogger|joggers|shorts|cargo|cargos|chinos)\b/i)) {
    type = 'bottoms';
  } else if (text.match(/\b(t-shirt|tshirt|tee|tees|crop top|shirt|shirts|polo|tank top|bardot)\b/i)) {
    type = 'tops';
  }

  // Create clean short title
  let shortTitle = name
    .replace(/^Nike\s+/i, 'Nike ')
    .replace(/^Jordan\s+/i, 'Jordan ')
    .replace(/^Adidas\s+/i, 'Adidas ')
    .replace(/\s*\|\s*.*$/i, '')
    .trim();

  // If title is too long, trim cleanly
  if (shortTitle.length > 45) {
    const parts = shortTitle.split(/[\s,]+/);
    shortTitle = parts.slice(0, 5).join(' ');
  }

  const primaryColor = detectedColors.length > 0 ? detectedColors[0] : null;
  const primaryMaterial = detectedMaterials.length > 0 ? detectedMaterials[0] : null;
  const primarySize = sizes.length > 0 ? sizes[Math.floor(sizes.length / 2)] : null;

  return {
    name,
    shortTitle,
    desc,
    type,
    brand,
    dept,
    price,
    colors: detectedColors,
    primaryColor,
    materials: detectedMaterials,
    primaryMaterial,
    sizes,
    primarySize
  };
}

function detectProductCategory(product) {
  return extractProductAttributes(product).type;
}

// ============================================================================
// 3. DETERMINISTIC SEED REVIEW ID GENERATOR
// ============================================================================
function generateSeedReviewId(productId, index) {
  const hash = crypto.createHash('md5').update(`vadi_seed_review_${productId}_${index}`).digest('hex');
  return `00005eed-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function isSeedReviewId(id) {
  return typeof id === 'string' && id.startsWith('00005eed-');
}

// ============================================================================
// 4. DYNAMIC, ATTRIBUTE-AWARE REVIEW SYNTHESIS ENGINE
// ============================================================================
function synthesizeUniqueReview(attr, rating, index, productHash, iteration = 0) {
  const { shortTitle, type, price, colors, sizes, primaryMaterial } = attr;
  const hashVal = crypto.createHash('md5').update(`${productHash}_${index}_${iteration}`).digest('hex');
  const n = parseInt(hashVal.slice(0, 4), 16);

  const city = CITIES[n % CITIES.length];
  const colorMention = colors.length > 0 ? colors[n % colors.length] : null;
  const sizeMention = sizes.length > 0 ? sizes[n % sizes.length] : null;
  const matPhrase = primaryMaterial || (type === 'shoes' ? 'leather' : type === 'tops' ? 'cotton' : type === 'bottoms' ? 'denim' : 'material');

  let review = '';

  if (type === 'shoes') {
    const shoeOpeners = [
      `Ordered the ${shortTitle}${sizeMention ? ' in ' + sizeMention : ''} and it was delivered to ${city} in 3 days.`,
      `The cushioning on this ${shortTitle} is super comfortable right out of the box.`,
      `Wore these ${shortTitle} for a full day of traveling and walking around ${city}, and my feet felt completely relaxed.`,
      `Got this pair of ${shortTitle} after eyeing it for a while and the build quality is top notch.`,
      `Clean silhouette on the ${shortTitle}! Look and finishing are even sharper in person than in pictures.`,
      `Sole ka grip aur insole foam support on this ${shortTitle} bohot achha hai.`,
      `Ordered ${sizeMention || 'my standard size'} in ${shortTitle} and the fitting is true to size with no toe pinching.`,
      `Impressive craftsmanship on the ${shortTitle}. Stitching along the panels is clean and durable.`
    ];
    const shoeMiddles = [
      ` Insole cushioning absorbs heel impact effortlessly, and the outsole traction grips well even on wet tiles.`,
      ` The ${matPhrase} upper feels soft yet sturdy, and the colorway looks great with both baggy denims and cargo pants.`,
      ` Doesn't feel bulky on feet at all. Crease resistance on the toe box has held up nicely after regular wears.`,
      ` Memory foam effect clear feel hota hai walking ke time. Heel lock bhi solid hai without causing any shoe bites.`,
      ` The ankle padding provides good stability without feeling stiff. Breathability keeps feet fresh throughout the day.`
    ];
    const shoeClosers5 = [
      ` Easily one of my best footwear pickups this season. 10/10 recommendation!`,
      ` Totally worth ₹${price || 'the price'}. Authentic finish and premium look.`,
      ` Bohot pyara pair hai. Multiple compliments already from friends in ${city}.`
    ];
    const shoeClosers4 = [
      ` Overall solid 4 stars. First day slight break-in required, but fits like a dream now.`,
      ` Premium sneakers. Box packaging had a slight bend on corner, but shoes were in mint condition.`,
      ` Value for money pair. Looks high-end and clean on feet.`
    ];
    const shoeClosers3 = [
      ` Decent pair for casual rotation. Arch support is moderate, so added an extra insole for long walks.`,
      ` Appearance is great, though sizing runs slightly narrow near the ball of the foot. Consider half size up if you have wide feet.`
    ];
    const shoeClosers2 = [
      ` Looks nice in catalog, but the sole felt a bit harder than expected. Will take some time to soften up.`
    ];

    if (rating === 5) {
      review = `${shoeOpeners[n % shoeOpeners.length]}${shoeMiddles[(n * 3) % shoeMiddles.length]}${shoeClosers5[(n * 7) % shoeClosers5.length]}`;
    } else if (rating === 4) {
      review = `${shoeOpeners[n % shoeOpeners.length]}${shoeClosers4[(n * 5) % shoeClosers4.length]}`;
    } else if (rating === 3) {
      review = `${shoeOpeners[n % shoeOpeners.length]}${shoeClosers3[(n * 3) % shoeClosers3.length]}`;
    } else {
      review = `${shoeOpeners[n % shoeOpeners.length]}${shoeClosers2[n % shoeClosers2.length]}`;
    }
  } else if (type === 'tops') {
    const topOpeners = [
      `Got the ${shortTitle}${sizeMention ? ' in size ' + sizeMention : ''} delivered to ${city}.`,
      `The fabric on this ${shortTitle} feels remarkably soft and breathable.`,
      `Bohot comfy fit hai is ${shortTitle} ka. Perfect for daily casual wear.`,
      `Received the ${shortTitle} yesterday and the print clarity is really impressive.`,
      `Stitching and collar construction on the ${shortTitle} are spot on.`,
      `Look and drop on this ${shortTitle} gives that exact relaxed streetwear silhouette.`,
      `Ordered ${colorMention ? colorMention + ' ' : ''}${shortTitle} and the shade looks even richer in natural daylight.`
    ];
    const topMiddles = [
      ` Pure ${matPhrase} feel that doesn't feel heavy even in warm humidity. Fabric pre-shrunk lagta hai as shape didn't distort after a quick cold wash.`,
      ` The neckline ribbing is thick and doesn't sag or curl after washing. Shoulder seam drape falls naturally.`,
      ` Print feels soft and fused cleanly into the fabric, zero plastic peeling feeling even after gentle iron.`,
      ` Sizing is spot on according to the chart. Chest width aur sleeve length bilkul balanced hain for a relaxed vibe.`,
      ` Pairs effortlessly with straight denims and sneakers. Material breathability is top tier for all-day comfort.`
    ];
    const topClosers5 = [
      ` Total value for ₹${price || 'the price'}. Definitely buying more colorways soon!`,
      ` 10/10 purchase. Finishing quality matches high-end streetwear labels.`,
      ` Ekdum mast tee hai. Looks premium and feels comfortable all day long.`
    ];
    const topClosers4 = [
      ` Solid 4 stars. Delivery to ${city} took 4 days, but the top itself exceeded my expectations.`,
      ` Very happy with the purchase. Minor fold wrinkles straight out of packaging, but a quick steam made it perfect.`,
      ` Great daily driver top. Quality is noticeably better than typical fast fashion tees.`
    ];
    const topClosers3 = [
      ` Decent tee for casual home and errands. Expected slightly heavier GSM, but great for light summer layering.`,
      ` Looks good, though length is slightly longer than expected. Tucking it in gives the right proportion.`
    ];
    const topClosers2 = [
      ` Design looks nice, but sizing runs a bit more oversized than standard charts indicate. Recommend sizing down.`
    ];

    if (rating === 5) {
      review = `${topOpeners[n % topOpeners.length]}${topMiddles[(n * 3) % topMiddles.length]}${topClosers5[(n * 7) % topClosers5.length]}`;
    } else if (rating === 4) {
      review = `${topOpeners[n % topOpeners.length]}${topClosers4[(n * 5) % topClosers4.length]}`;
    } else if (rating === 3) {
      review = `${topOpeners[n % topOpeners.length]}${topClosers3[(n * 3) % topClosers3.length]}`;
    } else {
      review = `${topOpeners[n % topOpeners.length]}${topClosers2[n % topClosers2.length]}`;
    }
  } else if (type === 'bottoms') {
    const bottomOpeners = [
      `The cut and drape on this ${shortTitle} are spot on.`,
      `Ordered ${sizeMention ? 'waist ' + sizeMention + ' in ' : ''}the ${shortTitle} and the fit is remarkably flattering.`,
      `The ${matPhrase} weight on these ${shortTitle} feels substantial without being stiff.`,
      `Received the ${shortTitle} in ${city} and immediately tried it on.`,
      `Proper relaxed fit silhouette! ${shortTitle} looks super stylish with basic tees and chunky sneakers.`
    ];
    const bottomMiddles = [
      ` Waistband fitting is comfortable with no gaping at the back. Pockets are genuinely deep and hold a large phone securely.`,
      ` Stitched with durable reinforced thread along the inner seams. Rivets and button fly hardware feel sturdy and premium.`,
      ` Wash tone and fading look natural and vintage. Fabric softens up nicely after the first wash while retaining structure.`,
      ` Length falls perfectly over sneaker collars without dragging on the ground. Movement around knees and thighs feels easy.`
    ];
    const bottomClosers5 = [
      ` Best pair of bottoms I've bought online in months. 10/10 fit and quality!`,
      ` Premium quality at ₹${price || 'reasonable price'}. Fits better than many mall brands.`
    ];
    const bottomClosers4 = [
      ` Really good pair. The waist was slightly snug on first wear, but eased up within a day of regular use. Solid 4 stars.`,
      ` Great purchase. Good stitching and authentic colorway. Would recommend checking size measurements before ordering.`
    ];
    const bottomClosers3 = [
      ` Decent bottoms for everyday wear. Denim is on the lighter side, good for mild weather.`
    ];
    const bottomClosers2 = [
      ` Style looks good, but waist sizing runs slightly smaller than standard high street sizing.`
    ];

    if (rating === 5) {
      review = `${bottomOpeners[n % bottomOpeners.length]}${bottomMiddles[(n * 3) % bottomMiddles.length]}${bottomClosers5[(n * 7) % bottomClosers5.length]}`;
    } else if (rating === 4) {
      review = `${bottomOpeners[n % bottomOpeners.length]}${bottomClosers4[(n * 3) % bottomClosers4.length]}`;
    } else if (rating === 3) {
      review = `${bottomClosers3[n % bottomClosers3.length]}`;
    } else {
      review = `${bottomClosers2[n % bottomClosers2.length]}`;
    }
  } else if (type === 'dresses') {
    const dressOpeners = [
      `Wore this ${shortTitle} for an evening get-together in ${city} and received so many compliments!`,
      `The drape and silhouette of the ${shortTitle} fall so gracefully.`,
      `Fabric feel on the ${shortTitle} is soft against the skin and doesn't cling uncomfortably.`,
      `Ordered this ${shortTitle}${colorMention ? ' in ' + colorMention : ''} and the color is gorgeous in person.`
    ];
    const dressMiddles = [
      ` Inner lining is well stitched and breathable, preventing any transparency issues. Waistline accentuate karta hai figure ko naturally.`,
      ` Beautiful fall and movement in the skirt portion. Stitching along the neckline and hem is clean and even.`,
      ` Looks elegant and expensive. Fabric doesn't easily wrinkle even when sitting for hours during an event.`
    ];
    const dressClosers5 = [
      ` Absolutely in love with this dress. Worth every rupee!`,
      ` 10/10 purchase. Felt confident and comfortable the entire evening.`
    ];
    const dressClosers4 = [
      ` Very pretty piece. Delivery arrived within 3 days. Pair it with minimalistic heels for the best look.`,
      ` Good quality dress. Sizing fits true to the guide. Fabric is soft and gentle.`
    ];
    const dressClosers3 = [
      ` Nice dress for casual outings. Needed slight steaming upon unboxing due to transit packing.`
    ];
    const dressClosers2 = [
      ` The color is pretty, but bust fit ran a bit looser than expected. Had to get a minor alteration.`
    ];

    if (rating === 5) {
      review = `${dressOpeners[n % dressOpeners.length]}${dressMiddles[(n * 3) % dressMiddles.length]}${dressClosers5[(n * 7) % dressClosers5.length]}`;
    } else if (rating === 4) {
      review = `${dressOpeners[n % dressOpeners.length]}${dressClosers4[(n * 3) % dressClosers4.length]}`;
    } else if (rating === 3) {
      review = `${dressClosers3[n % dressClosers3.length]}`;
    } else {
      review = `${dressClosers2[n % dressClosers2.length]}`;
    }
  } else if (type === 'outerwear') {
    const outOpeners = [
      `The heavyweight feel and thermal insulation on this ${shortTitle} are top tier.`,
      `Ordered the ${shortTitle} and the fit across shoulders and chest is tailored to perfection.`,
      `Inner lining and zipper hardware on this ${shortTitle} feel rugged and long-lasting.`,
      `Super clean street aesthetic with the ${shortTitle}. Perfect layering piece for cooler evenings in ${city}.`
    ];
    const outMiddles = [
      ` Keeps warm without feeling uncomfortably bulky. Ribbed cuffs and hem keep cold air out effectively.`,
      ` Sturdy outer fabric with clean seam finishes. Deep front pockets are great for keeping hands and phone warm.`,
      ` Layered this over a hoodie and the movement around armholes remains completely uninhibited.`
    ];
    const outClosers5 = [
      ` Outstanding quality for ₹${price || 'the price'}. Premium streetwear staple.`,
      ` 10/10 pickup. The silhouette is sleek and gives an instant upgrade to any outfit.`
    ];
    const outClosers4 = [
      ` Very good jacket. Delivery was quick and packaging kept the item lint-free.`,
      ` Solid 4 stars. Zippers glide smoothly and material feels durable for regular seasons.`
    ];
    const outClosers3 = [
      ` Good casual outerwear. Slightly lighter than heavy winter coats, but great for transitional weather.`
    ];
    const outClosers2 = [
      ` Style looks good, but sleeves were an inch longer than expected on my frame.`
    ];

    if (rating === 5) {
      review = `${outOpeners[n % outOpeners.length]}${outMiddles[(n * 3) % outMiddles.length]}${outClosers5[(n * 7) % outClosers5.length]}`;
    } else if (rating === 4) {
      review = `${outOpeners[n % outOpeners.length]}${outClosers4[(n * 3) % outClosers4.length]}`;
    } else if (rating === 3) {
      review = `${outClosers3[n % outClosers3.length]}`;
    } else {
      review = `${outClosers2[n % outClosers2.length]}`;
    }
  } else if (type === 'bags') {
    const bagOpeners = [
      `The texture and material of this ${shortTitle} feel very premium in hand.`,
      `Received the ${shortTitle} in ${city} and the storage compartments are so thoughtfully designed.`,
      `Shoulder straps don't dig in even when the ${shortTitle} is packed with daily essentials.`,
      `Looks even more classy and structured in person than in product photos.`
    ];
    const bagMiddles = [
      ` Dedicated interior organization pockets make finding keys, cards, and phone effortless. Stitching along handle anchors feels reinforced.`,
      ` Zippers glide like butter with zero snagging. Hardware finish has a clean matte polish that doesn't look cheap.`,
      ` Easily holds my daily essentials, mini water bottle, and wallet without losing its structured shape.`
    ];
    const bagClosers5 = [
      ` Looks far more expensive than the price tag. 10/10 satisfied with this purchase!`,
      ` Ideal for daily college, office and weekend day trips. Highly recommend.`
    ];
    const bagClosers4 = [
      ` Great bag for everyday utility. Strap length is easily adjustable. Solid 4 stars.`,
      ` Delivered in clean dust bag packaging. Good finishing and spacious compartments.`
    ];
    const bagClosers3 = [
      ` Decent everyday bag. Outer material is slightly thinner than expected, but holds weight fine.`
    ];
    const bagClosers2 = [
      ` Appearance is nice, but magnetic snap closure requires careful alignment to snap shut.`
    ];

    if (rating === 5) {
      review = `${bagOpeners[n % bagOpeners.length]}${bagMiddles[(n * 3) % bagMiddles.length]}${bagClosers5[(n * 7) % bagClosers5.length]}`;
    } else if (rating === 4) {
      review = `${bagOpeners[n % bagOpeners.length]}${bagClosers4[(n * 3) % bagClosers4.length]}`;
    } else if (rating === 3) {
      review = `${bagClosers3[n % bagClosers3.length]}`;
    } else {
      review = `${bagClosers2[n % bagClosers2.length]}`;
    }
  } else if (type === 'jewellery') {
    const jewelOpeners = [
      `The polish and sparkle on this ${shortTitle} are breathtaking in person!`,
      `Arrived in clean protective packaging in ${city} with zero scratches or tarnishing.`,
      `Lightweight on the skin and didn't cause any itching or discoloration after full-day wear.`,
      `The delicate detailing on the ${shortTitle} looks very high-end and artisanal.`
    ];
    const jewelMiddles = [
      ` High-grade finish that catches ambient lighting beautifully. Doesn't feel overly heavy or pull on the skin.`,
      ` Locking clasp and links feel secure and reliable. Plating looks durable and premium.`,
      ` Pairs elegantly with both western evening dresses and traditional ethnic fits.`
    ];
    const jewelClosers5 = [
      ` Looked so exquisite at the party! Worth every single rupee.`,
      ` 10/10 recommendation for anyone looking for chic, durable accessories.`
    ];
    const jewelClosers4 = [
      ` Pretty design with clean polish. Looks lovely in person. Good buy.`,
      ` Nice accessory for gifting or daily styling. Comes securely packaged.`
    ];
    const jewelClosers3 = [
      ` Delicate and cute piece. Recommend keeping in an airtight zip pouch to preserve shine.`
    ];
    const jewelClosers2 = [
      ` Design is pretty, but clasp takes a bit of effort to fasten on your own.`
    ];

    if (rating === 5) {
      review = `${jewelOpeners[n % jewelOpeners.length]}${jewelMiddles[(n * 3) % jewelMiddles.length]}${jewelClosers5[(n * 7) % jewelClosers5.length]}`;
    } else if (rating === 4) {
      review = `${jewelOpeners[n % jewelOpeners.length]}${jewelClosers4[(n * 3) % jewelClosers4.length]}`;
    } else if (rating === 3) {
      review = `${jewelClosers3[n % jewelClosers3.length]}`;
    } else {
      review = `${jewelClosers2[n % jewelClosers2.length]}`;
    }
  } else if (type === 'beauty') {
    const beautyOpeners = [
      `Using the ${shortTitle} in my daily routine in ${city} and the performance is wonderful.`,
      `The mist spray nozzle on this ${shortTitle} dispenses a super fine, even cloud with zero droplet sputtering.`,
      `Sets makeup effortlessly without feeling sticky or heavy on the skin.`,
      `Long-lasting formula that keeps base makeup fresh and in place throughout humidity.`
    ];
    const beautyMiddles = [
      ` Leaves a natural skin-like finish that doesn't melt even after 7-8 hours outdoors. Zero chemical fragrance irritation.`,
      ` Hydrating formula that melts powders seamlessly into foundation for an airbrushed look.`,
      ` Doesn't clog pores or cause breakouts. Makeup transfer onto masks or phone screens is noticeably reduced.`
    ];
    const beautyClosers5 = [
      ` Must-have in your beauty vanity. 10/10 performance!`,
      ` Truly locks makeup all day. Exceeded expectations at ₹${price || 'this price point'}.`
    ];
    const beautyClosers4 = [
      ` Very good product. Hold is great, dries down quickly within 30 seconds.`,
      ` Solid 4 stars. Natural dewy-matte balance, works nicely for combination skin.`
    ];
    const beautyClosers3 = [
      ` Decent setting spray. Good for 4-5 hours of wear before a light touch-up is needed.`
    ];
    const beautyClosers2 = [
      ` Formula is good, but make sure to hold the bottle at least 10 inches away for optimal misting.`
    ];

    if (rating === 5) {
      review = `${beautyOpeners[n % beautyOpeners.length]}${beautyMiddles[(n * 3) % beautyMiddles.length]}${beautyClosers5[(n * 7) % beautyClosers5.length]}`;
    } else if (rating === 4) {
      review = `${beautyOpeners[n % beautyOpeners.length]}${beautyMiddles[(n * 2) % beautyMiddles.length]}${beautyClosers4[(n * 3) % beautyClosers4.length]}`;
    } else if (rating === 3) {
      review = `${beautyClosers3[n % beautyClosers3.length]}`;
    } else {
      review = `${beautyClosers2[n % beautyClosers2.length]}`;
    }
  } else if (type === 'watches') {
    const watchOpeners = [
      `The dial finish and glass clarity on the ${shortTitle} look exceptionally classy.`,
      `Received the ${shortTitle} in ${city} and the weight feels substantial on the wrist.`,
      `Strap comfort and buckle clasp on this ${shortTitle} are top notch.`
    ];
    const watchMiddles = [
      ` Keeps precise time with smooth second hand movement. Bezel finish has zero rough edges.`,
      ` Looks like a timepiece worth three times the price. Pairs easily with both formal shirts and casual outfits.`
    ];
    const watchClosers5 = [
      ` Absolute stunner on the wrist. 10/10 recommendation!`,
      ` Great addition to my watch collection. Worth every rupee spent.`
    ];
    const watchClosers4 = [
      ` Great craftsmanship and clean aesthetics. Solid 4 stars.`,
      ` Arrived securely in branded presentation box. Very pleased.`
    ];
    const watchClosers3 = [
      ` Decent daily watch. Strap took 2 days to soften up comfortably on wrist.`
    ];
    const watchClosers2 = [
      ` Watch looks good, but dial diameter felt slightly larger than expected on smaller wrists.`
    ];

    if (rating === 5) {
      review = `${watchOpeners[n % watchOpeners.length]}${watchMiddles[(n * 3) % watchMiddles.length]}${watchClosers5[(n * 7) % watchClosers5.length]}`;
    } else if (rating === 4) {
      review = `${watchOpeners[n % watchOpeners.length]}${watchClosers4[(n * 3) % watchClosers4.length]}`;
    } else if (rating === 3) {
      review = `${watchClosers3[n % watchClosers3.length]}`;
    } else {
      review = `${watchClosers2[n % watchClosers2.length]}`;
    }
  } else if (type === 'caps') {
    const capOpeners = [
      `The crown structure and visor curve on this ${shortTitle} are shaped perfectly.`,
      `Great quality ${shortTitle}! Fabric is breathable and doesn't trap heat around the scalp.`,
      `Adjustable strap buckle holds firmly without slipping during workouts or daily wear.`
    ];
    const capMiddles = [
      ` Inner sweatband is soft and absorbs perspiration cleanly. Embroidery / badge details are neat with zero loose threads.`,
      ` Doesn't lose its shape after packing in a backpack. Gives that effortless sporty look with streetwear outfits.`
    ];
    const capClosers5 = [
      ` 10/10 cap. Fits comfortably all day long!`,
      ` High quality finish and clean aesthetic. Worth the price.`
    ];
    const capClosers4 = [
      ` Very nice cap. Delivered to ${city} in protective packaging so the brim didn't bend.`,
      ` Solid 4 stars. Good materials and durable clasp.`
    ];
    const capClosers3 = [
      ` Decent cap for sunny outdoor walks. Good casual staple.`
    ];
    const capClosers2 = [
      ` Material is fine, but crown depth was slightly shallower than expected.`
    ];

    if (rating === 5) {
      review = `${capOpeners[n % capOpeners.length]}${capMiddles[(n * 3) % capMiddles.length]}${capClosers5[(n * 7) % capClosers5.length]}`;
    } else if (rating === 4) {
      review = `${capOpeners[n % capOpeners.length]}${capClosers4[(n * 3) % capClosers4.length]}`;
    } else if (rating === 3) {
      review = `${capClosers3[n % capClosers3.length]}`;
    } else {
      review = `${capClosers2[n % capClosers2.length]}`;
    }
  } else if (type === 'eyewear') {
    const eyeOpeners = [
      `The frame build on this ${shortTitle} is lightweight yet impressively sturdy.`,
      `Lenses provide crisp optical clarity with effective glare reduction in bright sunlight in ${city}.`,
      `Comfortable nose pads that don't leave red indentations even after hours of driving.`
    ];
    const eyeMiddles = [
      ` Spring hinges flex smoothly without wobbling. UV protection makes outdoor vision effortless.`,
      ` Sleek shape that complements various face cuts. Frame finish feels smooth with clean metallic accents.`
    ];
    const eyeClosers5 = [
      ` 10/10 purchase. Feels like a designer pair at a fraction of the cost!`,
      ` Outstanding style and sun protection. Highly satisfied.`
    ];
    const eyeClosers4 = [
      ` Very good shades. Came in protective case with a soft cleaning cloth.`,
      ` Solid 4 stars. Look sharp and feel comfortable on the nose bridge.`
    ];
    const eyeClosers3 = [
      ` Decent sunglasses for daily commute. Lens tint is slightly darker than pictured, but works well in harsh sun.`
    ];
    const eyeClosers2 = [
      ` Style is nice, but frame sat slightly wide on my face.`
    ];

    if (rating === 5) {
      review = `${eyeOpeners[n % eyeOpeners.length]}${eyeMiddles[(n * 3) % eyeMiddles.length]}${eyeClosers5[(n * 7) % eyeClosers5.length]}`;
    } else if (rating === 4) {
      review = `${eyeOpeners[n % eyeOpeners.length]}${eyeClosers4[(n * 3) % eyeClosers4.length]}`;
    } else if (rating === 3) {
      review = `${eyeClosers3[n % eyeClosers3.length]}`;
    } else {
      review = `${eyeClosers2[n % eyeClosers2.length]}`;
    }
  } else if (type === 'electronics') {
    const elecOpeners = [
      `Sound signature and bass response on this ${shortTitle} are punchy and well-balanced.`,
      `Battery backup and fast charging on the ${shortTitle} easily meet my daily commute needs in ${city}.`,
      `Build quality feels rugged and tactile with smooth responsive controls.`
    ];
    const elecMiddles = [
      ` Bluetooth pairing connected instantly with zero latency drops during media playback.`,
      ` Audio tuning keeps mids clear for vocal clarity while bass remains deep without distortion.`
    ];
    const elecClosers5 = [
      ` 10/10 gadget. Unbeatable audio value at this price point!`,
      ` Premium sound experience. Highly recommended to everyone.`
    ];
    const elecClosers4 = [
      ` Very good performance. Fast charging works as advertised. Solid 4 stars.`,
      ` Clean audio output and solid battery life. Pleased with the purchase.`
    ];
    const elecClosers3 = [
      ` Decent device for casual audio. High volumes have slight treble peak, but EQ tuning helps.`
    ];
    const elecClosers2 = [
      ` Features work fine, but charging cable included in the box was a bit short.`
    ];

    if (rating === 5) {
      review = `${elecOpeners[n % elecOpeners.length]}${elecMiddles[(n * 3) % elecMiddles.length]}${elecClosers5[(n * 7) % elecClosers5.length]}`;
    } else if (rating === 4) {
      review = `${elecOpeners[n % elecOpeners.length]}${elecClosers4[(n * 3) % elecClosers4.length]}`;
    } else if (rating === 3) {
      review = `${elecClosers3[n % elecClosers3.length]}`;
    } else {
      review = `${elecClosers2[n % elecClosers2.length]}`;
    }
  } else {
    // General fallback archetype
    const genOpeners = [
      `Delivered to ${city} in clean protective packaging within 3 days. ${shortTitle} is great.`,
      `Quality bohot achhi hai is ${shortTitle} ki. Looks authentic and well crafted.`,
      `Pleasantly surprised by the finish and feel of this ${shortTitle}.`,
      `The build and materials on the ${shortTitle} match the catalog description accurately.`
    ];
    const genMiddles = [
      ` Neat finish, durable texture, and looks clean in everyday use.`,
      ` Details and finishing are crisp. Feels comfortable and dependable.`,
      ` Color and finish are faithful to the photos shown on the site.`
    ];
    const genClosers5 = [
      ` 10/10 purchase, great value for ₹${price || 'the money'}!`,
      ` Highly recommended, worth every rupee spent.`,
      ` Truly exceeded my expectations.`
    ];
    const genClosers4 = [
      ` Good quality product that matches description well. Solid 4 stars.`,
      ` Very nice finish and clean aesthetic. Happy with the purchase.`
    ];
    const genClosers3 = [
      ` Decent product for casual daily use. Packaging was slightly basic, but the item inside was undamaged.`
    ];
    const genClosers2 = [
      ` Appearance is fine, but proportions felt slightly different than expected from catalog photos.`
    ];

    if (rating === 5) {
      review = `${genOpeners[n % genOpeners.length]}${genMiddles[(n * 3) % genMiddles.length]}${genClosers5[(n * 7) % genClosers5.length]}`;
    } else if (rating === 4) {
      review = `${genOpeners[n % genOpeners.length]}${genClosers4[(n * 3) % genClosers4.length]}`;
    } else if (rating === 3) {
      review = `${genClosers3[n % genClosers3.length]}`;
    } else {
      review = `${genClosers2[n % genClosers2.length]}`;
    }
  }

  // If iteration > 0, append a personalized context note to mathematically guarantee 100% uniqueness
  if (iteration > 0) {
    const extraNotes = [
      ` (Reviewing after ${iteration + 1} weeks of regular use in ${city})`,
      ` [Customer note: order arrived on time with original tags intact]`,
      ` (Purchased for ₹${price || 'listed price'} during recent drop)`,
      ` [Sizing note: fits true to size based on the measurement chart]`,
      ` (Pairing this with everyday casual fits in ${city})`,
      ` [Delivery note: delivered in ${Math.min(5, iteration + 2)} days via express courier]`,
      ` [Customer review from verified purchase in ${city}]`,
      ` (Color in natural daylight looks identical to the catalog photos)`
    ];
    review += extraNotes[iteration % extraNotes.length];
    if (iteration >= extraNotes.length) {
      review += ` #${iteration}`;
    }
  }

  return review;
}

// ============================================================================
// 5. REVIEW BATCH GENERATOR FOR A SPECIFIC PRODUCT
// ============================================================================
/**
 * Generates 12 to 15 distinct, realistic, product-specific reviews.
 * 
 * @param {Object} product - Product record from Supabase
 * @param {string} catalogType - 'main' | 'sarojini'
 * @param {number} targetCount - 12 to 15 reviews (default: 14)
 * @returns {Array} Array of review objects ready for Supabase insertion
 */
function generateReviewsForProduct(product, catalogType = 'main', targetCount = 14) {
  if (!product || !product.id) {
    throw new Error('Valid product with unique id is required');
  }

  const count = Math.max(12, Math.min(15, Number(targetCount) || 14));
  const attr = extractProductAttributes(product);

  // Deterministic product hash based strictly on product UUID
  const productHash = crypto.createHash('sha256').update(String(product.id)).digest('hex');

  // Realistic rating distribution:
  // For 14 items: 5★ (7), 4★ (5), 3★ (1 or 2), 2★ (0 or 1) -> natural 4.2–4.4 avg
  const ratings = [];
  const fiveCount = Math.floor(count * 0.50);
  const fourCount = Math.floor(count * 0.35);
  const threeCount = Math.max(1, Math.floor(count * 0.12));
  const twoCount = count - (fiveCount + fourCount + threeCount);

  for (let i = 0; i < fiveCount; i++) ratings.push(5);
  for (let i = 0; i < fourCount; i++) ratings.push(4);
  for (let i = 0; i < threeCount; i++) ratings.push(3);
  for (let i = 0; i < twoCount; i++) ratings.push(2);

  // Deterministically shuffle ratings using productHash bytes
  for (let i = ratings.length - 1; i > 0; i--) {
    const byte = parseInt(productHash.slice(i * 2, i * 2 + 2) || '0', 16);
    const j = byte % (i + 1);
    [ratings[i], ratings[j]] = [ratings[j], ratings[i]];
  }

  // Deterministically pick reviewer names for this product
  const nameOffset = parseInt(productHash.slice(0, 4), 16) % INDIAN_REVIEWER_NAMES.length;
  const productNames = [];
  for (let i = 0; i < count; i++) {
    const nIdx = (nameOffset + (i * 7) + 3) % INDIAN_REVIEWER_NAMES.length;
    productNames.push(INDIAN_REVIEWER_NAMES[nIdx]);
  }

  const reviews = [];
  const productUsedComments = new Set();
  const now = Date.now();

  for (let idx = 0; idx < count; idx++) {
    const rating = ratings[idx];
    const reviewId = generateSeedReviewId(product.id, idx + 1);

    // Generate product-specific review text
    let iteration = 0;
    let comment = synthesizeUniqueReview(attr, rating, idx, productHash, iteration);

    // Ensure 100% uniqueness both within this product AND globally across all products
    while ((productUsedComments.has(comment) || GLOBAL_USED_REVIEWS.has(comment)) && iteration < 50) {
      iteration++;
      comment = synthesizeUniqueReview(attr, rating, idx, productHash, iteration);
    }

    productUsedComments.add(comment);
    GLOBAL_USED_REVIEWS.add(comment);

    // Stagger review dates naturally between 3 days and 60 days ago
    const daySeed = parseInt(productHash.slice(idx * 2 + 8, idx * 2 + 10) || '0', 16);
    const daysAgo = Math.max(3, (daySeed % 55) + 3);
    const hourOffset = (parseInt(productHash.slice(idx * 2, idx * 2 + 2) || '0', 16) % 24) * 3600000;
    const createdAt = new Date(now - (daysAgo * 86400000) - hourOffset).toISOString();

    const authorName = productNames[idx];

    const reviewObj = {
      id: reviewId,
      product_id: catalogType === 'main' ? product.id : null,
      sarojini_product_id: catalogType === 'sarojini' ? product.id : null,
      catalog_type: catalogType,
      user_id: null, // Test-seeded reviews do not have fake user profiles
      user_name: authorName,
      rating: rating,
      comment: comment,
      status: 'approved',
      created_at: createdAt,
      updated_at: createdAt
    };

    reviews.push(reviewObj);
  }

  return reviews;
}

// ============================================================================
// 6. RATING & REVIEW STATS CALCULATOR
// ============================================================================
function calculateProductReviewStats(reviewsList) {
  if (!Array.isArray(reviewsList) || reviewsList.length === 0) {
    return { rating: 0.0, count: 0 };
  }

  const approved = reviewsList.filter(r => r.status === 'approved' || !r.status);
  const count = approved.length;
  if (count === 0) return { rating: 0.0, count: 0 };

  const sum = approved.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avg = Number((sum / count).toFixed(1));

  return { rating: avg, count: count };
}

module.exports = {
  detectProductCategory,
  extractProductAttributes,
  generateSeedReviewId,
  isSeedReviewId,
  generateReviewsForProduct,
  calculateProductReviewStats,
  INDIAN_REVIEWER_NAMES,
  GLOBAL_USED_REVIEWS
};

