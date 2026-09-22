/**
 * VELORA Admin Panel - Orders Controller
 * Handles single order deletion, bulk selection & bulk order deletion,
 * with real Supabase database synchronization and error verification.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("orders-tbody");
  const searchInput = document.getElementById("search-orders");
  const statusFilter = document.getElementById("filter-status");
  const catalogFilter = document.getElementById("filter-catalog");

  // Selection & Bulk Actions Elements
  const masterCheckbox = document.getElementById("checkbox-select-all-orders");
  const bulkActionBar = document.getElementById("bulk-orders-action-bar");
  const bulkSelectedCountBadge = document.getElementById("bulk-selected-count-badge");
  const btnCancelBulkSelection = document.getElementById("btn-cancel-bulk-selection");
  const btnDeleteSelectedOrders = document.getElementById("btn-delete-selected-orders");

  // Single Delete Modal Elements
  const deleteModal = document.getElementById("delete-order-modal");
  const deleteModalCloseBtn = document.getElementById("btn-close-delete-modal");
  const deleteCancelBtn = document.getElementById("btn-cancel-delete-order");
  const deleteConfirmBtn = document.getElementById("btn-confirm-delete-order");
  const deleteOrderNumDisplay = document.getElementById("delete-order-number-display");

  // Bulk Delete Modal Elements
  const bulkDeleteModal = document.getElementById("bulk-delete-orders-modal");
  const bulkDeleteModalCloseBtn = document.getElementById("btn-close-bulk-delete-modal");
  const bulkDeleteCancelBtn = document.getElementById("btn-cancel-bulk-delete");
  const bulkDeleteConfirmBtn = document.getElementById("btn-confirm-bulk-delete");
  const bulkDeleteCountDisplay = document.getElementById("bulk-delete-count-display");
  const bulkDeleteBtnLabel = document.getElementById("btn-confirm-bulk-delete-label");

  let allOrders = [];
  let currentlyDisplayedOrders = [];
  let orderMetadata = {};
  let orderRequests = [];
  const selectedOrderIds = new Set();
  let orderToDelete = null;

  // Store Origin Detector
  function getOrderCatalogInfo(order) {
    const items = order.order_items || [];
    if (items.length === 0) {
      return {
        type: "main",
        label: "MAIN VADI",
        icon: "🏪",
        color: "#94a3b8",
        bg: "rgba(255, 255, 255, 0.05)",
        border: "rgba(255, 255, 255, 0.1)"
      };
    }
    const hasSarojini = items.some(it => it.catalog_type === "sarojini" || it.sarojini_product_id != null);
    const hasMain = items.some(it => it.catalog_type !== "sarojini" && it.product_id != null);

    if (hasSarojini && hasMain) {
      return {
        type: "mixed",
        label: "MIXED CATALOG",
        icon: "🔀",
        color: "#c084fc",
        bg: "rgba(168, 85, 247, 0.15)",
        border: "rgba(168, 85, 247, 0.3)"
      };
    } else if (hasSarojini) {
      return {
        type: "sarojini",
        label: "SAROJINI BAZAAR",
        icon: "🛍️",
        color: "#fda4af",
        bg: "rgba(225, 29, 72, 0.15)",
        border: "rgba(225, 29, 72, 0.3)"
      };
    } else {
      return {
        type: "main",
        label: "MAIN VADI",
        icon: "🏪",
        color: "#94a3b8",
        bg: "rgba(255, 255, 255, 0.05)",
        border: "rgba(255, 255, 255, 0.1)"
      };
    }
  }

  // ----------------------------------------------------
  // Admin Profile Role Synchronization
  // ----------------------------------------------------
  async function ensureAdminProfileSync() {
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user && (user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin")) {
        const { data: prof } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (!prof || prof.role !== "admin") {
          await client.from("profiles").upsert({
            id: user.id,
            role: "admin",
            full_name: user.user_metadata?.full_name || "Administrator",
            email: user.email
          }, { onConflict: "id" });
        }
      }
    } catch (_) {}
  }

  // ----------------------------------------------------
  // Load Orders from Supabase
  // ----------------------------------------------------
  async function loadOrders() {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 24px;">Loading orders from database...</td></tr>';
    
    try {
      const { data: metaRow } = await client.from("store_settings").select("value").eq("key", "order_metadata").maybeSingle();
      if (metaRow && metaRow.value) {
        orderMetadata = metaRow.value;
      }
    } catch (_) {}

    // Load customer order requests (cancellation & return)
    orderRequests = [];
    try {
      const { data: reqs } = await client.from("order_requests").select("*");
      if (reqs) orderRequests = reqs;
    } catch (e) {
      console.warn("order_requests fetch notice:", e);
    }
    try {
      const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
      if (sRow && Array.isArray(sRow.value)) {
        const existingIds = new Set(orderRequests.map(r => r.id));
        sRow.value.forEach(r => { if (!existingIds.has(r.id)) orderRequests.push(r); });
      }
    } catch (_) {}
    try {
      const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
      if (Array.isArray(localReqs)) {
        const existingIds = new Set(orderRequests.map(r => r.id));
        localReqs.forEach(lr => { if (!existingIds.has(lr.id)) orderRequests.push(lr); });
      }
    } catch (_) {}

    const { data, error } = await client
      .from("orders")
      .select("*, order_items(id, catalog_type, product_id, sarojini_product_id, product_name, product_image, price, quantity)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load orders:", error);
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--admin-danger); padding: 24px;">Error: ${error.message}</td></tr>`;
      return;
    }

    // Filter out orders archived/hidden from Admin view
    allOrders = (data || []).filter(o => {
      const isHiddenInTracking = Boolean(o.tracking_data && typeof o.tracking_data === "object" && o.tracking_data.admin_hidden);
      const isHiddenInMeta = Boolean(orderMetadata && orderMetadata[o.id] && orderMetadata[o.id].admin_hidden);
      return !isHiddenInTracking && !isHiddenInMeta;
    });
    renderOrders();
  }

  // ----------------------------------------------------
  // Render Orders Table
  // ----------------------------------------------------
  function renderOrders() {
    let filtered = [...allOrders];
    const q = (searchInput?.value || "").trim().toLowerCase();
    const st = statusFilter?.value || "";
    const catVal = catalogFilter?.value || "";

    // Catalog Filter (Main / Sarojini / Mixed)
    if (catVal) {
      filtered = filtered.filter(o => getOrderCatalogInfo(o).type === catVal);
    }

    if (q) {
      filtered = filtered.filter(o => 
        (o.order_number && o.order_number.toLowerCase().includes(q)) ||
        (o.delivery_full_name && o.delivery_full_name.toLowerCase().includes(q)) ||
        (o.delivery_phone && o.delivery_phone.includes(q)) ||
        (o.delivery_email && o.delivery_email.toLowerCase().includes(q)) ||
        (Array.isArray(o.order_items) && o.order_items.some(it => it.product_name && it.product_name.toLowerCase().includes(q)))
      );
    }

    if (st) {
      if (st === "cancellation_requested") {
        filtered = filtered.filter(o => o.order_status === "cancellation_requested" || orderRequests.some(r => r.order_id === o.id && r.request_type === "cancellation" && r.status === "requested"));
      } else if (st === "return_requested") {
        filtered = filtered.filter(o => o.order_status === "return_requested" || orderRequests.some(r => r.order_id === o.id && r.request_type === "return" && r.status === "requested"));
      } else {
        filtered = filtered.filter(o => o.order_status === st);
      }
    }

    currentlyDisplayedOrders = filtered;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 30px; color: var(--admin-text-muted);">No orders found.</td></tr>';
      updateSelectionUI();
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      let badgeClass = "badge-info";
      let displayStatus = o.order_status;
      let requestBadgeHtml = "";

      const reqs = orderRequests.filter(r => r.order_id === o.id);
      const pendingCancelReq = reqs.find(r => r.request_type === "cancellation" && r.status === "requested");
      const pendingReturnReq = reqs.find(r => r.request_type === "return" && r.status === "requested");

      if (o.order_status === "delivered") badgeClass = "badge-success";
      if (o.order_status === "cancelled") badgeClass = "badge-danger";
      if (o.order_status === "processing") badgeClass = "badge-warning";
      if (o.order_status === "shipped") badgeClass = "badge-indigo";
      if (o.order_status === "cancellation_requested" || pendingCancelReq) {
        badgeClass = "badge-warning";
        displayStatus = "Cancel Req";
        requestBadgeHtml = `<div style="margin-top: 3px;"><span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 0.68rem; font-weight: 700;">⚠️ CANCEL REQ</span></div>`;
      } else if (o.order_status === "return_requested" || pendingReturnReq) {
        badgeClass = "badge-indigo";
        displayStatus = "Return Req";
        requestBadgeHtml = `<div style="margin-top: 3px;"><span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); font-size: 0.68rem; font-weight: 700;">↩️ RETURN REQ</span></div>`;
      } else if (o.order_status === "returned") {
        badgeClass = "badge-success";
        displayStatus = "Returned";
      }

      const dateStr = new Date(o.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
      const itemCount = Array.isArray(o.order_items) ? o.order_items.length : ((o.order_items && o.order_items[0]) ? (o.order_items[0].count || 1) : 1);
      const catInfo = getOrderCatalogInfo(o);

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
      paymentBadgesHtml += `<div style="margin-top: 5px; display: flex; gap: 4px; flex-wrap: wrap;">`;
      if (isOnlinePaid) {
        paymentBadgesHtml += `<span class="badge badge-success" style="font-size:0.68rem; font-weight:700;">ONLINE PAID</span>`;
        if (hasGifts) {
          paymentBadgesHtml += `<span class="badge" title="${giftNames}" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); font-size:0.68rem; font-weight:700;">🎁 ${giftCount} FREE GIFT${giftCount > 1 ? 'S' : ''}</span>`;
        }
      }
      paymentBadgesHtml += `<span class="badge" style="background: ${isOpenBox ? 'rgba(2, 132, 199, 0.2)' : 'rgba(100, 116, 139, 0.15)'}; color: ${isOpenBox ? '#38bdf8' : '#94a3b8'}; border: 1px solid ${isOpenBox ? 'rgba(2, 132, 199, 0.4)' : 'transparent'}; font-size:0.68rem; font-weight:700;">${isOpenBox ? '📦 OPEN BOX' : 'SIMPLE DELIVERY'}</span>`;
      paymentBadgesHtml += `</div>`;

      const isChecked = selectedOrderIds.has(o.id) ? "checked" : "";

      return `
        <tr data-order-id="${o.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="order-checkbox" data-order-id="${o.id}" data-order-number="${o.order_number}" ${isChecked} style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--admin-accent);">
          </td>
          <td>
            <strong>${o.order_number}</strong>
            <div style="margin-top: 4px;">
              <span class="badge" style="background: ${catInfo.bg}; color: ${catInfo.color}; border: 1px solid ${catInfo.border}; font-size: 0.65rem; font-weight: 700; padding: 2px 6px;">
                ${catInfo.icon} ${catInfo.label}
              </span>
            </div>
          </td>
          <td>
            <div><strong>${o.delivery_full_name}</strong></div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${o.delivery_phone}</div>
          </td>
          <td>${dateStr}</td>
          <td>${paymentBadgesHtml}</td>
          <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
          <td>${advCodHtml}</td>
          <td><strong>${window.formatINR(o.total)}</strong> <span style="font-size: 0.75rem; color: var(--admin-text-muted);">(${itemCount} items)</span></td>
          <td><span class="badge ${badgeClass}">${displayStatus}</span>${requestBadgeHtml}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center; justify-content: flex-start; flex-wrap: nowrap;">
              <a href="order-details.html?id=${o.id}" class="btn-admin-secondary" style="padding: 5px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" title="View & Manage Order">
                <i class="fas fa-eye"></i> View
              </a>
              <button type="button" class="btn-admin-danger btn-delete-order" data-order-id="${o.id}" data-order-number="${o.order_number}" style="padding: 5px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" title="Permanently Delete Order">
                <i class="fas fa-trash-alt"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    updateSelectionUI();
  }

  // ----------------------------------------------------
  // Selection State & Master Checkbox
  // ----------------------------------------------------
  function updateSelectionUI() {
    const totalVisible = currentlyDisplayedOrders.length;
    let selectedVisibleCount = 0;

    currentlyDisplayedOrders.forEach(o => {
      if (selectedOrderIds.has(o.id)) selectedVisibleCount++;
    });

    if (masterCheckbox) {
      if (totalVisible === 0 || selectedVisibleCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
      } else if (selectedVisibleCount === totalVisible) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
      } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
      }
    }

    const totalSelected = selectedOrderIds.size;
    if (totalSelected > 0) {
      if (bulkActionBar) bulkActionBar.style.display = "flex";
      if (bulkSelectedCountBadge) {
        bulkSelectedCountBadge.textContent = `${totalSelected} Order${totalSelected === 1 ? "" : "s"} Selected`;
      }
    } else {
      if (bulkActionBar) bulkActionBar.style.display = "none";
    }
  }

  // Master Checkbox Change
  if (masterCheckbox) {
    masterCheckbox.addEventListener("change", () => {
      const isChecked = masterCheckbox.checked;
      currentlyDisplayedOrders.forEach(o => {
        if (isChecked) {
          selectedOrderIds.add(o.id);
        } else {
          selectedOrderIds.delete(o.id);
        }
      });

      tbody.querySelectorAll(".order-checkbox").forEach(cb => {
        cb.checked = isChecked;
      });

      updateSelectionUI();
    });
  }

  // Row Checkbox Toggle via Delegation
  if (tbody) {
    tbody.addEventListener("change", e => {
      const cb = e.target.closest(".order-checkbox");
      if (cb) {
        const id = cb.dataset.orderId;
        if (cb.checked) {
          selectedOrderIds.add(id);
        } else {
          selectedOrderIds.delete(id);
        }
        updateSelectionUI();
      }
    });
  }

  // Deselect All
  if (btnCancelBulkSelection) {
    btnCancelBulkSelection.addEventListener("click", () => {
      selectedOrderIds.clear();
      tbody.querySelectorAll(".order-checkbox").forEach(cb => {
        cb.checked = false;
      });
      updateSelectionUI();
    });
  }

  // ----------------------------------------------------
  // Single Delete Modal
  // ----------------------------------------------------
  function promptDeleteOrder(orderId, orderNumber) {
    orderToDelete = { id: orderId, number: orderNumber };
    if (deleteOrderNumDisplay) {
      deleteOrderNumDisplay.textContent = orderNumber || orderId;
    }
    if (deleteModal) {
      deleteModal.classList.add("show");
    }
  }

  function closeSingleDeleteModal() {
    orderToDelete = null;
    if (deleteModal) {
      deleteModal.classList.remove("show");
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
    }
  }

  if (deleteModalCloseBtn) deleteModalCloseBtn.addEventListener("click", closeSingleDeleteModal);
  if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeSingleDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener("click", e => {
      if (e.target === deleteModal) closeSingleDeleteModal();
    });
  }

  // Row Delete button click
  if (tbody) {
    tbody.addEventListener("click", e => {
      const delBtn = e.target.closest(".btn-delete-order");
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        promptDeleteOrder(delBtn.dataset.orderId, delBtn.dataset.orderNumber);
      }
    });
  }

  // ----------------------------------------------------
  // Bulk Delete Modal
  // ----------------------------------------------------
  function promptBulkDelete() {
    const count = selectedOrderIds.size;
    if (count === 0) return;

    if (bulkDeleteCountDisplay) {
      bulkDeleteCountDisplay.textContent = `${count} selected order${count === 1 ? "" : "s"}`;
    }
    if (bulkDeleteBtnLabel) {
      bulkDeleteBtnLabel.textContent = `Delete ${count} Order${count === 1 ? "" : "s"}`;
    }
    if (bulkDeleteModal) {
      bulkDeleteModal.classList.add("show");
    }
  }

  function closeBulkDeleteModal() {
    if (bulkDeleteModal) {
      bulkDeleteModal.classList.remove("show");
    }
    if (bulkDeleteConfirmBtn) {
      bulkDeleteConfirmBtn.disabled = false;
      bulkDeleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span id="btn-confirm-bulk-delete-label">Delete Selected Orders</span>';
    }
  }

  if (btnDeleteSelectedOrders) btnDeleteSelectedOrders.addEventListener("click", promptBulkDelete);
  if (bulkDeleteModalCloseBtn) bulkDeleteModalCloseBtn.addEventListener("click", closeBulkDeleteModal);
  if (bulkDeleteCancelBtn) bulkDeleteCancelBtn.addEventListener("click", closeBulkDeleteModal);
  if (bulkDeleteModal) {
    bulkDeleteModal.addEventListener("click", e => {
      if (e.target === bulkDeleteModal) closeBulkDeleteModal();
    });
  }

  // Close modals on Escape
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (deleteModal?.classList.contains("show")) closeSingleDeleteModal();
      if (bulkDeleteModal?.classList.contains("show")) closeBulkDeleteModal();
    }
  });

  // ----------------------------------------------------
  // NON-DESTRUCTIVE ADMIN-ONLY ORDER ARCHIVAL / HIDE
  // Removes order strictly from Admin Panel view while preserving
  // customer order record, order_items, payments, tracking, and history intact.
  // ----------------------------------------------------
  async function executeDatabaseDeletion(idsToDelete) {
    if (!client) throw new Error("Database client not available.");
    if (!idsToDelete || idsToDelete.length === 0) {
      throw new Error("No order IDs specified for deletion.");
    }

    await ensureAdminProfileSync();

    let successCount = 0;
    let lastError = null;

    // 1. Mark tracking_data.admin_hidden = true on each order in public.orders
    for (const orderId of idsToDelete) {
      try {
        const orderObj = allOrders.find(o => o.id === orderId);
        const currentTracking = (orderObj && orderObj.tracking_data && typeof orderObj.tracking_data === "object")
          ? { ...orderObj.tracking_data }
          : {};

        currentTracking.admin_hidden = true;
        currentTracking.admin_hidden_at = new Date().toISOString();

        const { error: updErr } = await client
          .from("orders")
          .update({
            tracking_data: currentTracking,
            updated_at: new Date().toISOString()
          })
          .eq("id", orderId);

        if (updErr) {
          console.warn("Order tracking_data admin_hidden update notice:", updErr);
          lastError = updErr;
        } else {
          successCount++;
          if (orderObj) {
            orderObj.tracking_data = currentTracking;
          }
        }
      } catch (ex) {
        console.warn("Exception updating order tracking_data:", ex);
        lastError = ex;
      }
    }

    // 2. Synchronize with store_settings order_metadata backup
    try {
      let currentMeta = { ...orderMetadata };
      let metaChanged = false;
      for (const orderId of idsToDelete) {
        if (!currentMeta[orderId]) currentMeta[orderId] = {};
        currentMeta[orderId].admin_hidden = true;
        currentMeta[orderId].admin_hidden_at = new Date().toISOString();
        metaChanged = true;
      }

      if (metaChanged) {
        const { error: setErr } = await client
          .from("store_settings")
          .upsert({ key: "order_metadata", value: currentMeta }, { onConflict: "key" });
        if (!setErr) {
          orderMetadata = currentMeta;
        }
      }
    } catch (_) {}

    if (successCount === 0 && lastError) {
      throw lastError;
    }

    return true;
  }

  // ----------------------------------------------------
  // Execute Single Delete Handler (Admin Hide)
  // ----------------------------------------------------
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", async () => {
      if (!orderToDelete || !orderToDelete.id) return;
      const targetId = orderToDelete.id;

      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Removing...</span>';

      try {
        await executeDatabaseDeletion([targetId]);

        // Success: update UI
        allOrders = allOrders.filter(o => o.id !== targetId);
        selectedOrderIds.delete(targetId);
        closeSingleDeleteModal();
        renderOrders();

        if (typeof window.showToast === "function") {
          window.showToast("Order removed from Admin view.", "success");
        }
      } catch (err) {
        console.error("Failed to remove order from Admin view:", err);
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
        if (typeof window.showToast === "function") {
          window.showToast("Failed to remove order. Please try again.", "error");
        } else {
          alert("Failed to remove order. Please try again.");
        }
      }
    });
  }

  // ----------------------------------------------------
  // Execute Bulk Delete Handler (Admin Hide)
  // ----------------------------------------------------
  if (bulkDeleteConfirmBtn) {
    bulkDeleteConfirmBtn.addEventListener("click", async () => {
      const idsToDelete = Array.from(selectedOrderIds);
      if (idsToDelete.length === 0) return;

      bulkDeleteConfirmBtn.disabled = true;
      bulkDeleteConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Removing...</span>';

      try {
        await executeDatabaseDeletion(idsToDelete);

        const count = idsToDelete.length;
        allOrders = allOrders.filter(o => !selectedOrderIds.has(o.id));
        selectedOrderIds.clear();
        closeBulkDeleteModal();
        renderOrders();

        if (typeof window.showToast === "function") {
          window.showToast(`${count} order${count > 1 ? 's' : ''} removed from Admin view.`, "success");
        }
      } catch (err) {
        console.error("Failed to bulk remove orders from Admin view:", err);
        bulkDeleteConfirmBtn.disabled = false;
        bulkDeleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span id="btn-confirm-bulk-delete-label">Delete Selected Orders</span>';
        if (typeof window.showToast === "function") {
          window.showToast("Failed to remove orders. Please try again.", "error");
        } else {
          alert("Failed to remove orders. Please try again.");
        }
      }
    });
  }

  // Filters
  if (searchInput) searchInput.addEventListener("input", renderOrders);
  if (statusFilter) statusFilter.addEventListener("change", renderOrders);

  await loadOrders();
});
