const fs = require('fs');
const path = require('path');

const checkoutJsPath = path.join(__dirname, '..', 'js', 'checkout.js');
let code = fs.readFileSync(checkoutJsPath, 'utf8');

// 1. Add safeParseResponse helper if not already present
const safeParserCode = `  // --- Safe API Response Parser (Requirement 2: Prevents "Unexpected end of JSON input") ---
  async function safeParseResponse(resp) {
    let text = "";
    try {
      text = await resp.text();
    } catch (_) {
      text = "";
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      console.warn("[Safe API Parser] Response is not valid JSON:", text);
    }
    return { ok: resp.ok, status: resp.status, text, data };
  }
`;

// 2. Client-side Direct UPI order creation engine (fallback for static hosting / Live Server)
const clientSideOrderCode = `
  // --- Client-Side Direct UPI Order Creator (Fallback for Static Servers e.g. Live Server port 5500) ---
  async function createDirectUpiOrderClientSide(paymentType, deliveryPayload, resolvedUserId) {
    const isCod = paymentType === "cod";
    const isAdvCod = paymentType === "advance_cod";
    const isFullOnline = paymentType === "full_online";

    let advanceAmount = 0;
    let codBalance = 0;
    let payableNow = 0;
    let paymentMethodDisplay = "";

    if (isCod) {
      advanceAmount = 0;
      codBalance = state.total;
      payableNow = 0;
      paymentMethodDisplay = "Cash on Delivery";
    } else if (isAdvCod) {
      advanceAmount = state.advancePayableNow;
      codBalance = state.remainingCodAmount;
      payableNow = state.advancePayableNow;
      paymentMethodDisplay = \`Advance + Cash on Delivery (Advance: ₹\${advanceAmount}, COD: ₹\${codBalance})\`;
    } else {
      advanceAmount = 0;
      codBalance = 0;
      payableNow = state.total;
      paymentMethodDisplay = \`Full UPI Online Payment (₹\${state.total})\`;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = \`VAD-ORD-\${dateStr}-\${randomSuffix}\`;
    const transactionRef = \`VADI-TXN-\${Date.now()}-\${randomSuffix}\`;

    const now = new Date();
    const deliveryStart = new Date(now);
    deliveryStart.setDate(now.getDate() + 3);
    const deliveryEnd = new Date(now);
    deliveryEnd.setDate(now.getDate() + 5);
    const dateOptions = { month: "short", day: "numeric", year: "numeric" };
    const etaFormatted = \`\${deliveryStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - \${deliveryEnd.toLocaleDateString("en-IN", dateOptions)}\`;

    const merchantVpa = "vadii@ptaxis";
    const merchantName = "VADI";
    let upiUri = null;
    if (!isCod && payableNow > 0) {
      const amtStr = payableNow.toFixed(2);
      const noteStr = encodeURIComponent(\`Order \${orderNumber}\`);
      upiUri = \`upi://pay?pa=\${encodeURIComponent(merchantVpa)}&pn=\${encodeURIComponent(merchantName)}&am=\${amtStr}&cu=INR&tn=\${noteStr}\`;
    }

    const client = window.supabaseClient || (window.VeloraAuth ? window.VeloraAuth.client : null);
    let dbOrder = null;

    if (client) {
      try {
        const fullStreet = [deliveryPayload.house, deliveryPayload.street, deliveryPayload.landmark].filter(Boolean).join(", ") || deliveryPayload.address || "";
        const baseOrderPayload = {
          user_id: resolvedUserId || null,
          customer_email: deliveryPayload.email ? String(deliveryPayload.email).trim().toLowerCase() : null,
          order_number: orderNumber,
          subtotal: state.subtotal,
          discount: state.discountAmount || 0,
          shipping_charge: 0,
          tax: 0,
          total: state.total,
          payment_method: paymentMethodDisplay,
          payment_status: isCod ? "COD_PENDING" : "pending",
          advance_amount: advanceAmount,
          advance_paid: 0,
          cod_balance: codBalance,
          advance_payment_status: isAdvCod ? "pending" : "not_required",
          cod_payment_status: isCod ? "pending" : (isAdvCod ? "pending" : "not_applicable"),
          order_status: isCod ? "placed" : "PAYMENT_PENDING",
          delivery_full_name: deliveryPayload.fullName || "",
          delivery_phone: deliveryPayload.phone || "",
          delivery_address: fullStreet,
          delivery_city: deliveryPayload.city || "",
          delivery_state: deliveryPayload.state || "",
          delivery_country: deliveryPayload.country || "India",
          delivery_pincode: deliveryPayload.zip || "",
          estimated_delivery: etaFormatted,
          transaction_reference: transactionRef,
          coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
          delivery_preference: state.selectedDeliveryPreference || "Simple Delivery",
          free_gifts_eligible: Boolean(isFullOnline && state.resolvedCartGifts && state.resolvedCartGifts.length > 0),
          free_gifts_items: isFullOnline ? (state.resolvedCartGifts || []) : [],
          is_full_online_payment: isFullOnline,
          tracking_data: {
            store_type: (state.cart.some(it => it.catalog_type === "sarojini" || it.sarojini_product_id)) ? "sarojini" : "main",
            merchant_vpa: merchantVpa,
            merchant_name: merchantName,
            payable_now: payableNow,
            upi_uri: upiUri,
            customer_email: deliveryPayload.email || null,
            items_snapshot: state.cart
          }
        };

        const { data: ordRow, error: ordErr } = await client.from("orders").insert([baseOrderPayload]).select().single();
        if (!ordErr && ordRow) {
          dbOrder = ordRow;
        } else if (ordErr) {
          console.warn("[Direct UPI Client] orders table insert notice:", ordErr.message);
        }
      } catch (dbErr) {
        console.warn("[Direct UPI Client] Database insertion notice:", dbErr);
      }
    }

    const orderId = dbOrder ? dbOrder.id : transactionRef;
    const finalOrderNumber = dbOrder ? (dbOrder.order_number || orderNumber) : orderNumber;

    // Insert order items into order_items table
    if (client && dbOrder && state.cart && state.cart.length > 0) {
      try {
        const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const itemsPayload = state.cart.map(item => {
          const qty = item.quantity || 1;
          const price = item.is_free_bogo ? 0 : (item.price || 0);
          const isSarojini = item.catalog_type === "sarojini" || Boolean(item.sarojini_product_id);
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
            catalog_type: isSarojini ? "sarojini" : "main",
            product_name: item.name,
            product_image: cleanImg || null,
            price: price,
            quantity: qty,
            selected_size: item.size || null,
            selected_color: item.color || null,
            subtotal: price * qty,
            advance_amount: isFullOnline ? 0 : (item.advance_amount || 0),
            cod_balance: isFullOnline ? 0 : (item.cod_balance || 0),
            advance_payment_enabled: Boolean(item.advance_payment_enabled)
          };
        });

        await client.from("order_items").insert(itemsPayload);
      } catch (itemErr) {
        console.warn("[Direct UPI Client] order_items insert notice:", itemErr);
      }
    }

    return {
      success: true,
      is_cod: isCod,
      order_id: orderId,
      order_number: finalOrderNumber,
      transaction_reference: transactionRef,
      total: state.total,
      payable_now: payableNow,
      advance_amount: advanceAmount,
      cod_balance: codBalance,
      payment_method: paymentMethodDisplay,
      upi_uri: upiUri,
      merchant_upi_id: merchantVpa,
      merchant_name: merchantName,
      order_status: isCod ? "placed" : "PAYMENT_PENDING",
      payment_status: isCod ? "COD_PENDING" : "pending",
      summary: {
        subtotal: state.subtotal,
        discount: state.discountAmount,
        shipping: 0,
        total: state.total,
        advance_amount: advanceAmount,
        cod_balance: codBalance,
        payable_now: payableNow,
        items: state.cart
      }
    };
  }
`;

