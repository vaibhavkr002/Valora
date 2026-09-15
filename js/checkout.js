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
    isFullOnlinePayment: (storedPrefPay === "online")
  };

  // Supported discount codes
  const COUPONS = {
    "VELORA10": 10,
    "VELORA15": 15,
    "WELCOME15": 15
  };

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
    inputCity: document.getElementById("input-city"),
    inputState: document.getElementById("input-state"),
    inputZip: document.getElementById("input-zip"),
    selectCountry: document.getElementById("select-country"),
    addressPills: document.querySelectorAll(".address-type-pill"),

    // Payment Cards
    paymentCards: document.querySelectorAll(".payment-method-card"),
    inputCardNum: document.getElementById("input-card-num"),
    inputCardExp: document.getElementById("input-card-exp"),
    inputCardCvv: document.getElementById("input-card-cvv"),
    inputCardName: document.getElementById("input-card-name"),
    inputUpiId: document.getElementById("input-upi-id"),
    bankChips: document.querySelectorAll(".bank-chip"),

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

    // Discount calculation
    if (state.appliedCoupon) {
      let disc = 0;
      if (state.appliedCoupon.type === "fixed") {
        disc = Math.min(subtotal, state.appliedCoupon.value);
      } else {
        disc = (subtotal * ((state.appliedCoupon.discountPercent || state.appliedCoupon.value) / 100));
        if (state.appliedCoupon.maxDiscount && disc > state.appliedCoupon.maxDiscount) {
          disc = state.appliedCoupon.maxDiscount;
        }
      }
      state.discountAmount = Math.round(disc);
      elements.rowDiscount.classList.add("active");
      elements.costDiscount.textContent = `-${formatPrice(state.discountAmount)}`;
    } else {
      state.discountAmount = 0;
      elements.rowDiscount.classList.remove("active");
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
      // For COD, delivery preference resets to Simple Delivery
      state.selectedDeliveryPreference = "Simple Delivery";
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

    // Update Delivery Preference Card in UI
    if (elements.cardDeliveryPreference) {
      if (isFullOnline) {
        elements.cardDeliveryPreference.style.display = "block";
        if (elements.badgePrefLock) {
          elements.badgePrefLock.textContent = "Unlocked";
          elements.badgePrefLock.style.background = "rgba(16, 185, 129, 0.15)";
          elements.badgePrefLock.style.color = "#059669";
          elements.badgePrefLock.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
      } else {
        elements.cardDeliveryPreference.style.display = "none";
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
      if (isFullOnline) {
        elements.rowDeliveryPreference.style.display = "flex";
        if (elements.costDeliveryPreference) {
          elements.costDeliveryPreference.textContent = state.selectedDeliveryPreference || "Simple Delivery";
          elements.costDeliveryPreference.style.color = (state.selectedDeliveryPreference === "Open Box Delivery") ? "#0284c7" : "var(--text-main)";
        }
      } else {
        elements.rowDeliveryPreference.style.display = "none";
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
        elements.btnPlaceOrderText.textContent = isFullOnline
          ? `Complete Order • ${formatPrice(state.total)}`
          : `Complete COD Order • ${formatPrice(state.total)} on Delivery`;
      }
    }
  }

  // --- 5. Coupon Handling ---
  async function applyCoupon(rawCode) {
    if (!rawCode) {
      showToast("Please enter a promotional code.", "error");
      return;
    }
    const code = rawCode.trim().toUpperCase();

    // Query Supabase coupons table
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    let dbCoupon = null;

    if (client) {
      try {
        // 1. Try server-side authoritative RPC first
        const { data: rpcCoupon, error: rpcErr } = await client.rpc("validate_coupon", {
          p_code: code,
          p_cart_subtotal: state.subtotal
        });

        if (!rpcErr && rpcCoupon && rpcCoupon.valid) {
          dbCoupon = {
            id: rpcCoupon.id,
            code: rpcCoupon.code,
            discount_type: rpcCoupon.discount_type,
            discount_value: Number(rpcCoupon.discount_value),
            min_order_amount: Number(rpcCoupon.min_order_amount || 0),
            max_discount: rpcCoupon.max_discount ? Number(rpcCoupon.max_discount) : null
          };
        } else if (!rpcErr && rpcCoupon && !rpcCoupon.valid) {
          showToast(rpcCoupon.message || `Invalid coupon code "${rawCode}".`, "error");
          return;
        } else {
          // 2. Direct allowlisted column fallback (never select * or expose usage counts)
          const couponCols = "id, code, discount_type, discount_value, min_order_amount, max_discount, expiry_date";
          const { data, error } = await client
            .from("coupons")
            .select(couponCols)
            .eq("code", code)
            .eq("is_active", true)
            .maybeSingle();

          if (!error && data) {
            dbCoupon = data;
          }
        }
      } catch (err) {
        console.warn("Coupon lookup notice:", err);
      }
    }

    // Fallback to local default coupons if client couldn't connect
    if (!dbCoupon && COUPONS[code]) {
      dbCoupon = {
        code: code,
        discount_type: "percentage",
        discount_value: COUPONS[code],
        min_order_amount: 0,
        max_discount: null,
        usage_limit: 1000,
        used_count: 0
      };
    }

    if (!dbCoupon) {
      showToast(`Invalid coupon code "${rawCode}". Try VELORA10, VELORA15, or FESTIVE500.`, "error");
      return;
    }

    // Validate minimum order amount
    if (dbCoupon.min_order_amount && state.subtotal < Number(dbCoupon.min_order_amount)) {
      showToast(`Coupon "${code}" requires a minimum cart value of ${formatPrice(dbCoupon.min_order_amount)}.`, "error");
      return;
    }

    // Validate expiry date
    if (dbCoupon.expiry_date && new Date(dbCoupon.expiry_date) < new Date()) {
      showToast(`Coupon "${code}" has expired.`, "error");
      return;
    }

    // Validate usage limit
    if (dbCoupon.usage_limit && (dbCoupon.used_count || 0) >= dbCoupon.usage_limit) {
      showToast(`Coupon "${code}" has reached its maximum usage limit.`, "error");
      return;
    }

    state.appliedCoupon = {
      id: dbCoupon.id,
      code: dbCoupon.code,
      type: dbCoupon.discount_type,
      value: Number(dbCoupon.discount_value),
      discountPercent: dbCoupon.discount_type === "percentage" ? Number(dbCoupon.discount_value) : null,
      maxDiscount: dbCoupon.max_discount ? Number(dbCoupon.max_discount) : null,
      minOrderAmount: Number(dbCoupon.min_order_amount) || 0
    };

    elements.appliedCouponName.textContent = code;
    elements.appliedCouponPercent.textContent = dbCoupon.discount_type === "percentage"
      ? `${dbCoupon.discount_value}%`
      : formatPrice(dbCoupon.discount_value);
    elements.appliedCouponPill.style.display = "flex";
    elements.couponInput.value = "";

    const savingsText = dbCoupon.discount_type === "percentage" ? `${dbCoupon.discount_value}% off` : `${formatPrice(dbCoupon.discount_value)} discount`;
    showToast(`Promo code "${code}" applied! You unlocked ${savingsText}.`, "success");
    renderOrderSummary();
  }

  function removeCoupon() {
    state.appliedCoupon = null;
    elements.appliedCouponPill.style.display = "none";
    showToast("Promotional code removed.", "info");
    renderOrderSummary();
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
  elements.addressPills.forEach(pill => {
    pill.addEventListener("click", () => {
      elements.addressPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.selectedAddressType = pill.dataset.type || "Home";
    });
  });

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

  // Remove error state on input
  [
    elements.inputFullName,
    elements.inputPhone,
    elements.inputEmail,
    elements.inputHouse,
    elements.inputStreet,
    elements.inputCity,
    elements.inputState,
    elements.inputZip,
    elements.inputCardNum,
    elements.inputCardExp,
    elements.inputCardCvv,
    elements.inputCardName,
    elements.inputUpiId
  ].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        const group = input.closest(".form-group");
        if (group) group.classList.remove("has-error");
      });
    }
  });

  function validateCheckoutForm() {
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

    // State
    const stateValid = Boolean(elements.inputState.value && elements.inputState.value.trim().length >= 2);
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
    } else if (state.selectedPaymentMethod === "UPI / QR Payment") {
      const upiVal = elements.inputUpiId.value.trim();
      const upiValid = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiVal);
      if (!validateField(elements.inputUpiId, upiValid)) {
        isValid = false;
        if (!firstInvalidElement) firstInvalidElement = elements.inputUpiId;
      }
    }

    if (!isValid && firstInvalidElement) {
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

    // Payment validation for online methods
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
        showToast("Advance payment authorization declined by card issuer. Order was not confirmed.", "error");
        return;
      }
    } else if (state.selectedPaymentMethod === "UPI / QR Payment") {
      const upiVal = (elements.inputUpiId ? elements.inputUpiId.value : "").trim();
      if (!upiVal || !upiVal.includes("@") || upiVal.length < 5) {
        showToast("Please provide a valid Virtual Payment Address (e.g. yourname@upi).", "error");
        const upiEl = document.querySelector('[data-method="UPI / QR Payment"]');
        if (upiEl) upiEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (upiVal.toLowerCase().startsWith("fail")) {
        showToast("UPI payment failed: Transaction cancelled or declined. Order was not confirmed.", "error");
        return;
      }
    }

    const isValid = validateCheckoutForm();
    if (!isValid) return;

    // Acquire submission lock
    isSubmittingOrder = true;
    const originalBtnText = elements.btnPlaceOrderText.textContent;

    // Safety timeout to prevent permanent button lock on network stall
    const submissionTimeout = setTimeout(() => {
      if (isSubmittingOrder) {
        isSubmittingOrder = false;
        elements.btnPlaceOrder.classList.remove("loading");
        elements.btnPlaceOrder.disabled = false;
        elements.btnPlaceOrderText.textContent = originalBtnText;
        showToast("Network request timed out. Please check your connection and try again.", "error");
      }
    }, 10000);

    // Trigger button loading state
    elements.btnPlaceOrder.classList.add("loading");
    elements.btnPlaceOrder.disabled = true;
    elements.btnPlaceOrderText.textContent = state.advanceRequired
      ? `Processing Advance Payment (${formatPrice(state.advancePayableNow)})...`
      : "Securing & Processing Order...";

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
        // Enforce 100% Free for qualifying BOGO item
        item.price = 0;
        item.advance_payment_enabled = false;
        item.advance_payment_value = 0;
        item.advance_per_unit = 0;
        item.cod_per_unit = 0;
      } else {
        const canonical = (window.PRODUCTS_DATA || []).find(p => p.id === item.id || p.slug === item.id || p.legacyId === item.id);
        if (canonical && typeof canonical.price === "number") {
          item.price = canonical.price; // Lock to authoritative catalog price
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

    // Calculate dynamic delivery date: 3-5 business days ahead
    const now = new Date();
    const deliveryDateStart = new Date(now);
    deliveryDateStart.setDate(now.getDate() + 3);
    const deliveryDateEnd = new Date(now);
    deliveryDateEnd.setDate(now.getDate() + 5);

    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateFormatted = now.toLocaleDateString('en-IN', { ...dateOptions, hour: '2-digit', minute: '2-digit' });
    const etaFormatted = `${deliveryDateStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${deliveryDateEnd.toLocaleDateString('en-IN', dateOptions)}`;

    // Generate random Order ID
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `#VEL-${randomNum}`;

    // Evaluate Full Online Payment Eligibility
    const isOnlineMethod = (state.selectedPaymentMethod === "Credit / Debit Card" || state.selectedPaymentMethod === "UPI / QR Payment" || state.selectedPaymentMethod === "Net Banking");
    const isFullOnline = isOnlineMethod && !state.advanceRequired;
    const deliveryPreference = isFullOnline ? (state.selectedDeliveryPreference || "Simple Delivery") : "Simple Delivery";
    const hasCartGifts = Boolean(state.cartGiftsEligible && state.resolvedCartGifts && state.resolvedCartGifts.length > 0);
    const freeGiftsEligible = isFullOnline && hasCartGifts;
    const freeGiftsItems = freeGiftsEligible ? state.resolvedCartGifts : [];

    // Format payment detail label
    let paymentDetail = state.selectedPaymentMethod;
    if (state.selectedPaymentMethod === "Credit / Debit Card") {
      const lastFour = elements.inputCardNum.value.slice(-4) || "4242";
      paymentDetail = `Card (Ending in ••${lastFour})`;
    } else if (state.selectedPaymentMethod === "UPI / QR Payment") {
      paymentDetail = `UPI (${elements.inputUpiId.value.trim()})`;
    } else if (state.selectedPaymentMethod === "Net Banking") {
      paymentDetail = `Net Banking (${state.selectedBank})`;
    }

    if (state.advanceRequired) {
      paymentDetail += ` • Advance Paid (${formatPrice(state.advancePayableNow)}) + COD Balance (${formatPrice(state.remainingCodAmount)})`;
    } else if (isFullOnline) {
      if (freeGiftsEligible && freeGiftsItems.length > 0) {
        paymentDetail += ` • Full Online Paid [${freeGiftsItems.length} Free Gifts Included] [Delivery: ${deliveryPreference}]`;
      } else {
        paymentDetail += ` • Full Online Paid [Delivery: ${deliveryPreference}]`;
      }
    }

    const advanceAmount = state.advanceRequired ? state.advancePayableNow : 0;
    const advancePaid = state.advanceRequired ? state.advancePayableNow : 0;
    const codBalance = state.advanceRequired
      ? state.remainingCodAmount
      : (state.selectedPaymentMethod === "Cash on Delivery" ? state.total : 0);

    const orderData = {
      orderId: orderId,
      orderDate: dateFormatted,
      estimatedDelivery: etaFormatted,
      customer: {
        fullName: elements.inputFullName.value.trim(),
        phone: elements.inputPhone.value.trim(),
        email: elements.inputEmail.value.trim(),
        house: elements.inputHouse.value.trim(),
        street: elements.inputStreet.value.trim(),
        city: elements.inputCity.value.trim(),
        state: elements.inputState.value.trim(),
        zip: elements.inputZip.value.trim(),
        country: elements.selectCountry.value,
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
      advance_payment_status: state.advanceRequired ? "paid" : "not_required",
      cod_payment_status: state.advanceRequired ? (codBalance > 0 ? "pending" : "not_applicable") : (state.selectedPaymentMethod === "Cash on Delivery" ? "pending" : "not_applicable"),
      payment_status: (state.selectedPaymentMethod === "Cash on Delivery" || codBalance > 0) ? "pending" : "paid",
      advance_payment_required: state.advanceRequired
    };

    // Save order snapshot
    localStorage.setItem("velora_last_order", JSON.stringify(orderData));

    // Clear cart from storage
    localStorage.removeItem("velora_cart");

    // Record order in Supabase database if connected
    const client = window.VeloraAuth ? window.VeloraAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    if (client) {
      try {
        let dbOrder = null;
        const baseOrderPayload = {
          user_id: currentUser ? currentUser.id : null,
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
          delivery_address: elements.inputHouse.value.trim() + ", " + elements.inputStreet.value.trim(),
          delivery_city: elements.inputCity.value.trim(),
          delivery_state: elements.inputState.value.trim(),
          delivery_country: elements.selectCountry.value || "India",
          delivery_pincode: elements.inputZip.value.trim(),
          estimated_delivery: etaFormatted
        };

        const idempotencyKey = "ord_idem_" + orderId + "_" + (currentUser?.id || "guest") + "_" + state.cart.length;
        let rpcCreated = false;
        const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        // 1. Attempt server-authoritative order creation via RPC
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
        } catch (rpcEx) {
          // Fallback to client-side insert if RPC is not deployed yet
        }

        // 2. Fallback to client insert if RPC was not used
        if (!dbOrder) {
          const customerOrderCols = "id, order_number, total, subtotal, discount, advance_amount, cod_balance, created_at";
          try {
            const extendedPayload = {
              ...baseOrderPayload,
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
          } catch (e) {
            // Schema cache notice
          }

          if (!dbOrder) {
            const { data: stdOrder } = await client.from("orders").insert([baseOrderPayload]).select(customerOrderCols).single();
            dbOrder = stdOrder;
          }
        }

        // 3. Insert order items if order was created via client fallback
        if (!rpcCreated && dbOrder && state.cart && state.cart.length > 0) {
          const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
            const resolvedProdId = isUuid(item.id) ? item.id : (isUuid(item.supabase_id) ? item.supabase_id : null);

            return {
              order_id: dbOrder.id,
              product_id: resolvedProdId,
              product_name: item.name,
              product_image: item.image,
              price: price,
              quantity: qty,
              selected_size: item.size || null,
              selected_color: item.color || null,
              subtotal: itemTotal,
              advance_amount: isFullOnline ? 0 : itemTotalAdvance,
              cod_balance: isFullOnline ? 0 : itemCodBalance,
              advance_payment_enabled: item.is_free_bogo ? false : Boolean(item.advance_payment_enabled),
              advance_payment_type: item.is_free_bogo ? null : (item.advance_payment_type || null),
              advance_payment_value: item.is_free_bogo ? 0 : (item.advance_payment_value ? Number(item.advance_payment_value) : null),
              is_free_bogo: Boolean(item.is_free_bogo),
              bogo_pair_id: item.bogo_pair_id || null
            };
          });

          // If eligible for full online payment gifts, record the complimentary gifts at ₹0 in order_items
          if (freeGiftsEligible && freeGiftsItems.length > 0) {
            freeGiftsItems.forEach(gift => {
              itemsPayload.push({
                order_id: dbOrder.id,
                product_id: null,
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

          await client.from("order_items").insert(itemsPayload);

          // Update coupon usage count if coupon was used
          if (state.appliedCoupon && state.appliedCoupon.id) {
            try {
              const { data: cRow } = await client.from("coupons").select("used_count").eq("id", state.appliedCoupon.id).single();
              if (cRow) {
                await client.from("coupons").update({ used_count: (cRow.used_count || 0) + 1 }).eq("id", state.appliedCoupon.id);
              }
            } catch (cErr) {
              console.warn("Coupon usage update notice:", cErr);
            }
          }

          // Save customer address into addresses table if authenticated
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
            } catch (aErr) {
              console.warn("Address save notice:", aErr);
            }
          }
        }
      } catch (err) {
        console.warn("Supabase order record notice:", err);
      }
    }

    // First-party Analytics: Track Completed Order
    if (window.VeloraAnalytics) {
      window.VeloraAnalytics.trackOrderCompleted(dbOrder ? dbOrder.id : ('ord_' + Date.now()), state.total, {
        items_count: state.cart.length,
        payment_method: state.selectedPaymentMethod
      });
    }

    // Clear safety timeout upon successful processing
    clearTimeout(submissionTimeout);

    // Realistic processing delay before redirect
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

