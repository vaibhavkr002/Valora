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

  async function loadOrders() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px;">Loading orders from database...</td></tr>';
    const { data, error } = await client
      .from("orders")
      .select("*, order_items(count)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--admin-danger);">Error: ${error.message}</td></tr>`;
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

      const hasAdvance = Number(o.advance_paid || o.advance_amount || 0) > 0;
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
      } else if (o.payment_status === "paid") {
        advCodHtml = `<span class="badge badge-success" style="font-size:0.72rem;">Full Online</span>`;
      }

      return `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>
            <div><strong>${o.delivery_full_name}</strong></div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${o.delivery_phone}</div>
          </td>
          <td>${dateStr}</td>
          <td><span class="badge badge-muted">${o.payment_method}</span></td>
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
