/**
 * VELORA Admin Panel - Products Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("products-tbody");
  const searchInput = document.getElementById("search-products");
  const categorySelect = document.getElementById("filter-category");
  const stockSelect = document.getElementById("filter-stock");
  const countBadge = document.getElementById("product-count-badge");

  let allProducts = [];

  // Load Categories into filter
  async function loadCategories() {
    const { data: cats } = await client.from("categories").select("id, name");
    if (cats && categorySelect) {
      cats.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        categorySelect.appendChild(opt);
      });
    }
  }

  // Load Products
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--admin-text-muted);">Loading products from Supabase...</td></tr>';
    
    const { data, error } = await client
      .from("products")
      .select("*, categories(name)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--admin-danger);">Failed to load products: ${error.message}</td></tr>`;
      return;
    }

    allProducts = data || [];
    renderProducts();
  }

  function renderProducts() {
    let filtered = [...allProducts];

    // Search query
    const q = (searchInput?.value || "").trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.slug && p.slug.toLowerCase().includes(q))
      );
    }

    // Category filter
    const catId = categorySelect?.value || "";
    if (catId) {
      filtered = filtered.filter(p => p.category_id === catId);
    }

    // Stock filter
    const stockFilter = stockSelect?.value || "";
    if (stockFilter === "low") filtered = filtered.filter(p => p.stock <= 5);
    if (stockFilter === "out") filtered = filtered.filter(p => p.stock === 0);
    if (stockFilter === "in") filtered = filtered.filter(p => p.stock > 5);

    if (countBadge) countBadge.textContent = `Showing ${filtered.length} of ${allProducts.length} Products`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 40px 20px; color: var(--admin-text-muted);">No products match your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const primaryImage = (p.images && p.images.length > 0) ? p.images[0] : "https://via.placeholder.com/60";
      const catName = p.categories ? p.categories.name : "Uncategorized";
      const activeBadge = p.is_active 
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Inactive</span>';

      const advanceBadge = p.advance_payment_enabled
        ? (p.advance_payment_type === 'percentage'
            ? `<span class="badge badge-indigo" title="Requires ${p.advance_payment_value}% upfront deposit">✓ ${p.advance_payment_value}%</span>`
            : `<span class="badge badge-indigo" title="Requires ${window.formatINR(p.advance_payment_value)} upfront deposit">✓ ${window.formatINR(p.advance_payment_value)}</span>`)
        : '<span style="color: var(--admin-text-muted); font-size: 0.78rem;">—</span>';

      const badgesHtml = [
        p.is_featured ? '<span class="badge badge-warning" style="font-size: 0.68rem;">Featured</span>' : '',
        p.is_new ? '<span class="badge badge-info" style="font-size: 0.68rem;">New</span>' : '',
        p.is_deal ? '<span class="badge badge-danger" style="font-size: 0.68rem;">Deal</span>' : ''
      ].filter(Boolean).join(' ') || '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">—</span>';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap: 12px;">
              <img src="${primaryImage}" alt="${p.name}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--admin-card-border);">
              <div>
                <strong style="color: #fff; font-size: 0.92rem;">${p.name}</strong>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${p.brand || 'VELORA'}</div>
              </div>
            </div>
          </td>
          <td>${catName}</td>
          <td><strong>${window.formatINR(p.price)}</strong></td>
          <td><span style="color: var(--admin-text-muted); text-decoration: line-through;">${p.original_price ? window.formatINR(p.original_price) : '-'}</span></td>
          <td>${advanceBadge}</td>
          <td>
            <span class="badge ${p.stock <= 5 ? 'badge-danger' : 'badge-info'}">${p.stock} in stock</span>
          </td>
          <td>${badgesHtml}</td>
          <td>${activeBadge}</td>
          <td>
            <div style="display:flex; align-items:center; gap: 6px;">
              <a href="edit-product.html?id=${p.id}" class="btn-admin-secondary" style="padding: 5px 10px; font-size: 0.78rem;">Edit</a>
              <button type="button" class="btn-admin-danger btn-delete-product" data-id="${p.id}" data-name="${p.name}" style="padding: 5px 10px; font-size: 0.78rem;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Attach delete listeners
    document.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (confirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`)) {
          btn.disabled = true;
          const { error } = await client.from("products").delete().eq("id", id);
          if (error) {
            alert("Could not delete product: " + error.message);
            btn.disabled = false;
          } else {
            window.showToast(`"${name}" removed successfully.`, "success");
            allProducts = allProducts.filter(p => p.id !== id);
            renderProducts();
          }
        }
      });
    });
  }

  if (searchInput) searchInput.addEventListener("input", renderProducts);
  if (categorySelect) categorySelect.addEventListener("change", renderProducts);
  if (stockSelect) stockSelect.addEventListener("change", renderProducts);

  await loadCategories();
  await loadProducts();
});
