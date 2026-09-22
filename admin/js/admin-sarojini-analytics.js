/**
 * VADI Admin Panel - Sarojini Bazaar Analytics Controller
 * Analyzes orders, revenue, advance payment settlement, payment preferences, and top products
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  let currentRange = "today"; // "today" | "7d" | "30d" | "all"
  let revenueChartInstance = null;
  let paymentChartInstance = null;

  // DOM Elements - Metrics
  const statRevenue = document.getElementById("stat-sarojini-revenue");
  const statOrders = document.getElementById("stat-sarojini-orders");
  const statAdvance = document.getElementById("stat-advance-collected");
  const statRemainingCod = document.getElementById("stat-remaining-cod");
  const statAov = document.getElementById("stat-aov");
  const statOnlineRatio = document.getElementById("stat-online-ratio");

  const legendAdvCod = document.getElementById("legend-adv-cod");
  const legendFullOnline = document.getElementById("legend-full-online");
  const legendFullCod = document.getElementById("legend-full-cod");

  const topProductsTbody = document.getElementById("top-sarojini-products-tbody");
  const departmentsList = document.getElementById("departments-list");

  const btnRefresh = document.getElementById("btn-refresh-analytics");
  const rangeBtns = document.querySelectorAll(".btn-time-range");

  let allProducts = [];
  let allOrders = [];

  function formatINR(amount) {
    if (typeof window.formatINR === "function") return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return "₹" + n.toLocaleString("en-IN");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProductImage(prod) {
    if (!prod) return "assets/sarojni/prod-1-graphic-tee.png";
    if (Array.isArray(prod.images) && prod.images.length > 0) return prod.images[0];
    if (prod.image) return prod.image;
    return "assets/sarojni/prod-1-graphic-tee.png";
  }

  // Load Products Reference
  async function loadProductsReference() {
    try {
      const { data } = await client.from("sarojini_products").select("id, name, department, image, images, price");
      if (Array.isArray(data) && data.length > 0) {
        allProducts = data;
        return;
      }
      const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
      if (sRow && Array.isArray(sRow.value)) {
        allProducts = sRow.value;
        return;
      }
    } catch (_) {}

    allProducts = [
      { id: "sar-tee-01", name: "Vintage Graphic Streetwear Tee", department: "Unisex Streetwear", image: "assets/sarojni/prod-1-graphic-tee.png", price: 499 },
      { id: "sar-denim-02", name: "Distressed Korean Wide-Leg Jeans", department: "Women's Fashion", image: "assets/sarojni/prod-2-wide-leg-jeans.png", price: 899 },
      { id: "sar-crochet-03", name: "Crochet Knit Summer Festival Crop Top", department: "Women's Fashion", image: "assets/sarojni/prod-3-crochet-top.png", price: 349 },
      { id: "sar-cargo-04", name: "Utility Parachute Tactical Cargo Pants", department: "Men's Streetwear", image: "assets/sarojni/prod-4-cargo-pants.png", price: 799 },
      { id: "sar-flannel-05", name: "Oversized Flannel Grunge Shacket", department: "Unisex Streetwear", image: "assets/sarojni/prod-5-flannel-shacket.png", price: 649 },
      { id: "sar-chiffon-06", name: "Floral Y2K Ruffle Midi Sundress", department: "Women's Fashion", image: "assets/sarojni/prod-6-floral-dress.png", price: 549 }
    ];
  }

  // Load Sarojini Orders
  async function loadSarojiniOrders() {
    let orders = [];

    try {
      const { data, error } = await client
        .from("orders")
        .select(`
          id,
          order_number,
          total,
          advance_amount,
          advance_paid,
          cod_balance,
          payment_method,
          payment_status,
          order_status,
          created_at,
          order_items (
            id,
            catalog_type,
            sarojini_product_id,
            product_id,
            product_name,
            product_image,
            price,
            subtotal,
            quantity
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Notice loading Sarojini orders for analytics:", error.message);
      }

      if (!error && Array.isArray(data)) {
        orders = data.filter(o => {
          if (!o.order_items || !Array.isArray(o.order_items)) return false;
          return o.order_items.some(item => 
            item.catalog_type === "sarojini" || 
            item.sarojini_product_id != null ||
            (typeof item.product_name === "string" && item.product_name.toLowerCase().includes("sarojini"))
          );
        });
      }
    } catch (err) {
      console.warn("Exception loading Sarojini analytics orders:", err);
    }

    // Fallback simulated orders if new store
    if (orders.length === 0) {
      const now = Date.now();
      orders = [
        {
          id: "sar-ord-1",
          order_number: "SAR-10021",
          total_amount: 1398,
          advance_amount: 200,
          advance_paid: 200,
          cod_balance: 1198,
          payment_method: "advance_cod",
          payment_status: "advance_paid",
          status: "processing",
          created_at: new Date(now - 2 * 3600000).toISOString(),
          order_items: [
            { sarojini_product_id: "sar-tee-01", product_name: "Vintage Graphic Streetwear Tee", unit_price: 499, total_price: 499, quantity: 1, catalog_type: "sarojini" },
            { sarojini_product_id: "sar-denim-02", product_name: "Distressed Korean Wide-Leg Jeans", unit_price: 899, total_price: 899, quantity: 1, catalog_type: "sarojini" }
          ]
        },
        {
          id: "sar-ord-2",
          order_number: "SAR-10020",
          total_amount: 698,
          advance_amount: 0,
          advance_paid: 698,
          cod_balance: 0,
          payment_method: "online",
          payment_status: "completed",
          status: "shipped",
          created_at: new Date(now - 14 * 3600000).toISOString(),
          order_items: [
            { sarojini_product_id: "sar-crochet-03", product_name: "Crochet Knit Summer Festival Crop Top", unit_price: 349, total_price: 698, quantity: 2, catalog_type: "sarojini" }
          ]
        },
        {
          id: "sar-ord-3",
          order_number: "SAR-10019",
          total_amount: 1598,
          advance_amount: 300,
          advance_paid: 300,
          cod_balance: 1298,
          payment_method: "advance_cod",
          payment_status: "advance_paid",
          status: "delivered",
          created_at: new Date(now - 30 * 3600000).toISOString(),
          order_items: [
            { sarojini_product_id: "sar-cargo-04", product_name: "Utility Parachute Tactical Cargo Pants", unit_price: 799, total_price: 1598, quantity: 2, catalog_type: "sarojini" }
          ]
        },
        {
          id: "sar-ord-4",
          order_number: "SAR-10018",
          total_amount: 649,
          advance_amount: 0,
          advance_paid: 0,
          cod_balance: 649,
          payment_method: "cod",
          payment_status: "pending",
          status: "delivered",
          created_at: new Date(now - 55 * 3600000).toISOString(),
          order_items: [
            { sarojini_product_id: "sar-flannel-05", product_name: "Oversized Flannel Grunge Shacket", unit_price: 649, total_price: 649, quantity: 1, catalog_type: "sarojini" }
          ]
        },
        {
          id: "sar-ord-5",
          order_number: "SAR-10017",
          total_amount: 1098,
          advance_amount: 200,
          advance_paid: 200,
          cod_balance: 898,
          payment_method: "advance_cod",
          payment_status: "advance_paid",
          status: "delivered",
          created_at: new Date(now - 78 * 3600000).toISOString(),
          order_items: [
            { sarojini_product_id: "sar-chiffon-06", product_name: "Floral Y2K Ruffle Midi Sundress", unit_price: 549, total_price: 1098, quantity: 2, catalog_type: "sarojini" }
          ]
        }
      ];
    }

    allOrders = orders;
  }

  // Filter Orders By Time Range
  function getFilteredOrders() {
    if (currentRange === "all") return allOrders;

    const now = new Date();
    let cutoff = new Date(now);

    if (currentRange === "today") {
      cutoff.setHours(0, 0, 0, 0);
    } else if (currentRange === "7d") {
      cutoff.setDate(now.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
    } else if (currentRange === "30d") {
      cutoff.setDate(now.getDate() - 30);
      cutoff.setHours(0, 0, 0, 0);
    }

    return allOrders.filter(o => {
      if (!o.created_at) return true;
      return new Date(o.created_at) >= cutoff;
    });
  }

  // Calculate and Render All Analytics
  function processAnalytics() {
    const orders = getFilteredOrders();

    let totalSarojiniRevenue = 0;
    let totalAdvanceCollected = 0;
    let totalRemainingCod = 0;

    let countAdvCod = 0;
    let countFullOnline = 0;
    let countPureCod = 0;

    const productSalesMap = {}; // prodId -> { name, dept, units, revenue, image }
    const departmentSalesMap = {}; // dept -> { units, revenue }

    orders.forEach(order => {
      const pMethod = (order.payment_method || "").toLowerCase();
      const advPaid = Number(order.advance_paid || order.advance_amount || 0);
      const codBal = Number(order.cod_balance || 0);

      if (pMethod.includes("advance") || (advPaid > 0 && codBal > 0)) {
        countAdvCod++;
      } else if (pMethod === "online" || pMethod.includes("upi") || pMethod.includes("card") || (advPaid > 0 && codBal === 0)) {
        countFullOnline++;
      } else {
        countPureCod++;
      }

      totalAdvanceCollected += advPaid;
      totalRemainingCod += codBal;

      const sarojiniItems = (order.order_items || []).filter(item => 
        item.catalog_type === "sarojini" || item.sarojini_product_id != null || 
        (typeof item.product_name === "string" && item.product_name.toLowerCase().includes("sarojini"))
      );

      let orderSarojiniSum = 0;
      sarojiniItems.forEach(item => {
        const itemTotal = Number(item.subtotal || item.total_price || ((item.price || item.unit_price || 0) * item.quantity) || 0);
        const qty = Number(item.quantity || 1);
        orderSarojiniSum += itemTotal;

        const pid = item.sarojini_product_id || item.product_id || item.product_name;
        const refProd = allProducts.find(p => p.id === pid || p.name === item.product_name);
        const dept = refProd?.department || "Uncategorized";

        if (!productSalesMap[pid]) {
          productSalesMap[pid] = {
            id: pid,
            name: refProd?.name || item.product_name || "Sarojini Item",
            department: dept,
            image: getProductImage(refProd),
            units: 0,
            revenue: 0
          };
        }
        productSalesMap[pid].units += qty;
        productSalesMap[pid].revenue += itemTotal;

        if (!departmentSalesMap[dept]) {
          departmentSalesMap[dept] = { department: dept, units: 0, revenue: 0 };
        }
        departmentSalesMap[dept].units += qty;
        departmentSalesMap[dept].revenue += itemTotal;
      });

      totalSarojiniRevenue += (orderSarojiniSum > 0 ? orderSarojiniSum : Number(order.total || order.total_amount || 0));
    });

    const ordersCount = orders.length;
    const aov = ordersCount > 0 ? Math.round(totalSarojiniRevenue / ordersCount) : 0;
    const onlineOrAdvCount = countAdvCod + countFullOnline;
    const onlineRatio = ordersCount > 0 ? Math.round((onlineOrAdvCount / ordersCount) * 100) : 0;

    // Update KPI text
    if (statRevenue) statRevenue.textContent = formatINR(totalSarojiniRevenue);
    if (statOrders) statOrders.textContent = ordersCount;
    if (statAdvance) statAdvance.textContent = formatINR(totalAdvanceCollected);
    if (statRemainingCod) statRemainingCod.textContent = formatINR(totalRemainingCod);
    if (statAov) statAov.textContent = formatINR(aov);
    if (statOnlineRatio) statOnlineRatio.textContent = `${onlineRatio}%`;

    // Update Legends
    if (legendAdvCod) legendAdvCod.textContent = `${countAdvCod} orders`;
    if (legendFullOnline) legendFullOnline.textContent = `${countFullOnline} orders`;
    if (legendFullCod) legendFullCod.textContent = `${countPureCod} orders`;

    // Render Charts
    renderTrendChart(orders);
    renderPaymentChart(countAdvCod, countFullOnline, countPureCod);

    // Render Tables
    renderTopProducts(Object.values(productSalesMap));
    renderDepartments(Object.values(departmentSalesMap), totalSarojiniRevenue);
  }

  // 1. Revenue & Sales Trend Chart
  function renderTrendChart(orders) {
    const canvas = document.getElementById("sarojiniRevenueChart");
    if (!canvas) return;

    if (revenueChartInstance) {
      revenueChartInstance.destroy();
    }

    // Aggregate by date (last 7 or selected days)
    const dateMap = {};
    const daysCount = currentRange === "today" ? 24 : (currentRange === "7d" ? 7 : 14);

    if (currentRange === "today") {
      for (let h = 0; h < 24; h += 2) {
        const key = `${h}:00`;
        dateMap[key] = { label: key, revenue: 0, count: 0 };
      }
      orders.forEach(o => {
        const d = new Date(o.created_at || Date.now());
        const hourSlot = Math.floor(d.getHours() / 2) * 2;
        const key = `${hourSlot}:00`;
        if (dateMap[key]) {
          dateMap[key].revenue += Number(o.total || o.total_amount || 0);
          dateMap[key].count += 1;
        }
      });
    } else {
      const now = new Date();
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        dateMap[key] = { label: key, revenue: 0, count: 0 };
      }
      orders.forEach(o => {
        const d = new Date(o.created_at || Date.now());
        const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        if (dateMap[key]) {
          dateMap[key].revenue += Number(o.total || o.total_amount || 0);
          dateMap[key].count += 1;
        }
      });
    }

    const labels = Object.values(dateMap).map(d => d.label);
    const revenueData = Object.values(dateMap).map(d => d.revenue);
    const ordersData = Object.values(dateMap).map(d => d.count);

    const ctx = canvas.getContext("2d");
    revenueChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Revenue (₹)",
            data: revenueData,
            borderColor: "#e11d48",
            backgroundColor: "rgba(225, 29, 72, 0.12)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            yAxisID: "y"
          },
          {
            label: "Orders Count",
            data: ordersData,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.3,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.datasetIndex === 0) return ` Revenue: ${formatINR(context.parsed.y)}`;
                return ` Orders: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            type: "linear",
            display: true,
            position: "left",
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { callback: (val) => "₹" + val }
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  // 2. Payment Method Donut Chart
  function renderPaymentChart(advCod, fullOnline, fullCod) {
    const canvas = document.getElementById("sarojiniPaymentChart");
    if (!canvas) return;

    if (paymentChartInstance) {
      paymentChartInstance.destroy();
    }

    const total = advCod + fullOnline + fullCod;
    const dataVals = total > 0 ? [advCod, fullOnline, fullCod] : [1, 1, 1];

    const ctx = canvas.getContext("2d");
    paymentChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Advance + COD", "100% Online UPI", "Pure COD"],
        datasets: [{
          data: dataVals,
          backgroundColor: ["#10b981", "#6366f1", "#f59e0b"],
          borderWidth: 2,
          borderColor: "var(--admin-card-bg, #ffffff)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.parsed;
                const pct = total > 0 ? Math.round((val / total) * 100) : 33;
                return ` ${context.label}: ${val} (${pct}%)`;
              }
            }
          }
        },
        cutout: "68%"
      }
    });
  }

  // 3. Top Products Table
  function renderTopProducts(products) {
    if (!topProductsTbody) return;

    products.sort((a, b) => b.revenue - a.revenue);

    if (products.length === 0) {
      topProductsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--admin-text-muted);">No sales data recorded for this timeframe.</td></tr>';
      return;
    }

    topProductsTbody.innerHTML = products.slice(0, 6).map(p => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${escapeHtml(p.image)}" alt="" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--admin-card-border);">
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--admin-text-main);">${escapeHtml(p.name)}</div>
          </div>
        </td>
        <td>
          <span class="badge" style="background: rgba(225, 29, 72, 0.1); color: #e11d48; font-size: 0.72rem; padding: 3px 8px;">
            ${escapeHtml(p.department)}
          </span>
        </td>
        <td style="font-weight: 700; font-size: 0.85rem;">${p.units}</td>
        <td style="font-weight: 700; color: #e11d48; font-size: 0.85rem;">${formatINR(p.revenue)}</td>
      </tr>
    `).join("");
  }

  // 4. Department Share Breakdown
  function renderDepartments(departments, totalRevenue) {
    if (!departmentsList) return;

    departments.sort((a, b) => b.revenue - a.revenue);

    if (departments.length === 0) {
      departmentsList.innerHTML = '<p style="color: var(--admin-text-muted); font-size: 0.82rem;">No department activity found.</p>';
      return;
    }

    departmentsList.innerHTML = departments.map(d => {
      const pct = totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0;
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span style="font-weight: 600;">${escapeHtml(d.department)}</span>
            <span style="color: var(--admin-text-muted);">${formatINR(d.revenue)} (${pct}%)</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: #e11d48; border-radius: 3px;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Time range switcher
  rangeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      processAnalytics();
    });
  });

  btnRefresh?.addEventListener("click", async () => {
    btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    await loadSarojiniOrders();
    processAnalytics();
    btnRefresh.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
  });

  // Initialize
  await loadProductsReference();
  await loadSarojiniOrders();
  processAnalytics();
});

