/**
 * VELORA Admin Panel - Returns & Refunds Controller
 * 
 * Authoritative 9-stage workflow management:
 * 1. RETURN_REQUESTED ➔ Admin Review
 * 2. RETURN_APPROVED ➔ Schedule Pickup (or RETURN_REJECTED)
 * 3. PICKUP_ASSIGNED ➔ Courier partner assigned
 * 4. RETURN_PICKED_UP ➔ Item picked up from customer
 * 5. RETURN_RECEIVED ➔ Item received at Valora warehouse
 * 6. RETURN_APPROVED_AFTER_INSPECTION (7-check verification) or RETURN_REJECTED_AFTER_INSPECTION
 * 7. APPROVE REFUND ➔ Only place Razorpay Refund API is called (or APPROVE REPLACEMENT)
 * 8. REFUND_INITIATED ➔ In gateway flight
 * 9. REFUND_COMPLETED ➔ Webhook / gateway settled
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("returns-tbody");
  const searchInput = document.getElementById("search-returns");
  const catalogFilter = document.getElementById("filter-catalog");
  const statusTabsContainer = document.getElementById("status-tabs-container");

  // State
  let allReturns = [];
  let allOrders = {};
  let deliveryPartners = [];
  let currentFilterStatus = "";
  let currentActiveReturn = null;
  let currentActiveOrder = null;

  window.closeAllModals = function() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.style.display = "none");
    currentActiveReturn = null;
    currentActiveOrder = null;
  };

  async function getAdminToken() {
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || "";
  }

  // ------------------------------------------------------------------------
  // Helper: Catalog Detection
  // ------------------------------------------------------------------------
  function getOrderCatalogInfo(order) {
    const items = order?.order_items || [];
    const hasSarojini = items.some(it => it.catalog_type === "sarojini" || it.sarojini_product_id != null);
    if (hasSarojini) {
      return {
        type: "sarojini",
        label: "SAROJINI BAZAAR",
        icon: "🛍️",
        badgeClass: "badge-danger"
      };
    }
    return {
      type: "main",
      label: "MAIN STORE",
      icon: "🏪",
      badgeClass: "badge-info"
    };
  }

  // ------------------------------------------------------------------------
  // Helper: Canonical Return Status Resolver
  // ------------------------------------------------------------------------
  function resolveReturnStatus(req, order) {
    const reqStatus = (req?.status || "").toUpperCase();
    const ordStatus = (order?.order_status || "").toUpperCase();
    const retWf = order?.tracking_data?.return_workflow || {};
    const wfStatus = (retWf.status || "").toUpperCase();

    if (ordStatus === "RETURNED" || req?.refund_status === "completed" || retWf.status === "REFUND_COMPLETED") {
      return "REFUND_COMPLETED";
    }
    if (ordStatus === "REFUND_INITIATED" || req?.refund_status === "initiated" || retWf.status === "REFUND_INITIATED") {
      return "REFUND_INITIATED";
    }
    if (ordStatus === "REPLACEMENT_APPROVED" || reqStatus === "REPLACEMENT_APPROVED" || retWf.status === "REPLACEMENT_APPROVED") {
      return "REPLACEMENT_APPROVED";
    }
    if (ordStatus === "RETURN_REJECTED_AFTER_INSPECTION" || reqStatus === "RETURN_REJECTED_AFTER_INSPECTION" || retWf.status === "RETURN_REJECTED_AFTER_INSPECTION") {
      return "RETURN_REJECTED_AFTER_INSPECTION";
    }
    if (ordStatus === "INSPECTION_APPROVED" || ordStatus === "RETURN_APPROVED_AFTER_INSPECTION" || reqStatus === "INSPECTION_APPROVED" || reqStatus === "RETURN_APPROVED_AFTER_INSPECTION" || retWf.status === "RETURN_APPROVED_AFTER_INSPECTION") {
      return "RETURN_APPROVED_AFTER_INSPECTION";
    }
    if (ordStatus === "RETURN_RECEIVED" || reqStatus === "RETURN_RECEIVED" || retWf.status === "RETURN_RECEIVED") {
      return "RETURN_RECEIVED";
    }
    if (ordStatus === "RETURN_PICKED_UP" || reqStatus === "RETURN_PICKED_UP" || retWf.status === "RETURN_PICKED_UP") {
      return "RETURN_PICKED_UP";
    }
    if (ordStatus === "PICKUP_ASSIGNED" || reqStatus === "PICKUP_ASSIGNED" || retWf.status === "PICKUP_ASSIGNED") {
      return "PICKUP_ASSIGNED";
    }
    if (ordStatus === "RETURN_APPROVED" || reqStatus === "RETURN_APPROVED" || retWf.status === "RETURN_APPROVED" || reqStatus === "APPROVED") {
      return "RETURN_APPROVED";
    }
    if (ordStatus === "RETURN_REJECTED" || reqStatus === "RETURN_REJECTED" || reqStatus === "REJECTED" || retWf.status === "RETURN_REJECTED") {
      return "RETURN_REJECTED";
    }

    return "RETURN_REQUESTED";
  }

  // ------------------------------------------------------------------------
  // Helper: Status Badge Formatter
  // ------------------------------------------------------------------------
  function getStatusBadge(status) {
    const map = {
      RETURN_REQUESTED: { label: "1. Return Requested", class: "status-requested", icon: "⏳" },
      RETURN_APPROVED: { label: "2. Return Approved", class: "status-approved", icon: "✓" },
      PICKUP_ASSIGNED: { label: "3. Pickup Assigned", class: "status-pickup", icon: "🚚" },
      RETURN_PICKED_UP: { label: "4. Return Picked Up", class: "status-in-transit", icon: "📦" },
      RETURN_RECEIVED: { label: "5. Received at Warehouse", class: "status-received", icon: "🏢" },
      RETURN_APPROVED_AFTER_INSPECTION: { label: "6. Inspection Passed", class: "status-inspected", icon: "🔍" },
      RETURN_REJECTED_AFTER_INSPECTION: { label: "Inspection Failed", class: "status-rejected", icon: "✕" },
      REFUND_INITIATED: { label: "7. Refund Initiated", class: "status-refund-initiated", icon: "💳" },
      REFUND_COMPLETED: { label: "8. Refund Completed", class: "status-refunded", icon: "💰" },
      RETURN_REJECTED: { label: "Return Rejected", class: "status-rejected", icon: "✕" },
      REPLACEMENT_APPROVED: { label: "Replacement Approved", class: "status-replacement", icon: "🔄" }
    };
    const s = map[status] || { label: status, class: "status-requested", icon: "•" };
    return `<span class="status-pill-badge ${s.class}">${s.icon} ${s.label}</span>`;
  }

  // ------------------------------------------------------------------------
  // Load Delivery Partners
  // ------------------------------------------------------------------------
  async function loadDeliveryPartners() {
    try {
      const { data } = await client.from("delivery_partners").select("*").eq("is_active", true).order("display_order", { ascending: true });
      if (Array.isArray(data) && data.length > 0) {
        deliveryPartners = data;
      } else {
        deliveryPartners = [
          { id: '1', name: 'Delhivery', slug: 'delhivery' },
          { id: '2', name: 'Ekart', slug: 'ekart' },
          { id: '3', name: 'Blue Dart', slug: 'bluedart' }
        ];
      }
    } catch (_) {
      deliveryPartners = [
        { id: '1', name: 'Delhivery', slug: 'delhivery' },
        { id: '2', name: 'Ekart', slug: 'ekart' }
      ];
    }
  }

  // ------------------------------------------------------------------------
  // Fetch Returns & Orders from Backend
  // ------------------------------------------------------------------------
  async function loadReturns() {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          <i class="fas fa-spinner fa-spin fa-2x" style="margin-bottom: 10px; display: block;"></i>
          Loading returns...
        </td>
      </tr>
    `;

    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "list" })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      allReturns = data.requests || [];
      allOrders = data.orders || {};

      updateMetrics();
      renderReturns();
    } catch (err) {
      console.warn("API list error, falling back to client queries:", err);
      // Fallback: direct client fetch
      try {
        const { data: reqs } = await client.from("order_requests").select("*").eq("request_type", "return").order("created_at", { ascending: false });
        allReturns = reqs || [];

        const orderIds = [...new Set(allReturns.map(r => r.order_id).filter(Boolean))];
        if (orderIds.length > 0) {
          const { data: ords } = await client.from("orders").select("*, order_items(*)").in("id", orderIds);
          (ords || []).forEach(o => { allOrders[o.id] = o; });
        }
        updateMetrics();
        renderReturns();
      } catch (fErr) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--admin-danger); padding: 30px;">Failed to load returns: ${fErr.message}</td></tr>`;
      }
    }
  }

  // ------------------------------------------------------------------------
  // Update Metrics Dashboard
  // ------------------------------------------------------------------------
  function updateMetrics() {
    let pendingCount = 0;
    let transitCount = 0;
    let awaitInspectCount = 0;
    let readyRefundCount = 0;
    let totalRefundedAmt = 0;

    allReturns.forEach(r => {
      const ord = allOrders[r.order_id];
      const st = resolveReturnStatus(r, ord);

      if (st === "RETURN_REQUESTED") pendingCount++;
      if (st === "PICKUP_ASSIGNED" || st === "RETURN_PICKED_UP") transitCount++;
      if (st === "RETURN_RECEIVED") awaitInspectCount++;
      if (st === "RETURN_APPROVED_AFTER_INSPECTION") readyRefundCount++;
      if (st === "REFUND_COMPLETED") {
        totalRefundedAmt += Number(ord?.refund_amount || r.refund_amount || 0);
      }
    });

    document.getElementById("metric-total-returns").textContent = allReturns.length;
    document.getElementById("metric-pending-review").textContent = pendingCount;
    document.getElementById("metric-in-transit").textContent = transitCount;
    document.getElementById("metric-awaiting-inspection").textContent = awaitInspectCount;
    document.getElementById("metric-ready-refund").textContent = readyRefundCount;
    document.getElementById("metric-total-refunded").textContent = window.formatINR(totalRefundedAmt);
  }

  // ------------------------------------------------------------------------
  // Render Returns Table
  // ------------------------------------------------------------------------
  function renderReturns() {
    let filtered = [...allReturns];
    const q = (searchInput?.value || "").trim().toLowerCase();
    const cat = catalogFilter?.value || "";

    if (q) {
      filtered = filtered.filter(r => {
        const ord = allOrders[r.order_id] || {};
        const matchOrder = ord.order_number && ord.order_number.toLowerCase().includes(q);
        const matchCustomer = (ord.delivery_full_name && ord.delivery_full_name.toLowerCase().includes(q)) ||
                              (ord.delivery_phone && ord.delivery_phone.includes(q)) ||
                              (ord.delivery_email && ord.delivery_email.toLowerCase().includes(q));
        const matchReason = r.reason && r.reason.toLowerCase().includes(q);
        const matchItem = Array.isArray(ord.order_items) && ord.order_items.some(it => it.product_name && it.product_name.toLowerCase().includes(q));
        return matchOrder || matchCustomer || matchReason || matchItem;
      });
    }

    if (cat) {
      filtered = filtered.filter(r => {
        const ord = allOrders[r.order_id];
        return getOrderCatalogInfo(ord).type === cat;
      });
    }

    if (currentFilterStatus) {
      filtered = filtered.filter(r => {
        const ord = allOrders[r.order_id];
        const st = resolveReturnStatus(r, ord).toLowerCase();
        if (currentFilterStatus === "refunded") {
          return st === "refund_completed" || st === "returned";
        }
        return st === currentFilterStatus;
      });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
            No returns found matching your filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const ord = allOrders[r.order_id] || {};
      const status = resolveReturnStatus(r, ord);
      const catInfo = getOrderCatalogInfo(ord);
      const items = ord.order_items || [];
      const item = items.find(it => it.id === r.order_item_id) || items[0] || {};

      const retWf = ord.tracking_data?.return_workflow || {};
      const dateStr = new Date(r.created_at || ord.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

      // Payment & Refund Calculation
      const hasAdv = Number(ord.advance_paid || ord.advance_amount || 0) > 0;
      const advAmt = Number(ord.advance_paid || ord.advance_amount || 0);
      const isOnline = Boolean(
        ord.is_full_online_payment ||
        (ord.payment_status === "paid" && !hasAdv && !ord.payment_method?.toLowerCase().includes("cash on delivery"))
      );
      const isPureCod = Boolean(ord.payment_method?.toLowerCase().includes("cash on delivery") && !hasAdv);

      let refundAmount = 0;
      let refundModeText = "";
      if (hasAdv) {
        refundAmount = advAmt;
        refundModeText = `<span style="color:#818cf8; font-weight:700;">Advance Online: ${window.formatINR(advAmt)}</span><br><span style="color:#d97706; font-size:0.74rem;">COD Balance: ${window.formatINR(ord.cod_balance || 0)} (No gateway refund)</span>`;
      } else if (isOnline) {
        refundAmount = Number(ord.total || 0);
        refundModeText = `<span style="color:#10b981; font-weight:700;">Full Online: ${window.formatINR(refundAmount)}</span>`;
      } else {
        refundAmount = 0;
        refundModeText = `<span style="color:#94a3b8; font-size:0.75rem;">100% COD (₹0 Online Paid)</span>`;
      }

      // Action Button Renderer based on stage
      let actionButtons = "";
      if (status === "RETURN_REQUESTED") {
        actionButtons = `
          <button class="btn-admin-primary btn-action-review" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem;">
            <i class="fas fa-tasks"></i> Review Request
          </button>
        `;
      } else if (status === "RETURN_APPROVED") {
        actionButtons = `
          <button class="btn-admin-secondary btn-action-pickup" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(14, 165, 233, 0.2); color: #38bdf8; border-color: rgba(14, 165, 233, 0.4);">
            <i class="fas fa-truck-fast"></i> Assign Pickup
          </button>
        `;
      } else if (status === "PICKUP_ASSIGNED") {
        actionButtons = `
          <button class="btn-admin-secondary btn-action-picked-up" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(168, 85, 247, 0.2); color: #c084fc; border-color: rgba(168, 85, 247, 0.4);">
            <i class="fas fa-box-open"></i> Mark Picked Up
          </button>
        `;
      } else if (status === "RETURN_PICKED_UP") {
        actionButtons = `
          <button class="btn-admin-secondary btn-action-received" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(234, 179, 8, 0.2); color: #facc15; border-color: rgba(234, 179, 8, 0.4);">
            <i class="fas fa-warehouse"></i> Mark Received
          </button>
        `;
      } else if (status === "RETURN_RECEIVED") {
        actionButtons = `
          <button class="btn-admin-secondary btn-action-inspect" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(20, 184, 166, 0.2); color: #2dd4bf; border-color: rgba(20, 184, 166, 0.4);">
            <i class="fas fa-clipboard-check"></i> 7-Point Inspection
          </button>
        `;
      } else if (status === "RETURN_APPROVED_AFTER_INSPECTION") {
        // THIS IS THE ONLY STAGE WHERE REFUND IS ALLOWED
        if (isPureCod) {
          actionButtons = `
            <button class="btn-admin-primary btn-action-replacement" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 12px; font-size: 0.78rem; background: #db2777; border-color: #db2777;">
              <i class="fas fa-exchange-alt"></i> Approve Replacement
            </button>
          `;
        } else {
          actionButtons = `
            <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content: flex-end;">
              <button class="btn-admin-success btn-action-approve-refund" data-req-id="${r.id}" data-order-id="${ord.id}" data-amount="${refundAmount}" style="padding: 5px 12px; font-size: 0.78rem; background: #059669; color: #fff; border: none; font-weight: 700; border-radius: 6px;">
                <i class="fas fa-money-bill-wave"></i> APPROVE REFUND
              </button>
              <button class="btn-admin-secondary btn-action-replacement" data-req-id="${r.id}" data-order-id="${ord.id}" style="padding: 5px 10px; font-size: 0.75rem;">
                <i class="fas fa-exchange-alt"></i> Replacement
              </button>
            </div>
          `;
        }
      } else if (status === "REFUND_INITIATED") {
        actionButtons = `
          <span style="font-size: 0.78rem; color: #60a5fa; font-weight: 700;">
            <i class="fas fa-spinner fa-spin"></i> In Gateway Flight
          </span>
        `;
      } else if (status === "REFUND_COMPLETED") {
        actionButtons = `
          <span style="font-size: 0.78rem; color: #34d399; font-weight: 700;">
            <i class="fas fa-check-circle"></i> Refunded (${window.formatINR(ord.refund_amount || r.refund_amount || refundAmount)})
          </span>
        `;
      } else if (status === "REPLACEMENT_APPROVED") {
        actionButtons = `
          <span style="font-size: 0.78rem; color: #f472b6; font-weight: 700;">
            <i class="fas fa-exchange-alt"></i> Replacement Approved
          </span>
        `;
      } else {
        actionButtons = `
          <span style="font-size: 0.78rem; color: #f87171; font-weight: 700;">
            <i class="fas fa-ban"></i> Return Rejected
          </span>
        `;
      }

      const itemImg = item.product_image || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120";

      return `
        <tr>
          <td>
            <a href="order-details.html?id=${ord.id}" style="color: #6366f1; font-weight: 700; text-decoration: underline;">
              #${ord.order_number || ord.id?.slice(0, 8)}
            </a>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 3px;">${dateStr}</div>
          </td>
          <td>
            <span class="badge ${catInfo.badgeClass}" style="font-size: 0.72rem;">${catInfo.icon} ${catInfo.label}</span>
          </td>
          <td>
            <strong style="color: #fff; font-size: 0.88rem;">${ord.delivery_full_name || 'Customer'}</strong>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${ord.delivery_phone || '-'}</div>
            <div style="font-size: 0.72rem; color: #94a3b8;">${ord.delivery_email || ''}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${itemImg}" alt="${item.product_name || 'Product'}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
              <div>
                <strong style="font-size: 0.84rem; color: #fff; display: block;">${item.product_name || 'Product Item'}</strong>
                <span style="font-size: 0.75rem; color: var(--admin-text-muted);">
                  ${item.selected_size ? 'Size: ' + item.selected_size + ' • ' : ''}Qty: ${item.quantity || 1} • ${window.formatINR(item.price || ord.total)}
                </span>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: #fbbf24; font-size: 0.82rem;">${r.reason || 'Return requested'}</strong>
            ${r.description ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 2px;">"${r.description}"</div>` : ''}
            ${retWf.pickup_partner ? `<div style="font-size:0.72rem; color:#38bdf8; margin-top:4px;">🚚 Courier: ${retWf.pickup_partner.name} (${retWf.pickup_partner.tracking_id})</div>` : ''}
          </td>
          <td>
            <div>${refundModeText}</div>
          </td>
          <td>
            ${getStatusBadge(status)}
          </td>
          <td style="text-align: right;">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join("");

    attachActionListeners();
  }

  // ------------------------------------------------------------------------
  // Attach Event Listeners to Action Buttons
  // ------------------------------------------------------------------------
  function attachActionListeners() {
    // 1. Review Request
    document.querySelectorAll(".btn-action-review").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        currentActiveReturn = allReturns.find(r => r.id === reqId);
        currentActiveOrder = allOrders[ordId];
        openReviewModal();
      };
    });

    // 2. Assign Pickup
    document.querySelectorAll(".btn-action-pickup").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        currentActiveReturn = allReturns.find(r => r.id === reqId);
        currentActiveOrder = allOrders[ordId];
        openPickupModal();
      };
    });

    // 3. Mark Picked Up
    document.querySelectorAll(".btn-action-picked-up").forEach(btn => {
      btn.onclick = async () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        if (!confirm("Confirm that courier partner has collected the returned package from customer?")) return;
        btn.disabled = true;
        await mutateReturnState("mark_picked_up", { request_id: reqId, order_id: ordId });
      };
    });

    // 4. Mark Received at Warehouse
    document.querySelectorAll(".btn-action-received").forEach(btn => {
      btn.onclick = async () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        if (!confirm("Confirm package has arrived at Valora central fulfillment facility?")) return;
        btn.disabled = true;
        await mutateReturnState("mark_received", { request_id: reqId, order_id: ordId });
      };
    });

    // 5. 7-Point Inspection
    document.querySelectorAll(".btn-action-inspect").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        currentActiveReturn = allReturns.find(r => r.id === reqId);
        currentActiveOrder = allOrders[ordId];
        openInspectionModal();
      };
    });

    // 6. Approve Refund (Razorpay)
    document.querySelectorAll(".btn-action-approve-refund").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        currentActiveReturn = allReturns.find(r => r.id === reqId);
        currentActiveOrder = allOrders[ordId];
        openApproveRefundModal();
      };
    });

    // 7. Approve Replacement
    document.querySelectorAll(".btn-action-replacement").forEach(btn => {
      btn.onclick = () => {
        const reqId = btn.dataset.reqId;
        const ordId = btn.dataset.orderId;
        currentActiveReturn = allReturns.find(r => r.id === reqId);
        currentActiveOrder = allOrders[ordId];
        openReplacementModal();
      };
    });
  }

  // ------------------------------------------------------------------------
  // Mutation API caller
  // ------------------------------------------------------------------------
  async function mutateReturnState(action, data) {
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...data })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to execute ${action}`);
      }

      window.showToast(json.message || "Return state updated successfully!", "success");
      closeAllModals();
      await loadReturns();
    } catch (err) {
      console.error(`Error in mutateReturnState (${action}):`, err);
      window.showToast(err.message, "error");
    }
  }

  // ------------------------------------------------------------------------
  // MODAL 1: REVIEW RETURN REQUEST
  // ------------------------------------------------------------------------
  function openReviewModal() {
    if (!currentActiveReturn || !currentActiveOrder) return;
    const detailsBox = document.getElementById("review-modal-details");
    detailsBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Order:</span>
        <strong style="color:#fff;">#${currentActiveOrder.order_number}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Customer:</span>
        <span style="color:#fff;">${currentActiveOrder.delivery_full_name} (${currentActiveOrder.delivery_phone})</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Reason:</span>
        <span style="color:#fbbf24; font-weight:700;">${currentActiveReturn.reason}</span>
      </div>
      ${currentActiveReturn.description ? `
        <div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 4px; color: #cbd5e1; font-size: 0.8rem;">
          "${currentActiveReturn.description}"
        </div>
      ` : ''}
    `;

    document.getElementById("review-modal-notes").value = "";
    document.getElementById("modal-review-request").style.display = "flex";

    document.getElementById("btn-modal-approve-request").onclick = async () => {
      const btn = document.getElementById("btn-modal-approve-request");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Approving...`;
      await mutateReturnState("approve_return", {
        request_id: currentActiveReturn.id,
        order_id: currentActiveOrder.id,
        payload: { notes: document.getElementById("review-modal-notes").value }
      });
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-circle"></i> Approve Return (Schedule Pickup)`;
    };

    document.getElementById("btn-modal-reject-request").onclick = async () => {
      const notes = document.getElementById("review-modal-notes").value.trim();
      if (!notes) {
        alert("Please enter a rejection reason for declining the return.");
        document.getElementById("review-modal-notes").focus();
        return;
      }
      const btn = document.getElementById("btn-modal-reject-request");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Rejecting...`;
      await mutateReturnState("reject_return", {
        request_id: currentActiveReturn.id,
        order_id: currentActiveOrder.id,
        payload: { reason: notes }
      });
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-times-circle"></i> Reject Return`;
    };
  }

  // ------------------------------------------------------------------------
  // MODAL 2: ASSIGN PICKUP
  // ------------------------------------------------------------------------
  function openPickupModal() {
    if (!currentActiveReturn || !currentActiveOrder) return;
    const select = document.getElementById("pickup-partner-select");
    select.innerHTML = deliveryPartners.map(p => `
      <option value="${p.id}" data-name="${p.name}" data-slug="${p.slug}">${p.name}</option>
    `).join("");

    document.getElementById("pickup-awb-input").value = `RET-${Date.now().toString().slice(-6)}`;
    document.getElementById("pickup-instructions-input").value = "Verify Valora shoe box, brand tags, and complete unworn state before acceptance.";
    document.getElementById("modal-assign-pickup").style.display = "flex";

    document.getElementById("btn-confirm-assign-pickup").onclick = async () => {
      const selectedOption = select.options[select.selectedIndex];
      const partnerId = selectedOption?.value;
      const partnerName = selectedOption?.dataset.name || selectedOption?.text;
      const partnerSlug = selectedOption?.dataset.slug;
      const awb = document.getElementById("pickup-awb-input").value.trim();
      const instructions = document.getElementById("pickup-instructions-input").value.trim();

      const btn = document.getElementById("btn-confirm-assign-pickup");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Assigning...`;

      await mutateReturnState("assign_pickup", {
        request_id: currentActiveReturn.id,
        order_id: currentActiveOrder.id,
        payload: {
          partner_id: partnerId,
          partner_name: partnerName,
          partner_slug: partnerSlug,
          tracking_id: awb,
          instructions: instructions
        }
      });

      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-truck-fast"></i> Confirm Pickup Assignment`;
    };
  }

  // ------------------------------------------------------------------------
  // MODAL 3: 7-POINT INSPECTION
  // ------------------------------------------------------------------------
  function openInspectionModal() {
    if (!currentActiveReturn || !currentActiveOrder) return;
    const summaryBox = document.getElementById("inspection-order-summary");
    summaryBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <span style="color:var(--admin-text-muted);">Order Number:</span>
        <strong style="color:#fff;">#${currentActiveOrder.order_number}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <span style="color:var(--admin-text-muted);">Customer:</span>
        <span style="color:#fff;">${currentActiveOrder.delivery_full_name}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--admin-text-muted);">Reported Reason:</span>
        <span style="color:#fbbf24;">${currentActiveReturn.reason}</span>
      </div>
    `;

    // Reset checklist to checked
    ['chk-correct-item', 'chk-unused', 'chk-tags', 'chk-packaging', 'chk-no-damage', 'chk-accessories', 'chk-serial-match'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
    document.getElementById("inspection-notes").value = "All 7 physical verification criteria passed in pristine condition.";
    document.getElementById("modal-inspection").style.display = "flex";

    // Pass Inspection Handler
    document.getElementById("btn-approve-inspection").onclick = async () => {
      const criteria = {
        correct_item: document.getElementById("chk-correct-item").checked,
        item_unused: document.getElementById("chk-unused").checked,
        tags_attached: document.getElementById("chk-tags").checked,
        packaging_present: document.getElementById("chk-packaging").checked,
        no_damage: document.getElementById("chk-no-damage").checked,
        accessories_included: document.getElementById("chk-accessories").checked,
        serial_match: document.getElementById("chk-serial-match").checked
      };

      const allChecked = Object.values(criteria).every(Boolean);
      if (!allChecked) {
        if (!confirm("Some inspection checklist items are unchecked. Are you sure you want to approve this return?")) {
          return;
        }
      }

      const btn = document.getElementById("btn-approve-inspection");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;

      await mutateReturnState("submit_inspection", {
        request_id: currentActiveReturn.id,
        order_id: currentActiveOrder.id,
        payload: {
          outcome: "approved",
          criteria,
          notes: document.getElementById("inspection-notes").value.trim()
        }
      });

      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-double"></i> Pass Inspection (Approve)`;
    };

    // Reject Inspection Handler
    document.getElementById("btn-reject-inspection").onclick = async () => {
      const notes = document.getElementById("inspection-notes").value.trim();
      if (!notes) {
        alert("Please describe why this item failed physical inspection.");
        document.getElementById("inspection-notes").focus();
        return;
      }

      const criteria = {
        correct_item: document.getElementById("chk-correct-item").checked,
        item_unused: document.getElementById("chk-unused").checked,
        tags_attached: document.getElementById("chk-tags").checked,
        packaging_present: document.getElementById("chk-packaging").checked,
        no_damage: document.getElementById("chk-no-damage").checked,
        accessories_included: document.getElementById("chk-accessories").checked,
        serial_match: document.getElementById("chk-serial-match").checked
      };

      const btn = document.getElementById("btn-reject-inspection");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;

      await mutateReturnState("submit_inspection", {
        request_id: currentActiveReturn.id,
        order_id: currentActiveOrder.id,
        payload: {
          outcome: "rejected",
          criteria,
          notes: notes
        }
      });

      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-times-circle"></i> Fail Inspection (Reject Return)`;
    };
  }

  // ------------------------------------------------------------------------
  // MODAL 4: APPROVE RAZORPAY REFUND
  // ------------------------------------------------------------------------
  function openApproveRefundModal() {
    if (!currentActiveReturn || !currentActiveOrder) return;
    const ord = currentActiveOrder;

    const hasAdv = Number(ord.advance_paid || ord.advance_amount || 0) > 0;
    const advAmt = Number(ord.advance_paid || ord.advance_amount || 0);
    const isOnline = Boolean(
      ord.is_full_online_payment ||
      (ord.payment_status === "paid" && !hasAdv && !ord.payment_method?.toLowerCase().includes("cash on delivery"))
    );

    let maxRefundable = 0;
    let explanationText = "";

    if (hasAdv) {
      maxRefundable = advAmt;
      explanationText = `Advance Payment Order: Only the <strong>${window.formatINR(advAmt)}</strong> online prepayment will be refunded. Uncollected COD balance is strictly excluded.`;
    } else if (isOnline) {
      maxRefundable = Number(ord.total);
      explanationText = `Full Online Payment: Full order total of <strong>${window.formatINR(maxRefundable)}</strong> is refundable to the original payment source.`;
    }

    const calcBox = document.getElementById("refund-calculation-box");
    calcBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Order Number:</span>
        <strong style="color:#fff;">#${ord.order_number}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Payment Method:</span>
        <span style="color:#fff;">${ord.payment_method || 'Online'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
        <span style="color:var(--admin-text-muted);">Razorpay Payment ID:</span>
        <code style="color:#60a5fa; font-size:0.8rem;">${ord.razorpay_payment_id || ord.transaction_reference || 'pay_verified'}</code>
      </div>
      <div style="border-top:1px dashed rgba(16, 185, 129, 0.3); margin: 8px 0; padding-top: 8px; display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#fff; font-weight:700;">Authoritative Refund Amount:</span>
        <strong style="color:#10b981; font-size:1.3rem;">${window.formatINR(maxRefundable)}</strong>
      </div>
      <div style="font-size:0.75rem; color:var(--admin-text-muted); margin-top:4px;">
        ${explanationText}
      </div>
    `;

    document.getElementById("refund-reason-input").value = `Return inspection approved - Order #${ord.order_number}`;
    document.getElementById("modal-approve-refund").style.display = "flex";

    // Confirm Refund Click with Double-Click Protection
    const btnConfirm = document.getElementById("btn-confirm-razorpay-refund");
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = `<i class="fas fa-money-bill-wave"></i> Confirm & Approve Razorpay Refund`;

    btnConfirm.onclick = async () => {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Calling Razorpay API...`;

      try {
        const token = await getAdminToken();
        const res = await fetch("/api/razorpay/refund", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            order_id: ord.id,
            amount: maxRefundable,
            reason: document.getElementById("refund-reason-input").value.trim()
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Razorpay refund call failed.");
        }

        window.showToast(`Refund of ${window.formatINR(maxRefundable)} initiated via Razorpay! Refund ID: ${json.refund_id}`, "success");
        closeAllModals();
        await loadReturns();
      } catch (refundErr) {
        console.error("Razorpay refund error:", refundErr);
        window.showToast(`Refund failed: ${refundErr.message}`, "error");
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `<i class="fas fa-money-bill-wave"></i> Confirm & Approve Razorpay Refund`;
      }
    };
  }

  // ------------------------------------------------------------------------
  // MODAL 5: APPROVE REPLACEMENT
  // ------------------------------------------------------------------------
  function openReplacementModal() {
    if (!currentActiveReturn || !currentActiveOrder) return;
    const ord = currentActiveOrder;
    const items = ord.order_items || [];
    const item = items.find(it => it.id === currentActiveReturn.order_item_id) || items[0] || {};

    const summaryBox = document.getElementById("replacement-summary-box");
    summaryBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <span style="color:var(--admin-text-muted);">Order:</span>
        <strong style="color:#fff;">#${ord.order_number}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <span style="color:var(--admin-text-muted);">Current Item:</span>
        <span style="color:#fff;">${item.product_name || 'Product'} (${item.selected_size ? 'Size ' + item.selected_size : 'Standard'})</span>
      </div>
    `;

    document.getElementById("replacement-size-input").value = "";
    document.getElementById("replacement-notes-input").value = "Product inspected and passed. Dispatch replacement unit.";
    document.getElementById("modal-approve-replacement").style.display = "flex";

    document.getElementById("btn-confirm-approve-replacement").onclick = async () => {
      const repSize = document.getElementById("replacement-size-input").value.trim();
      const repNotes = document.getElementById("replacement-notes-input").value.trim();

      const btn = document.getElementById("btn-confirm-approve-replacement");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;

      await mutateReturnState("approve_replacement", {
        request_id: currentActiveReturn.id,
        order_id: ord.id,
        payload: {
          replacement_size: repSize || "Same Size",
          replacement_notes: repNotes
        }
      });

      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-exchange-alt"></i> Confirm Replacement (No Refund)`;
    };
  }

  // ------------------------------------------------------------------------
  // Tab and Filter Listeners
  // ------------------------------------------------------------------------
  statusTabsContainer?.querySelectorAll(".tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      statusTabsContainer.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilterStatus = tab.dataset.status || "";
      renderReturns();
    });
  });

  searchInput?.addEventListener("input", () => renderReturns());
  catalogFilter?.addEventListener("change", () => renderReturns());
  document.getElementById("btn-refresh-returns")?.addEventListener("click", async () => {
    await loadReturns();
    window.showToast("Returns list refreshed", "info");
  });

  // Initial load
  await loadDeliveryPartners();
  await loadReturns();
});
