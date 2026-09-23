/**
 * VELORA - Shop & Product Listing State Controller
 * Pure Vanilla JavaScript (ES6+)
 * Prepared for Supabase / REST API migration with modular fetch abstraction.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));
  const escapeHtml = (str) => (!str ? "" : String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]));

  // --- Global Application State ---
  const state = {
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [],
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || []),
    
    // Filter State
    filters: {
      category: "all",
      trendingOnly: false,
      dealsOnly: false,
      newOnly: false,
      bogoOnly: false,
      minPrice: 0,
      maxPrice: 20000,
      brands: new Set(),
      minRating: 0,
      inStockOnly: false,
      searchQuery: ""
    },
    
    sortBy: "featured",
    page: 1,
    itemsPerPage: 12,
    totalFilteredProducts: [],
    streamId: 0,
    isStreaming: false,
    renderedProductIds: new Set(),
    isCatalogSyncing: true
  };

  let streamBatchTimer = null;
  let pipelineTimer = null;

  // --- SVG Icons Helpers ---
  const icons = {
    star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    cart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    spin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`
  };

  // --- DOM Elements ---
  const elements = {
    // Header & Badges
    cartCountBadges: document.querySelectorAll(".cart-count-badge"),
    wishlistCountBadges: document.querySelectorAll(".wishlist-count-badge"),
    navSearchInput: document.getElementById("nav-search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    searchResultsDropdown: document.getElementById("search-results-dropdown"),
    mobileSearchInput: document.getElementById("mobile-search-input"),
    mobileToggleBtn: document.getElementById("mobile-toggle-btn"),
    mobileDrawer: document.getElementById("mobile-drawer"),
    mobileDrawerCloseBtn: document.getElementById("mobile-drawer-close"),
    mobileDrawerBackdrop: document.getElementById("mobile-drawer-backdrop"),

    // Breadcrumbs & Header Titles
    breadcrumbCategory: document.getElementById("breadcrumb-category"),
    shopPageTitle: document.getElementById("shop-page-title"),
    shopPageSubtitle: document.getElementById("shop-page-subtitle"),

    // Sidebar & Filters
    categoryFilterList: document.getElementById("category-filter-list"),
    mobileCategoryFilterList: document.getElementById("mobile-category-filter-list"),
    priceRangeSlider: document.getElementById("price-range-slider"),
    priceMinInput: document.getElementById("price-min-input"),
    priceMaxInput: document.getElementById("price-max-input"),
    priceDisplayVal: document.getElementById("price-display-val"),
    brandCheckboxesContainer: document.getElementById("brand-checkboxes-container"),
    mobileBrandCheckboxes: document.getElementById("mobile-brand-checkboxes"),
    inStockCheckbox: document.getElementById("filter-in-stock"),
    clearAllFiltersBtns: document.querySelectorAll(".clear-all-filters-action"),
    applyFiltersBtn: document.getElementById("apply-filters-btn"),

    // Mobile Filter Drawer
    mobileFilterBtn: document.getElementById("btn-mobile-filter"),
    mobileFilterBadge: document.getElementById("mobile-filter-badge"),
    mobileFilterDrawerOverlay: document.getElementById("mobile-filter-drawer-overlay"),
    mobileFilterDrawerClose: document.getElementById("mobile-filter-drawer-close"),
    mobileFilterApplyBtn: document.getElementById("mobile-filter-apply-btn"),

    // Toolbar & Products
    productsCountText: document.getElementById("results-count-text"),
    activeFiltersContainer: document.getElementById("active-filters-container"),
    toolbarSearchInput: document.getElementById("toolbar-search-input"),
    sortDropdown: document.getElementById("sort-dropdown"),
    productsGrid: document.getElementById("shop-products-grid"),

    // Automatic Catalog 3D Streaming Loader
    catalogAutoLoader: document.getElementById("catalog-auto-loader"),

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

    // BOGO Selection Modal
    bogoModalOverlay: document.getElementById("bogo-modal-overlay"),
    bogoModalCloseBtn: document.getElementById("bogo-modal-close-btn"),
    bogoPaidBanner: document.getElementById("bogo-paid-item-banner"),
    bogoEligibleGrid: document.getElementById("bogo-eligible-items-grid"),
    bogoSelectedFreeName: document.getElementById("bogo-selected-free-name"),
    bogoConfirmAddBtn: document.getElementById("bogo-confirm-add-btn"),

    // Toast Container
    toastContainer: document.getElementById("toast-container")
  };

  // --- Initial Startup ---
  initShop();

  async function initShop() {
    parseURLParameters();
    renderCategoryFilters();
    renderBrandCheckboxes();
    updateBadges();
    renderCartDrawer();
    bindEvents();
    initInfiniteScroll();
    
    // Initial fetch and render
    executeFilterPipeline();

    // Re-render and filter with live Supabase products & store settings
    try {
      await Promise.allSettled([
        window.syncStoreSettings ? window.syncStoreSettings() : Promise.resolve(),
        window.syncProductsFromSupabase ? window.syncProductsFromSupabase() : Promise.resolve()
      ]);
    } catch (err) {
      console.warn("Live shop catalog sync note:", err);
    } finally {
      state.isCatalogSyncing = false;
      applyStoreSettings();
      renderCategoryFilters();
      renderBrandCheckboxes();
      executeFilterPipeline();
      updateBadges();
    }
  }

  // Reactive listener for background Supabase updates
  window.addEventListener("velora:products-synced", () => {
    renderCategoryFilters();
    renderBrandCheckboxes();
    executeFilterPipeline();
    updateBadges();
  });

  window.addEventListener("velora:settings-synced", () => {
    applyStoreSettings();
    executeFilterPipeline();
    updateBadges();
  });

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

  // ==========================================================================
  // URL PARAMETERS PARSER
  // ==========================================================================
  function parseURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get("category");
    const searchParam = urlParams.get("search");
    const dealsParam = urlParams.get("deals") || urlParams.get("discount");
    const sectionParam = (urlParams.get("section") || "").toLowerCase();
    const path = window.location.pathname.toLowerCase();

    if (path.includes("trending") || sectionParam === "trending") {
      state.filters.trendingOnly = true;
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Trending Now";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Trending Now";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Handpicked bestsellers crafted for timeless style, all-day comfort, and daily durability.";
      document.title = "Trending Now | VADI - Everything. Simply Yours.";
    }
    if (path.includes("deals") || sectionParam === "deals" || dealsParam === "true" || dealsParam === "1") {
      state.filters.dealsOnly = true;
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Today's Flash Deals";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Today's Deals";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Deep discounts on high-demand pieces. Quantities are strictly limited!";
      document.title = "Today's Deals | VADI - Everything. Simply Yours.";
    }
    if (path.includes("new-arrivals") || path.includes("new_arrivals") || sectionParam === "new" || sectionParam === "new-arrivals") {
      state.filters.newOnly = true;
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "New Arrivals";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "New Arrivals";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Just landed in the catalog. Be the first to experience our latest release pieces.";
      document.title = "New Arrivals | VADI - Everything. Simply Yours.";
    }
    const bogoParam = (urlParams.get("bogo") || urlParams.get("is_bogo") || "").toLowerCase();
    if (path.includes("bogo") || sectionParam === "bogo" || bogoParam === "true" || bogoParam === "1") {
      state.filters.bogoOnly = true;
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Buy 1 Get 1 Free";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Buy 1 Get 1 Free";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Select any qualifying luxury item and unlock an eligible free companion product!";
      document.title = "Buy 1 Get 1 Free | VADI - Everything. Simply Yours.";
    }

    if (categoryParam) {
      const lower = categoryParam.toLowerCase();
      if (lower === "deals" || lower === "flash-deals") {
        state.filters.dealsOnly = true;
      } else {
        state.filters.category = lower;
      }
    }
    if (searchParam) {
      state.filters.searchQuery = searchParam.trim();
      if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = searchParam;
      if (elements.navSearchInput) elements.navSearchInput.value = searchParam;
    }

    const brandParam = urlParams.get("brand") || urlParams.get("brands");
    if (brandParam) {
      const decodedBrand = decodeURIComponent(brandParam).trim();
      state.filters.brands.add(decodedBrand);
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = decodedBrand;
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = decodedBrand;
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = `Explore authentic premium footwear, timepieces, and apparel by ${decodedBrand}.`;
      document.title = `${decodedBrand} | VADI - Everything. Simply Yours.`;
    }
  }

  // ==========================================================================
  // RENDER SIDEBAR CONTROLS
  // ==========================================================================

  function renderCategoryFilters() {
    if (!window.CATEGORIES_DATA) return;

    // Calculate item counts for each category
    const counts = { all: window.PRODUCTS_DATA ? window.PRODUCTS_DATA.length : 0 };
    if (window.PRODUCTS_DATA) {
      window.PRODUCTS_DATA.forEach(p => {
        counts[p.category] = (counts[p.category] || 0) + 1;
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
    }

    const categories = [
      { id: "all", name: "All Products" },
      ...window.CATEGORIES_DATA
    ];

    const generateHTML = (containerId) => {
      return categories.map(cat => {
        const isActive = state.filters.category === cat.id || (cat.supabase_id && state.filters.category === cat.supabase_id);
        const count = counts[cat.id] || (cat.supabase_id ? counts[cat.supabase_id] : 0) || 0;
        return `
          <div class="category-filter-item ${isActive ? 'active' : ''}" data-category-val="${cat.id}">
            <span>${cat.name}</span>
            <span class="category-item-count">${count}</span>
          </div>
        `;
      }).join("");
    };

    if (elements.categoryFilterList) {
      elements.categoryFilterList.innerHTML = generateHTML("category-filter-list");
    }
    if (elements.mobileCategoryFilterList) {
      elements.mobileCategoryFilterList.innerHTML = generateHTML("mobile-category-filter-list");
    }

    updatePageHeaderAndBreadcrumb();
  }

  function updatePageHeaderAndBreadcrumb() {
    if (state.filters.bogoOnly) {
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Buy 1 Get 1 Free";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Buy 1 Get 1 Free";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Select any qualifying luxury item and unlock an eligible free companion product!";
      return;
    }

    if (state.filters.dealsOnly) {
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Flash Deals";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Flash Deals & Promotions";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Exclusive limited-time promotional pricing and curated seasonal discounts.";
      return;
    }

    if (state.filters.brands && state.filters.brands.size === 1) {
      const singleBrand = Array.from(state.filters.brands)[0];
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = singleBrand;
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = singleBrand;
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = `Explore authentic curated collections by ${singleBrand}.`;
      return;
    }

    const activeCat = state.filters.category;
    if (!activeCat || activeCat === "all") {
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "All Products";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "All Products";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Discover curated clothing, footwear, watches and lifestyle essentials.";
    } else {
      const match = window.CATEGORIES_DATA.find(c => c.id === activeCat);
      const name = match ? match.name : (activeCat.charAt(0).toUpperCase() + activeCat.slice(1));
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = name;
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = name;
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = match ? match.tagline : "Handcrafted pieces engineered for everyday modern living.";
    }
  }

  function renderBrandCheckboxes() {
    if (!window.getAvailableBrands || !window.PRODUCTS_DATA) return;

    const available = window.getAvailableBrands();
    const brandSet = new Set(available);
    if (state.filters.brands) {
      state.filters.brands.forEach(b => brandSet.add(b));
    }
    const brands = Array.from(brandSet).sort();

    const brandCounts = {};
    window.PRODUCTS_DATA.forEach(p => {
      if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    });

    const generateBrandHTML = () => {
      return brands.map(brand => {
        const isChecked = state.filters.brands.has(brand);
        const count = brandCounts[brand] || 0;
        return `
          <label class="custom-checkbox-label">
            <div class="checkbox-left">
              <input type="checkbox" class="brand-filter-checkbox" value="${brand}" ${isChecked ? 'checked' : ''}>
              <span>${brand}</span>
            </div>
            <span class="filter-brand-count">${count}</span>
          </label>
        `;
      }).join("");
    };

    if (elements.brandCheckboxesContainer) {
      elements.brandCheckboxesContainer.innerHTML = generateBrandHTML();
    }
    if (elements.mobileBrandCheckboxes) {
      elements.mobileBrandCheckboxes.innerHTML = generateBrandHTML();
    }
  }

  // ==========================================================================
  // SKELETON LOADERS
  // ==========================================================================
  function renderSkeletons() {
    if (!elements.productsGrid) return;
    elements.productsGrid.innerHTML = Array(state.itemsPerPage).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-media"></div>
        <div class="skeleton-body">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line btn"></div>
        </div>
      </div>
    `).join("");
  }

  // ==========================================================================
  // FILTERING, SORTING & QUERY PIPELINE (FETCH ABSTRACTION)
  // Ready to replace with `await supabase.from('products').select(...)`
  // ==========================================================================
  function executeFilterPipeline(isLoadMore = false) {
    if (streamBatchTimer) {
      clearTimeout(streamBatchTimer);
      streamBatchTimer = null;
    }
    state.streamId += 1;
    state.page = 1;
    state.isStreaming = false;
    state.renderedProductIds = new Set();

    const loader = elements.catalogAutoLoader || document.getElementById("catalog-auto-loader");
    if (loader) loader.style.display = "none";

    renderSkeletons();

    if (pipelineTimer) {
      clearTimeout(pipelineTimer);
    }

    // Simulate fast async fetch
    pipelineTimer = setTimeout(() => {
      let filtered = [...window.PRODUCTS_DATA];

      // 1. Category Filter
      if (state.filters.category && state.filters.category !== "all") {
        filtered = filtered.filter(p => p.category === state.filters.category || p.category_id === state.filters.category);
      }

      // 1b. Section Filters (Trending, Deals, New Arrivals, BOGO)
      if (state.filters.trendingOnly) {
        filtered = filtered.filter(p => p.isTrending === true);
      }
      if (state.filters.dealsOnly) {
        filtered = filtered.filter(p => p.isDeal === true);
      }
      if (state.filters.newOnly) {
        filtered = filtered.filter(p => p.isNew === true);
      }
      if (state.filters.bogoOnly) {
        let bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
          ? window.VELORA_SETTINGS.bogo_config.product_ids
          : [];
        if (!bogoConfigIds || bogoConfigIds.length === 0) {
          try {
            const cached = localStorage.getItem("velora_bogo_config");
            if (cached) {
              const p = JSON.parse(cached);
              if (p && Array.isArray(p.product_ids) && p.product_ids.length > 0) bogoConfigIds = p.product_ids;
            }
          } catch (_) {}
        }
        if (!bogoConfigIds || bogoConfigIds.length === 0) {
          const dealIds = (window.PRODUCTS_DATA || []).filter(p => Boolean(p.is_deal)).map(p => p.id);
          if (dealIds.length > 0) bogoConfigIds = dealIds;
        }
        filtered = filtered.filter(p => Boolean(p.isBogo) || Boolean(p.is_bogo) || bogoConfigIds.includes(p.id) || bogoConfigIds.includes(p.supabase_id) || (p.legacyId && bogoConfigIds.includes(p.legacyId)));
      }

      // 2. Price Range Filter
      filtered = filtered.filter(p => 
        p.price >= state.filters.minPrice && p.price <= state.filters.maxPrice
      );

      // 3. Brands Filter (exact or case-insensitive / substring match)
      if (state.filters.brands.size > 0) {
        filtered = filtered.filter(p => {
          if (state.filters.brands.has(p.brand)) return true;
          for (const b of state.filters.brands) {
            const bLower = b.toLowerCase();
            if (p.brand && (p.brand.toLowerCase() === bLower || p.brand.toLowerCase().includes(bLower))) return true;
            if (p.name && p.name.toLowerCase().includes(bLower)) return true;
          }
          return false;
        });
      }

      // 4. Rating Filter
      if (state.filters.minRating > 0) {
        filtered = filtered.filter(p => p.rating >= state.filters.minRating);
      }

      // 5. In Stock Only Filter
      if (state.filters.inStockOnly) {
        filtered = filtered.filter(p => p.inStock === true);
      }

      // 6. Search Query Filter
      if (state.filters.searchQuery) {
        if (window.VadiSearchUtils && typeof window.VadiSearchUtils.matchesProduct === 'function') {
          filtered = filtered.filter(p => window.VadiSearchUtils.matchesProduct(p, state.filters.searchQuery));
        } else {
          const q = state.filters.searchQuery.toLowerCase();
          filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(q) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q))
          );
        }
      }

      // 7. Sort By
      switch (state.sortBy) {
        case "newest":
          filtered.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
          break;
        case "price-low":
          filtered.sort((a, b) => a.price - b.price);
          break;
        case "price-high":
          filtered.sort((a, b) => b.price - a.price);
          break;
        case "rating":
          filtered.sort((a, b) => b.rating - a.rating);
          break;
        case "discount":
          filtered.sort((a, b) => (b.discount || 0) - (a.discount || 0));
          break;
        case "featured":
        default:
          filtered.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0));
          break;
      }

      state.totalFilteredProducts = filtered;
      renderProductsView();
      renderActiveFilterChips();
      updateToolbarCounters();
      updateMobileFilterBadge();
    }, 150);
  }

  // ==========================================================================
  // RENDER PRODUCTS VIEW & INFINITE SCROLL
  // ==========================================================================
  function createProductCardSingleHTML(product) {
    if (!product) return "";
    try {
      const isWishlisted = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function')
        ? window.VadiWishlist.has(product.id)
        : state.wishlist.has(product.id);
      const prodId = String(product.id || product.supabase_id);
      const isInCart = state.cart.some(item => String(item.id || item.supabase_id) === prodId);
      const bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
        ? window.VELORA_SETTINGS.bogo_config.product_ids
        : [];
      const isBogo = state.filters.bogoOnly || Boolean(product.isBogo) || Boolean(product.is_bogo) || bogoConfigIds.includes(product.id) || bogoConfigIds.includes(product.supabase_id) || (product.legacyId && bogoConfigIds.includes(product.legacyId));
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
            <img class="product-card-img" src="${product.image}" alt="${product.name}" loading="lazy" decoding="async">
            ${product.secondaryImage ? `<img class="product-secondary-img" src="${product.secondaryImage}" alt="${product.name} alternate view" loading="lazy" decoding="async">` : ""}
            <button class="quick-view-overlay-btn" data-quickview-id="${product.id}">
              ${icons.eye} Quick View
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-card-brand">${product.brand || 'VADI'}</div>
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

            <div class="product-card-shipping-tag" style="font-size: 0.73rem; color: #059669; font-weight: 700; margin: 4px 0 8px; display: flex; align-items: center; gap: 4px; letter-spacing: 0.2px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              FREE DELIVERY
            </div>

            ${actionBtnHtml}
          </div>
        </div>
      `;
    } catch (cardErr) {
      console.warn("createProductCardSingleHTML error for product:", product ? product.id : null, cardErr);
      return "";
    }
  }

  // ==========================================================================
  // AUTOMATIC 3D STREAMING CATALOG LOADER
  // Streams all matching products in fluid batches (12 -> 24 -> 36 -> ... -> ALL)
  // Displays the premium 3D orbit loader between batches, hides upon completion
  // ==========================================================================

  function startCatalogStream() {
    if (!elements.productsGrid) return;

    if (streamBatchTimer) {
      clearTimeout(streamBatchTimer);
      streamBatchTimer = null;
    }

    const currentStreamId = ++state.streamId;
    state.page = 1;
    state.renderedProductIds = new Set();
    state.isStreaming = false;

    const loader = elements.catalogAutoLoader || document.getElementById("catalog-auto-loader");

    if (state.totalFilteredProducts.length === 0) {
      if (state.isCatalogSyncing) {
        renderSkeletons();
        if (loader) loader.style.display = "none";
        return;
      }
      elements.productsGrid.innerHTML = `
        <div class="shop-empty-state">
          <div class="empty-state-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3 class="empty-state-title">${state.filters.searchQuery ? `No products found for "${escapeHtml(state.filters.searchQuery)}"` : 'No Matching Products Found'}</h3>
          <p class="empty-state-desc">
            ${state.filters.searchQuery 
              ? `We couldn't find any products matching "${escapeHtml(state.filters.searchQuery)}". Try checking your spelling or search for broader keywords like shoes, watches, caps, or clothing.`
              : `We couldn't find any products matching your selected combination of filters. Try broadening your criteria or reset all filters.`}
          </p>
          <button class="btn-primary clear-all-filters-action">
            ${state.filters.searchQuery ? 'Clear Search' : 'Clear All Filters'}
          </button>
        </div>
      `;
      if (loader) loader.style.display = "none";
      updateToolbarCounters();
      return;
    }

    // Render first batch of products immediately
    const firstBatch = state.totalFilteredProducts.slice(0, state.itemsPerPage);
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = firstBatch.map(product => {
      state.renderedProductIds.add(product.id);
      return createProductCardSingleHTML(product);
    }).join("");
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
    elements.productsGrid.innerHTML = "";
    elements.productsGrid.appendChild(fragment);
    updateToolbarCounters();

    const total = state.totalFilteredProducts.length;
    if (state.itemsPerPage >= total) {
      // All products fit in initial batch
      if (loader) loader.style.display = "none";
      return;
    }

    // More products to stream: display premium 3D orbit loader and stream next batch automatically
    if (loader) loader.style.display = "flex";
    state.isStreaming = true;

    scheduleNextStreamBatch(currentStreamId);
  }

  function scheduleNextStreamBatch(currentStreamId) {
    if (streamBatchTimer) {
      clearTimeout(streamBatchTimer);
    }

    // Micro-cadence interval between batches for smooth streaming & visible 3D orbit animation
    streamBatchTimer = setTimeout(() => {
      // Abort if another filter/search stream has started
      if (currentStreamId !== state.streamId) return;

      const loader = elements.catalogAutoLoader || document.getElementById("catalog-auto-loader");
      const total = state.totalFilteredProducts.length;
      const startIdx = state.page * state.itemsPerPage;

      if (startIdx >= total) {
        state.isStreaming = false;
        if (loader) loader.style.display = "none";
        return;
      }

      const nextBatch = state.totalFilteredProducts.slice(startIdx, startIdx + state.itemsPerPage);
      // Guarantee zero duplicates by filtering against rendered IDs set
      const unrenderedItems = nextBatch.filter(p => !state.renderedProductIds.has(p.id));

      if (unrenderedItems.length > 0 && elements.productsGrid) {
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = unrenderedItems.map(product => {
          state.renderedProductIds.add(product.id);
          return createProductCardSingleHTML(product);
        }).join("");
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        elements.productsGrid.appendChild(fragment);
      }

      state.page += 1;
      const nextStartIdx = state.page * state.itemsPerPage;

      if (nextStartIdx >= total) {
        // Complete! Every matching product has been rendered
        state.isStreaming = false;
        if (loader) loader.style.display = "none";
      } else {
        // Continue streaming next batch
        if (loader) loader.style.display = "flex";
        scheduleNextStreamBatch(currentStreamId);
      }
    }, 180);
  }

  function renderProductsView() {
    startCatalogStream();
  }

  function initInfiniteScroll() {
    // Kept for backward compatibility; streaming is driven automatically by startCatalogStream()
  }

  // ==========================================================================
  // ACTIVE FILTER CHIPS / DISMISSALS
  // ==========================================================================
  function renderActiveFilterChips() {
    if (!elements.activeFiltersContainer) return;

    const chips = [];

    // Section chips
    if (state.filters.trendingOnly) {
      chips.push({
        label: "Trending Now",
        onRemove: () => {
          state.filters.trendingOnly = false;
          executeFilterPipeline();
        }
      });
    }

    // Deals chip
    if (state.filters.dealsOnly) {
      chips.push({
        label: "Flash Deals",
        onRemove: () => {
          state.filters.dealsOnly = false;
          executeFilterPipeline();
        }
      });
    }

    if (state.filters.newOnly) {
      chips.push({
        label: "New Arrivals",
        onRemove: () => {
          state.filters.newOnly = false;
          executeFilterPipeline();
        }
      });
    }

    if (state.filters.bogoOnly) {
      chips.push({
        label: "Buy 1 Get 1 Free",
        onRemove: () => {
          state.filters.bogoOnly = false;
          try {
            const url = new URL(window.location);
            if (url.searchParams.has("bogo") || url.searchParams.has("is_bogo") || url.searchParams.get("section") === "bogo") {
              url.searchParams.delete("bogo");
              url.searchParams.delete("is_bogo");
              if (url.searchParams.get("section") === "bogo") url.searchParams.delete("section");
              window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
            }
          } catch (_) {}
          updatePageHeaderAndBreadcrumb();
          executeFilterPipeline();
        }
      });
    }

    // Category chip
    if (state.filters.category && state.filters.category !== "all") {
      const match = window.CATEGORIES_DATA?.find(c => c.id === state.filters.category || c.supabase_id === state.filters.category);
      chips.push({
        label: `Category: ${match ? match.name : state.filters.category}`,
        onRemove: () => {
          state.filters.category = "all";
          renderCategoryFilters();
          executeFilterPipeline();
        }
      });
    }

    // Brands chips
    state.filters.brands.forEach(brand => {
      chips.push({
        label: brand,
        onRemove: () => {
          state.filters.brands.delete(brand);
          renderBrandCheckboxes();
          executeFilterPipeline();
        }
      });
    });

    // Rating chip
    if (state.filters.minRating > 0) {
      chips.push({
        label: `★ ${state.filters.minRating} & up`,
        onRemove: () => {
          state.filters.minRating = 0;
          document.querySelectorAll(".rating-filter-pill").forEach(p => p.classList.remove("active"));
          executeFilterPipeline();
        }
      });
    }

    // In Stock Only chip
    if (state.filters.inStockOnly) {
      chips.push({
        label: "In Stock Only",
        onRemove: () => {
          state.filters.inStockOnly = false;
          if (elements.inStockCheckbox) elements.inStockCheckbox.checked = false;
          executeFilterPipeline();
        }
      });
    }

    // Search query chip
    if (state.filters.searchQuery) {
      chips.push({
        label: `"${state.filters.searchQuery}"`,
        onRemove: () => {
          state.filters.searchQuery = "";
          if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = "";
          if (elements.navSearchInput) elements.navSearchInput.value = "";
          executeFilterPipeline();
        }
      });
    }

    elements.activeFiltersContainer.innerHTML = chips.map(chip => `
      <div class="active-filter-chip">
        <span>${chip.label}</span>
        <button class="chip-remove-btn" aria-label="Remove filter">✕</button>
      </div>
    `).join("");

    elements.activeFiltersContainer.querySelectorAll(".chip-remove-btn").forEach((btn, idx) => {
      btn.addEventListener("click", chips[idx].onRemove);
    });
  }

  function updateToolbarCounters() {
    if (elements.productsCountText) {
      elements.productsCountText.textContent = `${state.totalFilteredProducts.length} Products Found`;
    }
  }

  function updateMobileFilterBadge() {
    let count = 0;
    if (state.filters.category !== "all") count++;
    if (state.filters.dealsOnly) count++;
    if (state.filters.brands.size > 0) count += state.filters.brands.size;
    if (state.filters.minRating > 0) count++;
    if (state.filters.inStockOnly) count++;
    if (state.filters.searchQuery) count++;

    if (elements.mobileFilterBadge) {
      elements.mobileFilterBadge.textContent = count;
      elements.mobileFilterBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  // ==========================================================================
  // RESET / CLEAR ALL FILTERS
  // ==========================================================================
  function clearAllFilters() {
    state.filters.category = "all";
    state.filters.trendingOnly = false;
    state.filters.dealsOnly = false;
    state.filters.newOnly = false;
    state.filters.bogoOnly = false;
    state.filters.minPrice = 0;
    state.filters.maxPrice = 20000;
    state.filters.brands.clear();
    state.filters.minRating = 0;
    state.filters.inStockOnly = false;
    state.filters.searchQuery = "";
    state.page = 1;

    // Reset UI Inputs
    if (elements.priceRangeSlider) elements.priceRangeSlider.value = 20000;
    if (elements.priceMinInput) elements.priceMinInput.value = 0;
    if (elements.priceMaxInput) elements.priceMaxInput.value = 20000;
    if (elements.priceDisplayVal) elements.priceDisplayVal.textContent = `${formatPrice(0)} - ${formatPrice(20000)}`;
    if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = "";
    if (elements.navSearchInput) elements.navSearchInput.value = "";
    if (elements.inStockCheckbox) elements.inStockCheckbox.checked = false;

    // Uncheck radio ratings
    document.querySelectorAll("input[name='filter-rating']").forEach(r => r.checked = false);

    // Re-render sidebar categories and brands
    renderCategoryFilters();
    renderBrandCheckboxes();

    // Clean URL
    const url = new URL(window.location);
    url.search = "";
    window.history.replaceState({}, "", url);

    executeFilterPipeline();
    showToast("All filters have been reset", "info");
  }

  // ==========================================================================
  // CART OPERATIONS & DRAWER
  // ==========================================================================
  function addToCart(productId, selectedSize = null) {
    const product = (window.PRODUCTS_DATA && window.PRODUCTS_DATA.find(p => p.id === productId || p.legacyId === productId)) || 
                    (window.getProductById ? window.getProductById(productId) : null);
    if (!product) return;

    const size = selectedSize || (product.sizes ? product.sizes[0] : "Standard");
    const color = product.colors ? product.colors[0] : "Default";

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

    const existingIndex = state.cart.findIndex(item => (item.id === product.id || item.id === productId) && item.size === size);

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += 1;
      state.cart[existingIndex].advance_payment_enabled = isAdv;
      state.cart[existingIndex].advance_payment_type = advType;
      state.cart[existingIndex].advance_payment_value = advVal;
      state.cart[existingIndex].advance_per_unit = unitAdv;
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
        advance_per_unit: unitAdv
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
      const removed = state.cart[inCartIndex];
      // Remove all entries for this product ID
      state.cart = state.cart.filter(item => String(item.id || item.supabase_id) !== pidStr);
      saveCart();
      updateBadges();
      renderCartDrawer();
      showToast(`Removed "${removed.name}" from cart`, "info");
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
    const removed = state.cart.splice(index, 1)[0];
    saveCart();
    updateBadges();
    renderCartDrawer();
    showToast(`Removed "${removed.name}" from cart`, "info");
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
      const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
      if (advanceBreakdownBox) advanceBreakdownBox.style.display = "none";
      return;
    }

    elements.cartItemsContainer.style.display = "flex";
    elements.cartEmptyState.style.display = "none";

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (elements.freeShippingFill) elements.freeShippingFill.style.width = "100%";
    if (elements.freeShippingMsg) elements.freeShippingMsg.innerHTML = `🎉 <strong>100% FREE Delivery Across India</strong> on this order!`;

    elements.cartSubtotalElem.textContent = formatPrice(subtotal);
    elements.cartTotalElem.textContent = formatPrice(subtotal);

    // Calculate advance & COD totals
    let totalAdvance = 0;
    state.cart.forEach(item => {
      if (item.advance_payment_enabled) {
        let unitAdv = 0;
        if (item.advance_payment_type === "percentage") {
          unitAdv = Math.round((item.price || 0) * ((Number(item.advance_payment_value) || 0) / 100));
        } else {
          unitAdv = Math.min(item.price || 0, Number(item.advance_payment_value) || 0);
        }
        totalAdvance += (unitAdv * (item.quantity || 1));
      }
    });

    const totalCod = Math.max(0, subtotal - totalAdvance);
    const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
    const advancePayableElem = document.getElementById("cart-advance-payable");
    const codPayableElem = document.getElementById("cart-cod-payable");

    if (advanceBreakdownBox) {
      if (totalAdvance > 0) {
        advanceBreakdownBox.style.display = "block";
        if (advancePayableElem) advancePayableElem.textContent = formatPrice(totalAdvance);
        if (codPayableElem) codPayableElem.textContent = formatPrice(totalCod);
      } else {
        advanceBreakdownBox.style.display = "none";
      }
    }

    elements.cartItemsContainer.innerHTML = state.cart.map((item, index) => `
      <div class="cart-item-card">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-meta">${item.size} • ${item.color}</span>
          <div class="cart-item-bottom">
            <div class="cart-qty-control">
              <button class="cart-qty-btn" data-cart-delta="-1" data-cart-idx="${index}">-</button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button class="cart-qty-btn" data-cart-delta="1" data-cart-idx="${index}">+</button>
            </div>
            <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
            <button class="cart-item-remove" data-cart-remove="${index}">
              ${icons.trash}
            </button>
          </div>
        </div>
      </div>
    `).join("");
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
    if (window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
      const product = (window.PRODUCTS_DATA || []).find(p => p.id === productId);
      window.VadiWishlist.toggle(productId, 'main', product);
      return;
    }

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

    document.querySelectorAll(`.wishlist-btn[data-wishlist-id="${productId}"]`).forEach(btn => {
      btn.classList.toggle("active", state.wishlist.has(productId));
    });
  }

  function updateBadges() {
    const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const wishlistCount = state.wishlist.size;

    elements.cartCountBadges.forEach(badge => {
      badge.textContent = cartCount;
      badge.classList.remove("pop");
      void badge.offsetWidth;
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
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        <div style="display:flex; align-items:center; gap: 10px; width: 100%; min-width: 0;">
          <img src="${paidProduct.image}" alt="${paidProduct.name}" style="width: 52px; height: 52px; border-radius: 8px; object-fit: contain; border: 1px solid var(--border-color); flex-shrink: 0; background: #ffffff;">
          <div style="flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word;">
            <span style="font-size: 0.72rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Purchasing Qualifying Item:</span>
            <h4 style="font-size: 0.94rem; font-weight: 700; color: var(--text-main); margin: 2px 0; line-height: 1.3; overflow-wrap: anywhere; word-break: break-word;">${paidProduct.name}</h4>
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
              <span style="display:block; font-size:0.72rem; color:var(--text-muted); margin-bottom: 4px;">Price Match: Δ ₹${diff}</span>
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
      document.body.classList.add("bogo-modal-open");
      document.body.style.overflow = "hidden";
    }
  }

  function closeBogoModal() {
    if (elements.bogoModalOverlay) {
      elements.bogoModalOverlay.classList.remove("active");
      document.body.classList.remove("bogo-modal-open");
      document.body.style.overflow = "";
    }
    selectedBogoPaidProduct = null;
    selectedBogoFreeProduct = null;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elements.bogoModalOverlay && elements.bogoModalOverlay.classList.contains("active")) {
      closeBogoModal();
    }
  });

  // ==========================================================================
  // BIND ALL EVENT LISTENERS
  // ==========================================================================
  function bindEvents() {
    // 1. Delegated Product Card Actions
    document.addEventListener("click", e => {
      // Add to Cart / Toggle Cart
      const addCartBtn = e.target.closest(".btn-add-to-cart");
      if (addCartBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (addCartBtn.classList.contains("btn-claim-bogo") || addCartBtn.dataset.bogoId) {
          const bogoId = addCartBtn.dataset.bogoId || addCartBtn.dataset.cartId;
          openBogoModal(bogoId);
          return;
        }
        toggleCart(addCartBtn.dataset.cartId);
        return;
      }

      // Wishlist toggle
      const wishlistBtn = e.target.closest(".wishlist-btn");
      if (wishlistBtn) {
        toggleWishlist(wishlistBtn.dataset.wishlistId);
        return;
      }

      // Quick View
      const qvBtn = e.target.closest(".quick-view-overlay-btn");
      if (qvBtn) {
        openQuickView(qvBtn.dataset.quickviewId);
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

      // Search Result Item Click
      const searchItem = e.target.closest(".search-result-item");
      if (searchItem) {
        const id = searchItem.dataset.searchResultId;
        window.location.href = `product.html?id=${id}`;
        return;
      }

      // Category filter item click
      const catItem = e.target.closest(".category-filter-item");
      if (catItem) {
        const catVal = catItem.dataset.categoryVal;
        state.filters.category = catVal;
        state.page = 1;
        renderCategoryFilters();
        executeFilterPipeline();

        // Update URL
        const url = new URL(window.location);
        if (catVal === "all") url.searchParams.delete("category");
        else url.searchParams.set("category", catVal);
        window.history.pushState({}, "", url);

        // Close mobile drawer if open
        closeMobileFilterDrawer();
        return;
      }

      // Active filter chip remove
      const chipRemove = e.target.closest(".filter-chip-remove");
      if (chipRemove) {
        const type = chipRemove.dataset.clearType;
        const val = chipRemove.dataset.clearVal;

        if (type === "deals") {
          state.filters.dealsOnly = false;
          const url = new URL(window.location);
          url.searchParams.delete("deals");
          url.searchParams.delete("discount");
          if (url.searchParams.get("category") === "deals" || url.searchParams.get("category") === "flash-deals") {
            url.searchParams.delete("category");
          }
          window.history.pushState({}, "", url);
          updatePageHeaderAndBreadcrumb();
        } else if (type === "category") {
          state.filters.category = "all";
          const url = new URL(window.location);
          url.searchParams.delete("category");
          window.history.pushState({}, "", url);
          renderCategoryFilters();
        } else if (type === "price") {
          state.filters.minPrice = 0;
          state.filters.maxPrice = 20000;
          if (elements.priceRangeSlider) elements.priceRangeSlider.value = 20000;
          if (elements.priceMinInput) elements.priceMinInput.value = 0;
          if (elements.priceMaxInput) elements.priceMaxInput.value = 20000;
          if (elements.priceDisplayVal) elements.priceDisplayVal.textContent = `${formatPrice(0)} - ${formatPrice(20000)}`;
        } else if (type === "brand") {
          state.filters.brands.delete(val);
          document.querySelectorAll(`.brand-filter-checkbox[value="${val}"]`).forEach(c => c.checked = false);
        } else if (type === "rating") {
          state.filters.minRating = 0;
          document.querySelectorAll("input[name='filter-rating']").forEach(r => r.checked = false);
        } else if (type === "inStock") {
          state.filters.inStockOnly = false;
          if (elements.inStockCheckbox) elements.inStockCheckbox.checked = false;
        } else if (type === "search") {
          state.filters.searchQuery = "";
          if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = "";
          if (elements.navSearchInput) elements.navSearchInput.value = "";
        }

        state.page = 1;
        executeFilterPipeline();
        return;
      }

      // Clear all filters action
      if (e.target.closest(".clear-all-filters-action")) {
        clearAllFilters();
        closeMobileFilterDrawer();
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

      // Cart Drawer remove
      const removeBtn = e.target.closest(".cart-item-remove");
      if (removeBtn) {
        if (window.VeloraCart) return; // Managed exclusively by cart-drawer.js
        const idx = parseInt(removeBtn.dataset.cartRemove, 10);
        removeFromCart(idx);
        return;
      }

      // Size pill selection in modal
      const sizePill = e.target.closest(".size-pill");
      if (sizePill) {
        document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
        sizePill.classList.add("active");
        selectedModalSize = sizePill.dataset.sizeVal;
        return;
      }
    });

    // 2. Price Range Slider & Inputs Sync
    if (elements.priceRangeSlider) {
      elements.priceRangeSlider.addEventListener("input", e => {
        const val = parseInt(e.target.value, 10);
        state.filters.maxPrice = val;
        if (elements.priceMaxInput) elements.priceMaxInput.value = val;
        if (elements.priceDisplayVal) elements.priceDisplayVal.textContent = `${formatPrice(state.filters.minPrice)} - ${formatPrice(val)}`;
        state.page = 1;
        executeFilterPipeline();
      });
    }

    if (elements.priceMinInput) {
      elements.priceMinInput.addEventListener("change", e => {
        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
        state.filters.minPrice = val;
        if (elements.priceDisplayVal) elements.priceDisplayVal.textContent = `${formatPrice(val)} - ${formatPrice(state.filters.maxPrice)}`;
        state.page = 1;
        executeFilterPipeline();
      });
    }

    if (elements.priceMaxInput) {
      elements.priceMaxInput.addEventListener("change", e => {
        const val = Math.min(20000, parseInt(e.target.value, 10) || 20000);
        state.filters.maxPrice = val;
        if (elements.priceRangeSlider) elements.priceRangeSlider.value = val;
        if (elements.priceDisplayVal) elements.priceDisplayVal.textContent = `${formatPrice(state.filters.minPrice)} - ${formatPrice(val)}`;
        state.page = 1;
        executeFilterPipeline();
      });
    }

    // 3. Brand Checkboxes
    document.addEventListener("change", e => {
      if (e.target.classList.contains("brand-filter-checkbox")) {
        const brand = e.target.value;
        if (e.target.checked) {
          state.filters.brands.add(brand);
        } else {
          state.filters.brands.delete(brand);
        }
        // Sync desktop & mobile checkboxes
        document.querySelectorAll(`.brand-filter-checkbox[value="${brand}"]`).forEach(c => {
          c.checked = e.target.checked;
        });
        state.page = 1;
        executeFilterPipeline();
      }

      // Rating radios
      if (e.target.name === "filter-rating") {
        state.filters.minRating = parseFloat(e.target.value);
        state.page = 1;
        executeFilterPipeline();
      }

      // In-stock toggle
      if (e.target.id === "filter-in-stock" || e.target.id === "mobile-filter-in-stock") {
        state.filters.inStockOnly = e.target.checked;
        if (elements.inStockCheckbox) elements.inStockCheckbox.checked = e.target.checked;
        const mobileInStock = document.getElementById("mobile-filter-in-stock");
        if (mobileInStock) mobileInStock.checked = e.target.checked;
        state.page = 1;
        executeFilterPipeline();
      }
    });

    // 4. Sort Dropdown
    if (elements.sortDropdown) {
      elements.sortDropdown.addEventListener("change", e => {
        state.sortBy = e.target.value;
        state.page = 1;
        executeFilterPipeline();
      });
    }

    // 5. In-Shop Toolbar Search (Debounced with Request Cancellation)
    let shopSearchTimer = null;
    if (elements.toolbarSearchInput) {
      elements.toolbarSearchInput.addEventListener("input", e => {
        clearTimeout(shopSearchTimer);
        const query = e.target.value.trim();
        shopSearchTimer = setTimeout(() => {
          state.filters.searchQuery = query;
          state.page = 1;
          executeFilterPipeline();
        }, 220);
      });
    }

    // 6. Header Nav Search Sync
    if (elements.navSearchInput) {
      elements.navSearchInput.addEventListener("input", e => {
        clearTimeout(shopSearchTimer);
        const query = e.target.value.trim();
        shopSearchTimer = setTimeout(() => {
          state.filters.searchQuery = query;
          if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = query;
          state.page = 1;
          executeFilterPipeline();
        }, 220);
      });
      elements.navSearchInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(shopSearchTimer);
          state.filters.searchQuery = e.target.value.trim();
          if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = state.filters.searchQuery;
          if (elements.searchResultsDropdown) elements.searchResultsDropdown.classList.remove("active");
          state.page = 1;
          executeFilterPipeline();
        }
      });
    }

    // 7. Infinite Scroll is initialized via initInfiniteScroll() in initShop()

    // 8. Mobile Filter Drawer
    if (elements.mobileFilterBtn) {
      elements.mobileFilterBtn.addEventListener("click", () => {
        elements.mobileFilterDrawerOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
      });
    }

    function closeMobileFilterDrawer() {
      if (elements.mobileFilterDrawerOverlay) {
        elements.mobileFilterDrawerOverlay.classList.remove("active");
        document.body.style.overflow = "";
      }
    }

    if (elements.mobileFilterDrawerClose) elements.mobileFilterDrawerClose.addEventListener("click", closeMobileFilterDrawer);
    if (elements.mobileFilterApplyBtn) elements.mobileFilterApplyBtn.addEventListener("click", closeMobileFilterDrawer);
    if (elements.mobileFilterDrawerOverlay) {
      elements.mobileFilterDrawerOverlay.addEventListener("click", e => {
        if (e.target === elements.mobileFilterDrawerOverlay) closeMobileFilterDrawer();
      });
    }

    // 9. Cart Drawer
    elements.cartDrawerOpenBtns.forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        openCartDrawer();
      });
    });

    if (elements.cartDrawerCloseBtn) elements.cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
    if (elements.cartDrawerOverlay) {
      elements.cartDrawerOverlay.addEventListener("click", e => {
        if (e.target === elements.cartDrawerOverlay) closeCartDrawer();
      });
    }

    if (elements.checkoutBtn) {
      elements.checkoutBtn.addEventListener("click", () => {
        if (state.cart.length === 0) {
          showToast("Your cart is empty! Add items before checking out.", "error");
          return;
        }
        window.location.href = "checkout.html";
      });
    }

    // 10. Quick View Modal
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

    // 10b. BOGO Modal Triggers
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

    // 11. Mobile Header Hamburger
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

    // 12. Header Wishlist & Account feedback
    const headerWishlistBtn = document.querySelector(".wishlist-drawer-trigger");
    if (headerWishlistBtn) {
      headerWishlistBtn.addEventListener("click", e => {
        e.preventDefault();
        window.location.href = "wishlist.html";
      });
    }

    const accountBtns = document.querySelectorAll(".action-btn[title*='Account']");
    accountBtns.forEach(btn => {
      btn.addEventListener("click", e => {
        if (btn.closest('.nav-account-wrapper') && window.VeloraAuth && window.VeloraAuth.isLoggedIn()) {
          return; // Let the dropdown handle it
        }
        window.location.href = (window.VeloraAuth && window.VeloraAuth.isLoggedIn()) ? "account.html" : "login.html";
      });
    });

    // 13. Keyboard ESC
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeCartDrawer();
        closeQuickView();
        closeBogoModal();
        closeMobileDrawer();
        closeMobileFilterDrawer();
      }
    });

    // 14. Browser Back / Forward support (popstate)
    window.addEventListener("popstate", () => {
      parseURLParameters();
      renderCategoryFilters();
      executeFilterPipeline();
    });

    // 15. Cross-component Cart synchronization
    window.addEventListener("velora:cart-updated", () => {
      try {
        const stored = localStorage.getItem("velora_cart");
        state.cart = stored ? JSON.parse(stored) : [];
      } catch (err) {
        state.cart = [];
      }
      syncProductCartButtons();
    });

    window.addEventListener("storage", e => {
      if (e.key === "velora_cart") {
        try {
          state.cart = e.newValue ? JSON.parse(e.newValue) : [];
        } catch (err) {
          state.cart = [];
        }
        syncProductCartButtons();
      }
    });
  }
});

