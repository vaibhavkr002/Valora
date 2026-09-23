/**
 * VADI Admin Panel - Sarojini Products Controller
 * Manages product list, search, multi-faceted filtering, cross-store availability,
 * status toggle, duplicate, and deletion.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("products-tbody");
  const countBadge = document.getElementById("product-count-badge");
  const searchInput = document.getElementById("search-products");
  const filterDept = document.getElementById("filter-dept");
  const filterCategory = document.getElementById("filter-category");
  const filterStatus = document.getElementById("filter-status");
  const filterStock = document.getElementById("filter-stock");
  const filterAvailability = document.getElementById("filter-availability");

  const deleteModal = document.getElementById("delete-product-modal");
  const btnCloseDelModal = document.getElementById("btn-close-del-modal");
  const btnCancelDel = document.getElementById("btn-cancel-del");
  const btnConfirmDel = document.getElementById("btn-confirm-del");
  const delProductName = document.getElementById("del-product-name");

  let allProducts = [];
  let allCategories = [];
  let mainCategories = [];
  let crossStoreMapping = {
    main_available_in_sarojini: {},
    sarojini_available_in_main: {},
    main_to_sarojini: {},
    sarojini_to_main: {}
  };
  let prodToDelete = null;
  let prodToAddToMain = null;
  let selectedProductIds = new Set();

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  function formatINR(amount) {
    if (typeof window.formatINR === 'function') return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  function invalidateSarojiniCache() {
    try {
      sessionStorage.removeItem("velora_sarojini_catalog_cache_v1");
      localStorage.removeItem("velora_sarojini_catalog_cache_v1");
      localStorage.setItem("sarojini_global_cache_invalidated", Date.now().toString());
    } catch (_) {}
  }

  // Load Categories for dropdown & Main Categories for cross-store transfer modal
  async function loadCategories() {
    try {
      const { data } = await client.from("sarojini_categories").select("id, name, department, slug").eq("is_active", true);
      if (Array.isArray(data) && data.length > 0) {
        allCategories = data;
      } else {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_categories").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) allCategories = sRow.value;
      }
    } catch (_) {}

    try {
      const { data: mCats } = await client.from("categories").select("id, name").order("name");
      if (Array.isArray(mCats)) mainCategories = mCats;
    } catch (_) {}

    updateCategoryFilterDropdown();
  }

  function updateCategoryFilterDropdown() {
    if (!filterCategory) return;
    const selectedDept = (filterDept?.value || "").toUpperCase();
    const filteredCats = selectedDept 
      ? allCategories.filter(c => (c.department || "").toUpperCase() === selectedDept) 
      : allCategories;
    
    filterCategory.innerHTML = '<option value="">All Categories</option>' + 
      filteredCats.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.department)})</option>`).join("");
  }

  // Load Products & Cross-Store Availability
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 32px;"><i class="fas fa-spinner fa-spin"></i> Loading Sarojini products...</td></tr>';

    try {
      if (window.CrossStoreService) {
        crossStoreMapping = await window.CrossStoreService.getMapping(client);
      }
    } catch (mErr) {
      console.warn("[Sarojini Products] Could not load mapping:", mErr);
    }

    let sarojiniItems = [];
    let fetchError = null;

    // 1. Fetch Sarojini products from database
    try {
      const { data, error } = await client
        .from("sarojini_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        fetchError = error;
      } else if (Array.isArray(data)) {
        sarojiniItems = data;
      }
    } catch (e) {
      fetchError = e;
    }

    // Fallback to store_settings if table returned 0 and no hard error
    if (!fetchError && sarojiniItems.length === 0) {
      try {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          sarojiniItems = sRow.value;
        }
      } catch (_) {}
    }

    if (fetchError && sarojiniItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px 20px; color: var(--admin-danger);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">⚠️</div>
            <h4 style="margin: 0 0 6px 0;">Failed to Load Sarojini Products</h4>
            <p style="margin: 0 0 16px 0; font-size: 0.85rem; color: var(--admin-text-muted);">${escapeHtml(fetchError.message || String(fetchError))}</p>
            <button type="button" id="btn-retry-sarojini-products" class="btn-admin-secondary" style="display:inline-flex; align-items:center; gap:6px;">
              <i class="fas fa-redo"></i> Retry Loading
            </button>
          </td>
        </tr>
      `;
      const retryBtn = document.getElementById("btn-retry-sarojini-products");
      if (retryBtn) retryBtn.addEventListener("click", loadProducts);
      if (countBadge) countBadge.textContent = "0";
      return;
    }

    // Map native Sarojini products
    const mapped = sarojiniItems.map(p => {
      const isAvailableInMain = Boolean(crossStoreMapping.sarojini_available_in_main?.[p.id]?.available);
      return {
        ...p,
        origin_catalog: 'sarojini',
        is_in_sarojini: true,
        is_in_main: isAvailableInMain
      };
    });

    // 2. Fetch any Main VADI products that are made available in Sarojini Bazaar
    const mainAvailableIds = Object.keys(crossStoreMapping.main_available_in_sarojini || {})
      .filter(id => crossStoreMapping.main_available_in_sarojini[id]?.available);

    if (mainAvailableIds.length > 0) {
      try {
        const { data: mainProductsData } = await client
          .from("products")
          .select("*")
          .in("id", mainAvailableIds);

        if (Array.isArray(mainProductsData)) {
          mainProductsData.forEach(mp => {
            const assignment = crossStoreMapping.main_available_in_sarojini[mp.id] || {};
            mapped.push({
              ...mp,
              origin_catalog: 'main',
              department: assignment.department || 'MEN',
              category_id: assignment.category_id || mp.category_id,
              is_featured: (assignment.is_featured !== undefined) ? assignment.is_featured : mp.is_featured,
              is_in_sarojini: true,
              is_in_main: true
            });
          });
        }
      } catch (crossErr) {
        console.warn("[Sarojini Products] Failed to load cross-store Main products:", crossErr);
      }
    }

    allProducts = mapped;
    renderProducts();
  }

  // Render Table
  function renderProducts() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const dept = (filterDept?.value || "").toUpperCase();
    const cat = filterCategory?.value || "";
    const status = filterStatus?.value || "";
    const stock = filterStock?.value || "";
    const avail = filterAvailability?.value || "";

    const filtered = allProducts.filter(p => {
      // Keyword search
      if (query) {
        const matchesName = p.name && p.name.toLowerCase().includes(query);
        const matchesSlug = p.slug && p.slug.toLowerCase().includes(query);
        const matchesBrand = p.brand && p.brand.toLowerCase().includes(query);
        if (!matchesName && !matchesSlug && !matchesBrand) return false;
      }

      // Department
      if (dept && (p.department || "").toUpperCase() !== dept) return false;

      // Category match
      if (cat) {
        const matchCat = allCategories.find(c => c.id === cat || c.slug === cat);
        const targetId = matchCat ? matchCat.id : cat;
        const targetSlug = matchCat ? matchCat.slug : cat;
        if (p.category_id !== targetId && p.category_id !== targetSlug && p.category_slug !== targetSlug) {
          return false;
        }
      }

      // Status
      if (status === "active" && !p.is_active) return false;
      if (status === "inactive" && p.is_active) return false;

      // Stock
      if (stock === "out" && (Number(p.stock) || 0) > 0) return false;
      if (stock === "low" && ((Number(p.stock) || 0) > 5 || (Number(p.stock) || 0) === 0)) return false;

      // Store Availability
      if (avail === "sarojini" || avail === "sarojini_only") {
        if (!p.is_in_sarojini || p.is_in_main) return false;
      } else if (avail === "main") {
        if (!p.is_in_main) return false;
      } else if (avail === "both") {
        if (!p.is_in_sarojini || !p.is_in_main) return false;
      }

      return true;
    });

    if (countBadge) countBadge.textContent = filtered.length;

    if (allProducts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 48px 20px; color: var(--admin-text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🛍️</div>
            <h4 style="margin: 0 0 6px 0; color: #fff;">No Sarojini Products Yet</h4>
            <p style="margin: 0 0 16px 0; font-size: 0.85rem;">Add your first Sarojini Bazaar product or make Main store products available here.</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <a href="sarojini-add-product.html" class="btn-admin-primary" style="background:#e11d48; border-color:#e11d48; display:inline-flex;">
                <i class="fas fa-plus"></i> Add First Sarojini Product
              </a>
              <button type="button" class="btn-admin-secondary" onclick="window.SarojiniBulkImport && window.SarojiniBulkImport.openModal()" style="display:inline-flex;">
                <i class="fas fa-file-import"></i> Bulk Import
              </button>
            </div>
          </td>
        </tr>
      `;
      updateBulkToolbar();
      return;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px 20px; color: var(--admin-text-muted);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
            <h4 style="margin: 0 0 6px 0; color: #fff;">No Matching Products</h4>
            <p style="margin: 0; font-size: 0.85rem;">No products match the selected filters. Try adjusting your search or filters.</p>
          </td>
        </tr>
      `;
      updateBulkToolbar();
      return;
    }

    tbody.innerHTML = filtered.map(prod => {
      const firstImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
        ? window.VeloraImageUtils.resolveProductImage(prod, { isAdmin: true })
        : (Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : (prod.image || '../assets/sarojni/prod-1-graphic-tee.png'));
      const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : '../assets/sarojni/prod-1-graphic-tee.png';
      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);
      const stockNum = Number(prod.stock) || 0;

      let stockBadge = `<span class="badge badge-success">${stockNum} in stock</span>`;
      if (stockNum === 0) {
        stockBadge = `<span class="badge badge-danger">Out of Stock</span>`;
      } else if (stockNum <= 5) {
        stockBadge = `<span class="badge badge-warning">Low: ${stockNum} left</span>`;
      }

      const statusBadge = prod.is_active
        ? `<button type="button" class="btn-toggle-status badge badge-success" data-id="${prod.id}" data-origin="${prod.origin_catalog}" style="cursor:pointer; border:none;" title="Active on storefront (Click to Draft)">Active</button>`
        : `<button type="button" class="btn-toggle-status badge badge-warning" data-id="${prod.id}" data-origin="${prod.origin_catalog}" style="cursor:pointer; border:none; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="Unpublished Draft (Click to Publish)">Draft</button>`;

      const promoBadges = [];
      promoBadges.push(prod.is_featured
        ? `<button type="button" class="btn-toggle-featured badge badge-amber" data-id="${prod.id}" data-origin="${prod.origin_catalog}" style="cursor:pointer; border:none; font-size:0.68rem;" title="Click to remove from Homepage">⭐ Featured</button>`
        : `<button type="button" class="btn-toggle-featured badge badge-secondary" data-id="${prod.id}" data-origin="${prod.origin_catalog}" style="cursor:pointer; border:none; font-size:0.68rem; opacity:0.6;" title="Click to feature on Homepage">☆ Feature</button>`
      );
      if (prod.is_deal) promoBadges.push('<span class="badge badge-pink" style="font-size:0.65rem;">Deal</span>');
      if (prod.is_new) promoBadges.push('<span class="badge badge-cyan" style="font-size:0.65rem;">New</span>');

      const catObj = allCategories.find(c => String(c.id) === String(prod.category_id));

      const isBoth = prod.is_in_sarojini && prod.is_in_main;

      let availHtml = '';
      if (isBoth) {
        availHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
              <span class="badge badge-pink" style="font-size: 0.72rem; background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.3); display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-store"></i> Sarojini Bazaar ✓
              </span>
              <span class="badge badge-success" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="Connected to Main VADI Store">
                <i class="fas fa-check-circle"></i> Main Store ✓
              </span>
            </div>
            <div>
              ${prod.origin_catalog === 'sarojini'
                ? `<button type="button" class="btn-admin-danger btn-remove-from-main" data-id="${prod.id}" data-name="${escapeHtml(prod.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Main VADI Store">
                     <i class="fas fa-times"></i> Remove from Main Store
                   </button>`
                : `<button type="button" class="btn-admin-danger btn-remove-from-sarojini" data-id="${prod.id}" data-name="${escapeHtml(prod.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Sarojini Bazaar">
                     <i class="fas fa-times"></i> Remove from Sarojini
                   </button>`
              }
            </div>
          </div>
        `;
      } else {
        // Sarojini only
        availHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="badge badge-pink" style="font-size: 0.72rem; background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.3); display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
              <i class="fas fa-store"></i> Sarojini Bazaar ✓
            </span>
            <button type="button" class="btn-admin-secondary btn-open-add-to-main" data-id="${prod.id}" style="padding: 3px 8px; font-size: 0.72rem; border-color: rgba(99, 102, 241, 0.4); color: #818cf8; width: fit-content; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fas fa-plus"></i> Add to Main Store
            </button>
          </div>
        `;
      }

      const editUrl = prod.origin_catalog === 'main'
        ? `edit-product.html?id=${encodeURIComponent(prod.id)}`
        : `sarojini-add-product.html?id=${encodeURIComponent(prod.id)}`;

      return `
        <tr data-prod-id="${prod.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="row-select-prod" data-id="${prod.id}" ${selectedProductIds.has(String(prod.id)) ? 'checked' : ''}>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap: 12px;">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: contain; background: #f8fafc; padding: 2px;" onerror="this.onerror=null; this.src='${fallbackSvg}';">
              <div>
                <a href="${editUrl}" style="font-weight: 700; color: var(--admin-text); text-decoration: none; font-size: 0.9rem;">${escapeHtml(prod.name)}</a>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(prod.brand || 'Sarojini Bazaar')} • <code>${escapeHtml(prod.slug || '')}</code></div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge badge-indigo">${escapeHtml(prod.department || 'BAZAAR')}</span>
            ${catObj ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 2px;">${escapeHtml(catObj.name)}</div>` : ''}
          </td>
          <td><strong>${formatINR(price)}</strong></td>
          <td>
            <span style="color: var(--admin-text-muted); font-size: 0.85rem; text-decoration: line-through;">${formatINR(origPrice)}</span>
            ${discount > 0 ? `<span style="font-size: 0.72rem; color: #10b981; font-weight: 700; margin-left: 4px;">${discount}% OFF</span>` : ''}
          </td>
          <td>${stockBadge}</td>
          <td><div style="display:flex; gap: 4px; flex-wrap: wrap;">${promoBadges.length > 0 ? promoBadges.join('') : '-'}</div></td>
          <td>${statusBadge}</td>
          <td>${availHtml}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <a href="${editUrl}" class="btn-admin-secondary" style="padding: 4px 8px; font-size: 0.75rem;" title="Edit Product">
                <i class="fas fa-edit"></i>
              </a>
              ${prod.origin_catalog === 'sarojini' ? `
                <button type="button" class="btn-admin-secondary btn-duplicate-prod" data-id="${prod.id}" style="padding: 4px 8px; font-size: 0.75rem;" title="Duplicate Product">
                  <i class="fas fa-copy"></i>
                </button>
              ` : ''}
              <button type="button" class="btn-admin-danger btn-delete-prod" data-id="${prod.id}" data-origin="${prod.origin_catalog}" data-name="${escapeHtml(prod.name)}" style="padding: 4px 8px; font-size: 0.75rem;" title="Delete or Remove Product">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire Table Selection Checkboxes
    const thSelectAll = document.getElementById("th-select-all-prods");
    if (thSelectAll) {
      thSelectAll.checked = filtered.length > 0 && filtered.every(p => selectedProductIds.has(String(p.id)));
      thSelectAll.onchange = () => {
        const isChecked = thSelectAll.checked;
        filtered.forEach(p => {
          if (isChecked) selectedProductIds.add(String(p.id));
          else selectedProductIds.delete(String(p.id));
        });
        tbody.querySelectorAll(".row-select-prod").forEach(cb => cb.checked = isChecked);
        updateBulkToolbar();
      };
    }

    tbody.querySelectorAll(".row-select-prod").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = String(cb.dataset.id);
        if (cb.checked) selectedProductIds.add(id);
        else selectedProductIds.delete(id);
        updateBulkToolbar();
      });
    });

    updateBulkToolbar();

    // Wire Status Toggle
    tbody.querySelectorAll(".btn-toggle-status").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const origin = btn.getAttribute("data-origin");
        const item = allProducts.find(p => String(p.id) === String(id));
        if (!item) return;

        const newStatus = !item.is_active;
        const targetTable = (origin === "main") ? "products" : "sarojini_products";
        try {
          const { error } = await client.from(targetTable).update({
            is_active: newStatus,
            updated_at: new Date().toISOString()
          }).eq("id", item.id);

          if (error) throw error;

          item.is_active = newStatus;
          if (!newStatus) {
            await syncProductFeaturedToSection(client, item.id, false);
          }
          invalidateSarojiniCache();
          renderProducts();
          window.showToast(`Product "${item.name}" marked ${item.is_active ? 'Active' : 'Disabled'}.`, "success");
        } catch (err) {
          console.error("Status toggle error:", err);
          window.showToast("Failed to update status: " + err.message, "danger");
        }
      });
    });

    // Wire Featured Toggle
    tbody.querySelectorAll(".btn-toggle-featured").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const origin = btn.getAttribute("data-origin");
        const item = allProducts.find(p => String(p.id) === String(id));
        if (!item) return;

        const newFeatured = !item.is_featured;
        try {
          if (origin === "main") {
            // Update mapping assignment for this main product in Sarojini
            if (crossStoreMapping.main_available_in_sarojini?.[item.id]) {
              crossStoreMapping.main_available_in_sarojini[item.id].is_featured = newFeatured;
              await window.CrossStoreService.saveMapping(client, crossStoreMapping);
            }
          } else {
            const { error } = await client.from("sarojini_products").update({
              is_featured: newFeatured,
              updated_at: new Date().toISOString()
            }).eq("id", item.id);
            if (error) throw error;
          }

          item.is_featured = newFeatured;
          await syncProductFeaturedToSection(client, item.id, newFeatured);
          invalidateSarojiniCache();
          renderProducts();
          window.showToast(`Product "${item.name}" ${newFeatured ? 'marked Featured on Homepage' : 'removed from Homepage'}.`, "success");
        } catch (err) {
          console.error("Featured toggle error:", err);
          window.showToast("Failed to update featured status: " + err.message, "danger");
        }
      });
    });

    // Wire Duplicate (Sarojini products only)
    tbody.querySelectorAll(".btn-duplicate-prod").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const original = allProducts.find(p => String(p.id) === String(id));
        if (!original) return;

        const clone = {
          category_id: original.category_id,
          subcategory_id: original.subcategory_id || null,
          department: original.department || "MEN",
          name: `${original.name} (Copy)`,
          slug: `${original.slug || 'prod'}-copy-${Date.now().toString().slice(-4)}`,
          brand: original.brand || "Sarojini Bazaar",
          description: original.description || "",
          price: original.price || 0,
          original_price: original.original_price || original.price || 0,
          discount_percentage: original.discount_percentage || 0,
          rating: original.rating || 4.5,
          review_count: original.review_count || 0,
          stock: original.stock || 0,
          sizes: original.sizes || [],
          colors: original.colors || [],
          images: original.images || [],
          specifications: original.specifications || {},
          shipping_info: original.shipping_info || {},
          return_policy: original.return_policy || "",
          is_featured: false,
          is_new: Boolean(original.is_new),
          is_deal: Boolean(original.is_deal),
          is_active: Boolean(original.is_active),
          advance_payment_enabled: Boolean(original.advance_payment_enabled),
          advance_payment_type: original.advance_payment_type || "percentage",
          advance_payment_value: original.advance_payment_value || 0
        };

        try {
          const { data: inserted, error } = await client.from("sarojini_products").insert([clone]).select().single();
          if (error) throw error;

          const createdItem = inserted || clone;
          createdItem.origin_catalog = 'sarojini';
          createdItem.is_in_sarojini = true;
          createdItem.is_in_main = false;

          allProducts.unshift(createdItem);
          invalidateSarojiniCache();
          renderProducts();
          window.showToast(`Duplicated "${original.name}".`, "success");
        } catch (err) {
          console.error("Duplicate product error:", err);
          window.showToast("Failed to duplicate product: " + err.message, "danger");
        }
      });
    });

    // Wire Delete / Remove
    tbody.querySelectorAll(".btn-delete-prod").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.getAttribute("data-id");
        const origin = btn.getAttribute("data-origin");
        const prodName = btn.getAttribute("data-name");

        if (origin === "main") {
          if (confirm(`"${prodName}" is a Main VADI product available in Sarojini Bazaar. Remove availability from Sarojini Bazaar? The product will remain active in Main VADI Store.`)) {
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "main",
                productId: prodId,
                targetStore: "sarojini"
              });
              window.showToast(`Removed "${prodName}" from Sarojini Bazaar.`, "info");
              await loadProducts();
            } catch (err) {
              console.error("Remove from Sarojini failed:", err);
              alert("Failed to remove product from Sarojini: " + err.message);
            }
          }
          return;
        }

        // Native Sarojini product
        prodToDelete = { id: prodId, name: prodName };
        delProductName.textContent = prodToDelete.name;
        deleteModal.style.display = "flex";
      });
    });

    // Wire Add to Main modal openers
    tbody.querySelectorAll(".btn-open-add-to-main").forEach(btn => {
      btn.addEventListener("click", () => {
        const prodId = btn.getAttribute("data-id");
        const prod = allProducts.find(p => String(p.id) === String(prodId));
        if (prod) openAddToMainModal(prod);
      });
    });

    // Wire Remove from Main handlers
    tbody.querySelectorAll(".btn-remove-from-main").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.getAttribute("data-id");
        const prodName = btn.getAttribute("data-name");
        if (confirm(`Remove "${prodName}" from Main VADI Store? The product will remain active in Sarojini Bazaar.`)) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "sarojini",
              productId: prodId,
              targetStore: "main"
            });
            window.showToast(`Removed "${prodName}" from Main VADI Store.`, "info");
            await loadProducts();
          } catch (err) {
            console.error("Remove from Main failed:", err);
            alert("Failed to remove product from Main Store: " + err.message);
            btn.disabled = false;
            btn.textContent = "✕ Remove from Main Store";
          }
        }
      });
    });

    // Wire Remove from Sarojini handlers
    tbody.querySelectorAll(".btn-remove-from-sarojini").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.getAttribute("data-id");
        const prodName = btn.getAttribute("data-name");
        if (confirm(`Remove "${prodName}" from Sarojini Bazaar? The product will remain active in Main VADI Store.`)) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "main",
              productId: prodId,
              targetStore: "sarojini"
            });
            window.showToast(`Removed "${prodName}" from Sarojini Bazaar.`, "info");
            await loadProducts();
          } catch (err) {
            console.error("Remove from Sarojini failed:", err);
            alert("Failed to remove product from Sarojini: " + err.message);
            btn.disabled = false;
            btn.textContent = "✕ Remove from Sarojini";
          }
        }
      });
    });
  }

  // ==========================================================================
  // Cross-Store Transfer Modal to Main VADI Store
  // ==========================================================================
  const mainModal = document.getElementById("modal-add-to-main");
  const btnCloseMainModal = document.getElementById("btn-close-main-modal");
  const btnCancelMainModal = document.getElementById("btn-cancel-main-modal");
  const btnConfirmAddToMain = document.getElementById("btn-confirm-add-to-main");
  const mainModalCat = document.getElementById("main-modal-cat");
  const mainModalFeatured = document.getElementById("main-modal-featured");
  const mainModalImg = document.getElementById("main-modal-img");
  const mainModalTitle = document.getElementById("main-modal-title");
  const mainModalPrice = document.getElementById("main-modal-price");
  const mainModalStock = document.getElementById("main-modal-stock");

  function openAddToMainModal(product) {
    prodToAddToMain = product;
    if (mainModalTitle) mainModalTitle.textContent = product.name;
    if (mainModalPrice) mainModalPrice.textContent = formatINR(product.price);
    if (mainModalStock) mainModalStock.textContent = `${product.stock} units`;
    if (mainModalImg) {
      const thumb = (Array.isArray(product.images) && product.images.length > 0) ? product.images[0] : (product.image || "https://via.placeholder.com/50");
      mainModalImg.src = thumb;
    }
    if (mainModalFeatured) mainModalFeatured.checked = false;

    // Populate category dropdown
    if (mainModalCat) {
      if (mainCategories.length === 0) {
        mainModalCat.innerHTML = '<option value="">No categories available</option>';
      } else {
        mainModalCat.innerHTML = mainCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
      }
    }

    if (mainModal) mainModal.style.display = "flex";
  }

  function closeAddToMainModal() {
    if (mainModal) mainModal.style.display = "none";
    prodToAddToMain = null;
  }

  if (btnCloseMainModal) btnCloseMainModal.addEventListener("click", closeAddToMainModal);
  if (btnCancelMainModal) btnCancelMainModal.addEventListener("click", closeAddToMainModal);

  if (btnConfirmAddToMain) {
    btnConfirmAddToMain.addEventListener("click", async () => {
      if (!prodToAddToMain) return;
      btnConfirmAddToMain.disabled = true;
      btnConfirmAddToMain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding to Main...';

      try {
        const catId = mainModalCat?.value || null;
        const isFeatured = Boolean(mainModalFeatured?.checked);

        const res = await window.CrossStoreService.addSarojiniToMain(client, prodToAddToMain, {
          categoryId: catId,
          isFeatured: isFeatured
        });

        if (res.alreadyExists) {
          window.showToast(res.message, "info");
        } else {
          window.showToast(res.message, "success");
        }

        closeAddToMainModal();
        await loadProducts();
      } catch (err) {
        console.error("Add to Main error:", err);
        alert("Failed to make product available in Main VADI Store: " + (err.message || err));
      } finally {
        btnConfirmAddToMain.disabled = false;
        btnConfirmAddToMain.innerHTML = '<i class="fas fa-check"></i> Confirm &amp; Add to Main Store';
      }
    });
  }

  // Filter Listeners
  searchInput?.addEventListener("input", renderProducts);
  filterDept?.addEventListener("change", () => {
    updateCategoryFilterDropdown();
    renderProducts();
  });
  filterCategory?.addEventListener("change", renderProducts);
  filterStatus?.addEventListener("change", renderProducts);
  filterStock?.addEventListener("change", renderProducts);
  filterAvailability?.addEventListener("change", renderProducts);

  // Delete Modal Controls
  if (btnCloseDelModal) btnCloseDelModal.addEventListener("click", closeDelModal);
  if (btnCancelDel) btnCancelDel.addEventListener("click", closeDelModal);

  function closeDelModal() {
    if (deleteModal) deleteModal.style.display = "none";
    prodToDelete = null;
  }

  if (btnConfirmDel) {
    btnConfirmDel.addEventListener("click", async () => {
      if (!prodToDelete) return;
      btnConfirmDel.disabled = true;
      btnConfirmDel.textContent = "Deleting...";

      try {
        // Also remove from cross_store_mapping if present
        try {
          await window.CrossStoreService.removeFromStore(client, {
            originCatalog: "sarojini",
            productId: prodToDelete.id,
            targetStore: "main"
          });
        } catch (_) {}

        const { error } = await client.from("sarojini_products").delete().eq("id", prodToDelete.id);
        if (error) throw error;

        allProducts = allProducts.filter(p => String(p.id) !== String(prodToDelete.id));
        invalidateSarojiniCache();

        window.showToast(`Deleted product "${prodToDelete.name}".`, "info");
        closeDelModal();
        renderProducts();
      } catch (err) {
        console.error("Delete product error:", err);
        window.showToast("Failed to delete product: " + err.message, "danger");
      } finally {
        btnConfirmDel.disabled = false;
        btnConfirmDel.textContent = "Delete";
      }
    });
  }

  async function syncProductFeaturedToSection(client, productId, isFeatured) {
    try {
      const SAROJINI_SEC_ID = '22222222-2222-4222-a222-000000000001';
      const { data: sec } = await client.from('homepage_sections').select('*').eq('id', SAROJINI_SEC_ID).maybeSingle();
      if (!sec) return;
      const cfg = sec.content_config || {};
      let pids = Array.isArray(cfg.product_ids) ? [...cfg.product_ids] : [];
      if (isFeatured) {
        if (!pids.includes(productId)) pids.unshift(productId);
      } else {
        pids = pids.filter(id => String(id) !== String(productId));
      }
      cfg.product_ids = pids;
      cfg.limit = Math.max(6, pids.length);
      await client.from('homepage_sections').update({
        content_config: cfg,
        updated_at: new Date().toISOString()
      }).eq('id', SAROJINI_SEC_ID);

      await client.from('store_settings').upsert({
        key: 'sarojini_featured_section',
        value: { ...sec, content_config: cfg },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Sync to homepage_sections error:', e);
    }
  }

  // ==========================================================================
  // BULK ACTIONS TOOLBAR CONTROLLER (Publish, Draft, Delete)
  // ==========================================================================
  const bulkToolbar = document.getElementById("bulk-actions-toolbar");
  const bulkCountSpan = document.getElementById("bulk-selected-count");
  const btnBulkPublish = document.getElementById("btn-bulk-publish");
  const btnBulkDraft = document.getElementById("btn-bulk-draft");
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  const btnBulkDeselect = document.getElementById("btn-bulk-deselect");

  function updateBulkToolbar() {
    if (!bulkToolbar || !bulkCountSpan) return;
    const count = selectedProductIds.size;
    if (count > 0) {
      bulkToolbar.style.display = "flex";
      bulkCountSpan.textContent = `${count} Selected`;
    } else {
      bulkToolbar.style.display = "none";
    }
  }

  btnBulkPublish?.addEventListener("click", async () => {
    const count = selectedProductIds.size;
    if (count === 0) return;
    if (!confirm(`You are about to publish ${count} Sarojini products.\n\nThey will immediately become live and visible to customers on Sarojini Bazaar. Confirm?`)) {
      return;
    }

    btnBulkPublish.disabled = true;
    btnBulkPublish.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

    try {
      const ids = Array.from(selectedProductIds);
      const { error } = await client
        .from("sarojini_products")
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .in("id", ids);

      if (error) throw error;

      invalidateSarojiniCache();
      window.showToast?.(`Published ${count} Sarojini products successfully!`, "success");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk publish error:", err);
      window.showToast?.("Failed to publish products: " + err.message, "danger");
    } finally {
      btnBulkPublish.disabled = false;
      btnBulkPublish.innerHTML = '<i class="fas fa-rocket"></i> Publish Selected';
    }
  });

  btnBulkDraft?.addEventListener("click", async () => {
    const count = selectedProductIds.size;
    if (count === 0) return;
    if (!confirm(`Move ${count} selected products to Draft (Inactive)?\n\nThey will be hidden from the customer storefront.`)) {
      return;
    }

    btnBulkDraft.disabled = true;
    btnBulkDraft.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      const ids = Array.from(selectedProductIds);
      const { error } = await client
        .from("sarojini_products")
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .in("id", ids);

      if (error) throw error;

      invalidateSarojiniCache();
      window.showToast?.(`Moved ${count} products to Draft (Inactive).`, "info");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk draft error:", err);
      window.showToast?.("Failed to update status: " + err.message, "danger");
    } finally {
      btnBulkDraft.disabled = false;
      btnBulkDraft.innerHTML = '<i class="fas fa-lock"></i> Set as Draft';
    }
  });

  btnBulkDelete?.addEventListener("click", async () => {
    const count = selectedProductIds.size;
    if (count === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${count} selected Sarojini products?\n\nThis cannot be undone.`)) {
      return;
    }

    btnBulkDelete.disabled = true;
    btnBulkDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
      const ids = Array.from(selectedProductIds);
      const { error } = await client
        .from("sarojini_products")
        .delete()
        .in("id", ids);

      if (error) throw error;

      invalidateSarojiniCache();
      window.showToast?.(`Permanently deleted ${count} products.`, "info");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk delete error:", err);
      window.showToast?.("Failed to delete products: " + err.message, "danger");
    } finally {
      btnBulkDelete.disabled = false;
      btnBulkDelete.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
    }
  });

  btnBulkDeselect?.addEventListener("click", () => {
    selectedProductIds.clear();
    const thSelectAll = document.getElementById("th-select-all-prods");
    if (thSelectAll) thSelectAll.checked = false;
    tbody.querySelectorAll(".row-select-prod").forEach(cb => cb.checked = false);
    updateBulkToolbar();
  });

  await loadCategories();
  await loadProducts();
});
