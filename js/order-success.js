/**
 * VELORA - Order Confirmation & Receipt Controller
 * Pure Vanilla JavaScript (ES6+)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  // --- 1. State & Data Retrieval ---
  let orderData = null;

  try {
    const raw = localStorage.getItem("velora_last_order");
    if (raw) {
      orderData = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error loading order data:", err);
  }

  if (!orderData) {
    window.location.href = "account.html#orders";
    return;
  }

  // --- 2. DOM Elements ---
  const elements = {
    heroTitle: document.getElementById("receipt-hero-title"),
    orderId: document.getElementById("receipt-order-id"),
    btnCopyOrderId: document.getElementById("btn-copy-order-id"),
    orderDate: document.getElementById("receipt-order-date"),
    deliveryEstimate: document.getElementById("receipt-delivery-estimate"),
    paymentMethod: document.getElementById("receipt-payment-method"),
    itemsCount: document.getElementById("receipt-items-count"),
    itemsList: document.getElementById("receipt-items-list"),
    addressType: document.getElementById("receipt-address-type"),
    customerAddress: document.getElementById("receipt-customer-address"),
    subtotal: document.getElementById("receipt-subtotal"),
    discountRow: document.getElementById("receipt-discount-row"),
    discount: document.getElementById("receipt-discount"),
    shipping: document.getElementById("receipt-shipping"),
    total: document.getElementById("receipt-total"),
    advanceRow: document.getElementById("receipt-advance-row"),
    advancePaid: document.getElementById("receipt-advance-paid"),
    codRow: document.getElementById("receipt-cod-row"),
    codBalance: document.getElementById("receipt-cod-balance"),
    advanceCard: document.getElementById("receipt-advance-card"),
    advanceHighlight: document.getElementById("receipt-advance-highlight"),
    codHighlight: document.getElementById("receipt-cod-highlight"),
    deliveryPreference: document.getElementById("receipt-delivery-preference"),
    giftsRow: document.getElementById("receipt-gifts-row"),
    giftsCard: document.getElementById("receipt-gifts-card"),

    // Buttons
    btnPrintReceipt: document.getElementById("btn-print-receipt"),
    btnTrackPackage: document.getElementById("btn-track-package"),

    // Track Modal
    trackModal: document.getElementById("track-modal"),
    trackingModalOrderId: document.getElementById("tracking-modal-order-id"),
    trackingTimeEta: document.getElementById("tracking-time-eta"),
    btnCloseTrackModal: document.getElementById("btn-close-track-modal"),
    btnOkTrackModal: document.getElementById("btn-ok-track-modal"),

    toastContainer: document.getElementById("toast-container")
  };

  // --- 3. Toast Utility ---
  function showToast(message, type = "info") {
    if (!elements.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content" style="display:flex; align-items:center; gap:10px;">
        <span class="toast-message" style="font-size:0.9rem; font-weight:600;">${message}</span>
      </div>
    `;
    elements.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- 4. Render Receipt Data ---
  function renderOrderReceipt() {
    const firstName = orderData.customer.fullName ? orderData.customer.fullName.split(" ")[0] : "Valued Customer";
    if (elements.heroTitle) {
      elements.heroTitle.textContent = `Thank You, ${firstName}!`;
    }

    if (elements.orderId) elements.orderId.textContent = orderData.orderId;
    if (elements.orderDate) elements.orderDate.textContent = orderData.orderDate;
    if (elements.deliveryEstimate) elements.deliveryEstimate.textContent = orderData.estimatedDelivery;
    if (elements.paymentMethod) elements.paymentMethod.textContent = orderData.paymentMethod;

    if (elements.addressType) elements.addressType.textContent = orderData.customer.addressType || "Home";

    // Customer Address Block
    if (elements.customerAddress) {
      const c = orderData.customer;
      elements.customerAddress.innerHTML = `
        <div style="font-weight:700; color:var(--text-main); font-size:1rem; margin-bottom:4px;">${c.fullName}</div>
        <div>${c.house}, ${c.street}</div>
        <div>${c.city}, ${c.state} - ${c.zip}, ${c.country}</div>
        <div class="phone-email">
          <span>📞 ${c.phone}</span> • <span>✉️ ${c.email}</span>
        </div>
      `;
    }

    // Items List
    if (elements.itemsList && orderData.items) {
      let totalQty = 0;
      elements.itemsList.innerHTML = orderData.items.map(item => {
        const qty = item.quantity || 1;
        totalQty += qty;
        const lineTotal = formatPrice((item.price || 0) * qty);
        const sizeTag = item.size ? `<span>Size: <strong>${item.size}</strong></span>` : "";
        const colorTag = item.color ? `<span>Color: <strong>${item.color}</strong></span>` : "";

        let advanceBadge = "";
        if (item.advance_payment_enabled || item.advance_amount || item.advance_per_unit) {
          let itemAdv = item.advance_amount || (Number(item.advance_per_unit) * qty) || 0;
          if (!itemAdv && item.advance_payment_type === "percentage") {
            itemAdv = Math.round((item.price || 0) * (Number(item.advance_payment_value || 0) / 100)) * qty;
          } else if (!itemAdv && item.advance_payment_value) {
            itemAdv = Math.min(item.price || 0, Number(item.advance_payment_value)) * qty;
          }
          if (itemAdv > 0) {
            advanceBadge = ` • <span style="color: #6366f1; font-weight: 600;">⚡ Advance: ${formatPrice(itemAdv)}</span>`;
          }
        }

        const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200';
        const displayImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
          ? window.VeloraImageUtils.normalizeImageUrl(item.image, { isAdmin: false, fallback: fallbackSvg })
          : (item.image || fallbackSvg);

        return `
          <div class="receipt-item-row">
            <img src="${displayImg}" alt="${item.name}" class="receipt-item-img" onerror="this.onerror=null; this.src='${fallbackSvg}';">
            <div class="receipt-item-details">
              <div class="receipt-item-name">${item.name}</div>
              <div class="receipt-item-variant">
                ${sizeTag} ${sizeTag && colorTag ? "•" : ""} ${colorTag} ${advanceBadge}
              </div>
              <div class="receipt-item-qty">Qty: ${qty} × ${formatPrice(item.price || 0)}</div>
            </div>
            <div class="receipt-item-total">${lineTotal}</div>
          </div>
        `;
      }).join("");

      if (elements.itemsCount) elements.itemsCount.textContent = totalQty;
    }

    // Cost Breakdown
    if (elements.subtotal) elements.subtotal.textContent = formatPrice(orderData.subtotal || 0);

    if (elements.discountRow && elements.discount) {
      if (orderData.discount && orderData.discount > 0) {
        elements.discountRow.classList.add("active");
        elements.discount.textContent = `-${formatPrice(orderData.discount)}`;
      } else {
        elements.discountRow.classList.remove("active");
      }
    }

    if (elements.shipping) {
      elements.shipping.textContent = (!orderData.shipping || orderData.shipping === 0) ? "FREE (₹0)" : formatPrice(orderData.shipping);
      elements.shipping.style.color = "var(--color-success)";
      elements.shipping.style.fontWeight = "700";
    }

    if (elements.total) elements.total.textContent = formatPrice(orderData.total || 0);

    // Delivery Preference Rendering
    const deliveryPref = orderData.delivery_preference || "Simple Delivery";
    if (elements.deliveryPreference) {
      elements.deliveryPreference.textContent = deliveryPref;
      if (deliveryPref === "Open Box Delivery") {
        elements.deliveryPreference.style.color = "#0284c7";
      }
    }

    // Full Online Payment Free Gifts Rendering
    const giftsList = Array.isArray(orderData.free_gifts_items) ? orderData.free_gifts_items : [];
    const hasGifts = Boolean(orderData.free_gifts_eligible && giftsList.length > 0);

    if (hasGifts) {
      if (elements.giftsRow) {
        elements.giftsRow.style.display = "flex";
        const label = elements.giftsRow.querySelector("span:first-child");
        if (label) label.textContent = `${giftsList.length} Complimentary Gifts (${giftsList.map(g => g.name).join(", ")})`;
      }
      if (elements.giftsCard) {
        elements.giftsCard.style.display = "block";
        const titleEl = document.getElementById("receipt-gifts-title");
        const descEl = document.getElementById("receipt-gifts-desc");
        if (titleEl) titleEl.textContent = `${giftsList.length} Complimentary Gifts Included`;
        if (descEl) {
          descEl.innerHTML = `Thank you for completing 100% full online payment! Your parcel includes <strong>${giftsList.map(g => g.name).join("</strong>, <strong>")}</strong>.`;
        }
      }
    } else {
      if (elements.giftsRow) elements.giftsRow.style.display = "none";
      if (elements.giftsCard) elements.giftsCard.style.display = "none";
    }

    // Advance Payment & COD Balance Rendering
    const advancePaidVal = Number(orderData.advance_paid || orderData.advance_amount || 0);
    const codBalanceVal = Number(orderData.cod_balance || 0);

    if (advancePaidVal > 0) {
      if (elements.advanceRow && elements.advancePaid) {
        elements.advanceRow.style.display = "flex";
        elements.advancePaid.textContent = formatPrice(advancePaidVal);
      }
      if (elements.codRow && elements.codBalance) {
        elements.codRow.style.display = "flex";
        elements.codBalance.textContent = formatPrice(codBalanceVal);
      }
      if (elements.advanceCard) {
        elements.advanceCard.style.display = "block";
        if (elements.advanceHighlight) elements.advanceHighlight.textContent = formatPrice(advancePaidVal);
        if (elements.codHighlight) elements.codHighlight.textContent = formatPrice(codBalanceVal);
      }
    } else {
      if (elements.advanceRow) elements.advanceRow.style.display = "none";
      if (elements.codRow) elements.codRow.style.display = "none";
      if (elements.advanceCard) elements.advanceCard.style.display = "none";
    }
  }

  // --- 5. Interactive Actions ---

  // Copy Order ID
  if (elements.btnCopyOrderId) {
    elements.btnCopyOrderId.addEventListener("click", () => {
      navigator.clipboard.writeText(orderData.orderId).then(() => {
        showToast(`Order ID ${orderData.orderId} copied to clipboard!`, "success");
      }).catch(() => {
        showToast(`Order ID: ${orderData.orderId}`, "info");
      });
    });
  }

  // Print Receipt
  if (elements.btnPrintReceipt) {
    elements.btnPrintReceipt.addEventListener("click", () => {
      window.print();
    });
  }

  // Tracking Modal
  function openTrackModal() {
    if (!elements.trackModal) return;
    if (elements.trackingModalOrderId) elements.trackingModalOrderId.textContent = orderData.orderId;
    if (elements.trackingTimeEta) elements.trackingTimeEta.textContent = `Estimated: ${orderData.estimatedDelivery}`;
    elements.trackModal.classList.add("open");
  }

  function closeTrackModal() {
    if (!elements.trackModal) return;
    elements.trackModal.classList.remove("open");
  }

  if (elements.btnTrackPackage) {
    elements.btnTrackPackage.addEventListener("click", openTrackModal);
  }

  if (elements.btnCloseTrackModal) {
    elements.btnCloseTrackModal.addEventListener("click", closeTrackModal);
  }

  if (elements.btnOkTrackModal) {
    elements.btnOkTrackModal.addEventListener("click", closeTrackModal);
  }

  if (elements.trackModal) {
    elements.trackModal.addEventListener("click", (e) => {
      if (e.target === elements.trackModal) closeTrackModal();
    });
  }

  // Initial Run
  renderOrderReceipt();
});

