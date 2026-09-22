/**
 * VADI Admin Panel - Sarojini Dashboard Controller
 * Computes metrics strictly from Sarojini data (revenue, orders, active inventory, stock health, categories)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  const statRevenue = document.getElementById("stat-sarojini-revenue");
  const statOrders = document.getElementById("stat-sarojini-orders");
  const statActiveProducts = document.getElementById("stat-active-products");
  const statLowStock = document.getElementById("stat-low-stock");
  const statCategories = document.getElementById("stat-total-categories");
  const recentOrdersTbody = document.getElementById("recent-orders-tbody");

  // Pipeline elements
  const pipePlaced = document.getElementById("pipe-placed");
  const pipeProcessing = document.getElementById("pipe-processing");
  const pipeShipped = document.getElementById("pipe-shipped");
  const pipeDelivered = document.getElementById("pipe-delivered");
  const pipeIssues = document.getElementById("pipe-issues");

  function formatINR(amount) {
    if (typeof window.formatINR === 'function') return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  async function loadDashboardMetrics() {
    try {
      // 1. Fetch Orders and calculate Sarojini revenue & orders count
      let sarojiniOrders = [];
      let sarojiniRevenue = 0;

      let countPlaced = 0;
      let countProcessing = 0;
      let countShipped = 0;
      let countDelivered = 0;
      let countIssues = 0;

      try {
        const { data: orders, error: ordersErr } = await client
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false });

        if (!ordersErr && Array.isArray(orders)) {
          sarojiniOrders = orders.filter(o => {
            if (!Array.isArray(o.order_items)) return false;
            return o.order_items.some(it => it.catalog_type === 'sarojini' || it.sarojini_product_id);
          });

          sarojiniOrders.forEach(o => {
            const st = (o.order_status || 'placed').toLowerCase();
            if (st === 'placed' || st === 'confirmed') countPlaced++;
            else if (st === 'processing') countProcessing++;
            else if (st === 'shipped') countShipped++;
            else if (st === 'delivered') countDelivered++;
            else if (st === 'cancelled' || st === 'returned' || st.includes('request')) countIssues++;

            // Count revenue for non-cancelled orders
            if (o.order_status !== 'cancelled') {
              (o.order_items || []).forEach(it => {
                if (it.catalog_type === 'sarojini' || it.sarojini_product_id) {
                  const price = Number(it.price || it.unit_price || 0);
                  const qty = Number(it.quantity || 1);
                  sarojiniRevenue += price * qty;
                }
              });
            }
          });
        }
      } catch (err) {
        console.warn("Orders fetch exception:", err);
      }

      // 2. Fetch Sarojini Products
      let sarojiniProducts = [];
      try {
        const { data: prods, error: prodsErr } = await client
          .from("sarojini_products")
          .select("*");

        if (!prodsErr && Array.isArray(prods)) {
          sarojiniProducts = prods;
        } else {
          // Fallback to store_settings
          const { data: setting } = await client
            .from("store_settings")
            .select("value")
            .eq("key", "sarojini_products")
            .maybeSingle();

          if (setting && Array.isArray(setting.value)) {
            sarojiniProducts = setting.value;
          }
        }
      } catch (err) {
        console.warn("Products fetch exception:", err);
      }

      // 3. Fetch Sarojini Categories
      let sarojiniCategories = [];
      try {
        const { data: cats, error: catsErr } = await client
          .from("sarojini_categories")
          .select("*");

        if (!catsErr && Array.isArray(cats)) {
          sarojiniCategories = cats;
        } else {
          // Fallback to store_settings
          const { data: setting } = await client
            .from("store_settings")
            .select("value")
            .eq("key", "sarojini_categories")
            .maybeSingle();

          if (setting && Array.isArray(setting.value)) {
            sarojiniCategories = setting.value;
          }
        }
      } catch (err) {
        console.warn("Categories fetch exception:", err);
      }

      // Compute stats
      const activeCount = sarojiniProducts.filter(p => p.is_active !== false && p.status !== 'inactive').length;
      const lowStockCount = sarojiniProducts.filter(p => {
        const s = Number(p.stock ?? 10);
        return s <= 5;
      }).length;

      // Update Metric Cards
      if (statRevenue) statRevenue.textContent = formatINR(sarojiniRevenue);
      if (statOrders) statOrders.textContent = sarojiniOrders.length;
      if (statActiveProducts) statActiveProducts.textContent = activeCount;
      if (statLowStock) statLowStock.textContent = lowStockCount;
      if (statCategories) statCategories.textContent = sarojiniCategories.length;

      // Update Pipeline Counters
      if (pipePlaced) pipePlaced.textContent = countPlaced;
      if (pipeProcessing) pipeProcessing.textContent = countProcessing;
      if (pipeShipped) pipeShipped.textContent = countShipped;
      if (pipeDelivered) pipeDelivered.textContent = countDelivered;
      if (pipeIssues) pipeIssues.textContent = countIssues;

      // Render Recent Orders Table
      renderRecentOrders(sarojiniOrders.slice(0, 5));

    } catch (err) {
      console.error("Failed to load Sarojini dashboard metrics:", err);
      if (recentOrdersTbody) {
        recentOrdersTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--admin-danger); padding: 20px;">Failed to load metrics: ${err.message}</td></tr>`;
      }
    }
  }

  function renderRecentOrders(recent) {
    if (!recentOrdersTbody) return;

    if (!recent || recent.length === 0) {
      recentOrdersTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 32px 16px; color: var(--admin-text-muted);">
            <div style="font-size: 1.8rem; margin-bottom: 6px;">🛍️</div>
            <p style="margin: 0; font-size: 0.85rem;">No recent Sarojini orders found.</p>
          </td>
        </tr>
      `;
      return;
    }

    recentOrdersTbody.innerHTML = recent.map(o => {
      const sItems = (o.order_items || []).filter(it => it.catalog_type === 'sarojini' || it.sarojini_product_id);
      const firstItem = sItems[0] || {};
      const extraCount = sItems.length > 1 ? ` +${sItems.length - 1} more` : '';

      const status = (o.order_status || 'placed').toLowerCase();
      let statusBadge = `<span class="badge badge-info">${status}</span>`;
      if (status === 'delivered') statusBadge = `<span class="badge badge-success">Delivered</span>`;
      else if (status === 'shipped') statusBadge = `<span class="badge badge-primary">Shipped</span>`;
      else if (status === 'processing') statusBadge = `<span class="badge badge-info">Processing</span>`;
      else if (status === 'confirmed') statusBadge = `<span class="badge badge-warning">Confirmed</span>`;
      else if (status === 'cancelled') statusBadge = `<span class="badge badge-danger">Cancelled</span>`;
      else if (status.includes('request')) statusBadge = `<span class="badge badge-warning">${status.replace('_', ' ')}</span>`;

      return `
        <tr>
          <td>
            <a href="order-details.html?id=${o.id}" style="color: #e11d48; font-family: monospace; font-size: 0.88rem; font-weight: 700; text-decoration: underline;" title="View Order Details">
              ${o.order_number || ('#' + (o.id || '').substring(0, 8))}
            </a>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.85rem;">${o.delivery_full_name || 'Customer'}</div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${o.delivery_phone || ''}</div>
          </td>
          <td>
            <div style="font-size: 0.83rem; font-weight: 500;">${firstItem.product_name || firstItem.product_title || 'Sarojini Product'}${extraCount}</div>
            <div style="font-size: 0.74rem; color: #e11d48; font-weight: 700;">🛍️ Sarojini Item</div>
          </td>
          <td style="font-weight: 700; color: #fff;">${formatINR(o.total || o.total_amount || 0)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join("");
  }

  // Initial load
  loadDashboardMetrics();
});

