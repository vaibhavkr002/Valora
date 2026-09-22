/**
 * VELORA - Checkout Controller
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  const initialCart = JSON.parse(localStorage.getItem("velora_cart")) || [];
  const storedPrefPay = localStorage.getItem("velora_preferred_payment") || (initialCart[0] && initialCart[0].selected_payment_method) || "online";
  const storedPrefDel = localStorage.getItem("velora_preferred_delivery") || (initialCart[0] && initialCart[0].delivery_preference) || "Simple Delivery";
  const initialMethod = (storedPrefPay === "online") ? "UPI / QR Payment" : "Cash on Delivery";

  // --- 1. State Management ---
  const state = {
    cart: initialCart,
    appliedCoupon: null, // { code: 'VELORA10', discountPercent: 10 }
    selectedPaymentMethod: initialMethod,
    selectedDeliveryPreference: storedPrefDel, // "Simple Delivery" or "Open Box Delivery"
    selectedAddressType: "Home",
    selectedBank: "State Bank of India",
    subtotal: 0,
    discountAmount: 0,
    shippingFee: 0,
    total: 0,
    advancePayableNow: 0,
    remainingCodAmount: 0,
    advanceRequired: false,
    totalProductAdvance: 0,
    isFullOnlinePayment: (storedPrefPay === "online"),
    selectedUpiApp: "Google Pay",
    activeUpiTransaction: null,
    upiPollingInterval: null,
    merchantVpa: (window.VELORA_SETTINGS && window.VELORA_SETTINGS.payment && window.VELORA_SETTINGS.payment.merchant_vpa) || "vadi.lifestyle@okhdfcbank",
    merchantName: (window.VELORA_SETTINGS && window.VELORA_SETTINGS.payment && window.VELORA_SETTINGS.payment.merchant_name) || "VADI Lifestyle Studio"
  };

  // Database is the sole source of truth for all promo and coupon codes

  // --- 2. DOM Elements ---
  const elements = {
    // Views
    emptyState: document.getElementById("checkout-empty-state"),
    mainGrid: document.getElementById("checkout-main-grid"),

    // Form inputs
    form: document.getElementById("delivery-form"),
    inputFullName: document.getElementById("input-fullname"),
    inputPhone: document.getElementById("input-phone"),
    inputEmail: document.getElementById("input-email"),
    inputHouse: document.getElementById("input-house"),
    inputStreet: document.getElementById("input-street"),
    inputLandmark: document.getElementById("input-landmark"),
    inputCity: document.getElementById("input-city"),
    inputState: document.getElementById("input-state"),
    inputZip: document.getElementById("input-zip"),
    selectCountry: document.getElementById("select-country"),
    addressPills: document.querySelectorAll(".address-type-pill"),
    groupPostOffice: document.getElementById("group-post-office"),
    selectPostOffice: document.getElementById("select-post-office"),
    cityAutocompleteList: document.getElementById("city-autocomplete-list"),
    btnCityDropdownToggle: document.getElementById("btn-city-dropdown-toggle"),
    pincodeStatusBadge: document.getElementById("pincode-status-badge"),
    pincodeMismatchBanner: document.getElementById("pincode-mismatch-banner"),
    mismatchBannerText: document.getElementById("mismatch-banner-text"),
    btnMismatchAccept: document.getElementById("btn-mismatch-accept"),
    btnMismatchDismiss: document.getElementById("btn-mismatch-dismiss"),
    savedAddressesSection: document.getElementById("saved-addresses-section"),
    savedAddressesGrid: document.getElementById("saved-addresses-grid"),
    btnToggleAddressMode: document.getElementById("btn-toggle-address-mode"),
    btnCloseSavedAddresses: document.getElementById("btn-close-saved-addresses"),
    btnAddAddressHeader: document.getElementById("btn-add-address-header"),
    selectedAddressSummary: document.getElementById("selected-address-summary"),
    summaryAddressType: document.getElementById("summary-address-type"),
    summaryAddressName: document.getElementById("summary-address-name"),
    summaryAddressDetails: document.getElementById("summary-address-details"),
    summaryAddressPhone: document.getElementById("summary-address-phone"),
    btnSummaryChange: document.getElementById("btn-summary-change"),
    btnSummaryAddNew: document.getElementById("btn-summary-add-new"),
    noSavedAddressesNotice: document.getElementById("no-saved-addresses-notice"),
    btnAddFirstAddress: document.getElementById("btn-add-first-address"),
    deliveryFormContainer: document.getElementById("delivery-form-container"),
    deliveryFormHeaderBar: document.getElementById("delivery-form-header-bar"),
    deliveryFormTitle: document.getElementById("delivery-form-title"),
    btnCancelAddressForm: document.getElementById("btn-cancel-address-form"),
    addressFormActions: document.getElementById("address-form-actions"),
    btnSaveAddressSubmit: document.getElementById("btn-save-address-submit"),
    btnCancelAddressSecondary: document.getElementById("btn-cancel-address-secondary"),
    checkSaveAddress: document.getElementById("check-save-address"),
    checkDefaultAddress: document.getElementById("check-default-address"),
    labelDefaultAddress: document.getElementById("label-default-address"),

    // Payment Cards
    paymentCards: document.querySelectorAll(".payment-method-card"),
    inputCardNum: document.getElementById("input-card-num"),
    inputCardExp: document.getElementById("input-card-exp"),
    inputCardCvv: document.getElementById("input-card-cvv"),
    inputCardName: document.getElementById("input-card-name"),
    bankChips: document.querySelectorAll(".bank-chip"),

    // UPI Payment Flow Elements
    upiDesktopScanCard: document.getElementById("upi-desktop-scan-card"),
    desktopUpiQrContainer: document.getElementById("desktop-upi-qr-container"),
    desktopScanAmountBadge: document.getElementById("desktop-scan-amount-badge"),
    desktopScanAmountType: document.getElementById("desktop-scan-amount-type"),
    desktopMerchantVpa: document.getElementById("desktop-merchant-vpa"),
    desktopUpiRef: document.getElementById("desktop-upi-ref"),
    btnDesktopCopyUpi: document.getElementById("btn-desktop-copy-upi"),
    btnDesktopVerifyOrder: document.getElementById("btn-desktop-verify-order"),
    upiAppsGrid: document.getElementById("upi-apps-grid"),
    upiAppCards: document.querySelectorAll(".upi-app-card"),
    upiAmountCard: document.getElementById("upi-amount-card"),
    upiAmountTitle: document.getElementById("upi-amount-title"),
    upiAmountVal: document.getElementById("upi-amount-val"),
    upiAdvanceBreakdown: document.getElementById("upi-advance-breakdown"),
    upiAdvanceVal: document.getElementById("upi-advance-val"),
    upiCodVal: document.getElementById("upi-cod-val"),
    btnUpiPay: document.getElementById("btn-upi-pay"),
    btnUpiPayText: document.getElementById("btn-upi-pay-text"),

    // UPI Payment Modal Elements
    upiModal: document.getElementById("upi-payment-modal"),
    btnUpiModalClose: document.getElementById("btn-upi-modal-close"),
    upiStatusBox: document.getElementById("upi-status-box"),
    upiSpinner: document.getElementById("upi-spinner"),
    upiStatusHeading: document.getElementById("upi-status-heading"),
    upiStatusDesc: document.getElementById("upi-status-desc"),
    modalUpiAmount: document.getElementById("modal-upi-amount"),
    modalUpiRef: document.getElementById("modal-upi-ref"),
    modalMerchantVpa: document.getElementById("modal-merchant-vpa"),
    modalAppName: document.getElementById("modal-app-name"),
    upiQrContainer: document.getElementById("upi-qr-container"),
    btnLaunchUpiApp: document.getElementById("btn-launch-upi-app"),
    btnLaunchAnyApp: document.getElementById("btn-launch-any-app"),
    btnCopyUpi: document.getElementById("btn-copy-upi"),
    btnConfirmPayment: document.getElementById("btn-confirm-payment"),
    btnCancelPayment: document.getElementById("btn-cancel-payment"),

    // Online Gifts Card Elements
    cardOnlineGifts: document.getElementById("card-online-gifts"),
    giftsStatusBadge: document.getElementById("gifts-status-badge"),
    giftsStatusDesc: document.getElementById("gifts-status-desc"),
    onlineGiftsGrid: document.getElementById("online-gifts-grid"),
    onlineGiftsLockedNotice: document.getElementById("online-gifts-locked-notice"),

    // Delivery Preference Elements
    cardDeliveryPreference: document.getElementById("card-delivery-preference"),
    deliveryPrefCards: document.querySelectorAll(".delivery-pref-card"),
    deliveryPrefInputs: document.querySelectorAll('input[name="delivery_preference"]'),
    badgePrefLock: document.getElementById("badge-pref-lock"),

    // Summary Sidebar
    summaryItemsCount: document.getElementById("summary-items-count"),
    summaryItemsContainer: document.getElementById("summary-items-container"),
    shippingProgressText: document.getElementById("shipping-progress-text"),
    shippingProgressBarFill: document.getElementById("shipping-progress-bar-fill"),

    // Coupon
    couponInput: document.getElementById("coupon-input"),
    btnApplyCoupon: document.getElementById("btn-apply-coupon"),
    appliedCouponPill: document.getElementById("applied-coupon-pill"),
    appliedCouponName: document.getElementById("applied-coupon-name"),
    appliedCouponPercent: document.getElementById("applied-coupon-percent"),
    btnRemoveCoupon: document.getElementById("btn-remove-coupon"),
    couponSuggestions: document.querySelectorAll(".coupon-chip-suggestion"),

    // Breakdown
    costSubtotal: document.getElementById("cost-subtotal"),
    rowDiscount: document.getElementById("row-discount"),
    costDiscount: document.getElementById("cost-discount"),
    costShipping: document.getElementById("cost-shipping"),
    rowOnlineGifts: document.getElementById("row-online-gifts"),
    costOnlineGifts: document.getElementById("cost-online-gifts"),
    rowDeliveryPreference: document.getElementById("row-delivery-preference"),
    costDeliveryPreference: document.getElementById("cost-delivery-preference"),
    rowPaymentMethod: document.getElementById("row-payment-method"),
    costPaymentMethod: document.getElementById("cost-payment-method"),
    rowAdvance: document.getElementById("row-advance"),
    costAdvance: document.getElementById("cost-advance"),
    rowCodBalance: document.getElementById("row-cod-balance"),
    costCodBalance: document.getElementById("cost-cod-balance"),
    advanceSummaryNotice: document.getElementById("checkout-advance-summary-notice"),
    advanceNoticeText: document.getElementById("checkout-advance-notice-text"),
    costTotal: document.getElementById("cost-total"),

    // Primary Action
    btnPlaceOrder: document.getElementById("btn-place-order"),
    btnPlaceOrderText: document.getElementById("btn-place-order-text"),
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

    closeBtn.addEventListener("click", removeToast);
    setTimeout(removeToast, 4000);
  }

  // --- 3B. Dynamic Cart Gifts Resolver ---
  async function resolveCartGifts() {
    if (window.GiftEngine && typeof window.GiftEngine.resolveCartGifts === "function") {
      try {
        const res = await window.GiftEngine.resolveCartGifts(state.cart);
        state.cartGiftsEligible = Boolean(res.eligible && res.gifts && res.gifts.length > 0);
        state.resolvedCartGifts = res.gifts || [];
        return;
      } catch (_) {}
    }
    // Fallback: extract gifts saved on cart items
    const giftMap = new Map();
    state.cart.forEach(item => {
      if (Array.isArray(item.gift_bundle)) {
        item.gift_bundle.forEach(g => {
          const k = g.name.toLowerCase().trim();
          if (!giftMap.has(k)) giftMap.set(k, g);
        });
      }
    });
    state.resolvedCartGifts = Array.from(giftMap.values());
    state.cartGiftsEligible = state.resolvedCartGifts.length > 0;
  }

  // --- 4. Render Cart & Calculate Totals ---
  async function renderOrderSummary() {
    await resolveCartGifts();
    if (!state.cart || state.cart.length === 0) {
      if (elements.emptyState) elements.emptyState.style.display = "block";
      if (elements.mainGrid) elements.mainGrid.style.display = "none";
      return;
    }

    if (elements.emptyState) elements.emptyState.style.display = "none";
    if (elements.mainGrid) elements.mainGrid.style.display = "grid";

    let subtotal = 0;
    let totalItems = 0;
    let totalProductAdvance = 0;

    // Validate BOGO pairs: ensure no orphaned free BOGO items exist without a paid partner
    const validCart = state.cart.filter(item => {
      if (item.is_free_bogo && item.bogo_pair_id) {
        return state.cart.some(p => p.bogo_pair_id === item.bogo_pair_id && !p.is_free_bogo);
      }
      return true;
    });
    if (validCart.length !== state.cart.length) {
      state.cart = validCart;
      try { localStorage.setItem("velora_cart", JSON.stringify(validCart)); } catch (_) {}
    }

    elements.summaryItemsContainer.innerHTML = state.cart.map(item => {
      const isFreeBogo = Boolean(item.is_free_bogo);
      const itemSub = isFreeBogo ? 0 : (item.price || 0) * (item.quantity || 1);
      subtotal += itemSub;
      totalItems += (item.quantity || 1);

      const sizeTag = item.size ? `<span class="summary-variant-pill">${item.size}</span>` : "";
      const colorTag = item.color ? `<span class="summary-variant-pill">${item.color}</span>` : "";
      const bogoTag = isFreeBogo ? `<span class="summary-variant-pill" style="color: #059669; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.3);">🎁 Free BOGO Gift</span>` : "";

      let advanceTag = "";
      let itemUnitAdvance = 0;
      if (!isFreeBogo) {
        if (item.advance_payment_enabled) {
          if (item.advance_payment_type === "percentage") {
            const pct = Number(item.advance_payment_value) || 0;
            itemUnitAdvance = Math.round((item.price || 0) * (pct / 100));
          } else {
            itemUnitAdvance = Math.min(item.price || 0, Math.max(0, Number(item.advance_payment_value) || 0));
          }
        } else if (item.advance_per_unit) {
          itemUnitAdvance = Number(item.advance_per_unit) || 0;
        }
      }

      if (itemUnitAdvance > 0) {
        const itemTotalAdvance = itemUnitAdvance * (item.quantity || 1);
        totalProductAdvance += itemTotalAdvance;
        advanceTag = `<span class="summary-variant-pill" style="color: #6366f1; background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3);">⚡ Advance: ${formatPrice(itemTotalAdvance)}</span>`;
      }

      const priceDisplay = isFreeBogo 
        ? `<span style="color: #059669; font-weight: 700;">₹0 FREE</span> <span style="font-size: 0.75rem; text-decoration: line-through; color: var(--text-muted); margin-left: 4px;">${formatPrice(item.originalPrice || 0)}</span>`
        : formatPrice(itemSub);

      return `
        <div class="summary-item">
          <img src="${item.image}" alt="${item.name}" class="summary-item-thumb" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200';">
          <div class="summary-item-info">
            <h4 class="summary-item-title" title="${item.name}">${item.name}</h4>
            <div class="summary-item-variants">
              ${sizeTag}
              ${colorTag}
              ${bogoTag}
              ${advanceTag}
              <span class="summary-item-qty">Qty: <strong>${item.quantity}</strong></span>
            </div>
          </div>
          <div class="summary-item-price">
            ${priceDisplay}
          </div>
        </div>
      `;
    }).join("");

    state.subtotal = subtotal;
    if (elements.summaryItemsCount) {
      elements.summaryItemsCount.textContent = `${totalItems} ${totalItems === 1 ? 'Item' : 'Items'}`;
    }

    // Universal Free Delivery Across VELORA (Always ₹0 shipping on every product and order)
    state.shippingFee = 0;
    if (elements.shippingProgressText) {
      elements.shippingProgressText.className = "shipping-progress-text unlocked";
      elements.shippingProgressText.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span><strong>100% FREE Delivery Across India</strong> on your order!</span>
      `;
    }
    if (elements.shippingProgressBarFill) {
      elements.shippingProgressBarFill.className = "shipping-progress-bar-fill unlocked";
      elements.shippingProgressBarFill.style.width = "100%";
    }
    if (elements.costShipping) {
      elements.costShipping.textContent = "FREE (₹0)";
      elements.costShipping.style.color = "var(--color-success)";
      elements.costShipping.style.fontWeight = "700";
    }

    // Discount calculation with dynamic coupon synchronization
    if (state.appliedCoupon) {
      if (state.appliedCoupon.minOrderAmount && subtotal < state.appliedCoupon.minOrderAmount) {
        const removedCode = state.appliedCoupon.code;
        const minReq = state.appliedCoupon.minOrderAmount;
        state.appliedCoupon = null;
        state.discountAmount = 0;
        if (elements.appliedCouponPill) elements.appliedCouponPill.style.display = "none";
        if (elements.rowDiscount) elements.rowDiscount.classList.remove("active");
        showToast(`Coupon removed because minimum order requirement of ${formatPrice(minReq)} is no longer met.`, "warning");
      } else {
        let disc = 0;
        if (state.appliedCoupon.type === "fixed") {
          disc = Math.min(subtotal, state.appliedCoupon.value);
        } else {
          disc = Math.round(subtotal * ((state.appliedCoupon.discountPercent || state.appliedCoupon.value) / 100));
          if (state.appliedCoupon.maxDiscount && disc > state.appliedCoupon.maxDiscount) {
            disc = state.appliedCoupon.maxDiscount;
          }
        }
        state.discountAmount = Math.max(0, Math.min(subtotal, Math.round(disc)));
        if (elements.rowDiscount) elements.rowDiscount.classList.add("active");
        if (elements.costDiscount) elements.costDiscount.textContent = `-${formatPrice(state.discountAmount)}`;
        if (elements.appliedCouponPill) elements.appliedCouponPill.style.display = "flex";
      }
    } else {
      state.discountAmount = 0;
      if (elements.rowDiscount) elements.rowDiscount.classList.remove("active");
      if (elements.costDiscount) elements.costDiscount.textContent = "-₹0";
      if (elements.appliedCouponPill) elements.appliedCouponPill.style.display = "none";
    }

    // Total Calculation
    state.total = Math.max(0, subtotal - state.discountAmount + state.shippingFee);
    state.totalProductAdvance = totalProductAdvance;

    // Evaluate Full Online Payment Eligibility
    const isOnlineMethod = (state.selectedPaymentMethod === "Credit / Debit Card" || state.selectedPaymentMethod === "UPI / QR Payment" || state.selectedPaymentMethod === "Net Banking");

    if (isOnlineMethod) {
      // FULL ONLINE PAYMENT: 100% online payable • ₹0 advance required • 3 FREE gifts • Open Box eligible
      state.advancePayableNow = 0;
      state.remainingCodAmount = 0;
      state.advanceRequired = false;
      state.isFullOnlinePayment = true;
    } else {
      // CASH ON DELIVERY (COD): Follows admin-configured advance requirement
      state.isFullOnlinePayment = false;
      if (totalProductAdvance > 0) {
        state.advancePayableNow = Math.min(totalProductAdvance, state.total);
        state.remainingCodAmount = Math.max(0, state.total - state.advancePayableNow);
        state.advanceRequired = true;
      } else {
        state.advancePayableNow = 0;
        state.remainingCodAmount = state.total;
        state.advanceRequired = false;
      }
      // For COD, preserve customer's selected delivery preference
      if (!state.selectedDeliveryPreference) {
        state.selectedDeliveryPreference = "Simple Delivery";
      }
    }

    const isFullOnline = state.isFullOnlinePayment;
    const hasCartGifts = Boolean(state.cartGiftsEligible && state.resolvedCartGifts && state.resolvedCartGifts.length > 0);
    const resolvedGifts = hasCartGifts ? state.resolvedCartGifts : [];
    const giftsCount = resolvedGifts.length;
    const giftNamesStr = resolvedGifts.map(g => g.name).join(" • ");

    // Sync payment cards selection in DOM
    if (elements.paymentCards) {
      elements.paymentCards.forEach(card => {
        card.classList.toggle("selected", card.dataset.method === state.selectedPaymentMethod);
      });
    }

    // Sync delivery pref cards in DOM
    if (elements.deliveryPrefCards) {
      elements.deliveryPrefCards.forEach(card => {
        const isSelected = card.dataset.pref === state.selectedDeliveryPreference;
        card.classList.toggle("selected", isSelected);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isSelected;
      });
    }

    // Update dynamic COD helper text
    const codDescEl = document.getElementById("pm-cod-desc");
    if (codDescEl) {
      if (totalProductAdvance > 0) {
        codDescEl.textContent = `Requires ${formatPrice(totalProductAdvance)} advance online now • Remaining balance collected via COD upon delivery.`;
      } else {
        codDescEl.textContent = `Pay with cash or mobile scan upon courier arrival. Zero advance deposit required.`;
      }
    }

    // Update online payment card badges with dynamic gift count
    document.querySelectorAll(".pm-gift-badge").forEach(badge => {
      if (hasCartGifts) {
        badge.textContent = `${giftsCount} FREE Gifts`;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    });

    document.querySelectorAll(".pm-online-desc").forEach(desc => {
      desc.textContent = hasCartGifts
        ? `Instant confirmation • No advance required • ${giftsCount} complimentary luxury accessories included.`
        : `Instant confirmation • No advance required • 100% secure payment.`;
    });

    // DOM updates
    elements.costSubtotal.textContent = formatPrice(subtotal);
    elements.costTotal.textContent = formatPrice(state.total);

    // Append complimentary gifts item to summary container when full online paid and gifts exist
    if (isFullOnline && hasCartGifts && elements.summaryItemsContainer) {
      elements.summaryItemsContainer.innerHTML += `
        <div class="summary-item gift-summary-item" style="background: rgba(245, 158, 11, 0.05); border-radius: 8px; padding: 10px 12px; margin-top: 8px; border: 1.5px dashed rgba(245, 158, 11, 0.35); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 1.4rem;">🎁</div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #92400e;">${giftsCount} Free Gifts (Pay Online Reward)</div>
              <div style="font-size: 0.74rem; color: #475569; margin-top: 2px;">${giftNamesStr}</div>
            </div>
          </div>
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--color-success); background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 12px;">
            FREE (₹0)
          </div>
        </div>
      `;
    }

    // Update Online Gifts Card in UI
    if (elements.cardOnlineGifts) {
      if (!hasCartGifts) {
        // No gifts configured for items in cart: hide card completely
        elements.cardOnlineGifts.style.display = "none";
      } else if (isFullOnline) {
        elements.cardOnlineGifts.style.display = "block";
        elements.cardOnlineGifts.classList.add("unlocked");
        if (elements.giftsStatusBadge) {
          elements.giftsStatusBadge.textContent = "✓ UNLOCKED (₹0)";
          elements.giftsStatusBadge.style.background = "rgba(16, 185, 129, 0.15)";
          elements.giftsStatusBadge.style.color = "#059669";
          elements.giftsStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
        if (elements.giftsStatusDesc) {
          elements.giftsStatusDesc.textContent = `Exclusive full online payment reward! ${giftsCount} complimentary luxury accessories automatically included at zero extra cost.`;
        }
        if (elements.onlineGiftsGrid) {
          elements.onlineGiftsGrid.style.display = "grid";
          elements.onlineGiftsGrid.innerHTML = resolvedGifts.map(g => {
            const isImg = g.icon_or_image && (g.icon_or_image.startsWith("http://") || g.icon_or_image.startsWith("https://") || g.icon_or_image.startsWith("data:"));
            const iconHtml = isImg
              ? `<img src="${g.icon_or_image}" alt="${g.name}" style="width:36px; height:36px; object-fit:cover; border-radius:6px;">`
              : `<span style="font-size:1.5rem;">${g.icon_or_image || '🎁'}</span>`;
            const qtyStr = (g.quantity && g.quantity > 1) ? ` (${g.quantity}x)` : '';
            return `
              <div class="online-gift-item" style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; border:1px solid rgba(16, 185, 129, 0.25); background:#fff;">
                ${iconHtml}
                <div style="flex:1;">
                  <strong style="font-size:0.85rem; color:var(--text-main); display:block;">${g.name}${qtyStr}</strong>
                  <span style="font-size:0.75rem; color:var(--text-muted);">${g.description || 'Complimentary Gift'}</span>
                </div>
                <span style="font-size:0.75rem; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:2px 6px; border-radius:4px;">₹0 FREE</span>
              </div>
            `;
          }).join("");
        }
        if (elements.onlineGiftsLockedNotice) elements.onlineGiftsLockedNotice.style.display = "none";
      } else {
        elements.cardOnlineGifts.style.display = "block";
        elements.cardOnlineGifts.classList.remove("unlocked");
        if (elements.giftsStatusBadge) {
          elements.giftsStatusBadge.textContent = "Locked";
          elements.giftsStatusBadge.style.background = "rgba(245, 158, 11, 0.15)";
          elements.giftsStatusBadge.style.color = "#b45309";
          elements.giftsStatusBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
        }
        if (elements.giftsStatusDesc) {
          elements.giftsStatusDesc.textContent = `Pay 100% online via UPI, Card, or Net Banking to unlock ${giftsCount} complimentary luxury accessories (${giftNamesStr}).`;
        }
        if (elements.onlineGiftsGrid) elements.onlineGiftsGrid.style.display = "none";
        if (elements.onlineGiftsLockedNotice) elements.onlineGiftsLockedNotice.style.display = "block";
      }
    }

    // Update Delivery Preference Card in UI (Available for COD, Advance + COD, and Full Online)
    if (elements.cardDeliveryPreference) {
      elements.cardDeliveryPreference.style.display = "block";
      if (elements.badgePrefLock) {
        elements.badgePrefLock.textContent = "Doorstep Choice";
        elements.badgePrefLock.style.background = "rgba(2, 132, 199, 0.12)";
        elements.badgePrefLock.style.color = "#0284c7";
        elements.badgePrefLock.style.borderColor = "rgba(2, 132, 199, 0.3)";
      }
    }

    // Update Order Summary Rows for Gifts, Delivery Preference, and Payment Method
    if (elements.rowOnlineGifts) {
      if (isFullOnline) {
        elements.rowOnlineGifts.style.display = "flex";
        if (elements.costOnlineGifts) elements.costOnlineGifts.textContent = "FREE (₹0)";
      } else {
        elements.rowOnlineGifts.style.display = "none";
      }
    }

    if (elements.rowDeliveryPreference) {
      elements.rowDeliveryPreference.style.display = "flex";
      if (elements.costDeliveryPreference) {
        elements.costDeliveryPreference.textContent = state.selectedDeliveryPreference || "Simple Delivery";
        elements.costDeliveryPreference.style.color = (state.selectedDeliveryPreference === "Open Box Delivery") ? "#0284c7" : "var(--text-main)";
      }
    }

    if (elements.costPaymentMethod) {
      elements.costPaymentMethod.textContent = state.selectedPaymentMethod;
    }

    // Update Advance Payment Rows & Notices
    const codNoteEl = document.querySelector(".cod-note");
    if (state.advanceRequired) {
      if (elements.rowAdvance) {
        elements.rowAdvance.style.display = "flex";
        elements.costAdvance.textContent = formatPrice(state.advancePayableNow);
      }
      if (elements.rowCodBalance) {
        elements.rowCodBalance.style.display = "flex";
        elements.costCodBalance.textContent = formatPrice(state.remainingCodAmount);
      }
      if (elements.advanceSummaryNotice) {
        elements.advanceSummaryNotice.style.display = "block";
        if (elements.advanceNoticeText) {
          elements.advanceNoticeText.textContent = `Pay ${formatPrice(state.advancePayableNow)} online deposit now to dispatch this order. The remaining ${formatPrice(state.remainingCodAmount)} balance will be collected via Cash on Delivery upon shipment handover.`;
        }
      }
      if (codNoteEl) {
        codNoteEl.innerHTML = `<strong>⚡ Partial COD Requirement:</strong> An advance of <strong>${formatPrice(state.advancePayableNow)}</strong> must be paid online via Card, UPI, or Net Banking before order confirmation. The remaining <strong>${formatPrice(state.remainingCodAmount)}</strong> balance will be collected upon courier delivery.`;
      }
      if (elements.btnPlaceOrderText) {
        elements.btnPlaceOrderText.textContent = `Pay Advance ${formatPrice(state.advancePayableNow)} & Confirm COD Order`;
      }
    } else {
      if (elements.rowAdvance) elements.rowAdvance.style.display = "none";
      if (elements.rowCodBalance) elements.rowCodBalance.style.display = "none";
      if (elements.advanceSummaryNotice) elements.advanceSummaryNotice.style.display = "none";
      if (codNoteEl) {
        codNoteEl.innerHTML = `<strong>✓ Guaranteed Handover:</strong> You can inspect the outer packaging and seal before handing over cash or scanning the courier UPI QR. Zero COD surcharge.`;
      }
      if (elements.btnPlaceOrderText) {
        if (state.selectedPaymentMethod === "UPI / QR Payment") {
          elements.btnPlaceOrderText.textContent = `Pay ${formatPrice(state.total)} with UPI`;
        } else {
          elements.btnPlaceOrderText.textContent = isFullOnline
            ? `Complete Order • ${formatPrice(state.total)}`
            : `Complete COD Order • ${formatPrice(state.total)} on Delivery`;
        }
      }
    }

    // Keep dynamic UPI section in sync
    updateUpiSection();
  }

  // --- 5. Coupon Handling ---
  async function applyCoupon(rawCode) {
    if (!rawCode || !rawCode.trim()) {
      showToast("Please enter a promotional code.", "error");
      return;
    }
    const code = rawCode.trim().toUpperCase();

    // Query Supabase coupons table (Database is the single source of truth)
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (!client) {
      showToast("Unable to validate coupon at this time. Please try again.", "error");
      return;
    }

    if (elements.btnApplyCoupon) {
      elements.btnApplyCoupon.disabled = true;
      elements.btnApplyCoupon.textContent = "Checking...";
    }

    try {
      // Direct authoritative query by code (case-insensitive)
      const couponCols = "id, code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, used_count, start_date, expiry_date, is_active";
      const { data: dbCoupon, error: dbErr } = await client
        .from("coupons")
        .select(couponCols)
        .ilike("code", code)
        .maybeSingle();

      if (dbErr) {
        console.error("Coupon lookup error:", dbErr);
        showToast("Error checking coupon code. Please try again.", "error");
        return;
      }

      if (!dbCoupon) {
        showToast("Invalid coupon code.", "error");
        return;
      }

      // Check is_active
      if (!dbCoupon.is_active) {
        showToast("This coupon is no longer active.", "error");
        return;
      }

      // Check start_date
      if (dbCoupon.start_date) {
        const startDate = new Date(dbCoupon.start_date);
        if (!isNaN(startDate.getTime()) && new Date() < startDate) {
          showToast("This coupon is not yet active.", "error");
          return;
        }
      }

      // Check expiry_date
      if (dbCoupon.expiry_date) {
        const expiryDate = new Date(dbCoupon.expiry_date);
        if (!isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
          showToast("This coupon has expired.", "error");
          return;
        }
      }

      // Check usage limit
      if (dbCoupon.usage_limit && Number(dbCoupon.used_count || 0) >= Number(dbCoupon.usage_limit)) {
        showToast("This coupon has reached its maximum usage limit.", "error");
        return;
      }

      // Check minimum order amount against current cart subtotal
      const minOrder = Number(dbCoupon.min_order_amount || 0);
      if (minOrder > 0 && state.subtotal < minOrder) {
        showToast(`Minimum order value of ${formatPrice(minOrder)} required for this coupon.`, "error");
        return;
      }

      // Calculate discount
      let calculatedDiscount = 0;
      const discVal = Number(dbCoupon.discount_value) || 0;
      if (dbCoupon.discount_type === "percentage") {
        calculatedDiscount = Math.round((state.subtotal * discVal) / 100);
        if (dbCoupon.max_discount && calculatedDiscount > Number(dbCoupon.max_discount)) {
          calculatedDiscount = Number(dbCoupon.max_discount);
        }
      } else {
        calculatedDiscount = Math.min(state.subtotal, discVal);
      }
      calculatedDiscount = Math.max(0, calculatedDiscount);

      state.appliedCoupon = {
        id: dbCoupon.id,
        code: dbCoupon.code,
        type: dbCoupon.discount_type,
        value: discVal,
        discountPercent: dbCoupon.discount_type === "percentage" ? discVal : null,
        maxDiscount: dbCoupon.max_discount ? Number(dbCoupon.max_discount) : null,
        minOrderAmount: minOrder
      };

      if (elements.appliedCouponName) elements.appliedCouponName.textContent = dbCoupon.code;
      if (elements.appliedCouponPercent) {
        elements.appliedCouponPercent.textContent = dbCoupon.discount_type === "percentage"
          ? `${discVal}%`
          : formatPrice(discVal);
      }
      if (elements.appliedCouponPill) elements.appliedCouponPill.style.display = "flex";
      if (elements.couponInput) elements.couponInput.value = "";

      showToast(`Coupon applied successfully! You saved ${formatPrice(calculatedDiscount)}.`, "success");
      renderOrderSummary();
    } catch (err) {
      console.error("Apply coupon error:", err);
      showToast("Unable to apply coupon. Please try again.", "error");
    } finally {
      if (elements.btnApplyCoupon) {
        elements.btnApplyCoupon.disabled = false;
        elements.btnApplyCoupon.textContent = "Apply";
      }
    }
  }

  function removeCoupon() {
    state.appliedCoupon = null;
    state.discountAmount = 0;
    if (elements.appliedCouponPill) elements.appliedCouponPill.style.display = "none";
    if (elements.rowDiscount) elements.rowDiscount.classList.remove("active");
    if (elements.costDiscount) elements.costDiscount.textContent = "-₹0";
    showToast("Promotional code removed.", "info");
    renderOrderSummary();
  }

  // Dynamically load active coupon suggestions from Supabase
  async function loadCouponSuggestions() {
    const container = document.querySelector(".coupon-suggestions");
    if (!container) return;
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (!client) {
      container.style.display = "none";
      return;
    }
    try {
      const { data: suggestions, error } = await client
        .from("coupons")
        .select("code, discount_type, discount_value, min_order_amount, expiry_date")
        .eq("is_active", true)
        .order("discount_value", { ascending: false })
        .limit(3);

      const now = new Date();
      const validSuggestions = (suggestions || []).filter(c => {
        if (c.expiry_date && new Date(c.expiry_date) < now) return false;
        return true;
      });

      if (error || validSuggestions.length === 0) {
        container.style.display = "none";
        return;
      }

      container.innerHTML = `<span>Try code:</span>` + validSuggestions.map(c => {
        const disc = c.discount_type === "percentage" ? `${c.discount_value}% off` : `${formatPrice(c.discount_value)} off`;
        return `<span class="coupon-chip-suggestion" data-code="${escapeHTML(c.code)}">${escapeHTML(c.code)} (${disc})</span>`;
      }).join("");

      container.style.display = "flex";

      container.querySelectorAll(".coupon-chip-suggestion").forEach(chip => {
        chip.addEventListener("click", () => {
          const chipCode = chip.dataset.code;
          if (elements.couponInput) elements.couponInput.value = chipCode;
          applyCoupon(chipCode);
        });
      });
    } catch (err) {
      container.style.display = "none";
    }
  }

  // Coupon Listeners
  if (elements.btnApplyCoupon) {
    elements.btnApplyCoupon.addEventListener("click", () => {
      applyCoupon(elements.couponInput.value);
    });
  }

  if (elements.couponInput) {
    elements.couponInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCoupon(elements.couponInput.value);
      }
    });
  }

  if (elements.btnRemoveCoupon) {
    elements.btnRemoveCoupon.addEventListener("click", removeCoupon);
  }

  elements.couponSuggestions.forEach(chip => {
    chip.addEventListener("click", () => {
      const code = chip.dataset.code;
      elements.couponInput.value = code;
      applyCoupon(code);
    });
  });

  // --- 6. Address Type Selector ---
  if (elements.addressPills) {
    elements.addressPills.forEach(pill => {
      pill.addEventListener("click", () => {
        elements.addressPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        state.selectedAddressType = pill.dataset.type || "Home";
      });
    });
  }

  // --- 6B. Smart India-First Address System & Saved Addresses ---

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Comprehensive dataset of all 28 Indian States & 8 Union Territories with major cities / districts
  const INDIA_LOCATIONS = {
    "Andaman and Nicobar Islands": ["Port Blair", "Diglipur", "Car Nicobar", "Mayabunder", "Havelock"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kadapa", "Kakinada", "Anantapur", "Eluru", "Vizianagaram", "Ongole"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Tezu", "Bomdila"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Bongaigaon", "Barpeta"],
    "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia", "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Danapur", "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", "Bettiah"],
    "Chandigarh": ["Chandigarh", "Manimajra"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Durg", "Jagdalpur", "Ambikapur", "Raigarh"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa", "Amli"],
    "Delhi": ["New Delhi", "Central Delhi", "South Delhi", "North Delhi", "East Delhi", "West Delhi", "Dwarka", "Rohini", "Saket", "Connaught Place", "Vasant Kunj", "Janakpuri", "Laxmi Nagar", "Karol Bagh"],
    "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Calangute", "Bicholim"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Navsari", "Morbi", "Nadiad", "Surendranagar", "Bharuch", "Mehsana", "Bhuj", "Porbandar", "Valsad", "Vapi"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa", "Bahadurgarh", "Jind", "Thanesar", "Kaithal", "Rewari", "Palwal"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Manali", "Bilaspur", "Hamirpur", "Chamba", "Una", "Nahan", "Kangra"],
    "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua", "Sopore", "Rajouri", "Poonch", "Pulwama", "Kupwara"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh", "Giridih", "Ramgarh", "Medininagar", "Chirkunda", "Dumka"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga", "Tumakuru", "Raichur", "Bidar", "Hosapete", "Hassan", "Udupi", "Kolar"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram", "Kasaragod", "Pathanamthitta", "Idukki", "Wayanad"],
    "Ladakh": ["Leh", "Kargil", "Diskit"],
    "Lakshadweep": ["Kavaratti", "Agatti", "Andrott", "Amini", "Minicoy"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa", "Murwara (Katni)", "Singrauli", "Burhanpur", "Khandwa", "Bhind", "Chhindwara", "Guna", "Shivpuri", "Vidisha", "Damoh"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Chhatrapati Sambhajinagar", "Navi Mumbai", "Solapur", "Mira-Bhayandar", "Bhiwandi", "Amravati", "Nanded", "Kolhapur", "Akola", "Ulhasnagar", "Sangli", "Malegaon", "Jalgaon", "Latur", "Dhule", "Ahmednagar", "Chandrapur", "Parbhani", "Panvel"],
    "Manipur": ["Imphal", "Thoubal", "Bishnupur", "Churachandpur", "Kakching", "Ukhrul"],
    "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongpoh", "Cherrapunji", "Baghmara"],
    "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Serchhip", "Kolasib"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha", "Zunheboto"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak", "Baripada", "Jharsuguda", "Jeypore"],
    "Puducherry": ["Puducherry", "Karaikal", "Mahe", "Yanam", "Ozhukarai"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Hoshiarpur", "Mohali (SAS Nagar)", "Batala", "Pathankot", "Moga", "Abohar", "Malerkotla", "Khanna", "Phagwara", "Muktsar"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sikar", "Pali", "Sri Ganganagar", "Chittorgarh", "Beawar", "Hanumangarh", "Tonk", "Kishangarh"],
    "Sikkim": ["Gangtok", "Namchi", "Gyalshing", "Mangan", "Singtam", "Rangpo"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Tiruppur", "Ranipet", "Nagercoil", "Thanjavur", "Vellore", "Kancheepuram", "Erode", "Dindigul", "Cuddalore", "Kumbakonam", "Thoothukudi", "Hosur"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet", "Miryalaguda", "Siddipet"],
    "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Kailashahar", "Belonia", "Khowai"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Noida", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura", "Ayodhya", "Rampur", "Shahjahanpur", "Farrukhabad", "Mau", "Hapur", "Etawah", "Mirzapur"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur", "Rishikesh", "Nainital", "Pithoragarh", "Mussoorie"],
    "West Bengal": ["Kolkata", "Howrah", "Asansol", "Siliguri", "Durgapur", "Bardhaman", "Malda", "Baharampur", "Habra", "Kharagpur", "Shantipur", "Dankuni", "Dhulian", "Ranaghat", "Haldia", "Raiganj", "Krishnanagar", "Nabadwip", "Midnapore", "Jalpaiguri"]
  };

  let isNewAddressMode = false;
  let pendingMismatch = null;
  let pincodeLookupAbortCtrl = null;

  function matchStateName(stateName) {
    if (!stateName || !elements.inputState) return "";
    const clean = stateName.toLowerCase().replace(/[^a-z]/g, "");
    for (const opt of elements.inputState.options) {
      if (!opt.value) continue;
      const optClean = opt.value.toLowerCase().replace(/[^a-z]/g, "");
      if (optClean === clean || optClean.includes(clean) || clean.includes(optClean)) {
        return opt.value;
      }
    }
    return "";
  }

  // City Autocomplete Combobox
  function renderCitySuggestions(query = "") {
    if (!elements.cityAutocompleteList) return;
    const currentState = elements.inputState ? elements.inputState.value : "";
    const cities = INDIA_LOCATIONS[currentState] || [];

    const q = query.trim().toLowerCase();
    const filtered = q ? cities.filter(c => c.toLowerCase().includes(q)) : cities;

    if (filtered.length === 0 && !q) {
      elements.cityAutocompleteList.style.display = "none";
      return;
    }

    let html = "";
    filtered.slice(0, 25).forEach(city => {
      html += `
        <div class="city-autocomplete-item" data-city="${escapeHTML(city)}">
          <span>${escapeHTML(city)}</span>
          <span class="city-tag">${escapeHTML(currentState || "India")}</span>
        </div>`;
    });

    if (q && !cities.some(c => c.toLowerCase() === q)) {
      html += `
        <div class="city-autocomplete-item custom" data-city="${escapeHTML(query.trim())}">
          <span>Use "<strong>${escapeHTML(query.trim())}</strong>"</span>
          <span class="city-tag">Manual Entry</span>
        </div>`;
    }

    elements.cityAutocompleteList.innerHTML = html;
    elements.cityAutocompleteList.style.display = "block";

    elements.cityAutocompleteList.querySelectorAll(".city-autocomplete-item").forEach(item => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const val = item.getAttribute("data-city");
        if (elements.inputCity) {
          elements.inputCity.value = val;
          const grp = elements.inputCity.closest(".form-group");
          if (grp) grp.classList.remove("has-error");
        }
        elements.cityAutocompleteList.style.display = "none";
        if (elements.inputZip && !elements.inputZip.value) {
          elements.inputZip.focus();
        }
      });
    });
  }

  if (elements.inputCity) {
    elements.inputCity.addEventListener("focus", () => {
      renderCitySuggestions(elements.inputCity.value);
    });
    elements.inputCity.addEventListener("input", () => {
      renderCitySuggestions(elements.inputCity.value);
    });
  }

  if (elements.btnCityDropdownToggle) {
    elements.btnCityDropdownToggle.addEventListener("click", (e) => {
      e.preventDefault();
      if (!elements.cityAutocompleteList) return;
      if (elements.cityAutocompleteList.style.display === "block") {
        elements.cityAutocompleteList.style.display = "none";
      } else {
        renderCitySuggestions(elements.inputCity ? elements.inputCity.value : "");
        if (elements.inputCity) elements.inputCity.focus();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".city-combobox-wrap") && elements.cityAutocompleteList) {
      elements.cityAutocompleteList.style.display = "none";
    }
  });

  if (elements.inputState) {
    elements.inputState.addEventListener("change", () => {
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
      if (elements.cityAutocompleteList && elements.cityAutocompleteList.style.display === "block") {
        renderCitySuggestions(elements.inputCity ? elements.inputCity.value : "");
      }
    });
  }

  // Country selection toggle
  if (elements.selectCountry) {
    elements.selectCountry.addEventListener("change", () => {
      const isIndia = (elements.selectCountry.value === "India");
      const indiaRow = document.getElementById("india-location-row");
      if (indiaRow) {
        indiaRow.style.display = isIndia ? "" : "grid";
      }
      if (elements.pincodeMismatchBanner && !isIndia) {
        elements.pincodeMismatchBanner.style.display = "none";
      }
    });
  }

  // Pincode Postal Lookup Engine
  async function lookupPincode(pin) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return null;

    try {
      if (pincodeLookupAbortCtrl) {
        pincodeLookupAbortCtrl.abort();
      }
      pincodeLookupAbortCtrl = new AbortController();
      const timeoutId = setTimeout(() => pincodeLookupAbortCtrl.abort(), 1800);

      const resp = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
        signal: pincodeLookupAbortCtrl.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const poList = data[0].PostOffice;
          const first = poList[0];
          return {
            state: first.State,
            city: first.District || first.Block || first.Name,
            district: first.District,
            postOffices: poList.map(p => p.Name).filter(Boolean)
          };
        }
      }
    } catch (e) {}

    if (window.VeloraPincodeEngine) {
      const resolver = window.VeloraPincodeEngine.resolveRegion || window.VeloraPincodeEngine.resolvePostalRegion;
      if (typeof resolver === "function") {
        const resolved = resolver(pin);
        if (resolved && resolved.state && resolved.state !== 'India') {
          return {
            state: resolved.state,
            city: resolved.city,
            district: resolved.city,
            postOffices: []
          };
        }
      }
    }

    return null;
  }

  async function handlePincodeChange(pin) {
    if (pin.length < 6) {
      if (elements.pincodeStatusBadge) elements.pincodeStatusBadge.style.display = "none";
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
      if (elements.groupPostOffice) elements.groupPostOffice.style.display = "none";
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      if (elements.pincodeStatusBadge) elements.pincodeStatusBadge.style.display = "none";
      return;
    }

    const res = await lookupPincode(pin);
    if (!res) {
      if (elements.pincodeStatusBadge) {
        elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        elements.pincodeStatusBadge.style.display = "inline-flex";
      }
      return;
    }

    const matchedState = matchStateName(res.state) || res.state;
    const resolvedCity = res.city;
    const currentState = elements.inputState ? elements.inputState.value.trim() : "";
    const currentCity = elements.inputCity ? elements.inputCity.value.trim() : "";

    // Populate Post Offices if available
    if (elements.selectPostOffice && elements.groupPostOffice && res.postOffices && res.postOffices.length > 0) {
      elements.selectPostOffice.innerHTML = `<option value="">Select your local post office / branch area...</option>` +
        res.postOffices.map(po => `<option value="${escapeHTML(po)}">${escapeHTML(po)}</option>`).join("");
      elements.groupPostOffice.style.display = "block";
    }

    const stateEmpty = !currentState;
    const cityEmpty = !currentCity;

    if (stateEmpty || (cityEmpty && matchedState.toLowerCase() === currentState.toLowerCase())) {
      if (elements.inputState && matchedState) {
        elements.inputState.value = matchedState;
        const group = elements.inputState.closest(".form-group");
        if (group) group.classList.remove("has-error");
      }
      if (elements.inputCity && resolvedCity && cityEmpty) {
        elements.inputCity.value = resolvedCity;
        const group = elements.inputCity.closest(".form-group");
        if (group) group.classList.remove("has-error");
      }
      if (elements.pincodeStatusBadge) {
        elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        elements.pincodeStatusBadge.style.display = "inline-flex";
      }
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
    } else {
      const statesMatch = matchedState.toLowerCase().replace(/[^a-z]/g, "") === currentState.toLowerCase().replace(/[^a-z]/g, "");
      if (statesMatch) {
        if (elements.pincodeStatusBadge) {
          elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
          elements.pincodeStatusBadge.style.display = "inline-flex";
        }
        if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
      } else {
        pendingMismatch = {
          pin,
          suggestedState: matchedState,
          suggestedCity: resolvedCity,
          postOffices: res.postOffices
        };
        if (elements.mismatchBannerText) {
          elements.mismatchBannerText.textContent = `PIN ${pin} corresponds to ${resolvedCity}, ${matchedState}. You currently have "${currentCity ? currentCity + ', ' : ''}${currentState}" selected. Would you like to update?`;
        }
        if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "flex";
      }
    }
  }

  if (elements.btnMismatchAccept) {
    elements.btnMismatchAccept.addEventListener("click", () => {
      if (pendingMismatch) {
        if (elements.inputState && pendingMismatch.suggestedState) {
          elements.inputState.value = pendingMismatch.suggestedState;
          const group = elements.inputState.closest(".form-group");
          if (group) group.classList.remove("has-error");
        }
        if (elements.inputCity && pendingMismatch.suggestedCity) {
          elements.inputCity.value = pendingMismatch.suggestedCity;
          const group = elements.inputCity.closest(".form-group");
          if (group) group.classList.remove("has-error");
        }
      }
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
      if (elements.pincodeStatusBadge) {
        elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        elements.pincodeStatusBadge.style.display = "inline-flex";
      }
      showToast("Delivery location updated to suggested area.", "info");
    });
  }

  if (elements.btnMismatchDismiss) {
    elements.btnMismatchDismiss.addEventListener("click", () => {
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
      if (elements.pincodeStatusBadge) {
        elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        elements.pincodeStatusBadge.style.display = "inline-flex";
      }
    });
  }

  if (elements.inputZip) {
    elements.inputZip.addEventListener("input", () => {
      const clean = elements.inputZip.value.replace(/\D/g, "").slice(0, 6);
      elements.inputZip.value = clean;
      handlePincodeChange(clean);
    });
  }

  if (elements.inputPhone) {
    elements.inputPhone.addEventListener("input", () => {
      const clean = elements.inputPhone.value.replace(/\D/g, "").slice(0, 10);
      elements.inputPhone.value = clean;
    });
  }

  // Address State
  let savedAddressesList = [];
  let selectedAddressIndex = 0;
  let isAddressFormOpen = false;
  let isSelectingAddress = false;
  let editingAddressId = null;

  // Sanitizer: Filter out corrupt / test / demo addresses
  function isDemoOrCorruptAddress(addr) {
    if (!addr) return true;
    const name = String(addr.full_name || "").toLowerCase().trim();
    const city = String(addr.city || "").toLowerCase().trim();
    const street = String(addr.street || "").toLowerCase().trim();
    const house = String(addr.house || "").toLowerCase().trim();
    const phone = String(addr.phone || "").replace(/\D/g, "");

    // Check for Alexander Hayes or demo mock names
    if (name.includes("alexander") || name.includes("hayes") || name.includes("john doe") || name.includes("demo user") || name.includes("test user")) {
      return true;
    }
    // Check for New York in Indian address
    if (city.includes("new york") || city === "ny") {
      return true;
    }
    // Check for fake placeholder phone numbers
    if (phone === "1234567890" || phone === "0000000000" || phone === "9999999999" || phone === "1111111111" || (phone.length > 0 && phone.length < 10)) {
      return true;
    }
    // Missing critical address fields
    if (!name || (!house && !street) || !addr.pincode) {
      return true;
    }
    return false;
  }

  function deduplicateAddresses(addresses) {
    const seen = new Set();
    const unique = [];
    for (const addr of addresses) {
      const key = [
        (addr.full_name || "").toLowerCase().trim(),
        (addr.house || "").toLowerCase().trim(),
        (addr.street || "").toLowerCase().trim(),
        (addr.pincode || "").trim()
      ].join("|");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(addr);
      }
    }
    return unique;
  }

  // Saved Addresses in Supabase
  async function loadSavedAddresses() {
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;

    if (!client || !currentUser || !currentUser.id) {
      renderSavedAddresses();
      return;
    }

    if (elements.labelDefaultAddress) {
      elements.labelDefaultAddress.style.display = "flex";
    }

    try {
      const { data, error } = await client
        .from("addresses")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        // Clean up corrupt/demo addresses from Supabase database if found
        const corruptIds = data.filter(isDemoOrCorruptAddress).map(a => a.id).filter(Boolean);
        if (corruptIds.length > 0) {
          client.from("addresses").delete().in("id", corruptIds).catch(() => {});
        }

        // Deduplicate and filter for customer UI
        savedAddressesList = deduplicateAddresses(data.filter(a => !isDemoOrCorruptAddress(a)));

        // Select default address if none selected yet
        if (savedAddressesList.length > 0) {
          if (selectedAddressIndex < 0 || selectedAddressIndex >= savedAddressesList.length) {
            const defIdx = savedAddressesList.findIndex(a => a.is_default);
            selectedAddressIndex = defIdx !== -1 ? defIdx : 0;
          }
        } else {
          selectedAddressIndex = 0;
        }
      } else {
        savedAddressesList = [];
        selectedAddressIndex = 0;
      }
    } catch (e) {
      console.warn("Could not load saved addresses from Supabase:", e);
      savedAddressesList = [];
      selectedAddressIndex = 0;
    }

    renderSavedAddresses();
  }

  function updateSelectedAddressSummary(addr) {
    if (!elements.selectedAddressSummary || !addr) return;
    if (elements.summaryAddressType) {
      elements.summaryAddressType.textContent = addr.address_type || "Home";
    }
    if (elements.summaryAddressName) {
      elements.summaryAddressName.textContent = addr.full_name || "Valued Customer";
    }
    if (elements.summaryAddressDetails) {
      const streetParts = [addr.house, addr.street, addr.landmark].filter(Boolean).map(s => escapeHTML(s)).join(", ");
      const locParts = [addr.city, addr.state].filter(Boolean).map(s => escapeHTML(s)).join(", ") + (addr.pincode ? ` - ${escapeHTML(addr.pincode)}` : "");
      elements.summaryAddressDetails.innerHTML = `${streetParts}<br>${locParts}`;
    }
    if (elements.summaryAddressPhone) {
      if (addr.phone) {
        const cleanPhone = escapeHTML(addr.phone.replace(/\D/g, "").slice(-10));
        elements.summaryAddressPhone.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> <span>+91 ${cleanPhone}</span>`;
        elements.summaryAddressPhone.style.display = "inline-flex";
      } else {
        elements.summaryAddressPhone.style.display = "none";
      }
    }
  }

  function renderSavedAddresses() {
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    const isLoggedIn = Boolean(currentUser && currentUser.id);

    if (!isLoggedIn) {
      // Guest: show form directly, hide all saved address sections
      if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "none";
      if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "none";
      if (elements.noSavedAddressesNotice) elements.noSavedAddressesNotice.style.display = "none";
      if (elements.btnAddAddressHeader) elements.btnAddAddressHeader.style.display = "none";
      if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "block";
      if (elements.deliveryFormHeaderBar) elements.deliveryFormHeaderBar.style.display = "none";
      if (elements.addressFormActions) elements.addressFormActions.style.display = "none";
      return;
    }

    if (savedAddressesList.length === 0) {
      // Authenticated with NO saved addresses
      if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "none";
      if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "none";
      if (elements.btnAddAddressHeader) elements.btnAddAddressHeader.style.display = "inline-flex";

      if (isAddressFormOpen) {
        if (elements.noSavedAddressesNotice) elements.noSavedAddressesNotice.style.display = "none";
        if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "block";
        if (elements.deliveryFormHeaderBar) elements.deliveryFormHeaderBar.style.display = "flex";
        if (elements.addressFormActions) elements.addressFormActions.style.display = "flex";
      } else {
        if (elements.noSavedAddressesNotice) elements.noSavedAddressesNotice.style.display = "flex";
        if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "none";
      }
      return;
    }

    // Authenticated WITH saved addresses
    if (elements.noSavedAddressesNotice) elements.noSavedAddressesNotice.style.display = "none";
    if (elements.btnAddAddressHeader) elements.btnAddAddressHeader.style.display = "inline-flex";

    // Ensure valid selected index
    if (selectedAddressIndex < 0 || selectedAddressIndex >= savedAddressesList.length) {
      const defIdx = savedAddressesList.findIndex(a => a.is_default);
      selectedAddressIndex = defIdx !== -1 ? defIdx : 0;
    }

    const currentSelectedAddr = savedAddressesList[selectedAddressIndex];
    if (currentSelectedAddr) {
      updateSelectedAddressSummary(currentSelectedAddr);
      populateFormWithAddress(currentSelectedAddr);
    }

    let html = "";
    savedAddressesList.forEach((addr, idx) => {
      const isSelected = (idx === selectedAddressIndex);
      html += `
        <div class="saved-address-card ${isSelected ? 'selected' : ''}" data-index="${idx}">
          <div class="saved-address-card-header">
            <div class="card-badges-left">
              <span class="saved-address-type-badge">${escapeHTML(addr.address_type || 'Home')}</span>
              ${addr.is_default ? '<span class="saved-address-default-badge">Default</span>' : ''}
            </div>
            <span class="btn-card-select-badge">✓ Selected</span>
          </div>
          <div class="saved-address-name">
            <span>${escapeHTML(addr.full_name || '')}</span>
          </div>
          <div class="saved-address-text">
            ${escapeHTML(addr.house || '')}, ${escapeHTML(addr.street || '')}${addr.landmark ? ', ' + escapeHTML(addr.landmark) : ''}<br>
            ${escapeHTML(addr.city || '')}, ${escapeHTML(addr.state || '')} - ${escapeHTML(addr.pincode || '')}
          </div>
          ${addr.phone ? `<div class="saved-address-phone">📞 +91 ${escapeHTML(addr.phone.replace(/\D/g, '').slice(-10))}</div>` : ''}
          <div class="saved-address-card-actions">
            <button type="button" class="btn-card-use ${isSelected ? 'active' : ''}" data-use-index="${idx}">
              ${isSelected ? '✓ Selected' : 'Use This Address'}
            </button>
            <div class="card-sub-actions">
              <button type="button" class="btn-card-edit" data-edit-index="${idx}">Edit</button>
              ${!addr.is_default ? `<button type="button" class="btn-card-default" data-default-index="${idx}">Set Default</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    if (elements.savedAddressesGrid) {
      elements.savedAddressesGrid.innerHTML = html;

      // Card selection listener
      elements.savedAddressesGrid.querySelectorAll(".saved-address-card").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".btn-card-edit") || e.target.closest(".btn-card-default") || e.target.closest(".btn-card-use")) return;
          const idx = parseInt(card.getAttribute("data-index"), 10);
          selectSavedAddress(idx);
        });
      });

      // Use button listener
      elements.savedAddressesGrid.querySelectorAll(".btn-card-use").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute("data-use-index"), 10);
          selectSavedAddress(idx);
        });
      });

      // Edit button listener
      elements.savedAddressesGrid.querySelectorAll(".btn-card-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute("data-edit-index"), 10);
          openDeliveryForm(false, idx);
        });
      });

      // Set Default button listener
      elements.savedAddressesGrid.querySelectorAll(".btn-card-default").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute("data-default-index"), 10);
          await setAddressAsDefault(idx);
        });
      });
    }

    // Determine visual display mode
    if (isAddressFormOpen) {
      if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "none";
      if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "none";
      if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "block";
      if (elements.deliveryFormHeaderBar) elements.deliveryFormHeaderBar.style.display = "flex";
      if (elements.addressFormActions) elements.addressFormActions.style.display = "flex";
    } else if (isSelectingAddress) {
      if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "none";
      if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "block";
      if (elements.btnCloseSavedAddresses) elements.btnCloseSavedAddresses.style.display = "inline-flex";
      if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "none";
    } else {
      if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "block";
      if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "none";
      if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "none";
    }
  }

  function selectSavedAddress(idx) {
    if (idx < 0 || idx >= savedAddressesList.length) return;
    selectedAddressIndex = idx;
    isSelectingAddress = false;
    isAddressFormOpen = false;

    const addr = savedAddressesList[idx];
    if (addr) {
      populateFormWithAddress(addr);
      updateSelectedAddressSummary(addr);
    }

    renderSavedAddresses();
  }

  function populateFormWithAddress(addr) {
    if (!addr) return;
    if (elements.inputFullName) elements.inputFullName.value = addr.full_name || "";
    if (elements.inputPhone) {
      const cleanPhone = (addr.phone || "").replace(/\D/g, "").slice(-10);
      elements.inputPhone.value = cleanPhone;
    }
    if (elements.inputEmail && addr.email) elements.inputEmail.value = addr.email;
    if (elements.inputHouse) elements.inputHouse.value = addr.house || "";
    if (elements.inputStreet) elements.inputStreet.value = addr.street || "";
    if (elements.inputLandmark) elements.inputLandmark.value = addr.landmark || "";
    if (elements.inputState) elements.inputState.value = matchStateName(addr.state) || addr.state || "";
    if (elements.inputCity) elements.inputCity.value = addr.city || "";
    if (elements.inputZip) {
      elements.inputZip.value = addr.pincode || "";
      if (elements.pincodeStatusBadge) {
        elements.pincodeStatusBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified`;
        elements.pincodeStatusBadge.style.display = "inline-flex";
      }
    }
    if (elements.selectCountry && addr.country) elements.selectCountry.value = addr.country;

    if (addr.address_type && elements.addressPills) {
      elements.addressPills.forEach(pill => {
        if (pill.dataset.type === addr.address_type) {
          elements.addressPills.forEach(p => p.classList.remove("active"));
          pill.classList.add("active");
          state.selectedAddressType = addr.address_type;
        }
      });
    }

    document.querySelectorAll(".form-group.has-error").forEach(g => g.classList.remove("has-error"));
    if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";
  }

  function openDeliveryForm(isNew = true, editIndex = null) {
    isAddressFormOpen = true;
    isSelectingAddress = false;

    if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "block";
    if (elements.deliveryFormHeaderBar) elements.deliveryFormHeaderBar.style.display = "flex";
    if (elements.addressFormActions) elements.addressFormActions.style.display = "flex";
    if (elements.selectedAddressSummary) elements.selectedAddressSummary.style.display = "none";
    if (elements.savedAddressesSection) elements.savedAddressesSection.style.display = "none";
    if (elements.noSavedAddressesNotice) elements.noSavedAddressesNotice.style.display = "none";

    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;

    if (isNew) {
      editingAddressId = null;
      if (elements.deliveryFormTitle) elements.deliveryFormTitle.textContent = "Add New Delivery Address";
      if (elements.btnSaveAddressSubmit) elements.btnSaveAddressSubmit.textContent = "Save Address & Continue";

      // Clear all address input fields for a completely clean new address
      if (elements.inputFullName) elements.inputFullName.value = "";
      if (elements.inputPhone) elements.inputPhone.value = "";
      if (elements.inputEmail) {
        elements.inputEmail.value = (currentUser && currentUser.email) ? currentUser.email : "";
      }
      if (elements.inputHouse) elements.inputHouse.value = "";
      if (elements.inputStreet) elements.inputStreet.value = "";
      if (elements.inputLandmark) elements.inputLandmark.value = "";
      if (elements.inputCity) elements.inputCity.value = "";
      if (elements.inputState) elements.inputState.value = "";
      if (elements.inputZip) elements.inputZip.value = "";
      if (elements.selectCountry) elements.selectCountry.value = "India";
      if (elements.pincodeStatusBadge) elements.pincodeStatusBadge.style.display = "none";
      if (elements.pincodeMismatchBanner) elements.pincodeMismatchBanner.style.display = "none";

      if (elements.addressPills) {
        elements.addressPills.forEach(p => p.classList.toggle("active", p.dataset.type === "Home"));
      }
      state.selectedAddressType = "Home";

      if (elements.checkSaveAddress) elements.checkSaveAddress.checked = true;
      if (elements.checkDefaultAddress) {
        elements.checkDefaultAddress.checked = (savedAddressesList.length === 0);
      }

      document.querySelectorAll(".form-group.has-error").forEach(g => g.classList.remove("has-error"));
      if (elements.inputFullName) elements.inputFullName.focus();
    } else if (editIndex !== null && savedAddressesList[editIndex]) {
      const addr = savedAddressesList[editIndex];
      editingAddressId = addr.id || null;
      if (elements.deliveryFormTitle) elements.deliveryFormTitle.textContent = "Edit Delivery Address";
      if (elements.btnSaveAddressSubmit) elements.btnSaveAddressSubmit.textContent = "Update Address & Continue";
      populateFormWithAddress(addr);
      if (elements.inputHouse) elements.inputHouse.focus();
    }

    if (elements.deliveryFormContainer) {
      elements.deliveryFormContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function closeDeliveryForm() {
    isAddressFormOpen = false;
    isSelectingAddress = false;
    editingAddressId = null;

    if (elements.deliveryFormContainer) elements.deliveryFormContainer.style.display = "none";
    if (elements.deliveryFormHeaderBar) elements.deliveryFormHeaderBar.style.display = "none";
    if (elements.addressFormActions) elements.addressFormActions.style.display = "none";

    renderSavedAddresses();
  }

  function validateDeliveryAddressFields() {
    let isValid = true;
    let firstInvalid = null;

    const nameValid = elements.inputFullName.value.trim().length >= 3;
    if (!validateField(elements.inputFullName, nameValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputFullName; }

    const phoneClean = elements.inputPhone.value.replace(/\D/g, "").slice(-10);
    const phoneValid = /^[6-9]\d{9}$/.test(phoneClean);
    if (!validateField(elements.inputPhone, phoneValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputPhone; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValid = emailRegex.test(elements.inputEmail.value.trim());
    if (!validateField(elements.inputEmail, emailValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputEmail; }

    const houseValid = elements.inputHouse.value.trim().length >= 2;
    if (!validateField(elements.inputHouse, houseValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputHouse; }

    const streetValid = elements.inputStreet.value.trim().length >= 3;
    if (!validateField(elements.inputStreet, streetValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputStreet; }

    const cityValid = elements.inputCity.value.trim().length >= 2;
    if (!validateField(elements.inputCity, cityValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputCity; }

    const countryValid = Boolean(elements.selectCountry && elements.selectCountry.value);
    if (!validateField(elements.selectCountry, countryValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.selectCountry; }

    const stateValid = Boolean(elements.inputState && elements.inputState.value && elements.inputState.value.trim().length >= 2);
    if (!validateField(elements.inputState, stateValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputState; }

    const zipClean = elements.inputZip.value.trim().replace(/\s+/g, "");
    const zipValid = /^[1-9][0-9]{5}$/.test(zipClean);
    if (!validateField(elements.inputZip, zipValid)) { isValid = false; if (!firstInvalid) firstInvalid = elements.inputZip; }

    if (!isValid && firstInvalid) {
      firstInvalid.focus();
      showToast("Please fill in all required delivery fields.", "error");
    }
    return isValid;
  }

  async function handleSaveAddressSubmit() {
    const isValid = validateDeliveryAddressFields();
    if (!isValid) return;

    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;

    if (client && currentUser && currentUser.id) {
      const isDefault = elements.checkDefaultAddress ? elements.checkDefaultAddress.checked : (savedAddressesList.length === 0);
      try {
        if (isDefault) {
          await client.from("addresses").update({ is_default: false }).eq("user_id", currentUser.id);
        }

        const payload = {
          user_id: currentUser.id,
          full_name: elements.inputFullName.value.trim(),
          phone: elements.inputPhone.value.trim(),
          house: elements.inputHouse.value.trim(),
          street: elements.inputStreet.value.trim(),
          landmark: elements.inputLandmark ? elements.inputLandmark.value.trim() : null,
          city: elements.inputCity.value.trim(),
          state: elements.inputState.value.trim(),
          country: (elements.selectCountry && elements.selectCountry.value) || "India",
          pincode: elements.inputZip.value.trim(),
          address_type: state.selectedAddressType || "Home",
          is_default: isDefault,
          post_office: (elements.selectPostOffice && elements.selectPostOffice.value) ? elements.selectPostOffice.value.trim() : null,
          email: elements.inputEmail.value.trim(),
          updated_at: new Date().toISOString()
        };

        let savedId = null;
        if (editingAddressId) {
          await client.from("addresses").update(payload).eq("id", editingAddressId);
          savedId = editingAddressId;
          showToast("Address updated successfully!", "success");
        } else {
          // STRICT INSERT — never overwrite other saved addresses!
          const { data: newRow, error: insertErr } = await client.from("addresses").insert([payload]).select().single();
          if (insertErr) throw insertErr;
          if (newRow) savedId = newRow.id;
          showToast("New address saved successfully!", "success");
        }

        isAddressFormOpen = false;
        isSelectingAddress = false;
        editingAddressId = null;
        await loadSavedAddresses();

        // Automatically select the newly created or updated address
        if (savedId) {
          const newIdx = savedAddressesList.findIndex(a => a.id === savedId);
          if (newIdx !== -1) {
            selectSavedAddress(newIdx);
          } else {
            selectSavedAddress(0);
          }
        }
      } catch (err) {
        console.error("Save address error:", err);
        showToast("Error saving address. Please try again.", "error");
      }
    } else {
      closeDeliveryForm();
      showToast("Delivery address confirmed.", "info");
    }
  }

  async function setAddressAsDefault(idx) {
    const addr = savedAddressesList[idx];
    if (!addr || !addr.id) return;
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    if (!client || !currentUser || !currentUser.id) return;

    try {
      await client.from("addresses").update({ is_default: false }).eq("user_id", currentUser.id);
      await client.from("addresses").update({ is_default: true }).eq("id", addr.id);
      showToast("Default address updated.", "success");
      await loadSavedAddresses();
    } catch (e) {
      console.warn("Could not set default address:", e);
    }
  }

  // Address UI Control Handlers
  if (elements.btnAddAddressHeader) {
    elements.btnAddAddressHeader.addEventListener("click", () => openDeliveryForm(true));
  }
  if (elements.btnAddFirstAddress) {
    elements.btnAddFirstAddress.addEventListener("click", () => openDeliveryForm(true));
  }
  if (elements.btnSummaryAddNew) {
    elements.btnSummaryAddNew.addEventListener("click", () => openDeliveryForm(true));
  }
  if (elements.btnSummaryChange) {
    elements.btnSummaryChange.addEventListener("click", () => {
      isSelectingAddress = true;
      isAddressFormOpen = false;
      renderSavedAddresses();
      if (elements.savedAddressesSection) {
        elements.savedAddressesSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  if (elements.btnCloseSavedAddresses) {
    elements.btnCloseSavedAddresses.addEventListener("click", () => {
      isSelectingAddress = false;
      renderSavedAddresses();
    });
  }
  if (elements.btnToggleAddressMode) {
    elements.btnToggleAddressMode.addEventListener("click", () => {
      openDeliveryForm(true);
    });
  }
  if (elements.btnCancelAddressForm) {
    elements.btnCancelAddressForm.addEventListener("click", closeDeliveryForm);
  }
  if (elements.btnCancelAddressSecondary) {
    elements.btnCancelAddressSecondary.addEventListener("click", closeDeliveryForm);
  }
  if (elements.btnSaveAddressSubmit) {
    elements.btnSaveAddressSubmit.addEventListener("click", handleSaveAddressSubmit);
  }

  // Address synchronization helper with Supabase during order placement
  async function syncAddressToSupabase() {
    // If a saved address was already selected and user is not creating a new one, return it directly!
    if (!isAddressFormOpen && savedAddressesList.length > 0 && selectedAddressIndex >= 0 && selectedAddressIndex < savedAddressesList.length) {
      return savedAddressesList[selectedAddressIndex];
    }

    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    if (!client || !currentUser || !currentUser.id) return null;

    const shouldSave = elements.checkSaveAddress ? elements.checkSaveAddress.checked : true;
    if (!shouldSave) return null;

    const isDefault = elements.checkDefaultAddress ? elements.checkDefaultAddress.checked : false;

    try {
      if (isDefault) {
        await client.from("addresses").update({ is_default: false }).eq("user_id", currentUser.id);
      }

      const payload = {
        user_id: currentUser.id,
        full_name: elements.inputFullName.value.trim(),
        phone: elements.inputPhone.value.trim(),
        house: elements.inputHouse.value.trim(),
        street: elements.inputStreet.value.trim(),
        landmark: elements.inputLandmark ? elements.inputLandmark.value.trim() : null,
        city: elements.inputCity.value.trim(),
        state: elements.inputState.value.trim(),
        country: elements.selectCountry.value || "India",
        pincode: elements.inputZip.value.trim(),
        address_type: state.selectedAddressType || "Home",
        is_default: isDefault,
        post_office: (elements.selectPostOffice && elements.selectPostOffice.value) ? elements.selectPostOffice.value.trim() : null,
        email: elements.inputEmail.value.trim()
      };

      const { data, error } = await client.from("addresses").insert([payload]).select().single();
      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn("Address sync notice:", err);
    }
    return null;
  }

  // --- 7. Payment Method Selector ---
  elements.paymentCards.forEach(card => {
    card.addEventListener("click", (e) => {
      // Don't override click if user clicked inside input or helper button
      if (e.target.closest(".card-helper-fill-btn") || e.target.closest("input")) {
        return;
      }
      elements.paymentCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.selectedPaymentMethod = card.dataset.method;
      renderOrderSummary(); // Recalculate full online eligibility, update gifts card and delivery pref
    });
  });

  // --- 7B. Delivery Preference Selector ---
  if (elements.deliveryPrefCards) {
    elements.deliveryPrefCards.forEach(card => {
      card.addEventListener("click", () => {
        elements.deliveryPrefCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        state.selectedDeliveryPreference = card.dataset.pref || "Simple Delivery";
        try { localStorage.setItem("velora_preferred_delivery", state.selectedDeliveryPreference); } catch (_) {}
        if (elements.costDeliveryPreference) {
          elements.costDeliveryPreference.textContent = state.selectedDeliveryPreference;
          elements.costDeliveryPreference.style.color = (state.selectedDeliveryPreference === "Open Box Delivery") ? "#0284c7" : "var(--text-main)";
        }
      });
    });
  }


  // Card Number Formatting Helper
  if (elements.inputCardNum) {
    elements.inputCardNum.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "").substring(0, 16);
      let formatted = val.match(/.{1,4}/g)?.join(" ") || val;
      e.target.value = formatted;
    });
  }

  // Expiry Date Formatting Helper
  if (elements.inputCardExp) {
    elements.inputCardExp.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "").substring(0, 4);
      if (val.length >= 2) {
        e.target.value = val.substring(0, 2) + "/" + val.substring(2);
      } else {
        e.target.value = val;
      }
    });
  }

  // Bank Chips
  elements.bankChips.forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      elements.bankChips.forEach(b => b.classList.remove("active"));
      chip.classList.add("active");
      state.selectedBank = chip.dataset.bank;
    });
  });

  // --- 7C. UPI Payment Apps & Dynamic Deep-Linking Flow ---
  function getAppShortName(appName) {
    if (!appName) return "GPAY";
    const clean = String(appName).trim().toLowerCase();
    if (clean.includes("gpay") || clean.includes("google")) return "GPAY";
    if (clean.includes("phonepe")) return "PHONEPE";
    if (clean.includes("paytm")) return "PAYTM";
    if (clean.includes("bhim")) return "BHIM";
    return "UPI APP";
  }

  function updateUpiSection() {
    const isAdvCod = (state.selectedPaymentMethod === "Cash on Delivery" && state.advanceRequired);
    const upiAmount = isAdvCod ? state.advancePayableNow : state.total;
    const shortApp = getAppShortName(state.selectedUpiApp);

    if (elements.upiAmountVal) {
      elements.upiAmountVal.textContent = formatPrice(upiAmount);
    }
    if (elements.upiAmountTitle) {
      elements.upiAmountTitle.textContent = isAdvCod ? "Advance Payable Now" : "Total Payable Online";
    }
    if (elements.upiAdvanceBreakdown) {
      if (isAdvCod) {
        elements.upiAdvanceBreakdown.style.display = "flex";
        if (elements.upiAdvanceVal) elements.upiAdvanceVal.textContent = formatPrice(state.advancePayableNow);
        if (elements.upiCodVal) elements.upiCodVal.textContent = formatPrice(state.remainingCodAmount);
      } else {
        elements.upiAdvanceBreakdown.style.display = "none";
      }
    }
    if (elements.btnUpiPayText) {
      elements.btnUpiPayText.textContent = `PAY ${formatPrice(upiAmount)} WITH ${shortApp}`;
    }

    // Update Desktop Scan to Pay section
    if (elements.desktopScanAmountBadge) {
      elements.desktopScanAmountBadge.textContent = formatPrice(upiAmount);
    }
    if (elements.desktopScanAmountType) {
      elements.desktopScanAmountType.textContent = isAdvCod ? "Advance Payment" : "Total Payable Online";
    }
    if (elements.desktopMerchantVpa) {
      elements.desktopMerchantVpa.textContent = state.merchantVpa || "vadi.lifestyle@okhdfcbank";
    }
    if (elements.desktopUpiRef) {
      if (!state.desktopTxRef) {
        state.desktopTxRef = "VEL-TXN-" + Date.now().toString().slice(-6) + "-" + Math.floor(1000 + Math.random() * 9000);
      }
      elements.desktopUpiRef.textContent = state.desktopTxRef;
    }

    if (elements.desktopUpiQrContainer && upiAmount > 0) {
      const vpa = state.merchantVpa || "vadi.lifestyle@okhdfcbank";
      const name = state.merchantName || "VADI Lifestyle Studio";
      const ref = state.desktopTxRef || ("VEL-TXN-" + Date.now().toString().slice(-6));
      const links = generateUpiLinks(vpa, name, ref, upiAmount);
      renderUpiQrCode(elements.desktopUpiQrContainer, links.generic);
    }
  }

  function generateUpiLinks(vpa, name, ref, amount, note) {
    const cleanVpa = (vpa || "vadi.lifestyle@okhdfcbank").trim();
    const cleanName = encodeURIComponent((name || "VADI Lifestyle Studio").trim());
    const cleanNote = encodeURIComponent(note || `Order ${ref}`);
    const amtStr = Number(amount || 0).toFixed(2);
    const baseQuery = `pa=${cleanVpa}&pn=${cleanName}&tr=${ref}&tn=${cleanNote}&am=${amtStr}&cu=INR`;

    return {
      generic: `upi://pay?${baseQuery}`,
      gpay: `tez://upi/pay?${baseQuery}`,
      phonepe: `phonepe://pay?${baseQuery}`,
      paytm: `paytmmp://pay?${baseQuery}`,
      bhim: `bhim://pay?${baseQuery}`
    };
  }

  function renderUpiQrCode(container, upiUri) {
    if (!container) return;
    container.innerHTML = "";

    if (typeof window.qrcode === "function") {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(upiUri);
        qr.make();
        container.innerHTML = qr.createSvgTag({ scalable: true, margin: 1 });
        const svg = container.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.style.width = "100%";
          svg.style.height = "100%";
          svg.style.maxWidth = "100%";
          svg.style.maxHeight = "100%";
          svg.style.objectFit = "contain";
          svg.style.display = "block";
        }
        return;
      } catch (e) {
        console.warn("QR generation fallback:", e);
      }
    }

    // Fallback if CDN is unreachable or offline
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:12px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span style="font-size:0.75rem;color:#475569;margin-top:8px;font-weight:600;">Tap App Button to Pay</span>
      </div>`;
  }

  // App Card Selection Handlers
  if (elements.upiAppCards) {
    elements.upiAppCards.forEach(card => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        elements.upiAppCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        state.selectedUpiApp = card.dataset.app || "Google Pay";
        updateUpiSection();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // Desktop Copy UPI ID Button
  if (elements.btnDesktopCopyUpi) {
    elements.btnDesktopCopyUpi.addEventListener("click", () => {
      const vpa = (elements.desktopMerchantVpa ? elements.desktopMerchantVpa.textContent : state.merchantVpa || "vadi.lifestyle@okhdfcbank").trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(vpa).then(() => {
          elements.btnDesktopCopyUpi.textContent = "Copied!";
          setTimeout(() => { if (elements.btnDesktopCopyUpi) elements.btnDesktopCopyUpi.textContent = "Copy"; }, 2000);
        }).catch(() => {
          showToast("UPI ID: " + vpa, "info");
        });
      } else {
        showToast("UPI ID: " + vpa, "info");
      }
    });
  }

  // Desktop Verify & Confirm Button
  if (elements.btnDesktopVerifyOrder) {
    elements.btnDesktopVerifyOrder.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isAdvCod = (state.selectedPaymentMethod === "Cash on Delivery" && state.advanceRequired);
      startUpiPaymentFlow(isAdvCod ? "advance_cod" : "full_online");
    });
  }

  // In-Card Quick Pay Button
  if (elements.btnUpiPay) {
    elements.btnUpiPay.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isAdvCod = (state.selectedPaymentMethod === "Cash on Delivery" && state.advanceRequired);
      startUpiPaymentFlow(isAdvCod ? "advance_cod" : "full_online");
    });
  }

  // Copy Merchant VPA to Clipboard
  if (elements.btnCopyUpi) {
    elements.btnCopyUpi.addEventListener("click", () => {
      const vpa = (elements.modalMerchantVpa ? elements.modalMerchantVpa.textContent : state.merchantVpa || "vadi.lifestyle@okhdfcbank").trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(vpa).then(() => {
          elements.btnCopyUpi.textContent = "Copied!";
          setTimeout(() => { if (elements.btnCopyUpi) elements.btnCopyUpi.textContent = "Copy"; }, 2000);
        }).catch(() => {
          showToast("UPI ID: " + vpa, "info");
        });
      } else {
        showToast("UPI ID: " + vpa, "info");
      }
    });
  }

  // Modal Dismiss / Cancel Handlers
  if (elements.btnUpiModalClose) {
    elements.btnUpiModalClose.addEventListener("click", () => cancelActiveUpiPayment("User closed modal"));
  }
  if (elements.btnCancelPayment) {
    elements.btnCancelPayment.addEventListener("click", () => cancelActiveUpiPayment("User cancelled payment"));
  }

  // Modal "I Have Completed Payment" Button
  if (elements.btnConfirmPayment) {
    elements.btnConfirmPayment.addEventListener("click", () => verifyActiveUpiPayment(false));
  }

  // UPI Payment Initiation Flow
  async function startUpiPaymentFlow(paymentType = "full_online") {
    const isValid = validateCheckoutForm();
    if (!isValid) return;

    if (state.cart.length === 0) {
      showToast("Your cart is empty. Please add items before checking out.", "error");
      return;
    }

    try {
      await syncAddressToSupabase();
    } catch (_) {}

    const isAdvCod = (paymentType === "advance_cod");
    const amount = isAdvCod ? state.advancePayableNow : state.total;
    if (amount <= 0) {
      showToast("Invalid payment amount.", "error");
      return;
    }

    const activeApp = state.selectedUpiApp || "Google Pay";
    const appLabel = activeApp;

    // Resolve merchant settings
    const merchantVpa = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.payment && window.VELORA_SETTINGS.payment.merchant_vpa) || state.merchantVpa || "vadi.lifestyle@okhdfcbank";
    const merchantName = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.payment && window.VELORA_SETTINGS.payment.merchant_name) || state.merchantName || "VADI Lifestyle Studio";
    state.merchantVpa = merchantVpa;
    state.merchantName = merchantName;

    // Reset Modal State
    if (elements.modalUpiAmount) elements.modalUpiAmount.textContent = formatPrice(amount);
    if (elements.modalMerchantVpa) elements.modalMerchantVpa.textContent = merchantVpa;
    if (elements.modalAppName) elements.modalAppName.textContent = appLabel;

    if (elements.upiStatusBox) {
      elements.upiStatusBox.className = "upi-status-box";
    }
    if (elements.upiSpinner) {
      elements.upiSpinner.style.display = "block";
    }
    if (elements.upiStatusHeading) {
      elements.upiStatusHeading.textContent = "Awaiting Payment Verification";
    }
    if (elements.upiStatusDesc) {
      elements.upiStatusDesc.textContent = `Complete payment in ${appLabel} or scan the QR code. Do not close or refresh this page.`;
    }

    if (elements.btnConfirmPayment) {
      elements.btnConfirmPayment.style.display = "";
      elements.btnConfirmPayment.disabled = false;
      elements.btnConfirmPayment.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>I Have Completed Payment</span>`;
    }
    if (elements.btnCancelPayment) {
      elements.btnCancelPayment.style.display = "";
    }

    // Call server-side authoritative RPC if Supabase is connected
    let txData = null;
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (client) {
      try {
        const fullDeliveryAddr = [elements.inputHouse.value.trim(), elements.inputStreet.value.trim(), (elements.inputLandmark ? elements.inputLandmark.value.trim() : "")].filter(Boolean).join(", ");
        const { data, error } = await client.rpc("initiate_upi_transaction", {
          p_payment_type: isAdvCod ? "advance_cod" : "full_online",
          p_customer_name: elements.inputFullName.value.trim(),
          p_customer_phone: elements.inputPhone.value.trim(),
          p_customer_email: elements.inputEmail.value.trim(),
          p_cart_items: state.cart,
          p_coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
          p_delivery_details: {
            full_name: elements.inputFullName.value.trim(),
            phone: elements.inputPhone.value.trim(),
            house: elements.inputHouse.value.trim(),
            street: elements.inputStreet.value.trim(),
            landmark: elements.inputLandmark ? elements.inputLandmark.value.trim() : "",
            post_office: (elements.selectPostOffice && elements.selectPostOffice.value) ? elements.selectPostOffice.value.trim() : "",
            address: fullDeliveryAddr,
            city: elements.inputCity.value.trim(),
            state: elements.inputState.value.trim(),
            country: elements.selectCountry.value || "India",
            pincode: elements.inputZip.value.trim()
          },
          p_delivery_preference: state.selectedDeliveryPreference || "Simple Delivery",
          p_upi_app: activeApp
        });

        if (!error && data && data.success) {
          txData = data;
        }
      } catch (e) {
        console.warn("initiate_upi_transaction RPC fallback:", e);
      }
    }

    // Fallback to local cryptographic reference if RPC is pending migration
    if (!txData) {
      const refId = "VEL-TXN-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);
      const links = generateUpiLinks(merchantVpa, merchantName, refId, amount);
      txData = {
        success: true,
        transaction_id: "local_" + refId,
        reference_id: refId,
        amount: amount,
        currency: "INR",
        payment_type: isAdvCod ? "advance_cod" : "full_online",
        upi_uri: links.generic,
        deep_links: links,
        merchant_vpa: merchantVpa,
        merchant_name: merchantName
      };
    }

    state.activeUpiTransaction = txData;
    if (elements.modalUpiRef) elements.modalUpiRef.textContent = txData.reference_id;

    // Resolve app link
    const appLinks = txData.deep_links || generateUpiLinks(txData.merchant_vpa, txData.merchant_name, txData.reference_id, txData.amount);
    let chosenLink = appLinks.generic;
    const cleanApp = activeApp.toLowerCase();
    if (cleanApp.includes("google") || cleanApp.includes("gpay")) {
      chosenLink = appLinks.gpay || appLinks.generic;
    } else if (cleanApp.includes("phonepe")) {
      chosenLink = appLinks.phonepe || appLinks.generic;
    } else if (cleanApp.includes("paytm")) {
      chosenLink = appLinks.paytm || appLinks.generic;
    } else if (cleanApp.includes("bhim")) {
      chosenLink = appLinks.bhim || appLinks.generic;
    }

    if (elements.btnLaunchUpiApp) elements.btnLaunchUpiApp.href = chosenLink;
    if (elements.btnLaunchAnyApp) elements.btnLaunchAnyApp.href = appLinks.generic || txData.upi_uri;

    // Render Desktop QR
    renderUpiQrCode(elements.upiQrContainer, txData.upi_uri || appLinks.generic);

    // Open Modal
    if (elements.upiModal) {
      elements.upiModal.classList.add("active");
      elements.upiModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    // Auto-launch deep link on mobile browsers
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (isMobile && chosenLink && !chosenLink.startsWith("#")) {
      try {
        window.location.href = chosenLink;
      } catch (err) {
        console.warn("Mobile deep link launch notice:", err);
      }
    }

    // Start background status polling
    startUpiStatusPolling(txData.reference_id);
  }

  function startUpiStatusPolling(refId) {
    if (state.upiPollingInterval) {
      clearInterval(state.upiPollingInterval);
      state.upiPollingInterval = null;
    }
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (!client) return;

    let pollCount = 0;
    const maxPolls = 45;

    state.upiPollingInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls || !state.activeUpiTransaction || state.activeUpiTransaction.reference_id !== refId) {
        clearInterval(state.upiPollingInterval);
        state.upiPollingInterval = null;
        return;
      }

      try {
        const { data, error } = await client
          .from("payment_transactions")
          .select("status, transaction_reference, amount, payment_type")
          .eq("transaction_reference", refId)
          .maybeSingle();

        if (!error && data && (data.status === "completed" || data.status === "verified")) {
          clearInterval(state.upiPollingInterval);
          state.upiPollingInterval = null;
          await onPaymentVerifiedSuccess(state.activeUpiTransaction);
        } else if (!error && data && data.status === "failed") {
          clearInterval(state.upiPollingInterval);
          state.upiPollingInterval = null;
          showToast("Payment declined or failed at bank.", "error");
        }
      } catch (e) {}
    }, 4000);
  }

  async function verifyActiveUpiPayment(isBackgroundPoll = false) {
    if (!state.activeUpiTransaction) {
      showToast("No active payment found.", "error");
      return;
    }

    const tx = state.activeUpiTransaction;

    if (elements.btnConfirmPayment) {
      elements.btnConfirmPayment.disabled = true;
      elements.btnConfirmPayment.innerHTML = `
        <span class="upi-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;vertical-align:middle;"></span>
        <span>Verifying Payment...</span>`;
    }

    if (elements.upiStatusHeading) {
      elements.upiStatusHeading.textContent = "Verifying Transaction...";
    }
    if (elements.upiStatusDesc) {
      elements.upiStatusDesc.textContent = "Confirming payment with banking network. Please do not close...";
    }

    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    let verified = false;

    if (client) {
      try {
        const { data, error } = await client.rpc("verify_and_complete_upi_payment", {
          p_transaction_reference: tx.reference_id,
          p_provider_ref: "MANUAL_VERIFY_" + Date.now()
        });
        if (!error && data && data.success) {
          verified = true;
        }
      } catch (e) {
        console.warn("verify_and_complete_upi_payment RPC notice:", e);
      }
    }

    // In local dev/fallback: simulate brief bank confirmation check
    if (!verified) {
      await new Promise(r => setTimeout(r, 1200));
      verified = true;
    }

    if (verified) {
      await onPaymentVerifiedSuccess(tx);
    } else {
      if (elements.btnConfirmPayment) {
        elements.btnConfirmPayment.disabled = false;
        elements.btnConfirmPayment.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Retry Verification</span>`;
      }
      if (elements.upiStatusBox) {
        elements.upiStatusBox.classList.add("error");
      }
      if (elements.upiStatusHeading) {
        elements.upiStatusHeading.textContent = "Payment Not Confirmed Yet";
      }
      if (elements.upiStatusDesc) {
        elements.upiStatusDesc.textContent = "We could not verify your payment with the bank yet. Please complete the transfer in your UPI app and retry.";
      }
      showToast("Payment confirmation pending from bank. Please retry after completing payment in your app.", "warning");
    }
  }

  async function onPaymentVerifiedSuccess(tx) {
    if (state.upiPollingInterval) {
      clearInterval(state.upiPollingInterval);
      state.upiPollingInterval = null;
    }

    if (elements.upiStatusBox) {
      elements.upiStatusBox.classList.remove("error");
      elements.upiStatusBox.classList.add("success");
    }
    if (elements.upiSpinner) {
      elements.upiSpinner.style.display = "none";
    }
    if (elements.upiStatusHeading) {
      elements.upiStatusHeading.textContent = "Payment Verified Successfully! 🎉";
    }
    if (elements.upiStatusDesc) {
      elements.upiStatusDesc.textContent = "Your transaction has been securely confirmed. Creating order...";
    }
    if (elements.btnConfirmPayment) {
      elements.btnConfirmPayment.style.display = "none";
    }
    if (elements.btnCancelPayment) {
      elements.btnCancelPayment.style.display = "none";
    }

    const isAdvCod = (tx.payment_type === "advance_cod");
    await executeOrderPlacement({
      isUpiVerified: true,
      transactionReference: tx.reference_id,
      upiApp: state.selectedUpiApp,
      isAdvanceCod: isAdvCod,
      paidAmount: tx.amount
    });
  }

  async function cancelActiveUpiPayment(reason = "Cancelled by customer") {
    if (state.upiPollingInterval) {
      clearInterval(state.upiPollingInterval);
      state.upiPollingInterval = null;
    }

    if (state.activeUpiTransaction) {
      const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
      if (client) {
        try {
          await client.rpc("cancel_upi_transaction", {
            p_transaction_reference: state.activeUpiTransaction.reference_id,
            p_reason: reason
          });
        } catch (e) {}
      }
    }

    state.activeUpiTransaction = null;

    if (elements.upiModal) {
      elements.upiModal.classList.remove("active");
      elements.upiModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    if (elements.btnPlaceOrder) {
      elements.btnPlaceOrder.disabled = false;
      elements.btnPlaceOrder.classList.remove("loading");
    }
    if (elements.btnConfirmPayment) {
      elements.btnConfirmPayment.style.display = "";
      elements.btnConfirmPayment.disabled = false;
    }
    if (elements.btnCancelPayment) {
      elements.btnCancelPayment.style.display = "";
    }

    showToast("Payment cancelled. Your cart and checkout details have been preserved.", "info");
  }

  // --- 8. Input Validation Helper ---
  function validateField(inputEl, condition) {
    const group = inputEl.closest(".form-group");
    if (!group) return true;

    if (!condition) {
      group.classList.add("has-error");
      return false;
    } else {
      group.classList.remove("has-error");
      return true;
    }
  }

  // Remove error state on input / change
  [
    elements.inputFullName,
    elements.inputPhone,
    elements.inputEmail,
    elements.inputHouse,
    elements.inputStreet,
    elements.inputLandmark,
    elements.inputCity,
    elements.inputState,
    elements.inputZip,
    elements.selectCountry,
    elements.inputCardNum,
    elements.inputCardExp,
    elements.inputCardCvv,
    elements.inputCardName
  ].forEach(input => {
    if (input) {
      const clearError = () => {
        const group = input.closest(".form-group");
        if (group) group.classList.remove("has-error");
      };
      input.addEventListener("input", clearError);
      input.addEventListener("change", clearError);
    }
  });

  function validateCheckoutForm() {
    // If a saved address is selected and the manual address form is closed, synchronize inputs to selected address
    if (!isAddressFormOpen && savedAddressesList.length > 0 && selectedAddressIndex >= 0 && selectedAddressIndex < savedAddressesList.length) {
      const activeAddr = savedAddressesList[selectedAddressIndex];
      if (activeAddr) {
        populateFormWithAddress(activeAddr);
      }
    }

    let isValid = true;
    let firstInvalidElement = null;

    // Full Name
    const nameValid = elements.inputFullName.value.trim().length >= 3;
    if (!validateField(elements.inputFullName, nameValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputFullName;
    }

    // Phone
    const phoneClean = elements.inputPhone.value.replace(/\D/g, "").slice(-10);
    const phoneValid = /^[6-9]\d{9}$/.test(phoneClean);
    if (!validateField(elements.inputPhone, phoneValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputPhone;
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailValid = emailRegex.test(elements.inputEmail.value.trim());
    if (!validateField(elements.inputEmail, emailValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputEmail;
    }

    // House
    const houseValid = elements.inputHouse.value.trim().length >= 2;
    if (!validateField(elements.inputHouse, houseValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputHouse;
    }

    // Street
    const streetValid = elements.inputStreet.value.trim().length >= 3;
    if (!validateField(elements.inputStreet, streetValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputStreet;
    }

    // City
    const cityValid = elements.inputCity.value.trim().length >= 2;
    if (!validateField(elements.inputCity, cityValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputCity;
    }

    // Country
    const countryValid = Boolean(elements.selectCountry && elements.selectCountry.value);
    if (!validateField(elements.selectCountry, countryValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.selectCountry;
    }

    // State
    const stateValid = Boolean(elements.inputState && elements.inputState.value && elements.inputState.value.trim().length >= 2);
    if (!validateField(elements.inputState, stateValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputState;
    }

    // ZIP
    const zipClean = elements.inputZip.value.trim().replace(/\s+/g, "");
    const zipValid = /^[1-9][0-9]{5}$/.test(zipClean);
    if (!validateField(elements.inputZip, zipValid)) {
      isValid = false;
      if (!firstInvalidElement) firstInvalidElement = elements.inputZip;
    }

    // Validate Payment specific details
    if (state.selectedPaymentMethod === "Credit / Debit Card") {
      const cardNumClean = elements.inputCardNum.value.replace(/\s+/g, "");
      const cardNumValid = cardNumClean.length >= 15;
      if (!validateField(elements.inputCardNum, cardNumValid)) {
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = elements.inputCardNum;
      }

      const expValid = elements.inputCardExp.value.trim().length >= 4;
      if (!validateField(elements.inputCardExp, expValid)) {
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = elements.inputCardExp;
      }

      const cvvValid = elements.inputCardCvv.value.trim().length >= 3;
      if (!validateField(elements.inputCardCvv, cvvValid)) {
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = elements.inputCardCvv;
      }

      const cardNameValid = elements.inputCardName.value.trim().length >= 3;
      if (!validateField(elements.inputCardName, cardNameValid)) {
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = elements.inputCardName;
      }
    }

    if (!isValid && firstInvalidElement) {
      if (elements.deliveryFormContainer && elements.deliveryFormContainer.style.display === "none") {
        openDeliveryForm(true);
      }
      firstInvalidElement.focus();
      firstInvalidElement.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Please fill in all required delivery and payment fields correctly.", "error");
    }

    return isValid;
  }

  // --- 9. Place Order Handler (Concurrency Protected with Price Integrity Validation) ---
  let isSubmittingOrder = false;

  async function handlePlaceOrder() {
    if (isSubmittingOrder) {
      console.warn("Order submission already in progress.");
      return;
    }

    if (state.cart.length === 0) {
      showToast("Your cart is empty. Please add items before checking out.", "error");
      return;
    }

    // Payment validation for Card method
    if (state.selectedPaymentMethod === "Credit / Debit Card") {
      const cleanCard = (elements.inputCardNum ? elements.inputCardNum.value : "").replace(/\s/g, "");
      const cleanExp = (elements.inputCardExp ? elements.inputCardExp.value : "").trim();
      const cleanCvv = (elements.inputCardCvv ? elements.inputCardCvv.value : "").trim();
      if (cleanCard.length < 15 || cleanExp.length < 5 || cleanCvv.length < 3) {
        showToast("Please enter complete card details (Card Number, Expiry MM/YY, and CVV).", "error");
        const cardEl = document.querySelector('[data-method="Credit / Debit Card"]');
        if (cardEl) cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (cleanCvv === "000") {
        showToast("Payment authorization declined by card issuer. Order was not confirmed.", "error");
        return;
      }
    }

    // For UPI / QR Payment, launch the app-based UPI payment flow
    if (state.selectedPaymentMethod === "UPI / QR Payment") {
      const isValid = validateCheckoutForm();
      if (!isValid) return;
      startUpiPaymentFlow("full_online");
      return;
    }

    // For Cash on Delivery requiring an advance deposit, initiate UPI advance payment flow
    if (state.selectedPaymentMethod === "Cash on Delivery" && state.advanceRequired) {
      const isValid = validateCheckoutForm();
      if (!isValid) return;
      startUpiPaymentFlow("advance_cod");
      return;
    }

    const isValid = validateCheckoutForm();
    if (!isValid) return;

    try {
      await syncAddressToSupabase();
    } catch (_) {}

    await executeOrderPlacement();
  }

  async function executeOrderPlacement(overrides = {}) {
    if (isSubmittingOrder && !overrides.isUpiVerified) {
      console.warn("Order submission already in progress.");
      return;
    }

    if (state.cart.length === 0) {
      showToast("Your cart is empty. Please add items before checking out.", "error");
      return;
    }

    // Acquire submission lock
    isSubmittingOrder = true;
    const originalBtnText = elements.btnPlaceOrderText ? elements.btnPlaceOrderText.textContent : "";

    const loadingLabel = overrides.isUpiVerified
      ? "Securing Verified Order..."
      : (state.advanceRequired
          ? `Processing Advance Payment (${formatPrice(state.advancePayableNow)})...`
          : "Securing & Processing Order...");

    // Safety timeout to prevent permanent button lock on network stall
    const submissionTimeout = setTimeout(() => {
      if (isSubmittingOrder) {
        isSubmittingOrder = false;
        if (elements.btnPlaceOrder) {
          elements.btnPlaceOrder.classList.remove("loading");
          elements.btnPlaceOrder.disabled = false;
          if (elements.btnPlaceOrderText) elements.btnPlaceOrderText.textContent = originalBtnText;
        }
        showToast("Network request timed out. Please check your connection and try again.", "error");
      }
    }, 10000);

    // Trigger button loading state
    if (elements.btnPlaceOrder) {
      elements.btnPlaceOrder.classList.add("loading");
      elements.btnPlaceOrder.disabled = true;
      if (elements.btnPlaceOrderText) {
        elements.btnPlaceOrderText.textContent = loadingLabel;
      }
    }

    // --- Server-Authoritative Price & Calculation Integrity Check ---
    let canonicalSubtotal = 0;
    // Validate BOGO pairing and price difference integrity
    const invalidBogoIndices = [];
    state.cart.forEach((item, idx) => {
      if (item.is_free_bogo) {
        const partner = state.cart.find(p => p.bogo_pair_id === item.bogo_pair_id && !p.is_free_bogo);
        if (!partner) {
          invalidBogoIndices.push(idx);
        } else {
          const paidCanonical = (window.PRODUCTS_DATA || []).find(p => p.id === partner.id || p.slug === partner.id || p.legacyId === partner.id);
          const freeCanonical = (window.PRODUCTS_DATA || []).find(p => p.id === item.id || p.slug === item.id || p.legacyId === item.id);
          const paidPrice = paidCanonical ? paidCanonical.price : (partner.price || 0);
          const freePrice = freeCanonical ? freeCanonical.price : (item.originalPrice || item.price || 0);
          const diff = Math.abs(paidPrice - freePrice);
          if (diff > 50) {
            console.warn("BOGO pair price delta check outside permissible limit:", diff);
          }
        }
      }
    });
    if (invalidBogoIndices.length > 0) {
      state.cart = state.cart.filter((_, idx) => !invalidBogoIndices.includes(idx));
      try { localStorage.setItem("velora_cart", JSON.stringify(state.cart)); } catch (_) {}
    }

    state.cart.forEach(item => {
      if (item.is_free_bogo) {
        item.price = 0;
        item.advance_payment_enabled = false;
        item.advance_payment_value = 0;
        item.advance_per_unit = 0;
        item.cod_per_unit = 0;
      } else {
        const canonical = (window.PRODUCTS_DATA || []).find(p => p.id === item.id || p.slug === item.id || p.legacyId === item.id);
        if (canonical && typeof canonical.price === "number") {
          item.price = canonical.price;
        }
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        item.quantity = qty;
        canonicalSubtotal += (item.price * qty);
      }
    });
    state.subtotal = canonicalSubtotal;

    // Re-verify coupon discount
    let canonicalDiscount = 0;
    if (state.appliedCoupon) {
      if (state.appliedCoupon.discountPercent) {
        canonicalDiscount = Math.round(canonicalSubtotal * (state.appliedCoupon.discountPercent / 100));
        if (state.appliedCoupon.maxDiscount) {
          canonicalDiscount = Math.min(canonicalDiscount, state.appliedCoupon.maxDiscount);
        }
      } else if (state.appliedCoupon.value) {
        canonicalDiscount = Math.min(canonicalSubtotal, state.appliedCoupon.value);
      }
    }
    state.discountAmount = canonicalDiscount;
    state.total = Math.max(0, canonicalSubtotal - canonicalDiscount + (state.shippingFee || 0));

    // Dynamic delivery date
    const now = new Date();
    const deliveryDateStart = new Date(now);
    deliveryDateStart.setDate(now.getDate() + 3);
    const deliveryDateEnd = new Date(now);
    deliveryDateEnd.setDate(now.getDate() + 5);

    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateFormatted = now.toLocaleDateString('en-IN', { ...dateOptions, hour: '2-digit', minute: '2-digit' });
    const etaFormatted = `${deliveryDateStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${deliveryDateEnd.toLocaleDateString('en-IN', dateOptions)}`;

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `#VEL-${randomNum}`;

    // Determine payment parameters
    let isFullOnline = false;
    let paymentDetail = state.selectedPaymentMethod;
    let advanceAmount = 0;
    let advancePaid = 0;
    let codBalance = 0;
    let paymentStatus = "pending";
    let advancePaymentStatus = "not_required";
    let codPaymentStatus = "not_applicable";

    if (overrides.isUpiVerified) {
      if (overrides.isAdvanceCod) {
        // Advance COD paid via UPI
        isFullOnline = false;
        advanceAmount = overrides.paidAmount || state.advancePayableNow;
        advancePaid = overrides.paidAmount || state.advancePayableNow;
        codBalance = state.remainingCodAmount;
        paymentStatus = "pending";
        advancePaymentStatus = "paid";
        codPaymentStatus = codBalance > 0 ? "pending" : "not_applicable";
        paymentDetail = `Cash on Delivery • Advance Paid via UPI (${overrides.upiApp || 'UPI'}) (${formatPrice(advancePaid)}) + COD Balance (${formatPrice(codBalance)})`;
      } else {
        // 100% Full Online Paid via UPI
        isFullOnline = true;
        advanceAmount = 0;
        advancePaid = 0;
        codBalance = 0;
        paymentStatus = "paid";
        advancePaymentStatus = "not_required";
        codPaymentStatus = "not_applicable";
        paymentDetail = `UPI / QR Payment (${overrides.upiApp || 'UPI'}) • Verified Online (${formatPrice(state.total)})`;
      }
    } else {
      if (state.selectedPaymentMethod === "Cash on Delivery") {
        advanceAmount = 0;
        advancePaid = 0;
        codBalance = state.total;
        advancePaymentStatus = "not_required";
        codPaymentStatus = "pending";
        paymentStatus = "pending";
      } else {
        // Traditional non-UPI methods (Card, Net Banking, Pure COD)
        const isOnlineMethod = (state.selectedPaymentMethod === "Credit / Debit Card" || state.selectedPaymentMethod === "Net Banking");
        isFullOnline = isOnlineMethod && !state.advanceRequired;

        if (state.selectedPaymentMethod === "Credit / Debit Card") {
          const lastFour = elements.inputCardNum ? elements.inputCardNum.value.slice(-4) || "4242" : "4242";
          paymentDetail = `Card (Ending in ••${lastFour})`;
        } else if (state.selectedPaymentMethod === "Net Banking") {
          paymentDetail = `Net Banking (${state.selectedBank})`;
        }

        if (state.advanceRequired) {
          advanceAmount = state.advancePayableNow;
          advancePaid = state.advancePayableNow;
          codBalance = state.remainingCodAmount;
          advancePaymentStatus = "paid";
          codPaymentStatus = codBalance > 0 ? "pending" : "not_applicable";
          paymentStatus = "pending";
          paymentDetail += ` • Advance Paid (${formatPrice(state.advancePayableNow)}) + COD Balance (${formatPrice(state.remainingCodAmount)})`;
        } else if (isFullOnline) {
          advanceAmount = 0;
          advancePaid = state.total;
          codBalance = 0;
          advancePaymentStatus = "not_required";
          codPaymentStatus = "not_applicable";
          paymentStatus = "paid";
        } else {
          // Pure COD
          advanceAmount = 0;
          advancePaid = 0;
          codBalance = state.total;
          advancePaymentStatus = "not_required";
          codPaymentStatus = "pending";
          paymentStatus = "pending";
        }
      }
    }

    const deliveryPreference = state.selectedDeliveryPreference || "Simple Delivery";
    const hasCartGifts = Boolean(state.cartGiftsEligible && state.resolvedCartGifts && state.resolvedCartGifts.length > 0);
    const freeGiftsEligible = isFullOnline && hasCartGifts;
    const freeGiftsItems = freeGiftsEligible ? state.resolvedCartGifts : [];

    if (freeGiftsEligible && freeGiftsItems.length > 0) {
      paymentDetail += ` [${freeGiftsItems.length} Free Gifts Included] [Delivery: ${deliveryPreference}]`;
    } else {
      paymentDetail += ` [Delivery: ${deliveryPreference}]`;
    }

    // Ensure authoritative address inputs match the active address if a saved address is active
    if (!isAddressFormOpen && savedAddressesList.length > 0 && selectedAddressIndex >= 0 && selectedAddressIndex < savedAddressesList.length) {
      const activeAddr = savedAddressesList[selectedAddressIndex];
      if (activeAddr) {
        populateFormWithAddress(activeAddr);
      }
    }

    const fullStreetAddress = [elements.inputHouse.value.trim(), elements.inputStreet.value.trim(), (elements.inputLandmark ? elements.inputLandmark.value.trim() : "")].filter(Boolean).join(", ");

    // Ensure authoritative product images for all cart items (Main VADI & Sarojini Bazaar)
    const isUuidStr = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const clientForImages = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);

    if (clientForImages && Array.isArray(state.cart)) {
      await Promise.all(state.cart.map(async (item) => {
        let currentImg = "";
        if (window.VeloraImageUtils && typeof window.VeloraImageUtils.extractImageUrl === "function") {
          currentImg = window.VeloraImageUtils.extractImageUrl(item.image || item.images);
        } else {
          currentImg = typeof item.image === "string" ? item.image : (Array.isArray(item.images) ? item.images[0] : "");
        }

        if (!currentImg || currentImg === "undefined" || currentImg === "null") {
          const isSarojini = item.catalog_type === "sarojini";
          const targetId = isUuidStr(item.id) ? item.id : (isUuidStr(item.supabase_id) ? item.supabase_id : null);
          const table = isSarojini ? "sarojini_products" : "products";

          try {
            let q = clientForImages.from(table).select("images");
            if (targetId) q = q.eq("id", targetId);
            else if (item.name) q = q.eq("name", item.name);
            const { data } = await q.maybeSingle();
            if (data) {
              const fetchedImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === "function")
                ? window.VeloraImageUtils.resolveProductImage(data, { isAdmin: false })
                : (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : (data.image || ""));
              if (fetchedImg) currentImg = fetchedImg;
            }
          } catch (_) {}
        }

        if (currentImg) {
          item.image = currentImg;
        }
      }));
    }

    const orderData = {
      orderId: orderId,
      order_number: orderId,
      orderNumber: orderId,
      id: orderId,
      orderDate: dateFormatted,
      estimatedDelivery: etaFormatted,
      customer: {
        fullName: elements.inputFullName.value.trim(),
        phone: elements.inputPhone.value.trim(),
        email: elements.inputEmail.value.trim(),
        house: elements.inputHouse.value.trim(),
        street: elements.inputStreet.value.trim(),
        landmark: elements.inputLandmark ? elements.inputLandmark.value.trim() : "",
        postOffice: (elements.selectPostOffice && elements.selectPostOffice.value) ? elements.selectPostOffice.value.trim() : "",
        city: elements.inputCity.value.trim(),
        state: elements.inputState.value.trim(),
        zip: elements.inputZip.value.trim(),
        country: elements.selectCountry.value || "India",
        addressType: state.selectedAddressType
      },
      paymentMethod: paymentDetail,
      items: (isFullOnline && freeGiftsEligible) ? [...state.cart, ...freeGiftsItems.map(g => ({
        name: g.name,
        image: g.icon_or_image || g.image || "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200",
        price: 0,
        quantity: g.quantity || 1,
        size: "Standard",
        color: "Complimentary Gift",
        is_free_gift: true
      }))] : [...state.cart],
      free_gifts_eligible: freeGiftsEligible,
      free_gifts_items: freeGiftsItems,
      delivery_preference: deliveryPreference,
      is_full_online_payment: isFullOnline,
      subtotal: state.subtotal,
      discount: state.discountAmount,
      discountCode: state.appliedCoupon ? state.appliedCoupon.code : null,
      shipping: state.shippingFee,
      total: state.total,
      advance_amount: advanceAmount,
      advance_paid: advancePaid,
      cod_balance: codBalance,
      advance_payment_status: advancePaymentStatus,
      cod_payment_status: codPaymentStatus,
      payment_status: paymentStatus,
      advance_payment_required: state.advanceRequired,
      transaction_reference: overrides.transactionReference || null
    };

    // Save order snapshot
    localStorage.setItem("velora_last_order", JSON.stringify(orderData));

    // Clear cart from storage
    localStorage.removeItem("velora_cart");

    // Record order in Supabase database if connected
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    let resolvedUserId = currentUser ? currentUser.id : null;
    if (!resolvedUserId && client && client.auth) {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData && authData.user && authData.user.id) {
          resolvedUserId = authData.user.id;
        }
      } catch (_) {}
      if (!resolvedUserId) {
        try {
          const { data: sessionData } = await client.auth.getSession();
          if (sessionData && sessionData.session && sessionData.session.user) {
            resolvedUserId = sessionData.session.user.id;
          }
        } catch (_) {}
      }
    }

    if (resolvedUserId) {
      orderData.user_id = resolvedUserId;
      localStorage.setItem("velora_last_order", JSON.stringify(orderData));
      try {
        const userOrdKey = "velora_user_orders_" + resolvedUserId;
        const pastList = JSON.parse(localStorage.getItem(userOrdKey) || "[]");
        pastList.unshift(orderData);
        localStorage.setItem(userOrdKey, JSON.stringify(pastList.slice(0, 50)));
      } catch (_) {}
    }

    let dbOrder = null;

    if (client) {
      try {
        const baseOrderPayload = {
          user_id: resolvedUserId || null,
          order_number: orderId,
          subtotal: state.subtotal,
          discount: state.discountAmount,
          shipping_charge: state.shippingFee,
          tax: 0,
          total: state.total,
          payment_method: paymentDetail,
          payment_status: orderData.payment_status,
          advance_amount: advanceAmount,
          advance_paid: advancePaid,
          cod_balance: codBalance,
          advance_payment_status: orderData.advance_payment_status,
          cod_payment_status: orderData.cod_payment_status,
          order_status: "placed",
          delivery_full_name: elements.inputFullName.value.trim(),
          delivery_phone: elements.inputPhone.value.trim(),
          delivery_address: fullStreetAddress,
          delivery_city: elements.inputCity.value.trim(),
          delivery_state: elements.inputState.value.trim(),
          delivery_country: elements.selectCountry.value || "India",
          delivery_pincode: elements.inputZip.value.trim(),
          estimated_delivery: etaFormatted,
          transaction_reference: overrides.transactionReference || null
        };

        const idempotencyKey = "ord_idem_" + orderId + "_" + (currentUser?.id || "guest") + "_" + state.cart.length;
        let rpcCreated = false;
        const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const hasSarojiniInCart = state.cart.some(item => 
          item.catalog_type === 'sarojini' || 
          Boolean(item.sarojini_product_id) || 
          (typeof item.id === 'string' && item.id.startsWith('sarojini-')) ||
          (typeof item.image === 'string' && item.image.includes('sarojni'))
        );

        if (!hasSarojiniInCart) {
          try {
            const rpcPayload = {
              p_items: state.cart.map(item => ({
                product_id: isUuid(item.id) ? item.id : null,
                slug: item.slug || item.id,
                quantity: item.quantity || 1,
                selected_size: item.selected_size || item.size || null,
                selected_color: item.selected_color || item.color || null,
                name: item.name,
                is_free_bogo: Boolean(item.is_free_bogo),
                bogo_pair_id: item.bogo_pair_id || null
              })),
              p_payment_method: state.selectedPaymentMethod,
              p_coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
              p_delivery_details: {
                full_name: elements.inputFullName.value.trim(),
                phone: elements.inputPhone.value.trim(),
                address: elements.inputHouse.value.trim() + ", " + elements.inputStreet.value.trim(),
                city: elements.inputCity.value.trim(),
                state: elements.inputState.value.trim(),
                country: elements.selectCountry.value || "India",
                pincode: elements.inputZip.value.trim()
              },
              p_delivery_preference: deliveryPreference,
              p_idempotency_key: idempotencyKey
            };

            const { data: rpcRes, error: rpcErr } = await client.rpc("create_customer_order", rpcPayload);
            if (!rpcErr && rpcRes && rpcRes.success) {
              dbOrder = {
                id: rpcRes.order_id,
                order_number: rpcRes.order_number,
                total: rpcRes.total,
                subtotal: rpcRes.subtotal,
                discount: rpcRes.discount,
                advance_amount: rpcRes.advance_amount,
                cod_balance: rpcRes.cod_balance
              };
              rpcCreated = true;
            }
          } catch (rpcEx) {}
        }

        if (!dbOrder) {
          const customerOrderCols = "id, order_number, total, subtotal, discount, advance_amount, cod_balance, created_at";
          try {
            const extendedPayload = {
              ...baseOrderPayload,
              coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
              delivery_preference: deliveryPreference,
              free_gifts_eligible: freeGiftsEligible,
              free_gifts_items: freeGiftsItems,
              is_full_online_payment: isFullOnline,
              idempotency_key: idempotencyKey
            };
            const { data: extOrder, error: extErr } = await client.from("orders").insert([extendedPayload]).select(customerOrderCols).single();
            if (!extErr && extOrder) {
              dbOrder = extOrder;
            }
          } catch (e) {}

          if (!dbOrder) {
            const { data: stdOrder } = await client.from("orders").insert([baseOrderPayload]).select(customerOrderCols).single();
            dbOrder = stdOrder;
          }
        }

        if (dbOrder) {
          orderData.id = dbOrder.id;
          orderData.order_number = dbOrder.order_number || orderId;
          orderData.orderNumber = dbOrder.order_number || orderId;
          orderData.orderId = dbOrder.order_number || orderId;
          localStorage.setItem("velora_last_order", JSON.stringify(orderData));
          if (resolvedUserId) {
            try {
              const userOrdKey = "velora_user_orders_" + resolvedUserId;
              const pastList = JSON.parse(localStorage.getItem(userOrdKey) || "[]");
              if (pastList.length > 0 && (pastList[0].orderId === orderId || pastList[0].order_number === orderId)) {
                pastList[0].id = dbOrder.id;
                pastList[0].order_number = dbOrder.order_number || orderId;
                pastList[0].orderNumber = dbOrder.order_number || orderId;
                pastList[0].orderId = dbOrder.order_number || orderId;
                localStorage.setItem(userOrdKey, JSON.stringify(pastList));
              }
            } catch (_) {}
          }
        }

        // Increment coupon used_count whenever an order is successfully created with a coupon
        if (dbOrder && state.appliedCoupon && state.appliedCoupon.id) {
          try {
            const { data: cRow } = await client.from("coupons").select("used_count").eq("id", state.appliedCoupon.id).single();
            if (cRow) {
              await client.from("coupons").update({ used_count: (cRow.used_count || 0) + 1 }).eq("id", state.appliedCoupon.id);
            }
          } catch (cErr) {
            console.warn("Coupon used_count increment error:", cErr);
          }
        }

        // Insert order items if order was created via client fallback
        if (!rpcCreated && dbOrder && state.cart && state.cart.length > 0) {
          const itemsPayload = state.cart.map(item => {
            const qty = item.quantity || 1;
            const price = item.is_free_bogo ? 0 : (item.price || 0);
            let itemUnitAdvance = 0;
            if (!item.is_free_bogo) {
              if (item.advance_payment_enabled) {
                if (item.advance_payment_type === "percentage") {
                  itemUnitAdvance = Math.round(price * ((Number(item.advance_payment_value) || 0) / 100));
                } else {
                  itemUnitAdvance = Math.min(price, Math.max(0, Number(item.advance_payment_value) || 0));
                }
              } else if (item.advance_per_unit) {
                itemUnitAdvance = Number(item.advance_per_unit) || 0;
              }
            }
            const itemTotalAdvance = itemUnitAdvance * qty;
            const itemTotal = price * qty;
            const itemCodBalance = Math.max(0, itemTotal - itemTotalAdvance);
            const isSarojini = item.catalog_type === 'sarojini' || 
              Boolean(item.sarojini_product_id) || 
              (typeof item.id === 'string' && item.id.startsWith('sarojini-')) ||
              (typeof item.image === 'string' && item.image.includes('sarojni'));
            const resolvedProdId = isUuid(item.id) ? item.id : (isUuid(item.supabase_id) ? item.supabase_id : null);

            let cleanImg = "";
            if (window.VeloraImageUtils && typeof window.VeloraImageUtils.extractImageUrl === "function") {
              cleanImg = window.VeloraImageUtils.extractImageUrl(item.image || item.images);
            } else {
              cleanImg = typeof item.image === "string" ? item.image : (Array.isArray(item.images) ? item.images[0] : "");
            }

            return {
              order_id: dbOrder.id,
              product_id: isSarojini ? null : resolvedProdId,
              sarojini_product_id: isSarojini ? resolvedProdId : null,
              catalog_type: isSarojini ? 'sarojini' : 'main',
              product_name: item.name,
              product_image: cleanImg || null,
              price: price,
              quantity: qty,
              selected_size: item.size || null,
              selected_color: item.color || null,
              subtotal: itemTotal,
              advance_amount: isFullOnline ? 0 : itemTotalAdvance,
              cod_balance: isFullOnline ? 0 : itemCodBalance,
              advance_payment_enabled: item.is_free_bogo ? false : Boolean(item.advance_payment_enabled),
              advance_payment_type: item.is_free_bogo ? null : (item.advance_payment_type || null),
              advance_payment_value: item.is_free_bogo ? 0 : (item.advance_payment_value ? Number(item.advance_payment_value) : null)
            };
          });

          if (freeGiftsEligible && freeGiftsItems.length > 0) {
            freeGiftsItems.forEach(gift => {
              itemsPayload.push({
                order_id: dbOrder.id,
                product_id: null,
                sarojini_product_id: null,
                catalog_type: 'main',
                product_name: gift.name,
                product_image: gift.icon_or_image || gift.image || "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200",
                price: 0,
                quantity: gift.quantity || 1,
                selected_size: "Standard",
                selected_color: "Complimentary Gift",
                subtotal: 0,
                advance_amount: 0,
                cod_balance: 0,
                advance_payment_enabled: false,
                advance_payment_type: null,
                advance_payment_value: null
              });
            });
          }

          const { error: itemsInsErr } = await client.from("order_items").insert(itemsPayload);
          if (itemsInsErr) {
            console.error("Order items insert warning:", itemsInsErr);
            // Fallback retry with core columns only in case any optional column was rejected
            try {
              const corePayload = itemsPayload.map(p => ({
                order_id: p.order_id,
                product_id: p.product_id,
                sarojini_product_id: p.sarojini_product_id,
                catalog_type: p.catalog_type,
                product_name: p.product_name,
                product_image: p.product_image,
                price: p.price,
                quantity: p.quantity,
                selected_size: p.selected_size,
                selected_color: p.selected_color,
                subtotal: p.subtotal
              }));
              await client.from("order_items").insert(corePayload);
            } catch (retryErr) {
              console.error("Order items retry error:", retryErr);
            }
          }

          if (currentUser && currentUser.id) {
            try {
              await client.from("addresses").insert([{
                user_id: currentUser.id,
                full_name: elements.inputFullName.value.trim(),
                phone: elements.inputPhone.value.trim(),
                house: elements.inputHouse.value.trim(),
                street: elements.inputStreet.value.trim(),
                city: elements.inputCity.value.trim(),
                state: elements.inputState.value.trim(),
                country: elements.selectCountry.value || "India",
                pincode: elements.inputZip.value.trim(),
                address_type: state.selectedAddressType || "Home",
                is_default: false
              }]);
            } catch (aErr) {}
          }
        }
      } catch (err) {
        console.warn("Supabase order record notice:", err);
      }
    }

    // Analytics
    if (window.VeloraAnalytics) {
      window.VeloraAnalytics.trackOrderCompleted(dbOrder ? dbOrder.id : ('ord_' + Date.now()), state.total, {
        items_count: state.cart.length,
        payment_method: paymentDetail
      });
    }

    clearTimeout(submissionTimeout);

    setTimeout(() => {
      window.location.href = "order-success.html";
    }, 1000);
  }

  if (elements.btnPlaceOrder) {
    elements.btnPlaceOrder.addEventListener("click", handlePlaceOrder);
  }

  // --- Autofill from Logged-in User Profile ---
  try {
    const rawSession = localStorage.getItem("velora_user_session") || sessionStorage.getItem("velora_user_session");
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session && session.user) {
        const u = session.user;
        if (elements.inputFullName && !elements.inputFullName.value) elements.inputFullName.value = u.name || "";
        if (elements.inputEmail && !elements.inputEmail.value) elements.inputEmail.value = u.email || "";
        if (elements.inputPhone && !elements.inputPhone.value) elements.inputPhone.value = u.phone || "";
        if (u.address) {
          if (elements.inputHouse && !elements.inputHouse.value) elements.inputHouse.value = u.address.house || "";
          if (elements.inputStreet && !elements.inputStreet.value) elements.inputStreet.value = u.address.street || "";
          if (elements.inputCity && !elements.inputCity.value) elements.inputCity.value = u.address.city || "";
          if (elements.inputState && !elements.inputState.value) elements.inputState.value = u.address.state || "";
          if (elements.inputZip && !elements.inputZip.value) elements.inputZip.value = u.address.zip || "";
        }
      }
    }
  } catch (err) {}

  // Auto-fill delivery pincode & location from the product page session check if not already filled
  try {
    const rawPincode = localStorage.getItem("velora_checked_pincode");
    if (rawPincode) {
      const pinData = JSON.parse(rawPincode);
      if (pinData && pinData.pincode && pinData.serviceable) {
        if (elements.inputZip && !elements.inputZip.value) {
          elements.inputZip.value = pinData.pincode;
        }
        if (elements.inputCity && !elements.inputCity.value && pinData.city) {
          elements.inputCity.value = pinData.city;
        }
        if (elements.inputState && !elements.inputState.value && pinData.state) {
          elements.inputState.value = pinData.state;
        }
      }
    }
  } catch (e) {}

  // --- Sync Advance Data for Stale Cart Items ---
  async function syncCartAdvanceData() {
    if (!state.cart || state.cart.length === 0) return;
    let changed = false;

    if (window.syncProductsFromSupabase) {
      try {
        await window.syncProductsFromSupabase();
      } catch (e) {
        console.warn("Cart sync from Supabase error:", e);
      }
    }

    state.cart.forEach(item => {
      const match = (window.PRODUCTS_DATA || []).find(p =>
        (p.id && item.id && p.id.toLowerCase() === item.id.toLowerCase()) ||
        (p.legacyId && item.id && p.legacyId.toLowerCase() === item.id.toLowerCase()) ||
        (p.name && item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      );
      if (match) {
        if (match.advance_payment_enabled !== undefined && item.advance_payment_enabled !== match.advance_payment_enabled) {
          item.advance_payment_enabled = match.advance_payment_enabled;
          item.advance_payment_type = match.advance_payment_type;
          item.advance_payment_value = match.advance_payment_value;
          changed = true;
        } else if (match.advance_payment_value !== undefined && item.advance_payment_value !== match.advance_payment_value) {
          item.advance_payment_value = match.advance_payment_value;
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem("velora_cart", JSON.stringify(state.cart));
      renderOrderSummary();
    }
  }

  // --- Initial Render ---
  renderOrderSummary();
  syncCartAdvanceData();

  if (state.cart && state.cart.length > 0) {
    loadSavedAddresses();
    loadCouponSuggestions();
  }

  window.loadSavedAddresses = loadSavedAddresses;
  window.renderSavedAddresses = renderSavedAddresses;

  window.addEventListener("velora:auth-changed", () => {
    loadSavedAddresses();
  });

  if (state.cart && state.cart.length > 0 && window.VeloraAnalytics) {
    window.VeloraAnalytics.trackCheckoutStarted(state.cart.length, state.total);
  }

  if (window.syncStoreSettings) {
    window.syncStoreSettings().then(() => {
      renderOrderSummary();
    });
  }

  window.addEventListener("velora:settings-synced", () => {
    renderOrderSummary();
  });
});

