/**
 * VELORA Admin Panel - Dashboard Controller
 * Aggregates real-time statistics from Supabase: products, orders, revenue, today's sales, profit (advance collected), low stock.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  // Metrics elements
  const elTotalRev = document.getElementById("metric-total-revenue");
  const elTodaySales = document.getElementById("metric-today-sales");
  const elTodayProfit = document.getElementById("metric-today-profit");
  const elTotalOrders = document.getElementById("metric-total-orders");
  const elTotalProducts = document.getElementById("metric-total-products");
  const elTotalCustomers = document.getElementById("metric-total-customers");
  const elLowStockCount = document.getElementById("metric-low-stock");
  const elRecentOrdersTable = document.getElementById("recent-orders-tbody");
  const elLowStockTable = document.getElementById("low-stock-tbody");
  const btnRefresh = document.getElementById("btn-refresh-dashboard");

  // Helper for formatting INR currency safely
  const formatINR = (amt) => {
    if (typeof window.formatINR === "function") return window.formatINR(amt);
    return "₹" + Math.round(Number(amt) || 0).toLocaleString("en-IN");
  };

  // Helper for IST calendar date YYYY-MM-DD
  function getISTDateString(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  }

  // Check if an order is cancelled or refunded
  function isOrderCancelledOrRefunded(o) {
    if (!o) return false;
    const ordStatus = (o.order_status || "").toLowerCase();
    const payStatus = (o.payment_status || "").toLowerCase();
    const advPayStatus = (o.advance_payment_status || "").toLowerCase();
    return ordStatus === "cancelled" || ordStatus === "returned" || payStatus === "refunded" || advPayStatus === "refunded";
  }

  // Calculate advance collected for an order according to the project's business rule
  function getOrderAdvancePaid(o) {
    if (!o) return 0;
    // 1. Explicit recorded advance_paid amount
    const advPaid = Number(o.advance_paid) || 0;
    if (advPaid > 0) return advPaid;

    // 2. Full online payment: full total captured upfront as advance/paid
    if (o.is_full_online_payment && (o.payment_status === "paid" || o.payment_status === "completed")) {
      return Number(o.total) || 0;
    }

    // 3. Recorded advance_amount if advance_payment_status is 'paid'
    if (o.advance_payment_status === "paid" && Number(o.advance_amount) > 0) {
      return Number(o.advance_amount);
    }

    // 4. Pure COD orders contribute 0 advance
    return 0;
  }

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

      // 2. Orders, Revenue, Today's Sales & Profit
      const { data: orders, error: oErr } = await client
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (orders) {
        if (elTotalOrders) elTotalOrders.textContent = orders.length;

        // Existing Total Sales / Gross Revenue (Preserved 100% unchanged)
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        if (elTotalRev) elTotalRev.textContent = formatINR(totalRevenue);

        // Date in India Standard Time
        const todayIST = getISTDateString(new Date());

        // Valid orders placed TODAY (combining Main VADI & Sarojini Bazaar)
        const todayValidOrders = orders.filter(o => {
          if (!o.created_at) return false;
          const isToday = getISTDateString(o.created_at) === todayIST;
          return isToday && !isOrderCancelledOrRefunded(o);
        });

        // Today's Sales: Sum of total for valid orders today
        const todaySales = todayValidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        if (elTodaySales) elTodaySales.textContent = formatINR(todaySales);

        // Profit: Sum of advance amount collected on valid orders today
        const todayProfit = todayValidOrders.reduce((sum, o) => sum + getOrderAdvancePaid(o), 0);
        if (elTodayProfit) elTodayProfit.textContent = formatINR(todayProfit);

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
                  <td><strong>${formatINR(o.total)}</strong></td>
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
      if (typeof window.showToast === "function") {
        window.showToast("Could not retrieve real-time statistics.", "error");
      }
    }
  }

  // Wire manual refresh button if present
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      const icon = btnRefresh.querySelector("i");
      if (icon) icon.classList.add("fa-spin");
      btnRefresh.disabled = true;
      await loadDashboardData();
      if (icon) icon.classList.remove("fa-spin");
      btnRefresh.disabled = false;
      if (typeof window.showToast === "function") {
        window.showToast("Dashboard metrics refreshed.", "success");
      }
    });
  }

  // Real-time listener for orders table changes
  if (client && typeof client.channel === "function") {
    try {
      const ordersChannel = client
        .channel("admin-dashboard-orders-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => {
            loadDashboardData();
          }
        )
        .subscribe();

      window.addEventListener("beforeunload", () => {
        try {
          client.removeChannel(ordersChannel);
        } catch (_) {}
      });
    } catch (e) {
      console.warn("Realtime subscription notice:", e);
    }
  }

  await loadDashboardData();
});
