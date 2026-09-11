/**
 * VELORA Admin Panel - Coupons Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("coupons-tbody");
  const modal = document.getElementById("coupon-modal-backdrop");
  const btnAdd = document.getElementById("btn-add-coupon");
  const btnClose = document.getElementById("btn-close-coupon-modal");
  const form = document.getElementById("coupon-form");

  async function loadCoupons() {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Loading coupons...</td></tr>';
    const { data: coupons, error } = await client
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--admin-danger);">Error: ${error.message}</td></tr>`;
      return;
    }

    if (!coupons || coupons.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">No coupons found. Click "Create Coupon" to add one.</td></tr>';
      return;
    }

    tbody.innerHTML = coupons.map(c => {
      const discountDisplay = c.discount_type === "percentage" ? `${c.discount_value}%` : window.formatINR(c.discount_value);
      const activeBadge = c.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>';
      return `
        <tr>
          <td><strong style="color:var(--admin-accent); font-family:monospace; font-size:1rem;">${c.code}</strong></td>
          <td>${discountDisplay} (${c.discount_type})</td>
          <td>${window.formatINR(c.min_order_amount || 0)}</td>
          <td>${c.max_discount ? window.formatINR(c.max_discount) : 'No cap'}</td>
          <td>${c.used_count} / ${c.usage_limit}</td>
          <td>${activeBadge}</td>
          <td>
            <button class="btn-admin-danger btn-delete-coupon" data-id="${c.id}" data-code="${c.code}" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".btn-delete-coupon").forEach(b => {
      b.addEventListener("click", async () => {
        if (confirm(`Delete promo code "${b.dataset.code}"?`)) {
          await client.from("coupons").delete().eq("id", b.dataset.id);
          window.showToast("Coupon removed.", "success");
          loadCoupons();
        }
      });
    });
  }

  if (btnAdd && modal) btnAdd.addEventListener("click", () => modal.classList.add("show"));
  if (btnClose && modal) btnClose.addEventListener("click", () => modal.classList.remove("show"));

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("coupon-code").value.trim().toUpperCase();
      const type = document.getElementById("coupon-type").value;
      const val = parseFloat(document.getElementById("coupon-val").value);
      const minOrder = parseFloat(document.getElementById("coupon-min-order").value) || 0;
      const maxDiscount = parseFloat(document.getElementById("coupon-max-discount").value) || null;
      const usageLimit = parseInt(document.getElementById("coupon-limit").value, 10) || 100;
      const isActive = document.getElementById("coupon-active").checked;

      const { error } = await client.from("coupons").insert([{
        code,
        discount_type: type,
        discount_value: val,
        min_order_amount: minOrder,
        max_discount: maxDiscount,
        usage_limit: usageLimit,
        is_active: isActive
      }]);

      if (error) {
        alert("Failed to create coupon: " + error.message);
      } else {
        window.showToast(`Coupon ${code} created!`, "success");
        modal.classList.remove("show");
        form.reset();
        loadCoupons();
      }
    });
  }

  await loadCoupons();
});
