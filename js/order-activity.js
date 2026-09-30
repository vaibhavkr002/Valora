/**
 * VELORA & SAROJINI BAZAAR - Dynamic Live Sales Notification System
 * 
 * Fully dynamic social-proof notification engine connected directly to Supabase.
 * Automatically ingests currently active products AND all future products added by Admin
 * for both Main VALORA and Sarojini Bazaar catalogs with ZERO manual configuration.
 * 
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. STRICT ID-BASED IDENTITY: Every product is identified strictly by its unique database ID
 *    (and catalog discriminator). NO product name matching, NO LOWER(name) equality,
 *    NO fuzzy matching, and NO name-based deduplication are permitted.
 * 2. AUTOMATIC FUTURE ELIGIBILITY: Queries Supabase directly for active catalog products
 *    (is_active = true, ordered by created_at DESC). New products uploaded tomorrow or next week
 *    automatically become eligible without any code or manual Live Sales changes.
 * 3. CATALOG SEPARATION: Main VALORA products route to product.html?id=... with Main branding;
 *    Sarojini Bazaar products route to sarojini-product-details.html?id=... with Sarojini branding.
 * 4. REAL-TIME DELETION / DEACTIVATION: Deactivated or deleted products automatically drop out
 *    of the active Live Sales pool.
 * 5. PRESERVED UI & TIMING: Preserves existing card design, 3D animations, exact 25-second
 *    rotation intervals, hover pause, mobile sticky bar clearance, and DOM IDs.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. 100 REALISTIC INDIAN CUSTOMER NAMES & LOCALIZATION DATA
  // ==========================================================================
  const INDIAN_DEMO_NAMES = Object.freeze([
    "Aarav Sharma", "Vivaan Gupta", "Aditya Verma", "Arjun Singh", "Rohan Mehta",
    "Karan Malhotra", "Rahul Kumar", "Ananya Sharma", "Diya Gupta", "Ishita Verma",
    "Aditi Singh", "Sneha Mehta", "Priya Kapoor", "Neha Sharma", "Kavya Patel",
    "Meera Joshi", "Pooja Agarwal", "Riya Malhotra", "Simran Kaur", "Nisha Gupta",
    "Aman Yadav", "Akash Kumar", "Ayush Singh", "Rishabh Verma", "Rajat Sharma",
    "Mohit Gupta", "Nikhil Jain", "Varun Mehta", "Harsh Patel", "Yash Agarwal",
    "Dev Sharma", "Kabir Singh", "Manav Kapoor", "Dhruv Shah", "Aryan Gupta",
    "Siddharth Jain", "Vansh Kumar", "Ankit Verma", "Abhishek Singh", "Saurabh Sharma",
    "Ishan Gupta", "Tanishq Patel", "Shivam Kumar", "Pranav Mehta", "Ritik Yadav",
    "Gaurav Singh", "Deepak Sharma", "Naveen Kumar", "Rohit Gupta", "Vikas Verma",
    "Sakshi Sharma", "Shreya Gupta", "Tanvi Singh", "Muskan Verma", "Nandini Sharma",
    "Palak Gupta", "Ritika Patel", "Khushi Jain", "Anushka Singh", "Simran Sharma",
    "Manya Kapoor", "Avni Gupta", "Navya Sharma", "Myra Patel", "Ira Singh",
    "Kiara Mehta", "Rhea Kapoor", "Tanya Verma", "Shanaya Gupta", "Aarohi Sharma",
    "Anvi Patel", "Ishaan Singh", "Reyansh Kumar", "Atharv Gupta", "Krishna Sharma",
    "Veer Singh", "Rudra Patel", "Lakshya Mehta", "Ayaan Kapoor", "Arnav Verma",
    "Parth Shah", "Devansh Gupta", "Kunal Sharma", "Manish Kumar", "Varun Patel",
    "Sameer Singh", "Nitin Gupta", "Piyush Verma", "Tarun Sharma", "Sachin Mehta",
    "Rajesh Kumar", "Sanjay Singh", "Vivek Gupta", "Amit Sharma", "Priyanka Verma",
    "Shweta Singh", "Komal Gupta", "Divya Patel", "Bhavna Sharma", "Ritu Kapoor"
  ]);

  const RELATIVE_TIMES = Object.freeze([
    "Just now", "6 sec ago", "12 sec ago", "18 sec ago", "24 sec ago",
    "35 sec ago", "48 sec ago", "1 min ago", "2 min ago", "3 min ago", "4 min ago"
  ]);

  const INDIAN_CITIES = Object.freeze([
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad",
    "Chennai", "Kolkata", "Pune", "Jaipur", "Lucknow", "Chandigarh"
  ]);

  // Public Supabase Configuration (anon key safe for customer queries)
  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

  // ==========================================================================
  // 2. CONFIGURATION & STATE
  // ==========================================================================
  const CONFIG = {
    storageKey: 'velora_order_activity_config',
    displayDurationMs: 25000,          // Exactly 25 seconds visible duration
    rotationIntervalMs: 25000,         // Exactly 25 seconds between notifications
    minIntervalMs: 25000,
    maxIntervalMs: 25000,
    historyWindowSize: 25,             // Customer names memory
    productHistoryWindowSize: 10,      // Recently shown product keys memory (ID-based)
    bogoRatio: 0.35,                   // Target ratio for BOGO activities
    catalogRefreshIntervalMs: 180000   // Auto-poll Supabase every 3 min for new products
  };

  let isEnabled = true;
  let enableNormal = true;
  let enableBogo = true;
  let isPaused = false;
  let isHovered = false;

  // Single-source timer tracking
  let activeTimer = null;
  let hideTimer = null;
  let refreshTimer = null;

  // Customer names rotation
  let shuffledNames = [];
  let nameIndex = 0;
  const recentNames = [];

  // Product Pools (Loaded Dynamically from Database)
  let mainProductsPool = [];
  let sarojiniProductsPool = [];
  let bogoConfigIds = [];
  const recentProductKeys = []; // Stores unique `${catalog}:${id}` strings

  let isFetchingProducts = false;
  let lastFetchTimestamp = 0;

  let consecutiveNormalCount = 0;
  let consecutiveBogoCount = 0;
  let lastActivityType = 'normal'; // 'normal' | 'bogo'

  // DOM elements cache
  let containerEl = null;
  let cardEl = null;
  let thumbImg = null;
  let iconEl = null;
  let tagTextEl = null;
  let userNameEl = null;
  let actionEl = null;
  let productNameEl = null;
  let timeEl = null;
  let cityEl = null;
  let currentProduct = null;

  let currentMode = 'demo'; // 'demo' | 'real'

  // ==========================================================================
  // 3. SAFE TIMER MANAGEMENT
  // ==========================================================================
  function clearAllTimers() {
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  // ==========================================================================
  // 4. IMAGE UTILITIES & EXTRACTION
  // ==========================================================================
  function extractProductImage(p) {
    if (!p) return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80";

    // 1. Array of images
    if (Array.isArray(p.images) && p.images.length > 0) {
      const first = p.images[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      if (first && typeof first === 'object') {
        const url = first.url || first.src || first.image || '';
        if (url) return url;
      }
    }

    // 2. JSON string of images
    if (typeof p.images === 'string' && p.images.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (typeof first === 'string' && first.trim()) return first.trim();
          if (first && typeof first === 'object' && (first.url || first.src)) {
            return first.url || first.src;
          }
        }
      } catch (_) {}
    }

    // 3. String image field
    if (typeof p.images === 'string' && p.images.trim().length > 5 && !p.images.trim().startsWith('[')) {
      return p.images.trim();
    }
    if (typeof p.image_url === 'string' && p.image_url.trim()) return p.image_url.trim();
    if (typeof p.image === 'string' && p.image.trim()) return p.image.trim();

    return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80";
  }

  // ==========================================================================
  // 5. CURRENT PAGE CONTEXT & CATALOG DISCRIMINATION
  // ==========================================================================
  function getCurrentStoreContext() {
    try {
      const path = (window.location.pathname || '').toLowerCase();
      if (path.includes('sarojini')) return 'sarojini';
    } catch (_) {}
    return 'main';
  }

  // ==========================================================================
  // 6. DYNAMIC DATABASE FETCHING ENGINE (Main VALORA + SAROJINI BAZAAR)
  // ==========================================================================

  /**
   * Fetches eligible active products directly from Supabase.
   * Runs on boot, on periodic background refresh, and on sync events.
   * NO name matching is performed: deduplication is strictly by database ID.
   */
  async function fetchEligibleProducts(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTimestamp < 15000)) {
      return; // Debounce rapid requests within 15 seconds
    }
    if (isFetchingProducts) return;
    isFetchingProducts = true;

    try {
      const client = (window.AdminAuth && typeof window.AdminAuth.getClient === 'function')
        ? window.AdminAuth.getClient()
        : (window.supabaseClient || (typeof window.getSupabase === 'function' ? window.getSupabase() : null));

      // 1. Fetch Main VALORA Products (active only)
      let mainData = null;
      try {
        if (client) {
          const { data, error } = await client
            .from("products")
            .select("id, name, price, original_price, discount_percentage, images, is_active, is_deal, is_new, is_featured, stock, slug, created_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(80);
          if (!error && Array.isArray(data)) mainData = data;
        }
      } catch (_) {}

      // Direct REST fallback if client not ready
      if (!mainData) {
        try {
          const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?select=id,name,price,original_price,discount_percentage,images,is_active,is_deal,is_new,is_featured,stock,slug,created_at&is_active=eq.true&order=created_at.desc&limit=80`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) mainData = data;
          }
        } catch (_) {}
      }

      // 2. Fetch Sarojini Bazaar Products (active only)
      let sarojiniData = null;
      try {
        if (client) {
          const { data, error } = await client
            .from("sarojini_products")
            .select("id, name, price, original_price, discount_percentage, images, is_active, is_deal, is_new, is_featured, stock, slug, department, created_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(80);
          if (!error && Array.isArray(data)) sarojiniData = data;
        }
      } catch (_) {}

      // Direct REST fallback if client not ready
      if (!sarojiniData) {
        try {
          const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/sarojini_products?select=id,name,price,original_price,discount_percentage,images,is_active,is_deal,is_new,is_featured,stock,slug,department,created_at&is_active=eq.true&order=created_at.desc&limit=80`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) sarojiniData = data;
          }
        } catch (_) {}
      }

      // 3. Fetch BOGO Configuration IDs
      try {
        const bRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.bogo_config&select=key,value`, {
          headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData && bData[0] && bData[0].value && Array.isArray(bData[0].value.product_ids)) {
            bogoConfigIds = bData[0].value.product_ids;
          }
        }
      } catch (_) {}

      // Fallback BOGO IDs from localStorage
      if (!bogoConfigIds || bogoConfigIds.length === 0) {
        try {
          const cached = localStorage.getItem("velora_bogo_config");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.product_ids)) bogoConfigIds = parsed.product_ids;
          }
        } catch (_) {}
      }

      // ----------------------------------------------------------------------
      // PROCESS Main VALORA POOL (Deduplicated Strictly by product.id)
      // ----------------------------------------------------------------------
      if (mainData && Array.isArray(mainData) && mainData.length > 0) {
        const seenMainIds = new Set();
        const nextMainPool = [];

        for (const item of mainData) {
          if (!item || !item.id || seenMainIds.has(item.id)) continue;
          if (item.is_active === false) continue; // Respect deactivation

          seenMainIds.add(item.id);
          const price = Number(item.price) || 0;
          const originalPrice = item.original_price ? Number(item.original_price) : null;
          let discount = Number(item.discount_percentage) || 0;
          if (!discount && originalPrice && originalPrice > price) {
            discount = Math.round(((originalPrice - price) / originalPrice) * 100);
          }

          const isBogoMatch = Boolean(item.is_bogo) || bogoConfigIds.includes(item.id);

          nextMainPool.push({
            id: item.id,
            catalog: 'main',
            uniqueKey: 'main:' + item.id,
            name: item.name || "VALORA Luxury Creation",
            brand: "VALORA Atelier",
            price: price,
            originalPrice: originalPrice,
            discount: discount,
            image: extractProductImage(item),
            isTrending: Boolean(item.is_featured),
            isDeal: Boolean(item.is_deal),
            isNew: Boolean(item.is_new),
            isBogo: isBogoMatch,
            slug: item.slug || '',
            route: `product.html?id=${encodeURIComponent(item.id)}`
          });
        }

        if (nextMainPool.length > 0) {
          mainProductsPool = nextMainPool;
        }
      }

      // ----------------------------------------------------------------------
      // PROCESS SAROJINI BAZAAR POOL (Deduplicated Strictly by product.id)
      // ----------------------------------------------------------------------
      if (sarojiniData && Array.isArray(sarojiniData) && sarojiniData.length > 0) {
        const seenSarojiniIds = new Set();
        const nextSarojiniPool = [];

        for (const item of sarojiniData) {
          if (!item || !item.id || seenSarojiniIds.has(item.id)) continue;
          if (item.is_active === false) continue; // Respect deactivation

          seenSarojiniIds.add(item.id);
          const price = Number(item.price) || 0;
          const originalPrice = item.original_price ? Number(item.original_price) : null;
          let discount = Number(item.discount_percentage) || 0;
          if (!discount && originalPrice && originalPrice > price) {
            discount = Math.round(((originalPrice - price) / originalPrice) * 100);
          }

          const isBogoMatch = Boolean(item.is_bogo) || bogoConfigIds.includes(item.id);

          nextSarojiniPool.push({
            id: item.id,
            catalog: 'sarojini',
            uniqueKey: 'sarojini:' + item.id,
            name: item.name || "Sarojini Street Find",
            brand: "Sarojini Bazaar",
            department: item.department || "Fashion",
            price: price,
            originalPrice: originalPrice,
            discount: discount,
            image: extractProductImage(item),
            isTrending: Boolean(item.is_featured),
            isDeal: Boolean(item.is_deal),
            isNew: Boolean(item.is_new),
            isBogo: isBogoMatch,
            slug: item.slug || '',
            route: `sarojini-product-details.html?id=${encodeURIComponent(item.id)}`
          });
        }

        if (nextSarojiniPool.length > 0) {
          sarojiniProductsPool = nextSarojiniPool;
        }
      }

      lastFetchTimestamp = Date.now();
    } catch (err) {
      console.warn("Live Sales database synchronization notice:", err);
    } finally {
      isFetchingProducts = false;
    }
  }

  // ==========================================================================
  // 7. ACTIVE POOL SELECTION & BOGO ENGINE (100% ID-BASED)
  // ==========================================================================

  /**
   * Returns the appropriate active product pool based on the storefront catalog context.
   */
  function getActiveProductPool() {
    const context = getCurrentStoreContext();

    if (context === 'sarojini') {
      if (sarojiniProductsPool.length > 0) return sarojiniProductsPool;
      if (mainProductsPool.length > 0) return mainProductsPool;
    } else {
      if (mainProductsPool.length > 0) return mainProductsPool;
      if (sarojiniProductsPool.length > 0) return sarojiniProductsPool;
    }

    // Client-side bootstrap fallback if network is in-flight
    if (typeof window !== "undefined" && Array.isArray(window.PRODUCTS_DATA) && window.PRODUCTS_DATA.length > 0) {
      return window.PRODUCTS_DATA.map(p => ({
        id: p.id,
        catalog: 'main',
        uniqueKey: 'main:' + p.id,
        name: p.name || p.title || "VALORA Item",
        price: Number(p.price) || 0,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        discount: p.discount || 0,
        image: extractProductImage(p),
        isTrending: Boolean(p.isTrending),
        isDeal: Boolean(p.isDeal),
        isNew: Boolean(p.isNew),
        isBogo: Boolean(p.isBogo || p.is_bogo),
        route: `product.html?id=${encodeURIComponent(p.id)}`
      }));
    }

    return [];
  }

  /**
   * Returns all active products eligible for BOGO offers.
   */
  function getBogoEligibleProducts() {
    const pool = getActiveProductPool();
    if (pool.length === 0) return [];

    const eligible = pool.filter(p => {
      if (!p || !p.id || !p.name) return false;
      return Boolean(
        p.isBogo ||
        (bogoConfigIds.length > 0 && bogoConfigIds.includes(p.id)) ||
        p.isDeal ||
        p.discount >= 20
      );
    });

    return eligible.length > 0 ? eligible : pool;
  }

  /**
   * Matches an eligible free BOGO item adhering to the ₹20–₹40 price difference rule.
   * Product identity comparison is strictly done via candidate.id !== paidProduct.id.
   */
  function getEligibleBogoFreeProduct(paidProduct) {
    if (!paidProduct || !paidProduct.id) return null;
    const pool = getActiveProductPool();
    if (pool.length === 0) return null;

    const paidPrice = Number(paidProduct.price) || 0;

    // Strict Rule 1: distinct ID & selling price within ₹20–₹40
    let candidates = pool.filter(p => {
      if (p.id === paidProduct.id) return false; // Strictly compare ID, never name
      const diff = Math.abs((Number(p.price) || 0) - paidPrice);
      return diff >= 20 && diff <= 40;
    });

    // Fallback Rule 2: distinct ID & within ₹40
    if (candidates.length < 2) {
      candidates = pool.filter(p => {
        if (p.id === paidProduct.id) return false;
        const diff = Math.abs((Number(p.price) || 0) - paidPrice);
        return diff <= 40;
      });
    }

    // Fallback Rule 3: closest priced items
    if (candidates.length < 2) {
      candidates = [...pool]
        .filter(p => p.id !== paidProduct.id)
        .sort((a, b) => Math.abs((Number(a.price) || 0) - paidPrice) - Math.abs((Number(b.price) || 0) - paidPrice));
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
  }

  // ==========================================================================
  // 8. SHUFFLE & DUPLICATE PREVENTION (STRICTLY UNIQUE PRODUCT KEY)
  // ==========================================================================
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getNextDemoName() {
    if (shuffledNames.length === 0 || nameIndex >= shuffledNames.length) {
      shuffledNames = shuffleArray(INDIAN_DEMO_NAMES);
      nameIndex = 0;
    }

    let candidate = shuffledNames[nameIndex++];
    let attempts = 0;

    while (recentNames.includes(candidate) && attempts < 10 && nameIndex < shuffledNames.length) {
      candidate = shuffledNames[nameIndex++];
      attempts++;
    }

    recentNames.push(candidate);
    if (recentNames.length > CONFIG.historyWindowSize) {
      recentNames.shift();
    }

    return candidate;
  }

  /**
   * Selects a random eligible product.
   * Product uniqueness is tracked strictly using uniqueKey (`${catalog}:${id}`).
   * Products with identical names but different IDs are preserved as distinct.
   */
  function getRandomNormalProduct() {
    const pool = getActiveProductPool();
    if (pool.length === 0) return null;

    let available = pool.filter(p => !recentProductKeys.includes(p.uniqueKey));
    if (available.length === 0) {
      recentProductKeys.length = 0;
      available = pool;
    }

    const selected = available[Math.floor(Math.random() * available.length)];
    recentProductKeys.push(selected.uniqueKey);
    if (recentProductKeys.length > CONFIG.productHistoryWindowSize) {
      recentProductKeys.shift();
    }

    return selected;
  }

  function getRandomBogoProduct() {
    const bogoProducts = getBogoEligibleProducts();
    if (!bogoProducts || bogoProducts.length === 0) return null;

    let available = bogoProducts.filter(p => !recentProductKeys.includes(p.uniqueKey));
    if (available.length === 0) {
      available = bogoProducts;
    }

    const selected = available[Math.floor(Math.random() * available.length)];
    recentProductKeys.push(selected.uniqueKey);
    if (recentProductKeys.length > CONFIG.productHistoryWindowSize) {
      recentProductKeys.shift();
    }

    return selected;
  }

  function pickNextActivityType() {
    if (!enableBogo) return 'normal';
    if (!enableNormal) return 'bogo';

    const bogoProducts = getBogoEligibleProducts();
    if (!bogoProducts || bogoProducts.length === 0) {
      return 'normal';
    }

    if (consecutiveBogoCount >= 2) {
      consecutiveBogoCount = 0;
      consecutiveNormalCount++;
      return 'normal';
    }

    if (consecutiveNormalCount >= 3) {
      consecutiveNormalCount = 0;
      consecutiveBogoCount++;
      return 'bogo';
    }

    const isBogo = Math.random() < CONFIG.bogoRatio;
    if (isBogo) {
      consecutiveBogoCount++;
      consecutiveNormalCount = 0;
      return 'bogo';
    } else {
      consecutiveNormalCount++;
      consecutiveBogoCount = 0;
      return 'normal';
    }
  }

  function getRandomTime() {
    return RELATIVE_TIMES[Math.floor(Math.random() * RELATIVE_TIMES.length)];
  }

  function getRandomCity() {
    return INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)];
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // 9. DOM CREATION & EVENT LISTENERS
  // ==========================================================================
  function createDOM() {
    if (document.getElementById('velora-order-activity')) {
      containerEl = document.getElementById('velora-order-activity');
      cardEl = document.getElementById('velora-activity-card');
      thumbImg = document.getElementById('velora-activity-img');
      iconEl = document.getElementById('velora-activity-icon');
      tagTextEl = document.getElementById('velora-activity-tagtext');
      userNameEl = document.getElementById('velora-activity-username');
      actionEl = document.getElementById('velora-activity-action');
      productNameEl = document.getElementById('velora-activity-productname');
      timeEl = document.getElementById('velora-activity-time');
      cityEl = document.getElementById('velora-activity-city');
      return;
    }

    containerEl = document.createElement('div');
    containerEl.id = 'velora-order-activity';
    containerEl.className = 'velora-order-activity';
    containerEl.setAttribute('role', 'status');
    containerEl.setAttribute('aria-live', 'polite');

    containerEl.innerHTML = `
      <div class="velora-activity-card" id="velora-activity-card">
        <div class="velora-activity-thumb">
          <img src="" alt="Product" id="velora-activity-img" loading="lazy" />
          <span class="velora-activity-dot" id="velora-activity-dot" aria-hidden="true"></span>
        </div>
        <div class="velora-activity-content">
          <div class="velora-activity-header">
            <span class="velora-activity-tag" id="velora-activity-tag">
              <span class="activity-icon" id="velora-activity-icon">🛍️</span>
              <span id="velora-activity-tagtext">Recent Order</span>
            </span>
          </div>
          <div class="velora-activity-user">
            <strong id="velora-activity-username">Aarav Sharma</strong>
            <span class="action-word" id="velora-activity-action">just ordered</span>
          </div>
          <div class="velora-activity-product" id="velora-activity-productname">Product</div>
          <div class="velora-activity-footer">
            <span class="velora-activity-time" id="velora-activity-time">8 sec ago</span>
            <span>•</span>
            <span class="velora-activity-badge" id="velora-activity-city">Verified Buyer</span>
          </div>
        </div>
        <button type="button" class="velora-activity-close" id="velora-activity-close" aria-label="Dismiss">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    document.body.appendChild(containerEl);

    // Detect mobile sticky purchase bar on product pages
    if (document.querySelector('.mobile-sticky-purchase-bar') || document.querySelector('.mobile-sticky-action-bar') || document.querySelector('.sticky-cart-bar')) {
      document.body.classList.add('has-sticky-bar');
    }

    cardEl = document.getElementById('velora-activity-card');
    thumbImg = document.getElementById('velora-activity-img');
    iconEl = document.getElementById('velora-activity-icon');
    tagTextEl = document.getElementById('velora-activity-tagtext');
    userNameEl = document.getElementById('velora-activity-username');
    actionEl = document.getElementById('velora-activity-action');
    productNameEl = document.getElementById('velora-activity-productname');
    timeEl = document.getElementById('velora-activity-time');
    cityEl = document.getElementById('velora-activity-city');

    const closeBtn = document.getElementById('velora-activity-close');

    // Click card to visit product details (Catalog-aware routing)
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('#velora-activity-close')) return;
      if (currentProduct && currentProduct.route) {
        window.location.href = currentProduct.route;
      } else if (currentProduct && currentProduct.id) {
        const route = (currentProduct.catalog === 'sarojini')
          ? `sarojini-product-details.html?id=${encodeURIComponent(currentProduct.id)}`
          : `product.html?id=${encodeURIComponent(currentProduct.id)}`;
        window.location.href = route;
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissNotification();
    });

    cardEl.addEventListener('mouseenter', () => {
      isHovered = true;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    });

    cardEl.addEventListener('mouseleave', () => {
      isHovered = false;
      if (containerEl && containerEl.classList.contains('is-visible')) {
        clearAllTimers();
        hideTimer = setTimeout(transitionToNextNotification, 2500);
      }
    });

    cardEl.addEventListener('touchstart', () => {
      isHovered = true;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }, { passive: true });
  }

  // ==========================================================================
  // 10. NOTIFICATION LIFECYCLE (EXACT 25-SECOND INTERVAL)
  // ==========================================================================
  function showNextNotification(forceType) {
    clearAllTimers();

    if (!isEnabled || isPaused || isHovered) return;

    // Suppress notifications on checkout, account, and admin portal
    const pathname = (window.location.pathname || '').toLowerCase();
    if (pathname.includes('checkout') || pathname.includes('account') || pathname.includes('admin')) {
      return;
    }

    const activityType = forceType || pickNextActivityType();
    lastActivityType = activityType;

    let product = null;
    let freePairProduct = null;

    if (activityType === 'bogo') {
      product = getRandomBogoProduct();
      if (product) {
        freePairProduct = getEligibleBogoFreeProduct(product);
      }
    }

    if (!product) {
      product = getRandomNormalProduct();
      lastActivityType = 'normal';
    }

    if (!product) {
      // If products are still fetching from Supabase, retry shortly
      scheduleNextRotation(3000);
      return;
    }

    const customerName = getNextDemoName();
    const timeString = getRandomTime();
    const cityString = getRandomCity();
    const isBogo = (lastActivityType === 'bogo');
    const isSarojini = (product.catalog === 'sarojini');

    currentProduct = product;

    const isTrending = Boolean(product && product.isTrending);

    // Update DOM elements
    if (userNameEl) userNameEl.textContent = customerName;

    if (actionEl) {
      if (isBogo) {
        actionEl.textContent = 'claimed BOGO offer';
      } else if (isTrending) {
        actionEl.textContent = isSarojini ? 'bagged viral find' : 'ordered trending item';
      } else {
        actionEl.textContent = isSarojini ? 'picked up' : 'just ordered';
      }
    }

    if (iconEl) {
      if (isBogo) {
        iconEl.textContent = '🎁';
      } else if (isTrending) {
        iconEl.textContent = '⚡';
      } else {
        iconEl.textContent = isSarojini ? '🛍️' : '🛍️';
      }
    }

    if (tagTextEl) {
      if (isBogo) {
        tagTextEl.textContent = '🔥 BOGO PICK';
      } else if (isTrending) {
        tagTextEl.textContent = isSarojini ? '🔥 SAROJINI STEAL' : '⚡ TRENDING PICK';
      } else {
        tagTextEl.textContent = isSarojini ? 'Sarojini Bazaar' : 'Recent Order';
      }
    }

    if (productNameEl) {
      const pTitle = product.name || "Curated Find";
      if (isBogo) {
        productNameEl.innerHTML = `${escapeHTML(pTitle)} <span class="velora-activity-bogo-badge">+ FREE BOGO</span>`;
        productNameEl.title = freePairProduct ? `${pTitle} + Free ${freePairProduct.name}` : `${pTitle} (Buy 1 Get 1 Free)`;
      } else if (isTrending) {
        const badgeColor = isSarojini ? '#e11d48' : '#fbbf24';
        const bgGrad = isSarojini ? 'rgba(225,29,72,0.15)' : 'rgba(245,158,11,0.2)';
        productNameEl.innerHTML = `${escapeHTML(pTitle)} <span class="velora-activity-bogo-badge" style="background:${bgGrad};color:${badgeColor};">${isSarojini ? '🔥 Viral' : '🔥 Trending'}</span>`;
        productNameEl.title = pTitle;
      } else {
        productNameEl.textContent = pTitle;
        productNameEl.title = pTitle;
      }
    }

    if (thumbImg) {
      thumbImg.src = product.image;
      thumbImg.alt = product.name || "Product";
    }

    if (timeEl) timeEl.textContent = timeString;

    if (cityEl) {
      if (isBogo) {
        cityEl.innerHTML = `<span class="bogo-deal-tag">Buy 1 Get 1 Free</span>`;
      } else if (isTrending) {
        cityEl.innerHTML = `<span class="bogo-deal-tag" style="background:rgba(245,158,11,0.15);color:#fbbf24;">Top Seller</span>`;
      } else if (isSarojini) {
        cityEl.textContent = `Verified (${cityString})`;
      } else {
        cityEl.textContent = `Verified (${cityString})`;
      }
    }

    if (cardEl) {
      cardEl.classList.toggle('is-bogo-order', isBogo);
    }

    if (containerEl) {
      containerEl.classList.remove('is-exiting');
      containerEl.classList.add('is-visible');
    }

    // Keep visible for exactly 25 seconds, then transition
    hideTimer = setTimeout(() => {
      if (!isHovered) {
        transitionToNextNotification();
      }
    }, CONFIG.displayDurationMs);
  }

  function transitionToNextNotification() {
    clearAllTimers();

    if (!containerEl || !containerEl.classList.contains('is-visible')) {
      showNextNotification();
      return;
    }

    containerEl.classList.remove('is-visible');
    containerEl.classList.add('is-exiting');

    activeTimer = setTimeout(() => {
      if (containerEl) containerEl.classList.remove('is-exiting');
      showNextNotification();
    }, 280);
  }

  function dismissNotification() {
    clearAllTimers();

    if (!containerEl || !containerEl.classList.contains('is-visible')) return;

    containerEl.classList.remove('is-visible');
    containerEl.classList.add('is-exiting');

    activeTimer = setTimeout(() => {
      if (containerEl) containerEl.classList.remove('is-exiting');
      scheduleNextRotation(CONFIG.rotationIntervalMs);
    }, 280);
  }

  function hideNotification() {
    clearAllTimers();

    if (!containerEl || !containerEl.classList.contains('is-visible')) return;

    containerEl.classList.remove('is-visible');
    containerEl.classList.add('is-exiting');

    activeTimer = setTimeout(() => {
      if (containerEl) containerEl.classList.remove('is-exiting');
    }, 280);
  }

  function scheduleNextRotation(delayMs) {
    clearAllTimers();

    if (!isEnabled || isPaused) return;

    activeTimer = setTimeout(() => {
      showNextNotification();
    }, delayMs || CONFIG.rotationIntervalMs);
  }

  // ==========================================================================
  // 11. AUTOMATIC REFRESH FOR FUTURE PRODUCTS
  // ==========================================================================
  function scheduleCatalogRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      fetchEligibleProducts(true);
    }, CONFIG.catalogRefreshIntervalMs);
  }

  function hookVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isPaused = true;
        clearAllTimers();
      } else {
        isPaused = false;
        // Check if catalog is stale when tab regains focus
        if (Date.now() - lastFetchTimestamp > CONFIG.catalogRefreshIntervalMs) {
          fetchEligibleProducts(true);
        }
        if (isEnabled) {
          scheduleNextRotation(1500);
        }
      }
    });

    // Reactive sync on catalog modification events
    window.addEventListener('velora:products-synced', () => fetchEligibleProducts(true));
    window.addEventListener('velora:cache-invalidated', () => fetchEligibleProducts(true));
  }

  function destroy() {
    clearAllTimers();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (containerEl && containerEl.parentNode) {
      containerEl.parentNode.removeChild(containerEl);
      containerEl = null;
    }
    window.removeEventListener('beforeunload', destroy);
    window.removeEventListener('pagehide', destroy);
  }

  window.addEventListener('beforeunload', destroy);
  window.addEventListener('pagehide', destroy);

  // ==========================================================================
  // 12. PUBLIC API & BOOTSTRAP
  // ==========================================================================
  const VeloraOrderActivity = {
    version: '3.0.0',
    totalDemoNames: INDIAN_DEMO_NAMES.length,
    demoNames: INDIAN_DEMO_NAMES,

    start: function () {
      isEnabled = true;
      try {
        const stored = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
        stored.enabled = true;
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(stored));
      } catch (e) {}
      scheduleNextRotation(1000);
    },

    stop: function () {
      isEnabled = false;
      try {
        const stored = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
        stored.enabled = false;
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(stored));
      } catch (e) {}
      clearAllTimers();
      if (containerEl) {
        containerEl.classList.remove('is-visible', 'is-exiting');
      }
    },

    showNext: function (type) {
      showNextNotification(type);
    },

    show: function (type) {
      showNextNotification(type);
    },

    hide: function () {
      hideNotification();
    },

    toggle: function (enable) {
      if (enable === undefined) enable = !isEnabled;
      if (enable) this.start();
      else this.stop();
      return isEnabled;
    },

    setBogoEnabled: function (val) {
      enableBogo = Boolean(val);
      return enableBogo;
    },

    setNormalEnabled: function (val) {
      enableNormal = Boolean(val);
      return enableNormal;
    },

    setInterval: function (intervalMs) {
      if (typeof intervalMs === 'number' && intervalMs >= 1000) {
        CONFIG.rotationIntervalMs = intervalMs;
        CONFIG.displayDurationMs = intervalMs;
        CONFIG.minIntervalMs = intervalMs;
        CONFIG.maxIntervalMs = intervalMs;
      }
    },

    setDisplayDuration: function (ms) {
      if (typeof ms === 'number' && ms >= 1000) {
        CONFIG.displayDurationMs = ms;
      }
    },

    setMode: function (mode) {
      if (mode === 'real' || mode === 'demo') {
        currentMode = mode;
      }
      return currentMode;
    },

    refreshProducts: async function () {
      await fetchEligibleProducts(true);
      return {
        mainCount: mainProductsPool.length,
        sarojiniCount: sarojiniProductsPool.length
      };
    },

    getBogoEligibleProducts: function () {
      return getBogoEligibleProducts();
    },

    getPoolCounts: function () {
      return {
        main: mainProductsPool.length,
        sarojini: sarojiniProductsPool.length,
        activeContext: getCurrentStoreContext()
      };
    },

    destroy: function () {
      destroy();
    },

    getStatus: function () {
      return {
        enabled: isEnabled,
        mode: currentMode,
        enableNormal,
        enableBogo,
        totalDemoNames: INDIAN_DEMO_NAMES.length,
        currentProduct: currentProduct ? (currentProduct.name || currentProduct.id) : null,
        lastActivityType,
        mainPoolCount: mainProductsPool.length,
        sarojiniPoolCount: sarojiniProductsPool.length,
        bogoEligibleCount: getBogoEligibleProducts().length,
        recentProductKeysCount: recentProductKeys.length,
        recentNamesCount: recentNames.length,
        storeContext: getCurrentStoreContext(),
        rotationIntervalMs: CONFIG.rotationIntervalMs,
        displayDurationMs: CONFIG.displayDurationMs
      };
    },

    init: async function () {
      try {
        const storedStr = localStorage.getItem(CONFIG.storageKey);
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          if (stored.enabled === false) isEnabled = false;
          if (stored.enableBogo !== undefined) enableBogo = Boolean(stored.enableBogo);
          if (stored.enableNormal !== undefined) enableNormal = Boolean(stored.enableNormal);
          if (stored.rotationIntervalMs) {
            CONFIG.rotationIntervalMs = stored.rotationIntervalMs;
            CONFIG.displayDurationMs = stored.rotationIntervalMs;
          }
        }
      } catch (e) {}

      createDOM();
      hookVisibility();
      scheduleCatalogRefresh();

      // Initiate dynamic Supabase fetch immediately
      await fetchEligibleProducts();

      // Start initial entrance after 2 seconds on page load
      if (isEnabled) {
        scheduleNextRotation(2000);
      }
    }
  };

  window.VeloraOrderActivity = VeloraOrderActivity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VeloraOrderActivity.init());
  } else {
    VeloraOrderActivity.init();
  }

})();
