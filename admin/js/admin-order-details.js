/**
 * VELORA Admin Panel - Order Details & Status Updater
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id");

  if (!orderId) {
    alert("No order specified.");
    window.location.href = "orders.html";
    return;
  }

  const elOrderNum = document.getElementById("detail-order-number");
  const elOrderStatusBadge = document.getElementById("detail-order-status-badge");
  const selectStatus = document.getElementById("select-order-status");
  const btnUpdateStatus = document.getElementById("btn-update-status");
  const itemsContainer = document.getElementById("order-items-container");

  async function loadOrder() {
    const { data: order, error } = await client
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      alert("Order not found: " + (error?.message || ""));
      window.location.href = "orders.html";
      return;
    }

    if (elOrderNum) elOrderNum.textContent = order.order_number;
    document.getElementById("detail-order-date").textContent = new Date(order.created_at).toLocaleString("en-IN");
    document.getElementById("detail-customer-name").textContent = order.delivery_full_name;
    document.getElementById("detail-customer-phone").textContent = order.delivery_phone;
    document.getElementById("detail-customer-address").innerHTML = `
      ${order.delivery_address}<br>
      ${order.delivery_city}, ${order.delivery_state} ${order.delivery_pincode}, ${order.delivery_country}
    `;

    // Fetch store_settings order_metadata fallback if needed
    let meta = {};
    try {
      const { data: metaRow } = await client.from("store_settings").select("value").eq("key", "order_metadata").maybeSingle();
      if (metaRow && metaRow.value && metaRow.value[orderId]) {
        meta = metaRow.value[orderId];
      }
    } catch (_) {}

    // Delivery Preference Display
    const deliveryPref = order.delivery_preference || meta.delivery_preference || (order.payment_method && order.payment_method.includes("Open Box") ? "Open Box Delivery" : "Simple Delivery");
    const elDeliveryPref = document.getElementById("detail-delivery-preference");
    if (elDeliveryPref) {
      elDeliveryPref.textContent = deliveryPref;
      if (deliveryPref === "Open Box Delivery") {
        elDeliveryPref.className = "badge badge-indigo";
        elDeliveryPref.style.background = "rgba(2, 132, 199, 0.2)";
        elDeliveryPref.style.color = "#38bdf8";
        elDeliveryPref.style.border = "1px solid rgba(2, 132, 199, 0.4)";
      } else {
        elDeliveryPref.className = "badge badge-muted";
      }
    }

    // Full Online Payment Free Gifts Display
    const hasAdvanceCheck = Number(order.advance_paid || order.advance_amount || 0) > 0;
    const isOnlinePaid = Boolean(
      order.is_full_online_payment || 
      meta.is_full_online_payment ||
      (order.payment_status === "paid" && !hasAdvanceCheck && !order.payment_method?.toLowerCase().includes("cash on delivery")) ||
      order.payment_method?.includes("Full Online")
    );

    let orderGiftItems = [];
    try {
      if (Array.isArray(order.free_gifts_items)) {
        orderGiftItems = order.free_gifts_items;
      } else if (typeof order.free_gifts_items === "string") {
        orderGiftItems = JSON.parse(order.free_gifts_items);
      } else if (Array.isArray(meta.free_gifts_items)) {
        orderGiftItems = meta.free_gifts_items;
      } else if (typeof meta.free_gifts_items === "string") {
        orderGiftItems = JSON.parse(meta.free_gifts_items);
      }
    } catch (e) {
      orderGiftItems = [];
    }

    const hasGifts = Boolean(
      (order.free_gifts_eligible || meta.free_gifts_eligible || (isOnlinePaid && !hasAdvanceCheck && !order.payment_method?.toLowerCase().includes("cash on delivery"))) &&
      (orderGiftItems.length > 0 || order.free_gifts_eligible)
    );

    const elGiftsCard = document.getElementById("detail-gifts-card");
    const elGiftsTitle = document.getElementById("detail-gifts-title");
    const elGiftsList = document.getElementById("detail-gifts-list");

    if (elGiftsCard) {
      elGiftsCard.style.display = hasGifts ? "block" : "none";
      if (hasGifts) {
        if (elGiftsTitle) {
          elGiftsTitle.textContent = `🎁 ${orderGiftItems.length > 0 ? orderGiftItems.length : 3} Free Gifts Included`;
        }
        if (elGiftsList) {
          if (orderGiftItems.length > 0) {
            elGiftsList.innerHTML = orderGiftItems.map(g => `
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.1rem;">${g.icon || '🎁'}</span>
                  <div>
                    <strong style="color:#fff;">${g.name || g.gift_name}</strong>
                    ${g.description ? `<div style="font-size:0.72rem; color:var(--admin-text-muted);">${g.description}</div>` : ''}
                  </div>
                </div>
                <span style="color:#10b981; font-weight:700;">FREE (₹0) ${g.quantity > 1 ? `x${g.quantity}` : ''}</span>
              </div>
            `).join("");
          } else {
            elGiftsList.innerHTML = `
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🧦 <strong>Luxury Cotton Crew Socks</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🧵 <strong>Premium Extra Laces</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🔑 <strong>Signature VELORA Keychain</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
            `;
          }
        }
      }
    }

    document.getElementById("detail-payment-method").textContent = order.payment_method;
    document.getElementById("detail-payment-status").textContent = order.payment_status;
    document.getElementById("detail-subtotal").textContent = window.formatINR(order.subtotal);
    document.getElementById("detail-discount").textContent = `-${window.formatINR(order.discount)}`;
    document.getElementById("detail-shipping").textContent = (!order.shipping_charge || order.shipping_charge === 0) ? "FREE (₹0)" : window.formatINR(order.shipping_charge);
    document.getElementById("detail-total").textContent = window.formatINR(order.total);

    // Advance Payment Details
    const advancePaidVal = Number(order.advance_paid || order.advance_amount || 0);
    const codBalVal = Number(order.cod_balance || 0);
    const advanceRow = document.getElementById("detail-advance-row");
    const codRow = document.getElementById("detail-cod-row");
    const advStatusBox = document.getElementById("detail-advance-status-box");
    const advStatusBadge = document.getElementById("detail-advance-status");
    const codStatusBadge = document.getElementById("detail-cod-status");
    const codControlBox = document.getElementById("cod-collection-control");
    const btnMarkCodCollected = document.getElementById("btn-mark-cod-collected");

    if (advancePaidVal > 0) {
      if (advanceRow) {
        advanceRow.style.display = "flex";
        document.getElementById("detail-advance-paid").textContent = window.formatINR(advancePaidVal);
      }
      if (codRow) {
        codRow.style.display = "flex";
        document.getElementById("detail-cod-balance").textContent = window.formatINR(codBalVal);
      }
      if (advStatusBox) {
        advStatusBox.style.display = "block";
        if (advStatusBadge) advStatusBadge.textContent = order.advance_payment_status || "paid";
        if (codStatusBadge) {
          codStatusBadge.textContent = order.cod_payment_status || "pending";
          codStatusBadge.className = `badge ${order.cod_payment_status === 'collected' ? 'badge-success' : 'badge-warning'}`;
        }
      }

      if (codControlBox) {
        if (order.cod_payment_status !== "collected" && codBalVal > 0) {
          codControlBox.style.display = "block";
        } else {
          codControlBox.style.display = "none";
        }
      }

      if (btnMarkCodCollected) {
        btnMarkCodCollected.onclick = async () => {
          if (!confirm(`Confirm collection of ${window.formatINR(codBalVal)} COD balance from customer?`)) return;
          btnMarkCodCollected.disabled = true;
          btnMarkCodCollected.textContent = "Updating...";

          const { error: codUpdErr } = await client
            .from("orders")
            .update({
              cod_payment_status: "collected",
              payment_status: "paid",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (codUpdErr) {
            alert("Failed to update COD status: " + codUpdErr.message);
            btnMarkCodCollected.disabled = false;
            btnMarkCodCollected.textContent = "Mark COD Balance Collected";
          } else {
            window.showToast("COD balance recorded as collected! Order marked fully paid.", "success");
            await loadOrder();
          }
        };
      }
    } else {
      if (advanceRow) advanceRow.style.display = "none";
      if (codRow) codRow.style.display = "none";
      if (advStatusBox) advStatusBox.style.display = "none";
    }

    if (selectStatus) selectStatus.value = order.order_status;

    // Render items with advance info
    if (itemsContainer && order.order_items) {
      itemsContainer.innerHTML = order.order_items.map(item => {
        let advBadge = "";
        const itemAdv = Number(item.advance_amount || 0);
        if (itemAdv > 0) {
          advBadge = `<span class="badge badge-indigo" style="font-size:0.72rem; margin-left:6px;">Advance: ${window.formatINR(itemAdv)}</span>`;
        }
        return `
          <div style="display:flex; align-items:center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--admin-card-border);">
            <img src="${item.product_image || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid var(--admin-card-border);">
            <div style="flex:1;">
              <strong style="color:#fff; font-size: 0.92rem;">${item.product_name}</strong>
              <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 2px;">
                ${item.selected_size ? 'Size: ' + item.selected_size : ''} ${item.selected_color ? '• Color: ' + item.selected_color : ''} • Qty: ${item.quantity} ${advBadge}
              </div>
            </div>
            <div style="font-weight:700; color:#fff;">${window.formatINR(item.subtotal || (item.price * item.quantity))}</div>
          </div>
        `;
      }).join("");
    }
  }

  if (btnUpdateStatus) {
    btnUpdateStatus.addEventListener("click", async () => {
      const newStatus = selectStatus.value;
      btnUpdateStatus.disabled = true;
      btnUpdateStatus.textContent = "Updating...";

      const { error } = await client
        .from("orders")
        .update({ order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) {
        alert("Failed to update status: " + error.message);
      } else {
        window.showToast(`Order status updated to "${newStatus}". Reflects live on customer account.`, "success");
      }
      btnUpdateStatus.disabled = false;
      btnUpdateStatus.textContent = "Update Status";
    });
  }

  // ==========================================================================
  // COURIER & SHIPMENT TRACKING SYNC
  // ==========================================================================
  const selectCourier = document.getElementById("select-delivery-courier");
  const inputTrackingId = document.getElementById("input-tracking-id");
  const inputTrackingEta = document.getElementById("input-tracking-eta");
  const previewWrap = document.getElementById("tracking-preview-wrap");
  const linkPreview = document.getElementById("link-preview-tracking");
  const btnSaveTracking = document.getElementById("btn-save-tracking");

  let deliveryPartners = [];

  async function loadDeliveryPartners() {
    const { data, error } = await client.from("delivery_partners").select("*").order("display_order", { ascending: true });
    if (!error && data) {
      deliveryPartners = data;
      if (selectCourier) {
        selectCourier.innerHTML = '<option value="">-- Select Courier Partner --</option>' +
          deliveryPartners.map(p => `<option value="${p.id}">${p.name} (${p.badge_text || 'Standard'})</option>`).join("");
      }
    }
  }

  function getTrackingUrl(partner, trackingId) {
    if (!partner || !trackingId) return "";
    const template = partner.tracking_url_template || "";
    if (template.includes("{TRACK_ID}")) {
      return template.replace("{TRACK_ID}", encodeURIComponent(trackingId));
    } else if (template.includes("{tracking_id}")) {
      return template.replace("{tracking_id}", encodeURIComponent(trackingId));
    } else if (template.includes("{tracking_number}")) {
      return template.replace("{tracking_number}", encodeURIComponent(trackingId));
    } else if (template.startsWith("http")) {
      return template + encodeURIComponent(trackingId);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(partner.name + " tracking " + trackingId)}`;
  }

  function updateTrackingPreview() {
    if (!previewWrap || !linkPreview || !selectCourier || !inputTrackingId) return;
    const partnerId = selectCourier.value;
    const partner = deliveryPartners.find(p => p.id === partnerId);
    const trackingId = inputTrackingId.value.trim();

    if (partner && trackingId) {
      const url = getTrackingUrl(partner, trackingId);
      linkPreview.href = url;
      linkPreview.innerHTML = `Track package with ${partner.name} (${trackingId}) <i class="fas fa-external-link-alt"></i>`;
      previewWrap.style.display = "block";
    } else {
      previewWrap.style.display = "none";
    }
  }

  async function initTracking(order) {
    await loadDeliveryPartners();

    let existingTracking = null;
    try {
      const { data: settingsRow } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "order_tracking")
        .maybeSingle();

      if (settingsRow && settingsRow.value && settingsRow.value[orderId]) {
        existingTracking = settingsRow.value[orderId];
      }
    } catch (e) {
      console.warn("Tracking fetch notice:", e);
    }

    if (existingTracking) {
      if (selectCourier && existingTracking.courier_id) {
        selectCourier.value = existingTracking.courier_id;
      }
      if (inputTrackingId && existingTracking.tracking_id) {
        inputTrackingId.value = existingTracking.tracking_id;
      }
      if (inputTrackingEta && existingTracking.estimated_delivery) {
        inputTrackingEta.value = existingTracking.estimated_delivery;
      }
    } else if (order.estimated_delivery) {
      if (inputTrackingEta) {
        inputTrackingEta.value = order.estimated_delivery;
      }
    }

    updateTrackingPreview();

    if (selectCourier) selectCourier.addEventListener("change", updateTrackingPreview);
    if (inputTrackingId) inputTrackingId.addEventListener("input", updateTrackingPreview);
  }

  if (btnSaveTracking) {
    btnSaveTracking.addEventListener("click", async () => {
      const partnerId = selectCourier ? selectCourier.value : "";
      const partner = deliveryPartners.find(p => p.id === partnerId);
      const trackingId = inputTrackingId ? inputTrackingId.value.trim() : "";
      const eta = inputTrackingEta ? inputTrackingEta.value.trim() : "";

      if (!partnerId) {
        alert("Please select a delivery courier partner.");
        return;
      }
      if (!trackingId) {
        alert("Please enter the AWB / Tracking ID.");
        return;
      }

      btnSaveTracking.disabled = true;
      btnSaveTracking.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

      try {
        const trackingUrl = getTrackingUrl(partner, trackingId);
        const trackingPayload = {
          courier_id: partner.id,
          courier_name: partner.name,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          estimated_delivery: eta || "3-5 Business Days",
          updated_at: new Date().toISOString()
        };

        // 1. Dual-write into store_settings (order_tracking)
        const { data: existingSettings } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "order_tracking")
          .maybeSingle();

        const currentMap = (existingSettings && existingSettings.value) ? existingSettings.value : {};
        currentMap[orderId] = trackingPayload;

        await client.from("store_settings").upsert({
          key: "order_tracking",
          value: currentMap,
          updated_at: new Date().toISOString()
        });

        // 2. Dual-write into orders (estimated_delivery)
        // Write tracking directly to the target order row (isolated to order owner)
        const displayEta = eta ? `${partner.name}: ${trackingId} (ETA: ${eta})` : `${partner.name}: ${trackingId}`;
        await client.from("orders").update({
          tracking_data: trackingPayload,
          estimated_delivery: displayEta,
          updated_at: new Date().toISOString()
        }).eq("id", orderId);

        window.showToast("Courier & Tracking information saved! Live on customer account.", "success");
        updateTrackingPreview();
      } catch (err) {
        alert("Error saving tracking: " + err.message);
      } finally {
        btnSaveTracking.disabled = false;
        btnSaveTracking.innerHTML = `<i class="fas fa-save"></i> Save Tracking Information`;
      }
    });
  }

  // --- DELETE ORDER HANDLER ---
  const btnDeleteOrderDetail = document.getElementById("btn-delete-order-detail");
  const deleteModal = document.getElementById("delete-order-modal");
  const deleteModalBackdrop = document.getElementById("delete-order-backdrop");
  const deleteModalCloseBtn = document.getElementById("btn-close-delete-modal");
  const deleteCancelBtn = document.getElementById("btn-cancel-delete-order");
  const deleteConfirmBtn = document.getElementById("btn-confirm-delete-order");
  const deleteOrderNumDisplay = document.getElementById("delete-order-number-display");

  function openDeleteModal() {
    if (deleteOrderNumDisplay && elOrderNum) {
      deleteOrderNumDisplay.textContent = elOrderNum.textContent || `#${orderId}`;
    }
    if (deleteModal) {
      deleteModal.classList.add("show");
    }
  }

  function closeDeleteModal() {
    if (deleteModal) {
      deleteModal.classList.remove("show");
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
    }
  }

  async function executeDeleteOrder() {
    if (!orderId) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Deleting...</span>';

    // Ensure admin profile sync
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user && (user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin")) {
        const { data: prof } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (!prof || prof.role !== "admin") {
          await client.from("profiles").upsert({
            id: user.id,
            role: "admin",
            full_name: user.user_metadata?.full_name || "Administrator",
            email: user.email
          }, { onConflict: "id" });
        }
      }
    } catch (_) {}

    let success = false;
    let lastError = null;

    // 1. Try atomic admin RPC
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc("admin_delete_order", { p_order_id: orderId });
      if (!rpcErr && rpcRes && rpcRes.success) {
        success = true;
      } else if (rpcErr) {
        console.warn("admin_delete_order RPC notice, trying direct cascade:", rpcErr);
        lastError = rpcErr;
      }
    } catch (rpcEx) {
      console.warn("admin_delete_order RPC exception:", rpcEx);
      lastError = rpcEx;
    }

    // 2. Direct database deletion fallback
    if (!success) {
      try {
        const { error: itemsErr } = await client.from("order_items").delete().eq("order_id", orderId);
        if (itemsErr) console.warn("order_items delete notice:", itemsErr);

        try {
          await client.from("upi_payment_transactions").update({ order_id: null }).eq("order_id", orderId);
        } catch (_) {}

        const { data: deletedOrders, error: orderErr } = await client
          .from("orders")
          .delete()
          .eq("id", orderId)
          .select("id");

        if (orderErr) {
          console.error("Supabase orders delete error:", orderErr);
          lastError = orderErr;
        } else if (!deletedOrders || deletedOrders.length === 0) {
          console.error("Database returned 0 deleted rows for ID:", orderId);
          lastError = new Error("Order deletion was not permitted by database RLS.");
        } else {
          success = true;
        }
      } catch (directEx) {
        console.error("Direct deletion error:", directEx);
        lastError = directEx;
      }
    }

    if (success) {
      if (typeof window.showToast === "function") {
        window.showToast("Order deleted successfully.", "success");
      }
      setTimeout(() => {
        window.location.href = "orders.html";
      }, 500);
    } else {
      console.error("Failed to delete order:", lastError);
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
      if (typeof window.showToast === "function") {
        window.showToast("Failed to delete order. Please try again.", "error");
      } else {
        alert("Failed to delete order. Please try again.");
      }
    }
  }

  if (btnDeleteOrderDetail) btnDeleteOrderDetail.addEventListener("click", openDeleteModal);
  if (deleteModalCloseBtn) deleteModalCloseBtn.addEventListener("click", closeDeleteModal);
  if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener("click", e => {
      if (e.target === deleteModal) closeDeleteModal();
    });
  }
  if (deleteConfirmBtn) deleteConfirmBtn.addEventListener("click", executeDeleteOrder);

  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && deleteModal?.classList.contains("show")) {
      closeDeleteModal();
    }
  });

  await loadOrder();
  const { data: currentOrder } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (currentOrder) {
    await initTracking(currentOrder);
  }
});
