/**
 * VELORA - Unified Cart Drawer Controller
 * Single source of truth for Cart Drawer across all customer-facing pages.
 * Handles opening, closing, rendering, badge syncing, quantity changes, item removal, and auto-injection.
 */

(function () {
  'use strict';

  // Format price helper
  function formatINR(amount) {
    if (typeof window.formatINR === "function") return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return "₹" + n.toLocaleString("en-IN");
  }

  // Canonical Cart Drawer HTML template for auto-injection if missing
  const CANONICAL_DRAWER_HTML = `
  <div id="cart-drawer-overlay" class="cart-drawer-overlay" aria-hidden="true">
    <div class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div class="cart-drawer-header">
        <h3 id="cart-title" class="cart-drawer-title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          Your Shopping Cart
        </h3>
        <button id="cart-drawer-close" class="cart-close-btn" aria-label="Close Cart">✕</button>
      </div>

      <!-- Free Shipping Meter -->
      <div class="free-shipping-box">
        <div class="free-shipping-text">
          <span id="free-shipping-msg">🎉 <strong>100% FREE Delivery Across India</strong> on all orders!</span>
        </div>
        <div class="free-shipping-progress">
          <div id="free-shipping-fill" class="free-shipping-fill" style="width: 100%;"></div>
        </div>
      </div>

      <!-- Cart Items List -->
      <div id="cart-items-container" class="cart-drawer-items">
        <!-- Injected via JavaScript -->
      </div>

      <!-- Empty Cart State -->
      <div id="cart-empty-state" class="cart-empty-view" style="display: none;">
        <div class="cart-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </div>
        <h4>Your Cart is Empty</h4>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 8px 0 20px;">Looks like you haven't added any items yet.</p>
        <button type="button" class="btn-primary btn-start-shopping" onclick="window.location.href='shop.html';">
          Start Shopping
        </button>
      </div>

      <!-- Cart Footer -->
      <div class="cart-drawer-footer">
        <div class="cart-summary-row">
          <span>Subtotal</span>
          <span id="cart-subtotal" style="font-weight: 700; color: var(--text-main);">₹0</span>
        </div>
        <div class="cart-summary-row">
          <span>Standard Shipping</span>
          <span style="color: var(--color-success); font-weight: 700;">FREE</span>
        </div>
        <div class="cart-summary-row cart-summary-total">
          <span>Total (Incl. Taxes)</span>
          <span id="cart-total">₹0</span>
        </div>
        <div id="cart-advance-breakdown" style="display: none; padding: 8px 0; border-top: 1px dashed var(--border-color); margin-top: 6px;">
          <div class="cart-summary-row" style="margin-bottom: 2px;">
            <span style="color: #6366f1; font-weight: 600;">Advance Payable Now:</span>
            <span id="cart-advance-payable" style="font-weight: 700; color: #6366f1;">₹0</span>
          </div>
          <div class="cart-summary-row" style="margin-bottom: 0;">
            <span style="color: var(--text-muted);">Remaining by COD:</span>
            <span id="cart-cod-payable" style="font-weight: 600; color: var(--text-main);">₹0</span>
          </div>
        </div>
        <button type="button" id="checkout-btn" class="btn-checkout">
          <span>Proceed to Checkout</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </button>
      </div>
    </div>
  </div>`;

  // Get current cart items from localStorage
  function getCart() {
    try {
      const raw = localStorage.getItem("velora_cart");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Error reading velora_cart:", e);
      return [];
    }
  }

  // Save cart items to localStorage & dispatch update events
  function saveCart(cart) {
    try {
      localStorage.setItem("velora_cart", JSON.stringify(cart));
      updateBadges();
      window.dispatchEvent(new CustomEvent("velora:cart-updated", { detail: { cart } }));
    } catch (e) {
      console.error("Error saving velora_cart:", e);
    }
  }

  // Ensure cart-drawer-overlay is present in DOM
  function ensureDrawerMarkup() {
    let overlay = document.getElementById("cart-drawer-overlay");
    if (!overlay) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = CANONICAL_DRAWER_HTML.trim();
      overlay = wrapper.firstElementChild;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // Update all badges across header and mobile drawers
  function updateBadges() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    // Update all badge elements
    document.querySelectorAll(".cart-count-badge, #nav-cart-count, #drawer-cart-count").forEach(b => {
      b.textContent = count;
      b.classList.remove("pop");
      void b.offsetWidth; // trigger reflow
      b.classList.add("pop");
    });
  }

  // Render items inside the drawer
  function renderCartDrawer() {
    const overlay = ensureDrawerMarkup();
    const container = document.getElementById("cart-items-container") || overlay.querySelector(".cart-drawer-items");
    const emptyState = document.getElementById("cart-empty-state") || overlay.querySelector(".cart-empty-view");
    const subtotalEl = document.getElementById("cart-subtotal") || document.getElementById("cart-drawer-subtotal");
    const totalEl = document.getElementById("cart-total");
    const advBreakdown = document.getElementById("cart-advance-breakdown");
    const advPayableEl = document.getElementById("cart-advance-payable");
    const codPayableEl = document.getElementById("cart-cod-payable");

    const cart = getCart();

    if (cart.length === 0) {
      if (container) container.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (subtotalEl) subtotalEl.textContent = formatINR(0);
      if (totalEl) totalEl.textContent = formatINR(0);
      if (advBreakdown) advBreakdown.style.display = "none";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    let subtotal = 0;
    let totalAdvance = 0;
    let totalCod = 0;
    let hasAdvanceItems = false;

    const itemsHtml = cart.map((item, index) => {
      const qty = Number(item.quantity) || 1;
      const isFreeBogo = Boolean(item.is_free_bogo);
      const itemPrice = isFreeBogo ? 0 : (Number(item.price) || 0);
      const lineTotal = itemPrice * qty;
      subtotal += lineTotal;

      // Advance payment calculation
      const isItemOnline = item.selected_payment_method === "online";
      const isAdv = Boolean(item.advance_payment_enabled);
      let itemAdv = 0;
      let itemCod = lineTotal;

      if (!isItemOnline && isAdv) {
        hasAdvanceItems = true;
        itemAdv = (Number(item.advance_per_unit) || 0) * qty;
        itemCod = Math.max(0, lineTotal - itemAdv);
        totalAdvance += itemAdv;
        totalCod += itemCod;
      }

      // Badges
      const itemGifts = Array.isArray(item.gift_bundle) ? item.gift_bundle : [];
      const payBadge = isItemOnline
        ? (itemGifts.length > 0 
            ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">⚡ Online (${itemGifts.length} Gifts)</span>`
            : `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">⚡ Online Paid</span>`)
        : (isAdv 
            ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#6366f1; background:rgba(99,102,241,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 COD Adv. Req.</span>`
            : `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#d97706; background:rgba(217,119,6,0.12); padding:1px 6px; border-radius:4px; margin-left:6px;">💵 100% COD</span>`);

      const bogoBadge = isFreeBogo
        ? `<span style="display:inline-block; font-size:0.68rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:1px 5px; border-radius:4px; margin-left:6px;">🎁 FREE BOGO</span>`
        : '';

      const priceDisplay = isFreeBogo
        ? `<span class="cart-item-price" style="color:#059669; font-weight:800;">FREE (₹0) <span style="font-size:0.75rem; text-decoration:line-through; color:var(--text-muted); margin-left:4px;">${formatINR(item.originalPrice || 0)}</span></span>`
        : `<span class="cart-item-price">${formatINR(lineTotal)}</span>`;

      const qtyControls = isFreeBogo
        ? `<span style="font-size:0.76rem; font-weight:600; color:#059669; padding:2px 8px; background:rgba(16,185,129,0.08); border-radius:4px;">Qty: 1 (Free Gift)</span>`
        : `
          <div class="cart-qty-control">
            <button type="button" class="cart-qty-btn" data-cart-delta="-1" data-cart-idx="${index}">-</button>
            <span class="cart-qty-val">${qty}</span>
            <button type="button" class="cart-qty-btn" data-cart-delta="1" data-cart-idx="${index}">+</button>
          </div>
        `;

      const fallbackImg = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80";

      return `
        <div class="cart-item-card" data-cart-index="${index}">
          <img class="cart-item-img" src="${item.image || fallbackImg}" alt="${item.name || 'Product'}">
          <div class="cart-item-details">
            <h4 class="cart-item-title">${item.name || 'Product Item'}</h4>
            <span class="cart-item-meta">${item.size ? item.size + ' • ' : ''}${item.color || 'Default'} ${payBadge} ${bogoBadge}</span>
            <div class="cart-item-bottom">
              ${qtyControls}
              ${priceDisplay}
              <button type="button" class="cart-item-remove" data-cart-remove="${index}" title="Remove item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (container) container.innerHTML = itemsHtml;
    if (subtotalEl) subtotalEl.textContent = formatINR(subtotal);
    if (totalEl) totalEl.textContent = formatINR(subtotal);

    if (advBreakdown) {
      if (hasAdvanceItems && totalAdvance > 0) {
        advBreakdown.style.display = "block";
        if (advPayableEl) advPayableEl.textContent = formatINR(totalAdvance);
        if (codPayableEl) codPayableEl.textContent = formatINR(totalCod);
      } else {
        advBreakdown.style.display = "none";
      }
    }
  }

  // Open Cart Drawer smoothly
  function openCartDrawer() {
    const overlay = ensureDrawerMarkup();
    renderCartDrawer();
    overlay.classList.add("active");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // Close Cart Drawer smoothly
  function closeCartDrawer() {
    const overlay = document.getElementById("cart-drawer-overlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  let lastCartActionTime = 0;

  // Add Item to Cart (Rapid-Click Protected)
  function addToCart(product, options = {}) {
    if (!product) return;
    const now = Date.now();
    if (now - lastCartActionTime < 100) return;
    lastCartActionTime = now;

    const cart = getCart();
    const pid = product.id || product.supabase_id;
    const selectedSize = options.size || product.size || "Standard";
    const selectedColor = options.color || product.color || "Default";
    const paymentMethod = options.selected_payment_method || product.selected_payment_method || "online";

    const existingIdx = cart.findIndex(it => 
      (it.id === pid || it.supabase_id === pid) &&
      it.size === selectedSize &&
      it.color === selectedColor &&
      it.selected_payment_method === paymentMethod
    );

    if (existingIdx >= 0) {
      cart[existingIdx].quantity = (Number(cart[existingIdx].quantity) || 1) + (Number(options.quantity) || 1);
    } else {
      cart.push({
        id: pid,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image || product.image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
        size: selectedSize,
        color: selectedColor,
        quantity: Number(options.quantity) || 1,
        selected_payment_method: paymentMethod,
        advance_payment_enabled: Boolean(product.advance_payment_enabled),
        advance_payment_type: product.advance_payment_type || "fixed",
        advance_payment_value: Number(product.advance_payment_value) || 0,
        advance_per_unit: Number(product.advance_per_unit) || 0,
        cod_per_unit: Number(product.cod_per_unit) || 0,
        category_id: product.category_id || null,
        gift_bundle: options.gift_bundle || product.gift_bundle || null,
        gift_offer_id: options.gift_offer_id || product.gift_offer_id || null
      });
    }

    saveCart(cart);
    openCartDrawer();
  }

  // Update item quantity
  function updateCartQuantity(index, delta) {
    const cart = getCart();
    if (!cart[index]) return;
    const currentQty = Number(cart[index].quantity) || 1;
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQty;
    }
    saveCart(cart);
    renderCartDrawer();
  }

  // Remove item from cart
  function removeFromCart(index) {
    const cart = getCart();
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveCart(cart);
    renderCartDrawer();
  }

  // ==========================================================================
  // GLOBAL EVENT DELEGATION
  // Uses document-level capture to guarantee triggers work on any page regardless
  // of dynamic DOM injection, timing, or page-specific scripts.
  // ==========================================================================
  function initGlobalListeners() {
    document.addEventListener("click", (e) => {
      // 1. Open Cart Trigger
      const cartTrigger = e.target.closest(".cart-drawer-trigger, #header-cart-btn, [data-open-cart]");
      if (cartTrigger) {
        e.preventDefault();
        e.stopPropagation();
        openCartDrawer();
        return;
      }

      // 2. Close Cart Trigger (Close button)
      const closeBtn = e.target.closest("#cart-drawer-close, .cart-close-btn");
      if (closeBtn && closeBtn.closest("#cart-drawer-overlay")) {
        e.preventDefault();
        closeCartDrawer();
        return;
      }

      // 3. Close on backdrop click (outside .cart-drawer)
      const overlay = document.getElementById("cart-drawer-overlay");
      if (overlay && e.target === overlay) {
        e.preventDefault();
        closeCartDrawer();
        return;
      }

      // 4. Cart Drawer Quantity controls (+ / -)
      const qtyBtn = e.target.closest(".cart-qty-btn");
      if (qtyBtn && qtyBtn.closest("#cart-drawer-overlay")) {
        e.preventDefault();
        const delta = parseInt(qtyBtn.dataset.cartDelta, 10);
        const idx = parseInt(qtyBtn.dataset.cartIdx, 10);
        if (!isNaN(delta) && !isNaN(idx)) {
          updateCartQuantity(idx, delta);
        }
        return;
      }

      // 5. Cart Drawer Remove button
      const removeBtn = e.target.closest(".cart-item-remove");
      if (removeBtn && removeBtn.closest("#cart-drawer-overlay")) {
        e.preventDefault();
        const idx = parseInt(removeBtn.dataset.cartRemove, 10);
        if (!isNaN(idx)) {
          removeFromCart(idx);
        }
        return;
      }

      // 6. Checkout button click
      const checkoutBtn = e.target.closest("#checkout-btn, .btn-checkout");
      if (checkoutBtn && checkoutBtn.closest("#cart-drawer-overlay")) {
        e.preventDefault();
        const cart = getCart();
        if (cart.length === 0) {
          alert("Your cart is empty. Please add products before checking out.");
          return;
        }
        window.location.href = "checkout.html";
        return;
      }
    }, true); // Use capture phase so nothing can stop propagation

    // ESC key closes drawer
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCartDrawer();
      }
    });

    // Cross-tab and window sync
    window.addEventListener("storage", (e) => {
      if (e.key === "velora_cart") {
        updateBadges();
        const overlay = document.getElementById("cart-drawer-overlay");
        if (overlay && (overlay.classList.contains("active") || overlay.classList.contains("open"))) {
          renderCartDrawer();
        }
      }
    });

    // Custom event sync
    window.addEventListener("velora:cart-updated", () => {
      updateBadges();
      const overlay = document.getElementById("cart-drawer-overlay");
      if (overlay && (overlay.classList.contains("active") || overlay.classList.contains("open"))) {
        renderCartDrawer();
      }
    });
  }

  // Initialize immediately or on DOM ready
  function init() {
    ensureDrawerMarkup();
    updateBadges();
    initGlobalListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export to window
  window.VeloraCart = {
    getCart,
    saveCart,
    open: openCartDrawer,
    close: closeCartDrawer,
    render: renderCartDrawer,
    add: addToCart,
    addItem: (item, qty = 1) => {
      addToCart(item, qty);
      openCartDrawer();
    },
    sync: () => {
      updateBadges();
      renderCartDrawer();
    },
    updateQty: updateCartQuantity,
    remove: removeFromCart,
    updateBadges
  };

  window.openCartDrawer = openCartDrawer;
  window.closeCartDrawer = closeCartDrawer;
  window.renderCartDrawer = renderCartDrawer;
  window.updateCartBadges = updateBadges;
})();
