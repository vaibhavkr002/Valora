/**
 * VELORA Admin Panel - Dashboard Controller
 * Aggregates real-time statistics from Supabase: products, orders, revenue, low stock.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  // Metrics elements
  const elTotalRev = document.getElementById("metric-total-revenue");
  const elTotalOrders = document.getElementById("metric-total-orders");
  const elTotalProducts = document.getElementById("metric-total-products");
  const elTotalCustomers = document.getElementById("metric-total-customers");
  const elLowStockCount = document.getElementById("metric-low-stock");
  const elRecentOrdersTable = document.getElementById("recent-orders-tbody");
  const elLowStockTable = document.getElementById("low-stock-tbody");

  async function loadDashboardData() {
    try {
      // 1. Total Products & Low Stock
      const { data: products, error: pErr } = await client
        .from("products")
        .select("id, name, price, stock, is_active, category_id, categories(name)");

      if (products) {
        if (elTotalProducts) elTotalProducts.textContent = products.length;
        const lowStock = products.filter(p => p.stock <= 5);
        if (elLowStockCount) elLowStockCount.textContent = lowStock.length;

        // Render low stock table
        if (elLowStockTable) {
          if (lowStock.length === 0) {
            elLowStockTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--admin-text-muted);">All items have healthy inventory levels.</td></tr>';
          } else {
            elLowStockTable.innerHTML = lowStock.slice(0, 5).map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.categories ? p.categories.name : 'General'}</td>
                <td><span class="badge badge-danger">${p.stock} left</span></td>
                <td><a href="edit-product.html?id=${p.id}" class="btn-admin-secondary" style="padding: 4px 8px; font-size: 0.75rem;">Restock</a></td>
              </tr>
            `).join("");
          }
        }
      }

      // 2. Orders & Revenue
      const { data: orders, error: oErr } = await client
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (orders) {
        if (elTotalOrders) elTotalOrders.textContent = orders.length;

        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        if (elTotalRev) elTotalRev.textContent = window.formatINR(totalRevenue);

        // Render recent orders table
        if (elRecentOrdersTable) {
          if (orders.length === 0) {
            elRecentOrdersTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No orders recorded yet.</td></tr>';
          } else {
            elRecentOrdersTable.innerHTML = orders.slice(0, 6).map(o => {
              let badgeClass = "badge-info";
              if (o.order_status === "delivered") badgeClass = "badge-success";
              if (o.order_status === "cancelled") badgeClass = "badge-danger";
              if (o.order_status === "processing") badgeClass = "badge-warning";

              const orderDate = new Date(o.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
              return `
                <tr>
                  <td><strong>${o.order_number}</strong></td>
                  <td>${o.delivery_full_name}</td>
                  <td>${orderDate}</td>
                  <td><strong>${window.formatINR(o.total)}</strong></td>
                  <td><span class="badge ${badgeClass}">${o.order_status}</span></td>
                  <td><a href="order-details.html?id=${o.id}" class="btn-admin-secondary" style="padding: 4px 8px; font-size: 0.75rem;">View</a></td>
                </tr>
              `;
            }).join("");
          }
        }
      }

      // 3. Total Customers
      const { count: customerCount } = await client
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (elTotalCustomers) elTotalCustomers.textContent = customerCount || 0;

    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
      window.showToast("Could not retrieve real-time statistics.", "error");
    }
  }

  await loadDashboardData();
});
