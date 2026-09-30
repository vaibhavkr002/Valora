const fs = require('fs');

let content = fs.readFileSync('js/checkout.js', 'utf8');

// 1. Merchant settings default
content = content.replace(/vadi\.lifestyle@okhdfcbank/g, 'vadii@ptaxis');
content = content.replace(/VALORA Lifestyle Studio/g, 'VADI');
content = content.replace(/VADII Lifestyle Studio/g, 'VADI');

const startMatch = content.match(/\/\/\s*={10,}\s*\r?\n\s*\/\/\s*RAZORPAY PAYMENT GATEWAY INTEGRATION/);
const endMatch = content.match(/\/\/\s*---\s*8\.\s*Input Validation Helper\s*---/);

if (!startMatch || !endMatch) {
  console.error('Could not find markers with regex:', { startMatch: !!startMatch, endMatch: !!endMatch });
  process.exit(1);
}

const startIdx = startMatch.index;
const endIdx = endMatch.index;

const replacementBlock = `// =========================================================================
  // REAL DIRECT UPI PAYMENT SYSTEM (SERVER-AUTHORITATIVE • NO GATEWAY)
  // =========================================================================
  function getDeliveryPayload() {
    return {
      fullName: elements.inputFullName ? elements.inputFullName.value.trim() : "",
      phone: elements.inputPhone ? elements.inputPhone.value.trim() : "",
      email: elements.inputEmail ? elements.inputEmail.value.trim().toLowerCase() : "",
      house: elements.inputHouse ? elements.inputHouse.value.trim() : "",
      street: elements.inputStreet ? elements.inputStreet.value.trim() : "",
      landmark: elements.inputLandmark ? elements.inputLandmark.value.trim() : "",
      city: elements.inputCity ? elements.inputCity.value.trim() : "",
      state: elements.inputState ? elements.inputState.value.trim() : "",
      zip: elements.inputZip ? elements.inputZip.value.trim() : "",
      country: (elements.selectCountry && elements.selectCountry.value) ? elements.selectCountry.value : "India",
      addressType: state.selectedAddressType || "Home"
    };
  }

  function openUpiModal(orderRes) {
    if (!elements.upiPaymentModal) return;

    state.activeOrderId = orderRes.order_id;
    state.activeOrderNumber = orderRes.order_number;
    state.activeUpiUri = orderRes.upi_uri;
    state.activePayableNow = orderRes.payable_now;
    state.activeOrderSnapshot = orderRes;

    if (elements.modalUpiAmount) {
      elements.modalUpiAmount.textContent = formatPrice(orderRes.payable_now);
    }
    if (elements.modalUpiRef) {
      elements.modalUpiRef.textContent = orderRes.order_number;
    }
    if (elements.modalMerchantVpa) {
      elements.modalMerchantVpa.textContent = orderRes.merchant_upi_id || "vadii@ptaxis";
    }

    // Render Dynamic QR Code in Modal
    if (elements.upiQrContainer && orderRes.upi_uri) {
      renderUpiQrCode(elements.upiQrContainer, orderRes.upi_uri);
    }

    // Configure Mobile Deep Link Buttons
    if (elements.btnLaunchUpiApp) {
      elements.btnLaunchUpiApp.href = orderRes.upi_uri;
      elements.btnLaunchUpiApp.onclick = (e) => {
        // Allow default link navigation for deep link intent
        window.location.href = orderRes.upi_uri;
      };
    }
    if (elements.btnLaunchAnyApp) {
      elements.btnLaunchAnyApp.href = orderRes.upi_uri;
      elements.btnLaunchAnyApp.onclick = (e) => {
        window.location.href = orderRes.upi_uri;
      };
    }

    const utrInput = document.getElementById("input-customer-utr");
    if (utrInput) utrInput.value = "";

    elements.upiPaymentModal.classList.add("active");
    elements.upiPaymentModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeUpiModal() {
    if (!elements.upiPaymentModal) return;
    elements.upiPaymentModal.classList.remove("active");
    elements.upiPaymentModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function submitUpiConfirmation() {
    if (!state.activeOrderId && !state.activeOrderNumber) {
      showToast("No active order pending verification.", "error");
      return;
    }

    const btnConfirm = elements.btnConfirmPayment;
    const originalText = btnConfirm ? btnConfirm.innerHTML : "I HAVE PAID";
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = '<span class="upi-spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:6px;"></span> Submitting for Verification...';
    }

    const utrInput = document.getElementById("input-customer-utr");
    const customerUtr = utrInput ? utrInput.value.trim() : "";

    try {
      const resp = await fetch("/api/orders/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: state.activeOrderId,
          order_number: state.activeOrderNumber,
          customer_utr: customerUtr,
          upi_app: state.selectedUpiApp || "Generic UPI"
        })
      });

      const resData = await resp.json();
      if (!resp.ok || !resData.success) {
        throw new Error(resData.error || "Failed to submit payment confirmation.");
      }

      const deliveryPayload = getDeliveryPayload();
      const fullStreet = [deliveryPayload.house, deliveryPayload.street, deliveryPayload.landmark].filter(Boolean).join(", ");
      const now = new Date();
      const deliveryStart = new Date(now);
      deliveryStart.setDate(now.getDate() + 3);
      const deliveryEnd = new Date(now);
      deliveryEnd.setDate(now.getDate() + 5);
      const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const etaFormatted = \`\${deliveryStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - \${deliveryEnd.toLocaleDateString('en-IN', dateOptions)}\`;

      const snap = state.activeOrderSnapshot || {};
      const isAdvCod = (snap.advance_amount && Number(snap.advance_amount) > 0);

      const orderSnapshot = {
        orderId: snap.order_number || state.activeOrderNumber,
        order_number: snap.order_number || state.activeOrderNumber,
        orderNumber: snap.order_number || state.activeOrderNumber,
        id: snap.order_id || state.activeOrderId,
        orderDate: now.toLocaleDateString('en-IN', { ...dateOptions, hour: '2-digit', minute: '2-digit' }),
        estimatedDelivery: etaFormatted,
        customer: {
          ...deliveryPayload,
          address: fullStreet
        },
        paymentMethod: snap.payment_method || (isAdvCod ? \`Advance + COD (₹\${snap.advance_amount} UPI / ₹\${snap.cod_balance} COD)\` : \`Full UPI Payment (₹\${snap.total})\`),
        items: (snap.summary && Array.isArray(snap.summary.items) && snap.summary.items.length > 0)
          ? snap.summary.items
          : state.cart.map(it => ({
              ...it,
              advance_amount: snap.advance_amount || 0,
              cod_balance: snap.cod_balance || 0
            })),
        free_gifts_eligible: !isAdvCod && Boolean(state.resolvedCartGifts && state.resolvedCartGifts.length > 0),
        free_gifts_items: !isAdvCod ? (state.resolvedCartGifts || []) : [],
        delivery_preference: state.selectedDeliveryPreference || "Simple Delivery",
        is_full_online_payment: !isAdvCod,
        subtotal: snap.summary?.subtotal || state.subtotal,
        discount: snap.summary?.discount || state.discountAmount,
        discountCode: state.appliedCoupon ? state.appliedCoupon.code : null,
        shipping: snap.summary?.shipping || 0,
        total: snap.total || state.total,
        advance_amount: snap.advance_amount || 0,
        advance_paid: 0,
        cod_balance: snap.cod_balance || 0,
        customer_utr: customerUtr,
        advance_payment_status: isAdvCod ? "verification_pending" : "not_required",
        cod_payment_status: (snap.cod_balance > 0) ? "pending" : "not_applicable",
        payment_status: "customer_submitted",
        order_status: "PAYMENT_VERIFICATION_PENDING",
        transaction_reference: snap.transaction_reference || state.activeOrderNumber
      };

      localStorage.setItem("velora_last_order", JSON.stringify(orderSnapshot));
      localStorage.removeItem("velora_cart");

      const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
      const resolvedUserId = currentUser ? currentUser.id : null;

      if (resolvedUserId) {
        try {
          const userOrdKey = "velora_user_orders_" + resolvedUserId;
          const pastList = JSON.parse(localStorage.getItem(userOrdKey) || "[]");
          pastList.unshift(orderSnapshot);
          localStorage.setItem(userOrdKey, JSON.stringify(pastList.slice(0, 50)));
        } catch (_) {}
      } else {
        try {
          const guestList = JSON.parse(localStorage.getItem("velora_guest_orders") || "[]");
          guestList.unshift(orderSnapshot);
          localStorage.setItem("velora_guest_orders", JSON.stringify(guestList.slice(0, 50)));
        } catch (_) {}
      }

      closeUpiModal();
      showToast("Payment confirmation submitted for verification! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = \`order-success.html?order_id=\${orderSnapshot.id}&order_number=\${orderSnapshot.order_number}&status=verification_pending\`;
      }, 700);

    } catch (err) {
      console.error("[UPI Confirm] Error:", err);
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = originalText;
      }
      showToast(err.message || "Failed to submit verification. Please try again.", "error");
    }
  }

  async function startDirectUpiCheckout(paymentType = "full_online") {
    if (isSubmittingOrder) {
      console.warn("Order submission already in progress.");
      return;
    }

    const isValid = validateCheckoutForm();
    if (!isValid) return;

    if (!state.cart || state.cart.length === 0) {
      showToast("Your cart is empty. Please add items before checking out.", "error");
      return;
    }

    isSubmittingOrder = true;
    const originalBtnText = elements.btnPlaceOrderText ? elements.btnPlaceOrderText.textContent : "Complete Order";
    if (elements.btnPlaceOrder) {
      elements.btnPlaceOrder.classList.add("loading");
      elements.btnPlaceOrder.disabled = true;
      if (elements.btnPlaceOrderText) {
        elements.btnPlaceOrderText.textContent = "Opening UPI...";
      }
    }

    const resetBtn = () => {
      isSubmittingOrder = false;
      if (elements.btnPlaceOrder) {
        elements.btnPlaceOrder.classList.remove("loading");
        elements.btnPlaceOrder.disabled = false;
        if (elements.btnPlaceOrderText) elements.btnPlaceOrderText.textContent = originalBtnText;
      }
    };

    try {
      await syncAddressToSupabase();
    } catch (_) {}

    const deliveryPayload = getDeliveryPayload();
    const currentUser = window.VeloraAuth ? window.VeloraAuth.getCurrentUser() : null;
    const resolvedUserId = currentUser ? currentUser.id : null;

    try {
      const resp = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.cart,
          payment_method: paymentType,
          coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
          delivery_details: deliveryPayload,
          delivery_preference: state.selectedDeliveryPreference || "Simple Delivery",
          free_gifts_items: (paymentType === "full_online" && state.resolvedCartGifts) ? state.resolvedCartGifts : [],
          user_id: resolvedUserId,
          existing_order_id: state.activeOrderId || null,
          store_type: (state.cart.some(it => it.catalog_type === 'sarojini' || it.sarojini_product_id)) ? 'sarojini' : 'main'
        })
      });

      const orderRes = await resp.json();
      if (!resp.ok || !orderRes.success) {
        throw new Error(orderRes?.error || "Failed to create order.");
      }

      resetBtn();

      // Cash on Delivery
      if (orderRes.is_cod) {
        const fullStreet = [deliveryPayload.house, deliveryPayload.street, deliveryPayload.landmark].filter(Boolean).join(", ");
        const now = new Date();
        const deliveryStart = new Date(now);
        deliveryStart.setDate(now.getDate() + 3);
        const deliveryEnd = new Date(now);
        deliveryEnd.setDate(now.getDate() + 5);
        const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        const etaFormatted = \`\${deliveryStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - \${deliveryEnd.toLocaleDateString('en-IN', dateOptions)}\`;

        const orderSnapshot = {
          orderId: orderRes.order_number,
          order_number: orderRes.order_number,
          orderNumber: orderRes.order_number,
          id: orderRes.order_id,
          orderDate: now.toLocaleDateString('en-IN', { ...dateOptions, hour: '2-digit', minute: '2-digit' }),
          estimatedDelivery: etaFormatted,
          customer: {
            ...deliveryPayload,
            address: fullStreet
          },
          paymentMethod: "Cash on Delivery",
          items: (orderRes.summary?.items && Array.isArray(orderRes.summary.items) && orderRes.summary.items.length > 0)
            ? orderRes.summary.items
            : state.cart.map(it => ({
                ...it,
                advance_amount: 0,
                cod_balance: (Number(it.price) || 0) * (Number(it.quantity) || 1)
              })),
          free_gifts_eligible: false,
          free_gifts_items: [],
          delivery_preference: state.selectedDeliveryPreference || "Simple Delivery",
          is_full_online_payment: false,
          subtotal: orderRes.summary?.subtotal || state.subtotal,
          discount: orderRes.summary?.discount || state.discountAmount,
          discountCode: state.appliedCoupon ? state.appliedCoupon.code : null,
          shipping: orderRes.summary?.shipping || 0,
          total: orderRes.total,
          advance_amount: 0,
          advance_paid: 0,
          cod_balance: orderRes.total,
          advance_payment_status: "not_required",
          cod_payment_status: "pending",
          payment_status: "COD_PENDING",
          order_status: "placed",
          transaction_reference: orderRes.transaction_reference || orderRes.order_number
        };

        localStorage.setItem("velora_last_order", JSON.stringify(orderSnapshot));
        localStorage.removeItem("velora_cart");

        if (resolvedUserId) {
          try {
            const userOrdKey = "velora_user_orders_" + resolvedUserId;
            const pastList = JSON.parse(localStorage.getItem(userOrdKey) || "[]");
            pastList.unshift(orderSnapshot);
            localStorage.setItem(userOrdKey, JSON.stringify(pastList.slice(0, 50)));
          } catch (_) {}
        } else {
          try {
            const guestList = JSON.parse(localStorage.getItem("velora_guest_orders") || "[]");
            guestList.unshift(orderSnapshot);
            localStorage.setItem("velora_guest_orders", JSON.stringify(guestList.slice(0, 50)));
          } catch (_) {}
        }

        showToast("Order placed successfully via Cash on Delivery!", "success");
        setTimeout(() => {
          window.location.href = \`order-success.html?order_id=\${orderRes.order_id}&order_number=\${orderRes.order_number}\`;
        }, 600);
        return;
      }

      // Online Direct UPI Flow: Open UPI Payment Modal
      openUpiModal(orderRes);

      // On mobile devices, attempt deep link immediately
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
      if (isMobile && orderRes.upi_uri) {
        setTimeout(() => {
          window.location.href = orderRes.upi_uri;
        }, 400);
      }

    } catch (err) {
      console.error("[Direct UPI Checkout] Error:", err);
      resetBtn();
      showToast(err.message || "Failed to create order. Please try again.", "error");
    }
  }

  // Hook UPI Modal Action Buttons
  if (elements.btnConfirmPayment) {
    elements.btnConfirmPayment.onclick = (e) => {
      e.preventDefault();
      submitUpiConfirmation();
    };
  }

  if (elements.btnUpiModalClose) {
    elements.btnUpiModalClose.onclick = (e) => {
      e.preventDefault();
      closeUpiModal();
    };
  }

  if (elements.btnCancelPayment) {
    elements.btnCancelPayment.onclick = (e) => {
      e.preventDefault();
      closeUpiModal();
    };
  }

  async function startUpiPaymentFlow(paymentType = "full_online") {
    return startDirectUpiCheckout(paymentType);
  }
`;

content = content.slice(0, startIdx) + replacementBlock + '\n\n' + content.slice(endIdx);

// Replace remaining startRazorpayCheckout calls
content = content.replace(/startRazorpayCheckout\(/g, 'startDirectUpiCheckout(');

fs.writeFileSync('js/checkout.js', content, 'utf8');
console.log('Successfully updated js/checkout.js with Real Direct UPI system!');