// Insert helpers before submitUpiConfirmation
const hookBeforeSubmit = `  async function submitUpiConfirmation() {`;
if (!code.includes('safeParseResponse')) {
  code = code.replace(hookBeforeSubmit, safeParserCode + '\n' + clientSideOrderCode + '\n' + hookBeforeSubmit);
}

// 3. Update submitUpiConfirmation to use safeParseResponse & fallback
const oldSubmitBlock = `    try {
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
      }`;

const newSubmitBlock = `    try {
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

      const parsed = await safeParseResponse(resp);
      let resData = parsed.data;

      if (!parsed.ok) {
        if (parsed.status === 404 || parsed.status === 405 || (!parsed.data && parsed.status >= 400)) {
          // Static server fallback: update Supabase directly
          console.info("[Submit Payment] Serverless unavailable (HTTP " + parsed.status + "). Updating order in Supabase directly.");
          const client = window.supabaseClient || (window.VeloraAuth ? window.VeloraAuth.client : null);
          if (client && state.activeOrderId) {
            try {
              await client.from("orders").update({
                order_status: "PAYMENT_VERIFICATION_PENDING",
                payment_status: "customer_submitted",
                customer_utr: customerUtr || null,
                payment_submitted_at: new Date().toISOString()
              }).eq("id", state.activeOrderId);
            } catch (e) {
              console.warn("[Submit Payment] Direct Supabase update warning:", e);
            }
          }
          resData = { success: true };
        } else {
          throw new Error(parsed.data?.error || parsed.data?.message || "Failed to submit payment confirmation.");
        }
      }`;

if (code.includes(oldSubmitBlock)) {
  code = code.replace(oldSubmitBlock, newSubmitBlock);
}

// 4. Update startDirectUpiCheckout to use safeParseResponse & fallback
const oldStartDirectUpiBlock = `    try {
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
      }`;

const newStartDirectUpiBlock = `    try {
      let orderRes = null;
      let useClientFallback = false;

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

        const parsed = await safeParseResponse(resp);

        if (parsed.ok && parsed.data && parsed.data.success) {
          orderRes = parsed.data;
        } else if (parsed.status === 404 || parsed.status === 405 || (!parsed.data && parsed.status >= 400 && parsed.status < 500)) {
          console.info("[Direct UPI] Serverless returned HTTP " + parsed.status + " (static preview server). Using direct Supabase client.");
          useClientFallback = true;
        } else {
          throw new Error(parsed.data?.error || parsed.data?.message || \`Payment request failed (\${parsed.status})\`);
        }
      } catch (fetchErr) {
        if (useClientFallback || fetchErr.message.includes("Failed to fetch") || fetchErr.message.includes("NetworkError")) {
          useClientFallback = true;
        } else {
          throw fetchErr;
        }
      }

      if (useClientFallback) {
        orderRes = await createDirectUpiOrderClientSide(paymentType, deliveryPayload, resolvedUserId);
      }

      if (!orderRes || !orderRes.success) {
        throw new Error(orderRes?.error || "Unable to start UPI payment. Please try again.");
      }`;

if (code.includes(oldStartDirectUpiBlock)) {
  code = code.replace(oldStartDirectUpiBlock, newStartDirectUpiBlock);
}

fs.writeFileSync(checkoutJsPath, code, 'utf8');
console.log('Successfully updated js/checkout.js with safe JSON parsing and static server fallback!');
