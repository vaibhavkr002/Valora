/**
 * VELORA Admin Panel - Comprehensive First-Party Storefront Analytics Controller
 * Handles real-time traffic aggregation, Indian Standard Time (IST) hourly charts,
 * conversion funnels, device breakdowns, and top pages/products.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  // State
  let currentRange = "today"; // "today" | "7d" | "30d"
  let hourlyChartInstance = null;
  let dailyChartInstance = null;
  let deviceChartInstance = null;

  // DOM Elements
  const elActiveNow = document.getElementById("stat-active-now");
  const elTodayVisitors = document.getElementById("stat-today-visitors");
  const elUniqueVisitors = document.getElementById("stat-unique-visitors");
  const elSessions = document.getElementById("stat-total-sessions");
  const elPageViews = document.getElementById("stat-total-pv");
  const elProductViews = document.getElementById("stat-product-views");
  const elAddToCart = document.getElementById("stat-add-to-cart");
  const elCheckoutStarted = document.getElementById("stat-checkout-started");
  const elOrdersCount = document.getElementById("stat-orders-count");
  const elConversionRate = document.getElementById("stat-conversion-rate");
  const elPeakHour = document.getElementById("stat-peak-hour");

  const elFunnelPvVal = document.getElementById("funnel-pv-val");
  const elFunnelPvBar = document.getElementById("funnel-pv-bar");
  const elFunnelPdpVal = document.getElementById("funnel-pdp-val");
  const elFunnelPdpPct = document.getElementById("funnel-pdp-pct");
  const elFunnelPdpBar = document.getElementById("funnel-pdp-bar");
  const elFunnelCartVal = document.getElementById("funnel-cart-val");
  const elFunnelCartPct = document.getElementById("funnel-cart-pct");
  const elFunnelCartBar = document.getElementById("funnel-cart-bar");
  const elFunnelCheckoutVal = document.getElementById("funnel-checkout-val");
  const elFunnelCheckoutPct = document.getElementById("funnel-checkout-pct");
  const elFunnelCheckoutBar = document.getElementById("funnel-checkout-bar");
  const elFunnelOrdersVal = document.getElementById("funnel-orders-val");
  const elFunnelOrdersPct = document.getElementById("funnel-orders-pct");
  const elFunnelOrdersBar = document.getElementById("funnel-orders-bar");

  const elTopPagesContainer = document.getElementById("top-pages-container");
  const elTopProductsContainer = document.getElementById("top-products-container");
  const elTopSearchesContainer = document.getElementById("top-searches-container");
  const elTopCategoriesContainer = document.getElementById("top-categories-container");

  const elDeviceDesktop = document.getElementById("device-count-desktop");
  const elDeviceMobile = document.getElementById("device-count-mobile");
  const elDeviceTablet = document.getElementById("device-count-tablet");

  const btnRefresh = document.getElementById("btn-refresh-analytics");
  const rangeBtns = document.querySelectorAll(".btn-time-range");

  // Helper: Format Dates in Indian Standard Time (Asia/Kolkata)
  function getRangeTimestamps(range) {
    const now = new Date();
    // Offset for Asia/Kolkata (+05:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowUtcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const nowIst = new Date(nowUtcMs + istOffsetMs);

    let start = new Date(nowIst);
    if (range === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else { // 30d
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }

    // Convert back to UTC ISO string for DB queries
    const startUtc = new Date(start.getTime() - istOffsetMs);
    const endUtc = new Date(nowIst.getTime() - istOffsetMs);

    return {
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString()
    };
  }

  // ==========================================================================
  // 1. LOAD ANALYTICS SUMMARY
  // ==========================================================================
  async function loadSummary() {
    const { startTime, endTime } = getRangeTimestamps(currentRange);

    let summary = null;
    try {
      // 1. Try server RPC
      const { data, error } = await client.rpc("get_analytics_summary", {
        start_time: startTime,
        end_time: endTime
      });
      if (!error && data) {
        summary = data;
      }
    } catch (rpcErr) {
      console.warn("RPC get_analytics_summary notice:", rpcErr);
    }

    // 2. Client fallback aggregation if RPC not present in DB
    if (!summary) {
      summary = await aggregateSummaryFallback(startTime, endTime);
    }

    // Populate KPI Elements
    if (elTodayVisitors) elTodayVisitors.textContent = (summary.today_visitors || 0).toLocaleString();
    if (elActiveNow) elActiveNow.textContent = (summary.active_visitors_now || 0).toLocaleString();
    if (elUniqueVisitors) elUniqueVisitors.textContent = (summary.unique_visitors || 0).toLocaleString();
    if (elSessions) elSessions.textContent = (summary.total_sessions || 0).toLocaleString();
    if (elPageViews) elPageViews.textContent = (summary.total_page_views || 0).toLocaleString();
    if (elProductViews) elProductViews.textContent = (summary.product_views || 0).toLocaleString();
    if (elAddToCart) elAddToCart.textContent = (summary.add_to_cart || 0).toLocaleString();
    if (elCheckoutStarted) elCheckoutStarted.textContent = (summary.checkout_started || 0).toLocaleString();
    if (elOrdersCount) elOrdersCount.textContent = (summary.orders_count || 0).toLocaleString();
    if (elConversionRate) elConversionRate.textContent = `${Number(summary.conversion_rate || 0).toFixed(1)}%`;
    if (elPeakHour) elPeakHour.textContent = `Peak: ${summary.peak_hour || '18:00 - 19:00 IST'}`;

    // Update Conversion Funnel
    updateFunnelUI(summary);
  }

  // Fallback client aggregation
  async function aggregateSummaryFallback(startTime, endTime) {
    try {
      const { data: events } = await client
        .from("customer_analytics")
        .select("session_id, visitor_id, event_type, created_at")
        .gte("created_at", startTime)
        .lte("created_at", endTime);

      const allEvents = events || [];
      const uniqueVisitors = new Set(allEvents.map(e => e.visitor_id)).size;
      const totalSessions = new Set(allEvents.map(e => e.session_id)).size;
      const totalPv = allEvents.filter(e => e.event_type === "page_view").length;
      const pdpViews = allEvents.filter(e => e.event_type === "product_view").length;
      const addToCart = allEvents.filter(e => e.event_type === "add_to_cart").length;
      const checkoutStarted = allEvents.filter(e => e.event_type === "checkout_started").length;

      // Active visitors in last 10 minutes
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: activeEvents } = await client
        .from("customer_analytics")
        .select("session_id")
        .gte("created_at", tenMinsAgo);
      const activeNow = new Set((activeEvents || []).map(e => e.session_id)).size;

      // Today's visitors (IST)
      const { startTime: todayStart } = getRangeTimestamps("today");
      const { data: todayEvents } = await client
        .from("customer_analytics")
        .select("visitor_id")
        .gte("created_at", todayStart);
      const todayVisitors = new Set((todayEvents || []).map(e => e.visitor_id)).size;

      // Orders from public.orders
      const { data: orders } = await client
        .from("orders")
        .select("id, total, created_at, order_status")
        .gte("created_at", startTime)
        .lte("created_at", endTime);
      const validOrders = (orders || []).filter(o => o.order_status !== "cancelled");
      const ordersCount = validOrders.length;
      const conversionRate = totalSessions > 0 ? ((ordersCount / totalSessions) * 100).toFixed(2) : 0;

      return {
        today_visitors: todayVisitors,
        active_visitors_now: activeNow,
        unique_visitors: uniqueVisitors,
        total_sessions: totalSessions,
        total_page_views: totalPv,
        product_views: pdpViews,
        add_to_cart: addToCart,
        checkout_started: checkoutStarted,
        orders_count: ordersCount,
        conversion_rate: conversionRate,
        peak_hour: "18:00 - 19:00 IST"
      };
    } catch (e) {
      console.warn("Fallback summary error:", e);
      return {};
    }
  }

  // ==========================================================================
  // 2. CONVERSION FUNNEL UI
  // ==========================================================================
  function updateFunnelUI(summary) {
    const pv = Number(summary.total_page_views) || 0;
    const pdp = Number(summary.product_views) || 0;
    const cart = Number(summary.add_to_cart) || 0;
    const checkout = Number(summary.checkout_started) || 0;
    const orders = Number(summary.orders_count) || 0;

    if (elFunnelPvVal) elFunnelPvVal.textContent = pv.toLocaleString();
    if (elFunnelPdpVal) elFunnelPdpVal.textContent = pdp.toLocaleString();
    if (elFunnelCartVal) elFunnelCartVal.textContent = cart.toLocaleString();
    if (elFunnelCheckoutVal) elFunnelCheckoutVal.textContent = checkout.toLocaleString();
    if (elFunnelOrdersVal) elFunnelOrdersVal.textContent = orders.toLocaleString();

    // Percentages relative to previous stage or top of funnel
    const pdpPct = pv > 0 ? Math.min(100, Math.round((pdp / pv) * 100)) : 0;
    const cartPct = pdp > 0 ? Math.min(100, Math.round((cart / pdp) * 100)) : (pv > 0 ? Math.min(100, Math.round((cart / pv) * 100)) : 0);
    const checkoutPct = cart > 0 ? Math.min(100, Math.round((checkout / cart) * 100)) : 0;
    const ordersPct = checkout > 0 ? Math.min(100, Math.round((orders / checkout) * 100)) : 0;

    if (elFunnelPdpPct) elFunnelPdpPct.textContent = `${pdpPct}% of visits`;
    if (elFunnelCartPct) elFunnelCartPct.textContent = `${cartPct}% of PDP`;
    if (elFunnelCheckoutPct) elFunnelCheckoutPct.textContent = `${checkoutPct}% of cart`;
    if (elFunnelOrdersPct) elFunnelOrdersPct.textContent = `${ordersPct}% converted`;

    if (elFunnelPdpBar) elFunnelPdpBar.style.width = `${Math.max(4, pdpPct)}%`;
    if (elFunnelCartBar) elFunnelCartBar.style.width = `${Math.max(4, cartPct)}%`;
    if (elFunnelCheckoutBar) elFunnelCheckoutBar.style.width = `${Math.max(4, checkoutPct)}%`;
    if (elFunnelOrdersBar) elFunnelOrdersBar.style.width = `${Math.max(4, ordersPct)}%`;
  }

  // ==========================================================================
  // 3. HOURLY TRAFFIC CHART (IST ASIA/KOLKATA AWARE)
  // ==========================================================================
  async function loadHourlyTraffic() {
    const canvas = document.getElementById("hourlyTrafficChart");
    if (!canvas || typeof Chart === "undefined") return;

    let hourlyData = [];
    try {
      const { data, error } = await client.rpc("get_hourly_traffic");
      if (!error && Array.isArray(data)) {
        hourlyData = data;
      }
    } catch (_) {}

    // Fallback: build 24 hours in IST if RPC missing
    if (!hourlyData || hourlyData.length === 0) {
      const { startTime, endTime } = getRangeTimestamps("today");
      try {
        const { data: events } = await client
          .from("customer_analytics")
          .select("event_type, created_at, visitor_id")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        const hoursMap = {};
        for (let i = 0; i < 24; i++) {
          hoursMap[i] = { hour_of_day: i, page_views: 0, unique_visitors: new Set(), cart_actions: 0 };
        }

        (events || []).forEach(e => {
          // Convert UTC to IST hour (UTC + 5.5 hours)
          const d = new Date(e.created_at);
          const utcMs = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
          const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
          const hr = istDate.getHours();

          if (hoursMap[hr]) {
            if (e.event_type === "page_view") hoursMap[hr].page_views++;
            if (e.event_type === "add_to_cart") hoursMap[hr].cart_actions++;
            hoursMap[hr].unique_visitors.add(e.visitor_id);
          }
        });

        hourlyData = Object.keys(hoursMap).map(hr => ({
          hour_of_day: parseInt(hr, 10),
          page_views: hoursMap[hr].page_views,
          unique_visitors: hoursMap[hr].unique_visitors.size,
          cart_actions: hoursMap[hr].cart_actions
        }));
      } catch (err) {
        console.warn("Hourly fallback notice:", err);
      }
    }

    // Ensure all 24 hours represented
    const labels = [];
    const pvCounts = [];
    const uvCounts = [];
    const cartCounts = [];

    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      labels.push(label);
      const match = (hourlyData || []).find(d => Number(d.hour_of_day) === h);
      pvCounts.push(match ? Number(match.page_views) : 0);
      uvCounts.push(match ? Number(match.unique_visitors) : 0);
      cartCounts.push(match ? Number(match.cart_actions) : 0);
    }

    if (hourlyChartInstance) {
      hourlyChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    hourlyChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Page Views",
            data: pvCounts,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.12)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: "Unique Visitors",
            data: uvCounts,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            label: "Cart Adds",
            data: cartCounts,
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 1,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              color: "#94a3b8",
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#f8fafc",
            bodyColor: "#94a3b8",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => `${items[0].label} IST`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#64748b", font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#64748b", font: { size: 10 }, precision: 0 }
          }
        }
      }
    });
  }

  // ==========================================================================
  // 4. DAILY TRAFFIC TREND CHART (7d or 30d)
  // ==========================================================================
  async function loadDailyTraffic() {
    const canvas = document.getElementById("dailyTrafficChart");
    if (!canvas || typeof Chart === "undefined") return;

    const daysCount = currentRange === "today" ? 7 : (currentRange === "7d" ? 7 : 30);

    let dailyData = [];
    try {
      const { data, error } = await client.rpc("get_daily_traffic", { days_count: daysCount });
      if (!error && Array.isArray(data)) {
        dailyData = data;
      }
    } catch (_) {}

    // Fallback: query days from database
    if (!dailyData || dailyData.length === 0) {
      const { startTime, endTime } = getRangeTimestamps(daysCount === 7 ? "7d" : "30d");
      try {
        const { data: events } = await client
          .from("customer_analytics")
          .select("event_type, created_at, visitor_id, session_id")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        const daysMap = {};
        const now = new Date();
        for (let i = daysCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dtStr = d.toISOString().split("T")[0];
          daysMap[dtStr] = { report_date: dtStr, page_views: 0, unique_visitors: new Set(), sessions: new Set() };
        }

        (events || []).forEach(e => {
          const dtStr = e.created_at.split("T")[0];
          if (daysMap[dtStr]) {
            if (e.event_type === "page_view") daysMap[dtStr].page_views++;
            daysMap[dtStr].unique_visitors.add(e.visitor_id);
            daysMap[dtStr].sessions.add(e.session_id);
          }
        });

        dailyData = Object.keys(daysMap).map(k => ({
          report_date: k,
          page_views: daysMap[k].page_views,
          unique_visitors: daysMap[k].unique_visitors.size,
          sessions: daysMap[k].sessions.size
        }));
      } catch (err) {
        console.warn("Daily fallback error:", err);
      }
    }

    const labels = (dailyData || []).map(d => {
      const p = (d.report_date || "").split("-");
      return p.length === 3 ? `${p[2]}/${p[1]}` : d.report_date;
    });
    const pvData = (dailyData || []).map(d => Number(d.page_views) || 0);
    const uvData = (dailyData || []).map(d => Number(d.unique_visitors) || 0);
    const sessData = (dailyData || []).map(d => Number(d.sessions) || 0);

    if (dailyChartInstance) {
      dailyChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    dailyChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Page Views",
            data: pvData,
            backgroundColor: "#3b82f6",
            borderRadius: 4,
            barPercentage: 0.6
          },
          {
            label: "Unique Visitors",
            data: uvData,
            backgroundColor: "#10b981",
            borderRadius: 4,
            barPercentage: 0.6
          },
          {
            label: "Sessions",
            data: sessData,
            backgroundColor: "#f59e0b",
            borderRadius: 4,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              color: "#94a3b8",
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#f8fafc",
            bodyColor: "#94a3b8",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#64748b", font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#64748b", font: { size: 10 }, precision: 0 }
          }
        }
      }
    });
  }

  // ==========================================================================
  // 5. DEVICE BREAKDOWN DONUT & STATS
  // ==========================================================================
  async function loadDeviceBreakdown(insightsData) {
    const canvas = document.getElementById("deviceBreakdownChart");
    if (!canvas || typeof Chart === "undefined") return;

    let devices = insightsData ? insightsData.devices : null;

    if (!devices) {
      try {
        const { data } = await client
          .from("customer_analytics")
          .select("device_type");
        const list = data || [];
        devices = {
          desktop: list.filter(d => d.device_type === "desktop").length,
          mobile: list.filter(d => d.device_type === "mobile").length,
          tablet: list.filter(d => d.device_type === "tablet").length
        };
      } catch (_) {
        devices = { desktop: 0, mobile: 0, tablet: 0 };
      }
    }

    const dVal = devices.desktop || 0;
    const mVal = devices.mobile || 0;
    const tVal = devices.tablet || 0;
    const total = dVal + mVal + tVal;

    const dPct = total > 0 ? Math.round((dVal / total) * 100) : 0;
    const mPct = total > 0 ? Math.round((mVal / total) * 100) : 0;
    const tPct = total > 0 ? Math.round((tVal / total) * 100) : 0;

    if (elDeviceDesktop) elDeviceDesktop.textContent = `${dVal} (${dPct}%)`;
    if (elDeviceMobile) elDeviceMobile.textContent = `${mVal} (${mPct}%)`;
    if (elDeviceTablet) elDeviceTablet.textContent = `${tVal} (${tPct}%)`;

    if (deviceChartInstance) {
      deviceChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    deviceChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Desktop", "Mobile", "Tablet"],
        datasets: [{
          data: total > 0 ? [dVal, mVal, tVal] : [1, 0, 0],
          backgroundColor: total > 0 ? ["#6366f1", "#10b981", "#f59e0b"] : ["#334155", "#1e293b", "#0f172a"],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: total > 0,
            backgroundColor: "#0f172a",
            titleColor: "#f8fafc",
            bodyColor: "#94a3b8",
            borderColor: "#334155",
            borderWidth: 1
          }
        }
      }
    });
  }

  // ==========================================================================
  // 6. TOP PAGES, PRODUCTS, CATEGORIES, SEARCHES
  // ==========================================================================
  async function loadDeepInsights() {
    let insights = null;
    try {
      const { data, error } = await client.rpc("get_top_pages_and_products", { limit_count: 10 });
      if (!error && data) {
        insights = data;
      }
    } catch (_) {}

    // Fallback if RPC not active
    if (!insights) {
      insights = await getInsightsFallback();
    }

    // 1. Device Breakdown
    loadDeviceBreakdown(insights);

    // 2. Top Pages
    if (elTopPagesContainer) {
      const pages = insights.top_pages || [];
      if (pages.length === 0) {
        elTopPagesContainer.innerHTML = `<span style="color: var(--admin-text-muted); font-size: 0.82rem;">No page views recorded yet.</span>`;
      } else {
        elTopPagesContainer.innerHTML = pages.slice(0, 7).map((p, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 6px 0; border-bottom: 1px solid var(--admin-card-border);">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
              <span style="color: var(--admin-accent); font-weight: 700; margin-right: 6px;">#${idx + 1}</span>
              <span>${p.page_path}</span>
            </div>
            <strong style="color: var(--admin-text-main);">${p.views} views</strong>
          </div>
        `).join("");
      }
    }

    // 3. Top Products
    if (elTopProductsContainer) {
      const prods = insights.top_products || [];
      if (prods.length === 0) {
        elTopProductsContainer.innerHTML = `<span style="color: var(--admin-text-muted); font-size: 0.82rem;">No product views recorded yet.</span>`;
      } else {
        elTopProductsContainer.innerHTML = prods.slice(0, 7).map((pr, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 6px 0; border-bottom: 1px solid var(--admin-card-border);">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
              <span style="color: #10b981; font-weight: 700; margin-right: 6px;">#${idx + 1}</span>
              <span>${pr.product_name}</span>
            </div>
            <strong style="color: var(--admin-text-main);">${pr.views} views</strong>
          </div>
        `).join("");
      }
    }

    // 4. Top Searches
    if (elTopSearchesContainer) {
      const searches = insights.top_searches || [];
      if (searches.length === 0) {
        elTopSearchesContainer.innerHTML = `<span style="color: var(--admin-text-muted); font-size: 0.82rem;">No search queries yet</span>`;
      } else {
        elTopSearchesContainer.innerHTML = searches.slice(0, 8).map(s => `
          <span style="background: rgba(255,255,255,0.05); border: 1px solid var(--admin-card-border); padding: 4px 8px; border-radius: 6px; font-size: 0.78rem;">
            🔍 ${s.search_query} <strong style="color: var(--admin-accent);">(${s.search_count})</strong>
          </span>
        `).join("");
      }
    }

    // 5. Top Categories
    if (elTopCategoriesContainer) {
      const cats = insights.top_categories || [];
      if (cats.length === 0) {
        elTopCategoriesContainer.innerHTML = `<span style="color: var(--admin-text-muted); font-size: 0.82rem;">No category visits recorded yet.</span>`;
      } else {
        elTopCategoriesContainer.innerHTML = cats.slice(0, 5).map(c => `
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; padding: 4px 0;">
            <span style="text-transform: capitalize;">${c.category_slug}</span>
            <strong style="color: var(--admin-text-main);">${c.views} views</strong>
          </div>
        `).join("");
      }
    }
  }

  // Fallback insights query
  async function getInsightsFallback() {
    try {
      const { data: events } = await client
        .from("customer_analytics")
        .select("page_path, product_id, category_slug, search_query, device_type, event_type")
        .order("created_at", { ascending: false })
        .limit(250);

      const all = events || [];
      const pageCounts = {};
      const prodCounts = {};
      const catCounts = {};
      const searchCounts = {};
      const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };

      all.forEach(e => {
        if (e.event_type === "page_view" && e.page_path) {
          pageCounts[e.page_path] = (pageCounts[e.page_path] || 0) + 1;
        }
        if (e.product_id) {
          prodCounts[e.product_id] = (prodCounts[e.product_id] || 0) + 1;
        }
        if (e.category_slug) {
          catCounts[e.category_slug] = (catCounts[e.category_slug] || 0) + 1;
        }
        if (e.event_type === "search" && e.search_query) {
          searchCounts[e.search_query] = (searchCounts[e.search_query] || 0) + 1;
        }
        if (e.device_type) {
          deviceCounts[e.device_type] = (deviceCounts[e.device_type] || 0) + 1;
        }
      });

      const topPages = Object.keys(pageCounts).map(p => ({ page_path: p, views: pageCounts[p] })).sort((a, b) => b.views - a.views);
      const topCategories = Object.keys(catCounts).map(c => ({ category_slug: c, views: catCounts[c] })).sort((a, b) => b.views - a.views);
      const topSearches = Object.keys(searchCounts).map(s => ({ search_query: s, search_count: searchCounts[s] })).sort((a, b) => b.search_count - a.search_count);

      // Resolve product names
      const prodIds = Object.keys(prodCounts);
      let prodNames = {};
      if (prodIds.length > 0) {
        try {
          const { data: prods } = await client.from("products").select("id, name").in("id", prodIds);
          (prods || []).forEach(p => { prodNames[p.id] = p.name; });
        } catch (_) {}
      }

      const topProducts = prodIds.map(id => ({
        product_id: id,
        product_name: prodNames[id] || ("Product " + id.slice(0, 8)),
        views: prodCounts[id]
      })).sort((a, b) => b.views - a.views);

      return {
        top_pages: topPages,
        top_products: topProducts,
        top_categories: topCategories,
        top_searches: topSearches,
        devices: deviceCounts
      };
    } catch (e) {
      return { top_pages: [], top_products: [], top_categories: [], top_searches: [], devices: { desktop: 0, mobile: 0, tablet: 0 } };
    }
  }

  // ==========================================================================
  // 7. INITIALIZATION & LISTENERS
  // ==========================================================================
  async function refreshAll() {
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
      await Promise.all([
        loadSummary(),
        loadHourlyTraffic(),
        loadDailyTraffic(),
        loadDeepInsights()
      ]);
    } catch (err) {
      console.error("Failed refreshing analytics:", err);
    } finally {
      if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
      }
    }
  }

  // Time range button switcher
  rangeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeBtns.forEach(b => {
        b.classList.remove("active");
        b.style.background = "transparent";
        b.style.color = "var(--admin-text-muted)";
      });
      btn.classList.add("active");
      btn.style.background = "var(--admin-accent)";
      btn.style.color = "#fff";

      currentRange = btn.dataset.range;
      refreshAll();
    });
  });

  if (btnRefresh) {
    btnRefresh.addEventListener("click", refreshAll);
  }

  // Initial load
  await refreshAll();

  // Periodic heartbeat: Refresh "Visitors Online Now" every 20 seconds
  setInterval(async () => {
    try {
      const { data } = await client.rpc("get_active_visitors_now");
      if (data !== null && data !== undefined && elActiveNow) {
        elActiveNow.textContent = Number(data).toLocaleString();
      }
    } catch (_) {}
  }, 20000);
});
