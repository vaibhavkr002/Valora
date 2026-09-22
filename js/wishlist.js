/**
 * VADI - Unified Wishlist Controller
 * Synchronized with window.VadiWishlist, Supabase PostgreSQL, and Cart Drawer
 * Supports products from both Main VADI and Sarojini Bazaar catalogs.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(Number(amount) || 0).toLocaleString('en-IN')));

  // State
  let loadedProducts = [];
  let currentSort = "recent";
  let cart = JSON.parse(localStorage.getItem("velora_cart") || "[]");

  // DOM Elements
  const elements = {
    grid: document.getElementById("wishlist-grid"),
    skeletons: document.getElementById("wishlist-skeletons"),
    emptyState: document.getElementById("wishlist-empty-state"),
    countBadge: document.getElementById("wishlist-count-badge"),
    toolbar: document.getElementById("wishlist-toolbar"),
    sortSelect: document.getElementById("wishlist-sort-select"),
    btnAddAll: document.getElementById("btn-add-all-cart"),
    btnClearAll: document.getElementById("btn-clear-wishlist"),

    // Badges
    navWishlistCount: document.getElementById("nav-wishlist-count"),
    navCartCount: document.getElementById("nav-cart-count"),
    drawerCartCount: document.getElementById("drawer-cart-count"),

    // Cart Drawer
    cartDrawerOverlay: document.getElementById("cart-drawer-overlay"),
    cartDrawerCloseBtn: document.getElementById("cart-drawer-close"),
    cartDrawerItems: document.getElementById("cart-drawer-items"),
    cartDrawerSubtotal: document.getElementById("cart-drawer-subtotal"),
    headerCartBtn: document.getElementById("header-cart-btn"),

    // Search
    navSearchInput: document.getElementById("nav-search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    searchResultsDropdown: document.getElementById("search-results-dropdown"),
    mobileToggleBtn: document.getElementById("mobile-toggle-btn")
  };

  function updateBadges() {
    const totalWish = window.VadiWishlist ? window.VadiWishlist.getCount() : loadedProducts.length;
    const totalCart = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);

    if (elements.navWishlistCount) elements.navWishlistCount.textContent = totalWish;
    if (elements.countBadge) elements.countBadge.textContent = `${totalWish} ${totalWish === 1 ? 'Item' : 'Items'}`;
    if (elements.navCartCount) elements.navCartCount.textContent = totalCart;
    if (elements.drawerCartCount) elements.drawerCartCount.textContent = totalCart;
  }

  // Load and sort products
  async function refreshWishlistData() {
    if (window.VadiWishlist && typeof window.VadiWishlist.getAllProducts === 'function') {
      loadedProducts = await window.VadiWishlist.getAllProducts();
    } else {
      // Fallback
      loadedProducts = [];
    }

    applySorting();
    renderWishlist();
  }

  function applySorting() {
    if (currentSort === "price-asc") {
      loadedProducts.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (currentSort === "price-desc") {
      loadedProducts.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (currentSort === "rating") {
      loadedProducts.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
  }

  function renderWishlist() {
    if (elements.skeletons) elements.skeletons.style.display = "none";

    if (loadedProducts.length === 0) {
      if (elements.grid) elements.grid.style.display = "none";
      if (elements.toolbar) elements.toolbar.style.display = "none";
      if (elements.emptyState) elements.emptyState.style.display = "block";
      updateBadges();
      return;
    }

    if (elements.emptyState) elements.emptyState.style.display = "none";
    if (elements.toolbar) elements.toolbar.style.display = "flex";
    if (elements.grid) elements.grid.style.display = "grid";

    elements.grid.innerHTML = loadedProducts.map(prod => {
      const isSarojini = prod.catalog_type === 'sarojini';
      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price || prod.originalPrice) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);

      const discountPill = discount > 0 ? `<span class="wishlist-discount-pill">-${discount}%</span>` : "";
      const origPriceHtml = origPrice > price ? `<span class="wishlist-original-price">${formatPrice(origPrice)}</span>` : "";

      const storeBadge = isSarojini
        ? `<span style="font-size:0.68rem; font-weight:800; color:#e11d48; background:rgba(225,29,72,0.12); border:1px solid rgba(225,29,72,0.3); padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">🛍️ SAROJINI BAZAAR</span>`
        : `<span style="font-size:0.68rem; font-weight:800; color:#2563eb; background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.3); padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">🏪 MAIN VADI</span>`;

      return `
        <article class="wishlist-card" data-product-id="${prod.id}" data-catalog-type="${isSarojini ? 'sarojini' : 'main'}">
          <div class="wishlist-card-media">
            <img src="${prod.image}" alt="${prod.name}" class="wishlist-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400';">
            
            <!-- Remove Button -->
            <button type="button" class="wishlist-card-heart-btn active" data-wishlist-id="${prod.id}" data-catalog-type="${isSarojini ? 'sarojini' : 'main'}" aria-label="Remove from Wishlist" title="Remove from Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <div class="wishlist-card-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
              <span class="wishlist-card-brand">${prod.brand || (isSarojini ? 'Sarojini Bazaar' : 'VADI')}</span>
              ${storeBadge}
            </div>
            
            <h3 class="wishlist-card-name" title="${prod.name}">${prod.name}</h3>
            
            <div class="wishlist-card-rating">
              <span class="wishlist-stars">★ ${prod.rating || '4.8'}</span>
              <span>(${prod.reviewsCount || prod.review_count || 38})</span>
            </div>

            <div class="wishlist-card-price-row">
              <span class="wishlist-current-price">${formatPrice(price)}</span>
              ${origPriceHtml}
              ${discountPill}
            </div>

            <button type="button" class="btn-wishlist-add-cart" data-cart-id="${prod.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span>Add to Cart</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    attachGridEvents();
    updateBadges();
  }

  function attachGridEvents() {
    // Card Navigation
    elements.grid.querySelectorAll(".wishlist-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".wishlist-card-heart-btn") || e.target.closest(".btn-wishlist-add-cart")) return;
        const pid = card.dataset.productId;
        const cType = card.dataset.catalogType;
        if (cType === "sarojini") {
          window.location.href = `sarojini-product-details.html?id=${encodeURIComponent(pid)}`;
        } else {
          window.location.href = `product.html?id=${encodeURIComponent(pid)}`;
        }
      });
    });

    // Remove from Wishlist
    elements.grid.querySelectorAll(".wishlist-card-heart-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pid = btn.dataset.wishlistId;
        const cType = btn.dataset.catalogType;
        const card = btn.closest(".wishlist-card");

        if (card) {
          card.classList.add("removing");
          setTimeout(async () => {
            if (window.VadiWishlist) {
              await window.VadiWishlist.toggle(pid, cType);
            }
            loadedProducts = loadedProducts.filter(p => String(p.id) !== String(pid));
            renderWishlist();
          }, 250);
        }
      });
    });

    // Add to Cart
    elements.grid.querySelectorAll(".btn-wishlist-add-cart").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const pid = btn.dataset.cartId;
        const product = loadedProducts.find(p => String(p.id) === String(pid));
        if (!product) return;

        btn.disabled = true;
        addToCart(product);

        if (window.CartDrawer && typeof window.CartDrawer.open === "function") {
          window.CartDrawer.open();
        }

        btn.innerHTML = `<span>✓ Added to Bag</span>`;
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span>Add to Cart</span>
          `;
        }, 1500);

        if (window.VadiWishlist) {
          window.VadiWishlist.notify ? window.VadiWishlist.notify(`Added "${product.name}" to cart!`, "success") : null;
        }
      });
    });
  }

  function addToCart(product, quantity = 1) {
    const isSarojini = product.catalog_type === 'sarojini';
    const isAdv = Boolean(product.advance_payment_enabled);
    const advType = product.advance_payment_type || 'fixed';
    const advVal = Number(product.advance_payment_value) || 0;
    let unitAdv = 0;
    if (isAdv) {
      unitAdv = advType === "percentage" ? Math.round(product.price * (advVal / 100)) : Math.min(product.price, advVal);
    }

    const existingIndex = cart.findIndex(it => String(it.id) === String(product.id));

    if (existingIndex > -1) {
      cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + quantity;
      cart[existingIndex].catalog_type = isSarojini ? 'sarojini' : 'main';
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        originalPrice: Number(product.original_price || product.originalPrice) || Number(product.price) || 0,
        image: product.image,
        quantity: quantity,
        catalog_type: isSarojini ? 'sarojini' : 'main',
        advance_payment_enabled: isAdv,
        advance_payment_type: advType,
        advance_payment_value: advVal,
        advance_per_unit: unitAdv,
        cod_per_unit: Math.max(0, (Number(product.price) || 0) - unitAdv),
        selectedSize: (product.sizes && product.sizes[0]) || "Standard",
        selectedColor: (product.colors && product.colors[0]) || "Default"
      });
    }

    localStorage.setItem("velora_cart", JSON.stringify(cart));
    updateBadges();
    window.dispatchEvent(new CustomEvent("velora:cart-updated"));
  }

  // Toolbar actions
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      applySorting();
      renderWishlist();
    });
  }

  if (elements.btnClearAll) {
    elements.btnClearAll.addEventListener("click", async () => {
      if (confirm("Are you sure you want to clear your entire wishlist?")) {
        if (window.VadiWishlist) {
          await window.VadiWishlist.clear();
        }
        loadedProducts = [];
        renderWishlist();
      }
    });
  }

  if (elements.btnAddAll) {
    elements.btnAddAll.addEventListener("click", () => {
      if (loadedProducts.length === 0) return;
      loadedProducts.forEach(p => addToCart(p, 1));
      if (window.CartDrawer && typeof window.CartDrawer.open === "function") {
        window.CartDrawer.open();
      }
      alert(`Added all ${loadedProducts.length} items to your shopping bag!`);
    });
  }

  // Listen for realtime or cross-store wishlist updates
  window.addEventListener("vadi:wishlist-updated", async () => {
    await refreshWishlistData();
  });
  window.addEventListener("velora:wishlist-updated", async () => {
    await refreshWishlistData();
  });

  // Initial load
  await refreshWishlistData();
});
