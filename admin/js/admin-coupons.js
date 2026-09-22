/**
 * VELORA Admin Panel - Coupons Controller
 * Full CRUD connected directly to Supabase public.coupons table.
 * Supports Create, Edit, Toggle Active/Inactive, Expiry date, and Confirmed Delete.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("coupons-tbody");
  
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

  let couponsCache = [];
  let pendingDeleteId = null;

  // Format dates for display (e.g. 30 Sep 2026)
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

  // Format dates for date input (YYYY-MM-DD)
  function formatInputDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async function loadCoupons() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px;">Loading coupons...</td></tr>';
    
    const { data: coupons, error } = await client
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--admin-danger);">Error: ${error.message}</td></tr>`;
      return;
    }

    couponsCache = coupons || [];

    if (couponsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px;">No coupons found. Click "Create Coupon" to add one.</td></tr>';
      return;
    }

    tbody.innerHTML = couponsCache.map(c => {
      const discountDisplay = c.discount_type === "percentage" ? `${c.discount_value}%` : window.formatINR(c.discount_value);
      const isPast = c.expiry_date && (new Date(c.expiry_date).getTime() < Date.now());
      
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
          <td><strong style="color:var(--admin-accent); font-family:monospace; font-size:1.05rem;">${c.code}</strong></td>
          <td>${discountDisplay} <span style="font-size:0.75rem; color:var(--admin-text-muted);">(${c.discount_type})</span></td>
          <td>${window.formatINR(c.min_order_amount || 0)}</td>
          <td>${c.max_discount ? window.formatINR(c.max_discount) : '<span style="color:var(--admin-text-muted);">No cap</span>'}</td>
          <td><span style="font-weight:600;">${c.used_count || 0}</span> / ${c.usage_limit || '∞'}</td>
          <td>${formatDisplayDate(c.expiry_date)}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="btn-admin-secondary btn-edit-coupon" data-id="${c.id}" style="padding: 4px 10px; font-size: 0.75rem;">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="btn-admin-danger btn-delete-coupon" data-id="${c.id}" data-code="${c.code}" style="padding: 4px 10px; font-size: 0.75rem;">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind Edit buttons
    document.querySelectorAll(".btn-edit-coupon").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const coupon = couponsCache.find(c => c.id === id);
        if (coupon) openEditModal(coupon);
      });
    });

    // Bind Delete buttons
    document.querySelectorAll(".btn-delete-coupon").forEach(b => {
      b.addEventListener("click", () => {
        openDeleteModal(b.dataset.id, b.dataset.code);
      });
    });

    // Bind Quick Status Toggle
    document.querySelectorAll(".btn-toggle-status").forEach(b => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        const action = b.dataset.action;
        const newStatus = (action === "activate");
        b.disabled = true;

        const { error: updErr } = await client
          .from("coupons")
          .update({ is_active: newStatus, updated_at: new Date().toISOString() })
          .eq("id", id);

        if (updErr) {
          window.showToast("Failed to update status: " + updErr.message, "error");
          b.disabled = false;
        } else {
          window.showToast(`Coupon ${newStatus ? 'activated' : 'deactivated'} successfully!`, "success");
          loadCoupons();
        }
      });
    });
  }

  // Open modal in Create mode
  function openCreateModal() {
    form.reset();
    inputEditId.value = "";
    modalTitle.textContent = "Create Promo Code";
    btnSubmit.textContent = "Create Promo Code";
    inputCode.readOnly = false;
    inputMinOrder.value = "999";
    inputLimit.value = "100";
    inputActive.checked = true;
    modal.classList.add("show");
    setTimeout(() => inputCode.focus(), 50);
  }

  // Open modal in Edit mode
  function openEditModal(coupon) {
    form.reset();
    inputEditId.value = coupon.id;
    modalTitle.textContent = `Edit Promo Code #${coupon.code}`;
    btnSubmit.textContent = "Save Changes";
    inputCode.value = coupon.code || "";
    inputType.value = coupon.discount_type || "percentage";
    inputVal.value = coupon.discount_value || "";
    inputMinOrder.value = coupon.min_order_amount !== null ? coupon.min_order_amount : 0;
    inputMaxDiscount.value = coupon.max_discount || "";
    inputLimit.value = coupon.usage_limit || 100;
    inputExpiry.value = formatInputDate(coupon.expiry_date);
    inputActive.checked = coupon.is_active !== false;

    modal.classList.add("show");
  }

  function closeModal() {
    modal.classList.remove("show");
    form.reset();
    inputEditId.value = "";
  }

  // Delete modal functions
  function openDeleteModal(id, code) {
    pendingDeleteId = id;
    deleteCodeLabel.textContent = `#${code}`;
    deleteModal.classList.add("show");
  }

  function closeDeleteModal() {
    deleteModal.classList.remove("show");
    pendingDeleteId = null;
  }

  if (btnAdd) btnAdd.addEventListener("click", openCreateModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (btnCloseDelete) btnCloseDelete.addEventListener("click", closeDeleteModal);
  if (btnCancelDelete) btnCancelDelete.addEventListener("click", closeDeleteModal);

  // Confirm delete handler
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      btnConfirmDelete.disabled = true;
      btnConfirmDelete.textContent = "Deleting...";

      const { error: delErr } = await client
        .from("coupons")
        .delete()
        .eq("id", pendingDeleteId);

      if (delErr) {
        alert("Failed to delete coupon: " + delErr.message);
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = "Delete Coupon";
      } else {
        window.showToast("Coupon permanently deleted.", "success");
        closeDeleteModal();
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = "Delete Coupon";
        await loadCoupons();
      }
    });
  }

  // Form Submit Handler (Handles Create & Edit)
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const editId = inputEditId.value.trim();
      const code = inputCode.value.trim().toUpperCase();
      const type = inputType.value;
      const val = parseFloat(inputVal.value);
      const minOrder = parseFloat(inputMinOrder.value) || 0;
      const maxDiscount = inputMaxDiscount.value ? parseFloat(inputMaxDiscount.value) : null;
      const usageLimit = parseInt(inputLimit.value, 10) || 100;
      const expiryVal = inputExpiry.value ? new Date(inputExpiry.value + "T23:59:59.999Z").toISOString() : null;
      const isActive = inputActive.checked;

      if (!code) {
        alert("Coupon code is required.");
        return;
      }

      if (isNaN(val) || val <= 0) {
        alert("Please enter a valid discount value greater than 0.");
        return;
      }

      if (type === "percentage" && val > 100) {
        alert("Percentage discount cannot exceed 100%.");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = editId ? "Updating..." : "Creating...";

      if (editId) {
        // UPDATE existing coupon row (never creates a second coupon)
        const payload = {
          code,
          discount_type: type,
          discount_value: val,
          min_order_amount: minOrder,
          max_discount: maxDiscount,
          usage_limit: usageLimit,
          expiry_date: expiryVal,
          is_active: isActive,
          updated_at: new Date().toISOString()
        };

        const { error: updErr } = await client
          .from("coupons")
          .update(payload)
          .eq("id", editId);

        btnSubmit.disabled = false;
        btnSubmit.textContent = "Save Changes";

        if (updErr) {
          alert("Failed to update coupon: " + updErr.message);
        } else {
          window.showToast(`Coupon ${code} updated successfully!`, "success");
          closeModal();
          await loadCoupons();
        }
      } else {
        // CREATE new coupon in Supabase
        const payload = {
          code,
          discount_type: type,
          discount_value: val,
          min_order_amount: minOrder,
          max_discount: maxDiscount,
          usage_limit: usageLimit,
          expiry_date: expiryVal,
          is_active: isActive
        };

        const { error: insErr } = await client
          .from("coupons")
          .insert([payload]);

        btnSubmit.disabled = false;
        btnSubmit.textContent = "Create Promo Code";

        if (insErr) {
          alert("Failed to create coupon: " + insErr.message);
        } else {
          window.showToast(`Coupon ${code} created successfully!`, "success");
          closeModal();
          await loadCoupons();
        }
      }
    });
  }

  await loadCoupons();
});
