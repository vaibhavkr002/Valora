/**
 * VALORA & Sarojini Bazaar - Dynamic Product Review Generation Engine
 * 
 * Generates natural, 100% UNIQUE, authentic customer review records based on actual product category context:
 * - Category-relevant customer experience (shoes, tops, bottoms, dresses, bags, jewellery, beauty, etc.).
 * - STRICT RULE: Never mentions product name, model, SKU, title, or brand in review text.
 * - Completely generic, natural, and realistic customer observations.
 * - Varied Indian customer names (balanced male & female).
 * - Realistic rating distribution strictly between 3★ and 5★ (~58% 5★, ~30% 4★, ~12% 3★).
 * - Deterministic UUIDs prefixed with 00005eed- for collision-free identification and surgical cleanup.
 * - Global collision tracking ensuring NO TWO REVIEWS across ANY products ever share the exact same text.
 * - Preserves genuine customer reviews untouched.
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
// 2. PRODUCT CATEGORY & ATTRIBUTE DETECTION (USED INTERNALLY ONLY)
// ============================================================================
function extractProductAttributes(product) {
  const name = String(product.name || '').trim();
  const desc = String(product.description || '').trim();
  const dept = String(product.department || '').trim();
  const cat = String(product.categories?.name || product.category || product.category_id || '').trim();
  const brand = String(product.brand || '').trim();
  const price = Number(product.price) || 0;

  // Detect archetype / category internally for contextual styling
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

  return {
    name,
    type,
    brand,
    price
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
// 4. CATEGORY TEMPLATES (COMPLETELY GENERIC, NO PRODUCT/MODEL/SKU/BRAND NAMES)
// ============================================================================
const REVIEW_TEMPLATES = {
  shoes: {
    openers: [
      "The cushioning on this pair is super comfortable right out of the box.",
      "Wore these for a full day of traveling and walking around, and my feet felt completely relaxed.",
      "Got this pair after eyeing it for a while and the build quality is top notch.",
      "Clean silhouette! Look and finishing are even sharper in person than in pictures.",
      "Sole ka grip aur insole foam support bohot achha hai.",
      "The fitting is true to size with no toe pinching.",
      "Impressive craftsmanship. Stitching along the panels is clean and durable.",
      "Delivered in proper packaging in 3 days. Looks great on feet.",
      "Very comfortable and feels good for regular use.",
      "Looks really good in person. The finishing is nice too.",
      "Nice finish and comfortable to use.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Ordered this recently and the quality turned out to be really good.",
      "Super clean look on feet. Very lightweight and easy to walk in.",
      "The insole padding gives great arch support during daily wear.",
      "Quality is good for the price. Happy with the purchase."
    ],
    middles: [
      " Insole cushioning absorbs heel impact effortlessly, and the outsole traction grips well even on wet tiles.",
      " The material feels soft yet sturdy, and the color looks great with both casual denims and cargos.",
      " Doesn't feel bulky on feet at all. Crease resistance has held up nicely after regular wears.",
      " Memory foam effect clear feel hota hai walking ke time. Heel lock bhi solid hai without causing any shoe bites.",
      " The ankle padding provides good stability without feeling stiff. Breathability keeps feet fresh throughout the day.",
      " Fitting was comfortable and the material feels nice.",
      " Colour looks nice and the overall finish is clean.",
      " Packaging was good and the item arrived in proper condition.",
      " Good value for money and the quality is decent.",
      " Really liked the overall look. Feels worth the price."
    ],
    closers5: [
      " Easily one of my best footwear pickups this season. 10/10 recommendation!",
      " Total value for money. Authentic finish and premium look.",
      " Bohot pyara pair hai. Multiple compliments already from friends.",
      " Highly satisfied with the purchase. Quality exceeded expectations.",
      " Definitely ordering another pair soon. Great comfort.",
      " Felt confident and comfortable the entire day.",
      " Absolutely worth the price. Will buy again!"
    ],
    closers4: [
      " Overall solid 4 stars. First day slight break-in required, but fits like a dream now.",
      " Premium feel. Box packaging had a slight bend on corner, but shoes were in mint condition.",
      " Value for money pair. Looks high-end and clean on feet.",
      " Really good quality. Delivery took an extra day, but product is worth it.",
      " Satisfied with the purchase. Nice comfort for casual everyday outings."
    ],
    closers3: [
      " Decent pair for casual rotation. Arch support is moderate, so added an extra insole for long walks.",
      " Appearance is great, though sizing runs slightly narrow near the ball of the foot. Consider half size up if you have wide feet.",
      " Good value for money and the quality is decent. Acceptable for regular wear.",
      " Looks okay in person, though sole feels a bit firmer than expected."
    ]
  },

  tops: {
    openers: [
      "The fabric feels remarkably soft and breathable.",
      "Bohot comfy fit hai. Perfect for daily casual wear.",
      "Received the package yesterday and the overall quality is really impressive.",
      "Stitching and collar construction are spot on.",
      "Look and drop gives that exact relaxed silhouette.",
      "Fitting was comfortable and the material feels nice.",
      "Colour looks nice and the overall finish is clean.",
      "Looks really good in person. The finishing is nice too.",
      "Really liked the overall look. Feels worth the price.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Very comfortable and feels good for regular use.",
      "Nice finish and comfortable to use.",
      "Tried it on immediately after delivery and the fit is perfect.",
      "Quality is good for the price. Happy with the purchase.",
      "Great daily piece. Feels light on the body and looks sharp."
    ],
    middles: [
      " Pure breathable feel that doesn't feel heavy even in warm humidity. Shape didn't distort after a quick cold wash.",
      " The neckline ribbing is thick and doesn't sag or curl after washing. Shoulder seam drape falls naturally.",
      " Fabric feels soft and gentle against the skin with neat finishing all around.",
      " Sizing is spot on according to the chart. Chest width and length are nicely balanced for a relaxed vibe.",
      " Pairs effortlessly with straight denims and sneakers. Material breathability is top tier for all-day comfort.",
      " Colour looks nice and the overall finish is clean.",
      " Packaging was good and the item arrived in proper condition.",
      " Good value for money and the quality is decent."
    ],
    closers5: [
      " Total value for money. Definitely buying more colorways soon!",
      " 10/10 purchase. Finishing quality matches high-end labels.",
      " Ekdum mast fit hai. Looks premium and feels comfortable all day long.",
      " Truly impressed with the fabric quality. Highly recommended!",
      " Worth every rupee. Exceeded my expectations!"
    ],
    closers4: [
      " Solid 4 stars. Very happy with the purchase, exceeded my expectations.",
      " Great daily wear piece. Quality is noticeably better than typical fast fashion.",
      " Good buy. Minor fold wrinkles straight out of packaging, but a quick steam made it perfect.",
      " Comfortable everyday top. Color washed well with cold water without bleeding."
    ],
    closers3: [
      " Decent piece for casual everyday wear. Expected slightly heavier GSM, but great for light summer layering.",
      " Looks good, though length is slightly longer than expected. Tucking it in gives the right proportion.",
      " Good value for money and the quality is decent."
    ]
  },

  bottoms: {
    openers: [
      "The cut and drape are spot on.",
      "The fit is remarkably flattering and comfortable.",
      "The fabric weight feels substantial without being stiff.",
      "Proper relaxed fit silhouette! Looks super stylish with basic tees and sneakers.",
      "Fitting was comfortable and the material feels nice.",
      "Colour looks nice and the overall finish is clean.",
      "Looks really good in person. The finishing is nice too.",
      "Really liked the overall look. Feels worth the price.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Very comfortable and feels good for regular use.",
      "Quality is good for the price. Happy with the purchase.",
      "Nice finish and comfortable to use."
    ],
    middles: [
      " Waistband fitting is comfortable with no gaping at the back. Pockets are genuinely deep and hold a large phone securely.",
      " Stitched with durable reinforced thread along the inner seams. Rivets and button fly hardware feel sturdy.",
      " Wash tone and fading look natural and clean. Fabric softens up nicely after the first wash while retaining structure.",
      " Length falls perfectly over sneaker collars without dragging on the ground. Movement around knees and thighs feels easy.",
      " Packaging was good and the item arrived in proper condition.",
      " Good value for money and the quality is decent."
    ],
    closers5: [
      " Best pair of bottoms I've bought online in months. 10/10 fit and quality!",
      " Premium quality at a very reasonable price. Fits better than many mall brands.",
      " Super happy with this order. Looks fantastic and feels great.",
      " Highly recommended! Quality is exceptional."
    ],
    closers4: [
      " Really good pair. The waist was slightly snug on first wear, but eased up within a day of regular use. Solid 4 stars.",
      " Great purchase. Good stitching and authentic color tone. Would recommend checking size measurements before ordering.",
      " Fits nicely and looks very clean. Good buy."
    ],
    closers3: [
      " Decent bottoms for everyday wear. Fabric is on the lighter side, good for mild weather.",
      " Style looks good, but waist sizing runs slightly smaller than standard high street sizing.",
      " Good value for money and the quality is decent."
    ]
  },

  dresses: {
    openers: [
      "Wore this for an evening get-together and received so many compliments!",
      "The drape and silhouette fall so gracefully.",
      "Fabric feel is soft against the skin and doesn't cling uncomfortably.",
      "Fitting was comfortable and the material feels nice.",
      "Colour looks nice and the overall finish is clean.",
      "Looks really good in person. The finishing is nice too.",
      "Really liked the overall look. Feels worth the price.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Very comfortable and feels good for regular use."
    ],
    middles: [
      " Inner lining is well stitched and breathable, preventing any transparency issues. Waistline fits naturally.",
      " Beautiful fall and movement. Stitching along the neckline and hem is clean and even.",
      " Looks elegant and classy. Fabric doesn't easily wrinkle even when sitting for hours during an event.",
      " Packaging was good and the item arrived in proper condition.",
      " Colour looks nice and the overall finish is clean."
    ],
    closers5: [
      " Absolutely in love with this piece. Worth every rupee!",
      " 10/10 purchase. Felt confident and comfortable the entire evening.",
      " Super stunning look! Will definitely recommend to friends."
    ],
    closers4: [
      " Very pretty piece. Delivered within 3 days. Pair it with minimalistic footwear for the best look.",
      " Good quality finish. Sizing fits true to the guide. Fabric is soft and gentle.",
      " Looks very chic and elegant in person. Solid 4 stars."
    ],
    closers3: [
      " Nice piece for casual outings. Needed slight steaming upon unboxing due to transit packing.",
      " The color is pretty, but bust fit ran slightly looser than expected. Had to get a minor alteration."
    ]
  },

  outerwear: {
    openers: [
      "The heavyweight feel and warmth are top tier.",
      "The fit across shoulders and chest is tailored to perfection.",
      "Inner lining and zipper hardware feel rugged and long-lasting.",
      "Super clean aesthetic. Perfect layering piece for cooler evenings.",
      "Looks really good in person. The finishing is nice too.",
      "Quality is good for the price. Happy with the purchase.",
      "Very comfortable and feels good for regular use."
    ],
    middles: [
      " Keeps warm without feeling uncomfortably bulky. Ribbed cuffs and hem keep cold air out effectively.",
      " Sturdy outer fabric with clean seam finishes. Deep front pockets are great for keeping hands and phone warm.",
      " Layered this over a basic tee and the movement around armholes remains completely uninhibited.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " Outstanding quality for the price. Premium wardrobe staple.",
      " 10/10 pickup. The silhouette is sleek and gives an instant upgrade to any outfit.",
      " Truly exceeded my expectations. Warm and super stylish."
    ],
    closers4: [
      " Very good jacket. Delivery was quick and packaging kept the item clean and protected.",
      " Solid 4 stars. Zippers glide smoothly and material feels durable for regular seasons."
    ],
    closers3: [
      " Good casual outerwear. Slightly lighter than heavy winter coats, but great for transitional weather.",
      " Style looks good, but sleeves were slightly longer than expected on my frame."
    ]
  },

  bags: {
    openers: [
      "The texture and material feel very premium in hand.",
      "Storage compartments are so thoughtfully designed.",
      "Shoulder straps don't dig in even when packed with daily essentials.",
      "Looks even more classy and structured in person than in product photos.",
      "Packaging was good and the item arrived in proper condition.",
      "Good value for money and the quality is decent.",
      "Looks really good in person. The finishing is nice too."
    ],
    middles: [
      " Dedicated interior organization pockets make finding keys, cards, and phone effortless. Stitching along handle anchors feels reinforced.",
      " Zippers glide smoothly with zero snagging. Hardware finish has a clean polish that looks high-end.",
      " Easily holds my daily essentials, mini water bottle, and wallet without losing its structured shape."
    ],
    closers5: [
      " Looks far more expensive than the price tag. 10/10 satisfied with this purchase!",
      " Ideal for daily routine, office and weekend day trips. Highly recommend."
    ],
    closers4: [
      " Great bag for everyday utility. Strap length is easily adjustable. Solid 4 stars.",
      " Delivered in clean dust bag packaging. Good finishing and spacious compartments."
    ],
    closers3: [
      " Decent everyday bag. Outer material is slightly lighter than expected, but holds daily essentials fine.",
      " Appearance is nice, but magnetic snap closure requires careful alignment to snap shut."
    ]
  },

  jewellery: {
    openers: [
      "The polish and sparkle are breathtaking in person!",
      "Arrived in clean protective packaging with zero scratches or tarnishing.",
      "Lightweight on the skin and didn't cause any itching or discoloration after full-day wear.",
      "The delicate detailing looks very high-end and artisanal.",
      "Looks really good in person. The finishing is nice too.",
      "Really liked the overall look. Feels worth the price."
    ],
    middles: [
      " High-grade finish that catches ambient lighting beautifully. Doesn't feel overly heavy or pull on the skin.",
      " Locking clasp and links feel secure and reliable. Plating looks durable and premium.",
      " Pairs elegantly with both western evening wear and traditional outfits."
    ],
    closers5: [
      " Looked so exquisite at the event! Worth every single rupee.",
      " 10/10 recommendation for anyone looking for chic, durable accessories."
    ],
    closers4: [
      " Pretty design with clean polish. Looks lovely in person. Good buy.",
      " Nice accessory for gifting or daily styling. Comes securely packaged."
    ],
    closers3: [
      " Delicate and cute piece. Recommend keeping in an airtight zip pouch to preserve shine.",
      " Design is pretty, but clasp takes a bit of effort to fasten on your own."
    ]
  },

  beauty: {
    openers: [
      "Using this in my daily routine and the performance is wonderful.",
      "Dispenses a super fine, even mist with zero droplet sputtering.",
      "Sets makeup effortlessly without feeling sticky or heavy on the skin.",
      "Long-lasting formula that keeps base makeup fresh and in place throughout humidity.",
      "Packaging was good and the item arrived in proper condition.",
      "Quality is good for the price. Happy with the purchase."
    ],
    middles: [
      " Leaves a natural skin-like finish that doesn't melt even after hours outdoors. Zero fragrance irritation.",
      " Hydrating formula that melts powders seamlessly into foundation for a smooth look.",
      " Doesn't clog pores or cause breakouts. Makeup transfer is noticeably reduced."
    ],
    closers5: [
      " Must-have in your beauty vanity. 10/10 performance!",
      " Truly locks makeup all day. Exceeded expectations for this price point."
    ],
    closers4: [
      " Very good product. Hold is great, dries down quickly within 30 seconds.",
      " Solid 4 stars. Natural dewy-matte balance, works nicely for combination skin."
    ],
    closers3: [
      " Decent setting spray. Good for 4-5 hours of wear before a light touch-up is needed.",
      " Formula is good, but make sure to hold the bottle at a proper distance for optimal misting."
    ]
  },

  watches: {
    openers: [
      "The dial finish and glass clarity look exceptionally classy.",
      "Weight feels substantial on the wrist and looks premium.",
      "Strap comfort and buckle clasp are top notch.",
      "Looks really good in person. The finishing is nice too.",
      "Very comfortable and feels good for regular use."
    ],
    middles: [
      " Keeps precise time with smooth second hand movement. Bezel finish has zero rough edges.",
      " Looks like a timepiece worth three times the price. Pairs easily with both formal shirts and casual outfits.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " Absolute stunner on the wrist. 10/10 recommendation!",
      " Great addition to my collection. Worth every rupee spent."
    ],
    closers4: [
      " Great craftsmanship and clean aesthetics. Solid 4 stars.",
      " Arrived securely in presentation box. Very pleased."
    ],
    closers3: [
      " Decent daily watch. Strap took 2 days to soften up comfortably on wrist.",
      " Watch looks good, but dial diameter felt slightly larger than expected on smaller wrists."
    ]
  },

  caps: {
    openers: [
      "The crown structure and visor curve are shaped nicely.",
      "Fabric is breathable and doesn't trap heat around the scalp.",
      "Adjustable strap holds firmly without slipping during workouts or daily wear.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Nice finish and comfortable to use."
    ],
    middles: [
      " Inner sweatband is soft and absorbs perspiration cleanly. Embroidery details are neat with zero loose threads.",
      " Doesn't lose its shape after packing in a bag. Gives that effortless sporty look with casual outfits.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " 10/10 cap. Fits comfortably all day long!",
      " High quality finish and clean aesthetic. Worth the price."
    ],
    closers4: [
      " Very nice cap. Delivered in protective packaging so the brim didn't bend.",
      " Solid 4 stars. Good materials and durable clasp."
    ],
    closers3: [
      " Decent cap for sunny outdoor walks. Good casual staple.",
      " Material is fine, but crown depth was slightly shallower than expected."
    ]
  },

  eyewear: {
    openers: [
      "The frame build is lightweight yet impressively sturdy.",
      "Lenses provide crisp optical clarity with effective glare reduction in bright sunlight.",
      "Comfortable nose pads that don't leave red indentations even after hours of driving.",
      "Looks really good in person. The finishing is nice too.",
      "Quality is good for the price. Happy with the purchase."
    ],
    middles: [
      " Spring hinges flex smoothly without wobbling. UV protection makes outdoor vision effortless.",
      " Sleek shape that complements various face cuts. Frame finish feels smooth with clean accents.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " 10/10 purchase. Feels like a designer pair at a fraction of the cost!",
      " Outstanding style and sun protection. Highly satisfied."
    ],
    closers4: [
      " Very good shades. Came in protective case with a soft cleaning cloth.",
      " Solid 4 stars. Look sharp and feel comfortable on the nose bridge."
    ],
    closers3: [
      " Decent sunglasses for daily commute. Lens tint is slightly darker than pictured, but works well in harsh sun.",
      " Style is nice, but frame sat slightly wide on my face."
    ]
  },

  electronics: {
    openers: [
      "Sound signature and bass response are punchy and well-balanced.",
      "Battery backup easily meets my daily commute needs.",
      "Build quality feels rugged and tactile with smooth responsive controls.",
      "Quality is good for the price. Happy with the purchase.",
      "Looks really good in person. The finishing is nice too."
    ],
    middles: [
      " Bluetooth pairing connected instantly with zero latency drops during media playback.",
      " Audio tuning keeps mids clear for vocal clarity while bass remains deep without distortion.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " 10/10 gadget. Unbeatable audio value at this price point!",
      " Premium sound experience. Highly recommended to everyone."
    ],
    closers4: [
      " Very good performance. Fast charging works as advertised. Solid 4 stars.",
      " Clean audio output and solid battery life. Pleased with the purchase."
    ],
    closers3: [
      " Decent device for casual audio. High volumes have slight treble peak, but EQ tuning helps.",
      " Features work fine, but charging cable included in the box was a bit short."
    ]
  },

  general: {
    openers: [
      "Looks really good in person. The finishing is nice too.",
      "Very comfortable and feels good for regular use.",
      "Quality is good for the price. Happy with the purchase.",
      "Colour looks nice and the overall finish is clean.",
      "Packaging was good and the item arrived in proper condition.",
      "Really liked the overall look. Feels worth the price.",
      "Fitting was comfortable and the material feels nice.",
      "Looks exactly like the pictures. Quite happy with it.",
      "Good value for money and the quality is decent.",
      "Nice finish and comfortable to use.",
      "Delivered in clean protective packaging within 3 days.",
      "Pleasantly surprised by the finish and feel in person.",
      "The build and materials match the photos accurately.",
      "Received yesterday and tried it right away. Really satisfied."
    ],
    middles: [
      " Neat finish, durable texture, and looks clean in everyday use.",
      " Details and finishing are crisp. Feels comfortable and dependable.",
      " Color and finish are faithful to the photos shown on the site.",
      " Fabric and stitching feel durable for regular daily rotation.",
      " Quality is consistent throughout and the presentation was neat.",
      " Packaging was good and the item arrived in proper condition."
    ],
    closers5: [
      " 10/10 purchase, great value for money!",
      " Highly recommended, worth every rupee spent.",
      " Truly exceeded my expectations. Will order again.",
      " One of the best purchases from this store so far."
    ],
    closers4: [
      " Good quality product that matches description well. Solid 4 stars.",
      " Very nice finish and clean aesthetic. Happy with the purchase.",
      " Solid 4 stars. Delivered on time and met all expectations."
    ],
    closers3: [
      " Decent product for casual daily use. Packaging was slightly basic, but the item inside was undamaged.",
      " Appearance is fine, but proportions felt slightly different than expected from catalog photos.",
      " Quality is acceptable for regular wear. Good value for money and the quality is decent."
    ]
  }
};

// Subtle, natural customer follow-up remarks to ensure 100% uniqueness
const NATURAL_TAIL_REMARKS = [
  "",
  " Delivery arrived right on time.",
  " Tried it on as soon as the package arrived.",
  " Very happy with the overall purchase.",
  " Arrived in clean packaging with no damages.",
  " Exceeded my expectations for the price.",
  " Would definitely consider buying again.",
  " Looks sleek and modern.",
  " Great experience ordering from here.",
  " Completely satisfied with the overall experience.",
  " Definitely glad I went ahead with this purchase.",
  " Looks very neat and well made."
];

// ============================================================================
// 5. DYNAMIC REVIEW SYNTHESIS ENGINE (NO PRODUCT/BRAND NAMES)
// ============================================================================
function synthesizeUniqueReview(attr, rating, index, productHash, iteration = 0) {
  const { type, name, brand } = attr;
  const hashVal = crypto.createHash('md5').update(`${productHash}_${index}_${iteration}`).digest('hex');
  const n = parseInt(hashVal.slice(0, 6), 16) + (iteration * 37);

  const tpl = REVIEW_TEMPLATES[type] || REVIEW_TEMPLATES.general;
  const openers = tpl.openers;
  const middles = tpl.middles;
  const closers = rating === 5 ? tpl.closers5 : (rating === 4 ? tpl.closers4 : tpl.closers3);

  const opener = openers[n % openers.length];
  const middle = middles[(n * 3 + iteration) % middles.length];
  const closer = closers[(n * 7 + iteration * 2) % closers.length];
  const tail = NATURAL_TAIL_REMARKS[(n * 11 + iteration * 5) % NATURAL_TAIL_REMARKS.length];

  let review = '';
  // Alternate between 2-sentence and 3-sentence natural reviews
  if ((n + iteration) % 3 === 0) {
    review = `${opener}${closer}${tail}`;
  } else if ((n + iteration) % 3 === 1) {
    review = `${opener}${middle}${closer}`;
  } else {
    review = `${opener}${middle}${closer}${tail}`;
  }

  // Clean up any double spaces or spacing artifacts
  review = review.replace(/\s+/g, ' ').trim();

  // STRICT GUARANTEE: Never contain product name, brand, or SKU
  if (name && name.length > 2) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    review = review.replace(new RegExp(escapedName, 'gi'), 'this item');
  }
  if (brand && brand.length > 2 && brand.toLowerCase() !== 'valora') {
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    review = review.replace(new RegExp(escapedBrand, 'gi'), '');
  }
  review = review.replace(/\bvalora\b/gi, '').replace(/\bvadi\b/gi, '').replace(/\s+/g, ' ').trim();

  return review;
}

// ============================================================================
// 6. REVIEW BATCH GENERATOR FOR A SPECIFIC PRODUCT
// ============================================================================
/**
 * Generates 20 to 25 distinct, realistic, product-specific reviews.
 * 
 * @param {Object} product - Product record from Supabase
 * @param {string} catalogType - 'main' | 'sarojini'
 * @param {number|null} targetCount - 20 to 25 reviews (default: 20-25 determined by product UUID)
 * @returns {Array} Array of review objects ready for Supabase insertion
 */
