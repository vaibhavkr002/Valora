/**
 * VELORA - Shop & Product Listing State Controller
 * Pure Vanilla JavaScript (ES6+)
 * Prepared for Supabase / REST API migration with modular fetch abstraction.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- Global Application State ---
  const state = {
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [],
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || ["prod-02", "prod-07"]),
    
    // Filter State
    filters: {
      category: "all",
      dealsOnly: false,
      minPrice: 0,
      maxPrice: 20000,
      brands: new Set(),
      minRating: 0,
      inStockOnly: false,
      searchQuery: ""
    },
    
    sortBy: "featured",
    page: 1,
    itemsPerPage: 8,
    totalFilteredProducts: []
  };

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

    // Pagination
    paginationWrapper: document.getElementById("pagination-wrapper"),
    btnLoadMore: document.getElementById("btn-load-more"),
    paginationProgressFill: document.getElementById("pagination-progress-fill"),
    paginationProgressText: document.getElementById("pagination-progress-text"),

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
    
    // Initial fetch and render
    executeFilterPipeline();

    // Re-render and filter with live Supabase products
    if (window.syncProductsFromSupabase) {
      try {
        await window.syncProductsFromSupabase();
        renderCategoryFilters();
        renderBrandCheckboxes();
        executeFilterPipeline();
        updateBadges();
      } catch (err) {
        console.warn("Live shop catalog sync note:", err);
      }
    }

    if (window.syncStoreSettings) {
      window.syncStoreSettings().then(() => applyStoreSettings());
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

    if (categoryParam) {
      const lower = categoryParam.toLowerCase();
      if (lower === "deals" || lower === "flash-deals") {
        state.filters.dealsOnly = true;
      } else {
        state.filters.category = lower;
      }
    }
    if (dealsParam === "true" || dealsParam === "1") {
      state.filters.dealsOnly = true;
    }
    if (searchParam) {
      state.filters.searchQuery = searchParam.trim();
      if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = searchParam;
      if (elements.navSearchInput) elements.navSearchInput.value = searchParam;
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
    if (state.filters.dealsOnly) {
      if (elements.breadcrumbCategory) elements.breadcrumbCategory.textContent = "Flash Deals";
      if (elements.shopPageTitle) elements.shopPageTitle.textContent = "Flash Deals & Promotions";
      if (elements.shopPageSubtitle) elements.shopPageSubtitle.textContent = "Exclusive limited-time promotional pricing and curated seasonal discounts.";
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

    const brands = window.getAvailableBrands();
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
    if (!isLoadMore) {
      renderSkeletons();
    }

    // Simulate fast async fetch
    setTimeout(() => {
      let filtered = [...window.PRODUCTS_DATA];

      // 1. Category Filter
      if (state.filters.category && state.filters.category !== "all") {
        filtered = filtered.filter(p => p.category === state.filters.category || p.category_id === state.filters.category);
      }

      // 1b. Flash Deals Filter
      if (state.filters.dealsOnly) {
        filtered = filtered.filter(p => p.isDeal === true);
      }

      // 2. Price Range Filter
      filtered = filtered.filter(p => 
        p.price >= state.filters.minPrice && p.price <= state.filters.maxPrice
      );

      // 3. Brands Filter
      if (state.filters.brands.size > 0) {
        filtered = filtered.filter(p => state.filters.brands.has(p.brand));
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
        const q = state.filters.searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
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
  // RENDER PRODUCTS VIEW
  // ==========================================================================
  function renderProductsView() {
    if (!elements.productsGrid) return;

    if (state.totalFilteredProducts.length === 0) {
      elements.productsGrid.innerHTML = `
        <div class="shop-empty-state">
          <div class="empty-state-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h3 class="empty-state-title">No Matching Products Found</h3>
          <p class="empty-state-desc">
            We couldn't find any products matching your selected combination of filters. Try broadening your criteria or reset all filters.
          </p>
          <button class="btn-primary clear-all-filters-action">
            Clear All Filters
          </button>
        </div>
      `;
      if (elements.paginationWrapper) elements.paginationWrapper.style.display = "none";
      return;
    }

    const visibleItemsCount = state.page * state.itemsPerPage;
    const paginatedItems = state.totalFilteredProducts.slice(0, visibleItemsCount);

    elements.productsGrid.innerHTML = paginatedItems.map(product => {
      const isWishlisted = state.wishlist.has(product.id);
      const isInCart = state.cart.some(item => item.id === product.id);
      const badgeClass = `badge-${product.badgeType || 'popular'}`;

      return `
        <div class="product-card" data-product-id="${product.id}">
          <div class="product-card-media">
            ${product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : ""}
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${product.id}" aria-label="Add to Wishlist">
              ${icons.heart}
            </button>
            <img class="product-card-img" src="${product.image}" alt="${product.name}" loading="lazy">
            ${product.secondaryImage ? `<img class="product-secondary-img" src="${product.secondaryImage}" alt="${product.name} alternate view" loading="lazy">` : ""}
            <button class="quick-view-overlay-btn" data-quickview-id="${product.id}">
              ${icons.eye} Quick View
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-card-brand">${product.brand || 'VELORA'}</div>
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

            <button class="btn-add-to-cart ${isInCart ? 'added' : ''}" data-cart-id="${product.id}">
              ${isInCart ? `${icons.check} In Cart` : `${icons.cart} Add to Cart`}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Update Pagination / Load More
    if (elements.paginationWrapper) {
      if (visibleItemsCount >= state.totalFilteredProducts.length) {
        elements.paginationWrapper.style.display = "none";
      } else {
        elements.paginationWrapper.style.display = "flex";
        const pct = Math.min(100, (visibleItemsCount / state.totalFilteredProducts.length) * 100);
        if (elements.paginationProgressFill) elements.paginationProgressFill.style.width = `${pct}%`;
        if (elements.paginationProgressText) {
          elements.paginationProgressText.textContent = `Showing ${visibleItemsCount} of ${state.totalFilteredProducts.length} products`;
        }
      }
    }
  }

  // ==========================================================================
  // ACTIVE FILTER CHIPS / DISMISSALS
  // ==========================================================================
  function renderActiveFilterChips() {
    if (!elements.activeFiltersContainer) return;

    const chips = [];

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
    state.filters.dealsOnly = false;
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

    // Update button states
    document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${productId}"]`).forEach(btn => {
      btn.classList.add("added");
      btn.innerHTML = `${icons.check} In Cart`;
    });
  }

  function updateCartQuantity(index, delta) {
    if (!state.cart[index]) return;
    state.cart[index].quantity += delta;

    if (state.cart[index].quantity <= 0) {
      const removed = state.cart.splice(index, 1)[0];
      showToast(`Removed "${removed.name}" from cart`, "info");
      document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${removed.id}"]`).forEach(btn => {
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
    const removed = state.cart.splice(index, 1)[0];
    saveCart();
    updateBadges();
    renderCartDrawer();
    showToast(`Removed "${removed.name}" from cart`, "info");

    document.querySelectorAll(`.btn-add-to-cart[data-cart-id="${removed.id}"]`).forEach(btn => {
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
      elements.freeShippingMsg.innerHTML = `Add <strong>${formatPrice(freeShippingThreshold)}</strong> more for Free Delivery!`;
      const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
      if (advanceBreakdownBox) advanceBreakdownBox.style.display = "none";
      return;
    }

    elements.cartItemsContainer.style.display = "flex";
    elements.cartEmptyState.style.display = "none";

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const freeShippingThreshold = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.shipping && Number(window.VELORA_SETTINGS.shipping.free_shipping_threshold)) || 999;
    const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

    elements.freeShippingFill.style.width = `${progress}%`;
    if (subtotal >= freeShippingThreshold) {
      elements.freeShippingMsg.innerHTML = `🎉 You unlocked <strong>FREE Express Delivery</strong>!`;
    } else {
      const rem = Math.max(0, freeShippingThreshold - subtotal);
      elements.freeShippingMsg.innerHTML = `Add <strong>${formatPrice(rem)}</strong> more for Free Delivery!`;
    }

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
  // BIND ALL EVENT LISTENERS
  // ==========================================================================
  function bindEvents() {
    // 1. Delegated Product Card Actions
    document.addEventListener("click", e => {
      // Add to Cart
      const addCartBtn = e.target.closest(".btn-add-to-cart");
      if (addCartBtn) {
        addToCart(addCartBtn.dataset.cartId);
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
        const idx = parseInt(qtyBtn.dataset.cartIdx, 10);
        const delta = parseInt(qtyBtn.dataset.cartDelta, 10);
        updateCartQuantity(idx, delta);
        return;
      }

      // Cart Drawer remove
      const removeBtn = e.target.closest(".cart-item-remove");
      if (removeBtn) {
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

    // 5. In-Shop Toolbar Search
    if (elements.toolbarSearchInput) {
      elements.toolbarSearchInput.addEventListener("input", e => {
        state.filters.searchQuery = e.target.value.trim();
        state.page = 1;
        executeFilterPipeline();
      });
    }

    // 6. Header Nav Search Sync
    if (elements.navSearchInput) {
      elements.navSearchInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
          state.filters.searchQuery = e.target.value.trim();
          if (elements.toolbarSearchInput) elements.toolbarSearchInput.value = state.filters.searchQuery;
          state.page = 1;
          executeFilterPipeline();
        }
      });
    }

    // 7. Load More Products Button
    if (elements.btnLoadMore) {
      elements.btnLoadMore.addEventListener("click", () => {
        elements.btnLoadMore.classList.add("loading");
        elements.btnLoadMore.innerHTML = `${icons.spin} Loading...`;
        setTimeout(() => {
          state.page += 1;
          renderProductsView();
          updateToolbarCounters();
          elements.btnLoadMore.classList.remove("loading");
          elements.btnLoadMore.innerHTML = `Load More Products (${state.totalFilteredProducts.length - state.page * state.itemsPerPage} remaining)`;
        }, 350);
      });
    }

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
  }
});

