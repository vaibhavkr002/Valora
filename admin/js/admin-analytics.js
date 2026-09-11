/**
 * VELORA Admin Panel - Analytics Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  async function loadAnalytics() {
    try {
      const { data: orders } = await client.from("orders").select("total, order_status, created_at, order_items(product_name, quantity, price)");
      const { data: products } = await client.from("products").select("id, name, price, stock, category_id, categories(name)");

      if (!orders || orders.length === 0) {
        document.getElementById("analytics-summary").innerHTML = '<div style="padding:20px; color:var(--admin-text-muted);">Insufficient order data for deep statistical graphs. New purchases will render analytics here.</div>';
        return;
      }

      const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
      const aov = totalRevenue / orders.length;

      document.getElementById("stat-aov").textContent = window.formatINR(aov);
      document.getElementById("stat-total-rev").textContent = window.formatINR(totalRevenue);
      document.getElementById("stat-total-orders").textContent = orders.length;

      // Status breakdown
      const statusCounts = {};
      orders.forEach(o => {
        statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
      });

      const elBreakdown = document.getElementById("status-breakdown-list");
      if (elBreakdown) {
        elBreakdown.innerHTML = Object.keys(statusCounts).map(st => `
          <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--admin-card-border);">
            <span style="text-transform: capitalize;">${st}</span>
            <strong>${statusCounts[st]} orders</strong>
          </div>
        `).join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  await loadAnalytics();
});
