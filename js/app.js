/**
 * VELORA - Modern E-Commerce Application State & Interaction Controller
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- Global Application State ---
  const state = {
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [],
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || []),
    activeTrendingCategory: "all",
    dealTimeLeft: 14 * 3600 + 42 * 60 + 15 // Flash deal timer: 14h 42m 15s
  };

  // --- DOM Elements ---
  const elements = {
    categoriesGrid: document.getElementById("categories-grid"),
    trendingGrid: document.getElementById("trending-grid"),
    newArrivalsGrid: document.getElementById("new-arrivals-grid"),
    dealsGrid: document.getElementById("deals-grid"),
    bogoGrid: document.getElementById("bogo-grid"),

    // Rotating Advertisements Carousel
    adsCarouselTrack: document.getElementById("ads-carousel-track"),
    adsCarouselPrev: document.getElementById("ads-carousel-prev"),
    adsCarouselNext: document.getElementById("ads-carousel-next"),
    adsCarouselDots: document.getElementById("ads-carousel-dots"),

    // BOGO Selection Modal
    bogoModalOverlay: document.getElementById("bogo-modal-overlay"),
    bogoModalCloseBtn: document.getElementById("bogo-modal-close-btn"),
    bogoPaidBanner: document.getElementById("bogo-paid-item-banner"),
    bogoEligibleGrid: document.getElementById("bogo-eligible-items-grid"),
    bogoSelectedFreeName: document.getElementById("bogo-selected-free-name"),
    bogoConfirmAddBtn: document.getElementById("bogo-confirm-add-btn"),
    
    // Header & Badges
    cartCountBadges: document.querySelectorAll(".cart-count-badge"),
    wishlistCountBadges: document.querySelectorAll(".wishlist-count-badge"),
    
    // Search
    navSearchInput: document.getElementById("nav-search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    searchResultsDropdown: document.getElementById("search-results-dropdown"),
    mobileSearchInput: document.getElementById("mobile-search-input"),
    
    // Cart Drawer
    cartDrawerOverlay: document.getElementById("cart-drawer-overlay"),
    cartDrawerOpenBtns: document.querySelectorAll(".cart-drawer-trigger"),
    cartDrawerCloseBtn: document.getElementById("cart-drawer-close"),
    cartItemsContainer: document.getElementById("cart-items-container"),
    cartEmptyState: document.getElementById("cart-empty-state"),
    cartSubtotalElem: document.getElementById("cart-subtotal"),
    cartTotalElem: document.getElementById("cart-total"),
    freeShippingFill: document.getElementById("free-shipping-fill"),
    freeShippingMsg: document.getElementById("free-shipping-msg"),
    checkoutBtn: document.getElementById("checkout-btn"),

    // Quick View Modal
    modalOverlay: document.getElementById("quick-view-modal-overlay"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalImg: document.getElementById("modal-product-img"),
    modalCategory: document.getElementById("modal-product-category"),
    modalTitle: document.getElementById("modal-product-title"),
    modalRatingScore: document.getElementById("modal-rating-score"),
    modalReviewsCount: document.getElementById("modal-reviews-count"),
    modalPrice: document.getElementById("modal-product-price"),
    modalOriginalPrice: document.getElementById("modal-product-orig-price"),
    modalDesc: document.getElementById("modal-product-desc"),
    modalSizesContainer: document.getElementById("modal-sizes-container"),
    modalAddToCartBtn: document.getElementById("modal-add-to-cart-btn"),

    // Flash Deal Timer
    timerHours: document.getElementById("timer-hours"),
    timerMinutes: document.getElementById("timer-minutes"),
    timerSeconds: document.getElementById("timer-seconds"),

    // Mobile Navigation
    mobileDrawer: document.getElementById("mobile-drawer"),
    mobileToggleBtn: document.getElementById("mobile-toggle-btn"),
    mobileDrawerCloseBtn: document.getElementById("mobile-drawer-close"),
    mobileDrawerBackdrop: document.getElementById("mobile-drawer-backdrop"),

    // Toast Container
    toastContainer: document.getElementById("toast-container"),

    // Filter Buttons
    filterTabs: document.querySelectorAll(".filter-tab-btn")
  };

  // --- SVG Icons Helpers ---
  const icons = {
    star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    cart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
  };

  // --- Initial Render ---
  init();

  async function init() {
    // Bind listeners immediately so navigation and cart triggers work without waiting
    try { bindEventListeners(); } catch (err) { console.warn("bindEventListeners error:", err); }

    try { renderCategories(); } catch (err) { console.warn("renderCategories error:", err); }
    try { renderTrendingProducts("all"); } catch (err) { console.warn("renderTrendingProducts error:", err); }
    try { renderNewArrivals(); } catch (err) { console.warn("renderNewArrivals error:", err); }
    try { renderFlashDeals(); } catch (err) { console.warn("renderFlashDeals error:", err); }
    try { renderBogoProducts(); } catch (err) { console.warn("renderBogoProducts error:", err); }
    try { initAdvertisementsCarousel(); } catch (err) { console.warn("initAdvertisementsCarousel error:", err); }
    try { initBrandsCarousel(); } catch (err) { console.warn("initBrandsCarousel error:", err); }
    try { updateBadges(); } catch (err) { console.warn("updateBadges error:", err); }
    try { renderCartDrawer(); } catch (err) { console.warn("renderCartDrawer error:", err); }
    try { initFlashDealTimer(); } catch (err) { console.warn("initFlashDealTimer error:", err); }

    // Re-render seamlessly with batched, cached Supabase catalog & config sync
    try {
      await Promise.allSettled([
        window.syncProductsFromSupabase ? window.syncProductsFromSupabase() : Promise.resolve(),
        syncBanners(),
        syncDeliveryPartners(),
        window.syncStoreSettings ? window.syncStoreSettings() : Promise.resolve()
      ]);
      try { renderCategories(); } catch (e) { console.warn("renderCategories live error:", e); }
      try { renderTrendingProducts(state.activeTrendingCategory || "all"); } catch (e) { console.warn("renderTrendingProducts live error:", e); }
      try { renderNewArrivals(); } catch (e) { console.warn("renderNewArrivals live error:", e); }
      try { renderFlashDeals(); } catch (e) { console.warn("renderFlashDeals live error:", e); }
      try { renderBogoProducts(); } catch (e) { console.warn("renderBogoProducts live error:", e); }
      try { updateBadges(); } catch (e) { console.warn("updateBadges live error:", e); }
      try { applyStoreSettings(); } catch (e) { console.warn("applyStoreSettings live error:", e); }
    } catch (err) {
      console.warn("Live homepage catalog sync:", err);
    }

    initHomepageRealtime();
  }

  // Reactive listener for background Supabase updates
  window.addEventListener("velora:products-synced", () => {
    try { renderCategories(); } catch (e) { console.warn("renderCategories sync error:", e); }
    try { renderTrendingProducts(state.activeTrendingCategory || "all"); } catch (e) { console.warn("renderTrendingProducts sync error:", e); }
    try { renderNewArrivals(); } catch (e) { console.warn("renderNewArrivals sync error:", e); }
    try { renderFlashDeals(); } catch (e) { console.warn("renderFlashDeals sync error:", e); }
    try { renderBogoProducts(); } catch (e) { console.warn("renderBogoProducts sync error:", e); }
    try { updateBadges(); } catch (e) { console.warn("updateBadges sync error:", e); }
  });

  window.addEventListener("velora:settings-synced", () => {
    try { applyStoreSettings(); } catch (e) { console.warn("applyStoreSettings sync error:", e); }
    try { renderBogoProducts(); } catch (e) { console.warn("renderBogoProducts sync error:", e); }
  });

  // 1b. Render Promotional Hero Banner (Projected & Cached from Supabase banners table)
  async function syncBanners() {
    try {
      const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
      const bannerCols = "id,title,subtitle,image_url,link,display_order,is_active,badge_text,cta_text";
      const banners = await (window.VeloraCache
        ? window.VeloraCache.getOrFetch('banners', async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?select=${bannerCols}&is_active=eq.true&order=display_order.asc`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          }, { ttl: 300000 })
        : (async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?select=*&is_active=eq.true&order=display_order.asc`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          })());

      if (!banners || !Array.isArray(banners) || banners.length === 0) return;

      const activeBanner = banners[0];
      const tagEl = document.getElementById("hero-tag-text");
      const headlineEl = document.getElementById("hero-headline");
      const subtitleEl = document.getElementById("hero-subtitle");
      const ctaBtn = document.getElementById("hero-cta-primary");
      const ctaText = document.getElementById("hero-cta-text");

      if (tagEl && (activeBanner.badge_text || activeBanner.subtitle)) {
        tagEl.textContent = activeBanner.badge_text || "Featured Collection";
      }
      if (headlineEl && activeBanner.title) {
        headlineEl.innerHTML = activeBanner.title;
      }
      if (subtitleEl && activeBanner.subtitle) {
        subtitleEl.textContent = activeBanner.subtitle;
      }
      if (ctaBtn) {
        ctaBtn.setAttribute("href", activeBanner.link || activeBanner.button_link || "#shop");
      }
      if (ctaText) {
        ctaText.textContent = activeBanner.cta_text || activeBanner.button_text || "Explore Collection";
      }
      const heroImg = document.getElementById("hero-image");
      if (heroImg && activeBanner.image_url) {
        heroImg.src = activeBanner.image_url;
      }

      const heroMedia = document.querySelector(".hero-media-wrapper");
      if (heroMedia && activeBanner.image_url) {
        let bgEl = heroMedia.querySelector(".hero-dynamic-bg");
        if (!bgEl) {
          bgEl = document.createElement("div");
          bgEl.className = "hero-dynamic-bg";
          bgEl.style.cssText = "position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.15; pointer-events:none; border-radius:inherit; transition:all 0.5s ease;";
          heroMedia.insertBefore(bgEl, heroMedia.firstChild);
        }
        bgEl.style.backgroundImage = `url('${activeBanner.image_url}')`;
      }
    } catch (err) {
      console.warn("Banner sync notice:", err);
    }
  }

  // 1c. Render Delivery Partners (Projected & Cached from Supabase delivery_partners table)
  async function syncDeliveryPartners() {
    const grid = document.getElementById("delivery-partners-grid");
    if (!grid) return;

    try {
      const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
      const partnerCols = "id,name,logo_url,tagline,badge_text,display_order,is_active";
      const partners = await (window.VeloraCache
        ? window.VeloraCache.getOrFetch('delivery_partners', async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/delivery_partners?select=${partnerCols}&is_active=eq.true&order=display_order.asc`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          }, { ttl: 300000 })
        : (async () => {
            const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/delivery_partners?is_active=eq.true&order=display_order.asc`, {
              headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
            });
            return res.ok ? await res.json() : null;
          })());

      if (!partners || !Array.isArray(partners) || partners.length === 0) return;

      grid.innerHTML = partners.map(p => {
        const cleanLogo = (p.logo_url || "").replace(/^\.\.\//, "");
        return `
          <div class="delivery-partner-card">
            <div class="partner-logo-box">
              <img src="${cleanLogo}" alt="${p.name} Logo" class="partner-logo-img" loading="lazy" decoding="async" onerror="this.style.display='none';">
            </div>
            <h4 class="partner-name">${p.name}</h4>
            <span class="partner-desc">${p.tagline || 'Reliable Logistics'}</span>
            <span class="partner-badge">${p.badge_text || 'Active'}</span>
          </div>
        `;
      }).join("");
    } catch (err) {
      console.warn("Delivery partners sync notice:", err);
    }
  }

  // 1d. Apply Store Settings (Contact info, shipping thresholds)
  function applyStoreSettings() {
    const settings = window.VELORA_SETTINGS;
    if (!settings) return;

    if (settings.general) {
      const addrEl = document.getElementById("footer-studio-address");
      const emailEl = document.getElementById("footer-support-email");
      const phoneEl = document.getElementById("footer-support-phone");

      if (addrEl && settings.general.studio_address) addrEl.textContent = settings.general.studio_address;
      if (emailEl && settings.general.support_email) {
        emailEl.textContent = settings.general.support_email;
        emailEl.href = `mailto:${settings.general.support_email}`;
      }
      if (phoneEl && settings.general.support_phone) {
        phoneEl.textContent = settings.general.support_phone;
        phoneEl.href = `tel:${settings.general.support_phone.replace(/\s+/g, '')}`;
      }
    }

    renderCartDrawer();
  }

  // 1e. Homepage Realtime Subscriptions
  function initHomepageRealtime() {
    const client = window.supabaseClient || (window.getSupabase ? window.getSupabase() : null);
    if (!client || typeof client.channel !== "function" || window._velora_homepage_realtime) return;

    window._velora_homepage_realtime = true;

    try {
      const ch = client.channel("public:homepage_sync_channel");
      ch
        .on("postgres_changes", { event: "*", schema: "public", table: "banners" }, () => {
          syncBanners();
          initAdvertisementsCarousel();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "delivery_partners" }, () => syncDeliveryPartners())
        .subscribe();
    } catch (e) {
      console.warn("Homepage realtime setup notice:", e);
    }
  }

  // ==========================================================================
  // RENDER FUNCTIONS
  // ==========================================================================

  // 1. Render Categories Grid
  function renderCategories() {
    if (!elements.categoriesGrid || !window.CATEGORIES_DATA) return;

    elements.categoriesGrid.innerHTML = window.CATEGORIES_DATA.map(cat => `
      <div class="category-card" data-category-id="${cat.id}">
        <img class="category-bg-img" src="${cat.image}" alt="${cat.name}" loading="lazy">
        <div class="category-gradient-overlay"></div>
        <div class="category-card-content">
          <span class="category-card-badge">${cat.badge}</span>
          <h3 class="category-card-title">${cat.name}</h3>
          <p class="category-card-tagline">${cat.tagline}</p>
          <div class="category-card-footer">
            <span>${cat.itemCount}</span>
            <div class="category-arrow-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  // 2. Render Product Card HTML Template
  function createProductCardHTML(product, forceBogo = false) {
    if (!product) return "";
    try {
      const isWishlisted = state.wishlist.has(product.id);
    const bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
      ? window.VELORA_SETTINGS.bogo_config.product_ids
      : [];
    const isBogo = forceBogo || Boolean(product.isBogo) || Boolean(product.is_bogo) || bogoConfigIds.includes(product.id) || bogoConfigIds.includes(product.supabase_id) || (product.legacyId && bogoConfigIds.includes(product.legacyId));
    const prodId = String(product.id || product.supabase_id);
    const isInCart = state.cart.some(item => String(item.id || item.supabase_id) === prodId);
    const badgeClass = isBogo ? 'badge-deal' : `badge-${product.badgeType || 'popular'}`;

    let badgeHtml = "";
    if (isBogo) {
      badgeHtml = `<span class="product-badge" style="background:#059669; color:#fff; font-weight:700; box-shadow: 0 2px 8px rgba(5,150,105,0.3);">🎁 BOGO FREE</span>`;
    } else if (product.badge) {
      badgeHtml = `<span class="product-badge ${badgeClass}">${product.badge}</span>`;
    }

    let actionBtnHtml = "";
    if (isBogo) {
      actionBtnHtml = `
        <button type="button" class="btn-add-to-cart btn-claim-bogo" data-bogo-id="${product.id}">
          <span class="btn-cart-icon">🎁</span>
          <span class="btn-cart-text">Claim BOGO Offer</span>
        </button>
      `;
    } else {
      actionBtnHtml = `
        <button type="button" class="btn-add-to-cart ${isInCart ? 'added' : ''}" data-cart-id="${product.id}">
          <span class="btn-cart-icon">${isInCart ? icons.check : icons.cart}</span>
          <span class="btn-cart-text">${isInCart ? 'In Cart' : 'Add to Cart'}</span>
        </button>
      `;
    }

    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-card-media">
          ${badgeHtml}
          <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${product.id}" aria-label="Add to Wishlist">
            ${icons.heart}
          </button>
          <img class="product-card-img" src="${product.image}" alt="${product.name}" loading="lazy">
          <button class="quick-view-overlay-btn" data-quickview-id="${product.id}">
            ${icons.eye} Quick View
          </button>
        </div>

        <div class="product-card-body">
          <span class="product-category-label">${product.categoryLabel || product.category}</span>
          <h4 class="product-card-name" title="${product.name}">
            <a href="product.html?id=${product.id}">${product.name}</a>
          </h4>
          
          <div class="product-card-rating">
            <span class="stars-list">
              ${icons.star}
            </span>
            <span class="stars-score">${product.rating}</span>
            <span class="reviews-count">(${product.reviewsCount})</span>
          </div>

          <div class="product-card-price-row">
            <span class="price-current">${formatPrice(product.price)}</span>
            ${product.originalPrice ? `<span class="price-original">${formatPrice(product.originalPrice)}</span>` : ""}
            ${product.discount ? `<span class="price-discount-pill">-${product.discount}%</span>` : ""}
          </div>

          ${product.isDeal ? `
            <div class="stock-progress-wrap">
              <div class="stock-text-row">
                <span>Only ${product.stockCount} left in stock</span>
                <span>Hurry!</span>
              </div>
              <div class="stock-progress-bar">
                <div class="stock-progress-fill" style="width: ${Math.max(15, (product.stockCount / 15) * 100)}%;"></div>
              </div>
            </div>
          ` : ""}

          <div class="product-card-shipping-tag" style="font-size: 0.73rem; color: #059669; font-weight: 700; margin: 4px 0 8px; display: flex; align-items: center; gap: 4px; letter-spacing: 0.2px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            FREE DELIVERY
          </div>

          ${actionBtnHtml}
        </div>
      </div>
    `;
    } catch (cardErr) {
      console.warn("createProductCardHTML error for product:", product ? product.id : null, cardErr);
      return "";
    }
  }

  // 3. Render Trending Now Products (5 cards per row x 3 rows = up to 15)
  function renderTrendingProducts(category = "all") {
    if (!elements.trendingGrid || !window.PRODUCTS_DATA) return;

    let filtered = window.PRODUCTS_DATA.filter(p => p.isTrending);
    if (category !== "all") {
      filtered = window.PRODUCTS_DATA.filter(p => p.category === category || p.category_id === category);
    }

    elements.trendingGrid.innerHTML = filtered.slice(0, 15).map(product => createProductCardHTML(product)).join("");
  }

  // 4. Render New Arrivals (5 cards per row x 3 rows = up to 15)
  function renderNewArrivals() {
    if (!elements.newArrivalsGrid || !window.PRODUCTS_DATA) return;
    const newItems = window.PRODUCTS_DATA.filter(p => p.isNew);
    elements.newArrivalsGrid.innerHTML = newItems.slice(0, 15).map(product => createProductCardHTML(product)).join("");
  }

  // 5. Render Today's Flash Deals (5 cards per row x 3 rows = up to 15)
  function renderFlashDeals() {
    if (!elements.dealsGrid || !window.PRODUCTS_DATA) return;
    const deals = window.PRODUCTS_DATA.filter(p => p.isDeal);
    elements.dealsGrid.innerHTML = deals.slice(0, 15).map(product => createProductCardHTML(product)).join("");
  }

  // 6. Render Buy 1 Get 1 Free (BOGO) (5 cards per row x 3 rows = up to 15)
  function renderBogoProducts() {
    if (!elements.bogoGrid || !window.PRODUCTS_DATA) return;

    let bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
      ? window.VELORA_SETTINGS.bogo_config.product_ids
      : [];

    if (!bogoConfigIds || bogoConfigIds.length === 0) {
      try {
        const cached = localStorage.getItem("velora_bogo_config");
        if (cached) {
          const p = JSON.parse(cached);
          if (p && Array.isArray(p.product_ids)) bogoConfigIds = p.product_ids;
        }
      } catch (_) {}
    }

    if (!bogoConfigIds || bogoConfigIds.length === 0) {
      const dealIds = (window.PRODUCTS_DATA || []).filter(p => Boolean(p.is_deal)).map(p => p.id);
      if (dealIds.length > 0) bogoConfigIds = dealIds;
    }

    const bogoItems = window.PRODUCTS_DATA.filter(p => Boolean(p.isBogo) || Boolean(p.is_bogo) || bogoConfigIds.includes(p.id) || bogoConfigIds.includes(p.supabase_id) || (p.legacyId && bogoConfigIds.includes(p.legacyId)));

    const bogoSection = document.getElementById("bogo-section");
    if (bogoItems.length === 0) {
      if (bogoSection) bogoSection.style.display = "none";
      return;
    }
    if (bogoSection) bogoSection.style.display = "";

    elements.bogoGrid.innerHTML = bogoItems.slice(0, 15).map(product => createProductCardHTML(product, true)).join("");
  }

  // ==========================================================================
  // ROTATING ADVERTISEMENTS / OFFERS CAROUSEL
  // ==========================================================================
  let adsCarouselInterval = null;
  let adsCurrentIndex = 0;

  async function initAdvertisementsCarousel() {
    if (!elements.adsCarouselTrack) return;

    let ads = [];
    try {
      const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?is_active=eq.true&order=display_order.asc`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (res.ok) {
        const fetched = await res.json();
        if (fetched && fetched.length > 0) ads = fetched;
      }
    } catch (e) {
      console.warn("Ads fetch notice:", e);
    }

    // Default 5-6 curated luxury offers
    const defaultAds = [
      {
        title: "Exclusive BOGO Gala Event",
        subtitle: "Buy any luxury piece & choose a matched complimentary gift.",
        badge: "Limited Event",
        image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
        button_text: "Shop BOGO",
        button_link: "bogo.html"
      },
      {
        title: "Winter Luxury Edition",
        subtitle: "Handcrafted Italian leather & tailored timeless silhouettes.",
        badge: "New Drops",
        image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
        button_text: "Discover Now",
        button_link: "new-arrivals.html"
      },
      {
        title: "Precision Chronographs",
        subtitle: "Sapphire crystal & automatic Swiss precision horology.",
        badge: "Signature Series",
        image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
        button_text: "Explore Watches",
        button_link: "shop.html?category=watches"
      },
      {
        title: "Flash Privilege Deals",
        subtitle: "Up to 50% off curated high-demand footwear & accessories.",
        badge: "Today Only",
        image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80",
        button_text: "View Deals",
        button_link: "deals.html"
      },
      {
        title: "Connoisseur Favorites",
        subtitle: "Award-winning bestsellers rated 4.9★ across India.",
        badge: "Trending Now",
        image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
        button_text: "View Trending",
        button_link: "trending.html"
      },
      {
        title: "Complimentary Express Delivery",
        subtitle: "Free insured doorstep delivery across India on all orders.",
        badge: "Zero Shipping",
        image_url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80",
        button_text: "Shop VELORA",
        button_link: "shop.html"
      }
    ];

    if (ads.length < 5) {
      ads = [...ads, ...defaultAds.slice(ads.length)];
    }

    elements.adsCarouselTrack.innerHTML = ads.map(ad => `
      <div class="ad-slide">
        <img src="${ad.image_url}" alt="${ad.title}" class="ad-slide-bg" loading="lazy">
        <div class="ad-slide-overlay"></div>
        <div class="ad-slide-content">
          <span class="ad-slide-badge">${ad.badge || 'Featured Offer'}</span>
          <h3 class="ad-slide-title">${ad.title}</h3>
          <p class="ad-slide-desc">${ad.subtitle || ''}</p>
          <a href="${ad.button_link || 'shop.html'}" class="ad-slide-btn">
            <span>${ad.button_text || 'Discover Now'}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
      </div>
    `).join("");

    if (elements.adsCarouselDots) {
      elements.adsCarouselDots.innerHTML = ads.map((_, i) => `
        <button class="ads-carousel-dot ${i === 0 ? 'active' : ''}" data-ad-idx="${i}" aria-label="Slide ${i + 1}"></button>
      `).join("");
    }

    adsCurrentIndex = 0;
    updateCarouselPosition();

    function updateCarouselPosition() {
      if (!elements.adsCarouselTrack) return;
      elements.adsCarouselTrack.style.transform = `translateX(-${adsCurrentIndex * 100}%)`;
      if (elements.adsCarouselDots) {
        elements.adsCarouselDots.querySelectorAll(".ads-carousel-dot").forEach((dot, idx) => {
          dot.classList.toggle("active", idx === adsCurrentIndex);
        });
      }
    }

    function nextSlide() {
      adsCurrentIndex = (adsCurrentIndex + 1) % ads.length;
      updateCarouselPosition();
    }

    function prevSlide() {
      adsCurrentIndex = (adsCurrentIndex - 1 + ads.length) % ads.length;
      updateCarouselPosition();
    }

    function startAutoplay() {
      stopAutoplay();
      adsCarouselInterval = setInterval(nextSlide, 5000);
    }

    function stopAutoplay() {
      if (adsCarouselInterval) clearInterval(adsCarouselInterval);
    }

    if (elements.adsCarouselNext) {
      elements.adsCarouselNext.onclick = () => { nextSlide(); startAutoplay(); };
    }
    if (elements.adsCarouselPrev) {
      elements.adsCarouselPrev.onclick = () => { prevSlide(); startAutoplay(); };
    }

    if (elements.adsCarouselDots) {
      elements.adsCarouselDots.querySelectorAll(".ads-carousel-dot").forEach(dot => {
        dot.onclick = () => {
          adsCurrentIndex = parseInt(dot.dataset.adIdx, 10);
          updateCarouselPosition();
          startAutoplay();
        };
      });
    }

    const wrapper = elements.adsCarouselTrack.closest(".ads-carousel-wrapper");
    if (wrapper) {
      wrapper.onmouseenter = stopAutoplay;
      wrapper.onmouseleave = () => {
        wrapper.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
        startAutoplay();
      };

      // Subtle 3D tilt movement on mousemove
      wrapper.addEventListener("mousemove", (e) => {
        if (window.matchMedia("(hover: hover)").matches) {
          const rect = wrapper.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -3.5;
          const rotateY = ((x - centerX) / centerX) * 3.5;
          wrapper.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
        }
      });

      // Touch swipe support for mobile/tablet devices
      let touchStartX = 0;
      let touchEndX = 0;
      wrapper.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoplay();
      }, { passive: true });

      wrapper.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 45) {
          nextSlide();
        } else if (touchEndX - touchStartX > 45) {
          prevSlide();
        }
        startAutoplay();
      }, { passive: true });
    }

    startAutoplay();
  }

  // ==========================================================================
  // SHOP BY BRANDS HORIZONTAL CAROUSEL CONTROLLER
  // ==========================================================================
  function initBrandsCarousel() {
    const viewport = document.getElementById("brands-marquee-viewport");
    const track = document.getElementById("brands-marquee-track");
    const prevBtn = document.getElementById("brands-prev-btn");
    const nextBtn = document.getElementById("brands-next-btn");

    if (!viewport || !track) return;

    let isPaused = false;
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasMoved = false;
    let animId = null;
    const speed = 0.8; // pixels per frame for continuous smooth luxury glide

    function getHalfWidth() {
      return (track.scrollWidth || 0) / 2;
    }

    function autoScroll() {
      if (!isPaused && !isDown) {
        viewport.scrollLeft += speed;
        const half = getHalfWidth();
        if (half > 100 && viewport.scrollLeft >= half) {
          viewport.scrollLeft -= half;
        }
      }
      animId = requestAnimationFrame(autoScroll);
    }

    // Start auto-scroll if user has not set reduced motion preference
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      animId = requestAnimationFrame(autoScroll);
    }

    // Hover pause and resume
    viewport.addEventListener("mouseenter", () => { isPaused = true; });
    viewport.addEventListener("mouseleave", () => {
      isPaused = false;
      isDown = false;
    });

    // Arrow navigation: smooth manual step scroll
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        const half = getHalfWidth();
        if (viewport.scrollLeft <= 10 && half > 0) {
          viewport.scrollLeft += half;
        }
        viewport.scrollBy({ left: -280, behavior: "smooth" });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const half = getHalfWidth();
        if (half > 0 && viewport.scrollLeft >= half) {
          viewport.scrollLeft -= half;
        }
        viewport.scrollBy({ left: 280, behavior: "smooth" });
      });
    }

    // Mouse Drag-to-Scroll on Desktop
    viewport.addEventListener("mousedown", (e) => {
      isDown = true;
      hasMoved = false;
      startX = e.pageX - viewport.offsetLeft;
      startScrollLeft = viewport.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      const half = getHalfWidth();
      if (half > 0 && viewport.scrollLeft >= half) {
        viewport.scrollLeft -= half;
      } else if (viewport.scrollLeft < 0 && half > 0) {
        viewport.scrollLeft += half;
      }
    });

    viewport.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 4) {
        hasMoved = true;
        e.preventDefault();
        viewport.scrollLeft = startScrollLeft - walk;
      }
    });

    // Prevent accidental navigation if user was dragging
    viewport.addEventListener("click", (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);

    // Touch swipe pause/resume for mobile devices
    viewport.addEventListener("touchstart", () => {
      isPaused = true;
    }, { passive: true });

    viewport.addEventListener("touchend", () => {
      isPaused = false;
      const half = getHalfWidth();
      if (half > 0 && viewport.scrollLeft >= half) {
        viewport.scrollLeft -= half;
      }
    }, { passive: true });
  }

  // ==========================================================================
  // BUY 1 GET 1 FREE (BOGO) MODAL CONTROLLER
  // ==========================================================================
  let selectedBogoPaidProduct = null;
  let selectedBogoFreeProduct = null;

  function openBogoModal(productId) {
    const paidProduct = (window.PRODUCTS_DATA && window.PRODUCTS_DATA.find(p => p.id === productId)) || 
                        (window.getProductById ? window.getProductById(productId) : null);
    if (!paidProduct) return;

    selectedBogoPaidProduct = paidProduct;
    selectedBogoFreeProduct = null;

    if (elements.bogoPaidBanner) {
      elements.bogoPaidBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap: 14px;">
          <img src="${paidProduct.image}" alt="${paidProduct.name}" style="width: 58px; height: 58px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-color);">
          <div>
            <span style="font-size: 0.72rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">Purchasing Qualifying Item:</span>
            <h4 style="font-size: 0.98rem; font-weight: 700; color: var(--text-main); margin: 2px 0;">${paidProduct.name}</h4>
            <span style="font-size: 0.92rem; font-weight: 700; color: var(--accent);">${formatPrice(paidProduct.price)}</span>
          </div>
        </div>
      `;
    }

    // Filter eligible free items: selling price within ₹20–₹40 of purchased product price
    const paidPrice = Number(paidProduct.price) || 0;
    let eligible = (window.PRODUCTS_DATA || []).filter(p => {
      if (p.id === paidProduct.id || (paidProduct.supabase_id && p.id === paidProduct.supabase_id) || (p.supabase_id && p.supabase_id === paidProduct.id)) return false;
      const diff = Math.abs((Number(p.price) || 0) - paidPrice);
      return diff >= 20 && diff <= 40;
    });

    // Fallback: selling price within ₹40 if strict range yields fewer than 2 items
    if (eligible.length < 2) {
      eligible = (window.PRODUCTS_DATA || []).filter(p => {
        if (p.id === paidProduct.id || (paidProduct.supabase_id && p.id === paidProduct.supabase_id) || (p.supabase_id && p.supabase_id === paidProduct.id)) return false;
        const diff = Math.abs((Number(p.price) || 0) - paidPrice);
        return diff <= 40;
      });
    }

    // Fallback: closest priced items sorted by closest price match
    if (eligible.length < 2) {
      eligible = [...(window.PRODUCTS_DATA || [])]
        .filter(p => p.id !== paidProduct.id && (!paidProduct.supabase_id || p.id !== paidProduct.supabase_id) && (!p.supabase_id || p.supabase_id !== paidProduct.id))
        .sort((a, b) => Math.abs((Number(a.price) || 0) - paidPrice) - Math.abs((Number(b.price) || 0) - paidPrice))
        .slice(0, 8);
    }

    if (elements.bogoEligibleGrid) {
      elements.bogoEligibleGrid.innerHTML = eligible.map(freeItem => {
        const diff = Math.abs((freeItem.price || 0) - (paidProduct.price || 0));
        return `
          <div class="bogo-card" data-free-id="${freeItem.id}">
            <div class="bogo-card-thumb">
              <span class="bogo-free-pill">100% FREE</span>
              <img src="${freeItem.image}" alt="${freeItem.name}" loading="lazy">
            </div>
            <div class="bogo-card-info">
              <h5 class="bogo-card-title" title="${freeItem.name}">${freeItem.name}</h5>
              <div class="bogo-card-prices">
                <span class="bogo-price-free">₹0 FREE</span>
                <span class="bogo-price-orig">${formatPrice(freeItem.price)}</span>
              </div>
              <span style="display:block; font-size:0.72rem; color:var(--text-muted); margin-bottom: 8px;">Price Match: Δ ₹${diff}</span>
              <button type="button" class="bogo-select-btn" data-free-select-id="${freeItem.id}">
                Select This Gift
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Bind card selection
      elements.bogoEligibleGrid.querySelectorAll(".bogo-card").forEach(card => {
        card.addEventListener("click", () => {
          const fid = card.dataset.freeId;
          const chosen = eligible.find(p => p.id === fid);
          if (!chosen) return;

          selectedBogoFreeProduct = chosen;
          elements.bogoEligibleGrid.querySelectorAll(".bogo-card").forEach(c => {
            c.classList.remove("selected");
            const btn = c.querySelector(".bogo-select-btn");
            if (btn) btn.textContent = "Select This Gift";
          });

          card.classList.add("selected");
          const selBtn = card.querySelector(".bogo-select-btn");
          if (selBtn) selBtn.textContent = "✓ Selected Free Gift";

          if (elements.bogoSelectedFreeName) {
            elements.bogoSelectedFreeName.textContent = `${chosen.name} (${formatPrice(chosen.price)} value — Free)`;
            elements.bogoSelectedFreeName.style.color = "#059669";
          }

          if (elements.bogoConfirmAddBtn) {
            elements.bogoConfirmAddBtn.disabled = false;
          }
        });
      });
    }

    if (elements.bogoSelectedFreeName) {
      elements.bogoSelectedFreeName.textContent = "None chosen yet";
      elements.bogoSelectedFreeName.style.color = "var(--text-muted)";
    }
    if (elements.bogoConfirmAddBtn) {
      elements.bogoConfirmAddBtn.disabled = true;
    }

    if (elements.bogoModalOverlay) {
      elements.bogoModalOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  function closeBogoModal() {
    if (elements.bogoModalOverlay) {
      elements.bogoModalOverlay.classList.remove("active");
      document.body.style.overflow = "";
    }
    selectedBogoPaidProduct = null;
    selectedBogoFreeProduct = null;
  }

  // ==========================================================================
  // CART OPERATIONS & DRAWER
  // ==========================================================================

  function addToCart(productId, selectedSize = null, selectedColor = null) {
    const product = (window.PRODUCTS_DATA && window.PRODUCTS_DATA.find(p => p.id === productId)) || 
                    (window.getProductById ? window.getProductById(productId) : null);
    if (!product) return;

    const existingIndex = state.cart.findIndex(item => 
      item.id === productId && 
      (!selectedSize || item.size === selectedSize)
    );

    const size = selectedSize || (product.sizes ? product.sizes[0] : "Standard");
    const color = selectedColor || (product.colors ? product.colors[0] : "Default");

    const isAdv = Boolean(product.advance_payment_enabled);
    const advType = product.advance_payment_type || 'fixed';
    const advVal = Number(product.advance_payment_value) || 0;

    let unitAdv = 0;
    if (isAdv) {
      if (advType === "percentage") {
        unitAdv = Math.round(product.price * (advVal / 100));
      } else {
        unitAdv = Math.min(product.price, advVal);
      }
    }

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += 1;
      state.cart[existingIndex].advance_payment_enabled = isAdv;
      state.cart[existingIndex].advance_payment_type = advType;
      state.cart[existingIndex].advance_payment_value = advVal;
      state.cart[existingIndex].advance_per_unit = unitAdv;
      state.cart[existingIndex].cod_per_unit = Math.max(0, product.price - unitAdv);
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: size,
        color: color,
        quantity: 1,
        advance_payment_enabled: isAdv,
        advance_payment_type: advType,
        advance_payment_value: advVal,
        advance_per_unit: unitAdv,
        cod_per_unit: Math.max(0, product.price - unitAdv)
      });
    }

    saveCart();
    updateBadges();
    renderCartDrawer();
    openCartDrawer();
    showToast(`Added "${product.name}" to cart!`, "success");
    window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart: state.cart } }));
    syncProductCartButtons();
  }

  let lastToggleTime = 0;

  // Toggle Cart: If in cart -> remove completely; If not in cart -> add to cart
  function toggleCart(productId) {
    if (!productId) return;
    const now = Date.now();
    if (now - lastToggleTime < 150) return;
    lastToggleTime = now;

    state.cart = JSON.parse(localStorage.getItem("velora_cart")) || [];
    const pidStr = String(productId);
    const inCartIndex = state.cart.findIndex(item => String(item.id || item.supabase_id) === pidStr);

    if (inCartIndex > -1) {
      const removedItem = state.cart[inCartIndex];
      // Remove all entries for this product ID
      state.cart = state.cart.filter(item => String(item.id || item.supabase_id) !== pidStr);

      if (removedItem.bogo_pair_id) {
        state.cart = state.cart.filter(i => i.bogo_pair_id !== removedItem.bogo_pair_id);
      }

      saveCart();
      updateBadges();
      renderCartDrawer();
      showToast(`Removed "${removedItem.name}" from cart`, "info");
      window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart: state.cart } }));
      syncProductCartButtons();
    } else {
      addToCart(productId);
    }
  }

  // Synchronize all product buttons on the page with state.cart
  function syncProductCartButtons() {
    const inCartIds = new Set((state.cart || []).map(item => String(item.id || item.supabase_id)));
    document.querySelectorAll(".btn-add-to-cart[data-cart-id]").forEach(btn => {
      if (btn.classList.contains("btn-claim-bogo") || btn.dataset.bogoId) return;
      const pid = String(btn.dataset.cartId);
      if (inCartIds.has(pid)) {
        btn.classList.add("added");
        btn.innerHTML = `<span class="btn-cart-icon">${icons.check}</span><span class="btn-cart-text">In Cart</span>`;
      } else {
        btn.classList.remove("added");
        btn.innerHTML = `<span class="btn-cart-icon">${icons.cart}</span><span class="btn-cart-text">Add to Cart</span>`;
      }
    });
  }

  function updateCartQuantity(index, delta) {
    if (window.VeloraCart && typeof window.VeloraCart.updateQty === "function") {
      window.VeloraCart.updateQty(index, delta);
      return;
    }
    if (!state.cart[index]) return;
    const currentQty = Number(state.cart[index].quantity) || 1;
    if (delta > 0) {
      state.cart[index].quantity = currentQty + 1;
      saveCart();
      updateBadges();
      renderCartDrawer();
      window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart: state.cart } }));
      syncProductCartButtons();
    } else if (delta < 0) {
      if (currentQty > 1) {
        state.cart[index].quantity = currentQty - 1;
        saveCart();
        updateBadges();
        renderCartDrawer();
        window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart: state.cart } }));
        syncProductCartButtons();
      } else {
        removeFromCart(index);
      }
    }
  }

  function removeFromCart(index) {
    if (window.VeloraCart && typeof window.VeloraCart.remove === "function") {
      window.VeloraCart.remove(index);
      return;
    }
    if (!state.cart[index]) return;
    const removedItem = state.cart.splice(index, 1)[0];
    
    // If removed item was paired BOGO, remove other item in pair
    if (removedItem.bogo_pair_id) {
      const pairedIdx = state.cart.findIndex(i => i.bogo_pair_id === removedItem.bogo_pair_id);
      if (pairedIdx > -1) {
        state.cart.splice(pairedIdx, 1);
      }
    }

    saveCart();
    updateBadges();
    renderCartDrawer();
    showToast(`Removed "${removedItem.name}" from cart`, "info");
    window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart: state.cart } }));
    syncProductCartButtons();
  }

  function saveCart() {
    localStorage.setItem("velora_cart", JSON.stringify(state.cart));
  }

  function renderCartDrawer() {
    if (!elements.cartItemsContainer) return;

    if (state.cart.length === 0) {
      elements.cartItemsContainer.style.display = "none";
      elements.cartEmptyState.style.display = "flex";
      elements.cartSubtotalElem.textContent = formatPrice(0);
      elements.cartTotalElem.textContent = formatPrice(0);
      if (elements.freeShippingFill) elements.freeShippingFill.style.width = "100%";
      if (elements.freeShippingMsg) elements.freeShippingMsg.innerHTML = `✨ <strong>100% FREE Delivery Across India</strong> on all orders!`;
      const advFooter = elements.cartDrawerOverlay ? elements.cartDrawerOverlay.querySelector(".cart-advance-drawer-split") : null;
      if (advFooter) advFooter.style.display = "none";
      const advBox = document.getElementById("cart-advance-breakdown");
      if (advBox) advBox.style.display = "none";
      return;
    }

    elements.cartItemsContainer.style.display = "flex";
    elements.cartEmptyState.style.display = "none";

    // Calculate subtotal
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    const hasOnlineItems = state.cart.some(item => item.selected_payment_method === "online");
    const hasOnlineGifts = state.cart.some(item => item.selected_payment_method === "online" && Array.isArray(item.gift_bundle) && item.gift_bundle.length > 0);
    if (elements.freeShippingFill) elements.freeShippingFill.style.width = "100%";
    if (elements.freeShippingMsg) {
      elements.freeShippingMsg.innerHTML = (hasOnlineItems && hasOnlineGifts)
        ? `🎉 <strong>100% FREE Delivery</strong> • 🎁 <strong>Complimentary Gifts Unlocked!</strong>`
        : `🎉 <strong>100% FREE Delivery Across India</strong> on this order!`;
    }

    elements.cartSubtotalElem.textContent = formatPrice(subtotal);
    elements.cartTotalElem.textContent = formatPrice(subtotal);

    // Calculate advance & COD totals
    let totalAdvance = 0;
    state.cart.forEach(item => {
      if (item.selected_payment_method !== "online" && item.advance_payment_enabled) {
        let unitAdv = 0;
        if (item.advance_payment_type === "percentage") {
          unitAdv = Math.round((item.price || 0) * ((item.advance_payment_value || 0) / 100));
        } else {
          unitAdv = Math.min(item.price || 0, Number(item.advance_payment_value) || 0);
        }
        totalAdvance += (unitAdv * (item.quantity || 1));
      }
    });

    const totalCod = Math.max(0, subtotal - totalAdvance);
    const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
    const advancePayableElem = document.getElementById("cart-advance-payable");
    const codPayableElem = document.getElementById("cart-cod-payable") || document.getElementById("cart-cod-balance");

    if (advanceBreakdownBox) {
      if (totalAdvance > 0) {
        advanceBreakdownBox.style.display = "block";
        if (advancePayableElem) advancePayableElem.textContent = formatPrice(totalAdvance);
        if (codPayableElem) codPayableElem.textContent = formatPrice(totalCod);
      } else {
        advanceBreakdownBox.style.display = "none";
      }
    } else {
      let advFooter = elements.cartDrawerOverlay ? elements.cartDrawerOverlay.querySelector(".cart-advance-drawer-split") : null;
      if (totalAdvance > 0) {
        if (!advFooter && elements.cartTotalElem) {
          advFooter = document.createElement("div");
          advFooter.className = "cart-advance-drawer-split";
          advFooter.style.cssText = "padding: 8px 0; border-top: 1px dashed var(--border-color); margin-top: 6px; font-size: 0.85rem;";
          const totalRow = elements.cartTotalElem.closest(".cart-summary-total");
          if (totalRow) totalRow.insertAdjacentElement("afterend", advFooter);
        }
        if (advFooter) {
          advFooter.style.display = "block";
          advFooter.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span style="color: #6366f1; font-weight: 600;">Advance Payable Now:</span>
              <span style="font-weight: 700; color: #6366f1;">${formatPrice(totalAdvance)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color: var(--text-muted);">Remaining by COD:</span>
              <span style="font-weight: 600; color: var(--text-main);">${formatPrice(totalCod)}</span>
            </div>
          `;
        }
      } else if (advFooter) {
        advFooter.style.display = "none";
      }
    }

    // Render items list
    elements.cartItemsContainer.innerHTML = state.cart.map((item, index) => {
      const isFreeBogo = Boolean(item.is_free_bogo);
      const isItemOnline = item.selected_payment_method === "online";
      const itemGifts = Array.isArray(item.gift_bundle) ? item.gift_bundle : [];
      const payBadge = isItemOnline
        ? (itemGifts.length > 0 
            ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">⚡ Online (${itemGifts.length} Gifts)</span>`
            : `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">⚡ Online Paid</span>`)
        : (item.advance_payment_enabled 
            ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#6366f1; background:rgba(99,102,241,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 COD Adv. Req.</span>`
            : `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#d97706; background:rgba(217,119,6,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 100% COD</span>`);
      const bogoBadge = isFreeBogo
        ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 5px; border-radius:4px; margin-left:6px;">🎁 FREE BOGO</span>`
        : '';

      const priceDisplay = isFreeBogo
        ? `<span class="cart-item-price" style="color:#059669; font-weight:800;">FREE (₹0) <span style="font-size:0.75rem; text-decoration:line-through; color:var(--text-muted); margin-left:4px;">${formatPrice(item.originalPrice || 0)}</span></span>`
        : `<span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>`;

      const qtyControls = isFreeBogo
        ? `<span style="font-size:0.76rem; font-weight:600; color:#059669; padding:2px 8px; background:rgba(16,185,129,0.08); border-radius:4px;">Qty: 1 (Free Gift)</span>`
        : `
          <div class="cart-qty-control">
            <button class="cart-qty-btn" data-cart-delta="-1" data-cart-idx="${index}">-</button>
            <span class="cart-qty-val">${item.quantity}</span>
            <button class="cart-qty-btn" data-cart-delta="1" data-cart-idx="${index}">+</button>
          </div>
        `;

      return `
      <div class="cart-item-card">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-meta">${item.size ? item.size + ' • ' : ''}${item.color || 'Default'} ${payBadge} ${bogoBadge}</span>
          <div class="cart-item-bottom">
            ${qtyControls}
            ${priceDisplay}
            <button class="cart-item-remove" data-cart-remove="${index}" title="Remove item">
              ${icons.trash}
            </button>
          </div>
        </div>
      </div>
    `;
    }).join("");
  }

  function openCartDrawer() {
    if (window.VeloraCart && typeof window.VeloraCart.open === "function") {
      window.VeloraCart.open();
      return;
    }
    renderCartDrawer();
    if (elements.cartDrawerOverlay) {
      elements.cartDrawerOverlay.classList.add("active");
      elements.cartDrawerOverlay.classList.add("open");
    }
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    if (window.VeloraCart && typeof window.VeloraCart.close === "function") {
      window.VeloraCart.close();
      return;
    }
    if (elements.cartDrawerOverlay) {
      elements.cartDrawerOverlay.classList.remove("active");
      elements.cartDrawerOverlay.classList.remove("open");
    }
    document.body.style.overflow = "";
  }

  // ==========================================================================
  // WISHLIST MANAGEMENT
  // ==========================================================================

  function toggleWishlist(productId) {
    const product = window.PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    if (state.wishlist.has(productId)) {
      state.wishlist.delete(productId);
      showToast(`Removed "${product.name}" from wishlist`, "info");
    } else {
      state.wishlist.add(productId);
      showToast(`Added "${product.name}" to wishlist!`, "success");
    }

    localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlist)));
    updateBadges();

    // Toggle active classes on wishlist buttons
    document.querySelectorAll(`.wishlist-btn[data-wishlist-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle("active", state.wishlist.has(productId));
    });
  }

  // ==========================================================================
  // BADGES & COUNTERS
  // ==========================================================================

  function updateBadges() {
    const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const wishlistCount = state.wishlist.size;

    elements.cartCountBadges.forEach(badge => {
      badge.textContent = cartCount;
      badge.classList.remove("pop");
      void badge.offsetWidth; // trigger reflow
      badge.classList.add("pop");
    });

    elements.wishlistCountBadges.forEach(badge => {
      badge.textContent = wishlistCount;
      badge.classList.remove("pop");
      void badge.offsetWidth;
      badge.classList.add("pop");
    });
  }

  // ==========================================================================
  // QUICK VIEW MODAL
  // ==========================================================================

  let currentModalProduct = null;
  let selectedModalSize = null;

  function openQuickView(productId) {
    const product = window.PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    currentModalProduct = product;
    selectedModalSize = product.sizes ? product.sizes[0] : "Standard";

    elements.modalImg.src = product.image;
    elements.modalImg.alt = product.name;
    elements.modalCategory.textContent = product.categoryLabel || product.category;
    elements.modalTitle.textContent = product.name;
    elements.modalRatingScore.textContent = product.rating;
    elements.modalReviewsCount.textContent = `(${product.reviewsCount} customer reviews)`;
    elements.modalPrice.textContent = formatPrice(product.price);
    
    if (product.originalPrice) {
      elements.modalOriginalPrice.textContent = formatPrice(product.originalPrice);
      elements.modalOriginalPrice.style.display = "inline";
    } else {
      elements.modalOriginalPrice.style.display = "none";
    }

    elements.modalDesc.textContent = product.description;

    // Sizes
    if (product.sizes && product.sizes.length > 0) {
      elements.modalSizesContainer.innerHTML = product.sizes.map((size, i) => `
        <button class="size-pill ${i === 0 ? 'active' : ''}" data-size-val="${size}">${size}</button>
      `).join("");
      elements.modalSizesContainer.style.display = "flex";
    } else {
      elements.modalSizesContainer.style.display = "none";
    }

    elements.modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeQuickView() {
    elements.modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
    currentModalProduct = null;
  }

  // ==========================================================================
  // LIVE SEARCH & PREVIEW
  // ==========================================================================

  function handleSearchInput(query) {
    const q = query.trim().toLowerCase();

    if (!q) {
      elements.searchResultsDropdown.classList.remove("active");
      elements.searchClearBtn.classList.remove("visible");
      return;
    }

    elements.searchClearBtn.classList.add("visible");

    const matches = window.PRODUCTS_DATA.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.categoryLabel && p.categoryLabel.toLowerCase().includes(q))
    ).slice(0, 5); // top 5 results

    if (matches.length === 0) {
      elements.searchResultsDropdown.innerHTML = `
        <div class="search-empty-state">
          No products found for "<strong>${query}</strong>"
        </div>
      `;
    } else {
      elements.searchResultsDropdown.innerHTML = matches.map(p => `
        <div class="search-result-item" data-search-result-id="${p.id}">
          <img class="search-result-thumb" src="${p.image}" alt="${p.name}">
          <div class="search-result-info">
            <div class="search-result-title">${p.name}</div>
            <div class="search-result-meta">${p.categoryLabel || p.category} • ★ ${p.rating}</div>
          </div>
          <div class="search-result-price">${formatPrice(p.price)}</div>
        </div>
      `).join("");
    }

    elements.searchResultsDropdown.classList.add("active");
  }

  // ==========================================================================
  // FLASH DEAL COUNTDOWN TIMER
  // ==========================================================================

  function initFlashDealTimer() {
    function tick() {
      if (state.dealTimeLeft <= 0) {
        state.dealTimeLeft = 24 * 3600; // loop
      }

      const h = Math.floor(state.dealTimeLeft / 3600);
      const m = Math.floor((state.dealTimeLeft % 3600) / 60);
      const s = state.dealTimeLeft % 60;

      if (elements.timerHours) elements.timerHours.textContent = String(h).padStart(2, "0");
      if (elements.timerMinutes) elements.timerMinutes.textContent = String(m).padStart(2, "0");
      if (elements.timerSeconds) elements.timerSeconds.textContent = String(s).padStart(2, "0");

      state.dealTimeLeft--;
    }

    tick();
    setInterval(tick, 1000);
  }

  // ==========================================================================
  // TOAST NOTIFICATIONS
  // ==========================================================================

  function showToast(message, type = "success") {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? icons.check : 'ℹ'}</span>
      <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // trigger animation
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==========================================================================
  // EVENT LISTENERS BINDING
  // ==========================================================================

  function bindEventListeners() {
    // 1. Delegated clicks for Products (Add to cart, Wishlist, Quick View)
    document.addEventListener("click", e => {
      // Add to Cart / In Cart Toggle
      const addCartBtn = e.target.closest(".btn-add-to-cart");
      if (addCartBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (addCartBtn.classList.contains("btn-claim-bogo") || addCartBtn.dataset.bogoId) {
          const bogoId = addCartBtn.dataset.bogoId || addCartBtn.dataset.cartId;
          openBogoModal(bogoId);
          return;
        }
        const id = addCartBtn.dataset.cartId;
        toggleCart(id);
        return;
      }

      // Wishlist toggle
      const wishlistBtn = e.target.closest(".wishlist-btn");
      if (wishlistBtn) {
        const id = wishlistBtn.dataset.wishlistId;
        toggleWishlist(id);
        return;
      }

      // Quick View trigger
      const quickViewBtn = e.target.closest(".quick-view-overlay-btn");
      if (quickViewBtn) {
        const id = quickViewBtn.dataset.quickviewId;
        openQuickView(id);
        return;
      }

      // Category Card click -> Navigate to Shop page with category pre-selected
      const categoryCard = e.target.closest(".category-card");
      if (categoryCard) {
        const catId = categoryCard.dataset.categoryId;
        window.location.href = `shop.html?category=${catId}`;
        return;
      }

      // Cart Drawer quantity controls
      const qtyBtn = e.target.closest(".cart-qty-btn");
      if (qtyBtn) {
        if (window.VeloraCart) return; // Managed exclusively by cart-drawer.js
        const idx = parseInt(qtyBtn.dataset.cartIdx, 10);
        const delta = parseInt(qtyBtn.dataset.cartDelta, 10);
        updateCartQuantity(idx, delta);
        return;
      }

      // Cart Drawer remove button
      const removeBtn = e.target.closest(".cart-item-remove");
      if (removeBtn) {
        if (window.VeloraCart) return; // Managed exclusively by cart-drawer.js
        const idx = parseInt(removeBtn.dataset.cartRemove, 10);
        removeFromCart(idx);
        return;
      }

      // Search Result Click -> Navigate to product.html?id=...
      const searchItem = e.target.closest(".search-result-item");
      if (searchItem) {
        const id = searchItem.dataset.searchResultId;
        elements.searchResultsDropdown.classList.remove("active");
        elements.navSearchInput.value = "";
        elements.searchClearBtn.classList.remove("visible");
        window.location.href = `product.html?id=${id}`;
        return;
      }

      // Full Product Card Click -> Navigate to product.html?id=...
      const productCard = e.target.closest(".product-card");
      if (productCard && !e.target.closest("button") && !e.target.closest("a")) {
        const id = productCard.dataset.productId;
        if (id) {
          window.location.href = `product.html?id=${id}`;
          return;
        }
      }

      // Size Pill in Modal
      const sizePill = e.target.closest(".size-pill");
      if (sizePill) {
        document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
        sizePill.classList.add("active");
        selectedModalSize = sizePill.dataset.sizeVal;
        return;
      }

      // Close dropdown if clicking outside
      if (!e.target.closest(".nav-search-container")) {
        if (elements.searchResultsDropdown) {
          elements.searchResultsDropdown.classList.remove("active");
        }
      }
    });

    // 2. Filter Tabs
    elements.filterTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        elements.filterTabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const category = btn.dataset.categoryFilter;
        renderTrendingProducts(category);
      });
    });

    function activateCategoryFilter(catId) {
      let matchedTab = null;
      elements.filterTabs.forEach(btn => {
        if (btn.dataset.categoryFilter === catId) {
          matchedTab = btn;
        }
      });

      if (matchedTab) {
        elements.filterTabs.forEach(b => b.classList.remove("active"));
        matchedTab.classList.add("active");
        renderTrendingProducts(catId);
      } else {
        renderTrendingProducts("all");
      }
    }

    // 3. Search Inputs
    if (elements.navSearchInput) {
      elements.navSearchInput.addEventListener("input", e => {
        handleSearchInput(e.target.value);
      });
    }

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener("click", () => {
        elements.navSearchInput.value = "";
        elements.searchClearBtn.classList.remove("visible");
        elements.searchResultsDropdown.classList.remove("active");
      });
    }

    if (elements.mobileSearchInput) {
      elements.mobileSearchInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
          const q = e.target.value;
          closeMobileDrawer();
          const trendingSection = document.getElementById("trending-section");
          if (trendingSection) trendingSection.scrollIntoView({ behavior: "smooth" });
          showToast(`Filtered for "${q}"`, "info");
        }
      });
    }

    // 4. Cart Drawer Triggers
    elements.cartDrawerOpenBtns.forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        openCartDrawer();
      });
    });

    if (elements.cartDrawerCloseBtn) {
      elements.cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
    }

    if (elements.cartDrawerOverlay) {
      elements.cartDrawerOverlay.addEventListener("click", e => {
        if (e.target === elements.cartDrawerOverlay) closeCartDrawer();
      });
    }

    // 5. Modal Triggers
    if (elements.modalCloseBtn) elements.modalCloseBtn.addEventListener("click", closeQuickView);
    if (elements.modalOverlay) {
      elements.modalOverlay.addEventListener("click", e => {
        if (e.target === elements.modalOverlay) closeQuickView();
      });
    }

    if (elements.modalAddToCartBtn) {
      elements.modalAddToCartBtn.addEventListener("click", () => {
        if (currentModalProduct) {
          addToCart(currentModalProduct.id, selectedModalSize);
          closeQuickView();
        }
      });
    }

    // 5b. BOGO Modal Triggers
    if (elements.bogoModalCloseBtn) {
      elements.bogoModalCloseBtn.addEventListener("click", closeBogoModal);
    }
    if (elements.bogoModalOverlay) {
      elements.bogoModalOverlay.addEventListener("click", e => {
        if (e.target === elements.bogoModalOverlay) closeBogoModal();
      });
    }

    if (elements.bogoConfirmAddBtn) {
      elements.bogoConfirmAddBtn.addEventListener("click", () => {
        if (!selectedBogoPaidProduct || !selectedBogoFreeProduct) return;

        const paid = selectedBogoPaidProduct;
        const free = selectedBogoFreeProduct;
        const bogoPairId = "bogo-" + Date.now();

        // 1. Add Paid Product
        const paidSize = paid.sizes ? paid.sizes[0] : "Standard";
        const paidColor = paid.colors ? paid.colors[0] : "Default";
        const isAdv = Boolean(paid.advance_payment_enabled);
        const advType = paid.advance_payment_type || 'fixed';
        const advVal = Number(paid.advance_payment_value) || 0;
        let unitAdv = 0;
        if (isAdv) {
          unitAdv = advType === "percentage" ? Math.round(paid.price * (advVal / 100)) : Math.min(paid.price, advVal);
        }

        state.cart.push({
          id: paid.id,
          name: paid.name,
          price: paid.price,
          image: paid.image,
          size: paidSize,
          color: paidColor,
          quantity: 1,
          advance_payment_enabled: isAdv,
          advance_payment_type: advType,
          advance_payment_value: advVal,
          advance_per_unit: unitAdv,
          cod_per_unit: Math.max(0, paid.price - unitAdv),
          bogo_pair_id: bogoPairId
        });

        // 2. Add Free Product at ₹0
        state.cart.push({
          id: free.id,
          name: `${free.name} (Free BOGO Gift)`,
          price: 0,
          originalPrice: free.price,
          image: free.image,
          size: free.sizes ? free.sizes[0] : "Standard",
          color: free.colors ? free.colors[0] : "Default",
          quantity: 1,
          advance_payment_enabled: false,
          advance_payment_type: 'fixed',
          advance_payment_value: 0,
          advance_per_unit: 0,
          cod_per_unit: 0,
          is_free_bogo: true,
          bogo_pair_id: bogoPairId
        });

        saveCart();
        updateBadges();
        renderCartDrawer();
        closeBogoModal();
        openCartDrawer();
        showToast(`Added "${paid.name}" and FREE "${free.name}" to cart!`, "success");
      });
    }

    // 6. Mobile Drawer Triggers
    if (elements.mobileToggleBtn) {
      elements.mobileToggleBtn.addEventListener("click", () => {
        elements.mobileDrawer.classList.toggle("open");
        elements.mobileToggleBtn.classList.toggle("active");
        document.body.style.overflow = elements.mobileDrawer.classList.contains("open") ? "hidden" : "";
      });
    }

    function closeMobileDrawer() {
      if (elements.mobileDrawer) {
        elements.mobileDrawer.classList.remove("open");
        elements.mobileToggleBtn.classList.remove("active");
        document.body.style.overflow = "";
      }
    }

    if (elements.mobileDrawerCloseBtn) elements.mobileDrawerCloseBtn.addEventListener("click", closeMobileDrawer);
    if (elements.mobileDrawerBackdrop) elements.mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);

    // 7. Checkout Trigger
    if (elements.checkoutBtn) {
      elements.checkoutBtn.addEventListener("click", () => {
        if (state.cart.length === 0) {
          showToast("Your cart is empty! Add items before checking out.", "error");
          return;
        }
        window.location.href = "checkout.html";
      });
    }

    // 8. Promo Code Copying
    const promoCodeBoxes = document.querySelectorAll(".promo-code-box");
    promoCodeBoxes.forEach(box => {
      box.addEventListener("click", () => {
        const code = box.dataset.code || "VELORA10";
        navigator.clipboard.writeText(code).then(() => {
          showToast(`Coupon code "${code}" copied to clipboard!`, "success");
        }).catch(() => {
          showToast(`Coupon code "${code}" ready for use!`, "info");
        });
      });
    });

    // 9. Newsletter Form Submit
    const newsletterForm = document.getElementById("newsletter-form");
    if (newsletterForm) {
      newsletterForm.addEventListener("submit", e => {
        e.preventDefault();
        const input = newsletterForm.querySelector("input[type='email']");
        if (input && input.value) {
          showToast(`Welcome! Your 15% VIP discount code "WELCOME15" has been sent to ${input.value}`, "success");
          input.value = "";
        }
      });
    }

    // 10. Sticky Header on Scroll
    const header = document.querySelector(".header-nav-wrapper");
    window.addEventListener("scroll", () => {
      if (window.scrollY > 20) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    });

    // 11. Header Wishlist button navigation
    const headerWishlistBtn = document.querySelector(".wishlist-drawer-trigger");
    if (headerWishlistBtn) {
      headerWishlistBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "wishlist.html";
      });
    }

    // 12. Account Profile Navigation
    const accountBtns = document.querySelectorAll(".action-btn[title*='Account']");
    accountBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (btn.closest('.nav-account-wrapper') && window.VeloraAuth && window.VeloraAuth.isLoggedIn()) {
          return; // Let the dropdown handle it
        }
        window.location.href = (window.VeloraAuth && window.VeloraAuth.isLoggedIn()) ? "account.html" : "login.html";
      });
    });

    // 13. ESC key closes modals/drawers
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeCartDrawer();
        closeQuickView();
        closeBogoModal();
        closeMobileDrawer();
        if (elements.searchResultsDropdown) {
          elements.searchResultsDropdown.classList.remove("active");
        }
      }
    });

    // 14. Cross-component & Cross-tab Cart Synchronization
    window.addEventListener("velora:cart-updated", () => {
      state.cart = JSON.parse(localStorage.getItem("velora_cart")) || [];
      syncProductCartButtons();
      updateBadges();
      renderCartDrawer();
    });

    window.addEventListener("storage", e => {
      if (e.key === "velora_cart") {
        state.cart = JSON.parse(localStorage.getItem("velora_cart")) || [];
        syncProductCartButtons();
        updateBadges();
        renderCartDrawer();
      }
    });
  }
});
