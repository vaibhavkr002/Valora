/**
 * VELORA Admin Panel - Edit Product Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const form = document.getElementById("edit-product-form");
  const catSelect = document.getElementById("product-category");
  const imageInputsContainer = document.getElementById("image-inputs-container");
  const btnAddImage = document.getElementById("btn-add-image-url");
  const imagesPreviewContainer = document.getElementById("images-preview-grid");

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");

  if (!productId) {
    alert("No product ID specified.");
    window.location.href = "products.html";
    return;
  }

  // Load categories
  const { data: cats } = await client.from("categories").select("id, name");
  if (cats && catSelect) {
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  }

  function refreshImagePreviews() {
    if (!imagesPreviewContainer) return;
    const inputs = document.querySelectorAll(".image-url-input");
    const urls = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

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
        <input type="url" class="admin-input image-url-input" placeholder="https://..." style="flex:1;">
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

  // Load current product data
  async function loadProduct() {
    const { data: p, error } = await client.from("products").select("*").eq("id", productId).single();
    if (error || !p) {
      alert("Product not found: " + (error?.message || "Unknown ID"));
      window.location.href = "products.html";
      return;
    }

    document.getElementById("product-name").value = p.name || "";
    document.getElementById("product-brand").value = p.brand || "";
    document.getElementById("product-price").value = p.price || 0;
    document.getElementById("product-original-price").value = p.original_price || "";
    document.getElementById("product-stock").value = p.stock || 0;
    document.getElementById("product-description").value = p.description || "";
    document.getElementById("product-source-url").value = p.source_url || "";
    document.getElementById("product-source-name").value = p.source_name || "";

    if (p.sizes && Array.isArray(p.sizes)) document.getElementById("product-sizes").value = p.sizes.join(", ");
    if (p.colors && Array.isArray(p.colors)) document.getElementById("product-colors").value = p.colors.join(", ");

    if (catSelect && p.category_id) catSelect.value = p.category_id;

    document.getElementById("check-featured").checked = Boolean(p.is_featured);
    document.getElementById("check-new").checked = Boolean(p.is_new);
    document.getElementById("check-deal").checked = Boolean(p.is_deal);
    document.getElementById("check-active").checked = Boolean(p.is_active);

    // Populate advance payment settings
    if (advEnabledCheckbox) {
      advEnabledCheckbox.checked = Boolean(p.advance_payment_enabled);
    }
    if (advTypeSelect) {
      advTypeSelect.value = p.advance_payment_type || "fixed";
    }
    if (advValueInput) {
      advValueInput.value = p.advance_payment_value !== undefined && p.advance_payment_value !== null ? p.advance_payment_value : "";
    }
    updateAdvancePreview();

    // Populate images
    imageInputsContainer.innerHTML = "";
    const imagesList = (p.images && Array.isArray(p.images) && p.images.length > 0) ? p.images : [];
    imagesList.forEach(url => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; gap: 8px; margin-top: 8px;";
      row.innerHTML = `
        <input type="url" class="admin-input image-url-input" value="${url}" style="flex:1;">
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
  }

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

      const sizes = (document.getElementById("product-sizes").value || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      const colors = (document.getElementById("product-colors").value || "")
        .split(",").map(c => c.trim()).filter(Boolean);

      const images = Array.from(document.querySelectorAll(".image-url-input"))
        .map(i => i.value.trim()).filter(Boolean);

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

      let discountPct = 0;
      if (originalPrice && originalPrice > price) {
        discountPct = Math.round(((originalPrice - price) / originalPrice) * 100);
      }

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating Product...";

      const updates = {
        name,
        brand,
        category_id: categoryId || null,
        description,
        price,
        original_price: originalPrice,
        discount_percentage: discountPct,
        stock,
        sizes,
        colors,
        images,
        source_url: sourceUrl,
        source_name: sourceName,
        advance_payment_enabled: advanceEnabled,
        advance_payment_type: advanceType,
        advance_payment_value: advanceValue,
        is_featured: isFeatured,
        is_new: isNew,
        is_deal: isDeal,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      try {
        const { error } = await client.from("products").update(updates).eq("id", productId);
        if (error) throw error;

        window.showToast("Product updated successfully! Changes live across VELORA.", "success");
        setTimeout(() => {
          window.location.href = "products.html";
        }, 700);
      } catch (err) {
        alert("Update failed: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Changes";
      }
    });
  }

  await loadProduct();
});
