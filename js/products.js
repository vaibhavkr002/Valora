/**
 * VELORA - E-Commerce Mock Product & Category Data Catalog
 * Prepared for clean, scalable dynamic rendering and easy API / Supabase database migration.
 */
// Ensure VeloraCache is initialized
if (!window.VeloraCache) {
  (function () {
    const CACHE_PREFIX = 'velora_cache_';
    const memoryCache = new Map();
    const inFlightRequests = new Map();
    const DEFAULT_TTL = { products: 180000, categories: 300000, banners: 300000, delivery_partners: 300000, store_settings: 300000 };

    function getCached(key) {
      const now = Date.now();
      if (memoryCache.has(key)) {
        const e = memoryCache.get(key);
        if (e && e.expiresAt > now) return e.data;
        memoryCache.delete(key);
      }
      try {
        const raw = sessionStorage.getItem(CACHE_PREFIX + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.expiresAt > now) {
            memoryCache.set(key, parsed);
            return parsed.data;
          } else {
            sessionStorage.removeItem(CACHE_PREFIX + key);
          }
        }
      } catch (_) {}
      return null;
    }

    function setCached(key, data, customTtl) {
      const ttl = customTtl || DEFAULT_TTL[key] || 180000;
      const entry = { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() };
      memoryCache.set(key, entry);
      try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry)); } catch (_) {}
    }

    function invalidate(key) {
      if (!key) {
        memoryCache.clear();
        try {
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
          }
        } catch (_) {}
      } else {
        memoryCache.delete(key);
        try { sessionStorage.removeItem(CACHE_PREFIX + key); } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('velora:cache-invalidated', { detail: { key } }));
    }

    async function getOrFetch(key, fetchFn, options = {}) {
      const { ttl, forceRefresh = false, swr = true } = options;
      if (!forceRefresh) {
        const cached = getCached(key);
        if (cached !== null) {
          if (swr && !inFlightRequests.has(key)) {
            const entry = memoryCache.get(key);
            const age = entry ? Date.now() - entry.cachedAt : 0;
            const nominalTtl = ttl || DEFAULT_TTL[key] || 180000;
            if (age > nominalTtl * 0.7) {
              (async () => {
                try {
                  const fresh = await fetchFn();
                  if (fresh) setCached(key, fresh, ttl);
                } catch (_) {}
              })();
            }
          }
          return cached;
        }
      }
      if (inFlightRequests.has(key)) return inFlightRequests.get(key);

      const p = (async () => {
        try {
          const data = await fetchFn();
          if (data !== undefined && data !== null) setCached(key, data, ttl);
          return data;
        } finally {
          inFlightRequests.delete(key);
        }
      })();
      inFlightRequests.set(key, p);
      return p;
    }

    window.VeloraCache = { get: getCached, set: setCached, invalidate, getOrFetch, clearAll: () => invalidate() };
  })();
}

/**
 * Format numeric amount to Indian Rupee (INR) currency representation.
 * Follows standard Indian number grouping (lakhs, crores) with no fractional digits when integer.
 * Examples: 999 -> ₹999, 1299 -> ₹1,299, 14999 -> ₹14,999, 125000 -> ₹1,25,000
 */
function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

const CATEGORIES_DATA = [
  {
    id: "shoes",
    name: "Shoes & Footwear",
    tagline: "Sneakers, Boots & Loafers",
    itemCount: "48 Items",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80",
    badge: "Trending"
  },
  {
    id: "watches",
    name: "Luxury Watches",
    tagline: "Timepieces & Chronographs",
    itemCount: "32 Items",
    image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80",
    badge: "Premium"
  },
  {
    id: "caps",
    name: "Designer Caps",
    tagline: "Snapbacks, Beanies & Hats",
    itemCount: "26 Items",
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80",
    badge: "Popular"
  },
  {
    id: "bags",
    name: "Bags & Backpacks",
    tagline: "Duffels, Totes & Crossbody",
    itemCount: "41 Items",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80",
    badge: "Bestseller"
  },
  {
    id: "clothing",
    name: "Modern Clothing",
    tagline: "Jackets, Hoodies & Knits",
    itemCount: "85 Items",
    image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80",
    badge: "New"
  },
  {
    id: "accessories",
    name: "Minimal Accessories",
    tagline: "Eyewear, Belts & Wallets",
    itemCount: "54 Items",
    image: "https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=600&q=80",
    badge: "Essential"
  },
  {
    id: "electronics",
    name: "Smart Audio & Tech",
    tagline: "Headphones & Smart Gadgets",
    itemCount: "29 Items",
    image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80",
    badge: "Featured"
  },
  {
    id: "seasonal",
    name: "Curated Living",
    tagline: "Fragrances & Lifestyle Picks",
    itemCount: "37 Items",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80",
    badge: "Limited"
  }
];

