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
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || []),
    currentProduct: null,
    selectedSize: null,
    selectedColor: null,
    selectedPaymentMethod: localStorage.getItem("velora_preferred_payment") || "online",
    selectedDeliveryPreference: localStorage.getItem("velora_preferred_delivery") || "Simple Delivery",
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
    starsWrap: document.getElementById("detail-stars-wrap"),
    currentPrice: document.getElementById("detail-current-price"),
    originalPrice: document.getElementById("detail-original-price"),
    discountPill: document.getElementById("detail-discount-pill"),
    stockBadge: document.getElementById("detail-stock-badge"),
    descParagraph: document.getElementById("detail-desc-paragraph"),

    // 3D Payment Selection & Delivery Preference
    paymentSelectionBox: document.getElementById("detail-payment-selection-box"),
    cardPayOnline: document.getElementById("card-pay-online"),
    cardPayCod: document.getElementById("card-pay-cod"),
    pcardCodTag: document.getElementById("pcard-cod-tag"),
    pcardGiftTag: document.getElementById("pcard-gift-tag"),
    pcardOnlineDesc: document.getElementById("pcard-online-desc"),
    detailCodHeadline: document.getElementById("detail-cod-headline"),
    prefPills: document.querySelectorAll(".delivery-pref-pill"),
    prefPillSimple: document.getElementById("detail-pref-simple"),
    prefPillOpenbox: document.getElementById("detail-pref-openbox"),
    detailDeliveryPrefWrap: document.getElementById("detail-delivery-pref-wrap"),
    deliveryPrefNoteBadge: document.getElementById("delivery-pref-note-badge"),
    paymentSelectionStatusBadge: document.getElementById("payment-selection-status-badge"),

    // Benefits & Advance Box
    advanceBox: document.getElementById("detail-advance-box"),
    advanceHeadline: document.getElementById("detail-advance-headline"),
    advanceExplainer: document.getElementById("detail-advance-explainer"),
    benefitsBox: document.getElementById("full-online-benefits-box"),
    benefitsBoxTitle: document.getElementById("benefits-box-title"),
    benefitsBoxTag: document.getElementById("benefits-box-tag"),
    benefitsBoxSubtitle: document.getElementById("benefits-box-subtitle"),
    benefitsGiftsPills: document.getElementById("benefits-gifts-pills"),
    benefitsOpenboxNote: document.getElementById("benefits-openbox-note"),

    honestOffersBlock: document.getElementById("honest-offers-block"),
    honestOfferAdvanceText: document.getElementById("honest-offer-advance-text"),
    honestOfferStockText: document.getElementById("honest-offer-stock-text"),
    honestOfferShippingText: document.getElementById("honest-offer-shipping-text"),
    honestOfferBogo: document.getElementById("honest-offer-bogo"),
    honestOfferBogoText: document.getElementById("honest-offer-bogo-text"),

    // 3D Pincode Delivery Availability Checker
    pincodeCard: document.getElementById("pincode-checker-card"),
    pincodeForm: document.getElementById("pincode-checker-form"),
    pincodeInput: document.getElementById("pincode-input"),
    pincodeCheckBtn: document.getElementById("pincode-check-btn"),
    pincodeClearBtn: document.getElementById("pincode-clear-btn"),
    pincodeValidationMsg: document.getElementById("pincode-validation-msg"),
    pincodeSuccessBox: document.getElementById("pincode-success-box"),
    pincodeErrorBox: document.getElementById("pincode-error-box"),
    pincodeResPin: document.getElementById("pincode-res-pin"),
    pincodeResLocation: document.getElementById("pincode-res-location"),
    pincodeResDate: document.getElementById("pincode-res-date"),
    pincodeChangeBtn: document.getElementById("pincode-change-btn"),
    pincodeRetryBtn: document.getElementById("pincode-retry-btn"),

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
    stickyBar: document.getElementById("mobile-sticky-purchase-bar"),
    stickyPriceVal: document.getElementById("sticky-price-val"),
    stickyAddCartBtn: document.getElementById("btn-sticky-add-cart"),
    stickyBuyNowBtn: document.getElementById("btn-sticky-buy-now"),

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
    try {
      updateBadges();
      renderCartDrawer();
      bindCommonEvents();
      window.addEventListener("velora:gift-offers-updated", () => updatePaymentSelectionUI());

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
      const detailCols = "id,name,brand,slug,category_id,price,original_price,discount_percentage,rating,review_count,stock,sizes,colors,images,description,advance_payment_enabled,advance_payment_type,advance_payment_value,is_featured,is_new,is_deal,categories(id,name,slug)";
      try {
        let query = client.from("products").select(detailCols);
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
        const detailCols = "id,name,brand,slug,category_id,price,original_price,discount_percentage,rating,review_count,stock,sizes,colors,images,description,advance_payment_enabled,advance_payment_type,advance_payment_value,is_featured,is_new,is_deal,categories(id,name,slug)";
        let restUrl = '';
        if (isUUID) {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=${detailCols}&id=eq.${productId}`;
        } else if (fallbackStatic && fallbackStatic.name) {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=${detailCols}&name=ilike.${encodeURIComponent(fallbackStatic.name)}`;
        } else {
          restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/products?select=${detailCols}&slug=eq.${encodeURIComponent(productId)}`;
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

    // Cross-store check: If product not found in products table, check sarojini_products
    if (!dbP && client) {
      try {
        let sQuery = client.from("sarojini_products").select("*");
        if (isUUID) {
          sQuery = sQuery.eq("id", productId);
        } else {
          sQuery = sQuery.eq("slug", productId);
        }
        const sRes = await sQuery.maybeSingle();
        if (sRes && !sRes.error && sRes.data) {
          dbP = {
            ...sRes.data,
            brand: sRes.data.brand || "Sarojini Bazaar",
            categories: { id: sRes.data.category_id, name: sRes.data.department || "Sarojini Bazaar", slug: "sarojini" }
          };
        }
      } catch (err) {
        console.warn("Cross-store sarojini lookup notice:", err);
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
        brand: dbP.brand || (fallbackStatic ? fallbackStatic.brand : "VADI Atelier"),
        slug: dbP.slug,
        category: categorySlug,
        categoryLabel: categoryLabel,
        category_id: dbP.category_id,
        price: Number(dbP.price),
        originalPrice: dbP.original_price ? Number(dbP.original_price) : (fallbackStatic ? fallbackStatic.originalPrice : null),
        discount: dbP.discount_percentage || 0,
        rating: (dbP.rating != null && !isNaN(dbP.rating)) ? Number(dbP.rating) : (fallbackStatic && fallbackStatic.rating != null ? fallbackStatic.rating : 0),
        reviewsCount: (dbP.review_count != null && !isNaN(dbP.review_count)) ? Number(dbP.review_count) : (fallbackStatic && fallbackStatic.reviewsCount != null ? fallbackStatic.reviewsCount : 0),
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
  } catch (err) {
    console.warn("initProductDetails error:", err);
    showNotFoundState();
  }
}

  async function updatePaymentSelectionUI() {
    const p = state.currentProduct;
    if (!p) return;

    const isAdv = Boolean(p.advance_payment_enabled);
    const advVal = Number(p.advance_payment_value) || 0;
    const qty = state.quantity || 1;
    const unitPrice = Number(p.price) || 0;
    const totalPrice = unitPrice * qty;

    let unitAdvance = 0;
    if (isAdv && advVal > 0) {
      if (p.advance_payment_type === "percentage") {
        unitAdvance = Math.round(unitPrice * (advVal / 100));
      } else {
        unitAdvance = Math.min(unitPrice, advVal);
      }
    }

    const totalAdvance = unitAdvance * qty;
    const totalCodRem = Math.max(0, totalPrice - totalAdvance);

    // Update COD headline & tag dynamically (NEVER hardcoded)
    if (elements.detailCodHeadline) {
      if (isAdv && totalAdvance > 0) {
        elements.detailCodHeadline.textContent = `Pay ${formatPrice(totalAdvance)} Now • ${formatPrice(totalCodRem)} via COD`;
      } else {
        elements.detailCodHeadline.textContent = `100% Pay on Delivery • Zero Advance`;
      }
    }
    if (elements.pcardCodTag) {
      if (isAdv && totalAdvance > 0) {
        elements.pcardCodTag.textContent = "ADVANCE REQ.";
        elements.pcardCodTag.style.background = "rgba(99, 102, 241, 0.15)";
        elements.pcardCodTag.style.color = "#4f46e5";
      } else {
        elements.pcardCodTag.textContent = "ZERO ADVANCE";
        elements.pcardCodTag.style.background = "rgba(16, 185, 129, 0.15)";
        elements.pcardCodTag.style.color = "#059669";
      }
    }

    // Check currently selected payment method
    const isOnline = state.selectedPaymentMethod === "online";

    // 1. Toggle 3D card selected states
    if (elements.cardPayOnline) elements.cardPayOnline.classList.toggle("selected", isOnline);
    if (elements.cardPayCod) elements.cardPayCod.classList.toggle("selected", !isOnline);

    // Resolve dynamic gift configuration for this specific product
    let giftRes = { eligible: false, gifts: [] };
    if (window.GiftEngine && typeof window.GiftEngine.resolveProductGifts === "function") {
      giftRes = await window.GiftEngine.resolveProductGifts(p);
    }
    state.currentProductGifts = giftRes.eligible ? giftRes.gifts : [];
    state.currentProductGiftOffer = giftRes.offer || null;
    const hasGifts = Boolean(giftRes.eligible && giftRes.gifts && giftRes.gifts.length > 0);
    const giftsCount = hasGifts ? giftRes.gifts.length : 0;
    const giftNamesList = hasGifts ? giftRes.gifts.map(g => g.name).join(", ") : "";

    // 2. Status Badge in header & Payment Card Labels
    if (elements.paymentSelectionStatusBadge) {
      if (isOnline) {
        elements.paymentSelectionStatusBadge.textContent = hasGifts 
          ? `⚡ Full Online = ${giftsCount} FREE Gifts`
          : `⚡ 100% Online • Instant Dispatch`;
        elements.paymentSelectionStatusBadge.style.color = "#059669";
        elements.paymentSelectionStatusBadge.style.background = "rgba(16, 185, 129, 0.14)";
        elements.paymentSelectionStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.35)";
      } else {
        elements.paymentSelectionStatusBadge.textContent = (isAdv && totalAdvance > 0)
          ? "💵 COD: Advance Deposit Required"
          : "💵 100% Cash on Delivery";
        elements.paymentSelectionStatusBadge.style.color = "#4338ca";
        elements.paymentSelectionStatusBadge.style.background = "rgba(99, 102, 241, 0.12)";
        elements.paymentSelectionStatusBadge.style.borderColor = "rgba(99, 102, 241, 0.3)";
      }
    }

    // Dynamic Online Card Tag & Description
    if (elements.pcardGiftTag) {
      if (hasGifts) {
        elements.pcardGiftTag.textContent = `${giftsCount} FREE GIFTS`;
        elements.pcardGiftTag.style.display = "inline-block";
      } else {
        elements.pcardGiftTag.style.display = "none";
      }
    }
    if (elements.pcardOnlineDesc) {
      elements.pcardOnlineDesc.textContent = hasGifts
        ? `Pay 100% online • No advance required • ${giftsCount} FREE gifts`
        : `Pay 100% online • No advance required • Instant confirmation`;
    }

    // 3. Advance Box visibility
    if (elements.advanceBox) {
      if (!isOnline && isAdv && totalAdvance > 0) {
        if (elements.advanceHeadline) {
          elements.advanceHeadline.textContent = `${formatPrice(totalAdvance)} Advance Payment Required`;
        }
        if (elements.advanceExplainer) {
          elements.advanceExplainer.textContent = `Pay ${formatPrice(totalAdvance)} now • Remaining ${formatPrice(totalCodRem)} via COD`;
        }
        elements.advanceBox.style.display = "block";
      } else {
        elements.advanceBox.style.display = "none";
      }
    }

    // 4. Free Gifts Box State (Show ONLY if product is eligible according to backend config)
    if (elements.benefitsBox) {
      if (!hasGifts) {
        // Completely hide free gift benefit if product has no active offer
        elements.benefitsBox.style.display = "none";
      } else {
        elements.benefitsBox.style.display = "block";
        if (elements.benefitsBoxTitle) {
          elements.benefitsBoxTitle.textContent = isOnline
            ? `Pay Full Online & Get ${giftsCount} FREE Gifts`
            : `Pay Online to Unlock ${giftsCount} FREE Gifts`;
        }
        if (elements.benefitsBoxTag) {
          elements.benefitsBoxTag.textContent = isOnline ? "✓ UNLOCKED (₹0)" : "LOCKED FOR COD";
          elements.benefitsBoxTag.style.background = isOnline ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#94a3b8";
        }
        if (elements.benefitsBoxSubtitle) {
          elements.benefitsBoxSubtitle.innerHTML = isOnline
            ? `Pay 100% online via UPI, Card, or Net Banking to automatically unlock ${giftsCount} complimentary accessories:`
            : `<em>Free gifts (${giftNamesList}) apply exclusively to Full Online Payment. Switch to Full Online above to unlock.</em>`;
        }
        if (elements.benefitsGiftsPills) {
          elements.benefitsGiftsPills.innerHTML = giftRes.gifts.map(g => {
            const isImg = g.icon_or_image && (g.icon_or_image.startsWith("http://") || g.icon_or_image.startsWith("https://") || g.icon_or_image.startsWith("data:"));
            const iconHtml = isImg
              ? `<img src="${g.icon_or_image}" alt="${g.name}" style="width:16px; height:16px; object-fit:cover; border-radius:3px; margin-right:4px;">`
              : `<span class="gift-pill-icon">${g.icon_or_image || '🎁'}</span> `;
            const qtyTag = g.quantity > 1 ? ` <strong style="color:#059669;">(${g.quantity}x)</strong>` : '';
            return `<span class="gift-pill" title="${g.description || g.name}">${iconHtml}${g.name}${qtyTag}</span>`;
          }).join("");
          elements.benefitsGiftsPills.style.opacity = isOnline ? "1" : "0.45";
        }
        if (elements.benefitsOpenboxNote) {
          elements.benefitsOpenboxNote.style.display = "flex";
        }
      }
    }

    // 5. Delivery Preference Section (Available for All Orders: COD & Online)
    if (elements.detailDeliveryPrefWrap) {
      elements.detailDeliveryPrefWrap.style.opacity = "1";
      elements.detailDeliveryPrefWrap.style.pointerEvents = "auto";
      if (elements.deliveryPrefNoteBadge) {
        elements.deliveryPrefNoteBadge.textContent = "Doorstep Choice";
        elements.deliveryPrefNoteBadge.style.background = "rgba(2, 132, 199, 0.12)";
        elements.deliveryPrefNoteBadge.style.color = "#0284c7";
      }
    }

    // Update delivery pref pills UI
    if (elements.prefPills) {
      elements.prefPills.forEach(pill => {
        const isSel = pill.dataset.deliveryPref === state.selectedDeliveryPreference;
        pill.classList.toggle("selected", isSel);
      });
    }

    // 6. Update Honest Offers text dynamically
    if (elements.honestOfferAdvanceText) {
      if (isOnline) {
        elements.honestOfferAdvanceText.innerHTML = `<strong>100% Online Payment:</strong> No advance deposit required • All 3 complimentary accessories included`;
      } else if (isAdv && totalAdvance > 0) {
        elements.honestOfferAdvanceText.innerHTML = `<strong>Genuine Advance Terms:</strong> Pay ${formatPrice(unitAdvance)} deposit to dispatch • Pay ${formatPrice(Math.max(0, unitPrice - unitAdvance))} on doorstep delivery`;
      } else {
        elements.honestOfferAdvanceText.innerHTML = `<strong>100% Zero-Advance COD:</strong> No advance deposit required • Pay complete amount upon delivery`;
      }
    }
  }

  function updateAdvanceNotice() {
    updatePaymentSelectionUI();
  }

  function updateHonestOffers(product) {
    if (!elements.honestOffersBlock || !product) return;

    // 1. Genuine Advance Terms
    if (elements.honestOfferAdvanceText) {
      const isAdv = Boolean(product.advance_payment_enabled);
      const advVal = Number(product.advance_payment_value) || 0;
      if (isAdv && advVal > 0) {
        const unitPrice = Number(product.price) || 0;
        const unitAdv = product.advance_payment_type === "percentage"
          ? Math.round(unitPrice * (advVal / 100))
          : Math.min(unitPrice, advVal);
        const remCod = Math.max(0, unitPrice - unitAdv);
        elements.honestOfferAdvanceText.innerHTML = `<strong>Genuine Advance Terms:</strong> Pay ${formatPrice(unitAdv)} deposit to dispatch • Pay ${formatPrice(remCod)} on doorstep delivery`;
      } else {
        elements.honestOfferAdvanceText.innerHTML = `<strong>100% Zero-Advance COD:</strong> No advance deposit required. Pay complete amount upon delivery`;
      }
    }

    // 2. Real Warehouse Stock
    if (elements.honestOfferStockText) {
      const stock = product.stockCount !== undefined ? product.stockCount : 10;
      if (stock > 0 && stock <= 5) {
        elements.honestOfferStockText.innerHTML = `<strong>Verified Regional Stock:</strong> Only <strong>${stock} units</strong> remaining in fulfillment hub • Same-day dispatch`;
      } else if (stock > 5) {
        elements.honestOfferStockText.innerHTML = `<strong>In Warehouse:</strong> ${stock} units ready in hub • Dispatched within 24 hours`;
      } else {
        elements.honestOfferStockText.innerHTML = `<strong>Inventory Status:</strong> Restock currently underway from brand atelier`;
      }
    }

    // 3. Transparent Shipping Terms
    if (elements.honestOfferShippingText) {
      elements.honestOfferShippingText.innerHTML = `<strong>100% Free Delivery Across India:</strong> Zero shipping fee on this item • Dispatched within 24 hours with live tracking`;
    }

    // 4. BOGO Eligibility
    if (elements.honestOfferBogo) {
      const bogoConfigIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
        ? window.VELORA_SETTINGS.bogo_config.product_ids
        : [];
      const isBogoEligible = Boolean(product.isBogo || product.is_bogo || bogoConfigIds.includes(product.id));
      if (isBogoEligible) {
        elements.honestOfferBogo.style.display = "flex";
        if (elements.honestOfferBogoText) {
          elements.honestOfferBogoText.innerHTML = `<strong>Buy 1 Get 1 Free Eligible:</strong> Qualifies for a complimentary companion gift (matched within ₹20–₹40) at checkout!`;
        }
      } else {
        elements.honestOfferBogo.style.display = "none";
      }
    }
  }

  // ==========================================================================
  // NOT FOUND STATE
  // ==========================================================================
  function showNotFoundState() {
    if (elements.mainView) elements.mainView.style.display = "none";
    if (elements.notFoundView) elements.notFoundView.style.display = "flex";
    document.title = "Product Not Found | VADI - Everything. Simply Yours.";
    if (elements.breadcrumbProductTitle) elements.breadcrumbProductTitle.textContent = "Product Not Found";
  }

  // ==========================================================================
  // RENDER PRODUCT DETAILS
  // ==========================================================================
  function renderProductPage(product) {
    if (elements.mainView) elements.mainView.style.display = "block";
    if (elements.notFoundView) elements.notFoundView.style.display = "none";

    // Set page title
    document.title = `${product.name} | VADI - Everything. Simply Yours.`;

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
    if (elements.brandBadge) elements.brandBadge.textContent = product.brand || "VADI Atelier";
    if (elements.title) elements.title.textContent = product.name;
    if (elements.ratingScore) {
      elements.ratingScore.textContent = product.rating > 0 ? Number(product.rating).toFixed(1) : "—";
    }
    if (elements.reviewsCount) {
      elements.reviewsCount.textContent = product.reviewsCount > 0
        ? `(${product.reviewsCount} customer review${product.reviewsCount === 1 ? '' : 's'})`
        : `(0 reviews)`;
    }
    if (elements.currentPrice) elements.currentPrice.textContent = formatPrice(product.price);
    if (elements.stickyPriceVal) elements.stickyPriceVal.textContent = formatPrice(product.price);

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

    // Honest Product Offers & Transparent Guarantees
    updateHonestOffers(product);

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

    // Dynamic Specifications from Supabase
    loadProductSpecifications(product.id);

    // Load live approved customer reviews from Supabase
    loadProductReviews(product.id);
  }

  async function loadProductSpecifications(productId) {
    if (!elements.specsTableBody) return;
    const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

    elements.specsTableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 18px;">Loading specifications...</td></tr>`;

    function escapeHTML(str) {
      if (typeof str !== 'string') return str == null ? '' : String(str);
      return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    }

    try {
      let specs = [];
      if (window.supabaseClient) {
        const { data, error } = await window.supabaseClient
          .from("product_specifications")
          .select("name, value, group_name, display_order")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (!error && Array.isArray(data)) {
          specs = data;
        }
      }

      if (specs.length === 0 && typeof fetch !== "undefined") {
        const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/product_specifications?product_id=eq.${productId}&is_active=eq.true&select=name,value,group_name,display_order&order=display_order.asc,created_at.asc`, {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const fetched = await res.json();
          if (Array.isArray(fetched) && fetched.length > 0) {
            specs = fetched;
          }
        }
      }

      if (specs.length === 0) {
        elements.specsTableBody.innerHTML = `
          <tr>
            <td colspan="2" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
              <div style="font-size: 1.8rem; margin-bottom: 8px;">📋</div>
              <p style="margin: 0; font-weight: 500; font-size: 0.95rem;">Specifications not available for this product</p>
            </td>
          </tr>
        `;
        return;
      }

      let html = "";
      const grouped = {};
      specs.forEach(s => {
        const grp = s.group_name && s.group_name.trim() ? s.group_name.trim() : "General";
        if (!grouped[grp]) grouped[grp] = [];
        grouped[grp].push(s);
      });

      const groupKeys = Object.keys(grouped);
      const hasMultipleGroups = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== "General");

      groupKeys.forEach(grp => {
        if (hasMultipleGroups) {
          html += `
            <tr class="spec-group-header-row" style="background: rgba(0,0,0,0.03);">
              <th colspan="2" style="padding: 10px 16px; font-weight: 700; color: var(--text-main); text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.6px; border-bottom: 1px solid var(--border-color);">
                ${escapeHTML(grp)}
              </th>
            </tr>
          `;
        }
        grouped[grp].forEach(s => {
          html += `
            <tr>
              <th style="width: 35%; padding: 12px 16px; font-weight: 600; color: var(--text-main); border-bottom: 1px solid var(--border-color);">${escapeHTML(s.name)}</th>
              <td style="width: 65%; padding: 12px 16px; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">${escapeHTML(s.value)}</td>
            </tr>
          `;
        });
      });

      elements.specsTableBody.innerHTML = html;
    } catch (e) {
      console.warn("Specifications load notice:", e);
      elements.specsTableBody.innerHTML = `
        <tr>
          <td colspan="2" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">📋</div>
            <p style="margin: 0; font-weight: 500; font-size: 0.95rem;">Specifications not available for this product</p>
          </td>
        </tr>
      `;
    }
  }

  // ==========================================================================
  // CUSTOMER REVIEWS & RATING SUMMARY SUBSYSTEM (Connected to Supabase public.reviews)
  // ==========================================================================
  let reviewsRealtimeChannel = null;

  function renderStarsVisual(rating, size = 16) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const fullStars = Math.floor(r);
    const remainder = r - fullStars;
    let starsHtml = '';

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        starsHtml += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
      } else if (i === fullStars + 1 && remainder > 0.05) {
        const pct = Math.round(remainder * 100);
        const gradId = `star-grad-${pct}-${Math.random().toString(36).substr(2, 6)}`;
        starsHtml += `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="${gradId}">
                <stop offset="${pct}%" stop-color="#f59e0b"/>
                <stop offset="${pct}%" stop-color="#e2e8f0"/>
              </linearGradient>
            </defs>
            <path fill="url(#${gradId})" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        `;
      } else {
        starsHtml += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#e2e8f0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
      }
    }
    return starsHtml;
  }

  async function loadProductReviews(productId, setupRealtime = true) {
    const summaryContainer = document.getElementById("product-rating-summary");
    const container = document.getElementById("product-reviews-container");
    const countBadge = document.getElementById("tab-reviews-count");
    if (!productId) return;

    const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

    function escapeHTML(str) {
      if (typeof str !== 'string') return str == null ? '' : String(str);
      return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    }

    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/reviews?product_id=eq.${productId}&status=eq.approved&select=id,user_name,rating,comment,created_at&order=created_at.desc`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (res.ok) {
        const reviews = await res.json();

        // Enforce single source of truth: deduplicate by database UUID
        const seenIds = new Set();
        const uniqueReviews = [];
        if (Array.isArray(reviews)) {
          for (const r of reviews) {
            if (r && r.id && !seenIds.has(r.id)) {
              seenIds.add(r.id);
              uniqueReviews.push(r);
            }
          }
        }

        const totalReviews = uniqueReviews.length;
        let avgRating = 0.0;
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        if (totalReviews > 0) {
          let sum = 0;
          for (const r of uniqueReviews) {
            const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
            counts[star] = (counts[star] || 0) + 1;
            sum += Number(r.rating) || 5;
          }
          avgRating = Number((sum / totalReviews).toFixed(1));
        }

        // 1. Update Tab Reviews Count Badge
        if (countBadge) {
          countBadge.textContent = totalReviews;
        }

        // 2. Update Header/Top Rating Elements
        if (elements.reviewsCount) {
          elements.reviewsCount.textContent = totalReviews > 0
            ? `(${totalReviews} customer review${totalReviews === 1 ? '' : 's'})`
            : `(0 reviews)`;
        }

        const starsWrap = document.getElementById("detail-stars-wrap") || document.querySelector(".detail-stars");
        if (elements.ratingScore) {
          elements.ratingScore.textContent = totalReviews > 0 ? avgRating.toFixed(1) : "—";
        }
        if (starsWrap) {
          starsWrap.innerHTML = renderStarsVisual(totalReviews > 0 ? avgRating : 0, 16);
        }

        // 3. Render Premium Rating Summary / Review Breakdown Section
        if (summaryContainer) {
          if (totalReviews === 0) {
            summaryContainer.innerHTML = `
              <div class="rating-summary-empty">
                <div class="rating-summary-empty-icon">★</div>
                <h4 class="rating-summary-empty-title">No reviews yet</h4>
                <p class="rating-summary-empty-desc">Be the first to share your experience with fellow buyers.</p>
                <button type="button" onclick="document.getElementById('btn-toggle-review-form')?.click();" class="btn-primary" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 0.85rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Write the First Review
                </button>
              </div>
            `;
          } else {
            const starSvgTiny = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
            
            const rowsHtml = [5, 4, 3, 2, 1].map(star => {
              const c = counts[star] || 0;
              const pct = Math.round((c / totalReviews) * 100);
              return `
                <div class="rating-dist-row">
                  <span class="dist-label">${star} ${starSvgTiny}</span>
                  <div class="dist-track" title="${star} Stars: ${c} review${c === 1 ? '' : 's'} (${pct}%)">
                    <div class="dist-fill" style="width: ${pct}%;"></div>
                  </div>
                  <div class="dist-meta">
                    <span class="dist-percentage">${pct}%</span>
                    <span class="dist-count">(${c})</span>
                  </div>
                </div>
              `;
            }).join("");

            summaryContainer.innerHTML = `
              <div class="rating-summary-layout">
                <!-- Left: Overall Rating Score & Stars -->
                <div class="rating-summary-left">
                  <div class="rating-summary-score">${avgRating.toFixed(1)}</div>
                  <div class="rating-summary-stars" aria-label="${avgRating.toFixed(1)} out of 5 stars">
                    ${renderStarsVisual(avgRating, 20)}
                  </div>
                  <div class="rating-summary-orders">Based on ${totalReviews} verified order${totalReviews === 1 ? '' : 's'}</div>
                </div>

                <!-- Right: Star Distribution Progress Bars -->
                <div class="rating-summary-distribution">
                  ${rowsHtml}
                </div>
              </div>
            `;
          }
        }

        // 4. Render Individual Customer Review Cards
        if (container) {
          if (totalReviews === 0) {
            container.innerHTML = '';
          } else {
            container.innerHTML = uniqueReviews.map(r => {
              const ratingVal = Math.max(1, Math.min(5, Number(r.rating) || 5));
              const stars = renderStarsVisual(ratingVal, 14);
              const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "";
              const authorName = escapeHTML(r.user_name || "Verified Customer");
              const commentText = escapeHTML(r.comment || "");

              return `
                <div class="customer-review-card" data-review-id="${escapeHTML(r.id)}" style="padding: 16px 0; border-bottom: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong class="review-author" style="font-size: 0.95rem; color: var(--text-main);">${authorName}</strong>
                      <span class="verified-buyer" style="font-size: 0.72rem; color: var(--color-success); background: rgba(34, 197, 94, 0.1); padding: 1px 6px; border-radius: 4px; font-weight: 600;">✓ Verified Buyer</span>
                    </div>
                    <span class="review-date" style="font-size: 0.78rem; color: var(--text-muted);">${dateStr}</span>
                  </div>
                  <div class="review-stars" style="display: flex; align-items: center; gap: 3px; margin-bottom: 6px;">${stars}</div>
                  <p class="review-comment" style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.6; margin: 0; word-break: break-word;">${commentText}</p>
                </div>
              `;
            }).join("");
          }
        }

        // 5. Managed Supabase Realtime Subscription for instant cross-device updates
        if (setupRealtime && !reviewsRealtimeChannel) {
          const client = window.supabaseClient || (typeof window.getSupabase === "function" ? window.getSupabase() : null);
          if (client && typeof client.channel === "function") {
            try {
              reviewsRealtimeChannel = client.channel(`reviews-${productId}`)
                .on('postgres_changes', {
                  event: '*',
                  schema: 'public',
                  table: 'reviews',
                  filter: `product_id=eq.${productId}`
                }, () => {
                  loadProductReviews(productId, false);
                })
                .subscribe();
            } catch (realtimeErr) {
              console.warn("Reviews realtime subscription notice:", realtimeErr);
            }
          }
        }
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
      toggleBtn.addEventListener("click", async () => {
        const isHidden = box.style.display === "none";
        box.style.display = isHidden ? "block" : "none";

        // Auto-prefill customer name if logged in
        if (isHidden) {
          const client = (window.VeloraAuth && window.VeloraAuth.getClient()) || window.supabaseClient || (typeof window.getSupabase === "function" ? window.getSupabase() : null);
          if (client && client.auth) {
            try {
              const { data: { user } } = await client.auth.getUser();
              const nameInput = document.getElementById("review-user-name") || document.getElementById("review-author");
              if (user && nameInput && !nameInput.value.trim()) {
                nameInput.value = user.user_metadata?.full_name || user.email.split("@")[0];
              }
            } catch (e) {
              // ignore
            }
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
        const nameInput = document.getElementById("review-user-name") || document.getElementById("review-author");
        const ratingInput = document.getElementById("review-rating");
        const commentInput = document.getElementById("review-comment");
        const submitBtn = document.getElementById("btn-submit-review");

        if (!nameInput || !nameInput.value.trim() || !commentInput || !commentInput.value.trim()) {
          showToast("Please fill out all required fields.", "error");
          return;
        }

        const client = (window.VeloraAuth && window.VeloraAuth.getClient()) || window.supabaseClient || (typeof window.getSupabase === "function" ? window.getSupabase() : null);
        if (!client) {
          showToast("Review service is temporarily unavailable. Please try again later.", "info");
          return;
        }

        let currentUserId = null;
        try {
          const { data: { user } } = await client.auth.getUser();
          if (!user) {
            showToast("Please sign in to your customer account to submit a verified review.", "info");
            setTimeout(() => {
              window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            }, 1200);
            return;
          }
          currentUserId = user.id;
        } catch (authErr) {
          showToast("Please sign in to submit a review.", "info");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }

        try {
          const reviewPayload = {
            product_id: state.currentProduct.id,
            user_id: currentUserId,
            user_name: nameInput.value.trim(),
            rating: parseInt(ratingInput.value, 10),
            comment: commentInput.value.trim(),
            status: "approved",
            catalog_type: "main"
          };

          const { error } = await client.from("reviews").insert([reviewPayload]);

          if (error) {
            showToast("Could not submit review: " + error.message, "info");
          } else {
            showToast("Review submitted successfully! Thank you for your feedback.", "success");
            form.reset();
            if (box) box.style.display = "none";

            // Sync aggregate statistics on products table via database RPC
            try {
              await client.rpc("sync_product_review_stats", { p_product_id: state.currentProduct.id });
            } catch (rpcErr) {
              console.warn("Product stats sync notice:", rpcErr);
            }

            // Immediately reload and re-render the rating summary and list
            await loadProductReviews(state.currentProduct.id, false);
          }
        } catch (err) {
          console.error("Review submission error:", err);
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
  // 6c. 3D PINCODE DELIVERY AVAILABILITY CHECKER
  // ==========================================================================
  function setupPincodeChecker() {
    if (!elements.pincodeCard || !elements.pincodeInput || !elements.pincodeCheckBtn) return;

    const input = elements.pincodeInput;
    const checkBtn = elements.pincodeCheckBtn;
    const clearBtn = elements.pincodeClearBtn;
    const form = elements.pincodeForm;
    const validationMsg = elements.pincodeValidationMsg;
    const successBox = elements.pincodeSuccessBox;
    const errorBox = elements.pincodeErrorBox;
    const resPin = elements.pincodeResPin;
    const resLocation = elements.pincodeResLocation;
    const resDate = elements.pincodeResDate;
    const changeBtn = elements.pincodeChangeBtn;
    const retryBtn = elements.pincodeRetryBtn;
    const btnText = checkBtn.querySelector(".btn-check-text");
    const btnSpinner = checkBtn.querySelector(".btn-check-spinner");

    function showValidation(msg) {
      if (validationMsg) {
        validationMsg.textContent = msg;
        validationMsg.style.display = "flex";
      }
      input.classList.add("has-error");
      if (successBox) successBox.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
    }

    function clearValidation() {
      if (validationMsg) {
        validationMsg.textContent = "";
        validationMsg.style.display = "none";
      }
      input.classList.remove("has-error");
    }

    function applySuccessState(res) {
      clearValidation();
      if (errorBox) errorBox.style.display = "none";
      if (successBox) {
        successBox.style.display = "block";
      }
      if (resPin) resPin.textContent = res.pincode;
      const locationLabel = (res.city && res.state) ? `${res.city}, ${res.state}` : (res.city || res.state || 'India');
      if (resLocation) resLocation.textContent = locationLabel;
      if (resDate) resDate.textContent = res.estimatedDate || '2-4 Business Days';
      
      // Dynamic Honest Offers shipping update
      if (elements.honestOfferShippingText) {
        elements.honestOfferShippingText.innerHTML = `<strong>100% Free Delivery to ${res.pincode} (${locationLabel}):</strong> Estimated arrival by <strong>${res.estimatedDate || '2-4 Days'}</strong> • Zero shipping fee`;
      }
    }

    function applyErrorState() {
      clearValidation();
      if (successBox) successBox.style.display = "none";
      if (errorBox) errorBox.style.display = "block";

      if (elements.honestOfferShippingText) {
        elements.honestOfferShippingText.innerHTML = `<strong>Delivery Status:</strong> Currently unavailable to this destination. Try an alternate PIN code.`;
      }
    }

    function resetChecker() {
      clearValidation();
      if (successBox) successBox.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
      if (window.VeloraPincodeEngine) {
        window.VeloraPincodeEngine.clear();
      }
      if (elements.honestOfferShippingText) {
        elements.honestOfferShippingText.innerHTML = `<strong>100% Free Delivery Across India:</strong> Zero shipping fee on this item • Dispatched within 24 hours with live tracking`;
      }
      input.value = "";
      if (clearBtn) clearBtn.style.display = "none";
      input.focus();
    }

    async function runCheck() {
      const raw = input.value.trim();
      
      if (!window.VeloraPincodeEngine) {
        console.warn("VeloraPincodeEngine not loaded");
        return;
      }

      const val = window.VeloraPincodeEngine.validate(raw);
      if (!val.valid) {
        showValidation(val.error);
        input.focus();
        return;
      }

      clearValidation();
      
      // Loading State
      checkBtn.disabled = true;
      if (btnText) btnText.style.display = "none";
      if (btnSpinner) btnSpinner.style.display = "inline-flex";

      try {
        const result = await window.VeloraPincodeEngine.check(val.pincode);
        if (result.serviceable) {
          applySuccessState(result);
        } else {
          applyErrorState();
        }
      } catch (err) {
        console.error("Pincode check error:", err);
        showValidation("Unable to verify delivery availability right now. Please try again.");
      } finally {
        checkBtn.disabled = false;
        if (btnText) btnText.style.display = "inline";
        if (btnSpinner) btnSpinner.style.display = "none";
      }
    }

    // Input sanitization: only digits, max 6
    input.addEventListener("input", () => {
      clearValidation();
      const cleaned = input.value.replace(/\D/g, "").slice(0, 6);
      if (input.value !== cleaned) {
        input.value = cleaned;
      }
      if (clearBtn) {
        clearBtn.style.display = input.value.length > 0 ? "inline-flex" : "none";
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        clearBtn.style.display = "none";
        clearValidation();
        input.focus();
      });
    }

    checkBtn.addEventListener("click", (e) => {
      e.preventDefault();
      runCheck();
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        runCheck();
      });
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    });

    if (changeBtn) {
      changeBtn.addEventListener("click", () => {
        resetChecker();
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetChecker();
      });
    }

    // Restore saved session pincode on startup
    if (window.VeloraPincodeEngine) {
      const saved = window.VeloraPincodeEngine.getSaved();
      if (saved && saved.pincode && saved.serviceable) {
        input.value = saved.pincode;
        if (clearBtn) clearBtn.style.display = "inline-flex";
        applySuccessState(saved);
      }
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
      const isInCart = state.cart.some(c => String(c.id || c.supabase_id) === String(item.id || item.supabase_id));
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
            <div class="product-card-brand">${item.brand || 'VADI'}</div>
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

            <button type="button" class="btn-add-to-cart ${isInCart ? 'added' : ''}" data-cart-id="${item.id}">
              <span class="btn-cart-icon">${isInCart ? icons.check : icons.cart}</span>
              <span class="btn-cart-text">${isInCart ? 'In Cart' : 'Add to Cart'}</span>
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

    const isOnline = state.selectedPaymentMethod === "online";
    const selectedDelivery = isOnline ? (state.selectedDeliveryPreference || "Simple Delivery") : "Simple Delivery";
    const effectiveUnitAdv = isOnline ? 0 : unitAdv;
    const effectiveCodPerUnit = isOnline ? 0 : Math.max(0, product.price - unitAdv);

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += qty;
      state.cart[existingIndex].selected_payment_method = state.selectedPaymentMethod;
      state.cart[existingIndex].delivery_preference = selectedDelivery;
      state.cart[existingIndex].advance_payment_enabled = isAdv;
      state.cart[existingIndex].advance_payment_type = advType;
      state.cart[existingIndex].advance_payment_value = advVal;
      state.cart[existingIndex].advance_per_unit = effectiveUnitAdv;
      state.cart[existingIndex].cod_per_unit = effectiveCodPerUnit;
      state.cart[existingIndex].category_id = product.category_id || state.cart[existingIndex].category_id || null;
      state.cart[existingIndex].category = product.category || state.cart[existingIndex].category || null;
      state.cart[existingIndex].categoryLabel = product.categoryLabel || state.cart[existingIndex].categoryLabel || null;
      state.cart[existingIndex].gift_bundle = (isOnline && state.currentProductGifts) ? state.currentProductGifts : [];
      state.cart[existingIndex].gift_offer_id = (isOnline && state.currentProductGiftOffer) ? state.currentProductGiftOffer.id : null;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: size || "Standard",
        color: color || "Default",
        quantity: qty,
        selected_payment_method: state.selectedPaymentMethod,
        delivery_preference: selectedDelivery,
        advance_payment_enabled: isAdv,
        advance_payment_type: advType,
        advance_payment_value: advVal,
        advance_per_unit: effectiveUnitAdv,
        cod_per_unit: effectiveCodPerUnit,
        category_id: product.category_id || null,
        category: product.category || null,
        categoryLabel: product.categoryLabel || null,
        gift_bundle: (isOnline && state.currentProductGifts) ? state.currentProductGifts : [],
        gift_offer_id: (isOnline && state.currentProductGiftOffer) ? state.currentProductGiftOffer.id : null
      });
    }

    localStorage.setItem("velora_preferred_payment", state.selectedPaymentMethod);
    localStorage.setItem("velora_preferred_delivery", selectedDelivery);

    saveCart();
    updateBadges();
    renderCartDrawer();
    openCartDrawer();
    showToast(`Added ${qty}x "${product.name}" to cart!`, "success");

    if (window.VeloraAnalytics) {
      window.VeloraAnalytics.trackAddToCart(product.id, product.category);
    }

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
    } else if (delta < 0) {
      if (currentQty > 1) {
        state.cart[index].quantity = currentQty - 1;
        saveCart();
        updateBadges();
        renderCartDrawer();
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
  }

  function saveCart() {
    localStorage.setItem("velora_cart", JSON.stringify(state.cart));
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

    try {
      state.cart = JSON.parse(localStorage.getItem("velora_cart")) || [];
    } catch (e) {
      state.cart = [];
    }
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
      addToCart(productId, "Standard", "Default", 1);
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

  function renderCartDrawer() {
    if (!elements.cartItemsContainer) return;

    if (state.cart.length === 0) {
      elements.cartItemsContainer.style.display = "none";
      elements.cartEmptyState.style.display = "flex";
      elements.cartSubtotalElem.textContent = formatPrice(0);
      elements.cartTotalElem.textContent = formatPrice(0);
      elements.freeShippingFill.style.width = "100%";
      elements.freeShippingMsg.innerHTML = `🎉 <strong>100% FREE Delivery Across India</strong> on all orders!`;
      const advanceBreakdownBox = document.getElementById("cart-advance-breakdown");
      if (advanceBreakdownBox) advanceBreakdownBox.style.display = "none";
      return;
    }

    elements.cartItemsContainer.style.display = "flex";
    elements.cartEmptyState.style.display = "none";

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    elements.freeShippingFill.style.width = "100%";

    // Check if cart has online items
    const hasOnlineItems = state.cart.some(item => item.selected_payment_method === "online");
    if (hasOnlineItems) {
      elements.freeShippingMsg.innerHTML = `🎉 <strong>100% FREE Delivery</strong> • 🎁 <strong>3 FREE Gifts Unlocked!</strong>`;
    } else {
      elements.freeShippingMsg.innerHTML = `🎉 <strong>100% FREE Delivery Across India</strong> on this order!`;
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
      const isItemOnline = item.selected_payment_method === "online";
      const payBadge = isItemOnline
        ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">⚡ Online (3 Gifts)</span>`
        : (item.advance_payment_enabled
            ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#6366f1; background:rgba(99,102,241,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 COD Adv. Req.</span>`
            : `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#d97706; background:rgba(217,119,6,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 100% COD</span>`);

      return `
      <div class="cart-item-card">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-meta">${item.size} • ${item.color} ${payBadge}</span>
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
  // WISHLIST MANAGEMENT (LOCALSTORAGE + SUPABASE DB SYNC)
  // ==========================================================================
  async function toggleWishlist(productId) {
    if (window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
      const product = (window.getProductById ? window.getProductById(productId) : null) || state.currentProduct;
      const willAdd = await window.VadiWishlist.toggle(productId, 'main', product);
      if (elements.wishlistBtn) elements.wishlistBtn.classList.toggle("active", willAdd);
      return;
    }

    const product = (window.getProductById ? window.getProductById(productId) : null) || state.currentProduct;
    if (!product) return;

    const willAdd = !state.wishlist.has(product.id);
    if (willAdd) {
      state.wishlist.add(product.id);
      showToast(`Added "${product.name}" to wishlist!`, "success");
    } else {
      state.wishlist.delete(product.id);
      showToast(`Removed "${product.name}" from wishlist`, "info");
    }

    localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlist)));
    updateBadges();
    updateWishlistButton();

    if (window.VeloraAnalytics) {
      window.VeloraAnalytics.trackWishlist(product.id, willAdd ? 'add' : 'remove');
    }

    document.querySelectorAll(`.wishlist-btn[data-wishlist-id="${product.id}"]`).forEach(btn => {
      btn.classList.toggle("active", willAdd);
    });
    window.dispatchEvent(new CustomEvent("velora:wishlist-updated"));

    // Supabase DB Sync
    const client = window.supabaseClient || 
                   (typeof window.getSupabase === "function" ? window.getSupabase() : null) || 
                   (window.VeloraAuth ? window.VeloraAuth.getClient() : null);
    if (client) {
      try {
        let authUser = null;
        if (window.VeloraAuth && typeof window.VeloraAuth.getUser === 'function') {
          authUser = await window.VeloraAuth.getUser();
        }
        if (!authUser && client.auth) {
          const { data } = await client.auth.getUser();
          authUser = data ? data.user : null;
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);
        if (authUser && authUser.id && isUUID) {
          if (willAdd) {
            const { error: insErr } = await client.from("wishlist").insert([{
              user_id: authUser.id,
              catalog_type: 'main',
              product_id: product.id
            }]);
            if (insErr) console.warn("Main Wishlist DB Sync Insert Note:", insErr.message);
          } else {
            const { error: delErr } = await client.from("wishlist").delete()
              .eq("user_id", authUser.id)
              .eq("product_id", product.id);
            if (delErr) console.warn("Main Wishlist DB Sync Delete Note:", delErr.message);
          }
        }
      } catch (err) {
        console.warn("Main Wishlist DB Sync Notice:", err);
      }
    }
  }

  function updateWishlistButton() {
    if (!elements.wishlistBtn || !state.currentProduct) return;
    const isSaved = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function')
      ? window.VadiWishlist.has(state.currentProduct.id)
      : state.wishlist.has(state.currentProduct.id);
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

      // Add to Cart / Toggle Cart on related product card
      const addCartCardBtn = e.target.closest(".btn-add-to-cart");
      if (addCartCardBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleCart(addCartCardBtn.dataset.cartId);
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

    // 2b. 3D Payment Method Selection
    if (elements.cardPayOnline) {
      elements.cardPayOnline.addEventListener("click", () => {
        state.selectedPaymentMethod = "online";
        localStorage.setItem("velora_preferred_payment", "online");
        updatePaymentSelectionUI();
      });
    }

    if (elements.cardPayCod) {
      elements.cardPayCod.addEventListener("click", () => {
        state.selectedPaymentMethod = "cod";
        localStorage.setItem("velora_preferred_payment", "cod");
        updatePaymentSelectionUI();
      });
    }

    // 2c. Delivery Preference Pills
    if (elements.prefPills) {
      elements.prefPills.forEach(pill => {
        pill.addEventListener("click", () => {
          state.selectedDeliveryPreference = pill.dataset.deliveryPref || "Simple Delivery";
          localStorage.setItem("velora_preferred_delivery", state.selectedDeliveryPreference);
          updatePaymentSelectionUI();
        });
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

    // 6c. 3D Delivery Availability Pincode Checker
    setupPincodeChecker();

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

    // 7b. Mobile Sticky Purchase Bar Triggers
    if (elements.stickyAddCartBtn && elements.addCartBtn) {
      elements.stickyAddCartBtn.addEventListener("click", () => {
        elements.addCartBtn.click();
      });
    }
    if (elements.stickyBuyNowBtn && elements.buyNowBtn) {
      elements.stickyBuyNowBtn.addEventListener("click", () => {
        elements.buyNowBtn.click();
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
                  <div class="search-result-meta">${p.brand || 'VADI'} • ★ ${p.rating}</div>
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

    // 12. Cross-component Cart synchronization
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

