/**
 * VELORA - Modern E-Commerce Application State & Interaction Controller
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- Global Application State ---
  const state = {
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [
      // Pre-populate with 1 realistic item for instant visual demonstration
      {
        id: "prod-01",
        name: "AeroGlide Runner Pro V2",
        price: 3499,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",
        size: "US 10",
        color: "Obsidian Black",
        quantity: 1
      }
    ],
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || ["prod-02", "prod-07"]),
    activeTrendingCategory: "all",
    dealTimeLeft: 14 * 3600 + 42 * 60 + 15 // Flash deal timer: 14h 42m 15s
  };

  // --- DOM Elements ---
  const elements = {
    categoriesGrid: document.getElementById("categories-grid"),
    trendingGrid: document.getElementById("trending-grid"),
    newArrivalsGrid: document.getElementById("new-arrivals-grid"),
    dealsGrid: document.getElementById("deals-grid"),
    
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
    renderCategories();
    renderTrendingProducts("all");
    renderNewArrivals();
    renderFlashDeals();
    updateBadges();
    renderCartDrawer();
    initFlashDealTimer();
    bindEventListeners();

    // Re-render seamlessly as soon as live Supabase catalog sync completes
    if (window.syncProductsFromSupabase) {
      try {
        await window.syncProductsFromSupabase();
        renderCategories();
        renderTrendingProducts(state.activeTrendingCategory || "all");
        renderNewArrivals();
        renderFlashDeals();
        updateBadges();
      } catch (err) {
        console.warn("Live homepage catalog sync:", err);
      }
    }

    // Dynamic banners & delivery partners from Supabase
    await syncBanners();
    await syncDeliveryPartners();
    if (window.syncStoreSettings) {
      await window.syncStoreSettings();
      applyStoreSettings();
    }
    initHomepageRealtime();
  }

  // Reactive listener for background Supabase updates
  window.addEventListener("velora:products-synced", () => {
    renderCategories();
    renderTrendingProducts(state.activeTrendingCategory || "all");
    renderNewArrivals();
    renderFlashDeals();
    updateBadges();
  });

  window.addEventListener("velora:settings-synced", () => {
    applyStoreSettings();
  });

  // 1b. Render Promotional Hero Banner (Dynamic from Supabase banners table)
  async function syncBanners() {
    try {
      const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?is_active=eq.true&order=display_order.asc`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (!res.ok) return;
      const banners = await res.json();
      if (!banners || banners.length === 0) return;

      const activeBanner = banners[0];
      const tagEl = document.getElementById("hero-tag-text");
      const headlineEl = document.getElementById("hero-headline");
      const subtitleEl = document.getElementById("hero-subtitle");
      const ctaBtn = document.getElementById("hero-cta-primary");
      const ctaText = document.getElementById("hero-cta-text");
      const heroImg = document.getElementById("hero-image");

      if (tagEl && activeBanner.subtitle) tagEl.textContent = activeBanner.subtitle;
      if (headlineEl && activeBanner.title) {
        headlineEl.innerHTML = activeBanner.title;
      }
      if (subtitleEl && activeBanner.subtitle) {
        subtitleEl.textContent = activeBanner.subtitle;
      }
      if (ctaBtn && activeBanner.button_link) {
        ctaBtn.href = activeBanner.button_link;
      }
      if (ctaText && activeBanner.button_text) {
        ctaText.textContent = activeBanner.button_text;
      }
      if (heroImg && activeBanner.image_url) {
        heroImg.src = activeBanner.image_url;
      }
    } catch (err) {
      console.warn("Banner sync notice:", err);
    }
  }

  // 1c. Render Delivery Partners (Dynamic from Supabase delivery_partners table)
  async function syncDeliveryPartners() {
    const grid = document.getElementById("delivery-partners-grid");
    if (!grid) return;

    try {
      const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/delivery_partners?is_active=eq.true&order=display_order.asc`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (!res.ok) return;
      const partners = await res.json();
      if (!partners || partners.length === 0) return;

      grid.innerHTML = partners.map(p => {
        const cleanLogo = (p.logo_url || "").replace(/^\.\.\//, "");
        return `
          <div class="delivery-partner-card">
            <div class="partner-logo-box">
              <img src="${cleanLogo}" alt="${p.name} Logo" class="partner-logo-img" loading="lazy" onerror="this.style.display='none';">
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
        .on("postgres_changes", { event: "*", schema: "public", table: "banners" }, () => syncBanners())
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
  function createProductCardHTML(product) {
    const isWishlisted = state.wishlist.has(product.id);
    const badgeClass = `badge-${product.badgeType || 'popular'}`;
    const isInCart = state.cart.some(item => item.id === product.id);

    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-card-media">
          ${product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : ""}
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

          <button class="btn-add-to-cart ${isInCart ? 'added' : ''}" data-cart-id="${product.id}">
            ${isInCart ? `${icons.check} In Cart` : `${icons.cart} Add to Cart`}
          </button>
        </div>
      </div>
    `;
  }

  // 3. Render Trending Now Products
  function renderTrendingProducts(category = "all") {
    if (!elements.trendingGrid || !window.PRODUCTS_DATA) return;

    let filtered = window.PRODUCTS_DATA.filter(p => p.isTrending);
    if (category !== "all") {
      filtered = window.PRODUCTS_DATA.filter(p => p.category === category || p.category_id === category);
    }

    elements.trendingGrid.innerHTML = filtered.map(product => createProductCardHTML(product)).join("");
  }

  // 4. Render New Arrivals
  function renderNewArrivals() {
    if (!elements.newArrivalsGrid || !window.PRODUCTS_DATA) return;
    const newItems = window.PRODUCTS_DATA.filter(p => p.isNew);
    elements.newArrivalsGrid.innerHTML = newItems.map(product => createProductCardHTML(product)).join("");
  }

  // 5. Render Today's Flash Deals
  function renderFlashDeals() {
    if (!elements.dealsGrid || !window.PRODUCTS_DATA) return;
    const deals = window.PRODUCTS_DATA.filter(p => p.isDeal);
    elements.dealsGrid.innerHTML = deals.map(product => createProductCardHTML(product)).join("");
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

    // Refresh buttons state in grid
    document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${productId}"]`).forEach(btn => {
      btn.classList.add("added");
      btn.innerHTML = `${icons.check} In Cart`;
    });
  }

  function updateCartQuantity(index, delta) {
    if (!state.cart[index]) return;

    state.cart[index].quantity += delta;

    if (state.cart[index].quantity <= 0) {
      const removedItem = state.cart.splice(index, 1)[0];
      showToast(`Removed "${removedItem.name}" from cart`, "info");
      // Reset button state
      document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${removedItem.id}"]`).forEach(btn => {
        btn.classList.remove("added");
        btn.innerHTML = `${icons.cart} Add to Cart`;
      });
    }

    saveCart();
    updateBadges();
    renderCartDrawer();
  }

  function removeFromCart(index) {
    if (!state.cart[index]) return;
    const removedItem = state.cart.splice(index, 1)[0];
    saveCart();
    updateBadges();
    renderCartDrawer();
    showToast(`Removed "${removedItem.name}" from cart`, "info");

    document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${removedItem.id}"]`).forEach(btn => {
      btn.classList.remove("added");
      btn.innerHTML = `${icons.cart} Add to Cart`;
    });
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
      const freeShippingThreshold = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.shipping && Number(window.VELORA_SETTINGS.shipping.free_shipping_threshold)) || 999;
      elements.freeShippingFill.style.width = "0%";
      elements.freeShippingMsg.innerHTML = `Add <strong>${formatPrice(freeShippingThreshold)}</strong> more for Free Express Delivery!`;
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
    const freeShippingThreshold = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.shipping && Number(window.VELORA_SETTINGS.shipping.free_shipping_threshold)) || 999;
    const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

    elements.freeShippingFill.style.width = `${progress}%`;
    if (subtotal >= freeShippingThreshold) {
      elements.freeShippingMsg.innerHTML = `🎉 You unlocked <strong>FREE Express Delivery</strong>!`;
    } else {
      const remaining = Math.max(0, freeShippingThreshold - subtotal);
      elements.freeShippingMsg.innerHTML = `Add <strong>${formatPrice(remaining)}</strong> more for Free Delivery!`;
    }

    elements.cartSubtotalElem.textContent = formatPrice(subtotal);
    elements.cartTotalElem.textContent = formatPrice(subtotal);

    // Calculate advance & COD totals
    let totalAdvance = 0;
    state.cart.forEach(item => {
      if (item.advance_payment_enabled) {
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
      const advBadge = item.advance_payment_enabled 
        ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#6366f1; background:rgba(99,102,241,0.12); padding:1px 5px; border-radius:4px; margin-left:6px;">⚡ Advance Req.</span>` 
        : '';

      return `
      <div class="cart-item-card">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-meta">${item.size} • ${item.color} ${advBadge}</span>
          <div class="cart-item-bottom">
            <div class="cart-qty-control">
              <button class="cart-qty-btn" data-cart-delta="-1" data-cart-idx="${index}">-</button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button class="cart-qty-btn" data-cart-delta="1" data-cart-idx="${index}">+</button>
            </div>
            <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
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
    elements.cartDrawerOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    elements.cartDrawerOverlay.classList.remove("active");
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
      // Add to Cart
      const addCartBtn = e.target.closest(".btn-add-to-cart");
      if (addCartBtn) {
        const id = addCartBtn.dataset.cartId;
        addToCart(id);
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
        const idx = parseInt(qtyBtn.dataset.cartIdx, 10);
        const delta = parseInt(qtyBtn.dataset.cartDelta, 10);
        updateCartQuantity(idx, delta);
        return;
      }

      // Cart Drawer remove button
      const removeBtn = e.target.closest(".cart-item-remove");
      if (removeBtn) {
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
        closeMobileDrawer();
        if (elements.searchResultsDropdown) {
          elements.searchResultsDropdown.classList.remove("active");
        }
      }
    });
  }
});