const PRODUCTS_DATA = [
  // Shoes & Footwear
  {
    id: "prod-01",
    name: "AeroGlide Runner Pro V2",
    brand: "Aero Athletics",
    category: "shoes",
    categoryLabel: "Footwear",
    price: 3499,
    originalPrice: 4499, discount: 22,
    rating: 4.9,
    reviewsCount: 342,
    badge: "Bestseller",
    badgeType: "hot",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=700&q=80",
    description: "Ultra-responsive athletic footwear engineered with aerodynamic cloud foam cushioning, breathable knit mesh, and durable grip traction.",
    features: ["Featherweight cushioning", "Breathable matrix weave", "Orthopedic insole support"],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    colors: ["Crimson Red", "Obsidian Black", "Pure White"],
    inStock: true,
    stockCount: 18,
    dateAdded: "2026-08-15"
  },
  {
    id: "prod-08",
    name: "Veloce Minimalist Leather Sneaker",
    brand: "VADI Atelier",
    category: "shoes",
    categoryLabel: "Footwear",
    price: 3299,
    originalPrice: 3999, discount: 18,
    rating: 4.9,
    reviewsCount: 165,
    badge: "Clean Everyday",
    badgeType: "popular",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=700&q=80",
    description: "Low-profile luxury sneaker crafted from smooth nappa leather with margom-style vulcanized rubber cupsole and memory-foam arch support.",
    features: ["Full Nappa calf leather", "Stitched rubber cupsole", "Cushioned memory insole"],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    colors: ["Pristine White", "Chalk & Gum", "Midnight Monochrome"],
    inStock: true,
    stockCount: 27,
    dateAdded: "2026-08-20"
  },
  {
    id: "prod-12",
    name: "Artisan Tuscan Leather Chelsea Boot",
    brand: "Tuscan Goods",
    category: "shoes",
    categoryLabel: "Footwear",
    price: 4999,
    originalPrice: 6499, discount: 23,
    rating: 4.9,
    reviewsCount: 134,
    badge: "New Collection",
    badgeType: "new",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=700&q=80",
    description: "Goodyear-welted Chelsea boots crafted from waxed Italian suede with elasticated side gussets and durable Dainite studded rubber soles.",
    features: ["Goodyear welt construction", "Weatherproof waxed suede", "Dainite rubber sole"],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
    colors: ["Snuff Suede Brown", "Pitch Black Leather"],
    inStock: true,
    stockCount: 15,
    dateAdded: "2026-09-01"
  },
  {
    id: "prod-14",
    name: "StreetEdge Suede High-Top Trainer",
    brand: "Aero Athletics",
    category: "shoes",
    categoryLabel: "Footwear",
    price: 2499,
    originalPrice: 4999, discount: 50,
    rating: 4.8,
    reviewsCount: 312,
    badge: "50% OFF DEAL",
    badgeType: "deal",
    isTrending: false,
    isNew: false,
    isDeal: true,
    image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=700&q=80",
    description: "Retro street-inspired high top constructed with contrast hairy suede and tumbled leather accents, padded collar, and gum-rubber traction sole.",
    features: ["Premium hairy suede overlays", "Ankle collar foam padding", "High-grip gum outsole"],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10"],
    colors: ["Vintage Clay & Sail", "Shadow Gray"],
    inStock: true,
    stockCount: 4,
    dateAdded: "2026-07-28"
  },
  {
    id: "prod-17",
    name: "Nordic Oxford Leather Derby",
    brand: "Tuscan Goods",
    category: "shoes",
    categoryLabel: "Footwear",
    price: 4299,
    originalPrice: 5499, discount: 22,
    rating: 4.7,
    reviewsCount: 88,
    badge: "Formal Essential",
    badgeType: "popular",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=700&q=80",
    description: "Hand-burnished calfskin leather Derby shoe with blind eyelets, tonal welt stitching, and natural leather sole with rubber heel insert.",
    features: ["Hand-burnished calfskin", "Leather stacked heel", "Breathable calf lining"],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10"],
    colors: ["Deep Cognac", "Onyx Black"],
    inStock: true,
    stockCount: 12,
    dateAdded: "2026-06-15"
  },

  // Luxury Watches
  {
    id: "prod-02",
    name: "Chronos Heritage Automatic Watch",
    brand: "Chronos Haute",
    category: "watches",
    categoryLabel: "Timepieces",
    price: 9999,
    originalPrice: 14999, discount: 33,
    rating: 4.9,
    reviewsCount: 189,
    badge: "Luxury Pick",
    badgeType: "luxury",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=700&q=80",
    description: "Exquisite automatic mechanical timepiece featuring sapphire crystal glass, 50m water resistance, and hand-stitched Italian leather strap.",
    features: ["Self-winding Japanese movement", "Scratch-proof sapphire crystal", "5 ATM water resistance"],
    sizes: ["40mm Case", "42mm Case"],
    colors: ["Brushed Rose Gold", "Silver Slate", "Stealth Onyx"],
    inStock: true,
    stockCount: 9,
    dateAdded: "2026-08-01"
  },
  {
    id: "prod-13",
    name: "Aura Matte Black Chronograph",
    brand: "Chronos Haute",
    category: "watches",
    categoryLabel: "Timepieces",
    price: 6999,
    originalPrice: 13999, discount: 50,
    rating: 4.9,
    reviewsCount: 245,
    badge: "50% OFF FLASH",
    badgeType: "deal",
    isTrending: false,
    isNew: false,
    isDeal: true,
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80",
    description: "Limited Edition matte black DLC coated stainless steel timepiece with dual sub-dials, tactical luminous hands, and quick-release mesh band.",
    features: ["DLC scratch-resistant coating", "Japanese quartz chronograph", "Quick-release milanese strap"],
    sizes: ["42mm Case"],
    colors: ["All-Black Tactical"],
    inStock: true,
    stockCount: 6,
    dateAdded: "2026-07-20"
  },
  {
    id: "prod-18",
    name: "Horizon Classic Minimalist Watch",
    brand: "Chronos Haute",
    category: "watches",
    categoryLabel: "Timepieces",
    price: 4999,
    originalPrice: 6499, discount: 23,
    rating: 4.8,
    reviewsCount: 120,
    badge: "Minimalist",
    badgeType: "popular",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=700&q=80",
    description: "Ultra-slim 7mm profile watch with sunray silver dial, polished stainless steel case, and quick-change genuine leather strap.",
    features: ["7mm Ultra-thin profile", "Miyota quartz caliber", "Water resistant 30m"],
    sizes: ["38mm Case", "40mm Case"],
    colors: ["Silver & Tan Leather", "Gold & Black Leather"],
    inStock: true,
    stockCount: 18,
    dateAdded: "2026-06-10"
  },

  // Caps & Headwear
  {
    id: "prod-03",
    name: "Apex Raw Cotton Minimalist Cap",
    brand: "Apex Studio",
    category: "caps",
    categoryLabel: "Headwear",
    price: 999,
    originalPrice: 1299, discount: 23,
    rating: 4.8,
    reviewsCount: 215,
    badge: "Trending",
    badgeType: "trending",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=700&q=80",
    description: "Structured 6-panel silhouette crafted from heavyweight 100% organic cotton twill with an adjustable antique brass clasp.",
    features: ["100% Organic combed cotton", "Pre-curved visor", "Brass buckle fastener"],
    sizes: ["Adjustable One Size"],
    colors: ["Desert Khaki", "Midnight Navy", "Washed Olive"],
    inStock: true,
    stockCount: 45,
    dateAdded: "2026-08-10"
  },
  {
    id: "prod-19",
    name: "Urban Stealth Snapback Cap",
    brand: "Apex Studio",
    category: "caps",
    categoryLabel: "Headwear",
    price: 1199,
    originalPrice: 1499, discount: 20,
    rating: 4.7,
    reviewsCount: 142,
    badge: "Streetwear",
    badgeType: "popular",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=700&q=80",
    description: "Flat-brim structured cap in water-repellent ripstop fabric with matte tonal 3D embroidery and moisture-wicking internal sweatband.",
    features: ["Durable ripstop nylon", "Moisture-wicking band", "Custom snapback closure"],
    sizes: ["Adjustable One Size"],
    colors: ["Pitch Black", "Smoke Gray"],
    inStock: true,
    stockCount: 28,
    dateAdded: "2026-08-28"
  },
  {
    id: "prod-20",
    name: "Nordic Ribbed Merino Beanie",
    brand: "VADI Atelier",
    category: "caps",
    categoryLabel: "Headwear",
    price: 899,
    originalPrice: 1199, discount: 25,
    rating: 4.9,
    reviewsCount: 180,
    badge: "Warm Essential",
    badgeType: "hot",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=700&q=80",
    description: "Chunky fisherman-style ribbed beanie knitted in Scotland from 100% extrafine merino wool for itch-free warmth.",
    features: ["100% Extrafine merino wool", "Roll-up cuff adjustability", "Breathable thermal insulation"],
    sizes: ["One Size"],
    colors: ["Charcoal", "Oatmeal", "Forest Green"],
    inStock: true,
    stockCount: 35,
    dateAdded: "2026-07-12"
  },

  // Bags & Luggage
  {
    id: "prod-04",
    name: "Monolith Leather Weekender Bag",
    brand: "Monolith Luggage",
    category: "bags",
    categoryLabel: "Bags & Luggage",
    price: 6999,
    originalPrice: 8999, discount: 22,
    rating: 4.9,
    reviewsCount: 174,
    badge: "Staff Pick",
    badgeType: "trending",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80",
    description: "Handcrafted from full-grain vegetable-tanned leather. Includes padded 16-inch laptop compartment and reinforced brass hardware.",
    features: ["Full-grain Italian cowhide", "Dedicated laptop compartment", "Waterproof nylon lining"],
    sizes: ["45L Standard Capacity"],
    colors: ["Espresso Brown", "Cognac Tan", "Pitch Black"],
    inStock: true,
    stockCount: 12,
    dateAdded: "2026-08-18"
  },
  {
    id: "prod-11",
    name: "Vanguard Commuter Weatherproof Pack",
    brand: "Monolith Luggage",
    category: "bags",
    categoryLabel: "Luggage",
    price: 3999,
    originalPrice: 4999, discount: 20,
    rating: 4.7,
    reviewsCount: 89,
    badge: "New Release",
    badgeType: "new",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",
    description: "Engineered for urban commuters with ballistic 1000D Cordura, AquaGuard sealed zippers, magnetic Fidlock buckle, and hidden passport sleeve.",
    features: ["1000D Cordura ballistic fabric", "YKK AquaGuard zippers", "Ergonomic ventilation backpanel"],
    sizes: ["26L Capacity"],
    colors: ["Stealth Black", "Cadet Olive", "Graphite Gray"],
    inStock: true,
    stockCount: 20,
    dateAdded: "2026-08-30"
  },
  {
    id: "prod-15",
    name: "Sienna Crossbody Saddle Bag",
    brand: "VADI Atelier",
    category: "bags",
    categoryLabel: "Bags",
    price: 2499,
    originalPrice: 4599, discount: 46,
    rating: 4.9,
    reviewsCount: 162,
    badge: "46% OFF TODAY",
    badgeType: "deal",
    isTrending: false,
    isNew: false,
    isDeal: true,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
    description: "Timeless saddle silhouette in burnished saddle leather with gold-tone hardware, magnetic front flap, and detachable woven crossbody strap.",
    features: ["Vegetable-tanned saddle leather", "Gold brass twist lock", "Adjustable strap"],
    sizes: ["Medium (24 x 18 x 7 cm)"],
    colors: ["Saddle Brown", "Forest Emerald"],
    inStock: true,
    stockCount: 8,
    dateAdded: "2026-07-25"
  },

  // Clothing & Apparel
  {
    id: "prod-05",
    name: "Nomad Relaxed Wool Overcoat",
    brand: "Nomad Studio",
    category: "clothing",
    categoryLabel: "Outerwear",
    price: 5499,
    originalPrice: 7499, discount: 27,
    rating: 4.8,
    reviewsCount: 96,
    badge: "Winter Warmth",
    badgeType: "popular",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=700&q=80",
    description: "Tailored double-faced melton wool overcoat offering exceptional thermal insulation, notch lapels, and horn-style buttons.",
    features: ["80% Merino Wool / 20% Cashmere", "Satin viscose sleeve lining", "Internal passport pocket"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Camel Sand", "Charcoal Gray", "Deep Black"],
    inStock: true,
    stockCount: 14,
    dateAdded: "2026-08-05"
  },
  {
    id: "prod-09",
    name: "Heavyweight Boxy Fleece Hoodie",
    brand: "VADI Atelier",
    category: "clothing",
    categoryLabel: "Apparel",
    price: 2499,
    originalPrice: 3199, discount: 22,
    rating: 4.9,
    reviewsCount: 78,
    badge: "Just Dropped",
    badgeType: "new",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80",
    description: "Custom-milled 480 GSM French terry fleece hoodie with dropped shoulders, kangaroo pocket, and double-layered hood without drawstrings.",
    features: ["480 GSM Heavyweight Terry", "Garment dyed for vintage feel", "Pre-shrunk organic cotton"],
    sizes: ["S", "M", "L", "XL"],
    colors: ["Washed Sage", "Oatmeal Melange", "Washed Black"],
    inStock: true,
    stockCount: 40,
    dateAdded: "2026-09-02"
  },
  {
    id: "prod-21",
    name: "Tailored Italian Linen Blazer",
    brand: "Nomad Studio",
    category: "clothing",
    categoryLabel: "Apparel",
    price: 4499,
    originalPrice: 5999, discount: 25,
    rating: 4.8,
    reviewsCount: 64,
    badge: "Premium Linen",
    badgeType: "luxury",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80",
    description: "Deconstructed unstructured blazer spun from breathable Normandy flax linen with patch pockets and buggy lining for warm-weather elegance.",
    features: ["100% Pure Normandy Linen", "Mother-of-pearl buttons", "Unlined soft shoulders"],
    sizes: ["38R", "40R", "42R", "44R"],
    colors: ["Sand Dune", "Navy Azure"],
    inStock: true,
    stockCount: 11,
    dateAdded: "2026-05-20"
  },

  // Minimal Accessories
  {
    id: "prod-06",
    name: "Lucent Polarized Aviator Eyewear",
    brand: "Lucent Optics",
    category: "accessories",
    categoryLabel: "Eyewear",
    price: 2499,
    originalPrice: 3299, discount: 24,
    rating: 4.7,
    reviewsCount: 310,
    badge: "UV400 Protected",
    badgeType: "trending",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=700&q=80",
    description: "Classic teardrop aviators equipped with high-clarity polarized lenses offering 100% UVA/UVB barrier and lightweight titanium alloy frame.",
    features: ["Titanium alloy frame", "Category 3 polarized tint", "Anti-reflective coating"],
    sizes: ["55mm Lens Width"],
    colors: ["Gold & Dark Olive", "Silver & Ice Blue", "Matte Gunmetal"],
    inStock: true,
    stockCount: 32,
    dateAdded: "2026-08-11"
  },
  {
    id: "prod-16",
    name: "Tuscan Leather Slim Bifold Wallet",
    brand: "Tuscan Goods",
    category: "accessories",
    categoryLabel: "Leather Goods",
    price: 1299,
    originalPrice: 2499, discount: 48,
    rating: 4.8,
    reviewsCount: 520,
    badge: "48% OFF FLASH",
    badgeType: "deal",
    isTrending: false,
    isNew: false,
    isDeal: true,
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",
    description: "Slimline 6mm profile crafted from pull-up cowhide leather with 8 card slots, currency compartment, and RFID blocking security shield.",
    features: ["Integrated RFID blocking layer", "Ultra-slim front pocket design", "Ages with natural patina"],
    sizes: ["Standard Slim"],
    colors: ["Whiskey Tan", "Carbon Black", "Dark Walnut"],
    inStock: true,
    stockCount: 11,
    dateAdded: "2026-07-19"
  },
  {
    id: "prod-22",
    name: "Solstice Sterling Silver Cuff Bracelet",
    brand: "VADI Atelier",
    category: "accessories",
    categoryLabel: "Jewelry",
    price: 1999,
    originalPrice: 2499, discount: 20,
    rating: 4.9,
    reviewsCount: 94,
    badge: "Handmade",
    badgeType: "popular",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=700&q=80",
    description: "Solid 925 sterling silver open cuff bracelet with brushed satin finish, beveled edges, and engraved interior hallmark.",
    features: ["Solid 925 Sterling Silver", "Hypoallergenic nickel-free", "Adjustable bendable fit"],
    sizes: ["Medium (6.5\")", "Large (7.5\")"],
    colors: ["Brushed Silver"],
    inStock: true,
    stockCount: 19,
    dateAdded: "2026-06-25"
  },

  // Smart Tech & Electronics
  {
    id: "prod-07",
    name: "Aura Acoustic ANC Studio Headphones",
    brand: "Aura Acoustics",
    category: "electronics",
    categoryLabel: "Tech & Audio",
    price: 5999,
    originalPrice: 7999, discount: 25,
    rating: 5.0,
    reviewsCount: 428,
    badge: "Hi-Res Audio",
    badgeType: "hot",
    isTrending: true,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=700&q=80",
    description: "Flagship wireless over-ear headphones featuring Hybrid Active Noise Cancellation, 40-hour battery life, and custom 40mm beryllium drivers.",
    features: ["40hr Battery + Fast Charge", "Hybrid Active Noise Cancellation", "Spatial Audio 360°"],
    sizes: ["Standard Adjustable"],
    colors: ["Matte Black", "Cream Linen", "Silver Mist"],
    inStock: true,
    stockCount: 22,
    dateAdded: "2026-08-14"
  },
  {
    id: "prod-10",
    name: "Pulse Smartwatch Ceramic Edition",
    brand: "Pulse Wearables",
    category: "electronics",
    categoryLabel: "Wearables",
    price: 7999,
    originalPrice: 9999, discount: 20,
    rating: 4.8,
    reviewsCount: 112,
    badge: "New Release",
    badgeType: "new",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80",
    description: "Zirconia ceramic bezel smartwatch featuring high-contrast AMOLED retina display, ECG sensor, GPS tracking, and 7-day battery stamina.",
    features: ["All-day SpO2 & ECG monitoring", "1.43” Ultra AMOLED display", "50m Water Resistance"],
    sizes: ["44mm Case"],
    colors: ["Polished Ceramic White", "Obsidian Black"],
    inStock: true,
    stockCount: 16,
    dateAdded: "2026-08-29"
  },
  {
    id: "prod-23",
    name: "Sonic Boom High-Res Portable Speaker",
    brand: "Aura Acoustics",
    category: "electronics",
    categoryLabel: "Audio",
    price: 3499,
    originalPrice: 4599, discount: 24,
    rating: 4.9,
    reviewsCount: 204,
    badge: "IP67 Waterproof",
    badgeType: "popular",
    isTrending: false,
    isNew: false,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",
    description: "360-degree cylindrical Bluetooth speaker packed with dual passive radiators, 24-hour battery, and aircraft-grade aluminum chassis.",
    features: ["IP67 Dust & Waterproof", "24-Hour continuous playtime", "True Wireless Stereo pairing"],
    sizes: ["Standard"],
    colors: ["Anodized Gunmetal", "Desert Sand"],
    inStock: true,
    stockCount: 25,
    dateAdded: "2026-07-08"
  },
  {
    id: "prod-24",
    name: "VADI Ceramic Magnetic Wireless Pad",
    brand: "VADI Atelier",
    category: "electronics",
    categoryLabel: "Tech Accessories",
    price: 1499,
    originalPrice: 1999, discount: 25,
    rating: 4.8,
    reviewsCount: 156,
    badge: "Fast Charge",
    badgeType: "trending",
    isTrending: false,
    isNew: true,
    isDeal: false,
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=700&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=700&q=80",
    description: "Solid matte ceramic 15W Qi2 fast wireless charging pad with braided aramid cable and non-slip weighted cork base.",
    features: ["15W Qi2 Certified Fast Charging", "Weighted ceramic housing", "Braided 2m USB-C cable"],
    sizes: ["Standard (90mm diameter)"],
    colors: ["Glazed Off-White", "Basalt Charcoal"],
    inStock: false, // demonstrates out-of-stock filter testing!
    stockCount: 0,
    dateAdded: "2026-09-03"
  }
];

// Helper to extract unique brand list from catalog
function getAvailableBrands() {
  const brands = new Set();
  PRODUCTS_DATA.forEach(p => {
    if (p.brand) brands.add(p.brand);
  });
  return Array.from(brands).sort();
}

// Helper to normalize product images array from Supabase JSONB, JSON string, or array
function normalizeProductImages(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && typeof parsed === "string") list = [parsed];
      else if (parsed && typeof parsed === "object") list = [parsed];
    } catch (e) {
      if (raw.includes(",") && !raw.startsWith("data:")) {
        list = raw.split(",").map(s => s.trim()).filter(Boolean);
      } else {
        list = [raw.trim()];
      }
    }
  }
  if (!Array.isArray(list)) {
    list = [list];
  }

  const urls = [];
  list.forEach(item => {
    if (!item) return;
    let url = "";
    if (typeof item === "string") {
      url = item.trim();
    } else if (typeof item === "object") {
      url = (item.url || item.src || item.image || item.link || "").trim();
    }
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  });

  return urls;
}

