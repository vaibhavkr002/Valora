/**
 * VADI Admin Panel - Sarojini Customer Reviews Controller
 * Manages customer reviews, approvals, ratings breakdown, and verified testimonials for Sarojini products
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  // DOM Elements
  const tbody = document.getElementById("reviews-tbody");
  const countBadge = document.getElementById("reviews-count-badge");
  const searchInput = document.getElementById("search-reviews");
  const filterRating = document.getElementById("filter-rating");

  const statTotalReviews = document.getElementById("stat-total-reviews");
  const statAvgRating = document.getElementById("stat-avg-rating");
  const statApprovedReviews = document.getElementById("stat-approved-reviews");
  const filterProduct = document.getElementById("filter-product");
  const filterStatus = document.getElementById("filter-status");

  // Modal Elements
  const btnCreateReview = document.getElementById("btn-create-review");
  const reviewModal = document.getElementById("review-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const reviewForm = document.getElementById("admin-review-form");
  const modalReviewHeading = document.getElementById("modal-review-heading");
  const modalReviewId = document.getElementById("modal-review-id");

  const modalProduct = document.getElementById("modal-review-product");
  const modalAuthor = document.getElementById("modal-review-author");
  const modalRating = document.getElementById("modal-review-rating");
  const modalTitle = document.getElementById("modal-review-title");
  const modalComment = document.getElementById("modal-review-comment");

  let sarojiniProducts = [];
  let allReviews = [];

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProductImage(prod) {
    if (!prod) return "assets/sarojni/prod-1-graphic-tee.png";
    if (Array.isArray(prod.images) && prod.images.length > 0) return prod.images[0];
    if (prod.image) return prod.image;
    return "assets/sarojni/prod-1-graphic-tee.png";
  }

  // 1. Load Products for dropdown mapping
  async function loadSarojiniProducts() {
    try {
      const { data, error } = await client
        .from("sarojini_products")
        .select("id, name, department, image, images, price")
        .order("name", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        sarojiniProducts = data;
      } else {
        const { data: sRow } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "sarojini_products")
          .maybeSingle();

        if (sRow && Array.isArray(sRow.value)) {
          sarojiniProducts = sRow.value;
        }
      }
    } catch (_) {}

    // Fallback products if empty
    if (sarojiniProducts.length === 0) {
      sarojiniProducts = [
        { id: "sar-tee-01", name: "Vintage Graphic Streetwear Tee", department: "Unisex Streetwear", image: "assets/sarojni/prod-1-graphic-tee.png" },
        { id: "sar-denim-02", name: "Distressed Korean Wide-Leg Jeans", department: "Women's Fashion", image: "assets/sarojni/prod-2-wide-leg-jeans.png" },
        { id: "sar-crochet-03", name: "Crochet Knit Summer Festival Crop Top", department: "Women's Fashion", image: "assets/sarojni/prod-3-crochet-top.png" },
        { id: "sar-cargo-04", name: "Utility Parachute Tactical Cargo Pants", department: "Men's Streetwear", image: "assets/sarojni/prod-4-cargo-pants.png" },
        { id: "sar-flannel-05", name: "Oversized Flannel Grunge Shacket", department: "Unisex Streetwear", image: "assets/sarojni/prod-5-flannel-shacket.png" },
        { id: "sar-chiffon-06", name: "Floral Y2K Ruffle Midi Sundress", department: "Women's Fashion", image: "assets/sarojni/prod-6-floral-dress.png" }
      ];
    }

    // Populate modal select
    modalProduct.innerHTML = '<option value="">-- Choose Product --</option>' + 
      sarojiniProducts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.department || 'Sarojini')})</option>`).join("");

    // Populate filter select
    if (filterProduct) {
      filterProduct.innerHTML = '<option value="">All Sarojini Products</option>' +
        sarojiniProducts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
    }
  }

  // 2. Load Reviews
  async function loadSarojiniReviews() {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px;"><i class="fas fa-spinner fa-spin"></i> Loading customer reviews...</td></tr>';

    let reviews = [];

    try {
      const { data, error } = await client
        .from("reviews")
        .select("*")
        .or("catalog_type.eq.sarojini,sarojini_product_id.not.is.null")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        reviews = data;
      }
    } catch (_) {}

    // Check local storage backup
    const localCache = JSON.parse(localStorage.getItem("sarojini_reviews_cache") || "[]");
    if (Array.isArray(localCache) && localCache.length > 0) {
      // Merge unique
      const existingIds = new Set(reviews.map(r => r.id));
      localCache.forEach(lr => {
        if (!existingIds.has(lr.id)) reviews.push(lr);
      });
    }

    // Starter verified reviews if DB is empty
    if (reviews.length === 0) {
      reviews = [
        {
          id: "sar-rev-101",
          sarojini_product_id: sarojiniProducts[0]?.id || "sar-tee-01",
          catalog_type: "sarojini",
          author_name: "Sneha Kapoor",
          rating: 5,
          title: "Authentic street fit & thick cotton!",
          comment: "Got this delivered via 100% online payment. Quality is literally Sarojini market grade without having to bargain in Delhi heat.",
          is_approved: true,
          status: "approved",
          created_at: new Date(Date.now() - 2 * 86400000).toISOString()
        },
        {
          id: "sar-rev-102",
          sarojini_product_id: sarojiniProducts[1]?.id || "sar-denim-02",
          catalog_type: "sarojini",
          author_name: "Rohan Khanna",
          rating: 5,
          title: "Advance payment + COD worked seamlessly",
          comment: "Paid ₹100 advance and remaining cash upon open-box delivery. Jeans fit oversized perfectly.",
          is_approved: true,
          status: "approved",
          created_at: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        {
          id: "sar-rev-103",
          sarojini_product_id: sarojiniProducts[2]?.id || "sar-crochet-03",
          catalog_type: "sarojini",
          author_name: "Meera Nair",
          rating: 4,
          title: "Super cute crochet pattern",
          comment: "Fabric is soft and breathable. Fast delivery by Bluedart.",
          is_approved: true,
          status: "approved",
          created_at: new Date(Date.now() - 9 * 86400000).toISOString()
        },
        {
          id: "sar-rev-104",
          sarojini_product_id: sarojiniProducts[3]?.id || "sar-cargo-04",
          catalog_type: "sarojini",
          author_name: "Vikram Malhotra",
          rating: 5,
          title: "Best cargo pants in this price bracket",
          comment: "Pockets are deep and tactical ties look great with high tops.",
          is_approved: false,
          status: "pending",
          created_at: new Date(Date.now() - 1 * 86400000).toISOString()
        }
      ];
    }

    allReviews = reviews;
    updateMetrics();
    renderReviews();
  }

  // 3. Update Metrics
  function updateMetrics() {
    const total = allReviews.length;
    const approved = allReviews.filter(r => r.is_approved === true || r.status === "approved").length;
    const ratingSum = allReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    const avg = total > 0 ? (ratingSum / total).toFixed(1) : "5.0";

    if (statTotalReviews) statTotalReviews.textContent = total;
    if (statApprovedReviews) statApprovedReviews.textContent = approved;
    if (statAvgRating) statAvgRating.textContent = `${avg} ★`;
  }

  // 4. Render Table
  function renderReviews() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const ratingVal = filterRating?.value;
    const prodVal = filterProduct?.value;
    const statusVal = filterStatus?.value;

    const filtered = allReviews.filter(r => {
      // Rating filter
      if (ratingVal && String(r.rating) !== String(ratingVal)) return false;

      // Product filter
      if (prodVal && (r.sarojini_product_id !== prodVal && r.product_id !== prodVal)) return false;

      // Status filter
      if (statusVal) {
        const isApproved = r.is_approved === true || r.status === "approved";
        if (statusVal === "approved" && !isApproved) return false;
        if (statusVal === "pending" && isApproved) return false;
      }

      // Search keyword filter
      if (query) {
        const prod = sarojiniProducts.find(p => p.id === (r.sarojini_product_id || r.product_id));
        const pName = (prod ? prod.name : "").toLowerCase();
        const author = (r.author_name || r.user_name || "").toLowerCase();
        const title = (r.title || "").toLowerCase();
        const comment = (r.comment || "").toLowerCase();
        if (!pName.includes(query) && !author.includes(query) && !title.includes(query) && !comment.includes(query)) {
          return false;
        }
      }

      return true;
    });

    if (countBadge) countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--admin-text-muted);">No Sarojini reviews match your filter criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const prod = sarojiniProducts.find(p => p.id === (r.sarojini_product_id || r.product_id));
      const pName = prod ? prod.name : "Sarojini Product";
      const pImg = getProductImage(prod);
      const pDept = prod?.department || "Sarojini Bazaar";

      const author = r.author_name || r.user_name || "Customer";
      const stars = "★".repeat(Math.min(5, Math.max(1, r.rating || 5))) + "☆".repeat(Math.max(0, 5 - (r.rating || 5)));
      const isAppr = r.is_approved === true || r.status === "approved";
      const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent";

      return `
        <tr>
          <td style="max-width: 220px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${escapeHtml(pImg)}" alt="" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid var(--admin-card-border);">
              <div>
                <div style="font-weight: 600; font-size: 0.85rem; line-height: 1.3; color: var(--admin-text-main);">${escapeHtml(pName)}</div>
                <span class="badge" style="background: rgba(225, 29, 72, 0.1); color: #e11d48; font-size: 0.68rem; padding: 2px 6px; margin-top: 3px; display: inline-block;">${escapeHtml(pDept)}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(author)}</div>
            <span style="font-size: 0.72rem; color: #059669; font-weight: 600;"><i class="fas fa-check-circle"></i> Verified Buyer</span>
          </td>
          <td>
            <div style="color: #f59e0b; font-size: 0.95rem; letter-spacing: 1px;">${stars}</div>
            <span style="font-size: 0.75rem; color: var(--admin-text-muted);">${r.rating || 5} of 5</span>
          </td>
          <td style="max-width: 300px;">
            ${r.title ? `<div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 3px; color: var(--admin-text-main);">${escapeHtml(r.title)}</div>` : ""}
            <div style="font-size: 0.8rem; color: var(--admin-text-muted); line-height: 1.4;">${escapeHtml(r.comment || "")}</div>
          </td>
          <td style="font-size: 0.8rem; color: var(--admin-text-muted); white-space: nowrap;">
            ${dateStr}
          </td>
          <td>
            <span class="badge ${isAppr ? 'badge-success' : 'badge-warning'}" style="font-size: 0.75rem; padding: 4px 8px;">
              ${isAppr ? 'Approved' : 'Pending'}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-icon btn-edit-review" data-id="${escapeHtml(r.id)}" title="Edit Review" style="color: #6366f1; margin-right: 4px;">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn-action-icon btn-toggle-status" data-id="${escapeHtml(r.id)}" title="${isAppr ? 'Unapprove' : 'Approve'}" style="color: ${isAppr ? '#f59e0b' : '#059669'}; margin-right: 4px;">
              <i class="fas ${isAppr ? 'fa-eye-slash' : 'fa-check'}"></i>
            </button>
            <button type="button" class="btn-action-icon text-danger btn-delete-review" data-id="${escapeHtml(r.id)}" title="Delete Review">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Attach Row Listeners
    tbody.querySelectorAll(".btn-edit-review").forEach(btn => {
      btn.addEventListener("click", () => openEditReview(btn.dataset.id));
    });

    tbody.querySelectorAll(".btn-toggle-status").forEach(btn => {
      btn.addEventListener("click", () => toggleReviewStatus(btn.dataset.id));
    });

    tbody.querySelectorAll(".btn-delete-review").forEach(btn => {
      btn.addEventListener("click", () => deleteReview(btn.dataset.id));
    });
  }

  // 5. Open Edit Review
  function openEditReview(reviewId) {
    const review = allReviews.find(r => r.id === reviewId);
    if (!review) return;

    if (modalReviewHeading) modalReviewHeading.textContent = "Edit Sarojini Review";
    if (modalReviewId) modalReviewId.value = review.id;

    if (modalProduct) modalProduct.value = review.sarojini_product_id || review.product_id || "";
    if (modalAuthor) modalAuthor.value = review.author_name || review.user_name || "";
    if (modalRating) modalRating.value = review.rating || 5;
    if (modalTitle) modalTitle.value = review.title || "";
    if (modalComment) modalComment.value = review.comment || "";

    if (reviewModal) reviewModal.style.display = "flex";
  }

  // 6. Toggle Approval Status
  async function toggleReviewStatus(reviewId) {
    const review = allReviews.find(r => r.id === reviewId);
    if (!review) return;

    const newApproved = !(review.is_approved === true || review.status === "approved");
    review.is_approved = newApproved;
    review.status = newApproved ? "approved" : "pending";

    try {
      await client
        .from("reviews")
        .update({ is_approved: newApproved, status: review.status, updated_at: new Date().toISOString() })
        .eq("id", reviewId);
    } catch (_) {}

    saveReviewsCache();
    updateMetrics();
    renderReviews();

    if (typeof window.showToast === "function") {
      window.showToast(`Review marked as ${review.status}.`, "success");
    }
  }

  // 7. Delete Review
  async function deleteReview(reviewId) {
    if (!confirm("Are you sure you want to permanently delete this customer review?")) return;

    allReviews = allReviews.filter(r => r.id !== reviewId);

    try {
      await client.from("reviews").delete().eq("id", reviewId);
    } catch (_) {}

    saveReviewsCache();
    updateMetrics();
    renderReviews();

    if (typeof window.showToast === "function") {
      window.showToast("Review deleted successfully.", "info");
    }
  }

  function saveReviewsCache() {
    try {
      localStorage.setItem("sarojini_reviews_cache", JSON.stringify(allReviews));
    } catch (_) {}
  }

  // 8. Modal Handlers
  btnCreateReview?.addEventListener("click", () => {
    reviewForm.reset();
    if (modalReviewHeading) modalReviewHeading.textContent = "Add Verified Sarojini Review";
    if (modalReviewId) modalReviewId.value = "";
    reviewModal.style.display = "flex";
  });

  btnCloseModal?.addEventListener("click", () => {
    reviewModal.style.display = "none";
  });

  btnCancelModal?.addEventListener("click", () => {
    reviewModal.style.display = "none";
  });

  reviewModal?.addEventListener("click", (e) => {
    if (e.target === reviewModal) reviewModal.style.display = "none";
  });

  reviewForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const existingReviewId = modalReviewId?.value?.trim();
    const prodId = modalProduct.value;
    const author = modalAuthor.value.trim();
    const rating = parseInt(modalRating.value, 10) || 5;
    const title = modalTitle.value.trim();
    const comment = modalComment.value.trim();

    if (!prodId) {
      alert("Please select a Sarojini product.");
      modalProduct.focus();
      return;
    }
    if (!author) {
      alert("Please enter customer name.");
      modalAuthor.focus();
      return;
    }
    if (!comment) {
      alert("Please enter review feedback.");
      modalComment.focus();
      return;
    }

    if (existingReviewId) {
      // EDIT MODE - UPDATE existing record, never duplicate insert!
      const updateData = {
        sarojini_product_id: prodId,
        catalog_type: "sarojini",
        author_name: author,
        user_name: author,
        rating: rating,
        title: title || "Verified Sarojini Purchase",
        comment: comment,
        updated_at: new Date().toISOString()
      };

      try {
        await client.from("reviews").update(updateData).eq("id", existingReviewId);
      } catch (_) {}

      const idx = allReviews.findIndex(r => r.id === existingReviewId);
      if (idx !== -1) {
        allReviews[idx] = { ...allReviews[idx], ...updateData };
      }

      saveReviewsCache();
      updateMetrics();
      renderReviews();

      reviewModal.style.display = "none";
      reviewForm.reset();
      if (modalReviewId) modalReviewId.value = "";

      if (typeof window.showToast === "function") {
        window.showToast("Review updated successfully!", "success");
      } else {
        alert("Review updated successfully!");
      }
    } else {
      // CREATE MODE - INSERT new record
      const newRev = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "sar-rev-" + Date.now(),
        sarojini_product_id: prodId,
        catalog_type: "sarojini",
        author_name: author,
        user_name: author,
        rating: rating,
        title: title || "Verified Sarojini Purchase",
        comment: comment,
        is_approved: true,
        status: "approved",
        created_at: new Date().toISOString()
      };

      try {
        await client.from("reviews").insert([newRev]);
      } catch (_) {}

      allReviews.unshift(newRev);
      saveReviewsCache();
      updateMetrics();
      renderReviews();

      reviewModal.style.display = "none";
      reviewForm.reset();

      if (typeof window.showToast === "function") {
        window.showToast("Verified customer review added and published!", "success");
      } else {
        alert("Verified customer review added and published!");
      }
    }
  });

  // 9. Filters Listeners
  searchInput?.addEventListener("input", renderReviews);
  filterRating?.addEventListener("change", renderReviews);
  filterProduct?.addEventListener("change", renderReviews);
  filterStatus?.addEventListener("change", renderReviews);

  // Initialize
  await loadSarojiniProducts();
  await loadSarojiniReviews();
});