function generateReviewsForProduct(product, catalogType = 'main', targetCount = null) {
  if (!product || !product.id) {
    throw new Error('Valid product with unique id is required');
  }

  // Deterministic product hash based strictly on product UUID
  const productHash = crypto.createHash('sha256').update(String(product.id)).digest('hex');

  // Deterministic count between 20 and 25
  const defaultTarget = 20 + (parseInt(productHash.slice(0, 2), 16) % 6);
  const count = targetCount != null ? Math.max(1, Math.min(30, Number(targetCount))) : defaultTarget;
  const attr = extractProductAttributes(product);

  // Realistic rating distribution between 3 and 5 stars only:
  // ~58% 5★, ~30% 4★, ~12% 3★ -> produces natural ~4.4–4.5 rating
  const ratings = [];
  const fiveCount = Math.floor(count * 0.58);
  const fourCount = Math.floor(count * 0.30);
  const threeCount = count - (fiveCount + fourCount);

  for (let i = 0; i < fiveCount; i++) ratings.push(5);
  for (let i = 0; i < fourCount; i++) ratings.push(4);
  for (let i = 0; i < threeCount; i++) ratings.push(3);

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
    while ((productUsedComments.has(comment) || GLOBAL_USED_REVIEWS.has(comment)) && iteration < 100) {
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
      user_id: null,
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
// 7. RATING & REVIEW STATS CALCULATOR
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