// Helper to get gallery images strictly from product's actual images
function getProductGallery(product) {
  if (!product) return [];
  const rawList = product.images || product.galleryImages || product.gallery || (product.image ? [product.image] : []);
  const normalized = normalizeProductImages(rawList);
  if (normalized.length > 0) {
    return normalized;
  }
  if (product.image) {
    return [product.image];
  }
  return [];
}

// Find product by id (matches Supabase UUID, legacyId, slug, or name)
function getProductById(id) {
  if (!id || !PRODUCTS_DATA) return null;
  const target = String(id).trim().toLowerCase();
  return PRODUCTS_DATA.find(p => 
    String(p.id).toLowerCase() === target || 
    (p.legacyId && String(p.legacyId).toLowerCase() === target) ||
    (p.supabase_id && String(p.supabase_id).toLowerCase() === target) ||
    (p.slug && String(p.slug).toLowerCase() === target) ||
    (p.name && String(p.name).toLowerCase() === target)
  ) || null;
}

// Get related items by category/brand
function getRelatedProducts(productId, limit = 4) {
  const current = getProductById(productId);
  if (!current) return PRODUCTS_DATA.slice(0, limit);
  
  const related = PRODUCTS_DATA.filter(p => p.id !== current.id && (p.category === current.category || p.category_id === current.category_id));
  if (related.length < limit) {
    const others = PRODUCTS_DATA.filter(p => p.id !== current.id && p.category !== current.category && p.category_id !== current.category_id);
    related.push(...others);
  }
  return related.slice(0, limit);
}

