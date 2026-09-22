/**
 * VELORA Admin Panel - Products Controller
 * Manages Main VADI catalog, search, stock/category/availability filters,
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

    const { data: mainProductsData, error } = await client
      .from("products")
      .select("*, categories(name)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--admin-danger);">Failed to load products: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    // Map native Main products
    const mapped = (mainProductsData || []).map(p => {
      const isAvailableInSarojini = Boolean(crossStoreMapping.main_available_in_sarojini?.[p.id]?.available);
      return {
        ...p,
        origin_catalog: 'main',
        is_in_main: true,
        is_in_sarojini: isAvailableInSarojini
      };
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
            const assignment = crossStoreMapping.sarojini_available_in_main[sp.id] || {};
            mapped.push({
              ...sp,
              origin_catalog: 'sarojini',
              category_id: assignment.category_id || sp.category_id,
              is_featured: (assignment.is_featured !== undefined) ? assignment.is_featured : sp.is_featured,
              is_in_main: true,
              is_in_sarojini: true
            });
          });
        }
      } catch (crossErr) {
        console.warn("[Main Products] Failed to load cross-store Sarojini products:", crossErr);
      }
    }

    allProducts = mapped;
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
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 40px 20px; color: var(--admin-text-muted);">No products match your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const primaryImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || "https://via.placeholder.com/60");
      const catName = p.categories ? p.categories.name : (p.department || "Uncategorized");
      const activeBadge = p.is_active 
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Inactive</span>';

      const advanceBadge = p.advance_payment_enabled
        ? (p.advance_payment_type === 'percentage'
            ? `<span class="badge badge-indigo" title="Requires ${p.advance_payment_value}% upfront deposit">✓ ${p.advance_payment_value}%</span>`
            : `<span class="badge badge-indigo" title="Requires ${window.formatINR(p.advance_payment_value)} upfront deposit">✓ ${window.formatINR(p.advance_payment_value)}</span>`)
        : '<span style="color: var(--admin-text-muted); font-size: 0.78rem;">—</span>';

      const isBogo = bogoConfigIds.includes(p.id) || Boolean(p.is_bogo);
      const badgesHtml = [
        p.is_featured ? '<span class="badge badge-warning" style="font-size: 0.68rem;">Featured</span>' : '',
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
                : `<button type="button" class="btn-admin-danger btn-remove-from-main" data-id="${p.id}" data-name="${escapeHtml(p.name)}" style="padding: 2px 7px; font-size: 0.68rem;" title="Remove availability from Main VADI Store">
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
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap: 12px;">
              <img src="${primaryImage}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--admin-card-border);" onerror="this.src='https://via.placeholder.com/60';">
              <div>
                <a href="${editUrl}" style="font-weight: 700; color: #fff; text-decoration: none; font-size: 0.92rem;">${escapeHtml(p.name)}</a>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(p.brand || 'VADI')}</div>
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

    // Attach delete listeners
    document.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const origin = btn.dataset.origin;
        const name = btn.dataset.name;

        if (origin === "sarojini") {
          if (confirm(`"${name}" is a Sarojini Bazaar product available in Main VADI Store. Remove availability from Main VADI Store? The product will remain active in Sarojini Bazaar.`)) {
            btn.disabled = true;
            try {
              await window.CrossStoreService.removeFromStore(client, {
                originCatalog: "sarojini",
                productId: id,
                targetStore: "main"
              });
              window.showToast(`Removed "${name}" from Main VADI Store.`, "info");
              await loadProducts();
            } catch (err) {
              console.error("Remove from Main failed:", err);
              alert("Could not remove product from Main Store: " + err.message);
              btn.disabled = false;
            }
          }
          return;
        }

        // Native Main product
        if (confirm(`Are you sure you want to delete "${name}"? This will remove it from the Main catalog.`)) {
          btn.disabled = true;
          // Also remove from cross_store_mapping if present
          try {
            await window.CrossStoreService.removeFromStore(client, {
              originCatalog: "main",
              productId: id,
              targetStore: "sarojini"
            });
          } catch (_) {}

          const { error } = await client.from("products").delete().eq("id", id);
          if (error) {
            alert("Could not delete product: " + error.message);
            btn.disabled = false;
          } else {
            try {
              localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
              if (window.VeloraCache) window.VeloraCache.invalidate();
            } catch (_) {}

            window.showToast(`"${name}" removed successfully.`, "success");
            await loadProducts();
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

    // Attach Remove from Main handlers
    document.querySelectorAll(".btn-remove-from-main").forEach(btn => {
      btn.addEventListener("click", async () => {
        const prodId = btn.dataset.id;
        const prodName = btn.dataset.name;
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

  await loadCategories();
  await loadProducts();
});
