/**
 * VELORA Admin Panel - Promotional Banners Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const grid = document.getElementById("banners-grid");
  const form = document.getElementById("banner-form");

  async function loadBanners() {
    grid.innerHTML = '<div style="color:var(--admin-text-muted); padding:20px;">Loading promotional banners...</div>';
    const { data: banners } = await client.from("banners").select("*").order("display_order", { ascending: true });

    if (!banners || banners.length === 0) {
      grid.innerHTML = '<div style="color:var(--admin-text-muted); padding:20px;">No promotional banners created. Use the form below to create one.</div>';
      return;
    }

    grid.innerHTML = banners.map(b => `
      <div class="admin-card" style="margin-bottom:0; overflow:hidden; padding:0;">
        <div style="height: 140px; background: url('${b.image_url}') center/cover no-repeat; position: relative;">
          <span class="badge ${b.is_active ? 'badge-success' : 'badge-danger'}" style="position: absolute; top: 10px; right: 10px;">${b.is_active ? 'Live' : 'Hidden'}</span>
        </div>
        <div style="padding: 18px;">
          <h4 style="color:#fff; margin-bottom: 4px;">${b.title}</h4>
          <p style="font-size:0.85rem; color:var(--admin-text-muted); margin-bottom: 12px;">${b.subtitle || ''}</p>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <a href="${b.button_link || 'shop.html'}" target="_blank" style="font-size: 0.8rem; color: var(--admin-accent);">${b.button_text} →</a>
            <button class="btn-admin-danger btn-del-banner" data-id="${b.id}" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
          </div>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".btn-del-banner").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Delete this banner?")) {
          await client.from("banners").delete().eq("id", btn.dataset.id);
          window.showToast("Banner deleted.", "success");
          loadBanners();
        }
      });
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("banner-title").value.trim();
      const subtitle = document.getElementById("banner-subtitle").value.trim();
      const imageUrl = document.getElementById("banner-image").value.trim();
      const btnText = document.getElementById("banner-btn-text").value.trim();
      const btnLink = document.getElementById("banner-btn-link").value.trim();

      const { error } = await client.from("banners").insert([{
        title,
        subtitle,
        image_url: imageUrl,
        button_text: btnText || "Shop Now",
        button_link: btnLink || "shop.html",
        is_active: true
      }]);

      if (error) alert("Error creating banner: " + error.message);
      else {
        window.showToast("Banner created! Displays dynamically on homepage.", "success");
        form.reset();
        loadBanners();
      }
    });
  }

  await loadBanners();
});
