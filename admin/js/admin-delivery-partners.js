/**
 * VELORA Admin Panel - Delivery Partners Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("partners-tbody");

  async function loadPartners() {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading partners...</td></tr>';
    const { data: partners, error } = await client.from("delivery_partners").select("*").order("display_order", { ascending: true });

    if (error || !partners || partners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No partners found.</td></tr>';
      return;
    }

    tbody.innerHTML = partners.map(p => `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap: 10px;">
            <img src="../${p.logo_url}" alt="${p.name}" style="height: 28px; max-width: 80px; object-fit: contain;">
            <strong>${p.name}</strong>
          </div>
        </td>
        <td>${p.tagline || '-'}</td>
        <td><span class="badge badge-indigo">${p.badge_text || 'Active'}</span></td>
        <td><code style="font-size:0.75rem;">${p.tracking_url_template || '-'}</code></td>
        <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Disabled'}</span></td>
        <td>
          <button class="btn-admin-secondary btn-toggle-partner" data-id="${p.id}" data-active="${p.is_active}" style="padding: 4px 8px; font-size: 0.75rem;">
            ${p.is_active ? 'Disable' : 'Enable'}
          </button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-toggle-partner").forEach(b => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        const currentActive = b.dataset.active === "true";
        await client.from("delivery_partners").update({ is_active: !currentActive }).eq("id", id);
        window.showToast("Delivery partner status updated!", "success");
        loadPartners();
      });
    });
  }

  await loadPartners();
});
