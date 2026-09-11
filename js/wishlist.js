/**
 * VELORA - Wishlist Controller
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Synchronized with localStorage ('velora_wishlist' and 'velora_cart')
 * Architected with async handlers ready for Supabase database migration.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- 1. State Management ---
  const state = {
    wishlist: new Set(JSON.parse(localStorage.getItem("velora_wishlist")) || ["prod-02", "prod-07", "prod-01", "prod-04"]),
    cart: JSON.parse(localStorage.getItem("velora_cart")) || [],
    currentSort: "recent"
  };

  // Sync back initial demo items if none was saved
  if (!localStorage.getItem("velora_wishlist")) {
    localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlist)));
  }

  // --- 2. DOM Elements ---
  const elements = {
    grid: document.getElementById("wishlist-grid"),
    skeletons: document.getElementById("wishlist-skeletons"),
    emptyState: document.getElementById("wishlist-empty-state"),
    countBadge: document.getElementById("wishlist-count-badge"),
    toolbar: document.getElementById("wishlist-toolbar"),
    sortSelect: document.getElementById("wishlist-sort-select"),
    btnAddAll: document.getElementById("btn-add-all-cart"),
    btnClearAll: document.getElementById("btn-clear-wishlist"),

    // Navbar Badges
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
    mobileToggleBtn: document.getElementById("mobile-toggle-btn"),

    toastContainer: document.getElementById("toast-container")
  };

  // --- 3. Notification Toast Utility ---
  function showToast(message, type = "info") {
    if (!elements.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-content" style="display:flex; align-items:center; gap:10px;">
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-message" style="font-size:0.9rem; font-weight:600;">${message}</span>
      </div>
      <button class="toast-close" aria-label="Close">✕</button>
    `;

    elements.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    const closeBtn = toast.querySelector(".toast-close");
    const removeToast = () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    };

    if (closeBtn) closeBtn.addEventListener("click", removeToast);
    setTimeout(removeToast, 3500);
  }

  // --- 4. Badges & Navbar Synchronization ---
  function updateBadges() {
    const totalWishlist = state.wishlist.size;
    const totalCart = state.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    if (elements.navWishlistCount) elements.navWishlistCount.textContent = totalWishlist;
    if (elements.navCartCount) elements.navCartCount.textContent = totalCart;
    if (elements.drawerCartCount) elements.drawerCartCount.textContent = totalCart;

    if (elements.countBadge) {
      elements.countBadge.textContent = `${totalWishlist} ${totalWishlist === 1 ? 'Item' : 'Items'}`;
    }
  }

  // --- 5. Data Retrieval & Sorting ---
  function getWishlistProducts() {
    const products = [];
    state.wishlist.forEach(id => {
      const p = window.getProductById ? window.getProductById(id) : null;
      if (p) products.push(p);
    });

    if (state.currentSort === "price-asc") {
      products.sort((a, b) => a.price - b.price);
    } else if (state.currentSort === "price-desc") {
      products.sort((a, b) => b.price - a.price);
    } else if (state.currentSort === "rating") {
      products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return products;
  }

  // --- 6. Render Wishlist Grid ---
  function renderWishlist() {
    const products = getWishlistProducts();

    if (products.length === 0) {
      if (elements.grid) elements.grid.style.display = "none";
      if (elements.skeletons) elements.skeletons.style.display = "none";
      if (elements.toolbar) elements.toolbar.style.display = "none";
      if (elements.emptyState) elements.emptyState.style.display = "block";
      updateBadges();
      return;
    }

    if (elements.emptyState) elements.emptyState.style.display = "none";
    if (elements.toolbar) elements.toolbar.style.display = "flex";
    if (elements.grid) elements.grid.style.display = "grid";

    elements.grid.innerHTML = products.map(product => {
      const discountPill = product.originalPrice && product.originalPrice > product.price
        ? `<span class="wishlist-discount-pill">-${Math.round((1 - product.price / product.originalPrice) * 100)}%</span>`
        : "";

      const origPrice = product.originalPrice
        ? `<span class="wishlist-original-price">${formatPrice(product.originalPrice)}</span>`
        : "";

      return `
        <article class="wishlist-card" data-product-id="${product.id}">
          <div class="wishlist-card-media">
            <img src="${product.image}" alt="${product.name}" class="wishlist-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400';">
            
            <!-- Remove from Wishlist Heart Button -->
            <button type="button" class="wishlist-card-heart-btn" data-wishlist-id="${product.id}" aria-label="Remove from Wishlist" title="Remove from Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <div class="wishlist-card-body">
            <span class="wishlist-card-brand">${product.brand || 'VELORA'}</span>
            <h3 class="wishlist-card-name" title="${product.name}">${product.name}</h3>
            
            <div class="wishlist-card-rating">
              <span class="wishlist-stars">★ ${product.rating || '4.9'}</span>
              <span>(${product.reviewsCount || 42})</span>
            </div>

            <div class="wishlist-card-price-row">
              <span class="wishlist-current-price">${formatPrice(product.price)}</span>
              ${origPrice}
              ${discountPill}
            </div>

            <button type="button" class="btn-wishlist-add-cart" data-cart-id="${product.id}">
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

  // --- 7. Event Delegation for Wishlist Cards ---
  function attachGridEvents() {
    // Card Navigation
    elements.grid.querySelectorAll(".wishlist-card").forEach(card => {
      card.addEventListener("click", (e) => {
        // Prevent navigation if user clicked buttons
        if (e.target.closest(".wishlist-card-heart-btn") || e.target.closest(".btn-wishlist-add-cart")) {
          return;
        }
        const pid = card.dataset.productId;
        if (pid) window.location.href = `product.html?id=${pid}`;
      });
    });

    // Remove from Wishlist
    elements.grid.querySelectorAll(".wishlist-card-heart-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.dataset.wishlistId;
        const card = btn.closest(".wishlist-card");
        const product = window.getProductById ? window.getProductById(pid) : null;

        if (card) {
          card.classList.add("removing");
          setTimeout(() => {
            state.wishlist.delete(pid);
            localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlist)));
            renderWishlist();
            showToast(`Removed "${product ? product.name : 'Item'}" from wishlist`, "info");
          }, 300);
        }
      });
    });

    // Single Add to Cart
    elements.grid.querySelectorAll(".btn-wishlist-add-cart").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.dataset.cartId;
        const product = window.getProductById ? window.getProductById(pid) : null;
        if (!product) return;

        addToCart(product);
        btn.classList.add("added");
        btn.innerHTML = `<span>✓ Added to Bag</span>`;
        setTimeout(() => {
          btn.classList.remove("added");
          btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span>Add to Cart</span>
          `;
        }, 1500);

        showToast(`Added "${product.name}" to your shopping bag!`, "success");
      });
    });
  }

  // --- 8. Cart Operations ---
  function addToCart(product, quantity = 1) {
    const existingIndex = state.cart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity = (state.cart[existingIndex].quantity || 1) + quantity;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: "US 10",
        color: "Obsidian Black",
        quantity: quantity
      });
    }

    localStorage.setItem("velora_cart", JSON.stringify(state.cart));
    updateBadges();
  }

  // Add All to Cart Handler
  if (elements.btnAddAll) {
    elements.btnAddAll.addEventListener("click", () => {
      const products = getWishlistProducts();
      if (products.length === 0) return;

      products.forEach(p => addToCart(p, 1));
      showToast(`All ${products.length} saved products added to your cart!`, "success");
      openCartDrawer();
    });
  }

  // Clear All Wishlist Handler
  if (elements.btnClearAll) {
    elements.btnClearAll.addEventListener("click", () => {
      if (state.wishlist.size === 0) return;
      if (confirm("Are you sure you want to clear all items from your wishlist?")) {
        state.wishlist.clear();
        localStorage.setItem("velora_wishlist", JSON.stringify([]));
        renderWishlist();
        showToast("Your wishlist has been cleared.", "info");
      }
    });
  }

  // Sorting Handler
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      renderWishlist();
    });
  }

  // --- 9. Cart Drawer Controller ---
  function openCartDrawer() {
    renderCartDrawerItems();
    if (elements.cartDrawerOverlay) elements.cartDrawerOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    if (elements.cartDrawerOverlay) elements.cartDrawerOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function renderCartDrawerItems() {
    if (!elements.cartDrawerItems) return;
    if (state.cart.length === 0) {
      elements.cartDrawerItems.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-weight:600;">Your shopping bag is empty.</p>
        </div>
      `;
      if (elements.cartDrawerSubtotal) elements.cartDrawerSubtotal.textContent = formatPrice(0);
      return;
    }

    let subtotal = 0;
    elements.cartDrawerItems.innerHTML = state.cart.map((item, index) => {
      const lineTotal = formatPrice(item.price * item.quantity);
      subtotal += item.price * item.quantity;

      return `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-details">
            <h4 class="cart-item-title">${item.name}</h4>
            <div class="cart-item-variants">
              ${item.size ? `<span>Size: ${item.size}</span>` : ''}
              ${item.color ? `<span>Color: ${item.color}</span>` : ''}
            </div>
            <div class="cart-item-price-row">
              <span class="cart-item-price">${lineTotal}</span>
              <div class="cart-qty-ctrl">
                <button type="button" class="btn-qty" data-drawer-action="dec" data-index="${index}">-</button>
                <span class="qty-num">${item.quantity}</span>
                <button type="button" class="btn-qty" data-drawer-action="inc" data-index="${index}">+</button>
              </div>
            </div>
          </div>
          <button type="button" class="cart-item-remove" data-drawer-action="del" data-index="${index}" aria-label="Remove item">✕</button>
        </div>
      `;
    }).join("");

    if (elements.cartDrawerSubtotal) {
      elements.cartDrawerSubtotal.textContent = formatPrice(subtotal);
    }

    // Attach drawer action buttons
    elements.cartDrawerItems.querySelectorAll("[data-drawer-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.drawerAction;
        const index = parseInt(btn.dataset.index, 10);

        if (action === "inc") {
          state.cart[index].quantity += 1;
        } else if (action === "dec") {
          state.cart[index].quantity -= 1;
          if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
        } else if (action === "del") {
          state.cart.splice(index, 1);
        }

        localStorage.setItem("velora_cart", JSON.stringify(state.cart));
        updateBadges();
        renderCartDrawerItems();
      });
    });
  }

  if (elements.headerCartBtn) elements.headerCartBtn.addEventListener("click", openCartDrawer);
  if (elements.cartDrawerCloseBtn) elements.cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
  if (elements.cartDrawerOverlay) {
    elements.cartDrawerOverlay.addEventListener("click", (e) => {
      if (e.target === elements.cartDrawerOverlay) closeCartDrawer();
    });
  }

  // --- 10. Live Search in Header ---
  if (elements.navSearchInput && elements.searchResultsDropdown) {
    elements.navSearchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = query ? "block" : "none";

      if (query.length < 2) {
        elements.searchResultsDropdown.classList.remove("active");
        return;
      }

      const results = (window.PRODUCTS_DATA || []).filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
      ).slice(0, 5);

      if (results.length === 0) {
        elements.searchResultsDropdown.innerHTML = `<div style="padding:14px; font-size:0.85rem; color:var(--text-muted); text-align:center;">No matching products found</div>`;
      } else {
        elements.searchResultsDropdown.innerHTML = results.map(p => `
          <a href="product.html?id=${p.id}" class="search-result-item" style="display:flex; align-items:center; gap:12px; padding:10px 14px; text-decoration:none; border-bottom:1px solid var(--border-light);">
            <img src="${p.image}" alt="${p.name}" style="width:38px; height:38px; border-radius:6px; object-fit:cover;">
            <div>
              <strong style="font-size:0.85rem; color:var(--text-main); display:block;">${p.name}</strong>
              <span style="font-size:0.75rem; color:var(--accent); font-weight:700;">${formatPrice(p.price)}</span>
            </div>
          </a>
        `).join("");
      }

      elements.searchResultsDropdown.classList.add("active");
    });

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener("click", () => {
        elements.navSearchInput.value = "";
        elements.searchClearBtn.style.display = "none";
        elements.searchResultsDropdown.classList.remove("active");
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-search-container")) {
        elements.searchResultsDropdown.classList.remove("active");
      }
    });
  }

  // --- 11. Initial Async Simulation & Render ---
  updateBadges();

  // Simulate fast 200ms loading for skeleton demonstration
  setTimeout(() => {
    if (elements.skeletons) elements.skeletons.style.display = "none";
    renderWishlist();
  }, 220);

  // Sync and reactive listener for live Supabase products
  if (window.syncProductsFromSupabase) {
    window.syncProductsFromSupabase().then(() => {
      if (elements.skeletons) elements.skeletons.style.display = "none";
      renderWishlist();
      updateBadges();
    }).catch(() => {});
  }
  window.addEventListener("velora:products-synced", () => {
    if (elements.skeletons) elements.skeletons.style.display = "none";
    renderWishlist();
    updateBadges();
  });
});

