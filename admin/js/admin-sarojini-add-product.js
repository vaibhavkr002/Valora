/**
 * VADI Admin Panel - Add / Edit Sarojini Product Controller
 * Handles cascading category selection, image gallery, variants, live discount calculator, and Supabase sync
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const form = document.getElementById("sarojini-product-form");
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  // Elements
  const formHeading = document.getElementById("form-heading");
  const breadcrumbPageTitle = document.getElementById("breadcrumb-page-title");
  const btnSaveLabel = document.getElementById("btn-save-label");

  const prodName = document.getElementById("prod-name");
  const prodBrand = document.getElementById("prod-brand");
  const prodSlug = document.getElementById("prod-slug");
  const prodDescription = document.getElementById("prod-description");

  const prodPrice = document.getElementById("prod-price");
  const prodOrigPrice = document.getElementById("prod-orig-price");
  const prodStock = document.getElementById("prod-stock");
  const discountCalcRow = document.getElementById("discount-calc-row");

  const prodDepartment = document.getElementById("prod-department");
  const prodCategory = document.getElementById("prod-category");

  const prodIsActive = document.getElementById("prod-is-active");
  const prodIsFeatured = document.getElementById("prod-is-featured");
  const prodIsDeal = document.getElementById("prod-is-deal");
  const prodIsNew = document.getElementById("prod-is-new");

  const prodAdvanceEnabled = document.getElementById("prod-advance-enabled");
  const advanceOptions = document.getElementById("advance-options");
  const prodAdvanceType = document.getElementById("prod-advance-type");
  const prodAdvanceValue = document.getElementById("prod-advance-value");

  const specMaterial = document.getElementById("spec-material");
  const specFit = document.getElementById("spec-fit");
  const specReturns = document.getElementById("spec-returns");

  // Gallery state
  let images = [];
  const imagePreviewsContainer = document.getElementById("image-previews-container");
  const noImgsHint = document.getElementById("no-imgs-hint");
  const inputNewImgUrl = document.getElementById("input-new-img-url");
  const btnAddImgUrl = document.getElementById("btn-add-img-url");

  // Variant states
  let selectedSizes = [];
  let selectedColors = [];
  const selectedSizesList = document.getElementById("selected-sizes-list");
  const selectedColorsList = document.getElementById("selected-colors-list");
  const inputCustomSize = document.getElementById("input-custom-size");
  const btnAddCustomSize = document.getElementById("btn-add-custom-size");
  const inputCustomColor = document.getElementById("input-custom-color");
  const btnAddCustomColor = document.getElementById("btn-add-custom-color");

  let allCategories = [];

  // 1. Auto-slug generation
  prodName.addEventListener("input", () => {
    if (!editId) {
      const clean = prodName.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      prodSlug.value = clean;
    }
  });

  // 2. Live Discount Calculator
  function updateDiscountDisplay() {
    const p = parseFloat(prodPrice.value) || 0;
    const orig = parseFloat(prodOrigPrice.value) || 0;
    if (orig > p && p > 0) {
      const pct = Math.round(((orig - p) / orig) * 100);
      const saveAmount = orig - p;
      discountCalcRow.innerHTML = `✨ Customer Saves: ₹${saveAmount.toLocaleString('en-IN')} (${pct}% OFF Bazaar Rate)`;
    } else {
      discountCalcRow.innerHTML = "";
    }
  }
  prodPrice.addEventListener("input", updateDiscountDisplay);
  prodOrigPrice.addEventListener("input", updateDiscountDisplay);

  // 3. Advance Payment Toggle
  prodAdvanceEnabled.addEventListener("change", () => {
    advanceOptions.style.display = prodAdvanceEnabled.checked ? "flex" : "none";
  });

  // 4. Gallery Logic
  function renderImagePreviews() {
    if (images.length === 0) {
      if (noImgsHint) noImgsHint.style.display = "block";
      imagePreviewsContainer.querySelectorAll(".image-preview-item").forEach(el => el.remove());
      return;
    }
    if (noImgsHint) noImgsHint.style.display = "none";

    imagePreviewsContainer.querySelectorAll(".image-preview-item").forEach(el => el.remove());

    images.forEach((imgUrl, idx) => {
      const item = document.createElement("div");
      item.className = `image-preview-item ${idx === 0 ? 'primary' : ''}`;
      item.title = idx === 0 ? "Primary Thumbnail" : "Additional Image";
      const previewSrc = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
        ? window.VeloraImageUtils.normalizeImageUrl(imgUrl, { isAdmin: true })
        : (imgUrl.startsWith('assets/') ? ('../' + imgUrl) : imgUrl);
      const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : '../assets/sarojni/prod-1-graphic-tee.png';

      item.innerHTML = `
        <img src="${previewSrc}" onerror="this.onerror=null; this.src='${fallbackSvg}';">
        ${idx === 0 ? '<span style="position:absolute; bottom:2px; left:2px; background:#e11d48; color:#fff; font-size:0.6rem; font-weight:800; padding:1px 4px; border-radius:3px;">PRIMARY</span>' : ''}
        <button type="button" class="btn-remove-img" data-idx="${idx}" aria-label="Remove image">&times;</button>
      `;

      item.querySelector(".btn-remove-img").addEventListener("click", (e) => {
        e.stopPropagation();
        images.splice(idx, 1);
        renderImagePreviews();
      });

      imagePreviewsContainer.appendChild(item);
    });
  }

  btnAddImgUrl.addEventListener("click", () => {
    const val = inputNewImgUrl.value.trim();
    if (val && !images.includes(val)) {
      images.push(val);
      inputNewImgUrl.value = "";
      renderImagePreviews();
    }
  });

  inputNewImgUrl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnAddImgUrl.click();
    }
  });

  document.querySelectorAll(".btn-preset-img").forEach(btn => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-src");
      if (src && !images.includes(src)) {
        images.push(src);
        renderImagePreviews();
      }
    });
  });

  // 5. Variants Logic
  function renderSizes() {
    selectedSizesList.innerHTML = selectedSizes.map((s, idx) => `
      <span class="tag-pill">
        <span>${s}</span>
        <span class="tag-close" data-size-idx="${idx}">&times;</span>
      </span>
    `).join("");

    selectedSizesList.querySelectorAll(".tag-close").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-size-idx"), 10);
        selectedSizes.splice(idx, 1);
        renderSizes();
      });
    });
  }

  document.querySelectorAll(".btn-size-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const size = btn.getAttribute("data-size");
      if (size && !selectedSizes.includes(size)) {
        selectedSizes.push(size);
        renderSizes();
      }
    });
  });

  function addCustomSize() {
    const val = inputCustomSize.value.trim();
    if (val && !selectedSizes.includes(val)) {
      selectedSizes.push(val);
      inputCustomSize.value = "";
      renderSizes();
    }
  }
  btnAddCustomSize.addEventListener("click", addCustomSize);
  inputCustomSize.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomSize();
    }
  });

  function renderColors() {
    selectedColorsList.innerHTML = selectedColors.map((c, idx) => `
      <span class="tag-pill">
        <span>${c}</span>
        <span class="tag-close" data-color-idx="${idx}">&times;</span>
      </span>
    `).join("");

    selectedColorsList.querySelectorAll(".tag-close").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-color-idx"), 10);
        selectedColors.splice(idx, 1);
        renderColors();
      });
    });
  }

  function addCustomColor() {
    const val = inputCustomColor.value.trim();
    if (val && !selectedColors.includes(val)) {
      selectedColors.push(val);
      inputCustomColor.value = "";
      renderColors();
    }
  }
  btnAddCustomColor.addEventListener("click", addCustomColor);
  inputCustomColor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomColor();
    }
  });

  // 6. Categories Cascade
  async function loadCategories() {
    try {
      const { data, error } = await client.from("sarojini_categories").select("id, name, department, slug").eq("is_active", true).order("display_order", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        allCategories = data;
      } else {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_categories").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) allCategories = sRow.value;
      }
    } catch (_) {}
    updateCategorySelect();
  }

  function updateCategorySelect(preferredVal) {
    const dept = (prodDepartment.value || "").toUpperCase();
    const filtered = allCategories.filter(c => (c.department || "").toUpperCase() === dept);
    
    prodCategory.innerHTML = '<option value="">Select Category...</option>' + 
      filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    if (preferredVal) {
      const match = filtered.find(c => c.id === preferredVal || c.slug === preferredVal || c.name === preferredVal);
      if (match) {
        prodCategory.value = match.id;
      } else {
        prodCategory.value = preferredVal;
      }
    }
  }

  prodDepartment.addEventListener("change", () => {
    updateCategorySelect();
  });

  // Local File Upload Reader
  const inputFileImg = document.getElementById("input-file-img");
  const btnUploadLocalImg = document.getElementById("btn-upload-local-img");

  if (btnUploadLocalImg && inputFileImg) {
    btnUploadLocalImg.addEventListener("click", () => {
      inputFileImg.click();
    });

    inputFileImg.addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      files.forEach(file => {
        if (!file.type.startsWith("image/")) {
          window.showToast?.("Only image files are supported.", "danger");
          return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const dataUrl = loadEvent.target.result;
          if (dataUrl && !images.includes(dataUrl)) {
            images.push(dataUrl);
            renderImagePreviews();
          }
        };
        reader.readAsDataURL(file);
      });

      inputFileImg.value = "";
    });
  }

  // ==========================================================================
  // ADVANCE PAYMENT CONFIGURATION & DYNAMIC LIVE PREVIEW (Main VADI Parity)
  // ==========================================================================
  const advLabelValue = document.getElementById("label-advance-value");
  const advPreviewText = document.getElementById("advance-preview-text");
  const advPreviewSubtext = document.getElementById("advance-preview-subtext");
  const advErrorMsg = document.getElementById("advance-error-msg");
  const prodAllowOnline = document.getElementById("prod-allow-online");
  const prodAllowCod = document.getElementById("prod-allow-cod");

  function updateAdvancePreview() {
    if (!prodAdvanceEnabled) return;
    const isEnabled = prodAdvanceEnabled.checked;
    if (advanceOptions) advanceOptions.style.display = isEnabled ? "flex" : "none";

    if (!isEnabled) {
      if (advErrorMsg) advErrorMsg.style.display = "none";
      return;
    }

    const price = parseFloat(prodPrice.value) || 0;
    const type = prodAdvanceType ? prodAdvanceType.value : "fixed";
    const rawVal = parseFloat(prodAdvanceValue ? prodAdvanceValue.value : 0);

    // Update label & placeholder
    if (advLabelValue && prodAdvanceValue) {
      if (type === "percentage") {
        advLabelValue.textContent = "Advance Percentage (%) *";
        prodAdvanceValue.placeholder = "e.g. 20";
        prodAdvanceValue.max = "100";
      } else {
        advLabelValue.textContent = "Advance Amount (₹) *";
        prodAdvanceValue.placeholder = "e.g. 250";
        prodAdvanceValue.max = price > 0 ? String(price) : "";
      }
    }

    if (isNaN(rawVal) || rawVal <= 0) {
      if (advPreviewText) advPreviewText.textContent = `Please enter an advance ${type === "percentage" ? "percentage (> 0%)" : "amount (> ₹0)"}`;
      if (advPreviewSubtext) advPreviewSubtext.textContent = `Selling price: ₹${price.toLocaleString('en-IN')}`;
      if (advErrorMsg) advErrorMsg.style.display = "none";
      return;
    }

    let hasError = false;
    let errorText = "";

    if (rawVal < 0) {
      hasError = true;
      errorText = "Advance value cannot be negative.";
    }

    let advanceAmount = 0;
    if (type === "percentage") {
      if (rawVal > 100) {
        hasError = true;
        errorText = "Advance percentage cannot be greater than 100%.";
      }
      advanceAmount = Math.round(price * (rawVal / 100));
    } else {
      if (price > 0 && rawVal > price) {
        hasError = true;
        errorText = `Advance amount (₹${rawVal.toLocaleString('en-IN')}) cannot exceed product selling price (₹${price.toLocaleString('en-IN')}).`;
      }
      advanceAmount = Math.min(price, rawVal);
    }

    const remainingCod = Math.max(0, price - advanceAmount);

    if (hasError) {
      if (advErrorMsg) {
        advErrorMsg.textContent = errorText;
        advErrorMsg.style.display = "block";
      }
      if (advPreviewText) advPreviewText.textContent = "Invalid configuration";
      if (advPreviewSubtext) advPreviewSubtext.textContent = errorText;
    } else {
      if (advErrorMsg) advErrorMsg.style.display = "none";
      if (advPreviewText) {
        advPreviewText.textContent = `Customer pays ₹${advanceAmount.toLocaleString('en-IN')} now + ₹${remainingCod.toLocaleString('en-IN')} COD`;
      }
      if (advPreviewSubtext) {
        advPreviewSubtext.textContent = type === "percentage" 
          ? `${rawVal}% of ₹${price.toLocaleString('en-IN')} selling price`
          : `Fixed deposit on ₹${price.toLocaleString('en-IN')} selling price`;
      }
    }
  }

  prodAdvanceEnabled?.addEventListener("change", updateAdvancePreview);
  prodAdvanceType?.addEventListener("change", updateAdvancePreview);
  prodAdvanceValue?.addEventListener("input", updateAdvancePreview);
  prodPrice?.addEventListener("input", () => {
    updateDiscountDisplay();
    updateAdvancePreview();
  });

  // 7. Pre-fill for Edit Mode
  async function checkEditMode() {
    if (!editId) return;

    formHeading.textContent = "Edit Sarojini Product";
    breadcrumbPageTitle.textContent = "Edit Product";
    btnSaveLabel.textContent = "Update Sarojini Product";

    let item = null;

    try {
      const { data } = await client.from("sarojini_products").select("*").eq("id", editId).maybeSingle();
      if (data) item = data;
    } catch (_) {}

    if (!item) {
      try {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          item = sRow.value.find(p => String(p.id) === String(editId));
        }
      } catch (_) {}
    }

    if (!item) {
      window.showToast("Product not found!", "danger");
      return;
    }

    // Fill form
    prodName.value = item.name || "";
    prodBrand.value = item.brand || "Sarojini Bazaar";
    prodSlug.value = item.slug || "";
    prodDescription.value = item.description || "";
    prodPrice.value = item.price || "";
    prodOrigPrice.value = item.original_price || "";
    prodStock.value = item.stock ?? 25;
    prodDepartment.value = item.department || "WOMEN";
    updateCategorySelect(item.category_id || item.category_slug);

    prodIsActive.checked = Boolean(item.is_active);
    prodIsFeatured.checked = Boolean(item.is_featured);
    prodIsDeal.checked = Boolean(item.is_deal);
    prodIsNew.checked = Boolean(item.is_new);

    if (prodAllowOnline) prodAllowOnline.checked = item.allow_full_online !== false;
    if (prodAllowCod) prodAllowCod.checked = item.allow_cod !== false;

    if (item.advance_payment_enabled) {
      prodAdvanceEnabled.checked = true;
      if (advanceOptions) advanceOptions.style.display = "flex";
      prodAdvanceType.value = item.advance_payment_type || "fixed";
      prodAdvanceValue.value = item.advance_payment_value || "";
      updateAdvancePreview();
    }

    if (item.specifications) {
      specMaterial.value = item.specifications.material || "";
      specFit.value = item.specifications.fit || "";
    }
    if (item.return_policy) {
      specReturns.value = item.return_policy;
    }

    if (Array.isArray(item.images)) {
      images = [...item.images];
      renderImagePreviews();
    } else if (item.image) {
      images = [item.image];
      renderImagePreviews();
    }

    if (Array.isArray(item.sizes)) {
      selectedSizes = [...item.sizes];
      renderSizes();
    }

    if (Array.isArray(item.colors)) {
      selectedColors = [...item.colors];
      renderColors();
    }

    updateDiscountDisplay();
    updateAdvancePreview();
  }

  // 8. Form Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-product");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving to Database...';

    const pPrice = parseFloat(prodPrice.value) || 0;
    const pOrig = parseFloat(prodOrigPrice.value) || pPrice;
    const discountPct = (pOrig > pPrice && pPrice > 0) ? Math.round(((pOrig - pPrice) / pOrig) * 100) : 0;

    const isUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const categoryId = isUUID(prodCategory.value) ? prodCategory.value : null;
    const cleanSlug = (prodSlug.value.trim() || prodName.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-+|-+$/g, "");

    const payload = {
      name: prodName.value.trim(),
      brand: prodBrand.value.trim() || "Sarojini Bazaar",
      slug: cleanSlug,
      description: prodDescription.value.trim() || null,
      price: pPrice,
      original_price: pOrig,
      discount_percentage: discountPct,
      stock: parseInt(prodStock.value, 10) || 0,
      department: (prodDepartment.value || "WOMEN").toUpperCase(),
      category_id: categoryId,
      images: images.length > 0 ? images : ['assets/sarojni/prod-1-graphic-tee.png'],
      sizes: selectedSizes.length > 0 ? selectedSizes : ['Free Size'],
      colors: selectedColors,
      specifications: {
        material: specMaterial.value.trim() || null,
        fit: specFit.value.trim() || null
      },
      return_policy: specReturns.value.trim() || '7-Day Easy Returns',
      is_active: prodIsActive.checked,
      is_featured: prodIsFeatured.checked,
      is_deal: prodIsDeal.checked,
      is_new: prodIsNew.checked,
      advance_payment_enabled: prodAdvanceEnabled.checked,
      advance_payment_type: prodAdvanceEnabled.checked ? prodAdvanceType.value : "fixed",
      advance_payment_value: prodAdvanceEnabled.checked ? (parseFloat(prodAdvanceValue.value) || 0) : 0,
      updated_at: new Date().toISOString()
    };

    try {
      if (editId) {
        // Update existing product
        const { data, error } = await client
          .from("sarojini_products")
          .update(payload)
          .eq("id", editId)
          .select()
          .single();

        if (error) throw error;

        // Sync core fields to linked Main VADI product if available
        if (window.CrossStoreService) {
          try {
            await window.CrossStoreService.syncProductEdits(client, editId, "sarojini", payload);
          } catch (syncErr) {
            console.warn("[CrossStore] Edit sync warning:", syncErr);
          }
        }

        await syncToStoreSettings({ id: editId, ...payload }, true);
        await syncProductFeaturedToSection(client, editId, Boolean(payload.is_active && payload.is_featured));
        try {
          localStorage.setItem("sarojini_global_cache_invalidated", Date.now().toString());
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
        } catch (_) {}

        window.showToast("Product updated successfully in Sarojini Bazaar!", "success");
      } else {
        // Insert new product
        const { data, error } = await client
          .from("sarojini_products")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          await syncToStoreSettings(data, false);
          await syncProductFeaturedToSection(client, data.id, Boolean(payload.is_active && payload.is_featured));
        }
        try {
          localStorage.setItem("sarojini_global_cache_invalidated", Date.now().toString());
          localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
        } catch (_) {}

        window.showToast("Sarojini product published successfully to catalog!", "success");
      }

      setTimeout(() => {
        window.location.href = "sarojini-products.html";
      }, 900);

    } catch (err) {
      console.error("Save Sarojini product error:", err);
      const errMsg = err.message || err.details || (typeof err === "string" ? err : JSON.stringify(err));
      window.showToast("Failed to save product: " + errMsg, "danger");
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    }
  });

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

  async function syncToStoreSettings(productItem, isEdit) {
    try {
      const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
      let list = (sRow && Array.isArray(sRow.value)) ? sRow.value : [];
      if (isEdit) {
        const idx = list.findIndex(p => String(p.id) === String(productItem.id));
        if (idx !== -1) {
          list[idx] = productItem;
        } else {
          list.unshift(productItem);
        }
      } else {
        list.unshift(productItem);
      }

      await client.from("store_settings").upsert({
        key: "sarojini_products",
        value: list,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
    } catch (_) {}
  }

  await loadCategories();
  await checkEditMode();
});

