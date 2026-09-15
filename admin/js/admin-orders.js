/**
 * VELORA Admin Panel - Orders Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("orders-tbody");
  const searchInput = document.getElementById("search-orders");
  const statusFilter = document.getElementById("filter-status");

  let allOrders = [];
  let orderMetadata = {};

  async function loadOrders() {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px;">Loading orders from database...</td></tr>';
    
    try {
      const { data: metaRow } = await client.from("store_settings").select("value").eq("key", "order_metadata").maybeSingle();
      if (metaRow && metaRow.value) {
        orderMetadata = metaRow.value;
      }
    } catch (_) {}

    const { data, error } = await client
      .from("orders")
      .select("*, order_items(count)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--admin-danger);">Error: ${error.message}</td></tr>`;
      return;
    }

    allOrders = data || [];
    renderOrders();
  }

  function renderOrders() {
    let filtered = [...allOrders];
    const q = (searchInput?.value || "").trim().toLowerCase();
    const st = statusFilter?.value || "";

    if (q) {
      filtered = filtered.filter(o => 
        (o.order_number && o.order_number.toLowerCase().includes(q)) ||
        (o.delivery_full_name && o.delivery_full_name.toLowerCase().includes(q)) ||
        (o.delivery_phone && o.delivery_phone.includes(q))
      );
    }

    if (st) {
      filtered = filtered.filter(o => o.order_status === st);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px; color: var(--admin-text-muted);">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      let badgeClass = "badge-info";
      if (o.order_status === "delivered") badgeClass = "badge-success";
      if (o.order_status === "cancelled") badgeClass = "badge-danger";
      if (o.order_status === "processing") badgeClass = "badge-warning";
      if (o.order_status === "shipped") badgeClass = "badge-indigo";

      const dateStr = new Date(o.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
      const itemCount = (o.order_items && o.order_items[0]) ? o.order_items[0].count : 1;

      const meta = orderMetadata[o.id] || {};
      const hasAdvance = Number(o.advance_paid || o.advance_amount || 0) > 0;
      const isOnlinePaid = Boolean(
        o.is_full_online_payment || 
        meta.is_full_online_payment ||
        (o.payment_status === "paid" && !hasAdvance && !o.payment_method?.toLowerCase().includes("cash on delivery")) ||
        o.payment_method?.includes("Full Online")
      );

      const hasGifts = Boolean(
        o.free_gifts_eligible || 
        meta.free_gifts_eligible || 
        (isOnlinePaid && !hasAdvance && !o.payment_method?.toLowerCase().includes("cash on delivery"))
      );

      const deliveryPref = o.delivery_preference || meta.delivery_preference || (o.payment_method?.includes("Open Box") ? "Open Box Delivery" : "Simple Delivery");
      const isOpenBox = deliveryPref === "Open Box Delivery";

      let advCodHtml = '—';
      if (hasAdvance) {
        advCodHtml = `
          <div>
            <span class="badge badge-indigo" style="font-size:0.75rem; padding: 2px 6px;">Adv: ${window.formatINR(o.advance_paid || o.advance_amount)}</span>
          </div>
          <div style="font-size: 0.75rem; color: #d97706; font-weight: 600; margin-top: 3px;">
            COD Bal: ${window.formatINR(o.cod_balance || 0)}
          </div>
        `;
      } else if (o.payment_method && o.payment_method.toLowerCase().includes("cash on delivery")) {
        advCodHtml = `<span style="font-size: 0.78rem; color: #d97706;">Full COD</span>`;
      } else if (isOnlinePaid) {
        advCodHtml = `<span class="badge badge-success" style="font-size:0.72rem;">Full Online</span>`;
      }

      let giftItems = [];
      try {
        if (Array.isArray(o.free_gifts_items)) giftItems = o.free_gifts_items;
        else if (typeof o.free_gifts_items === "string") giftItems = JSON.parse(o.free_gifts_items);
        else if (Array.isArray(meta.free_gifts_items)) giftItems = meta.free_gifts_items;
        else if (typeof meta.free_gifts_items === "string") giftItems = JSON.parse(meta.free_gifts_items);
      } catch (e) {
        giftItems = [];
      }
      const giftCount = giftItems.length > 0 ? giftItems.length : 3;
      const giftNames = giftItems.map(g => g.name || g.gift_name).filter(Boolean).join(", ") || "Free Gifts";

      let paymentBadgesHtml = `<div><span class="badge badge-muted">${o.payment_method}</span></div>`;
      if (isOnlinePaid) {
        paymentBadgesHtml += `<div style="margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap;">
          <span class="badge badge-success" style="font-size:0.68rem; font-weight:700;">ONLINE PAID</span>
          ${hasGifts ? `<span class="badge" title="${giftNames}" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-size:0.68rem; font-weight:700;">🎁 ${giftCount} FREE GIFT${giftCount > 1 ? 'S' : ''}</span>` : ''}
          <span class="badge" style="background: ${isOpenBox ? 'rgba(2, 132, 199, 0.2)' : 'rgba(100, 116, 139, 0.15)'}; color: ${isOpenBox ? '#38bdf8' : '#94a3b8'}; border: 1px solid ${isOpenBox ? 'rgba(2, 132, 199, 0.4)' : 'transparent'}; font-size:0.68rem; font-weight:700;">${isOpenBox ? '📦 OPEN BOX' : 'SIMPLE DELIVERY'}</span>
        </div>`;
      } else {
        paymentBadgesHtml += `<div style="margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap;">
          <span class="badge" style="background: rgba(100, 116, 139, 0.15); color: #94a3b8; font-size:0.68rem;">SIMPLE DELIVERY</span>
        </div>`;
      }

      return `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>
            <div><strong>${o.delivery_full_name}</strong></div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${o.delivery_phone}</div>
          </td>
          <td>${dateStr}</td>
          <td>${paymentBadgesHtml}</td>
          <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
          <td>${advCodHtml}</td>
          <td><strong>${window.formatINR(o.total)}</strong> <span style="font-size: 0.75rem; color: var(--admin-text-muted);">(${itemCount} items)</span></td>
          <td><span class="badge ${badgeClass}">${o.order_status}</span></td>
          <td><a href="order-details.html?id=${o.id}" class="btn-admin-secondary" style="padding: 4px 8px; font-size: 0.78rem;">Manage</a></td>
        </tr>
      `;
    }).join("");
  }

  if (searchInput) searchInput.addEventListener("input", renderOrders);
  if (statusFilter) statusFilter.addEventListener("change", renderOrders);

  await loadOrders();
});
