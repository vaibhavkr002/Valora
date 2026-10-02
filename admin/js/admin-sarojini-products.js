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

    // Map native Sarojini products using canonical ID map to prevent any duplicate rows
    const prodMap = new Map();
    sarojiniItems
      .filter(p => p && p.id && p.is_active !== false)
      .forEach(p => {
        if (!prodMap.has(p.id)) {
          const isAvailableInMain = Boolean(crossStoreMapping.sarojini_available_in_main?.[p.id]?.available);
          prodMap.set(p.id, {
            ...p,
            origin_catalog: 'sarojini',
            is_in_sarojini: true,
            is_in_main: isAvailableInMain
          });
        }
      });

    // 2. Fetch any Main VALORA products that are made available in Sarojini Bazaar
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
            if (mp && mp.id && !prodMap.has(mp.id)) {
              const assignment = crossStoreMapping.main_available_in_sarojini[mp.id] || {};
              prodMap.set(mp.id, {
                ...mp,
                origin_catalog: 'main',
                department: assignment.department || 'MEN',
                category_id: assignment.category_id || mp.category_id,
                is_featured: (assignment.is_featured !== undefined) ? assignment.is_featured : mp.is_featured,
                is_in_sarojini: true,
                is_in_main: true
              });
            }
          });
        }
      } catch (crossErr) {
        console.warn("[Sarojini Products] Failed to load cross-store Main products:", crossErr);
      }
    }

    allProducts = Array.from(prodMap.values());
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
      if (prod.specifications && (prod.specifications.show_in_combo_offers === true || prod.specifications.show_in_combo_offers === 'true')) {
        const comboLabel = prod.specifications.combo_offer_label || 'Buy 1 Get 1';
        promoBadges.push(`<span class="badge" style="font-size:0.65rem; background: rgba(225, 29, 72, 0.18); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.35); font-weight:700;" title="${escapeHtml(comboLabel)}">🎁 ${escapeHtml(comboLabel)}</span>`);
      }

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
              <span class="badge badge-success" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="Connected to Main VALORA Store">
                <i class="fas fa-check-circle"></i> Main Store ✓
              </span>
            </div>
            <div>
              ${prod.origin_catalog === 'sarojini'
                ? `<button type="button" class="btn-admin-danger btn-remove-from-main" data-id="${prod.id}" data-name="${escapeHtml(prod.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Main VALORA Store">
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
        if (btn.disabled) return;
        const prodId = btn.getAttribute("data-id");
        const origin = btn.getAttribute("data-origin");
        const prodName = btn.getAttribute("data-name");

        if (origin === "main") {
          if (confirm(`"${prodName}" is a Main VALORA product available in Sarojini Bazaar. Remove availability from Sarojini Bazaar? The product will remain active in Main VALORA Store.`)) {
            btn.disabled = true;
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "main",
                productId: prodId,
                targetStore: "sarojini"
              });
              allProducts = allProducts.filter(p => String(p.id) !== String(prodId));
              renderProducts();
              window.showToast(`Removed "${prodName}" from Sarojini Bazaar.`, "info");
            } catch (err) {
              console.error("Remove from Sarojini failed:", err);
              alert("Failed to remove product from Sarojini: " + (err.message || "Failed"));
              btn.disabled = false;
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
        if (confirm(`Remove "${prodName}" from Main VALORA Store? The product will remain active in Sarojini Bazaar.`)) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "sarojini",
              productId: prodId,
              targetStore: "main"
            });
            window.showToast(`Removed "${prodName}" from Main VALORA Store.`, "info");
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
        if (confirm(`Remove "${prodName}" from Sarojini Bazaar? The product will remain active in Main VALORA Store.`)) {
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
  // Cross-Store Transfer Modal to Main VALORA Store
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
        alert("Failed to make product available in Main VALORA Store: " + (err.message || err));
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

      const targetId = prodToDelete.id;
      const targetName = prodToDelete.name;
      const isCrossInMain = Boolean(crossStoreMapping?.sarojini_available_in_main?.[targetId]?.available);

      try {
        // Prune from Sarojini homepage sections if present
        try {
          const SAROJINI_SEC_ID = '22222222-2222-4222-a222-000000000001';
          const { data: sec } = await client.from('homepage_sections').select('*').eq('id', SAROJINI_SEC_ID).maybeSingle();
          if (sec && sec.content_config && Array.isArray(sec.content_config.product_ids)) {
            const filteredPids = sec.content_config.product_ids.filter(id => String(id) !== String(targetId));
            if (filteredPids.length !== sec.content_config.product_ids.length) {
              sec.content_config.product_ids = filteredPids;
              await client.from('homepage_sections').update({
                content_config: sec.content_config,
                updated_at: new Date().toISOString()
              }).eq('id', SAROJINI_SEC_ID);
            }
          }
        } catch (_) {}

        if (isCrossInMain) {
          // Cross-listed to Main VALORA: Do NOT destroy underlying product row!
          // Deactivate for Sarojini catalog while leaving active for Main Store.
          const { error: updErr } = await client
            .from("sarojini_products")
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", targetId);
          if (updErr) throw updErr;
        } else {
          // Native Sarojini-only product: clean up any stale cross-store mapping reference
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "sarojini",
              productId: targetId,
              targetStore: "main"
            });
          } catch (_) {}

          // Attempt hard delete, fall back to deactivation if constrained by orders or relations
          const { error: delErr } = await client.from("sarojini_products").delete().eq("id", targetId);
          if (delErr) {
            console.warn("Sarojini hard delete note, falling back to safe deactivation:", delErr);
            const { error: updErr } = await client
              .from("sarojini_products")
              .update({
                is_active: false,
                updated_at: new Date().toISOString()
              })
              .eq("id", targetId);
            if (updErr) throw updErr;
          }
        }

        allProducts = allProducts.filter(p => String(p.id) !== String(targetId));
        invalidateSarojiniCache();

        window.showToast(`Deleted product "${targetName}".`, "info");
        closeDelModal();
        renderProducts();
      } catch (err) {
        console.error("Delete product error:", err);
        window.showToast("Failed to delete product: " + (err.message || "Operation failed"), "danger");
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
  // BULK ACTIONS TOOLBAR CONTROLLER (Push VADI, Remove VADI, Publish, Draft, Delete)
  // ==========================================================================
  const bulkToolbar = document.getElementById("bulk-actions-toolbar");
  const bulkCountSpan = document.getElementById("bulk-selected-count");
  const btnBulkPushVadi = document.getElementById("btn-bulk-push-vadi");
  const btnBulkRemoveVadi = document.getElementById("btn-bulk-remove-vadi");
  const btnBulkPublish = document.getElementById("btn-bulk-publish");
  const btnBulkDraft = document.getElementById("btn-bulk-draft");
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  const btnBulkDeselect = document.getElementById("btn-bulk-deselect");

  // Bulk Modal Elements
  const bulkMainModal = document.getElementById("modal-bulk-add-to-main");
  const btnCloseBulkMainModal = document.getElementById("btn-close-bulk-main-modal");
  const btnCancelBulkMainModal = document.getElementById("btn-cancel-bulk-main-modal");
  const btnConfirmBulkAddToMain = document.getElementById("btn-confirm-bulk-add-to-main");
  const bulkMainModalCount = document.getElementById("bulk-main-modal-count");
  const bulkMainModalPreviewList = document.getElementById("bulk-main-modal-preview-list");
  const bulkMainModalCat = document.getElementById("bulk-main-modal-cat");
  const bulkMainModalFeatured = document.getElementById("bulk-main-modal-featured");

  function openBulkAddToMainModal() {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) return;

    if (bulkMainModalCount) {
      bulkMainModalCount.textContent = `${selectedList.length} Products Selected`;
    }

    if (bulkMainModalPreviewList) {
      bulkMainModalPreviewList.innerHTML = selectedList.map(p => {
        const thumb = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
          ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: true })
          : (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || "https://via.placeholder.com/40"));
        const isAlreadyInMain = Boolean(p.is_in_main);
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--admin-card-border);">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 34px; height: 34px; border-radius: 4px; object-fit: cover; background: #1e293b;" onerror="this.src='https://via.placeholder.com/34';">
              <div style="overflow: hidden;">
                <div style="font-size: 0.82rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.72rem; color: var(--admin-text-muted);">${formatINR(p.price)} • Stock: ${p.stock}</div>
              </div>
            </div>
            <div>
              ${isAlreadyInMain ? '<span class="badge badge-success" style="font-size: 0.65rem;">Already in VADI</span>' : '<span class="badge badge-info" style="font-size: 0.65rem;">New to VADI</span>'}
            </div>
          </div>
        `;
      }).join('');
    }

    // Populate category dropdown
    if (bulkMainModalCat) {
      if (mainCategories.length === 0) {
        bulkMainModalCat.innerHTML = '<option value="">(Keep Default / Auto)</option>';
      } else {
        bulkMainModalCat.innerHTML = '<option value="">(Keep Default / Auto)</option>' +
          mainCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
      }
    }

    if (bulkMainModalFeatured) bulkMainModalFeatured.checked = false;

    if (bulkMainModal) bulkMainModal.style.display = "flex";
  }

  function closeBulkAddToMainModal() {
    if (bulkMainModal) bulkMainModal.style.display = "none";
  }

  if (btnCloseBulkMainModal) btnCloseBulkMainModal.addEventListener("click", closeBulkAddToMainModal);
  if (btnCancelBulkMainModal) btnCancelBulkMainModal.addEventListener("click", closeBulkAddToMainModal);

  btnBulkPushVadi?.addEventListener("click", () => {
    if (selectedProductIds.size === 0) {
      window.showToast("Please select at least one product.", "warning");
      return;
    }
    openBulkAddToMainModal();
  });

  btnConfirmBulkAddToMain?.addEventListener("click", async () => {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) return;

    btnConfirmBulkAddToMain.disabled = true;
    btnConfirmBulkAddToMain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing to VADI...';

    try {
      const categoryId = bulkMainModalCat?.value || null;
      const isFeatured = Boolean(bulkMainModalFeatured?.checked);

      const res = await window.CrossStoreService.addMultipleSarojiniToMain(client, selectedList, {
        categoryId,
        isFeatured
      });

      window.showToast?.(res.message || `Pushed ${selectedList.length} products to VADI!`, "success");
      closeBulkAddToMainModal();
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk add to Main error:", err);
      alert("Failed to push products to VADI: " + (err.message || err));
    } finally {
      btnConfirmBulkAddToMain.disabled = false;
      btnConfirmBulkAddToMain.innerHTML = '<i class="fas fa-store"></i> Confirm &amp; Push to VADI';
    }
  });

  btnBulkRemoveVadi?.addEventListener("click", async () => {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) {
      window.showToast("Please select at least one product.", "warning");
      return;
    }

    // Filter which ones are currently available in VADI
    const inVadiList = selectedList.filter(p => p.is_in_main);
    if (inVadiList.length === 0) {
      alert("None of the selected products are currently available in VADI (Main Store).");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${inVadiList.length} selected product(s) from VADI (Main Store)?\n\nThey will remain active in Sarojini Bazaar.`)) {
      return;
    }

    btnBulkRemoveVadi.disabled = true;
    btnBulkRemoveVadi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

    try {
      const ids = inVadiList.map(p => p.id);
      const res = await window.CrossStoreService.removeMultipleFromStore(client, {
        productIds: ids,
        targetStore: "main"
      });

      window.showToast?.(`Removed ${res.removedCount} product(s) from VADI (Main Store).`, "info");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk remove from Main error:", err);
      alert("Failed to remove products from VADI: " + (err.message || err));
    } finally {
      btnBulkRemoveVadi.disabled = false;
      btnBulkRemoveVadi.innerHTML = '<i class="fas fa-times-circle"></i> Remove from VADI';
    }
  });

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
    if (!confirm(`Are you sure you want to delete ${count} selected products from Sarojini Bazaar?\n\nProducts cross-listed from/to other catalogs will have their availability updated safely.`)) {
      return;
    }

    btnBulkDelete.disabled = true;
    btnBulkDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
      const ids = Array.from(selectedProductIds);
      const SAROJINI_SEC_ID = '22222222-2222-4222-a222-000000000001';

      // Prune all selected IDs from Sarojini homepage sections
      try {
        const { data: sec } = await client.from('homepage_sections').select('*').eq('id', SAROJINI_SEC_ID).maybeSingle();
        if (sec && sec.content_config && Array.isArray(sec.content_config.product_ids)) {
          const selectedSet = new Set(ids.map(String));
          const filteredPids = sec.content_config.product_ids.filter(id => !selectedSet.has(String(id)));
          if (filteredPids.length !== sec.content_config.product_ids.length) {
            sec.content_config.product_ids = filteredPids;
            await client.from('homepage_sections').update({
              content_config: sec.content_config,
              updated_at: new Date().toISOString()
            }).eq('id', SAROJINI_SEC_ID);
          }
        }
      } catch (_) {}

      for (const id of ids) {
        const prod = allProducts.find(p => String(p.id) === String(id));
        const isMainOrigin = prod ? (prod.origin_catalog === "main" || prod.origin === "main") : false;

        if (isMainOrigin) {
          // Remove cross-store availability from Sarojini
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "main",
              productId: id,
              targetStore: "sarojini"
            });
          } catch (e) {
            console.warn(`Failed to remove cross-listed Main item ${id} from Sarojini:`, e);
          }
        } else {
          // Native Sarojini
          const isCrossInMain = Boolean(crossStoreMapping?.sarojini_available_in_main?.[id]?.available);
          if (isCrossInMain) {
            // Keep DB row for Main store, deactivate in Sarojini
            await client.from("sarojini_products").update({
              is_active: false,
              updated_at: new Date().toISOString()
            }).eq("id", id);
          } else {
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "sarojini",
                productId: id,
                targetStore: "main"
              });
            } catch (_) {}

            const { error: delErr } = await client.from("sarojini_products").delete().eq("id", id);
            if (delErr) {
              console.warn(`Sarojini bulk delete fallback to deactivate for ${id}:`, delErr);
              await client.from("sarojini_products").update({
                is_active: false,
                updated_at: new Date().toISOString()
              }).eq("id", id);
            }
          }
        }
      }

      invalidateSarojiniCache();
      window.showToast?.(`Deleted ${count} products successfully.`, "info");
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

  // ==========================================================================
  // SAROJINI HOMEPAGE PRODUCTS CURATOR (EXACTLY 6 PRODUCTS & ORDERING)
  // ==========================================================================
  const btnOpenSarojiniHpCurator = document.getElementById("btn-open-sarojini-hp-curator");
  const badgeSarojiniHpSummary = document.getElementById("badge-sarojini-hp-summary");
  const modalSarojiniHp = document.getElementById("modal-sarojini-homepage-products");
  const btnCloseSarojiniHpModal = document.getElementById("btn-close-sarojini-hp-modal");
  const btnCancelSarojiniHpModal = document.getElementById("btn-cancel-sarojini-hp-modal");
  const btnSaveSarojiniHp = document.getElementById("btn-save-sarojini-hp-products");
  const sarojiniHpCounterBadge = document.getElementById("sarojini-hp-counter-badge");
  const sarojiniHpStatusHint = document.getElementById("sarojini-hp-status-hint");
  const sarojiniHpSelectedCountLabel = document.getElementById("sarojini-hp-selected-count-label");
  const sarojiniHpSelectedContainer = document.getElementById("sarojini-hp-selected-container");
  const sarojiniHpSearch = document.getElementById("sarojini-hp-search");
  const sarojiniHpDeptFilter = document.getElementById("sarojini-hp-dept-filter");
  const sarojiniHpCatalogContainer = document.getElementById("sarojini-hp-catalog-container");

  let curated6ProductIds = [];

  async function fetchCurated6FromDb() {
    try {
      const { data: sec } = await client
        .from("homepage_sections")
        .select("content_config")
        .eq("id", "22222222-2222-4222-a222-000000000001")
        .maybeSingle();

      if (sec && sec.content_config && Array.isArray(sec.content_config.product_ids) && sec.content_config.product_ids.length > 0) {
        return sec.content_config.product_ids.filter(Boolean).slice(0, 6).map(String);
      }
    } catch (_) {}

    try {
      const { data: sRow } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "sarojini_featured_section")
        .maybeSingle();

      if (sRow && sRow.value && sRow.value.content_config && Array.isArray(sRow.value.content_config.product_ids)) {
        return sRow.value.content_config.product_ids.filter(Boolean).slice(0, 6).map(String);
      }
    } catch (_) {}

    return [];
  }

  function updateSummaryBadge() {
    if (badgeSarojiniHpSummary) {
      badgeSarojiniHpSummary.textContent = `${curated6ProductIds.length} / 6`;
      if (curated6ProductIds.length === 6) {
        badgeSarojiniHpSummary.style.background = "rgba(16, 185, 129, 0.35)";
        badgeSarojiniHpSummary.style.color = "#34d399";
      } else {
        badgeSarojiniHpSummary.style.background = "rgba(255, 255, 255, 0.25)";
        badgeSarojiniHpSummary.style.color = "#fff";
      }
    }
  }

  function renderCuratedSlots() {
    if (!sarojiniHpSelectedContainer) return;
    const count = curated6ProductIds.length;

    if (sarojiniHpSelectedCountLabel) sarojiniHpSelectedCountLabel.textContent = String(count);

    if (sarojiniHpCounterBadge) {
      sarojiniHpCounterBadge.textContent = `Selected: ${count} / 6`;
      if (count === 6) {
        sarojiniHpCounterBadge.style.background = "#059669";
        sarojiniHpCounterBadge.style.color = "#fff";
      } else {
        sarojiniHpCounterBadge.style.background = "#e11d48";
        sarojiniHpCounterBadge.style.color = "#fff";
      }
    }

    if (sarojiniHpStatusHint) {
      if (count === 6) {
        sarojiniHpStatusHint.innerHTML = '<span style="color:#34d399;"><i class="fas fa-check-circle"></i> Ready to save! Exactly 6 products selected.</span>';
      } else {
        const remaining = 6 - count;
        sarojiniHpStatusHint.innerHTML = `<span style="color:#fecdd3;"><i class="fas fa-info-circle"></i> Pick ${remaining} more product${remaining > 1 ? 's' : ''} to reach exactly 6.</span>`;
      }
    }

    if (btnSaveSarojiniHp) {
      if (count === 6) {
        btnSaveSarojiniHp.disabled = false;
        btnSaveSarojiniHp.style.opacity = "1";
        btnSaveSarojiniHp.style.cursor = "pointer";
      } else {
        btnSaveSarojiniHp.disabled = true;
        btnSaveSarojiniHp.style.opacity = "0.5";
        btnSaveSarojiniHp.style.cursor = "not-allowed";
      }
    }

    let slotsHtml = "";
    for (let i = 0; i < 6; i++) {
      const pid = curated6ProductIds[i];
      if (pid) {
        const p = allProducts.find(item => String(item.id) === String(pid));
        const name = p ? p.name : `Product ID: ${pid}`;
        const dept = p ? (p.department || 'SAROJINI') : 'BAZAAR';
        const price = p ? formatINR(p.price) : '';
        const img = (p && p.images && p.images[0]) ? p.images[0] : (p?.image || 'assets/sarojni/prod-1-graphic-tee.png');
        const isInactive = p && p.is_active === false;
        const isFirst = (i === 0);
        const isLast = (i === curated6ProductIds.length - 1);

        slotsHtml += `
          <div class="sarojini-hp-slot-card" data-id="${pid}" data-idx="${i}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-card-border); border-radius: 8px; padding: 7px 12px; ${isInactive ? 'border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.06);' : ''}">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
              <span style="font-weight: 800; font-size: 0.85rem; color: #fb7185; width: 26px; text-align: center;">#${i + 1}</span>
              <img src="${img}" alt="" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; background: #1e293b; flex-shrink: 0;" onerror="this.src='assets/sarojni/prod-1-graphic-tee.png';">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 600; font-size: 0.84rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(name)}
                  ${isInactive ? '<span class="badge badge-danger" style="font-size:0.65rem; margin-left:6px;"><i class="fas fa-exclamation-triangle"></i> Deactivated</span>' : ''}
                </div>
                <div style="font-size: 0.73rem; color: var(--admin-text-muted); display: flex; gap: 8px; align-items: center;">
                  <span style="color: #fb7185; font-weight: 700;">${escapeHtml(dept)}</span>
                  <span>•</span>
                  <strong style="color: #34d399;">${price}</strong>
                  ${p ? `<span>• Stock: ${p.stock}</span>` : ''}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <button type="button" class="btn-hp-move-up order-control-btn" data-idx="${i}" ${isFirst ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Move Up (Display earlier on homepage)">
                <i class="fas fa-arrow-up" style="font-size: 0.7rem;"></i>
              </button>
              <button type="button" class="btn-hp-move-down order-control-btn" data-idx="${i}" ${isLast ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Move Down (Display later on homepage)">
                <i class="fas fa-arrow-down" style="font-size: 0.7rem;"></i>
              </button>
              <button type="button" class="btn-hp-remove-slot order-control-btn" data-idx="${i}" data-id="${pid}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); cursor: pointer;" title="Remove this product from homepage slot">
                <i class="fas fa-times" style="font-size: 0.75rem;"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="sarojini-hp-slot-empty" data-slot="${i + 1}" style="display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 10px; color: var(--admin-text-muted); font-size: 0.78rem; background: rgba(15, 23, 42, 0.3);">
            <i class="fas fa-plus-circle" style="color: #fb7185;"></i>
            <span>Empty Slot #${i + 1} — Select a product from the catalog below to place in this slot</span>
          </div>
        `;
      }
    }
    sarojiniHpSelectedContainer.innerHTML = slotsHtml;

    // Attach order listeners
    sarojiniHpSelectedContainer.querySelectorAll(".btn-hp-move-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx > 0) {
          const temp = curated6ProductIds[idx];
          curated6ProductIds[idx] = curated6ProductIds[idx - 1];
          curated6ProductIds[idx - 1] = temp;
          renderCuratedSlots();
          renderCatalogPicker();
        }
      });
    });

    sarojiniHpSelectedContainer.querySelectorAll(".btn-hp-move-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx < curated6ProductIds.length - 1) {
          const temp = curated6ProductIds[idx];
          curated6ProductIds[idx] = curated6ProductIds[idx + 1];
          curated6ProductIds[idx + 1] = temp;
          renderCuratedSlots();
          renderCatalogPicker();
        }
      });
    });

    sarojiniHpSelectedContainer.querySelectorAll(".btn-hp-remove-slot").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        curated6ProductIds.splice(idx, 1);
        renderCuratedSlots();
        renderCatalogPicker();
      });
    });
  }

  function renderCatalogPicker() {
    if (!sarojiniHpCatalogContainer) return;
    const q = (sarojiniHpSearch?.value || "").toLowerCase().trim();
    const dept = (sarojiniHpDeptFilter?.value || "").toUpperCase();

    const filtered = allProducts.filter(p => {
      if (q && !((p.name && p.name.toLowerCase().includes(q)) || (p.department && p.department.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)))) {
        return false;
      }
      if (dept && (p.department || "").toUpperCase() !== dept) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      sarojiniHpCatalogContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--admin-text-muted); font-size: 0.82rem;">
          No matching Sarojini products found.
        </div>
      `;
      return;
    }

    sarojiniHpCatalogContainer.innerHTML = filtered.map(p => {
      const isSelected = curated6ProductIds.includes(String(p.id));
      const slotIndex = curated6ProductIds.indexOf(String(p.id));
      const img = (p.images && p.images[0]) ? p.images[0] : (p.image || "assets/sarojni/prod-1-graphic-tee.png");
      const isInactive = p.is_active === false;

      return `
        <div class="sarojini-hp-picker-item" data-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: ${isSelected ? 'rgba(225, 29, 72, 0.12)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isSelected ? 'rgba(225, 29, 72, 0.4)' : 'var(--admin-card-border)'}; border-radius: 8px; padding: 7px 10px; transition: all 0.15s ease;">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <input type="checkbox" class="cb-hp-picker" data-id="${p.id}" ${isSelected ? 'checked' : ''} style="accent-color: #e11d48; width: 16px; height: 16px; cursor: pointer;">
            <img src="${img}" alt="" style="width: 34px; height: 34px; border-radius: 4px; object-fit: cover; background: #1e293b; flex-shrink: 0;" onerror="this.src='assets/sarojni/prod-1-graphic-tee.png';">
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; font-size: 0.82rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(p.name)}
                ${isInactive ? '<span class="badge badge-danger" style="font-size:0.65rem; margin-left:4px;">Deactivated</span>' : ''}
              </div>
              <div style="font-size: 0.72rem; color: var(--admin-text-muted); display: flex; gap: 8px; align-items: center;">
                <span style="color: #fb7185;">${escapeHtml(p.department || 'SAROJINI')}</span>
                <span>•</span>
                <strong style="color: #34d399;">${formatINR(p.price)}</strong>
                <span>• Stock: ${p.stock}</span>
              </div>
            </div>
          </div>
          <div style="flex-shrink: 0;">
            ${isSelected ? `
              <button type="button" class="btn-toggle-curated-pick btn-admin-danger" data-id="${p.id}" style="padding: 3px 10px; font-size: 0.75rem; border-radius: 6px; cursor: pointer;">
                ✓ Slot #${slotIndex + 1} (Remove)
              </button>
            ` : `
              <button type="button" class="btn-toggle-curated-pick btn-admin-secondary" data-id="${p.id}" style="padding: 3px 10px; font-size: 0.75rem; border-radius: 6px; cursor: pointer; border-color: rgba(225, 29, 72, 0.4); color: #fb7185;">
                + Add to Slot #${curated6ProductIds.length + 1}
              </button>
            `}
          </div>
        </div>
      `;
    }).join("");

    // Wire clicks on items
    sarojiniHpCatalogContainer.querySelectorAll(".cb-hp-picker, .btn-toggle-curated-pick").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = String(el.dataset.id);
        const isCurrentlySelected = curated6ProductIds.includes(id);

        if (isCurrentlySelected) {
          curated6ProductIds = curated6ProductIds.filter(pid => pid !== id);
          renderCuratedSlots();
          renderCatalogPicker();
        } else {
          if (curated6ProductIds.length >= 6) {
            window.showToast?.("Exactly 6 products already selected. Please remove or replace one from the slots above.", "warning");
            if (el.tagName === 'INPUT') el.checked = false;
            return;
          }
          curated6ProductIds.push(id);
          renderCuratedSlots();
          renderCatalogPicker();
        }
      });
    });
  }

  async function openSarojiniHpModal() {
    if (modalSarojiniHp) modalSarojiniHp.style.display = "flex";
    if (curated6ProductIds.length === 0) {
      curated6ProductIds = await fetchCurated6FromDb();
    }
    renderCuratedSlots();
    renderCatalogPicker();
  }

  function closeSarojiniHpModal() {
    if (modalSarojiniHp) modalSarojiniHp.style.display = "none";
  }

  if (btnOpenSarojiniHpCurator) {
    btnOpenSarojiniHpCurator.addEventListener("click", openSarojiniHpModal);
  }
  if (btnCloseSarojiniHpModal) btnCloseSarojiniHpModal.addEventListener("click", closeSarojiniHpModal);
  if (btnCancelSarojiniHpModal) btnCancelSarojiniHpModal.addEventListener("click", closeSarojiniHpModal);

  if (modalSarojiniHp) {
    modalSarojiniHp.addEventListener("click", (e) => {
      if (e.target === modalSarojiniHp) closeSarojiniHpModal();
    });
  }

  if (sarojiniHpSearch) {
    sarojiniHpSearch.addEventListener("input", renderCatalogPicker);
  }
  if (sarojiniHpDeptFilter) {
    sarojiniHpDeptFilter.addEventListener("change", renderCatalogPicker);
  }

  if (btnSaveSarojiniHp) {
    btnSaveSarojiniHp.addEventListener("click", async () => {
      if (curated6ProductIds.length !== 6) {
        window.showToast?.("Please select exactly 6 products before saving.", "warning");
        return;
      }

      btnSaveSarojiniHp.disabled = true;
      btnSaveSarojiniHp.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving 6 Homepage Products...';

      try {
        const payloadConfig = {
          limit: 6,
          columns: 6,
          source: "specific",
          product_ids: curated6ProductIds,
          catalog_type: "sarojini"
        };

        // 1. Update homepage_sections table row '22222222-2222-4222-a222-000000000001'
        const { error: secErr } = await client
          .from("homepage_sections")
          .update({
            content_config: payloadConfig,
            updated_at: new Date().toISOString()
          })
          .eq("id", "22222222-2222-4222-a222-000000000001");

        if (secErr) throw secErr;

        // 2. Sync to store_settings 'sarojini_featured_section'
        await client.from("store_settings").upsert({
          key: "sarojini_featured_section",
          value: {
            id: "22222222-2222-4222-a222-000000000001",
            section_type: "sarojini_trending",
            title: "Trending Sarojini Finds",
            subtitle: "Fresh streetwear drops, viral tops, and daily staples handpicked this week.",
            is_active: true,
            display_order: 3,
            background_config: { theme: "light", padding: "standard" },
            content_config: payloadConfig,
            updated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

        // 3. Invalidate caches so customer homepage updates immediately
        try {
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
          if (window.VeloraCache) window.VeloraCache.invalidate();
          invalidateSarojiniCache();
          window.dispatchEvent(new CustomEvent("velora:homepage-sections-updated"));
        } catch (_) {}

        updateSummaryBadge();
        window.showToast?.("Sarojini Homepage Products saved! Exactly 6 products are now active on the homepage.", "success");
        closeSarojiniHpModal();
      } catch (err) {
        console.error("Save Sarojini Homepage Products error:", err);
        alert("Failed to save Sarojini Homepage Products: " + (err.message || err));
      } finally {
        btnSaveSarojiniHp.disabled = (curated6ProductIds.length !== 6);
        btnSaveSarojiniHp.innerHTML = '<i class="fas fa-save"></i> Save Sarojini Homepage Products';
      }
    });
  }

  // Initial fetch of curated products to populate badge and preload state
  fetchCurated6FromDb().then(ids => {
    curated6ProductIds = ids;
    updateSummaryBadge();
  });

  // Check URL param ?curate_homepage=true
  if (window.location.search.includes("curate_homepage=true") || window.location.hash.includes("curate-homepage")) {
    setTimeout(openSarojiniHpModal, 300);
  }

  await loadCategories();
  await loadProducts();
});
