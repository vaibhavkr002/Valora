/**
 * VADI Admin Panel - Sarojini Categories Controller
 * Handles dedicated Sarojini departments & subcategories CRUD with live Supabase sync
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("categories-tbody");
  const modalBackdrop = document.getElementById("category-modal-backdrop");
  const deleteModal = document.getElementById("delete-cat-modal");
  const categoryForm = document.getElementById("category-form");
  const deptTabs = document.getElementById("dept-tabs");
  const searchInput = document.getElementById("search-categories");
  const currentDeptTitle = document.getElementById("current-dept-title");

  // Form Fields
  const catDepartment = document.getElementById("cat-department");
  const catName = document.getElementById("cat-name");
  const catSlug = document.getElementById("cat-slug");
  const catOrder = document.getElementById("cat-order");
  const catImage = document.getElementById("cat-image");
  const catDesc = document.getElementById("cat-desc");
  const catIsActive = document.getElementById("cat-is-active");
  const modalTitle = document.getElementById("modal-title");

  let allCategories = [];
  let currentDept = "ALL";
  let editingCatId = null;
  let catToDelete = null;

  // Initial starter categories if database is fresh
  const DEFAULT_SAROJINI_CATEGORIES = [
    // MEN
    { id: "s-m-1", department: "MEN", name: "T-Shirts", slug: "men-t-shirts", display_order: 1, is_active: true },
    { id: "s-m-2", department: "MEN", name: "Shirts", slug: "men-shirts", display_order: 2, is_active: true },
    { id: "s-m-3", department: "MEN", name: "Polos", slug: "men-polos", display_order: 3, is_active: true },
    { id: "s-m-4", department: "MEN", name: "Oversized T-Shirts", slug: "men-oversized-t-shirts", display_order: 4, is_active: true },
    { id: "s-m-5", department: "MEN", name: "Hoodies", slug: "men-hoodies", display_order: 5, is_active: true },
    { id: "s-m-6", department: "MEN", name: "Sweatshirts", slug: "men-sweatshirts", display_order: 6, is_active: true },
    { id: "s-m-7", department: "MEN", name: "Jeans", slug: "men-jeans", display_order: 7, is_active: true },
    { id: "s-m-8", department: "MEN", name: "Trousers", slug: "men-trousers", display_order: 8, is_active: true },
    { id: "s-m-9", department: "MEN", name: "Cargo Pants", slug: "men-cargo-pants", display_order: 9, is_active: true },
    { id: "s-m-10", department: "MEN", name: "Shorts", slug: "men-shorts", display_order: 10, is_active: true },
    { id: "s-m-11", department: "MEN", name: "Jackets", slug: "men-jackets", display_order: 11, is_active: true },
    { id: "s-m-12", department: "MEN", name: "Co-ord Sets", slug: "men-co-ord-sets", display_order: 12, is_active: true },
    // WOMEN
    { id: "s-w-1", department: "WOMEN", name: "Tops", slug: "women-tops", display_order: 1, is_active: true },
    { id: "s-w-2", department: "WOMEN", name: "T-Shirts", slug: "women-t-shirts", display_order: 2, is_active: true },
    { id: "s-w-3", department: "WOMEN", name: "Shirts", slug: "women-shirts", display_order: 3, is_active: true },
    { id: "s-w-4", department: "WOMEN", name: "Crop Tops", slug: "women-crop-tops", display_order: 4, is_active: true },
    { id: "s-w-5", department: "WOMEN", name: "Dresses", slug: "women-dresses", display_order: 5, is_active: true },
    { id: "s-w-6", department: "WOMEN", name: "Mini Dresses", slug: "women-mini-dresses", display_order: 6, is_active: true },
    { id: "s-w-7", department: "WOMEN", name: "Midi Dresses", slug: "women-midi-dresses", display_order: 7, is_active: true },
    { id: "s-w-8", department: "WOMEN", name: "Co-ord Sets", slug: "women-co-ord-sets", display_order: 8, is_active: true },
    { id: "s-w-9", department: "WOMEN", name: "Jeans", slug: "women-jeans", display_order: 9, is_active: true },
    { id: "s-w-10", department: "WOMEN", name: "Trousers", slug: "women-trousers", display_order: 10, is_active: true },
    { id: "s-w-11", department: "WOMEN", name: "Cargo Pants", slug: "women-cargo-pants", display_order: 11, is_active: true },
    { id: "s-w-12", department: "WOMEN", name: "Skirts", slug: "women-skirts", display_order: 12, is_active: true },
    { id: "s-w-13", department: "WOMEN", name: "Kurtis", slug: "women-kurtis", display_order: 13, is_active: true },
    { id: "s-w-14", department: "WOMEN", name: "Jackets", slug: "women-jackets", display_order: 14, is_active: true },
    // ACCESSORIES
    { id: "s-a-1", department: "ACCESSORIES", name: "Earrings", slug: "accessories-earrings", display_order: 1, is_active: true },
    { id: "s-a-2", department: "ACCESSORIES", name: "Necklaces", slug: "accessories-necklaces", display_order: 2, is_active: true },
    { id: "s-a-3", department: "ACCESSORIES", name: "Bracelets", slug: "accessories-bracelets", display_order: 3, is_active: true },
    { id: "s-a-4", department: "ACCESSORIES", name: "Sunglasses", slug: "accessories-sunglasses", display_order: 4, is_active: true },
    { id: "s-a-5", department: "ACCESSORIES", name: "Belts", slug: "accessories-belts", display_order: 5, is_active: true },
    { id: "s-a-6", department: "ACCESSORIES", name: "Wallets", slug: "accessories-wallets", display_order: 6, is_active: true },
    // BAGS
    { id: "s-b-1", department: "BAGS", name: "Shoulder Bags", slug: "bags-shoulder", display_order: 1, is_active: true },
    { id: "s-b-2", department: "BAGS", name: "Tote Bags", slug: "bags-tote", display_order: 2, is_active: true },
    { id: "s-b-3", department: "BAGS", name: "Sling Bags", slug: "bags-sling", display_order: 3, is_active: true },
    { id: "s-b-4", department: "BAGS", name: "Handbags", slug: "bags-handbags", display_order: 4, is_active: true },
    // FOOTWEAR
    { id: "s-f-1", department: "FOOTWEAR", name: "Sneakers", slug: "footwear-sneakers", display_order: 1, is_active: true },
    { id: "s-f-2", department: "FOOTWEAR", name: "Casual Shoes", slug: "footwear-casual", display_order: 2, is_active: true },
    { id: "s-f-3", department: "FOOTWEAR", name: "Sandals", slug: "footwear-sandals", display_order: 3, is_active: true },
    { id: "s-f-4", department: "FOOTWEAR", name: "Flats", slug: "footwear-flats", display_order: 4, is_active: true },
    // CAPS
    { id: "s-c-1", department: "CAPS", name: "Baseball Caps", slug: "caps-baseball", display_order: 1, is_active: true },
    { id: "s-c-2", department: "CAPS", name: "Bucket Hats", slug: "caps-bucket", display_order: 2, is_active: true },
    { id: "s-c-3", department: "CAPS", name: "Beanies", slug: "caps-beanies", display_order: 3, is_active: true },
    // JEWELLERY
    { id: "s-j-1", department: "JEWELLERY", name: "Silver Oxidised Sets", slug: "jewellery-silver-oxidised", display_order: 1, is_active: true },
    { id: "s-j-2", department: "JEWELLERY", name: "Chokers & Neckpieces", slug: "jewellery-chokers", display_order: 2, is_active: true },
    { id: "s-j-3", department: "JEWELLERY", name: "Traditional Jhumkas", slug: "jewellery-jhumkas", display_order: 3, is_active: true }
  ];

  // Auto slug generation on name input
  catName.addEventListener("input", () => {
    if (!editingCatId) {
      const deptPrefix = (catDepartment.value || "cat").toLowerCase();
      const cleanName = catName.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      catSlug.value = `${deptPrefix}-${cleanName}`;
    }
  });

  catDepartment.addEventListener("change", () => {
    if (!editingCatId) {
      const deptPrefix = (catDepartment.value || "cat").toLowerCase();
      const cleanName = catName.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      catSlug.value = cleanName ? `${deptPrefix}-${cleanName}` : "";
    }
  });

  // Load Categories
  async function loadCategories() {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Loading Sarojini categories...</td></tr>';

    let fetchedCats = null;

    // 1. Try dedicated table sarojini_categories
    try {
      const { data, error } = await client
        .from("sarojini_categories")
        .select("*")
        .order("department", { ascending: true })
        .order("display_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedCats = data;
      }
    } catch (_) {}

    // 2. Try store_settings fallback
    if (!fetchedCats) {
      try {
        const { data: row } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "sarojini_categories")
          .maybeSingle();

        if (row && Array.isArray(row.value) && row.value.length > 0) {
          fetchedCats = row.value;
        }
      } catch (_) {}
    }

    // 3. Fallback to default starter categories
    if (!fetchedCats || fetchedCats.length === 0) {
      fetchedCats = [...DEFAULT_SAROJINI_CATEGORIES];
      // Save starter categories into store_settings
      try {
        await client.from("store_settings").upsert({
          key: "sarojini_categories",
          value: fetchedCats,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" });
      } catch (_) {}
    }

    allCategories = fetchedCats;
    renderCategories();
  }

  // Render Table
  function renderCategories() {
    const query = (searchInput.value || "").trim().toLowerCase();
    
    let filtered = allCategories.filter(cat => {
      const matchesDept = (currentDept === "ALL") || (cat.department === currentDept);
      const matchesQuery = !query || 
        (cat.name && cat.name.toLowerCase().includes(query)) ||
        (cat.slug && cat.slug.toLowerCase().includes(query));
      return matchesDept && matchesQuery;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--admin-text-muted);">No categories found in ${currentDept === "ALL" ? "any department" : currentDept}. Click "+ Add Sarojini Category" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(cat => {
      const statusBadge = cat.is_active
        ? `<button type="button" class="btn-toggle-status badge badge-success" data-id="${cat.id}" style="cursor:pointer; border:none;">Active</button>`
        : `<button type="button" class="btn-toggle-status badge badge-danger" data-id="${cat.id}" style="cursor:pointer; border:none;">Disabled</button>`;

      const deptColor = getDeptBadgeClass(cat.department);

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                ${cat.image_url ? `<img src="${cat.image_url}" style="width:100%; height:100%; border-radius:8px; object-fit:cover;">` : '🏷️'}
              </div>
              <div>
                <strong>${escapeHtml(cat.name)}</strong>
                ${cat.description ? `<div style="font-size:0.75rem; color:var(--admin-text-muted);">${escapeHtml(cat.description)}</div>` : ''}
              </div>
            </div>
          </td>
          <td><span class="badge ${deptColor}">${cat.department}</span></td>
          <td><code style="font-size: 0.8rem; background: var(--admin-hover-bg); padding: 2px 6px; border-radius: 4px;">${escapeHtml(cat.slug)}</code></td>
          <td>${cat.display_order || 0}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn-admin-secondary btn-edit-cat" data-id="${cat.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button type="button" class="btn-admin-danger btn-delete-cat" data-id="${cat.id}" data-name="${escapeHtml(cat.name)}" style="padding: 4px 8px; font-size: 0.75rem;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Wire Edit buttons
    tbody.querySelectorAll(".btn-edit-cat").forEach(btn => {
      btn.addEventListener("click", () => openEditModal(btn.getAttribute("data-id")));
    });

    // Wire Delete buttons
    tbody.querySelectorAll(".btn-delete-cat").forEach(btn => {
      btn.addEventListener("click", () => {
        catToDelete = {
          id: btn.getAttribute("data-id"),
          name: btn.getAttribute("data-name")
        };
        document.getElementById("del-cat-name").textContent = catToDelete.name;
        deleteModal.style.display = "flex";
      });
    });

    // Wire Status Toggle buttons
    tbody.querySelectorAll(".btn-toggle-status").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = allCategories.find(c => String(c.id) === String(id));
        if (!item) return;

        item.is_active = !item.is_active;
        await syncCategoryUpdate(item);
        renderCategories();
        window.showToast(`Category "${item.name}" marked ${item.is_active ? 'Active' : 'Disabled'}.`, "success");
      });
    });
  }

  function getDeptBadgeClass(dept) {
    switch (dept) {
      case "WOMEN": return "badge-pink";
      case "MEN": return "badge-indigo";
      case "ACCESSORIES": return "badge-amber";
      case "FOOTWEAR": return "badge-cyan";
      case "BAGS": return "badge-purple";
      case "JEWELLERY": return "badge-emerald";
      default: return "badge-gray";
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Tab Filtering
  deptTabs.querySelectorAll(".dept-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      deptTabs.querySelectorAll(".dept-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDept = btn.getAttribute("data-dept");
      currentDeptTitle.textContent = currentDept === "ALL" ? "All Sarojini Categories" : `${currentDept} Categories`;
      renderCategories();
    });
  });

  searchInput.addEventListener("input", renderCategories);

  // Add / Edit Modal Controls
  document.getElementById("btn-add-category").addEventListener("click", () => {
    editingCatId = null;
    modalTitle.textContent = "Add Sarojini Category";
    categoryForm.reset();
    catDepartment.value = currentDept === "ALL" ? "WOMEN" : currentDept;
    catOrder.value = (allCategories.filter(c => c.department === catDepartment.value).length + 1);
    catIsActive.checked = true;
    modalBackdrop.style.display = "flex";
  });

  document.getElementById("btn-close-cat-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-cat").addEventListener("click", closeModal);

  function closeModal() {
    modalBackdrop.style.display = "none";
    editingCatId = null;
    categoryForm.reset();
  }

  function openEditModal(id) {
    const cat = allCategories.find(c => String(c.id) === String(id));
    if (!cat) return;

    editingCatId = id;
    modalTitle.textContent = `Edit Category: ${cat.name}`;
    catDepartment.value = cat.department || "WOMEN";
    catName.value = cat.name || "";
    catSlug.value = cat.slug || "";
    catOrder.value = cat.display_order || 1;
    catImage.value = cat.image_url || "";
    catDesc.value = cat.description || "";
    catIsActive.checked = Boolean(cat.is_active);
    modalBackdrop.style.display = "flex";
  }

  // Save Category Form Submit
  categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-cat");
    btn.disabled = true;
    btn.textContent = "Saving...";

    const payload = {
      department: catDepartment.value,
      name: catName.value.trim(),
      slug: catSlug.value.trim(),
      display_order: parseInt(catOrder.value, 10) || 1,
      image_url: catImage.value.trim() || null,
      description: catDesc.value.trim() || null,
      is_active: catIsActive.checked,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingCatId) {
        // Update
        const idx = allCategories.findIndex(c => String(c.id) === String(editingCatId));
        if (idx !== -1) {
          allCategories[idx] = { ...allCategories[idx], ...payload };
          await syncCategoryUpdate(allCategories[idx]);
        }
        window.showToast("Category updated successfully!", "success");
      } else {
        // Insert
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "s-cat-" + Date.now();
        const newCat = { id: newId, ...payload, created_at: new Date().toISOString() };
        
        // 1. Try insert to database table
        try {
          await client.from("sarojini_categories").insert([newCat]);
        } catch (_) {}

        allCategories.push(newCat);
        // 2. Sync to store_settings
        await syncAllCategories();
        window.showToast("New Sarojini category added!", "success");
      }

      closeModal();
      renderCategories();
    } catch (err) {
      console.error("Save category error:", err);
      window.showToast("Failed to save category: " + err.message, "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Category";
    }
  });

  // Delete Category
  document.getElementById("btn-close-del-modal").addEventListener("click", closeDelModal);
  document.getElementById("btn-cancel-del").addEventListener("click", closeDelModal);

  function closeDelModal() {
    deleteModal.style.display = "none";
    catToDelete = null;
  }

  document.getElementById("btn-confirm-del").addEventListener("click", async () => {
    if (!catToDelete) return;
    const delBtn = document.getElementById("btn-confirm-del");
    delBtn.disabled = true;
    delBtn.textContent = "Deleting...";

    try {
      // 1. Try table delete
      try {
        await client.from("sarojini_categories").delete().eq("id", catToDelete.id);
      } catch (_) {}

      // 2. Update local state & sync
      allCategories = allCategories.filter(c => String(c.id) !== String(catToDelete.id));
      await syncAllCategories();

      window.showToast(`Deleted category "${catToDelete.name}".`, "info");
      closeDelModal();
      renderCategories();
    } catch (err) {
      console.error("Delete error:", err);
      window.showToast("Error deleting category: " + err.message, "danger");
    } finally {
      delBtn.disabled = false;
      delBtn.textContent = "Delete";
    }
  });

  // Sync helpers
  async function syncCategoryUpdate(cat) {
    try {
      await client.from("sarojini_categories").upsert(cat, { onConflict: "id" });
    } catch (_) {}
    await syncAllCategories();
  }

  async function syncAllCategories() {
    try {
      await client.from("store_settings").upsert({
        key: "sarojini_categories",
        value: allCategories,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
    } catch (_) {}
  }

  // Load initial
  await loadCategories();
});

