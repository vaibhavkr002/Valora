/**
 * VADI Admin Panel - Sarojini Bazaar Coupons Controller
 * Full CRUD connected to Supabase store_settings ('sarojini_coupons') and synced with coupons table.
 * Supports Create, Edit, Toggle Active/Inactive, Expiry date, and Confirmed Delete.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("coupons-tbody");
  
  // KPI Elements
  const statTotalCoupons = document.getElementById("stat-total-coupons");
  const statActiveCoupons = document.getElementById("stat-active-coupons");
  const statTotalUses = document.getElementById("stat-total-uses");

  // Filters
  const searchInput = document.getElementById("search-coupons");
  const filterStatus = document.getElementById("filter-status");

  // Coupon Modal elements
  const modal = document.getElementById("coupon-modal-backdrop");
  const modalTitle = document.getElementById("coupon-modal-title");
  const btnAdd = document.getElementById("btn-add-coupon");
  const btnClose = document.getElementById("btn-close-coupon-modal");
  const btnCancel = document.getElementById("btn-cancel-coupon-modal");
  const form = document.getElementById("coupon-form");
  const inputEditId = document.getElementById("coupon-edit-id");
  const inputCode = document.getElementById("coupon-code");
  const inputType = document.getElementById("coupon-type");
  const inputVal = document.getElementById("coupon-val");
  const inputMinOrder = document.getElementById("coupon-min-order");
  const inputMaxDiscount = document.getElementById("coupon-max-discount");
  const inputLimit = document.getElementById("coupon-limit");
  const inputExpiry = document.getElementById("coupon-expiry");
  const inputActive = document.getElementById("coupon-active");
  const btnSubmit = document.getElementById("btn-submit-coupon");

  // Delete Modal elements
  const deleteModal = document.getElementById("delete-coupon-modal-backdrop");
  const deleteCodeLabel = document.getElementById("delete-coupon-code-label");
  const btnCloseDelete = document.getElementById("btn-close-delete-modal");
  const btnCancelDelete = document.getElementById("btn-cancel-delete");
  const btnConfirmDelete = document.getElementById("btn-confirm-delete");

  let sarojiniCoupons = [];
  let pendingDeleteId = null;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '<span style="color: var(--admin-text-muted);">No expiry</span>';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '<span style="color: var(--admin-text-muted);">No expiry</span>';
    const isPast = d.getTime() < Date.now();
    const formatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (isPast) {
      return `<span style="color: #ef4444; font-weight: 600;" title="Expired on ${formatted}">⚠️ ${formatted} (Expired)</span>`;
    }
    return `<span style="color: #e2e8f0;">${formatted}</span>`;
  }

  function formatInputDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Load Sarojini Coupons
  async function loadSarojiniCoupons() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Loading Sarojini coupons...</td></tr>';
    
    let coupons = [];

    // 1. Fetch from store_settings (sarojini_coupons)
    try {
      const { data: sRow, error: sErr } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "sarojini_coupons")
        .maybeSingle();

      if (!sErr && sRow && Array.isArray(sRow.value)) {
        coupons = sRow.value;
      }
    } catch (_) {}

    // 2. Check local storage backup
    if (coupons.length === 0) {
      try {
        const local = JSON.parse(localStorage.getItem("sarojini_coupons_cache") || "[]");
        if (Array.isArray(local) && local.length > 0) {
          coupons = local;
        }
      } catch (_) {}
    }

    // 3. Default starter coupons for Sarojini Bazaar
    if (coupons.length === 0) {
      coupons = [
        {
          id: "sar-coup-01",
          code: "SAROJINI10",
          discount_type: "percentage",
          discount_value: 10,
          min_order_amount: 499,
          max_discount: 200,
          usage_limit: 500,
          used_count: 14,
          is_active: true,
          expiry_date: null,
          created_at: new Date(Date.now() - 10 * 86400000).toISOString()
        },
        {
          id: "sar-coup-02",
          code: "BAZAAR100",
          discount_type: "fixed",
          discount_value: 100,
          min_order_amount: 799,
          max_discount: 100,
          usage_limit: 200,
          used_count: 8,
          is_active: true,
          expiry_date: null,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        {
          id: "sar-coup-03",
          code: "STREET50",
          discount_type: "fixed",
          discount_value: 50,
          min_order_amount: 399,
          max_discount: 50,
          usage_limit: 1000,
          used_count: 32,
          is_active: true,
          expiry_date: null,
          created_at: new Date(Date.now() - 2 * 86400000).toISOString()
        }
      ];

      // Save initial defaults
      await syncCouponsToStorage(coupons);
    }

    sarojiniCoupons = coupons;
    updateMetrics();
    renderCoupons();
  }

  // Update KPI counters
  function updateMetrics() {
    const total = sarojiniCoupons.length;
    const now = Date.now();
    const active = sarojiniCoupons.filter(c => {
      const isPast = c.expiry_date && (new Date(c.expiry_date).getTime() < now);
      return c.is_active && !isPast;
    }).length;
    const totalUses = sarojiniCoupons.reduce((sum, c) => sum + (Number(c.used_count) || 0), 0);

    if (statTotalCoupons) statTotalCoupons.textContent = total;
    if (statActiveCoupons) statActiveCoupons.textContent = active;
    if (statTotalUses) statTotalUses.textContent = totalUses;
  }

  // Save to store_settings, local cache, and sync to Supabase coupons table
  async function syncCouponsToStorage(coupons) {
    try {
      localStorage.setItem("sarojini_coupons_cache", JSON.stringify(coupons));
    } catch (_) {}

    try {
      await client.from("store_settings").upsert({
        key: "sarojini_coupons",
        value: coupons,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
    } catch (e) {
      console.warn("store_settings sync notice:", e);
    }

    // Dual-write active coupons to Supabase coupons table for checkout redemption
    for (const c of coupons) {
      try {
        const payload = {
          code: c.code,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          min_order_amount: c.min_order_amount || 0,
          max_discount: c.max_discount || null,
          usage_limit: c.usage_limit || 100,
          used_count: c.used_count || 0,
          expiry_date: c.expiry_date || null,
          is_active: c.is_active,
          updated_at: new Date().toISOString()
        };

        // Check if exists in coupons table
        const { data: existing } = await client.from("coupons").select("id").eq("code", c.code).maybeSingle();
        if (existing) {
          await client.from("coupons").update(payload).eq("id", existing.id);
        } else {
          await client.from("coupons").insert([{ ...payload, created_at: new Date().toISOString() }]);
        }
      } catch (err) {
        console.warn("coupons table dual-write notice:", err);
      }
    }
  }

  // Render Table
  function renderCoupons() {
    const query = (searchInput?.value || "").trim().toUpperCase();
    const statusFilter = filterStatus?.value;
    const now = Date.now();

    const filtered = sarojiniCoupons.filter(c => {
      const isPast = c.expiry_date && (new Date(c.expiry_date).getTime() < now);

      if (statusFilter === "active" && (!c.is_active || isPast)) return false;
      if (statusFilter === "disabled" && c.is_active) return false;
      if (statusFilter === "expired" && !isPast) return false;

      if (query && !c.code.includes(query)) return false;

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No Sarojini coupons match your search.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const discountDisplay = c.discount_type === "percentage" ? `${c.discount_value}%` : (window.formatINR ? window.formatINR(c.discount_value) : '₹' + c.discount_value);
      const isPast = c.expiry_date && (new Date(c.expiry_date).getTime() < now);

      let statusBadge = "";
      if (!c.is_active) {
        statusBadge = `<button class="btn-toggle-status badge badge-danger" data-id="${c.id}" data-action="activate" title="Click to Activate" style="cursor:pointer; border:none;">Disabled</button>`;
      } else if (isPast) {
        statusBadge = `<button class="btn-toggle-status badge badge-warning" data-id="${c.id}" data-action="deactivate" title="Expired. Click to Disable" style="cursor:pointer; border:none;">Expired</button>`;
      } else {
        statusBadge = `<button class="btn-toggle-status badge badge-success" data-id="${c.id}" data-action="deactivate" title="Click to Deactivate" style="cursor:pointer; border:none;">Active</button>`;
      }

      return `
        <tr data-coupon-id="${c.id}">
          <td>
            <strong style="color:#e11d48; font-family:monospace; font-size:1.05rem; letter-spacing:0.05em;">${escapeHtml(c.code)}</strong>
          </td>
          <td>${discountDisplay} <span style="font-size:0.75rem; color:var(--admin-text-muted);">(${c.discount_type})</span></td>
          <td>${window.formatINR ? window.formatINR(c.min_order_amount || 0) : '₹' + (c.min_order_amount || 0)}</td>
          <td>${c.max_discount ? (window.formatINR ? window.formatINR(c.max_discount) : '₹' + c.max_discount) : '<span style="color:var(--admin-text-muted);">No cap</span>'}</td>
          <td><span style="font-weight:600; color:#fff;">${c.used_count || 0}</span> / ${c.usage_limit || '∞'}</td>
          <td>${formatDisplayDate(c.expiry_date)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <button class="btn-admin-secondary btn-edit-coupon" data-id="${c.id}" style="padding: 4px 10px; font-size: 0.75rem;">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="btn-admin-danger btn-delete-coupon" data-id="${c.id}" data-code="${escapeHtml(c.code)}" style="padding: 4px 10px; font-size: 0.75rem;">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind row listeners
    tbody.querySelectorAll(".btn-edit-coupon").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const coupon = sarojiniCoupons.find(c => c.id === id);
        if (coupon) openEditModal(coupon);
      });
    });

    tbody.querySelectorAll(".btn-delete-coupon").forEach(b => {
      b.addEventListener("click", () => {
        openDeleteModal(b.dataset.id, b.dataset.code);
      });
    });

    tbody.querySelectorAll(".btn-toggle-status").forEach(b => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        const action = b.dataset.action;
        const newStatus = (action === "activate");
        b.disabled = true;

        const coupon = sarojiniCoupons.find(c => c.id === id);
        if (coupon) {
          coupon.is_active = newStatus;
          await syncCouponsToStorage(sarojiniCoupons);
          updateMetrics();
          renderCoupons();
          if (typeof window.showToast === "function") {
            window.showToast(`Coupon ${coupon.code} marked ${newStatus ? 'active' : 'disabled'}.`, "success");
          }
        }
      });
    });
  }

  // Modal Handlers
  function openCreateModal() {
    form.reset();
    inputEditId.value = "";
    modalTitle.textContent = "Create Sarojini Promo Code";
    btnSubmit.textContent = "Create Promo Code";
    inputActive.checked = true;
    modal.style.display = "flex";
  }

  function openEditModal(coupon) {
    inputEditId.value = coupon.id;
    inputCode.value = coupon.code;
    inputType.value = coupon.discount_type || "percentage";
    inputVal.value = coupon.discount_value;
    inputMinOrder.value = coupon.min_order_amount || 0;
    inputMaxDiscount.value = coupon.max_discount || "";
    inputLimit.value = coupon.usage_limit || 100;
    inputExpiry.value = formatInputDate(coupon.expiry_date);
    inputActive.checked = coupon.is_active !== false;

    modalTitle.textContent = `Edit Coupon: ${coupon.code}`;
    btnSubmit.textContent = "Save Changes";
    modal.style.display = "flex";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  function openDeleteModal(id, code) {
    pendingDeleteId = id;
    if (deleteCodeLabel) deleteCodeLabel.textContent = code;
    deleteModal.style.display = "flex";
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModal.style.display = "none";
  }

  // Form Submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const editId = inputEditId.value;
    const code = inputCode.value.trim().toUpperCase();
    const type = inputType.value;
    const val = parseFloat(inputVal.value);
    const minOrder = parseFloat(inputMinOrder.value) || 0;
    const maxDiscount = inputMaxDiscount.value ? parseFloat(inputMaxDiscount.value) : null;
    const limit = parseInt(inputLimit.value, 10) || 100;
    const expiry = inputExpiry.value ? new Date(inputExpiry.value + "T23:59:59").toISOString() : null;
    const active = inputActive.checked;

    if (!code) {
      alert("Please enter a valid coupon code.");
      inputCode.focus();
      return;
    }
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid discount value.");
      inputVal.focus();
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Saving...";

    if (editId) {
      // EDIT MODE
      const idx = sarojiniCoupons.findIndex(c => c.id === editId);
      if (idx !== -1) {
        sarojiniCoupons[idx] = {
          ...sarojiniCoupons[idx],
          code,
          discount_type: type,
          discount_value: val,
          min_order_amount: minOrder,
          max_discount: maxDiscount,
          usage_limit: limit,
          expiry_date: expiry,
          is_active: active,
          updated_at: new Date().toISOString()
        };
      }
      if (typeof window.showToast === "function") {
        window.showToast(`Coupon ${code} updated successfully!`, "success");
      }
    } else {
      // CREATE MODE
      const newCoupon = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "sar-coup-" + Date.now(),
        code,
        discount_type: type,
        discount_value: val,
        min_order_amount: minOrder,
        max_discount: maxDiscount,
        usage_limit: limit,
        used_count: 0,
        expiry_date: expiry,
        is_active: active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      sarojiniCoupons.unshift(newCoupon);
      if (typeof window.showToast === "function") {
        window.showToast(`Sarojini coupon ${code} created successfully!`, "success");
      }
    }

    await syncCouponsToStorage(sarojiniCoupons);
    updateMetrics();
    renderCoupons();

    btnSubmit.disabled = false;
    closeModal();
  });

  // Delete Action
  btnConfirmDelete?.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    const couponToDelete = sarojiniCoupons.find(c => c.id === pendingDeleteId);
    sarojiniCoupons = sarojiniCoupons.filter(c => c.id !== pendingDeleteId);

    // Also delete from Supabase coupons table
    if (couponToDelete) {
      try {
        await client.from("coupons").delete().eq("code", couponToDelete.code);
      } catch (_) {}
    }

    await syncCouponsToStorage(sarojiniCoupons);
    updateMetrics();
    renderCoupons();
    closeDeleteModal();

    if (typeof window.showToast === "function") {
      window.showToast("Coupon deleted permanently.", "info");
    }
  });

  // Event Listeners
  btnAdd?.addEventListener("click", openCreateModal);
  btnClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);
  btnCloseDelete?.addEventListener("click", closeDeleteModal);
  btnCancelDelete?.addEventListener("click", closeDeleteModal);

  modal?.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
  deleteModal?.addEventListener("click", e => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  searchInput?.addEventListener("input", renderCoupons);
  filterStatus?.addEventListener("change", renderCoupons);

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeModal();
      closeDeleteModal();
    }
  });

  await loadSarojiniCoupons();
});

