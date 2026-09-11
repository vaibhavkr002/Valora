/**
 * VELORA Admin Panel - Categories Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("categories-tbody");
  const modal = document.getElementById("category-modal-backdrop");
  const btnOpenModal = document.getElementById("btn-add-category");
  const btnCloseModal = document.getElementById("btn-close-cat-modal");
  const form = document.getElementById("category-form");

  let editingCatId = null;

  async function loadCategories() {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">Loading categories...</td></tr>';
    const { data: cats, error } = await client
      .from("categories")
      .select("*, products(count)")
      .order("created_at", { ascending: true });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--admin-danger); text-align:center;">Error: ${error.message}</td></tr>`;
      return;
    }

    if (!cats || cats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">No categories found.</td></tr>';
      return;
    }

    tbody.innerHTML = cats.map(c => {
      const productCount = (c.products && c.products[0]) ? c.products[0].count : 0;
      const badge = c.is_active 
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Disabled</span>';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap: 10px;">
              <img src="${c.image_url || 'https://via.placeholder.com/40'}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">
              <strong>${c.name}</strong>
            </div>
          </td>
          <td><code>${c.slug}</code></td>
          <td><span style="font-size: 0.85rem; color: var(--admin-text-muted);">${c.description || '-'}</span></td>
          <td><span class="badge badge-info">${productCount} items</span></td>
          <td>${badge}</td>
          <td>
            <div style="display:flex; gap: 6px;">
              <button class="btn-admin-secondary btn-edit-cat" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
              <button class="btn-admin-danger btn-delete-cat" data-id="${c.id}" data-name="${c.name}" data-count="${productCount}" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Attach edit listeners
    document.querySelectorAll(".btn-edit-cat").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const cat = cats.find(x => x.id === id);
        if (cat) {
          editingCatId = cat.id;
          document.getElementById("modal-cat-title").textContent = "Edit Category";
          document.getElementById("cat-name").value = cat.name;
          document.getElementById("cat-slug").value = cat.slug;
          document.getElementById("cat-desc").value = cat.description || "";
          document.getElementById("cat-image").value = cat.image_url || "";
          document.getElementById("cat-active").checked = cat.is_active;
          modal.classList.add("show");
        }
      });
    });

    // Attach delete listeners
    document.querySelectorAll(".btn-delete-cat").forEach(b => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        const name = b.dataset.name;
        const count = parseInt(b.dataset.count, 10);
        if (count > 0) {
          alert(`Cannot delete "${name}" because ${count} products are currently linked to it. Please reassign or delete those products first.`);
          return;
        }

        if (confirm(`Delete category "${name}"?`)) {
          const { error } = await client.from("categories").delete().eq("id", id);
          if (error) alert("Error deleting category: " + error.message);
          else {
            window.showToast("Category deleted.", "success");
            loadCategories();
          }
        }
      });
    });
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener("click", () => {
      editingCatId = null;
      document.getElementById("modal-cat-title").textContent = "Add New Category";
      form.reset();
      document.getElementById("cat-active").checked = true;
      modal.classList.add("show");
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => modal.classList.remove("show"));
  }

  // Auto generate slug
  document.getElementById("cat-name").addEventListener("input", (e) => {
    if (!editingCatId) {
      document.getElementById("cat-slug").value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("cat-name").value.trim();
      const slug = document.getElementById("cat-slug").value.trim();
      const desc = document.getElementById("cat-desc").value.trim();
      const img = document.getElementById("cat-image").value.trim();
      const isActive = document.getElementById("cat-active").checked;

      const payload = {
        name,
        slug,
        description: desc,
        image_url: img,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      if (editingCatId) {
        const { error } = await client.from("categories").update(payload).eq("id", editingCatId);
        if (error) alert("Error updating: " + error.message);
        else {
          window.showToast("Category updated!", "success");
          modal.classList.remove("show");
          loadCategories();
        }
      } else {
        const { error } = await client.from("categories").insert([payload]);
        if (error) alert("Error creating category: " + error.message);
        else {
          window.showToast("Category added successfully!", "success");
          modal.classList.remove("show");
          loadCategories();
        }
      }
    });
  }

  await loadCategories();
});
