/**
 * VELORA Admin Panel - Products Controller
 * Manages Main VALORA catalog, search, stock/category/availability filters,
 * BOGO deals modal, and cross-store availability to Sarojini Bazaar.
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
  const availabilitySelect = document.getElementById("filter-availability");
  const countBadge = document.getElementById("product-count-badge");

  let allProducts = [];
  let crossStoreMapping = {
    main_available_in_sarojini: {},
    sarojini_available_in_main: {},
    main_to_sarojini: {},
    sarojini_to_main: {}
  };
  let sarojiniCategories = [];
  let productToAddSarojini = null;
  let bogoConfigIds = [];
  let selectedProductIds = new Set();
  let globalAdvanceSettings = null;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Load Categories into filter & Sarojini Categories for cross-store modal
  async function loadCategories() {
    try {
      const { data: cats } = await client.from("categories").select("id, name").order("name");
      if (cats && categorySelect) {
        cats.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          categorySelect.appendChild(opt);
        });
      }
    } catch (_) {}

    try {
      const { data: sCats } = await client.from("sarojini_categories").select("id, name, department, slug").eq("is_active", true);
      if (Array.isArray(sCats) && sCats.length > 0) {
        sarojiniCategories = sCats;
      } else {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_categories").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) sarojiniCategories = sRow.value;
      }
    } catch (_) {}
  }

  // Load Products & Cross-Store Availability
  async function loadProducts() {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 30px; color: var(--admin-text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading products from database...</td></tr>';
    
    try {
      const { data: bogoSetting } = await client.from("store_settings").select("value").eq("key", "bogo_config").maybeSingle();
      if (bogoSetting && bogoSetting.value && Array.isArray(bogoSetting.value.product_ids)) {
        bogoConfigIds = bogoSetting.value.product_ids;
      }
    } catch (e) {
      console.warn("BOGO config load notice:", e);
    }

    try {
      if (window.CrossStoreService) {
        crossStoreMapping = await window.CrossStoreService.getMapping(client);
      }
    } catch (mErr) {
      console.warn("CrossStoreService mapping notice:", mErr);
    }

    try {
      if (window.AdvancePaymentService) {
        globalAdvanceSettings = await window.AdvancePaymentService.getGlobalSettings(client);
      }
    } catch (advErr) {
      console.warn("AdvancePaymentService load notice:", advErr);
    }

    const { data: mainProductsData, error } = await client
      .from("products")
      .select("*, categories(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--admin-danger);">Failed to load products: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    // Map native Main products using canonical ID map to prevent any duplicate rows
    const prodMap = new Map();
    (mainProductsData || []).forEach(p => {
      if (p && p.id && !prodMap.has(p.id)) {
        const isAvailableInSarojini = Boolean(crossStoreMapping.main_available_in_sarojini?.[p.id]?.available);
        prodMap.set(p.id, {
          ...p,
          origin_catalog: 'main',
          is_in_main: true,
          is_in_sarojini: isAvailableInSarojini
        });
      }
    });

    // 2. Fetch any Sarojini Bazaar products that are made available in Main Store
    const sarojiniAvailableIds = Object.keys(crossStoreMapping.sarojini_available_in_main || {})
      .filter(id => crossStoreMapping.sarojini_available_in_main[id]?.available);

    if (sarojiniAvailableIds.length > 0) {
      try {
        const { data: sarojiniProductsData } = await client
          .from("sarojini_products")
          .select("*")
          .in("id", sarojiniAvailableIds);

        if (Array.isArray(sarojiniProductsData)) {
          sarojiniProductsData.forEach(sp => {
            if (sp && sp.id && !prodMap.has(sp.id)) {
              const assignment = crossStoreMapping.sarojini_available_in_main[sp.id] || {};
              prodMap.set(sp.id, {
                ...sp,
                origin_catalog: 'sarojini',
                category_id: assignment.category_id || sp.category_id,
                is_featured: (assignment.is_featured !== undefined) ? assignment.is_featured : sp.is_featured,
                is_in_main: true,
                is_in_sarojini: true
              });
            }
          });
        }
      } catch (crossErr) {
        console.warn("[Main Products] Failed to load cross-store Sarojini products:", crossErr);
      }
    }

    allProducts = Array.from(prodMap.values());
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
    if (stockFilter === "low") filtered = filtered.filter(p => (Number(p.stock) || 0) <= 5 && (Number(p.stock) || 0) > 0);
    if (stockFilter === "out") filtered = filtered.filter(p => (Number(p.stock) || 0) === 0);
    if (stockFilter === "in") filtered = filtered.filter(p => (Number(p.stock) || 0) > 5);
    if (stockFilter === "bogo") filtered = filtered.filter(p => bogoConfigIds.includes(p.id) || Boolean(p.is_bogo));
    if (stockFilter === "trending") filtered = filtered.filter(p => Boolean(p.is_featured));

    // Availability filter
    const availFilter = availabilitySelect?.value || "";
    if (availFilter === "main" || availFilter === "main_only") {
      filtered = filtered.filter(p => p.is_in_main && !p.is_in_sarojini);
    } else if (availFilter === "sarojini") {
      filtered = filtered.filter(p => p.is_in_sarojini);
    } else if (availFilter === "both") {
      filtered = filtered.filter(p => p.is_in_main && p.is_in_sarojini);
    }

    if (countBadge) countBadge.textContent = `Showing ${filtered.length} of ${allProducts.length} Products`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 40px 20px; color: var(--admin-text-muted);">No products match your criteria.</td></tr>';
      updateBulkToolbar();
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const primaryImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/60");
      const catName = p.categories ? p.categories.name : (p.department || "Uncategorized");
      const activeBadge = p.is_active 
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Inactive</span>';

      const advanceInfo = window.AdvancePaymentService
        ? window.AdvancePaymentService.getProductAdvanceInfo(p, globalAdvanceSettings)
        : null;
      const advanceBadge = advanceInfo
        ? advanceInfo.badgeHtml
        : (p.advance_payment_enabled
            ? (p.advance_payment_type === 'percentage'
                ? `<span class="badge badge-indigo" title="Requires ${p.advance_payment_value}% upfront deposit">✓ ${p.advance_payment_value}%</span>`
                : `<span class="badge badge-indigo" title="Requires ${window.formatINR(p.advance_payment_value)} upfront deposit">✓ ${window.formatINR(p.advance_payment_value)}</span>`)
            : '<span style="color: var(--admin-text-muted); font-size: 0.78rem;">—</span>');

      const isBogo = bogoConfigIds.includes(p.id) || Boolean(p.is_bogo);
      const badgesHtml = [
        p.is_featured ? '<span class="badge badge-warning" style="font-size: 0.68rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">🔥 Trending</span>' : '',
        p.is_new ? '<span class="badge badge-info" style="font-size: 0.68rem;">New</span>' : '',
        p.is_deal ? '<span class="badge badge-danger" style="font-size: 0.68rem;">Deal</span>' : '',
        isBogo ? '<span class="badge badge-success" style="font-size: 0.68rem; background: #059669; color: #fff;">🎁 BOGO</span>' : ''
      ].filter(Boolean).join(' ') || '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">—</span>';

      const isBoth = p.is_in_main && p.is_in_sarojini;

      let availabilityHtml = '';
      if (isBoth) {
        availabilityHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
              <span class="badge badge-success" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-check-circle"></i> Main Store ✓
              </span>
              <span class="badge badge-pink" style="font-size: 0.72rem; background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.3); display: inline-flex; align-items: center; gap: 4px;" title="Connected to Sarojini Bazaar">
                <i class="fas fa-store"></i> Sarojini Bazaar ✓
              </span>
            </div>
            <div>
              ${p.origin_catalog === 'main'
                ? `<button type="button" class="btn-admin-danger btn-remove-from-sarojini" data-id="${p.id}" data-name="${escapeHtml(p.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Sarojini Bazaar">
                     <i class="fas fa-times"></i> Remove from Sarojini
                   </button>`
                : `<button type="button" class="btn-admin-danger btn-remove-from-main" data-id="${p.id}" data-name="${escapeHtml(p.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Main VALORA Store">
                     <i class="fas fa-times"></i> Remove from Main Store
                   </button>`
              }
            </div>
          </div>
        `;
      } else {
        availabilityHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="badge badge-success" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
              <i class="fas fa-check-circle"></i> Main Store ✓
            </span>
            <button type="button" class="btn-admin-secondary btn-open-add-to-sarojini" data-id="${p.id}" style="padding: 3px 8px; font-size: 0.72rem; border-color: rgba(225, 29, 72, 0.4); color: #fb7185; width: fit-content; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fas fa-plus"></i> Add to Sarojini
            </button>
          </div>
        `;
      }

      const editUrl = p.origin_catalog === 'sarojini'
        ? `sarojini-add-product.html?id=${encodeURIComponent(p.id)}`
        : `edit-product.html?id=${encodeURIComponent(p.id)}`;

      return `
        <tr data-prod-id="${p.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="row-select-prod" data-id="${p.id}" ${selectedProductIds.has(String(p.id)) ? 'checked' : ''}>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap: 12px;">
              <img src="${primaryImage}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--admin-card-border);" onerror="this.src='https://via.placeholder.com/60';">
              <div>
                <a href="${editUrl}" style="font-weight: 700; color: #fff; text-decoration: none; font-size: 0.92rem;">${escapeHtml(p.name)}</a>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(p.brand || 'VALORA')}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(catName)}</td>
          <td><strong>${window.formatINR(p.price)}</strong></td>
          <td><span style="color: var(--admin-text-muted); text-decoration: line-through;">${p.original_price ? window.formatINR(p.original_price) : '-'}</span></td>
          <td>${advanceBadge}</td>
          <td>
            <span class="badge ${p.stock <= 5 ? 'badge-danger' : 'badge-info'}">${p.stock} in stock</span>
          </td>
          <td>${badgesHtml}</td>
          <td>${activeBadge}</td>
          <td>${availabilityHtml}</td>
          <td>
            <div style="display:flex; align-items:center; gap: 6px;">
              <a href="${editUrl}" class="btn-admin-secondary" style="padding: 5px 10px; font-size: 0.78rem;">Edit</a>
              <button type="button" class="btn-admin-danger btn-delete-product" data-id="${p.id}" data-origin="${p.origin_catalog}" data-name="${escapeHtml(p.name)}" style="padding: 5px 10px; font-size: 0.78rem;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

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

    // Attach delete listeners
    document.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const id = btn.dataset.id;
        const origin = btn.dataset.origin;
        const name = btn.dataset.name;

        if (origin === "sarojini") {
          if (confirm(`"${name}" is a Sarojini Bazaar product available in Main VALORA Store. Remove availability from Main VALORA Store? The product will remain active in Sarojini Bazaar.`)) {
            btn.disabled = true;
            const origText = btn.textContent;
            btn.textContent = "Removing...";
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "sarojini",
                productId: id,
                targetStore: "main"
              });
              allProducts = allProducts.filter(p => String(p.id) !== String(id));
              renderProducts();
              window.showToast(`Removed "${name}" from Main VALORA Store.`, "info");
            } catch (err) {
              console.error("Remove from Main failed:", err);
              alert("Could not remove product from Main Store: " + (err.message || "Operation failed."));
              btn.disabled = false;
              btn.textContent = origText;
            }
          }
          return;
        }

        // Native Main product
        const isCrossInSarojini = Boolean(crossStoreMapping?.main_available_in_sarojini?.[id]?.available);
        const confirmMsg = isCrossInSarojini
          ? `"${name}" is active in both Main VALORA and Sarojini Bazaar. Remove it from the Main VALORA catalog? It will remain active in Sarojini Bazaar.`
          : `Are you sure you want to delete "${name}"? This will remove it from the Main catalog.`;

        if (confirm(confirmMsg)) {
          btn.disabled = true;
          const origText = btn.textContent;
          btn.textContent = "Deleting...";

          try {
            if (!isCrossInSarojini) {
              // If not cross-listed, prune any stale mapping reference
              try {
                await window.CrossStoreService.removeFromStore(client, {
                  originCatalog: "main",
                  productId: id,
                  targetStore: "sarojini"
                });
              } catch (_) {}
            }

            // Deactivate in Main VALORA catalog (safe, non-destructive to historical orders)
            const { error: updErr } = await client
              .from("products")
              .update({
                is_active: false,
                updated_at: new Date().toISOString()
              })
              .eq("id", id);

            if (updErr) throw updErr;

            try {
              localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
              if (window.VeloraCache) window.VeloraCache.invalidate();
            } catch (_) {}

            allProducts = allProducts.filter(p => String(p.id) !== String(id));
            renderProducts();
            window.showToast(`"${name}" removed successfully from Main catalog.`, "success");
          } catch (err) {
            console.error("Main product delete error:", err);
            alert("Could not delete product: " + (err.message || "Operation failed."));
            btn.disabled = false;
            btn.textContent = origText;
          }
        }
      });
    });

    // Attach Add to Sarojini Modal Openers
    document.querySelectorAll(".btn-open-add-to-sarojini").forEach(btn => {
      btn.addEventListener("click", () => {
        const prodId = btn.dataset.id;
        const prod = allProducts.find(p => p.id === prodId);
        if (prod) openSarojiniModal(prod);
      });
    });

    // Attach Remove from Sarojini handlers
    document.querySelectorAll(".btn-remove-from-sarojini").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.dataset.id;
        const prodName = btn.dataset.name;
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

    // Attach Remove from Main handlers
    document.querySelectorAll(".btn-remove-from-main").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.dataset.id;
        const prodName = btn.dataset.name;
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
  }

  if (searchInput) searchInput.addEventListener("input", renderProducts);
  if (categorySelect) categorySelect.addEventListener("change", renderProducts);
  if (stockSelect) stockSelect.addEventListener("change", renderProducts);
  if (availabilitySelect) availabilitySelect.addEventListener("change", renderProducts);

  // ==========================================================================
  // Cross-Store Transfer Modal to Sarojini Bazaar
  // ==========================================================================
  const sarojiniModal = document.getElementById("modal-add-to-sarojini");
  const btnCloseSarojiniModal = document.getElementById("btn-close-sarojini-modal");
  const btnCancelSarojiniModal = document.getElementById("btn-cancel-sarojini-modal");
  const btnConfirmAddToSarojini = document.getElementById("btn-confirm-add-to-sarojini");
  const sarojiniModalDept = document.getElementById("sarojini-modal-dept");
  const sarojiniModalCat = document.getElementById("sarojini-modal-cat");
  const sarojiniModalFeatured = document.getElementById("sarojini-modal-featured");
  const sarojiniModalImg = document.getElementById("sarojini-modal-img");
  const sarojiniModalTitle = document.getElementById("sarojini-modal-title");
  const sarojiniModalPrice = document.getElementById("sarojini-modal-price");
  const sarojiniModalStock = document.getElementById("sarojini-modal-stock");

  function updateSarojiniModalCategories() {
    if (!sarojiniModalCat) return;
    const dept = (sarojiniModalDept?.value || "MEN").toUpperCase();
    const filteredCats = sarojiniCategories.filter(c => (c.department || "").toUpperCase() === dept);

    if (filteredCats.length === 0) {
      sarojiniModalCat.innerHTML = '<option value="">No categories in department</option>';
      return;
    }

    sarojiniModalCat.innerHTML = filteredCats.map(c => `<option value="${c.id}" data-slug="${c.slug || ''}">${escapeHtml(c.name)}</option>`).join("");
  }

  if (sarojiniModalDept) {
    sarojiniModalDept.addEventListener("change", updateSarojiniModalCategories);
  }

  function openSarojiniModal(product) {
    productToAddSarojini = product;
    if (sarojiniModalTitle) sarojiniModalTitle.textContent = product.name;
    if (sarojiniModalPrice) sarojiniModalPrice.textContent = window.formatINR(product.price);
    if (sarojiniModalStock) sarojiniModalStock.textContent = `${product.stock} units`;
    if (sarojiniModalImg) {
      sarojiniModalImg.src = (product.images && product.images.length > 0) ? product.images[0] : (product.image || "https://via.placeholder.com/50");
    }
    if (sarojiniModalFeatured) sarojiniModalFeatured.checked = false;

    // Default department guessing
    const catName = (product.categories?.name || "").toLowerCase();
    if (catName.includes("women") || catName.includes("dress") || catName.includes("kurti") || catName.includes("saree")) {
      sarojiniModalDept.value = "WOMEN";
    } else if (catName.includes("shoe") || catName.includes("footwear") || catName.includes("sneaker")) {
      sarojiniModalDept.value = "FOOTWEAR";
    } else if (catName.includes("bag")) {
      sarojiniModalDept.value = "BAGS";
    } else if (catName.includes("jewel") || catName.includes("earring")) {
      sarojiniModalDept.value = "JEWELLERY";
    } else if (catName.includes("cap") || catName.includes("hat")) {
      sarojiniModalDept.value = "CAPS";
    } else {
      sarojiniModalDept.value = "MEN";
    }

    updateSarojiniModalCategories();

    if (sarojiniModal) sarojiniModal.style.display = "flex";
  }

  function closeSarojiniModal() {
    if (sarojiniModal) sarojiniModal.style.display = "none";
    productToAddSarojini = null;
  }

  if (btnCloseSarojiniModal) btnCloseSarojiniModal.addEventListener("click", closeSarojiniModal);
  if (btnCancelSarojiniModal) btnCancelSarojiniModal.addEventListener("click", closeSarojiniModal);

  if (btnConfirmAddToSarojini) {
    btnConfirmAddToSarojini.addEventListener("click", async () => {
      if (!productToAddSarojini) return;
      btnConfirmAddToSarojini.disabled = true;
      btnConfirmAddToSarojini.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding to Sarojini...';

      try {
        const selectedDept = sarojiniModalDept.value;
        const selectedCatOpt = sarojiniModalCat.selectedOptions[0];
        const selectedCatId = selectedCatOpt ? selectedCatOpt.value : null;
        const selectedCatSlug = selectedCatOpt ? selectedCatOpt.dataset.slug : null;
        const isFeatured = sarojiniModalFeatured.checked;

        const res = await window.CrossStoreService.addMainToSarojini(client, productToAddSarojini, {
          department: selectedDept,
          categoryId: selectedCatId,
          categorySlug: selectedCatSlug,
          isFeatured: isFeatured
        });

        if (res.alreadyExists) {
          window.showToast(res.message, "info");
        } else {
          window.showToast(res.message, "success");
        }

        closeSarojiniModal();
        await loadProducts();
      } catch (err) {
        console.error("Add to Sarojini error:", err);
        alert("Failed to make product available in Sarojini Bazaar: " + (err.message || err));
      } finally {
        btnConfirmAddToSarojini.disabled = false;
        btnConfirmAddToSarojini.innerHTML = '<i class="fas fa-store"></i> Confirm &amp; Add to Sarojini';
      }
    });
  }

  // ==========================================================================
  // BULK ACTIONS TOOLBAR CONTROLLER (Push Sarojini, Remove Sarojini, Delete)
  // ==========================================================================
  const bulkToolbar = document.getElementById("bulk-actions-toolbar");
  const bulkCountSpan = document.getElementById("bulk-selected-count");
  const btnBulkTrending = document.getElementById("btn-bulk-trending");
  const btnBulkPushSarojini = document.getElementById("btn-bulk-push-sarojini");
  const btnBulkRemoveSarojini = document.getElementById("btn-bulk-remove-sarojini");
  const btnBulkBogo = document.getElementById("btn-bulk-bogo");
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  const btnBulkDeselect = document.getElementById("btn-bulk-deselect");

  // Bulk Trending Modal Elements
  const bulkTrendingModal = document.getElementById("modal-bulk-trending");
  const btnCloseBulkTrendingModal = document.getElementById("btn-close-bulk-trending-modal");
  const btnCancelBulkTrendingModal = document.getElementById("btn-cancel-bulk-trending-modal");
  const btnConfirmBulkTrending = document.getElementById("btn-confirm-bulk-trending");
  const bulkTrendingModalCount = document.getElementById("bulk-trending-modal-count");
  const bulkTrendingPreviewCount = document.getElementById("bulk-trending-preview-count");
  const bulkTrendingModalPreviewList = document.getElementById("bulk-trending-modal-preview-list");

  // Bulk BOGO Modal Elements
  const bulkBogoModal = document.getElementById("modal-bulk-bogo");
  const btnCloseBulkBogoModal = document.getElementById("btn-close-bulk-bogo-modal");
  const btnCancelBulkBogoModal = document.getElementById("btn-cancel-bulk-bogo-modal");
  const btnConfirmBulkBogo = document.getElementById("btn-confirm-bulk-bogo");
  const bulkBogoModalCount = document.getElementById("bulk-bogo-modal-count");
  const bulkBogoPreviewCount = document.getElementById("bulk-bogo-preview-count");
  const bulkBogoModalPreviewList = document.getElementById("bulk-bogo-modal-preview-list");

  // Bulk Modal Elements
  const bulkSarojiniModal = document.getElementById("modal-bulk-add-to-sarojini");
  const btnCloseBulkSarojiniModal = document.getElementById("btn-close-bulk-sarojini-modal");
  const btnCancelBulkSarojiniModal = document.getElementById("btn-cancel-bulk-sarojini-modal");
  const btnConfirmBulkAddToSarojini = document.getElementById("btn-confirm-bulk-add-to-sarojini");
  const bulkSarojiniModalCount = document.getElementById("bulk-sarojini-modal-count");
  const bulkSarojiniModalPreviewList = document.getElementById("bulk-sarojini-modal-preview-list");
  const bulkSarojiniModalDept = document.getElementById("bulk-sarojini-modal-dept");
  const bulkSarojiniModalCat = document.getElementById("bulk-sarojini-modal-cat");
  const bulkSarojiniModalFeatured = document.getElementById("bulk-sarojini-modal-featured");

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

  function updateBulkSarojiniModalCategories() {
    if (!bulkSarojiniModalCat) return;
    const dept = (bulkSarojiniModalDept?.value || "MEN").toUpperCase();
    const filteredCats = sarojiniCategories.filter(c => (c.department || "").toUpperCase() === dept);

    if (filteredCats.length === 0) {
      bulkSarojiniModalCat.innerHTML = '<option value="">No categories in department</option>';
      return;
    }

    bulkSarojiniModalCat.innerHTML = filteredCats.map(c => `<option value="${c.id}" data-slug="${c.slug || ''}">${escapeHtml(c.name)}</option>`).join("");
  }

  if (bulkSarojiniModalDept) {
    bulkSarojiniModalDept.addEventListener("change", updateBulkSarojiniModalCategories);
  }

  function openBulkAddToSarojiniModal() {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) return;

    if (bulkSarojiniModalCount) {
      bulkSarojiniModalCount.textContent = `${selectedList.length} Products Selected`;
    }

    if (bulkSarojiniModalPreviewList) {
      bulkSarojiniModalPreviewList.innerHTML = selectedList.map(p => {
        const thumb = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/34");
        const isAlreadyInSarojini = Boolean(p.is_in_sarojini);
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--admin-card-border);">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 34px; height: 34px; border-radius: 4px; object-fit: cover; background: #1e293b;" onerror="this.src='https://via.placeholder.com/34';">
              <div style="overflow: hidden;">
                <div style="font-size: 0.82rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.72rem; color: var(--admin-text-muted);">${window.formatINR(p.price)} • Stock: ${p.stock}</div>
              </div>
            </div>
            <div>
              ${isAlreadyInSarojini ? '<span class="badge badge-success" style="font-size: 0.65rem;">Already in Sarojini</span>' : '<span class="badge badge-pink" style="font-size: 0.65rem; background: rgba(225, 29, 72, 0.15); color: #fb7185;">New to Sarojini</span>'}
            </div>
          </div>
        `;
      }).join('');
    }

    updateBulkSarojiniModalCategories();
    if (bulkSarojiniModalFeatured) bulkSarojiniModalFeatured.checked = false;

    if (bulkSarojiniModal) bulkSarojiniModal.style.display = "flex";
  }

  function closeBulkAddToSarojiniModal() {
    if (bulkSarojiniModal) bulkSarojiniModal.style.display = "none";
  }

  if (btnCloseBulkSarojiniModal) btnCloseBulkSarojiniModal.addEventListener("click", closeBulkAddToSarojiniModal);
  if (btnCancelBulkSarojiniModal) btnCancelBulkSarojiniModal.addEventListener("click", closeBulkAddToSarojiniModal);

  btnBulkPushSarojini?.addEventListener("click", () => {
    if (selectedProductIds.size === 0) {
      window.showToast("Please select at least one product.", "warning");
      return;
    }
    openBulkAddToSarojiniModal();
  });

  btnConfirmBulkAddToSarojini?.addEventListener("click", async () => {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) return;

    btnConfirmBulkAddToSarojini.disabled = true;
    btnConfirmBulkAddToSarojini.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing to Sarojini...';

    try {
      const selectedDept = bulkSarojiniModalDept?.value || "MEN";
      const selectedCatOpt = bulkSarojiniModalCat?.selectedOptions[0];
      const selectedCatId = selectedCatOpt ? selectedCatOpt.value : null;
      const selectedCatSlug = selectedCatOpt ? selectedCatOpt.dataset.slug : null;
      const isFeatured = Boolean(bulkSarojiniModalFeatured?.checked);

      const res = await window.CrossStoreService.addMultipleMainToSarojini(client, selectedList, {
        department: selectedDept,
        categoryId: selectedCatId,
        categorySlug: selectedCatSlug,
        isFeatured: isFeatured
      });

      window.showToast?.(res.message || `Pushed ${selectedList.length} products to Sarojini Bazaar!`, "success");
      closeBulkAddToSarojiniModal();
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk add to Sarojini error:", err);
      alert("Failed to push products to Sarojini Bazaar: " + (err.message || err));
    } finally {
      btnConfirmBulkAddToSarojini.disabled = false;
      btnConfirmBulkAddToSarojini.innerHTML = '<i class="fas fa-store"></i> Confirm &amp; Push to Sarojini';
    }
  });

  btnBulkRemoveSarojini?.addEventListener("click", async () => {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) {
      window.showToast("Please select at least one product.", "warning");
      return;
    }

    const inSarojiniList = selectedList.filter(p => p.is_in_sarojini);
    if (inSarojiniList.length === 0) {
      alert("None of the selected products are currently available in Sarojini Bazaar.");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${inSarojiniList.length} selected product(s) from Sarojini Bazaar?\n\nThey will remain active in Main VALORA Store.`)) {
      return;
    }

    btnBulkRemoveSarojini.disabled = true;
    btnBulkRemoveSarojini.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

    try {
      const ids = inSarojiniList.map(p => p.id);
      const res = await window.CrossStoreService.removeMultipleFromStore(client, {
        productIds: ids,
        targetStore: "sarojini"
      });

      window.showToast?.(`Removed ${res.removedCount} product(s) from Sarojini Bazaar.`, "info");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk remove from Sarojini error:", err);
      alert("Failed to remove products from Sarojini: " + (err.message || err));
    } finally {
      btnBulkRemoveSarojini.disabled = false;
      btnBulkRemoveSarojini.innerHTML = '<i class="fas fa-times-circle"></i> Remove from Sarojini';
    }
  });

  btnBulkDelete?.addEventListener("click", async () => {
    const count = selectedProductIds.size;
    if (count === 0) return;

    if (!confirm(`Are you sure you want to delete/remove ${count} selected products from VADI?\n\nNative VADI products will be safely removed, and cross-listed products will have their VADI availability removed.`)) {
      return;
    }

    btnBulkDelete.disabled = true;
    btnBulkDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
      const ids = Array.from(selectedProductIds);

      for (const id of ids) {
        const prod = allProducts.find(p => String(p.id) === String(id));
        const isSarojiniOrigin = prod ? (prod.origin_catalog === "sarojini") : false;

        if (isSarojiniOrigin) {
          // Remove availability from Main
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "sarojini",
              productId: id,
              targetStore: "main"
            });
          } catch (e) {
            console.warn(`Failed to remove cross-listed Sarojini item ${id} from Main:`, e);
          }
        } else {
          // Native Main
          const isCrossInSarojini = Boolean(crossStoreMapping?.main_available_in_sarojini?.[id]?.available);
          if (!isCrossInSarojini) {
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "main",
                productId: id,
                targetStore: "sarojini"
              });
            } catch (_) {}
          }

          // Deactivate product
          await client.from("products").update({
            is_active: false,
            updated_at: new Date().toISOString()
          }).eq("id", id);
        }
      }

      try {
        localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
        if (window.VeloraCache) window.VeloraCache.invalidate();
      } catch (_) {}

      window.showToast?.(`Deleted/removed ${count} products successfully.`, "info");
      selectedProductIds.clear();
      updateBulkToolbar();
      await loadProducts();
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete products: " + (err.message || err));
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
  // BULK BOGO (BUY 1 GET 1 FREE) MODAL CONTROLLER
  // ==========================================================================
  function openBulkBogoModal() {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) {
      window.showToast?.("Please select at least one product.", "warning");
      return;
    }

    if (bulkBogoModalCount) {
      bulkBogoModalCount.textContent = `${selectedList.length} Product${selectedList.length === 1 ? '' : 's'} Selected`;
    }
    if (bulkBogoPreviewCount) {
      bulkBogoPreviewCount.textContent = `${selectedList.length}`;
    }

    // Check how many are currently in BOGO
    const bogoCount = selectedList.filter(p => bogoConfigIds.includes(p.id) || Boolean(p.is_bogo)).length;
    const radioEnable = document.querySelector('input[name="bulk-bogo-action-radio"][value="enable"]');
    const radioDisable = document.querySelector('input[name="bulk-bogo-action-radio"][value="disable"]');
    if (bogoCount === selectedList.length && radioDisable) {
      radioDisable.checked = true;
    } else if (radioEnable) {
      radioEnable.checked = true;
    }

    if (bulkBogoModalPreviewList) {
      bulkBogoModalPreviewList.innerHTML = selectedList.map(p => {
        const thumb = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/38");
        const isCurrentlyBogo = bogoConfigIds.includes(p.id) || Boolean(p.is_bogo);
        const catName = p.categories ? p.categories.name : (p.department || 'Uncategorized');
        return `
          <div class="bulk-bogo-item-row" data-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--admin-card-border); transition: opacity 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
              <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; background: #1e293b; flex-shrink: 0;" onerror="this.src='https://via.placeholder.com/38';">
              <div style="overflow: hidden; min-width: 0;">
                <div style="font-size: 0.84rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.74rem; color: var(--admin-text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>${escapeHtml(catName)}</span>
                  <span>•</span>
                  <strong style="color: #10b981;">${window.formatINR(p.price)}</strong>
                  ${p.original_price ? `<span style="text-decoration: line-through; color: #64748b;">${window.formatINR(p.original_price)}</span>` : ''}
                  <span>•</span>
                  <span>Stock: ${p.stock}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              ${isCurrentlyBogo 
                ? '<span class="badge badge-success" style="font-size: 0.7rem; background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">🎁 In BOGO</span>'
                : '<span class="badge badge-neutral" style="font-size: 0.7rem; color: var(--admin-text-muted);">Standard</span>'}
              <button type="button" class="btn-remove-preview-bogo" data-id="${p.id}" title="Exclude from this bulk action" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.15s ease;">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Wire individual item removal within the preview list
      bulkBogoModalPreviewList.querySelectorAll(".btn-remove-preview-bogo").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const removeId = String(btn.dataset.id);
          selectedProductIds.delete(removeId);

          // Uncheck corresponding table row checkbox
          const rowCb = tbody.querySelector(`.row-select-prod[data-id="${removeId}"]`);
          if (rowCb) rowCb.checked = false;

          const thSelectAll = document.getElementById("th-select-all-prods");
          if (thSelectAll) thSelectAll.checked = false;

          updateBulkToolbar();

          if (selectedProductIds.size === 0) {
            closeBulkBogoModal();
          } else {
            openBulkBogoModal();
          }
        });
      });
    }

    if (bulkBogoModal) bulkBogoModal.style.display = "flex";
  }

  function closeBulkBogoModal() {
    if (bulkBogoModal) bulkBogoModal.style.display = "none";
  }

  if (bulkBogoModal) {
    bulkBogoModal.addEventListener("click", (e) => {
      if (e.target === bulkBogoModal) closeBulkBogoModal();
    });
  }

  if (btnBulkBogo) {
    btnBulkBogo.addEventListener("click", () => {
      if (selectedProductIds.size === 0) {
        window.showToast?.("Please select at least one product.", "warning");
        return;
      }
      openBulkBogoModal();
    });
  }

  if (btnCloseBulkBogoModal) btnCloseBulkBogoModal.addEventListener("click", closeBulkBogoModal);
  if (btnCancelBulkBogoModal) btnCancelBulkBogoModal.addEventListener("click", closeBulkBogoModal);

  if (btnConfirmBulkBogo) {
    btnConfirmBulkBogo.addEventListener("click", async () => {
      const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
      if (selectedList.length === 0) return;

      const action = document.querySelector('input[name="bulk-bogo-action-radio"]:checked')?.value || "enable";

      btnConfirmBulkBogo.disabled = true;
      btnConfirmBulkBogo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving BOGO changes...';

      try {
        // Authoritatively fetch latest store_settings bogo_config
        const { data: bogoSetting, error: fetchErr } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "bogo_config")
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        let currentIds = (bogoSetting && bogoSetting.value && Array.isArray(bogoSetting.value.product_ids))
          ? [...bogoSetting.value.product_ids]
          : [];

        // Safe deduplicated Set operations
        const idSet = new Set(currentIds);
        const targetIds = selectedList.map(p => String(p.id));

        if (action === "enable") {
          targetIds.forEach(id => idSet.add(id));
        } else {
          targetIds.forEach(id => idSet.delete(id));
        }

        const finalIds = Array.from(idSet);

        // Atomic upsert to store_settings
        const { error: saveErr } = await client.from("store_settings").upsert({
          key: "bogo_config",
          value: {
            product_ids: finalIds,
            updated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

        if (saveErr) throw saveErr;

        // Invalidate caches & sync state
        bogoConfigIds = finalIds;
        try {
          localStorage.setItem("velora_bogo_config", JSON.stringify({ product_ids: finalIds }));
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
          if (window.VeloraCache) window.VeloraCache.invalidate();
        } catch (_) {}

        const actionText = action === "enable" ? "enabled for" : "disabled for";
        window.showToast?.(`BOGO successfully ${actionText} ${targetIds.length} product(s)!`, "success");

        closeBulkBogoModal();
        selectedProductIds.clear();
        const thSelectAll = document.getElementById("th-select-all-prods");
        if (thSelectAll) thSelectAll.checked = false;
        tbody.querySelectorAll(".row-select-prod").forEach(cb => cb.checked = false);
        updateBulkToolbar();

        renderProducts();
      } catch (err) {
        console.error("Bulk BOGO save error:", err);
        alert("Failed to save BOGO changes: " + (err.message || "An unexpected error occurred."));
      } finally {
        btnConfirmBulkBogo.disabled = false;
        btnConfirmBulkBogo.innerHTML = '<i class="fas fa-check-circle"></i> Save BOGO Changes';
      }
    });
  }

  // ==========================================================================
  // BULK TRENDING CONTROLLER & MODAL
  // ==========================================================================
  function openBulkTrendingModal() {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) return;

    if (bulkTrendingModalCount) {
      bulkTrendingModalCount.textContent = `${selectedList.length} Product${selectedList.length > 1 ? 's' : ''} Selected`;
    }
    if (bulkTrendingPreviewCount) {
      bulkTrendingPreviewCount.textContent = String(selectedList.length);
    }

    const trendingCount = selectedList.filter(p => Boolean(p.is_featured)).length;
    const radioEnable = document.querySelector('input[name="bulk-trending-action-radio"][value="enable"]');
    const radioDisable = document.querySelector('input[name="bulk-trending-action-radio"][value="disable"]');
    if (trendingCount === selectedList.length && radioDisable) {
      radioDisable.checked = true;
    } else if (radioEnable) {
      radioEnable.checked = true;
    }

    if (bulkTrendingModalPreviewList) {
      bulkTrendingModalPreviewList.innerHTML = selectedList.map(p => {
        const thumb = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/38");
        const isCurrentlyTrending = Boolean(p.is_featured);
        const catName = p.categories ? p.categories.name : (p.department || 'Uncategorized');
        return `
          <div class="bulk-trending-item-row" data-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--admin-card-border); transition: opacity 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
              <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; background: #1e293b; flex-shrink: 0;" onerror="this.src='https://via.placeholder.com/38';">
              <div style="overflow: hidden; min-width: 0;">
                <div style="font-size: 0.84rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.74rem; color: var(--admin-text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>${escapeHtml(catName)}</span>
                  <span>•</span>
                  <strong style="color: #fbbf24;">${window.formatINR(p.price)}</strong>
                  ${p.original_price ? `<span style="text-decoration: line-through; color: #64748b;">${window.formatINR(p.original_price)}</span>` : ''}
                  <span>•</span>
                  <span>Stock: ${p.stock}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              ${isCurrentlyTrending 
                ? '<span class="badge badge-warning" style="font-size: 0.7rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">🔥 Trending</span>'
                : '<span class="badge badge-neutral" style="font-size: 0.7rem; color: var(--admin-text-muted);">Standard</span>'}
              <button type="button" class="btn-remove-preview-trending" data-id="${p.id}" title="Exclude from this bulk action" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.15s ease;">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Wire individual item removal within preview list
      bulkTrendingModalPreviewList.querySelectorAll(".btn-remove-preview-trending").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const removeId = String(btn.dataset.id);
          selectedProductIds.delete(removeId);

          const rowCb = tbody.querySelector(`.row-select-prod[data-id="${removeId}"]`);
          if (rowCb) rowCb.checked = false;

          const thSelectAll = document.getElementById("th-select-all-prods");
          if (thSelectAll) thSelectAll.checked = false;

          updateBulkToolbar();

          if (selectedProductIds.size === 0) {
            closeBulkTrendingModal();
          } else {
            openBulkTrendingModal();
          }
        });
      });
    }

    if (bulkTrendingModal) bulkTrendingModal.style.display = "flex";
  }

  function closeBulkTrendingModal() {
    if (bulkTrendingModal) bulkTrendingModal.style.display = "none";
  }

  if (bulkTrendingModal) {
    bulkTrendingModal.addEventListener("click", (e) => {
      if (e.target === bulkTrendingModal) closeBulkTrendingModal();
    });
  }

  if (btnBulkTrending) {
    btnBulkTrending.addEventListener("click", () => {
      if (selectedProductIds.size === 0) {
        window.showToast?.("Please select at least one product.", "warning");
        return;
      }
      openBulkTrendingModal();
    });
  }

  if (btnCloseBulkTrendingModal) btnCloseBulkTrendingModal.addEventListener("click", closeBulkTrendingModal);
  if (btnCancelBulkTrendingModal) btnCancelBulkTrendingModal.addEventListener("click", closeBulkTrendingModal);

  if (btnConfirmBulkTrending) {
    btnConfirmBulkTrending.addEventListener("click", async () => {
      const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
      if (selectedList.length === 0) return;

      const action = document.querySelector('input[name="bulk-trending-action-radio"]:checked')?.value || "enable";
      const isTrending = (action === "enable");

      btnConfirmBulkTrending.disabled = true;
      btnConfirmBulkTrending.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Trending changes...';

      try {
        const client = window.AdminAuth ? window.AdminAuth.getClient() : (window.getSupabase ? window.getSupabase() : null);
        if (!client) throw new Error("Database client not available. Please ensure you are logged in.");

        const mainIds = selectedList.filter(p => p.origin_catalog !== 'sarojini').map(p => p.id);
        const sarojiniIds = selectedList.filter(p => p.origin_catalog === 'sarojini').map(p => p.id);

        // 1. Batch update Main Store products in public.products table
        if (mainIds.length > 0) {
          const { error: mainUpdErr } = await client
            .from("products")
            .update({
              is_featured: isTrending,
              updated_at: new Date().toISOString()
            })
            .in("id", mainIds);

          if (mainUpdErr) throw mainUpdErr;
        }

        // 2. Batch update Sarojini cross-listed products in cross_store_mapping and sarojini_products
        if (sarojiniIds.length > 0) {
          const { data: mappingSetting } = await client
            .from("store_settings")
            .select("value")
            .eq("key", "cross_store_mapping")
            .maybeSingle();

          let mapping = mappingSetting?.value || { main_available_in_sarojini: {}, sarojini_available_in_main: {} };
          if (!mapping.sarojini_available_in_main) mapping.sarojini_available_in_main = {};

          sarojiniIds.forEach(id => {
            if (mapping.sarojini_available_in_main[id]) {
              mapping.sarojini_available_in_main[id].is_featured = isTrending;
            }
          });

          await client.from("store_settings").upsert({
            key: "cross_store_mapping",
            value: mapping,
            updated_at: new Date().toISOString()
          }, { onConflict: "key" });

          await client
            .from("sarojini_products")
            .update({
              is_featured: isTrending,
              updated_at: new Date().toISOString()
            })
            .in("id", sarojiniIds);
        }

        // 3. Update in-memory product objects
        selectedList.forEach(p => {
          p.is_featured = isTrending;
        });

        // 4. Invalidate global caches so customer storefront immediately reflects updates
        try {
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
          if (window.VeloraCache) window.VeloraCache.invalidate();
        } catch (_) {}

        const actionText = isTrending ? "added to" : "removed from";
        window.showToast?.(`Trending status successfully ${actionText} ${selectedList.length} product(s)!`, "success");

        closeBulkTrendingModal();
        selectedProductIds.clear();
        const thSelectAll = document.getElementById("th-select-all-prods");
        if (thSelectAll) thSelectAll.checked = false;
        tbody.querySelectorAll(".row-select-prod").forEach(cb => cb.checked = false);
        updateBulkToolbar();

        renderProducts();
      } catch (err) {
        console.error("Bulk Trending save error:", err);
        alert("Failed to save Trending changes: " + (err.message || "An unexpected error occurred."));
      } finally {
        btnConfirmBulkTrending.disabled = false;
        btnConfirmBulkTrending.innerHTML = '<i class="fas fa-check-circle"></i> Save Trending Changes';
      }
    });
  }

  // ==========================================================================
  // BOGO Deals Management Modal
  // ==========================================================================
  const bogoModal = document.getElementById("modal-bogo-manager");
  const btnOpenBogoModal = document.getElementById("btn-open-bogo-modal");
  const btnCloseBogoModal = document.getElementById("btn-close-bogo-modal");
  const btnCancelBogo = document.getElementById("btn-cancel-bogo");
  const btnSaveBogo = document.getElementById("btn-save-bogo");
  const bogoSearchInput = document.getElementById("bogo-search-input");
  const bogoActiveCountBadge = document.getElementById("bogo-active-count-badge");
  const bogoProductsList = document.getElementById("bogo-products-list");

  let modalBogoIds = new Set();

  function renderBogoModalList() {
    if (!bogoProductsList) return;
    const query = (bogoSearchInput?.value || "").trim().toLowerCase();
    const displayList = allProducts.filter(p => {
      if (!query) return true;
      return (p.name && p.name.toLowerCase().includes(query)) ||
             (p.brand && p.brand.toLowerCase().includes(query));
    });

    if (bogoActiveCountBadge) {
      bogoActiveCountBadge.textContent = `${modalBogoIds.size} Active`;
    }

    if (displayList.length === 0) {
      bogoProductsList.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No products match your search.</div>';
      return;
    }

    bogoProductsList.innerHTML = displayList.map(p => {
      const isChecked = modalBogoIds.has(p.id);
      const thumb = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/48");
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid ${isChecked ? '#10b981' : 'var(--admin-card-border)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="bogo-product-toggle" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer;">
            <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 0.88rem;">${escapeHtml(p.name)}</div>
              <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(p.categories ? p.categories.name : (p.department || 'Uncategorized'))} • ${window.formatINR(p.price)}</div>
            </div>
          </div>
          <span class="badge ${isChecked ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.75rem;">
            ${isChecked ? '🎁 BOGO Eligible' : 'Standard'}
          </span>
        </label>
      `;
    }).join("");

    bogoProductsList.querySelectorAll(".bogo-product-toggle").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) {
          modalBogoIds.add(id);
        } else {
          modalBogoIds.delete(id);
        }
        renderBogoModalList();
      });
    });
  }

  function openBogoModal() {
    modalBogoIds = new Set(bogoConfigIds);
    if (bogoSearchInput) bogoSearchInput.value = "";
    renderBogoModalList();
    if (bogoModal) bogoModal.style.display = "flex";
  }

  function closeBogoModal() {
    if (bogoModal) bogoModal.style.display = "none";
  }

  if (btnOpenBogoModal) btnOpenBogoModal.addEventListener("click", openBogoModal);
  if (btnCloseBogoModal) btnCloseBogoModal.addEventListener("click", closeBogoModal);
  if (btnCancelBogo) btnCancelBogo.addEventListener("click", closeBogoModal);

  if (bogoSearchInput) bogoSearchInput.addEventListener("input", renderBogoModalList);

  if (btnSaveBogo) {
    btnSaveBogo.addEventListener("click", async () => {
      btnSaveBogo.disabled = true;
      btnSaveBogo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

      try {
        const chosenIds = Array.from(modalBogoIds);
        const { error } = await client.from("store_settings").upsert({
          key: "bogo_config",
          value: { product_ids: chosenIds },
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });

        if (error) throw error;

        bogoConfigIds = chosenIds;
        try {
          localStorage.setItem("velora_bogo_config", JSON.stringify({ product_ids: chosenIds }));
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
          if (window.VeloraCache) window.VeloraCache.invalidate();
        } catch (_) {}

        window.showToast(`BOGO Deals updated (${chosenIds.length} active products).`, "success");
        closeBogoModal();
        renderProducts();
      } catch (err) {
        console.error("Save BOGO error:", err);
        alert("Failed to save BOGO configuration: " + err.message);
      } finally {
        btnSaveBogo.disabled = false;
        btnSaveBogo.innerHTML = 'Save BOGO Deals';
      }
    });
  }

  // ==========================================================================
  // Bulk Advance Payment Modal Controller
  // ==========================================================================
  const bulkAdvanceModal = document.getElementById("modal-bulk-advance");
  const btnBulkAdvance = document.getElementById("btn-bulk-advance");
  const btnCloseBulkAdvanceModal = document.getElementById("btn-close-bulk-advance-modal");
  const btnCancelBulkAdvanceModal = document.getElementById("btn-cancel-bulk-advance-modal");
  const bulkAdvanceModalCount = document.getElementById("bulk-advance-modal-count");
  const bulkAdvanceCustomCount = document.getElementById("bulk-advance-custom-count");
  const bulkAdvanceToggle = document.getElementById("bulk-advance-toggle");
  const bulkAdvanceAmountSection = document.getElementById("bulk-advance-amount-section");
  const bulkAdvanceAmount = document.getElementById("bulk-advance-amount");
  const bulkAdvanceModalPreviewList = document.getElementById("bulk-advance-modal-preview-list");
  const bulkAdvancePreviewCount = document.getElementById("bulk-advance-preview-count");
  const btnConfirmBulkAdvanceSkip = document.getElementById("btn-confirm-bulk-advance-skip");
  const btnConfirmBulkAdvanceOverride = document.getElementById("btn-confirm-bulk-advance-override");

  function openBulkAdvanceModal() {
    const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
    if (selectedList.length === 0) {
      alert("Please select at least one product using the checkboxes.");
      return;
    }

    if (bulkAdvanceModalCount) {
      bulkAdvanceModalCount.textContent = `${selectedList.length} Product${selectedList.length === 1 ? '' : 's'} Selected`;
    }

    if (bulkAdvancePreviewCount) {
      bulkAdvancePreviewCount.textContent = selectedList.length;
    }

    // Set default amount from global settings or 120
    const defaultAmt = globalAdvanceSettings?.default_amount || 120;
    if (bulkAdvanceAmount) {
      bulkAdvanceAmount.value = defaultAmt;
    }

    // Count how many selected products have custom overrides
    let customCount = 0;
    selectedList.forEach(p => {
      if (window.AdvancePaymentService && window.AdvancePaymentService.isCustomOverride(p, globalAdvanceSettings)) {
        customCount++;
      }
    });

    if (bulkAdvanceCustomCount) {
      bulkAdvanceCustomCount.textContent = `${customCount} Custom Override${customCount === 1 ? '' : 's'}`;
      bulkAdvanceCustomCount.style.color = customCount > 0 ? '#fbbf24' : '#94a3b8';
    }

    // Render Preview List
    if (bulkAdvanceModalPreviewList) {
      bulkAdvanceModalPreviewList.innerHTML = selectedList.map(p => {
        const thumb = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/44");
        const info = window.AdvancePaymentService ? window.AdvancePaymentService.getProductAdvanceInfo(p, globalAdvanceSettings) : null;
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-card-border); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
              <img src="${thumb}" alt="${escapeHtml(p.name)}" style="width: 34px; height: 34px; border-radius: 4px; object-fit: contain; background: #1e293b; padding: 1px;">
              <div style="overflow: hidden;">
                <div style="font-weight: 600; font-size: 0.82rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.72rem; color: var(--admin-text-muted);">Selling Price: ${window.formatINR(p.price)}</div>
              </div>
            </div>
            <div>
              ${info ? info.badgeHtml : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    if (bulkAdvanceModal) bulkAdvanceModal.style.display = "flex";
  }

  function closeBulkAdvanceModal() {
    if (bulkAdvanceModal) bulkAdvanceModal.style.display = "none";
  }

  if (btnBulkAdvance) btnBulkAdvance.addEventListener("click", openBulkAdvanceModal);
  if (btnCloseBulkAdvanceModal) btnCloseBulkAdvanceModal.addEventListener("click", closeBulkAdvanceModal);
  if (btnCancelBulkAdvanceModal) btnCancelBulkAdvanceModal.addEventListener("click", closeBulkAdvanceModal);

  if (bulkAdvanceToggle) {
    bulkAdvanceToggle.addEventListener("change", () => {
      if (bulkAdvanceAmountSection) {
        bulkAdvanceAmountSection.style.display = bulkAdvanceToggle.checked ? "block" : "none";
      }
    });
  }

  document.querySelectorAll(".btn-quick-bulk-amt").forEach(btn => {
    btn.addEventListener("click", () => {
      const amt = btn.getAttribute("data-amt");
      if (bulkAdvanceAmount) bulkAdvanceAmount.value = amt;
    });
  });

  // Action 1: Apply Default (Skip Custom Overrides)
  if (btnConfirmBulkAdvanceSkip) {
    btnConfirmBulkAdvanceSkip.addEventListener("click", async () => {
      const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
      if (selectedList.length === 0) return;

      const isEnabled = bulkAdvanceToggle ? bulkAdvanceToggle.checked : true;
      const amount = parseFloat(bulkAdvanceAmount ? bulkAdvanceAmount.value : 120) || 0;

      btnConfirmBulkAdvanceSkip.disabled = true;
      btnConfirmBulkAdvanceSkip.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';

      try {
        const result = await window.AdvancePaymentService.applyBulkAdvance(client, {
          products: selectedList,
          isEnabled,
          amount,
          overrideCustom: false
        });

        globalAdvanceSettings = await window.AdvancePaymentService.getGlobalSettings(client);
        window.showToast?.(`Applied advance (₹${amount}) to ${result.updatedCount} product(s). Preserved ${result.skippedCustomCount} custom override(s).`, "success");
        closeBulkAdvanceModal();
        renderProducts();
      } catch (err) {
        console.error("Bulk advance skip error:", err);
        alert("Failed to apply advance payment: " + err.message);
      } finally {
        btnConfirmBulkAdvanceSkip.disabled = false;
        btnConfirmBulkAdvanceSkip.innerHTML = '<i class="fas fa-check-circle"></i> Apply Default (Skip Custom)';
      }
    });
  }

  // Action 2: Apply & Override Custom Amounts
  if (btnConfirmBulkAdvanceOverride) {
    btnConfirmBulkAdvanceOverride.addEventListener("click", async () => {
      const selectedList = allProducts.filter(p => selectedProductIds.has(String(p.id)));
      if (selectedList.length === 0) return;

      const isEnabled = bulkAdvanceToggle ? bulkAdvanceToggle.checked : true;
      const amount = parseFloat(bulkAdvanceAmount ? bulkAdvanceAmount.value : 120) || 0;

      let customCount = 0;
      selectedList.forEach(p => {
        if (window.AdvancePaymentService && window.AdvancePaymentService.isCustomOverride(p, globalAdvanceSettings)) {
          customCount++;
        }
      });

      if (customCount > 0) {
        const confirmed = confirm(
          `⚠️ WARNING: OVERWRITE CUSTOM ADVANCE AMOUNTS\n\n` +
          `You have selected ${selectedList.length} product(s), including ${customCount} product(s) with custom advance amounts.\n\n` +
          `Are you sure you want to FORCE OVERWRITE all custom amounts with ₹${amount}?`
        );
        if (!confirmed) return;
      }

      btnConfirmBulkAdvanceOverride.disabled = true;
      btnConfirmBulkAdvanceOverride.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Overwriting...';

      try {
        const result = await window.AdvancePaymentService.applyBulkAdvance(client, {
          products: selectedList,
          isEnabled,
          amount,
          overrideCustom: true
        });

        globalAdvanceSettings = await window.AdvancePaymentService.getGlobalSettings(client);
        window.showToast?.(`Force applied ₹${amount} across all ${result.updatedCount} selected product(s) and cleared overrides.`, "success");
        closeBulkAdvanceModal();
        renderProducts();
      } catch (err) {
        console.error("Bulk advance override error:", err);
        alert("Failed to overwrite advance payment: " + err.message);
      } finally {
        btnConfirmBulkAdvanceOverride.disabled = false;
        btnConfirmBulkAdvanceOverride.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Apply &amp; Override Custom';
      }
    });
  }

  await loadCategories();
  await loadProducts();
});
