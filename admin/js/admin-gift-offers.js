/**
 * VELORA Admin Panel - Free Gifts & Payment Offers Controller
 * Fully Supabase backend controlled system for managing category and product-level free gift bundles.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient() || window.veloraSupabase || window.supabaseClient;

  // DOM Elements
  const container = document.getElementById("gift-offers-container");
  const btnOpenCreate = document.getElementById("btn-open-create-modal");
  const btnRefresh = document.getElementById("btn-refresh-offers");
  const modal = document.getElementById("gift-modal-backdrop");
  const btnCloseModal = document.getElementById("btn-close-gift-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("gift-offer-form");
  const modalTitle = document.getElementById("modal-title");

  // Filter Elements
  const searchInput = document.getElementById("gift-search");
  const filterTarget = document.getElementById("filter-target");
  const filterStatus = document.getElementById("filter-status");
  const countLabel = document.getElementById("offers-count-label");

  // Metrics Elements
  const statActive = document.getElementById("stat-active-offers");
  const statCatRules = document.getElementById("stat-category-rules");
  const statProdOverrides = document.getElementById("stat-product-overrides");
  const statTotalGifts = document.getElementById("stat-total-gifts");

  // Form Fields
  const fId = document.getElementById("offer-id");
  const fTitle = document.getElementById("offer-title");
  const fDesc = document.getElementById("offer-description");
  const fPriority = document.getElementById("offer-priority");
  const fTargetType = document.getElementById("target-type");
  const fGroupCategory = document.getElementById("group-target-category");
  const fGroupProduct = document.getElementById("group-target-product");
  const fCategoryId = document.getElementById("target-category-id");
  const fProductId = document.getElementById("target-product-id");
  const fIsActive = document.getElementById("offer-is-active");
  const fStartDate = document.getElementById("offer-start-date");
  const fEndDate = document.getElementById("offer-end-date");
  const repeaterList = document.getElementById("gift-items-list");
  const btnAddItem = document.getElementById("btn-add-gift-item");

  // Live Preview Elements
  const prevBadgeText = document.getElementById("prev-badge-text");
  const prevOfferTitle = document.getElementById("prev-offer-title");
  const prevItemsChips = document.getElementById("prev-items-chips");

  // State
  let allOffers = [];
  let categoriesMap = {};
  let productsMap = {};
  let categoriesList = [];
  let productsList = [];

  // 1. Load Categories & Products from Supabase
  async function loadMetadata() {
    try {
      const [catRes, prodRes] = await Promise.all([
        client.from("categories").select("id, name, slug").order("name"),
        client.from("products").select("id, name, category_id, price").order("name").limit(100)
      ]);

      if (!catRes.error && catRes.data) {
        categoriesList = catRes.data;
        catRes.data.forEach(c => {
          categoriesMap[c.id] = c;
          if (c.slug) categoriesMap[c.slug] = c;
        });
      }

      if (!prodRes.error && prodRes.data) {
        productsList = prodRes.data;
        prodRes.data.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      // Populate Select Dropdowns
      fCategoryId.innerHTML = '<option value="">-- Choose Category --</option>' +
        categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

      fProductId.innerHTML = '<option value="">-- Choose Product --</option>' +
        productsList.map(p => `<option value="${p.id}">${p.name} (₹${Math.round(p.price || 0)})</option>`).join("");
    } catch (e) {
      console.warn("Error loading categories or products for gifts:", e);
    }
  }

  // 2. Fetch all Gift Offers
  async function loadOffers() {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--admin-text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 12px; color: var(--admin-accent);"></i>
        <p>Loading gift offers...</p>
      </div>
    `;

    try {
      let offers = [];
      // Try direct database table query
      const { data: dbOffers, error } = await client
        .from("online_gift_offers")
        .select("*, online_gift_items(*)")
        .order("priority", { ascending: false });

      if (!error && Array.isArray(dbOffers) && dbOffers.length > 0) {
        offers = dbOffers.map(o => ({
          ...o,
          items: Array.isArray(o.online_gift_items) ? o.online_gift_items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : []
        }));
      } else {
        // Fallback to centralized GiftEngine (reads settings/seeds/storage)
        offers = await window.GiftEngine.fetchOffers();
      }

      allOffers = offers || [];
      renderOffers();
      updateMetrics();
    } catch (err) {
      console.error("Error fetching gift offers:", err);
      allOffers = await window.GiftEngine.fetchOffers();
      renderOffers();
      updateMetrics();
    }
  }

  // 3. Update Metrics Counters
  function updateMetrics() {
    const activeCount = allOffers.filter(o => o.is_active).length;
    const catCount = allOffers.filter(o => o.target_type === "category").length;
    const prodCount = allOffers.filter(o => o.target_type === "product").length;
    let totalItems = 0;
    allOffers.forEach(o => {
      totalItems += (o.items ? o.items.length : 0);
    });

    if (statActive) statActive.textContent = activeCount;
    if (statCatRules) statCatRules.textContent = catCount;
    if (statProdOverrides) statProdOverrides.textContent = prodCount;
    if (statTotalGifts) statTotalGifts.textContent = totalItems;
  }

  // 4. Render Offers Grid
  function renderOffers() {
    let filtered = [...allOffers];
    const q = (searchInput?.value || "").trim().toLowerCase();
    const tTarget = filterTarget?.value || "all";
    const tStatus = filterStatus?.value || "all";

    if (q) {
      filtered = filtered.filter(o => {
        const titleMatch = (o.title || "").toLowerCase().includes(q);
        const descMatch = (o.description || "").toLowerCase().includes(q);
        const catObj = categoriesMap[o.category_id] || {};
        const prodObj = productsMap[o.product_id] || {};
        const catMatch = (catObj.name || "").toLowerCase().includes(q);
        const prodMatch = (prodObj.name || "").toLowerCase().includes(q);
        const itemMatch = (o.items || []).some(i => (i.name || "").toLowerCase().includes(q));
        return titleMatch || descMatch || catMatch || prodMatch || itemMatch;
      });
    }

    if (tTarget !== "all") {
      filtered = filtered.filter(o => o.target_type === tTarget);
    }

    if (tStatus !== "all") {
      const activeBool = tStatus === "active";
      filtered = filtered.filter(o => Boolean(o.is_active) === activeBool);
    }

    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${allOffers.length} offer${allOffers.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--admin-card-bg); border: 1px dashed var(--admin-card-border); border-radius: var(--admin-radius);">
          <i class="fas fa-gift" style="font-size: 2.5rem; color: var(--admin-text-muted); margin-bottom: 12px;"></i>
          <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 6px;">No Gift Offers Found</h3>
          <p style="color: var(--admin-text-muted); font-size: 0.85rem; max-width: 400px; margin: 0 auto 16px;">
            ${q || tTarget !== 'all' || tStatus !== 'all' ? 'Try adjusting your filters or search terms.' : 'Create your first free gift offer bundle for full online payments.'}
          </p>
          <button type="button" class="btn-admin-primary btn-open-modal-empty" style="font-size: 0.85rem;">
            <i class="fas fa-plus"></i> Create Gift Offer
          </button>
        </div>
      `;
      const btnEmpty = container.querySelector(".btn-open-modal-empty");
      if (btnEmpty) btnEmpty.addEventListener("click", () => openCreateModal());
      return;
    }

    container.innerHTML = filtered.map(o => {
      const isCat = o.target_type === "category";
      const catObj = categoriesMap[o.category_id] || {};
      const prodObj = productsMap[o.product_id] || {};
      const targetName = isCat 
        ? (catObj.name || o.category_id || "Unknown Category") 
        : (prodObj.name || o.product_id || "Specific Product");
      const targetIcon = isCat ? "fa-tags" : "fa-box-open";
      const targetBadgeColor = isCat ? "badge-indigo" : "badge-amber";

      const items = Array.isArray(o.items) ? o.items : [];
      const itemsCount = items.length;

      const itemsHtml = items.map(item => `
        <div class="gift-item-chip" title="${item.description || ''}">
          <span style="font-size: 1.1rem;">${item.icon || '🎁'}</span>
          <div style="line-height: 1.2;">
            <strong style="color: #fff; display: block;">${item.name || 'Gift Item'}</strong>
            <span style="font-size: 0.72rem; color: var(--admin-text-muted);">${item.quantity || '1 Pc'}</span>
          </div>
        </div>
      `).join("");

      return `
        <div class="gift-offer-card ${!o.is_active ? 'inactive' : ''}" data-id="${o.id}">
          <div>
            <!-- Header Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px;">
              <div>
                <span class="badge ${targetBadgeColor}" style="font-size: 0.72rem; margin-right: 6px;">
                  <i class="fas ${targetIcon}"></i> ${isCat ? 'Category Rule' : 'Product Override'}
                </span>
                <span class="badge badge-muted" style="font-size: 0.72rem;">Priority: ${o.priority || 10}</span>
              </div>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.75rem; color: ${o.is_active ? '#10b981' : '#ef4444'}; font-weight: 700;">
                <input type="checkbox" class="toggle-offer-active" data-id="${o.id}" ${o.is_active ? 'checked' : ''} style="accent-color: #10b981; width: 16px; height: 16px;">
                <span>${o.is_active ? 'ACTIVE' : 'DISABLED'}</span>
              </label>
            </div>

            <!-- Title & Target -->
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 6px; line-height: 1.3;">
              ${o.title}
            </h3>
            <div style="font-size: 0.82rem; color: #93c5fd; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <i class="fas ${targetIcon}"></i>
              <strong>Target:</strong> ${targetName}
            </div>
            ${o.description ? `<p style="font-size: 0.78rem; color: var(--admin-text-muted); margin-bottom: 14px; line-height: 1.4;">${o.description}</p>` : ''}

            <!-- Gift Items List -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
                🎁 ${itemsCount} Complimentary Gift Item${itemsCount === 1 ? '' : 's'}:
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${itemsHtml || '<span style="font-size: 0.78rem; color: var(--admin-text-muted);">No gift items attached</span>'}
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--admin-card-border); margin-top: 8px;">
            <span style="font-size: 0.72rem; color: var(--admin-text-muted);">
              ${o.start_date || o.end_date ? `Valid: ${o.start_date || 'Start'} to ${o.end_date || 'Indefinite'}` : 'Indefinite Validity'}
            </span>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-admin-secondary btn-edit-offer" data-id="${o.id}" style="padding: 5px 10px; font-size: 0.78rem;">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button type="button" class="btn-admin-danger btn-delete-offer" data-id="${o.id}" data-title="${o.title}" style="padding: 5px 10px; font-size: 0.78rem;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach Action Listeners
    container.querySelectorAll(".btn-edit-offer").forEach(b => {
      b.addEventListener("click", () => openEditModal(b.dataset.id));
    });

    container.querySelectorAll(".btn-delete-offer").forEach(b => {
      b.addEventListener("click", () => handleDeleteOffer(b.dataset.id, b.dataset.title));
    });

    container.querySelectorAll(".toggle-offer-active").forEach(chk => {
      chk.addEventListener("change", async (e) => {
        const id = chk.dataset.id;
        const newStatus = chk.checked;
        await handleToggleActive(id, newStatus);
      });
    });
  }

  // 5. Open Modal for Create
  function openCreateModal() {
    form.reset();
    fId.value = "";
    modalTitle.innerHTML = '<i class="fas fa-plus-circle" style="color: #10b981; margin-right: 8px;"></i> Create Free Gift Offer';
    fPriority.value = 10;
    fIsActive.checked = true;
    fTargetType.value = "category";
    updateTargetTypeUI();

    // Default gift item row
    repeaterList.innerHTML = "";
    addGiftItemRow({ icon: "🎁", name: "", description: "", quantity: "1 Pc", sort_order: 1 });

    updateLivePreview();
    modal.style.display = "flex";
  }

  // 6. Open Modal for Edit
  function openEditModal(id) {
    const offer = allOffers.find(o => o.id === id);
    if (!offer) return;

    form.reset();
    fId.value = offer.id;
    modalTitle.innerHTML = `<i class="fas fa-edit" style="color: #f59e0b; margin-right: 8px;"></i> Edit Offer: ${offer.title}`;
    fTitle.value = offer.title || "";
    fDesc.value = offer.description || "";
    fPriority.value = offer.priority || 10;
    fTargetType.value = offer.target_type || "category";
    fCategoryId.value = offer.category_id || "";
    fProductId.value = offer.product_id || "";
    fIsActive.checked = Boolean(offer.is_active);
    fStartDate.value = offer.start_date || "";
    fEndDate.value = offer.end_date || "";

    updateTargetTypeUI();

    repeaterList.innerHTML = "";
    const items = Array.isArray(offer.items) ? offer.items : [];
    if (items.length > 0) {
      items.forEach((item, idx) => {
        addGiftItemRow({ ...item, sort_order: idx + 1 });
      });
    } else {
      addGiftItemRow({ icon: "🎁", name: "", description: "", quantity: "1 Pc", sort_order: 1 });
    }

    updateLivePreview();
    modal.style.display = "flex";
  }

  // 7. Add Gift Item Row to Repeater
  function addGiftItemRow(item = {}) {
    const rowCount = repeaterList.querySelectorAll(".gift-repeater-row").length;
    if (rowCount >= 5) {
      window.showToast("Maximum of 5 gift items allowed per offer bundle.", "warning");
      return;
    }

    const row = document.createElement("div");
    row.className = "gift-repeater-row";
    row.innerHTML = `
      <div>
        <input type="text" class="admin-input item-icon" value="${item.icon || '🎁'}" placeholder="Icon" style="text-align:center; font-size:1.1rem; padding: 6px 4px; width:100%;" title="Emoji or Icon">
      </div>
      <div>
        <input type="text" class="admin-input item-name" value="${item.name || ''}" placeholder="Gift item name *" required style="width:100%;">
      </div>
      <div>
        <input type="text" class="admin-input item-desc" value="${item.description || ''}" placeholder="Short detail / perk" style="width:100%;">
      </div>
      <div>
        <input type="text" class="admin-input item-qty" value="${item.quantity || '1 Pair'}" placeholder="Qty / Unit" style="width:100%;">
      </div>
      <div style="text-align: center;">
        <button type="button" class="btn-remove-gift-item" style="background:none; border:none; color:#ef4444; font-size:1rem; cursor:pointer;" title="Remove this gift item">
          <i class="fas fa-times-circle"></i>
        </button>
      </div>
    `;

    row.querySelector(".btn-remove-gift-item").addEventListener("click", () => {
      if (repeaterList.querySelectorAll(".gift-repeater-row").length <= 1) {
        window.showToast("An offer bundle must include at least 1 complimentary gift item.", "warning");
        return;
      }
      row.remove();
      updateLivePreview();
    });

    row.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", updateLivePreview);
    });

    repeaterList.appendChild(row);
  }

  // 8. Update Target Type UI
  function updateTargetTypeUI() {
    const isCat = fTargetType.value === "category";
    if (isCat) {
      fGroupCategory.style.display = "block";
      fGroupProduct.style.display = "none";
      if (!fId.value) fPriority.value = 10;
    } else {
      fGroupCategory.style.display = "none";
      fGroupProduct.style.display = "block";
      if (!fId.value) fPriority.value = 50;
    }
  }

  // 9. Update Live 3D Preview
  function updateLivePreview() {
    const titleVal = fTitle.value.trim() || "Full Online Payment Free Gift Offer";
    const rows = repeaterList.querySelectorAll(".gift-repeater-row");
    const items = [];
    rows.forEach(r => {
      const name = r.querySelector(".item-name").value.trim();
      const icon = r.querySelector(".item-icon").value.trim() || "🎁";
      const qty = r.querySelector(".item-qty").value.trim() || "1 Pc";
      if (name) items.push({ name, icon, qty });
    });

    const count = items.length;
    prevBadgeText.textContent = `PAY FULL ONLINE • ${count > 0 ? count : 3} FREE GIFTS`;
    prevOfferTitle.textContent = titleVal;

    if (items.length === 0) {
      prevItemsChips.innerHTML = `
        <div class="gift-item-chip"><span>🎁</span> <span>Sample Gift Item (1 Pc)</span></div>
      `;
    } else {
      prevItemsChips.innerHTML = items.map(i => `
        <div class="gift-item-chip">
          <span>${i.icon}</span>
          <strong>${i.name}</strong>
          <span style="font-size:0.72rem; color: #94a3b8;">(${i.qty})</span>
        </div>
      `).join("");
    }
  }

  // 10. Handle Form Submission (Create or Update)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-submit-offer");
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const id = fId.value || `offer-${Date.now()}`;
      const isCat = fTargetType.value === "category";
      const categoryId = isCat ? fCategoryId.value : null;
      const productId = !isCat ? fProductId.value : null;

      if (isCat && !categoryId) {
        window.showToast("Please choose an applicable category.", "warning");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-save"></i> Save Gift Offer';
        return;
      }

      if (!isCat && !productId) {
        window.showToast("Please choose a specific product override.", "warning");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-save"></i> Save Gift Offer';
        return;
      }

      // Collect gift items
      const rows = repeaterList.querySelectorAll(".gift-repeater-row");
      const giftItems = [];
      rows.forEach((r, idx) => {
        const name = r.querySelector(".item-name").value.trim();
        const icon = r.querySelector(".item-icon").value.trim() || "🎁";
        const desc = r.querySelector(".item-desc").value.trim() || "";
        const qty = r.querySelector(".item-qty").value.trim() || "1 Pc";
        if (name) {
          giftItems.push({
            id: `item-${Date.now()}-${idx}`,
            offer_id: id,
            name,
            icon,
            description: desc,
            quantity: qty,
            sort_order: idx + 1
          });
        }
      });

      if (giftItems.length === 0) {
        window.showToast("Please add at least one gift item with a name.", "warning");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-save"></i> Save Gift Offer';
        return;
      }

      const offerPayload = {
        id,
        title: fTitle.value.trim(),
        description: fDesc.value.trim(),
        target_type: fTargetType.value,
        category_id: categoryId,
        product_id: productId,
        priority: parseInt(fPriority.value, 10) || 10,
        is_active: fIsActive.checked,
        start_date: fStartDate.value || null,
        end_date: fEndDate.value || null,
        items: giftItems,
        updated_at: new Date().toISOString()
      };

      // 1. Update in local list
      const existingIdx = allOffers.findIndex(o => o.id === id);
      if (existingIdx >= 0) {
        allOffers[existingIdx] = offerPayload;
      } else {
        allOffers.unshift(offerPayload);
      }

      // 2. Persist through GiftEngine (handles DB write + store_settings sync + localStorage)
      await window.GiftEngine.saveOffers(allOffers, client);

      window.showToast("Gift offer saved successfully!", "success");
      modal.style.display = "none";
      renderOffers();
      updateMetrics();
    } catch (err) {
      console.error("Error saving gift offer:", err);
      window.showToast("Failed to save offer: " + (err.message || err), "danger");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fas fa-save"></i> Save Gift Offer';
    }
  });

  // 11. Quick Toggle Active Status
  async function handleToggleActive(id, newStatus) {
    const offer = allOffers.find(o => o.id === id);
    if (!offer) return;
    offer.is_active = newStatus;
    offer.updated_at = new Date().toISOString();

    try {
      await window.GiftEngine.saveOffers(allOffers, client);
      window.showToast(`Offer "${offer.title}" is now ${newStatus ? 'ACTIVE' : 'DISABLED'}.`, "success");
      renderOffers();
      updateMetrics();
    } catch (e) {
      console.error("Failed to toggle offer status:", e);
      window.showToast("Failed to update status: " + e.message, "danger");
    }
  }

  // 12. Delete Offer
  async function handleDeleteOffer(id, title) {
    if (!confirm(`Are you sure you want to delete the gift offer "${title}"?`)) return;

    allOffers = allOffers.filter(o => o.id !== id);
    try {
      // Delete from DB table if exists
      try {
        await client.from("online_gift_items").delete().eq("offer_id", id);
        await client.from("online_gift_offers").delete().eq("id", id);
      } catch (dErr) {
        console.warn("DB table delete warning:", dErr);
      }

      await window.GiftEngine.saveOffers(allOffers, client);
      window.showToast(`Deleted gift offer "${title}".`, "success");
      renderOffers();
      updateMetrics();
    } catch (e) {
      console.error("Failed to delete offer:", e);
      window.showToast("Failed to delete offer: " + e.message, "danger");
    }
  }

  // Event Listeners for UI
  btnOpenCreate.addEventListener("click", openCreateModal);
  btnRefresh.addEventListener("click", loadOffers);
  btnCloseModal.addEventListener("click", () => { modal.style.display = "none"; });
  btnCancelModal.addEventListener("click", () => { modal.style.display = "none"; });
  btnAddItem.addEventListener("click", () => {
    addGiftItemRow({ icon: "🎁", name: "", description: "", quantity: "1 Pc" });
    updateLivePreview();
  });

  fTargetType.addEventListener("change", () => {
    updateTargetTypeUI();
    updateLivePreview();
  });
  fTitle.addEventListener("input", updateLivePreview);
  searchInput.addEventListener("input", renderOffers);
  filterTarget.addEventListener("change", renderOffers);
  filterStatus.addEventListener("change", renderOffers);

  // Initial Load
  await loadMetadata();
  await loadOffers();
});

