/**
 * VELORA Admin Panel - Add Product & URL Import Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const form = document.getElementById("add-product-form");
  const catSelect = document.getElementById("product-category");
  const imageInputsContainer = document.getElementById("image-inputs-container");
  const btnAddImage = document.getElementById("btn-add-image-url");
  const imagesPreviewContainer = document.getElementById("images-preview-grid");

  // Load categories
  const { data: cats } = await client.from("categories").select("id, name").eq("is_active", true);
  if (cats && catSelect) {
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  }

  // Multiple Image URLs Management
  function refreshImagePreviews() {
    if (!imagesPreviewContainer) return;
    const inputs = document.querySelectorAll(".image-url-input");
    const urls = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

    if (urls.length === 0) {
      imagesPreviewContainer.innerHTML = '<span style="font-size: 0.82rem; color: var(--admin-text-muted); grid-column: 1 / -1;">No image URLs added yet.</span>';
      return;
    }

    imagesPreviewContainer.innerHTML = urls.map((url, idx) => `
      <div style="position: relative; border: 1px solid var(--admin-card-border); border-radius: 8px; overflow: hidden; height: 80px; background: #000;">
        <img src="${url}" alt="Preview ${idx+1}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/80?text=Invalid';">
        <span style="position: absolute; bottom: 2px; left: 4px; font-size: 0.65rem; background: rgba(0,0,0,0.7); color: #fff; padding: 1px 4px; border-radius: 3px;">#${idx+1}</span>
      </div>
    `).join("");
  }

  if (btnAddImage) {
    btnAddImage.addEventListener("click", () => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; gap: 8px; margin-top: 8px;";
      row.innerHTML = `
        <input type="url" class="admin-input image-url-input" placeholder="https://images.unsplash.com/..." style="flex:1;">
        <button type="button" class="btn-admin-danger btn-remove-image" style="padding: 6px 12px;">✕</button>
      `;
      imageInputsContainer.appendChild(row);

      row.querySelector(".image-url-input").addEventListener("input", refreshImagePreviews);
      row.querySelector(".btn-remove-image").addEventListener("click", () => {
        row.remove();
        refreshImagePreviews();
      });
    });
  }

  document.querySelectorAll(".image-url-input").forEach(inp => {
    inp.addEventListener("input", refreshImagePreviews);
  });

  // ==========================================================================
  // ADVANCE PAYMENT CONFIGURATION & DYNAMIC LIVE PREVIEW
  // ==========================================================================
  const advEnabledCheckbox = document.getElementById("advance-payment-enabled");
  const advConfigFields = document.getElementById("advance-config-fields");
  const advTypeSelect = document.getElementById("advance-payment-type");
  const advValueInput = document.getElementById("advance-payment-value");
  const advLabelValue = document.getElementById("label-advance-value");
  const advPreviewText = document.getElementById("advance-preview-text");
  const advPreviewSubtext = document.getElementById("advance-preview-subtext");
  const advErrorMsg = document.getElementById("advance-error-msg");
  const productPriceInput = document.getElementById("product-price");

  function updateAdvancePreview() {
    if (!advEnabledCheckbox) return;
    const isEnabled = advEnabledCheckbox.checked;
    if (advConfigFields) advConfigFields.style.display = isEnabled ? "block" : "none";

    if (!isEnabled) {
      if (advErrorMsg) advErrorMsg.style.display = "none";
      return;
    }

    const price = parseFloat(productPriceInput.value) || 0;
    const type = advTypeSelect ? advTypeSelect.value : "fixed";
    const rawVal = parseFloat(advValueInput ? advValueInput.value : 0);

    // Update label & placeholder
    if (advLabelValue && advValueInput) {
      if (type === "percentage") {
        advLabelValue.textContent = "Advance Percentage (%) *";
        advValueInput.placeholder = "e.g. 20";
        advValueInput.max = "100";
      } else {
        advLabelValue.textContent = "Advance Amount (₹) *";
        advValueInput.placeholder = "e.g. 1000";
        advValueInput.max = price > 0 ? String(price) : "";
      }
    }

    let hasError = false;
    let errorText = "";

    if (isNaN(rawVal) || rawVal <= 0) {
      if (advPreviewText) advPreviewText.textContent = `Please enter an advance ${type === "percentage" ? "percentage (> 0%)" : "amount (> ₹0)"}`;
      if (advPreviewSubtext) advPreviewSubtext.textContent = `Selling price: ${window.formatINR(price)}`;
      if (advErrorMsg) advErrorMsg.style.display = "none";
      return;
    }

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
        errorText = `Advance amount (${window.formatINR(rawVal)}) cannot exceed product selling price (${window.formatINR(price)}).`;
      }
      advanceAmount = Math.min(price, rawVal);
    }

    const codBalance = Math.max(0, price - advanceAmount);

    if (hasError) {
      if (advErrorMsg) {
        advErrorMsg.textContent = errorText;
        advErrorMsg.style.display = "block";
      }
      if (advPreviewText) advPreviewText.innerHTML = `<span style="color:var(--admin-danger);">${errorText}</span>`;
    } else {
      if (advErrorMsg) advErrorMsg.style.display = "none";
      if (advPreviewText) advPreviewText.innerHTML = `Customer pays <strong>${window.formatINR(advanceAmount)}</strong> now + <strong>${window.formatINR(codBalance)}</strong> COD`;
      if (advPreviewSubtext) advPreviewSubtext.textContent = type === "percentage" 
        ? `${rawVal}% advance on ${window.formatINR(price)} selling price`
        : `Fixed advance deposit on ${window.formatINR(price)} selling price`;
    }
  }

  if (advEnabledCheckbox) advEnabledCheckbox.addEventListener("change", updateAdvancePreview);
  if (advTypeSelect) advTypeSelect.addEventListener("change", updateAdvancePreview);
  if (advValueInput) advValueInput.addEventListener("input", updateAdvancePreview);
  if (productPriceInput) productPriceInput.addEventListener("input", updateAdvancePreview);


  // ==========================================================================
  // PROFESSIONAL IMPORT PRODUCT BY URL MODAL & PARSER
  // ==========================================================================
  const btnOpenImport = document.getElementById("btn-open-import-modal");
  const importModal = document.getElementById("import-modal-backdrop");
  const btnCloseImport = document.getElementById("btn-close-import");
  const btnFetchUrl = document.getElementById("btn-fetch-product-url");
  const inputImportUrl = document.getElementById("input-import-url");
  const importResultPreview = document.getElementById("import-result-preview");
  const btnApplyImport = document.getElementById("btn-apply-import");

  let parsedImportData = null;

  if (btnOpenImport && importModal) {
    btnOpenImport.addEventListener("click", () => {
      importModal.classList.add("show");
    });
  }

  if (btnCloseImport && importModal) {
    btnCloseImport.addEventListener("click", () => {
      importModal.classList.remove("show");
    });
  }

  if (btnFetchUrl) {
  btnFetchUrl.addEventListener("click", async () => {
    const url = (inputImportUrl.value || "").trim();
    if (!url) {
      alert("Please paste a valid product link or feed URL.");
      return;
    }

    btnFetchUrl.disabled = true;
    btnFetchUrl.textContent = "Fetching product...";
    importResultPreview.style.display = "block";
    importResultPreview.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--admin-text-muted);">Contacting server to import product...</div>';

    try {
      const { data, error } = await client.functions.invoke('import_product', {
        body: JSON.stringify({ url })
      });
      if (error) throw error;
      parsedImportData = data;

      // Show preview of imported data
      importResultPreview.innerHTML = `
        <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--admin-card-border); border-radius: 8px; padding: 16px;">
          <div style="display:flex; gap: 14px; align-items: flex-start;">
            <img src="${parsedImportData.images?.[0] ?? ''}" style="width: 64px; height: 64px; border-radius: 6px; object-fit: cover;">
            <div style="flex:1;">
              <strong style="color:#fff; font-size: 0.95rem;">${parsedImportData.name}</strong>
              <div style="color: var(--admin-accent); font-weight: 700; margin-top: 4px;">${window.formatINR(parsedImportData.price)}</div>
              <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 2px;">
                Extracted ${parsedImportData.images?.length ?? 0} images • ${parsedImportData.sizes?.length ?? 0} sizes • Stock: ${parsedImportData.stock}
              </div>
            </div>
          </div>
        </div>
      `;

      if (btnApplyImport) btnApplyImport.style.display = "inline-flex";
    } catch (err) {
      console.error(err);
      importResultPreview.innerHTML = '<div style="color: var(--admin-danger); padding: 14px;">Failed to import product. Please enter details manually.</div>';
    } finally {
      btnFetchUrl.disabled = false;
      btnFetchUrl.textContent = "Fetch Product";
    }
  });
}

  // Apply imported data into the active Add Product form
  if (btnApplyImport) {
    btnApplyImport.addEventListener("click", () => {
      if (!parsedImportData) return;

      document.getElementById("product-name").value = parsedImportData.name;
      document.getElementById("product-brand").value = parsedImportData.brand;
      document.getElementById("product-price").value = parsedImportData.price;
      document.getElementById("product-original-price").value = parsedImportData.original_price;
      document.getElementById("product-stock").value = parsedImportData.stock;
      document.getElementById("product-description").value = parsedImportData.description;
      document.getElementById("product-source-url").value = parsedImportData.source_url;
      document.getElementById("product-source-name").value = parsedImportData.source_name;
      document.getElementById("product-sizes").value = parsedImportData.sizes.join(", ");
      document.getElementById("product-colors").value = parsedImportData.colors.join(", ");

      if (catSelect && parsedImportData.category_id) {
        catSelect.value = parsedImportData.category_id;
      }

      // Populate image URLs
      imageInputsContainer.innerHTML = "";
      parsedImportData.images.forEach((imgUrl, i) => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 8px; margin-top: 8px;";
        row.innerHTML = `
          <input type="url" class="admin-input image-url-input" value="${imgUrl}" style="flex:1;">
          <button type="button" class="btn-admin-danger btn-remove-image" style="padding: 6px 12px;">✕</button>
        `;
        imageInputsContainer.appendChild(row);
        row.querySelector(".image-url-input").addEventListener("input", refreshImagePreviews);
        row.querySelector(".btn-remove-image").addEventListener("click", () => {
          row.remove();
          refreshImagePreviews();
        });
      });

      refreshImagePreviews();
      updateAdvancePreview();
      importModal.classList.remove("show");
      window.showToast("Product metadata populated into form! Review and click Save.", "success");
    });
  }

  // ==========================================================================
  // FORM SUBMISSION (SAVE PRODUCT TO SUPABASE)
  // ==========================================================================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("product-name").value.trim();
      const brand = document.getElementById("product-brand").value.trim();
      const categoryId = catSelect.value;
      const price = parseFloat(document.getElementById("product-price").value);
      const originalPrice = parseFloat(document.getElementById("product-original-price").value) || null;
      const stock = parseInt(document.getElementById("product-stock").value, 10) || 0;
      const description = document.getElementById("product-description").value.trim();
      const sourceUrl = document.getElementById("product-source-url")?.value.trim() || null;
      const sourceName = document.getElementById("product-source-name")?.value.trim() || null;

      const isFeatured = document.getElementById("check-featured").checked;
      const isNew = document.getElementById("check-new").checked;
      const isDeal = document.getElementById("check-deal").checked;
      const isActive = document.getElementById("check-active").checked;

      // Sizes & Colors JSONB arrays
      const sizes = (document.getElementById("product-sizes").value || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      const colors = (document.getElementById("product-colors").value || "")
        .split(",").map(c => c.trim()).filter(Boolean);

      // Collect image URLs
      const images = Array.from(document.querySelectorAll(".image-url-input"))
        .map(i => i.value.trim()).filter(Boolean);

      if (!name || isNaN(price) || price < 0) {
        alert("Please enter a valid product name and positive INR price.");
        return;
      }

      // Advance payment configuration validation
      const advanceEnabled = Boolean(advEnabledCheckbox && advEnabledCheckbox.checked);
      const advanceType = (advTypeSelect && advTypeSelect.value) ? advTypeSelect.value : "fixed";
      let advanceValue = parseFloat(advValueInput ? advValueInput.value : 0) || 0;

      if (advanceEnabled) {
        if (advanceValue <= 0) {
          alert("Please enter a valid positive advance payment amount or percentage.");
          return;
        }
        if (advanceType === "fixed" && advanceValue > price) {
          alert(`The fixed advance amount (${window.formatINR(advanceValue)}) cannot exceed the product selling price (${window.formatINR(price)}).`);
          return;
        }
        if (advanceType === "percentage" && advanceValue > 100) {
          alert("The advance percentage cannot exceed 100%.");
          return;
        }
      } else {
        advanceValue = 0;
      }

      // Generate slug
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now().toString().slice(-4);

      // Discount percentage calculation
      let discountPct = 0;
      if (originalPrice && originalPrice > price) {
        discountPct = Math.round(((originalPrice - price) / originalPrice) * 100);
      }

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving to Database...";

      const productPayload = {
        name,
        brand: brand || "VELORA Atelier",
        slug,
        category_id: categoryId || null,
        description,
        price,
        original_price: originalPrice,
        discount_percentage: discountPct,
        stock,
        sizes,
        colors,
        images: images.length > 0 ? images : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80"],
        source_url: sourceUrl,
        source_name: sourceName,
        advance_payment_enabled: advanceEnabled,
        advance_payment_type: advanceType,
        advance_payment_value: advanceValue,
        is_featured: isFeatured,
        is_new: isNew,
        is_deal: isDeal,
        is_active: isActive
      };

      try {
        const { data, error } = await client.from("products").insert([productPayload]).select().single();
        if (error) throw error;

        window.showToast("Product created successfully!", "success");
        setTimeout(() => {
          window.location.href = "products.html";
        }, 800);
      } catch (err) {
        alert("Error saving product: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Product to Catalog";
      }
    });
  }
});
