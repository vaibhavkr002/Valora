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

    document.getElementById("detail-payment-method").textContent = order.payment_method;
    document.getElementById("detail-payment-status").textContent = order.payment_status;
    document.getElementById("detail-subtotal").textContent = window.formatINR(order.subtotal);
    document.getElementById("detail-discount").textContent = `-${window.formatINR(order.discount)}`;
    document.getElementById("detail-shipping").textContent = window.formatINR(order.shipping_charge);
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

  await loadOrder();
});