if (typeof window !== "undefined") {
  window.formatINR = formatINR;
  window.formatPrice = formatINR;
  window.CATEGORIES_DATA = CATEGORIES_DATA;
  window.PRODUCTS_DATA = PRODUCTS_DATA;
  window.getAvailableBrands = getAvailableBrands;
  window.normalizeProductImages = normalizeProductImages;
  window.getProductGallery = getProductGallery;
  window.getProductById = getProductById;
  window.getRelatedProducts = getRelatedProducts;

  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

  // Authoritative Live Supabase Product & Category Sync
  window.syncProductsFromSupabase = async function() {
    try {
      const reqHeaders = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      };

      // 1. Fetch Categories from Supabase (Projected, Cached & Deduplicated)
      const catCols = "id,name,slug,description,image_url,is_active,created_at";
      let dbCategories = null;
      try {
        dbCategories = await (window.VeloraCache
          ? window.VeloraCache.getOrFetch('categories', async () => {
              const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/categories?select=${catCols}&is_active=eq.true&order=created_at.asc`, { headers: reqHeaders });
              return res.ok ? await res.json() : null;
            }, { ttl: 300000 })
          : (async () => {
              const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/categories?select=${catCols}&is_active=eq.true&order=created_at.asc`, { headers: reqHeaders });
              return res.ok ? await res.json() : null;
            })());
      } catch (e) {
        console.warn("Category sync notice:", e);
      }

      const catMap = {};
      if (dbCategories && Array.isArray(dbCategories) && dbCategories.length > 0) {
        dbCategories.forEach(c => {
          catMap[c.id] = c;
          catMap[c.slug] = c;
          // Update or augment CATEGORIES_DATA
          const existingCat = CATEGORIES_DATA.find(ec => ec.id === c.slug || ec.id === c.id);
          if (existingCat) {
            existingCat.name = c.name;
            if (c.image_url) existingCat.image = c.image_url;
            if (c.description) existingCat.tagline = c.description;
            existingCat.supabase_id = c.id;
          } else {
            CATEGORIES_DATA.push({
              id: c.slug,
              name: c.name,
              tagline: c.description || "Curated Collection",
              itemCount: "Items",
              image: c.image_url || "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80",
              badge: "New",
              supabase_id: c.id
            });
          }
        });
      }

      // 2. Fetch Active Products with Categories Join (Projected, Cached & Deduplicated)
      const prodCols = "id,name,brand,slug,category_id,price,original_price,discount_percentage,rating,review_count,stock,sizes,colors,images,is_featured,is_new,is_deal,advance_payment_enabled,advance_payment_type,advance_payment_value,is_active,created_at,categories(id,name,slug)";
      let dbProducts = null;
      try {
        dbProducts = await (window.VeloraCache
          ? window.VeloraCache.getOrFetch('products', async () => {
              const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?select=${prodCols}&is_active=eq.true&order=created_at.desc`, { headers: reqHeaders });
              return res.ok ? await res.json() : null;
            }, { ttl: 180000 })
          : (async () => {
              const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?select=${prodCols}&is_active=eq.true&order=created_at.desc`, { headers: reqHeaders });
              return res.ok ? await res.json() : null;
            })());
      } catch (e) {
        console.warn("Products sync notice:", e);
      }

      // Cross-store: Check if any Sarojini products are made available in Main VADI Store
      try {
        const xSetRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.cross_store_mapping&select=value`, { headers: reqHeaders });
        if (xSetRes.ok) {
          const xSetData = await xSetRes.json();
          if (xSetData && xSetData[0] && xSetData[0].value && xSetData[0].value.sarojini_available_in_main) {
            const sMap = xSetData[0].value.sarojini_available_in_main;
            const sIds = Object.keys(sMap).filter(id => sMap[id]?.available);
            if (sIds.length > 0) {
              const sarCols = "id,name,brand,slug,category_id,price,original_price,discount_percentage,rating,review_count,stock,sizes,colors,images,is_featured,is_new,is_deal,advance_payment_enabled,advance_payment_type,advance_payment_value,is_active,created_at";
              const sRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/sarojini_products?select=${sarCols}&id=in.(${sIds.join(',')})&is_active=eq.true`, { headers: reqHeaders });
              if (sRes.ok) {
                const sProds = await sRes.json();
                if (Array.isArray(sProds) && sProds.length > 0) {
                  dbProducts = dbProducts || [];
                  sProds.forEach(sp => {
                    const assign = sMap[sp.id] || {};
                    dbProducts.push({
                      ...sp,
                      category_id: assign.category_id || sp.category_id,
                      is_featured: (assign.is_featured !== undefined) ? assign.is_featured : sp.is_featured
                    });
                  });
                }
              }
            }
          }
        }
      } catch (xErr) {
        console.warn("Cross-store products sync notice:", xErr);
      }

      // Fetch BOGO config if not yet loaded in window.VELORA_SETTINGS
      let bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
        ? window.VELORA_SETTINGS.bogo_config.product_ids
        : null;

      if (!bogoConfigIds) {
        try {
          const bogoRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.bogo_config&select=key,value`, {
            headers: reqHeaders
          });
          if (bogoRes.ok) {
            const bogoRows = await bogoRes.json();
            if (bogoRows && bogoRows[0] && bogoRows[0].value && Array.isArray(bogoRows[0].value.product_ids)) {
              window.VELORA_SETTINGS = window.VELORA_SETTINGS || {};
              window.VELORA_SETTINGS.bogo_config = bogoRows[0].value;
              bogoConfigIds = bogoRows[0].value.product_ids;
            }
          }
        } catch (bErr) {
          console.warn("BOGO config sync notice:", bErr);
        }
      }

      // Fallback check: localStorage or active deals if bogoConfigIds is empty
      if (!bogoConfigIds || bogoConfigIds.length === 0) {
        try {
          const cachedBogo = localStorage.getItem("velora_bogo_config");
          if (cachedBogo) {
            const parsed = JSON.parse(cachedBogo);
            if (parsed && Array.isArray(parsed.product_ids) && parsed.product_ids.length > 0) {
              bogoConfigIds = parsed.product_ids;
            }
          }
        } catch (_) {}
      }

      // Resilient fallback to active deal products in dbProducts if still empty
      if ((!bogoConfigIds || bogoConfigIds.length === 0) && Array.isArray(dbProducts)) {
        const dealIds = dbProducts.filter(p => Boolean(p.is_deal)).map(p => p.id);
        if (dealIds.length > 0) {
          bogoConfigIds = dealIds;
        }
      }

      bogoConfigIds = bogoConfigIds || [];
      window.VELORA_SETTINGS = window.VELORA_SETTINGS || {};
      window.VELORA_SETTINGS.bogo_config = { product_ids: bogoConfigIds };

      if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
        // Build map of existing legacy IDs
        const legacyMap = new Map();
        PRODUCTS_DATA.forEach(p => {
          if (p.legacyId) {
            legacyMap.set(p.id, p.legacyId);
            if (p.name) legacyMap.set(p.name.toLowerCase(), p.legacyId);
          } else if (p.id && p.id.startsWith("prod-")) {
            legacyMap.set(p.name?.toLowerCase(), p.id);
          }
        });

        // Seed products map: d0000000-0000-0000-0000-000000000001 -> prod-01
        for (let i = 1; i <= 24; i++) {
          const hex = String(i).padStart(12, '0');
          const seedUuid = `d0000000-0000-0000-0000-${hex}`;
          const legId = `prod-${String(i).padStart(2, '0')}`;
          if (!legacyMap.has(seedUuid)) legacyMap.set(seedUuid, legId);
        }

        const mappedProducts = dbProducts.map(dbP => {
          const rawImgs = dbP.images || dbP.image_url || dbP.image;
          const imgs = normalizeProductImages(rawImgs);

          const catObj = dbP.categories || (dbP.category_id ? catMap[dbP.category_id] : null);
          const categorySlug = catObj?.slug || "shoes";
          const categoryLabel = catObj?.name || "Shoes & Footwear";

          const price = Number(dbP.price) || 0;
          const originalPrice = dbP.original_price ? Number(dbP.original_price) : null;
          let discount = dbP.discount_percentage;
          if (!discount && originalPrice && originalPrice > price) {
            discount = Math.round(((originalPrice - price) / originalPrice) * 100);
          }

          const legacyId = legacyMap.get(dbP.id) || legacyMap.get(dbP.name?.toLowerCase()) || dbP.id;

          let badge = null;
          let badgeType = "popular";
          if (dbP.is_deal) {
            badge = "Special Deal";
            badgeType = "deal";
          } else if (dbP.is_new) {
            badge = "New Arrival";
            badgeType = "new";
          } else if (dbP.is_featured) {
            badge = "Featured";
            badgeType = "popular";
          } else if (dbP.stock > 0 && dbP.stock <= 5) {
            badge = "Low Stock";
            badgeType = "popular";
          }

          const isBogoMatch = Boolean(dbP.is_bogo) || bogoConfigIds.includes(dbP.id) || (legacyId && bogoConfigIds.includes(legacyId));

          return {
            id: dbP.id,
            legacyId: legacyId,
            supabase_id: dbP.id,
            name: dbP.name,
            brand: dbP.brand || "VADI Atelier",
            slug: dbP.slug,
            category: categorySlug,
            categoryLabel: categoryLabel,
            category_id: dbP.category_id,
            price: price,
            originalPrice: originalPrice,
            discount: discount || 0,
            rating: Number(dbP.rating) || 4.9,
            reviewsCount: dbP.review_count !== undefined && dbP.review_count !== null ? Number(dbP.review_count) : 18,
            badge: badge,
            badgeType: badgeType,
            inStock: Boolean(dbP.stock > 0),
            stockCount: Number(dbP.stock) || 0,
            image: imgs[0] || "",
            secondaryImage: imgs[1] || imgs[0] || "",
            galleryImages: imgs,
            images: imgs,
            gallery: imgs,
            description: dbP.description || "",
            sizes: (dbP.sizes && Array.isArray(dbP.sizes) && dbP.sizes.length > 0) ? dbP.sizes : ["Standard"],
            colors: (dbP.colors && Array.isArray(dbP.colors) && dbP.colors.length > 0) ? dbP.colors : ["Default"],
            isTrending: Boolean(dbP.is_featured),
            isNew: Boolean(dbP.is_new),
            isDeal: Boolean(dbP.is_deal),
            isBogo: isBogoMatch,
            is_bogo: isBogoMatch,
            dateAdded: dbP.created_at || new Date().toISOString(),
            advance_payment_enabled: Boolean(dbP.advance_payment_enabled),
            advance_payment_type: dbP.advance_payment_type || "fixed",
            advance_payment_value: Number(dbP.advance_payment_value) || 0,
            is_active: Boolean(dbP.is_active)
          };
        });

        // Make Supabase the single source of truth
        PRODUCTS_DATA.length = 0;
        PRODUCTS_DATA.push(...mappedProducts);

        // Update category counts on CATEGORIES_DATA
        CATEGORIES_DATA.forEach(cat => {
          const count = PRODUCTS_DATA.filter(p => p.category === cat.id || p.category_id === cat.supabase_id).length;
          cat.itemCount = `${count} ${count === 1 ? 'Item' : 'Items'}`;
        });

        // Broadcast sync event for reactive listeners
        const syncEvent = new CustomEvent("velora:products-synced", {
          detail: { products: PRODUCTS_DATA, categories: CATEGORIES_DATA }
        });
        window.dispatchEvent(syncEvent);
        document.dispatchEvent(syncEvent);
      }

      return PRODUCTS_DATA;
    } catch (e) {
      console.warn("Supabase products sync error:", e);
      return PRODUCTS_DATA;
    }
  };

  window.syncStoreSettings = async function () {
    try {
      const data = await (window.VeloraCache
        ? window.VeloraCache.getOrFetch('store_settings', async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?select=key,value`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          }, { ttl: 300000 })
        : (async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?select=key,value`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          })());

      if (data && Array.isArray(data)) {
        window.VELORA_SETTINGS = window.VELORA_SETTINGS || {};
        data.forEach(item => {
          window.VELORA_SETTINGS[item.key] = item.value;
        });

        // Update existing PRODUCTS_DATA items with fresh BOGO settings
        const bogoIds = (window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
          ? window.VELORA_SETTINGS.bogo_config.product_ids
          : [];

        PRODUCTS_DATA.forEach(p => {
          const isBogoMatch = Boolean(p.is_bogo) || bogoIds.includes(p.id) || bogoIds.includes(p.supabase_id) || (p.legacyId && bogoIds.includes(p.legacyId));
          p.isBogo = isBogoMatch;
          p.is_bogo = isBogoMatch;
        });

        const settingsEvent = new CustomEvent("velora:settings-synced", { detail: window.VELORA_SETTINGS });
        window.dispatchEvent(settingsEvent);
        document.dispatchEvent(settingsEvent);

        const prodEvent = new CustomEvent("velora:products-synced", {
          detail: { products: PRODUCTS_DATA, categories: CATEGORIES_DATA }
        });
        window.dispatchEvent(prodEvent);
        document.dispatchEvent(prodEvent);

        return window.VELORA_SETTINGS;
      }
    } catch (e) {
      console.warn("Supabase store_settings sync error:", e);
    }
    return window.VELORA_SETTINGS || null;
  };

  window.initStorefrontRealtime = function () {
    const client = window.supabaseClient || (window.getSupabase ? window.getSupabase() : null);
    if (!client || typeof client.channel !== "function" || window._velora_realtime_initialized) return;

    window._velora_realtime_initialized = true;

    try {
      const channel = client.channel("public:storefront_catalog_channel");
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
          window.syncProductsFromSupabase();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
          window.syncProductsFromSupabase();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "store_settings" }, () => {
          window.syncStoreSettings();
        })
        .subscribe();
      window._velora_catalog_channel = channel;
    } catch (err) {
      console.warn("Realtime subscription setup notice:", err);
    }
  };

  // Immediate background sync trigger
  if (typeof window !== "undefined") {
    window.syncStoreSettings().then(() => {
      return window.syncProductsFromSupabase();
    }).catch(() => {
      window.syncProductsFromSupabase();
    });
    setTimeout(() => {
      if (window.initStorefrontRealtime) window.initStorefrontRealtime();
    }, 1000);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatINR,
    formatPrice: formatINR,
    CATEGORIES_DATA,
    PRODUCTS_DATA,
    getAvailableBrands,
    getProductGallery,
    getProductById,
    getRelatedProducts
  };
}
