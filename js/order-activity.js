/**
 * VELORA - Live Order Activity Notification System
 * 
 * Demonstrates live customer order social-proof notifications cycling through 
 * 100 Indian customer names and genuine VELORA catalog products, including 
 * normal orders and official BOGO (Buy 1 Get 1 Free) activities.
 * 
 * TIMING SPECIFICATION:
 * - Exactly 25-second rotation interval.
 * - Each notification remains visible for 25 seconds.
 * - Smooth exit transition directly into the next notification.
 * - Zero overlapping timers or duplicate notifications.
 * - Comprehensive cleanup on component destroy / page unload.
 * 
 * ARCHITECTURE & CONSTRAINTS:
 * - Purely client-side storefront activity simulation.
 * - ZERO database pollution: No fake records are inserted into Supabase tables.
 * - No customer-facing "DEMO" labels: Clean, authentic, luxury shopping-app appearance.
 * - Live BOGO activity dynamically detects genuine BOGO-eligible products from VADI's
 *   existing BOGO configuration and preserves the ₹20–₹40 price difference pairing rules.
 * - Ready for future real-order mode with strict customer anonymization.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. EXACT 100 REALISTIC INDIAN DEMO CUSTOMER NAMES
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

  // Realistic relative time strings
  const RELATIVE_TIMES = Object.freeze([
    "Just now",
    "6 sec ago",
    "12 sec ago",
    "18 sec ago",
    "24 sec ago",
    "35 sec ago",
    "48 sec ago",
    "1 min ago",
    "2 min ago",
    "3 min ago",
    "4 min ago"
  ]);

  // Indian cities for subtle localization
  const INDIAN_CITIES = Object.freeze([
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad",
    "Chennai", "Kolkata", "Pune", "Jaipur", "Lucknow", "Chandigarh"
  ]);

  // ==========================================================================
  // 2. CONFIGURATION & STATE
  // ==========================================================================
  const CONFIG = {
    storageKey: 'velora_order_activity_config',
    displayDurationMs: 25000,    // Exactly 25 seconds visible duration
    rotationIntervalMs: 25000,   // Exactly 25 seconds between notifications
    minIntervalMs: 25000,        // 25 seconds
    maxIntervalMs: 25000,        // 25 seconds
    historyWindowSize: 25,       // Recently shown customer names memory
    productHistoryWindowSize: 8, // Recently shown product IDs memory
    bogoRatio: 0.35              // Target ratio for BOGO activities (~35%)
  };

  let isEnabled = true;
  let enableNormal = true;
  let enableBogo = true;
  let isPaused = false;
  let isHovered = false;

  // Single-source timer tracking to prevent ANY overlapping timers
  let activeTimer = null;
  let hideTimer = null;

  let shuffledNames = [];
  let nameIndex = 0;
  const recentNames = [];
  const recentProducts = [];

  let consecutiveNormalCount = 0;
  let consecutiveBogoCount = 0;
  let lastActivityType = 'normal'; // 'normal' | 'bogo'

  // DOM element caches
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

  // Real-order mode architecture placeholder
  let currentMode = 'demo'; // 'demo' | 'real'

  // ==========================================================================
  // 3. SAFE TIMER MANAGEMENT (NO OVERLAPS)
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
  // 4. BOGO INTEGRATION & ELIGIBILITY ENGINE
  // ==========================================================================

  /**
   * Retrieves active BOGO product IDs from VELORA store settings / cache / deals fallback
   */
  function getBogoConfigIds() {
    let bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
      ? window.VELORA_SETTINGS.bogo_config.product_ids
      : [];

    if (!bogoConfigIds || bogoConfigIds.length === 0) {
      try {
        const cached = localStorage.getItem("velora_bogo_config");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.product_ids) && parsed.product_ids.length > 0) {
            bogoConfigIds = parsed.product_ids;
          }
        }
      } catch (e) {}
    }

    if (!bogoConfigIds || bogoConfigIds.length === 0) {
      const dealIds = (window.PRODUCTS_DATA || [])
        .filter(p => p.badgeType === "deal" || p.discountPercent >= 20 || p.isBogo || p.is_bogo)
        .map(p => p.id);
      if (dealIds.length > 0) bogoConfigIds = dealIds;
    }

    return bogoConfigIds || [];
  }

  /**
   * Returns all products that are currently eligible for BOGO under VADI's rules
   */
  function getBogoEligibleProducts() {
    if (!window.PRODUCTS_DATA || !Array.isArray(window.PRODUCTS_DATA) || window.PRODUCTS_DATA.length === 0) {
      return [];
    }

    const bogoIds = getBogoConfigIds();

    const eligible = window.PRODUCTS_DATA.filter(p => {
      if (!p || (!p.name && !p.title) || (!p.image && (!p.images || !p.images[0]))) return false;
      return Boolean(
        p.isBogo ||
        p.is_bogo ||
        (bogoIds.length > 0 && (
          bogoIds.includes(p.id) ||
          (p.supabase_id && bogoIds.includes(p.supabase_id)) ||
          (p.legacyId && bogoIds.includes(p.legacyId))
        ))
      );
    });

    if (eligible.length > 0) return eligible;

    // Fallback: active deals or high-discount products if settings haven't loaded yet
    return window.PRODUCTS_DATA.filter(p => p.badgeType === "deal" || (p.discountPercent && p.discountPercent >= 20));
  }

  /**
   * Matches an eligible free BOGO item adhering to VADI's ₹20–₹40 price difference rule
   */
  function getEligibleBogoFreeProduct(paidProduct) {
    if (!paidProduct || !window.PRODUCTS_DATA) return null;
    const paidPrice = Number(paidProduct.price) || 0;

    // Strict Rule 1: selling price within ₹20–₹40 of purchased product price
    let candidates = window.PRODUCTS_DATA.filter(p => {
      if (p.id === paidProduct.id || (paidProduct.supabase_id && p.id === paidProduct.supabase_id) || (p.supabase_id && p.supabase_id === paidProduct.id)) return false;
      const diff = Math.abs((Number(p.price) || 0) - paidPrice);
      return diff >= 20 && diff <= 40;
    });

    // Fallback Rule 2: within ₹40 if strict range yields fewer than 2 items
    if (candidates.length < 2) {
      candidates = window.PRODUCTS_DATA.filter(p => {
        if (p.id === paidProduct.id || (paidProduct.supabase_id && p.id === paidProduct.supabase_id) || (p.supabase_id && p.supabase_id === paidProduct.id)) return false;
        const diff = Math.abs((Number(p.price) || 0) - paidPrice);
        return diff <= 40;
      });
    }

    // Fallback Rule 3: closest priced items
    if (candidates.length < 2) {
      candidates = [...window.PRODUCTS_DATA]
        .filter(p => p.id !== paidProduct.id && (!paidProduct.supabase_id || p.id !== paidProduct.supabase_id) && (!p.supabase_id || p.supabase_id !== paidProduct.id))
        .sort((a, b) => Math.abs((Number(a.price) || 0) - paidPrice) - Math.abs((Number(b.price) || 0) - paidPrice));
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
  }

  // ==========================================================================
  // 5. SHUFFLE & DUPLICATE PREVENTION ALGORITHM
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

    // Ensure candidate is not in recent history window
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

  function getRandomNormalProduct() {
    const products = (typeof window !== "undefined" && Array.isArray(window.PRODUCTS_DATA) && window.PRODUCTS_DATA.length > 0)
      ? window.PRODUCTS_DATA
      : [];

    if (products.length === 0) return null;

    const eligible = products.filter(p => p && (p.name || p.title) && (p.image || (p.images && p.images[0])));
    if (eligible.length === 0) return null;

    let pool = eligible.filter(p => !recentProducts.includes(p.id));
    if (pool.length === 0) {
      recentProducts.length = 0;
      pool = eligible;
    }

    const selected = pool[Math.floor(Math.random() * pool.length)];
    recentProducts.push(selected.id);
    if (recentProducts.length > CONFIG.productHistoryWindowSize) {
      recentProducts.shift();
    }

    return selected;
  }

  function getRandomBogoProduct() {
    const bogoProducts = getBogoEligibleProducts();
    if (!bogoProducts || bogoProducts.length === 0) return null;

    let pool = bogoProducts.filter(p => !recentProducts.includes(p.id));
    if (pool.length === 0) {
      pool = bogoProducts;
    }

    const selected = pool[Math.floor(Math.random() * pool.length)];
    recentProducts.push(selected.id);
    if (recentProducts.length > CONFIG.productHistoryWindowSize) {
      recentProducts.shift();
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

    // Force normal if 2 consecutive BOGOs
    if (consecutiveBogoCount >= 2) {
      consecutiveBogoCount = 0;
      consecutiveNormalCount++;
      return 'normal';
    }

    // Force BOGO if 3 consecutive normal orders
    if (consecutiveNormalCount >= 3) {
      consecutiveNormalCount = 0;
      consecutiveBogoCount++;
      return 'bogo';
    }

    // Otherwise ~35% chance of BOGO
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
  // 6. DOM INJECTION & CREATION
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

    // Detect mobile sticky bottom purchase bar on product pages
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

    // Click card to visit product details
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('#velora-activity-close')) return;
      if (currentProduct && currentProduct.id) {
        window.location.href = `product.html?id=${encodeURIComponent(currentProduct.id)}`;
      }
    });

    // Dismiss button closes immediately and schedules the next notification after 25 seconds
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissNotification();
    });

    // Pause on hover
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

    // Pause on mobile touchstart
    cardEl.addEventListener('touchstart', () => {
      isHovered = true;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }, { passive: true });
  }

  // ==========================================================================
  // 7. NOTIFICATION LIFECYCLE & ROTATION (EXACTLY 25-SECOND INTERVAL)
  // ==========================================================================

  /**
   * Renders and displays the next notification, keeping it visible for 25 seconds
   */
  function showNextNotification(forceType) {
    clearAllTimers();

    if (!isEnabled || isPaused || isHovered) return;

    // Minimize distraction on checkout or admin pages
    const pathname = window.location.pathname || '';
    if (pathname.includes('checkout.html') || pathname.includes('account.html') || pathname.includes('admin')) {
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

    // Fallback to normal product if BOGO yielded null
    if (!product) {
      product = getRandomNormalProduct();
      lastActivityType = 'normal';
    }

    if (!product) {
      // Retry in 3s if products are still loading asynchronously
      scheduleNextRotation(3000);
      return;
    }

    const customerName = getNextDemoName();
    const timeString = getRandomTime();
    const cityString = getRandomCity();
    const isBogo = (lastActivityType === 'bogo');

    currentProduct = product;

    const isTrending = Boolean(product && (product.isTrending || product.badgeType === 'trending'));

    // Update DOM
    if (userNameEl) userNameEl.textContent = customerName;

    if (actionEl) {
      if (isBogo) {
        actionEl.textContent = 'claimed BOGO offer';
      } else if (isTrending) {
        actionEl.textContent = 'ordered trending item';
      } else {
        actionEl.textContent = 'just ordered';
      }
    }

    if (iconEl) {
      if (isBogo) {
        iconEl.textContent = '🎁';
      } else if (isTrending) {
        iconEl.textContent = '⚡';
      } else {
        iconEl.textContent = '🛍️';
      }
    }

    if (tagTextEl) {
      if (isBogo) {
        tagTextEl.textContent = '🔥 BOGO PICK';
      } else if (isTrending) {
        tagTextEl.textContent = '⚡ TRENDING PICK';
      } else {
        tagTextEl.textContent = 'Recent Order';
      }
    }

    if (productNameEl) {
      const pTitle = product.name || product.title || "Luxury Lifestyle";
      if (isBogo) {
        productNameEl.innerHTML = `${escapeHTML(pTitle)} <span class="velora-activity-bogo-badge">+ FREE BOGO</span>`;
        productNameEl.title = freePairProduct ? `${pTitle} + Free ${freePairProduct.name}` : `${pTitle} (Buy 1 Get 1 Free)`;
      } else if (isTrending) {
        productNameEl.innerHTML = `${escapeHTML(pTitle)} <span class="velora-activity-bogo-badge" style="background:rgba(245,158,11,0.2);color:#fbbf24;border-color:rgba(245,158,11,0.4);">🔥 Trending</span>`;
        productNameEl.title = pTitle;
      } else {
        productNameEl.textContent = pTitle;
        productNameEl.title = pTitle;
      }
    }

    if (thumbImg) {
      const imgSrc = product.image || (product.images && product.images[0]) || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80";
      thumbImg.src = imgSrc;
      thumbImg.alt = product.name || "Product";
    }

    if (timeEl) timeEl.textContent = timeString;

    if (cityEl) {
      if (isBogo) {
        cityEl.innerHTML = `<span class="bogo-deal-tag">Buy 1 Get 1 Free</span>`;
      } else if (isTrending) {
        cityEl.innerHTML = `<span class="bogo-deal-tag" style="background:rgba(245,158,11,0.15);color:#fbbf24;">Top Seller</span>`;
      } else {
        cityEl.textContent = `Verified (${cityString})`;
      }
    }

    if (cardEl) {
      cardEl.classList.toggle('is-bogo-order', isBogo);
    }

    // Trigger 3D enter animation
    if (containerEl) {
      containerEl.classList.remove('is-exiting');
      containerEl.classList.add('is-visible');
    }

    // Keep visible for exactly 25 seconds, then smoothly transition to the next
    hideTimer = setTimeout(() => {
      if (!isHovered) {
        transitionToNextNotification();
      }
    }, CONFIG.displayDurationMs);
  }

  /**
   * Smoothly transitions out of the current notification directly into the next notification
   */
  function transitionToNextNotification() {
    clearAllTimers();

    if (!containerEl || !containerEl.classList.contains('is-visible')) {
      showNextNotification();
      return;
    }

    containerEl.classList.remove('is-visible');
    containerEl.classList.add('is-exiting');

    // Smooth exit transition (280ms) followed immediately by the next notification
    activeTimer = setTimeout(() => {
      if (containerEl) containerEl.classList.remove('is-exiting');
      showNextNotification();
    }, 280);
  }

  /**
   * User dismisses notification via close button; waits 25 seconds before next notification
   */
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

  /**
   * Hides the current notification
   */
  function hideNotification() {
    clearAllTimers();

    if (!containerEl || !containerEl.classList.contains('is-visible')) return;

    containerEl.classList.remove('is-visible');
    containerEl.classList.add('is-exiting');

    activeTimer = setTimeout(() => {
      if (containerEl) containerEl.classList.remove('is-exiting');
    }, 280);
  }

  /**
   * Schedules next rotation with guaranteed single timer
   */
  function scheduleNextRotation(delayMs) {
    clearAllTimers();

    if (!isEnabled || isPaused) return;

    activeTimer = setTimeout(() => {
      showNextNotification();
    }, delayMs || CONFIG.rotationIntervalMs);
  }

  // ==========================================================================
  // 8. PAGE VISIBILITY API & CLEANUP
  // ==========================================================================
  function hookVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isPaused = true;
        clearAllTimers();
      } else {
        isPaused = false;
        if (isEnabled) {
          scheduleNextRotation(1500);
        }
      }
    });
  }

  /**
   * Clean up all timers, DOM nodes, and window listeners on page/component unload
   */
  function destroy() {
    clearAllTimers();
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
  // 9. PUBLIC API & INITIALIZATION
  // ==========================================================================
  const VeloraOrderActivity = {
    version: '2.1.0',
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

    getBogoEligibleProducts: function () {
      return getBogoEligibleProducts();
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
        currentProduct: currentProduct ? (currentProduct.name || currentProduct.title) : null,
        lastActivityType,
        bogoEligibleCount: getBogoEligibleProducts().length,
        recentNamesCount: recentNames.length,
        rotationIntervalMs: CONFIG.rotationIntervalMs,
        displayDurationMs: CONFIG.displayDurationMs,
        minIntervalMs: CONFIG.minIntervalMs,
        maxIntervalMs: CONFIG.maxIntervalMs
      };
    },

    init: function () {
      // Check stored preference or admin settings
      try {
        const storedStr = localStorage.getItem(CONFIG.storageKey);
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          if (stored.enabled === false) isEnabled = false;
          if (stored.enableBogo !== undefined) enableBogo = Boolean(stored.enableBogo);
          if (stored.enableNormal !== undefined) enableNormal = Boolean(stored.enableNormal);
          if (stored.rotationIntervalMs && stored.rotationIntervalMs !== 10000) {
            CONFIG.rotationIntervalMs = stored.rotationIntervalMs;
            CONFIG.displayDurationMs = stored.rotationIntervalMs;
            CONFIG.minIntervalMs = stored.rotationIntervalMs;
            CONFIG.maxIntervalMs = stored.rotationIntervalMs;
          } else if (stored.rotationIntervalMs === 10000) {
            // Upgrade legacy 10-second setting to exactly 25 seconds
            stored.rotationIntervalMs = 25000;
            stored.displayDurationMs = 25000;
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(stored));
          }
        }
      } catch (e) {}

      createDOM();
      hookVisibility();

      // Initial entrance: start after 2 seconds on page load
      if (isEnabled) {
        scheduleNextRotation(2000);
      }
    }
  };

  // Expose globally
  window.VeloraOrderActivity = VeloraOrderActivity;

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VeloraOrderActivity.init());
  } else {
    VeloraOrderActivity.init();
  }

})();
