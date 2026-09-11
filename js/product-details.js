/**
 * VELORA - Dedicated Product Details Page Controller
 * Pure Vanilla JavaScript (ES6+)
 * Handles dynamic product routing via URL query, image gallery swapping,
 * option selection, tabs, related items, and shared localStorage cart/wishlist.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- Global State ---
  const state = {
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [],
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || ["prod-02", "prod-07"]),
    currentProduct: null,
    selectedSize: null,
    selectedColor: null,
    quantity: 1,
    currentImageIndex: 0,
    galleryImages: []
  };

  // --- SVG Icons Helpers ---
  const icons = {
    star: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    heart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    cart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
  };

  // --- DOM Elements ---
  const elements = {
    // Views
    mainView: document.getElementById("product-main-view"),
    notFoundView: document.getElementById("product-not-found-view"),

    // Breadcrumbs
    breadcrumbCategoryLink: document.getElementById("breadcrumb-category-link"),
    breadcrumbProductTitle: document.getElementById("breadcrumb-product-title"),

    // Gallery
    mainImage: document.getElementById("product-main-img"),
    galleryBadge: document.getElementById("gallery-badge"),
    thumbnailsStrip: document.getElementById("thumbnails-strip"),

    // Product Info
    brandBadge: document.getElementById("detail-brand-badge"),
    title: document.getElementById("detail-title"),
    ratingScore: document.getElementById("detail-rating-score"),
    reviewsCount: document.getElementById("detail-reviews-count"),
    currentPrice: document.getElementById("detail-current-price"),
    originalPrice: document.getElementById("detail-original-price"),
    discountPill: document.getElementById("detail-discount-pill"),
    stockBadge: document.getElementById("detail-stock-badge"),
    descParagraph: document.getElementById("detail-desc-paragraph"),
    advanceBox: document.getElementById("detail-advance-box"),
    advanceHeadline: document.getElementById("detail-advance-headline"),
    advanceExplainer: document.getElementById("detail-advance-explainer"),

    // Selectors
    sizesContainer: document.getElementById("detail-sizes-container"),
    colorsContainer: document.getElementById("detail-colors-container"),
    selectedSizeLabel: document.getElementById("selected-size-label"),
    selectedColorLabel: document.getElementById("selected-color-label"),
    
    // Quantity & Actions
    qtyValInput: document.getElementById("detail-qty-val"),
    qtyMinusBtn: document.getElementById("detail-qty-minus"),
    qtyPlusBtn: document.getElementById("detail-qty-plus"),
    addCartBtn: document.getElementById("btn-detail-add-cart"),
    buyNowBtn: document.getElementById("btn-detail-buy-now"),
    wishlistBtn: document.getElementById("btn-detail-wishlist"),

    // Tabs
    tabNavBtns: document.querySelectorAll(".tab-nav-btn"),
    tabPanels: document.querySelectorAll(".tab-content-panel"),
    specsTableBody: document.getElementById("specs-table-body"),
    overviewFeaturesList: document.getElementById("overview-features-list"),

    // Related Products
    relatedGrid: document.getElementById("related-products-grid"),

    // Header & Badges
    cartCountBadges: document.querySelectorAll(".cart-count-badge"),
    wishlistCountBadges: document.querySelectorAll(".wishlist-count-badge"),
    navSearchInput: document.getElementById("nav-search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    searchResultsDropdown: document.getElementById("search-results-dropdown"),
    mobileToggleBtn: document.getElementById("mobile-toggle-btn"),
    mobileDrawer: document.getElementById("mobile-drawer"),
    mobileDrawerCloseBtn: document.getElementById("mobile-drawer-close"),
    mobileDrawerBackdrop: document.getElementById("mobile-drawer-backdrop"),

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

    // Toast Container
    toastContainer: document.getElementById("toast-container")
  };

  // --- Initialize Page ---
  initProductDetails();

  async function initProductDetails() {
    updateBadges();
    renderCartDrawer();
    bindCommonEvents();

    // 1. Parse Product ID from URL (?id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (!productId) {
      showNotFoundState();
      return;
    }

    // 2. Ensure global catalog is synced from Supabase for related products & recommendations
    if (window.syncProductsFromSupabase) {
      try {
        await window.syncProductsFromSupabase();
      } catch (e) {
        console.warn("Catalog sync note:", e);
      }
    }

    // 3. Fetch Target Product from Supabase or Static Data
    let product = null;
    const client = window.supabaseClient || 
                   (typeof window.getSupabase === "function" ? window.getSupabase() : null) || 
                   (window.VeloraAuth ? window.VeloraAuth.getClient() : null);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
    const fallbackStatic = (window.getProductById ? window.getProductById(productId) : null) ||
                           (window.PRODUCTS_DATA ? window.PRODUCTS_DATA.find(p => p.id === productId || p.slug === productId) : null);

    let dbP = null;

    if (client) {
      try {
        let query = client.from("products").select("*, categories(id, name, slug)");
        if (isUUID) {
          query = query.eq("id", productId);
        } else if (fallbackStatic && fallbackStatic.name) {
          query = query.ilike("name", fallbackStatic.name);
        } else {
          query = query.eq("slug", productId);
        }

        const res = await query.maybeSingle();
        if (res && !res.error && res.data) {
          dbP = res.data;
        }
      } catch (err) {
        console.warn("Client query notice:", err);
      }
    }

    // Direct REST fetch fallback if client didn't return data
    if (!dbP && typeof fetch !== "undefined") {
      try {
        const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
        let restUrl = '';
        if (isUUID) {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=*,categories(id,name,slug)&id=eq.${productId}`;
        } else if (fallbackStatic && fallbackStatic.name) {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=*,categories(id,name,slug)&name=ilike.${encodeURIComponent(fallbackStatic.name)}`;
        } else {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=*,categories(id,name,slug)&slug=eq.${encodeURIComponent(productId)}`;
        }

        const r = await fetch(restUrl, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (r.ok) {
          const list = await r.json();
          if (list && list.length > 0) {
            dbP = list[0];
          }
        }
      } catch (e) {
        console.warn("REST fallback notice:", e);
      }
    }

    if (dbP) {
      const imgs = (dbP.images && Array.isArray(dbP.images) && dbP.images.length > 0) 
        ? dbP.images 
        : (fallbackStatic && fallbackStatic.image ? [fallbackStatic.image] : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80"]);
      
      const categorySlug = dbP.categories?.slug || (fallbackStatic ? fallbackStatic.category : "shoes");
      const categoryLabel = dbP.categories?.name || (fallbackStatic ? fallbackStatic.categoryLabel : "Shoes & Footwear");

      product = {
        id: dbP.id,
        legacyId: productId,
        name: dbP.name,
        brand: dbP.brand || (fallbackStatic ? fallbackStatic.brand : "VELORA Atelier"),
        slug: dbP.slug,
        category: categorySlug,
        categoryLabel: categoryLabel,
        category_id: dbP.category_id,
        price: Number(dbP.price),
        originalPrice: dbP.original_price ? Number(dbP.original_price) : (fallbackStatic ? fallbackStatic.originalPrice : null),
        discount: dbP.discount_percentage || 0,
        rating: Number(dbP.rating) || (fallbackStatic ? fallbackStatic.rating : 4.9),
        reviewsCount: dbP.review_count || (fallbackStatic ? fallbackStatic.reviewsCount : 18),
        badge: dbP.is_new ? "New Arrival" : (dbP.is_deal ? "Special Deal" : (dbP.is_featured ? "Featured" : null)),
        badgeType: dbP.is_deal ? "deal" : "popular",
        inStock: dbP.stock > 0,
        stockCount: dbP.stock,
        image: imgs[0],
        secondaryImage: imgs[1] || imgs[0],
        galleryImages: imgs,
        images: imgs,
        description: dbP.description || (fallbackStatic ? fallbackStatic.description : "Crafted with impeccable attention to detail, premium materials, and timeless elegance."),
        sizes: (dbP.sizes && Array.isArray(dbP.sizes) && dbP.sizes.length > 0) ? dbP.sizes : (fallbackStatic ? fallbackStatic.sizes : ["Standard"]),
        colors: (dbP.colors && Array.isArray(dbP.colors) && dbP.colors.length > 0) ? dbP.colors : (fallbackStatic ? fallbackStatic.colors : ["Default"]),
        advance_payment_enabled: Boolean(dbP.advance_payment_enabled),
        advance_payment_type: dbP.advance_payment_type || "fixed",
        advance_payment_value: Number(dbP.advance_payment_value) || 0
      };
    }

    if (!product && fallbackStatic) {
      product = { ...fallbackStatic };
    }

    if (!product) {
      showNotFoundState();
      return;
    }

    state.currentProduct = product;
    renderProductPage(product);
  }

  function updateAdvanceNotice() {
    if (!elements.advanceBox) return;
    const p = state.currentProduct;
    const isAdv = Boolean(p && p.advance_payment_enabled);
    const advVal = Number(p ? p.advance_payment_value : 0);

    // If disabled or missing or zero or negative -> do NOT show advance block
    if (!isAdv || isNaN(advVal) || advVal <= 0) {
      elements.advanceBox.style.display = "none";
      return;
    }

    const qty = state.quantity || 1;
    const unitPrice = Number(p.price) || 0;
    const totalPrice = unitPrice * qty;

    let unitAdvance = 0;
    if (p.advance_payment_type === "percentage") {
      unitAdvance = Math.round(unitPrice * (advVal / 100));
    } else {
      unitAdvance = Math.min(unitPrice, advVal);
    }

    if (unitAdvance <= 0) {
      elements.advanceBox.style.display = "none";
      return;
    }

    const totalAdvance = unitAdvance * qty;
    const totalCod = Math.max(0, totalPrice - totalAdvance);

    // Exact user requirement format:
    // e.g. "₹300 Advance Payment Required"
    // and "Pay ₹300 now • Remaining ₹4,700 via COD"
    if (elements.advanceHeadline) {
      elements.advanceHeadline.textContent = `${formatPrice(totalAdvance)} Advance Payment Required`;
    }
    if (elements.advanceExplainer) {
      elements.advanceExplainer.textContent = `Pay ${formatPrice(totalAdvance)} now • Remaining ${formatPrice(totalCod)} via COD`;
    }
    elements.advanceBox.style.display = "block";
  }

  // ==========================================================================
  // NOT FOUND STATE
  // ==========================================================================
  function showNotFoundState() {
    if (elements.mainView) elements.mainView.style.display = "none";
    if (elements.notFoundView) elements.notFoundView.style.display = "flex";
    document.title = "Product Not Found | VELORA";
    if (elements.breadcrumbProductTitle) elements.breadcrumbProductTitle.textContent = "Product Not Found";
  }

  // ==========================================================================
  // RENDER PRODUCT DETAILS
  // ==========================================================================
  function renderProductPage(product) {
    if (elements.mainView) elements.mainView.style.display = "block";
    if (elements.notFoundView) elements.notFoundView.style.display = "none";

    // Set page title
    document.title = `${product.name} | VELORA Lifestyle`;

    // 1. Breadcrumbs
    const catName = product.categoryLabel || (product.category.charAt(0).toUpperCase() + product.category.slice(1));
    if (elements.breadcrumbCategoryLink) {
      elements.breadcrumbCategoryLink.textContent = catName;
      elements.breadcrumbCategoryLink.href = `shop.html?category=${product.category}`;
    }
    if (elements.breadcrumbProductTitle) {
      elements.breadcrumbProductTitle.textContent = product.name;
    }

    // 2. Main Details
    if (elements.brandBadge) elements.brandBadge.textContent = product.brand || "VELORA Atelier";
    if (elements.title) elements.title.textContent = product.name;
    if (elements.ratingScore) elements.ratingScore.textContent = product.rating;
    if (elements.reviewsCount) elements.reviewsCount.textContent = `(${product.reviewsCount} customer reviews)`;
    if (elements.currentPrice) elements.currentPrice.textContent = formatPrice(product.price);

    if (product.originalPrice) {
      if (elements.originalPrice) {
        elements.originalPrice.textContent = formatPrice(product.originalPrice);
        elements.originalPrice.style.display = "inline";
      }
      if (elements.discountPill) {
        elements.discountPill.textContent = `-${product.discount || 20}% OFF`;
        elements.discountPill.style.display = "inline";
      }
    } else {
      if (elements.originalPrice) elements.originalPrice.style.display = "none";
      if (elements.discountPill) elements.discountPill.style.display = "none";
    }

    // Stock Status
    if (elements.stockBadge) {
      if (product.inStock !== false && product.stockCount > 0) {
        elements.stockBadge.className = "detail-stock-badge in-stock";
        elements.stockBadge.innerHTML = `<span>✓</span> In Stock (${product.stockCount} units available)`;
      } else {
        elements.stockBadge.className = "detail-stock-badge out-of-stock";
        elements.stockBadge.innerHTML = `<span>✕</span> Currently Out of Stock`;
        if (elements.addCartBtn) elements.addCartBtn.disabled = true;
        if (elements.buyNowBtn) elements.buyNowBtn.disabled = true;
      }
    }

    if (elements.descParagraph) elements.descParagraph.textContent = product.description;

    // Advance Payment Banner
    updateAdvanceNotice();

    // 3. Image Gallery Setup
    state.galleryImages = window.getProductGallery(product);
    renderGallery();

    // 4. Badges
    if (elements.galleryBadge) {
      if (product.badge) {
        elements.galleryBadge.textContent = product.badge;
        elements.galleryBadge.className = `gallery-badge product-badge badge-${product.badgeType || 'popular'}`;
        elements.galleryBadge.style.display = "block";
      } else {
        elements.galleryBadge.style.display = "none";
      }
    }

    // 5. Option Selectors (Sizes & Colors)
    renderOptions(product);

    // 6. Wishlist Button State
    updateWishlistButton();

    // 7. Specifications & Overview Features
    renderTabsContent(product);

    // 8. Related Products
    renderRelatedProducts(product);
  }

  // ==========================================================================
  // GALLERY RENDERER & INTERACTION
  // ==========================================================================
  function renderGallery() {
    if (!elements.mainImage || state.galleryImages.length === 0) return;

    // Initial main image
    elements.mainImage.src = state.galleryImages[0];
    elements.mainImage.alt = state.currentProduct.name;

    // Render clickable thumbnails
    if (elements.thumbnailsStrip) {
      elements.thumbnailsStrip.innerHTML = state.galleryImages.map((imgUrl, idx) => `
        <div class="thumb-item ${idx === 0 ? 'active' : ''}" data-thumb-idx="${idx}">
          <img src="${imgUrl}" alt="${state.currentProduct.name} angle ${idx + 1}" loading="lazy">
        </div>
      `).join("");
    }
  }

  function switchMainImage(index) {
    if (!elements.mainImage || !state.galleryImages[index]) return;

    state.currentImageIndex = index;
    elements.mainImage.classList.add("fade-out");

    setTimeout(() => {
      elements.mainImage.src = state.galleryImages[index];
      elements.mainImage.classList.remove("fade-out");
    }, 150);

    // Update active thumb styling
    document.querySelectorAll(".thumb-item").forEach((thumb, idx) => {
      thumb.classList.toggle("active", idx === index);
    });
  }

  // ==========================================================================
  // OPTIONS SELECTOR (Sizes & Colors)
  // ==========================================================================
  function renderOptions(product) {
    // Sizes
    if (product.sizes && product.sizes.length > 0) {
      state.selectedSize = product.sizes[0];
      if (elements.selectedSizeLabel) elements.selectedSizeLabel.textContent = state.selectedSize;

      elements.sizesContainer.innerHTML = product.sizes.map((size, idx) => `
        <button class="detail-size-pill ${idx === 0 ? 'active' : ''}" data-size-val="${size}">
          ${size}
        </button>
      `).join("");
    } else {
      state.selectedSize = "Standard";
      if (elements.sizesContainer) elements.sizesContainer.parentElement.style.display = "none";
    }

    // Colors
    if (product.colors && product.colors.length > 0) {
      state.selectedColor = product.colors[0];
      if (elements.selectedColorLabel) elements.selectedColorLabel.textContent = state.selectedColor;

      const colorMap = {
        "Crimson Red": "#dc2626",
        "Obsidian Black": "#111827",
        "Pure White": "#ffffff",
        "Desert Khaki": "#c2b280",
        "Midnight Navy": "#1e3a8a",
        "Washed Olive": "#556b2f",
        "Espresso Brown": "#4a2c2a",
        "Cognac Tan": "#9a3412",
        "Pitch Black": "#000000",
        "Camel Sand": "#c19a6b",
        "Charcoal Gray": "#374151",
        "Gold & Dark Olive": "#d97706",
        "Matte Black": "#1f2937",
        "Pristine White": "#ffffff",
        "Washed Sage": "#84a98c",
        "Oatmeal Melange": "#e5e0d8",
        "Stealth Black": "#0f172a",
        "Snuff Suede Brown": "#854d0e",
        "All-Black Tactical": "#18181b",
        "Saddle Brown": "#78350f",
        "Whiskey Tan": "#b45309",
        "Silver Slate": "#94a3b8",
        "Brushed Silver": "#cbd5e1"
      };

      elements.colorsContainer.innerHTML = product.colors.map((color, idx) => {
        const bg = colorMap[color] || "#475569";
        return `
          <button class="detail-color-pill ${idx === 0 ? 'active' : ''}" data-color-val="${color}">
            <span class="detail-color-dot" style="background: ${bg};"></span>
            <span>${color}</span>
          </button>
        `;
      }).join("");
    } else {
      state.selectedColor = "Default";
      if (elements.colorsContainer) elements.colorsContainer.parentElement.style.display = "none";
    }
  }

  // ==========================================================================
  // TABS & SPECIFICATIONS
  // ==========================================================================
  function renderTabsContent(product) {
    // Features list
    if (elements.overviewFeaturesList && product.features) {
      elements.overviewFeaturesList.innerHTML = product.features.map(f => `
        <div class="feature-item">
          <div class="feature-check-icon">✓</div>
          <span>${f}</span>
        </div>
      `).join("");
    }

    // Specifications Table
    if (elements.specsTableBody) {
      const specs = [
        { key: "SKU / Model", val: `VEL-${product.id.toUpperCase()}` },
        { key: "Brand & Studio", val: product.brand || "VELORA Atelier" },
        { key: "Category", val: product.categoryLabel || product.category },
        { key: "Primary Material", val: "100% Verified Full-Grain / Technical Composite" },
        { key: "Fit & Sizing", val: "True to Standard Ergonomic Specifications" },
        { key: "Country of Origin", val: "Designed in NYC • Artisan Handcrafted in Portugal" },
        { key: "Warranty Protection", val: "2-Year Comprehensive Limited Warranty" },
        { key: "Care Instructions", val: "Wipe with soft damp cloth. Keep away from direct excessive heat." }
      ];

      elements.specsTableBody.innerHTML = specs.map(s => `
        <tr>
          <th>${s.key}</th>
          <td>${s.val}</td>
        </tr>
      `).join("");
    }

    // Load live approved customer reviews from Supabase
    loadProductReviews(product.id);
  }

  // ==========================================================================
  // CUSTOMER REVIEWS SYSTEM (Connected to Supabase public.reviews)
  // ==========================================================================
  async function loadProductReviews(productId) {
    const container = document.getElementById("product-reviews-container");
    const countBadge = document.getElementById("tab-reviews-count");
    if (!container) return;

    const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/reviews?product_id=eq.${productId}&status=eq.approved&order=created_at.desc`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (res.ok) {
        const reviews = await res.json();
        if (countBadge) countBadge.textContent = reviews.length;
        if (elements.reviewsCount && reviews.length > 0) {
          elements.reviewsCount.textContent = `(${reviews.length})`;
        }

        if (reviews.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; border: 1px dashed var(--border-color); border-radius: 12px; background: rgba(0,0,0,0.01);">
              <div style="font-size: 2rem; margin-bottom: 8px;">✍️</div>
              <h4 style="font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No reviews yet</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Be the first to share your thoughts about this item.</p>
              <button onclick="document.getElementById('btn-toggle-review-form')?.click();" class="btn-primary" style="display: inline-block; padding: 6px 14px; font-size: 0.82rem;">Write the First Review</button>
            </div>
          `;
          return;
        }

        container.innerHTML = reviews.map(r => {
          const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
          const dateStr = new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
          return `
            <div style="padding: 16px 0; border-bottom: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="font-size: 0.95rem; color: var(--text-main);">${r.user_name}</strong>
                  <span style="font-size: 0.72rem; color: var(--color-success); background: rgba(34, 197, 94, 0.1); padding: 1px 6px; border-radius: 4px; font-weight: 600;">✓ Verified Buyer</span>
                </div>
                <span style="font-size: 0.78rem; color: var(--text-muted);">${dateStr}</span>
              </div>
              <div style="color: #f59e0b; font-size: 0.95rem; margin-bottom: 6px;">${stars}</div>
              <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.6; margin: 0;">${r.comment}</p>
            </div>
          `;
        }).join("");
      }
    } catch (err) {
      console.warn("Reviews load notice:", err);
    }
  }

  function setupReviewsHandlers() {
    const toggleBtn = document.getElementById("btn-toggle-review-form");
    const cancelBtn = document.getElementById("btn-cancel-review");
    const box = document.getElementById("review-submission-box");
    const form = document.getElementById("product-review-form");

    if (toggleBtn && box) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = box.style.display === "none";
        box.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          const nameInput = document.getElementById("review-user-name");
          const user = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
          if (nameInput && user && (user.user_metadata?.full_name || user.email)) {
            nameInput.value = user.user_metadata?.full_name || user.email.split('@')[0];
          }
        }
      });
    }

    if (cancelBtn && box) {
      cancelBtn.addEventListener("click", () => {
        box.style.display = "none";
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!state.currentProduct) return;

        const name = document.getElementById("review-user-name").value.trim();
        const rating = parseInt(document.getElementById("review-rating").value, 10);
        const comment = document.getElementById("review-comment").value.trim();

        if (!name || !comment) {
          showToast("Please fill in your name and comments.", "info");
          return;
        }

        const submitBtn = document.getElementById("btn-submit-review");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Publishing...";
        }

        const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
        const user = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;

        try {
          if (client) {
            const { error } = await client.from("reviews").insert([{
              product_id: state.currentProduct.id,
              user_id: user ? user.id : null,
              user_name: name,
              rating: rating,
              comment: comment,
              status: "approved"
            }]);

            if (error) {
              showToast("Could not submit review: " + error.message, "info");
            } else {
              showToast("Review submitted successfully! Thank you for your feedback.", "success");
              form.reset();
              if (box) box.style.display = "none";
              loadProductReviews(state.currentProduct.id);
            }
          }
        } catch (err) {
          showToast("Network error submitting review.", "info");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Review";
          }
        }
      });
    }
  }

  // ==========================================================================
  // RELATED PRODUCTS
  // ==========================================================================
  function renderRelatedProducts(product) {
    if (!elements.relatedGrid || !window.getRelatedProducts) return;

    const related = window.getRelatedProducts(product.id, 4);

    elements.relatedGrid.innerHTML = related.map(item => {
      const isWishlisted = state.wishlist.has(item.id);
      const isInCart = state.cart.some(c => c.id === item.id);
      const badgeClass = `badge-${item.badgeType || 'popular'}`;

      return `
        <div class="product-card" data-product-id="${item.id}">
          <div class="product-card-media">
            ${item.badge ? `<span class="product-badge ${badgeClass}">${item.badge}</span>` : ""}
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${item.id}" aria-label="Add to Wishlist">
              ${icons.heart}
            </button>
            <img class="product-card-img" src="${item.image}" alt="${item.name}" loading="lazy">
            ${item.secondaryImage ? `<img class="product-secondary-img" src="${item.secondaryImage}" alt="${item.name}" loading="lazy">` : ""}
            <button class="quick-view-overlay-btn" data-quickview-id="${item.id}">
              ${icons.eye} Quick View
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-card-brand">${item.brand || 'VELORA'}</div>
            <h4 class="product-card-name" title="${item.name}">
              <a href="product.html?id=${item.id}">${item.name}</a>
            </h4>

            <div class="product-card-rating">
              <span class="stars-list">${icons.star}</span>
              <span class="stars-score">${item.rating}</span>
              <span class="reviews-count">(${item.reviewsCount})</span>
            </div>

            <div class="product-card-price-row">
              <span class="price-current">${formatPrice(item.price)}</span>
              ${item.originalPrice ? `<span class="price-original">${formatPrice(item.originalPrice)}</span>` : ""}
              ${item.discount ? `<span class="price-discount-pill">-${item.discount}%</span>` : ""}
            </div>

            <button class="btn-add-to-cart ${isInCart ? 'added' : ''}" data-cart-id="${item.id}">
              ${isInCart ? `${icons.check} In Cart` : `${icons.cart} Add to Cart`}
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // CART OPERATIONS & DRAWER
  // ==========================================================================
  function addToCart(productId, size, color, qty = 1) {
    const product = (state.currentProduct && state.currentProduct.id === productId)
      ? state.currentProduct
      : (window.getProductById(productId) || state.currentProduct);
    if (!product) return;

    const existingIndex = state.cart.findIndex(item => 
      item.id === product.id && item.size === size && item.color === color
    );

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
      state.cart[existingIndex].quantity += qty;
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
        size: size || "Standard",
        color: color || "Default",
        quantity: qty,
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
    showToast(`Added ${qty}x "${product.name}" to cart!`, "success");

    // Animate Add to Cart button
    if (elements.addCartBtn) {
      elements.addCartBtn.classList.add("added");
      elements.addCartBtn.innerHTML = `${icons.check} Added to Cart!`;
      setTimeout(() => {
        elements.addCartBtn.classList.remove("added");
        elements.addCartBtn.innerHTML = `${icons.cart} Add to Cart`;
      }, 2500);
    }
  }

  function updateCartQuantity(index, delta) {
    if (!state.cart[index]) return;
    state.cart[index].quantity += delta;

    if (state.cart[index].quantity <= 0) {
      const removed = state.cart.splice(index, 1)[0];
      showToast(`Removed "${removed.name}" from cart`, "info");
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
      elements.freeShippingFill.style.width = "0%";
      elements.freeShippingMsg.innerHTML = `Add <strong>${formatPrice(999)}</strong> more for Free Delivery!`;
      const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
      if (advanceBreakdownBox) advanceBreakdownBox.style.display = "none";
      return;
    }

    elements.cartItemsContainer.style.display = "flex";
    elements.cartEmptyState.style.display = "none";

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const freeShippingThreshold = 999;
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
    const codBalanceElem = document.getElementById("cart-cod-payable") || document.getElementById("cart-cod-balance");

    if (advanceBreakdownBox) {
      if (totalAdvance > 0) {
        advanceBreakdownBox.style.display = "block";
        if (advancePayableElem) advancePayableElem.textContent = formatPrice(totalAdvance);
        if (codBalanceElem) codBalanceElem.textContent = formatPrice(totalCod);
      } else {
        advanceBreakdownBox.style.display = "none";
      }
    }

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
            <button class="cart-item-remove" data-cart-remove="${index}">
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
    const product = window.getProductById(productId) || state.currentProduct;
    if (!product) return;

    if (state.wishlist.has(product.id)) {
      state.wishlist.delete(product.id);
      showToast(`Removed "${product.name}" from wishlist`, "info");
    } else {
      state.wishlist.add(product.id);
      showToast(`Added "${product.name}" to wishlist!`, "success");
    }

    localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlist)));
    updateBadges();
    updateWishlistButton();

    document.querySelectorAll(`.wishlist-btn[data-wishlist-id="${product.id}"]`).forEach(btn => {
      btn.classList.toggle("active", state.wishlist.has(product.id));
    });
  }

  function updateWishlistButton() {
    if (!elements.wishlistBtn || !state.currentProduct) return;
    const isSaved = state.wishlist.has(state.currentProduct.id);
    elements.wishlistBtn.classList.toggle("active", isSaved);
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
  // EVENT LISTENERS
  // ==========================================================================
  function bindCommonEvents() {
    // 1. Thumbnail click
    document.addEventListener("click", e => {
      const thumb = e.target.closest(".thumb-item");
      if (thumb) {
        const idx = parseInt(thumb.dataset.thumbIdx, 10);
        switchMainImage(idx);
        return;
      }

      // Size Pill selection
      const sizePill = e.target.closest(".detail-size-pill");
      if (sizePill) {
        document.querySelectorAll(".detail-size-pill").forEach(p => p.classList.remove("active"));
        sizePill.classList.add("active");
        state.selectedSize = sizePill.dataset.sizeVal;
        if (elements.selectedSizeLabel) elements.selectedSizeLabel.textContent = state.selectedSize;
        return;
      }

      // Color Pill selection
      const colorPill = e.target.closest(".detail-color-pill");
      if (colorPill) {
        document.querySelectorAll(".detail-color-pill").forEach(p => p.classList.remove("active"));
        colorPill.classList.add("active");
        state.selectedColor = colorPill.dataset.colorVal;
        if (elements.selectedColorLabel) elements.selectedColorLabel.textContent = state.selectedColor;
        return;
      }

      // Wishlist toggle on related products or main page
      const wishlistBtn = e.target.closest(".wishlist-btn");
      if (wishlistBtn) {
        e.stopPropagation();
        toggleWishlist(wishlistBtn.dataset.wishlistId);
        return;
      }

      // Add to Cart on related product card
      const addCartCardBtn = e.target.closest(".btn-add-to-cart");
      if (addCartCardBtn) {
        e.stopPropagation();
        addToCart(addCartCardBtn.dataset.cartId);
        return;
      }

      // Full product card click -> Navigate to product.html?id=...
      const card = e.target.closest(".product-card");
      if (card && !e.target.closest("button") && !e.target.closest("a")) {
        const id = card.dataset.productId;
        if (id) window.location.href = `product.html?id=${id}`;
        return;
      }

      // Search Result Click
      const searchItem = e.target.closest(".search-result-item");
      if (searchItem) {
        const id = searchItem.dataset.searchResultId;
        window.location.href = `product.html?id=${id}`;
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
    });

    // 2. Quantity Stepper
    if (elements.qtyMinusBtn) {
      elements.qtyMinusBtn.addEventListener("click", () => {
        if (state.quantity > 1) {
          state.quantity--;
          if (elements.qtyValInput) elements.qtyValInput.value = state.quantity;
          updateAdvanceNotice();
        }
      });
    }

    if (elements.qtyPlusBtn) {
      elements.qtyPlusBtn.addEventListener("click", () => {
        const max = (state.currentProduct && state.currentProduct.stockCount > 0) ? state.currentProduct.stockCount : 10;
        if (state.quantity < max) {
          state.quantity++;
          if (elements.qtyValInput) elements.qtyValInput.value = state.quantity;
          updateAdvanceNotice();
        } else {
          showToast(`Maximum available stock is ${max} units`, "info");
        }
      });
    }

    // 3. Add to Cart Main Button
    if (elements.addCartBtn) {
      elements.addCartBtn.addEventListener("click", () => {
        if (state.currentProduct) {
          addToCart(
            state.currentProduct.id,
            state.selectedSize,
            state.selectedColor,
            state.quantity
          );
        }
      });
    }

    // 4. Buy Now Button
    if (elements.buyNowBtn) {
      elements.buyNowBtn.addEventListener("click", () => {
        if (state.currentProduct) {
          addToCart(
            state.currentProduct.id,
            state.selectedSize,
            state.selectedColor,
            state.quantity
          );
          showToast("Item added! Redirecting to checkout...", "success");
          setTimeout(() => {
            window.location.href = "checkout.html";
          }, 350);
        }
      });
    }

    // 5. Wishlist Main Button
    if (elements.wishlistBtn) {
      elements.wishlistBtn.addEventListener("click", () => {
        if (state.currentProduct) {
          toggleWishlist(state.currentProduct.id);
        }
      });
    }

    // 6. Tabs Switcher
    elements.tabNavBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        elements.tabNavBtns.forEach(b => b.classList.remove("active"));
        elements.tabPanels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const targetId = btn.dataset.tabTarget;
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add("active");
      });
    });

    // 6b. Reviews Form & Submission Handlers
    setupReviewsHandlers();

    // 7. Cart Drawer Triggers
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

    // 8. Mobile Navigation Drawer
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

    // 9. Navbar Search
    if (elements.navSearchInput) {
      elements.navSearchInput.addEventListener("input", e => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) {
          if (elements.searchResultsDropdown) elements.searchResultsDropdown.classList.remove("active");
          if (elements.searchClearBtn) elements.searchClearBtn.classList.remove("visible");
          return;
        }

        if (elements.searchClearBtn) elements.searchClearBtn.classList.add("visible");

        const matches = window.PRODUCTS_DATA.filter(p => 
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
        ).slice(0, 5);

        if (elements.searchResultsDropdown) {
          if (matches.length === 0) {
            elements.searchResultsDropdown.innerHTML = `<div class="search-empty-state">No products found</div>`;
          } else {
            elements.searchResultsDropdown.innerHTML = matches.map(p => `
              <div class="search-result-item" data-search-result-id="${p.id}">
                <img class="search-result-thumb" src="${p.image}" alt="${p.name}">
                <div class="search-result-info">
                  <div class="search-result-title">${p.name}</div>
                  <div class="search-result-meta">${p.brand || 'VELORA'} • ★ ${p.rating}</div>
                </div>
                <div class="search-result-price">${formatPrice(p.price)}</div>
              </div>
            `).join("");
          }
          elements.searchResultsDropdown.classList.add("active");
        }
      });
    }

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener("click", () => {
        if (elements.navSearchInput) elements.navSearchInput.value = "";
        elements.searchClearBtn.classList.remove("visible");
        if (elements.searchResultsDropdown) elements.searchResultsDropdown.classList.remove("active");
      });
    }

    // 10. ESC Key
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeCartDrawer();
        closeMobileDrawer();
        if (elements.searchResultsDropdown) elements.searchResultsDropdown.classList.remove("active");
      }
    });

    // 11. Browser Back / Forward support
    window.addEventListener("popstate", () => {
      initProductDetails();
    });
  }
});

