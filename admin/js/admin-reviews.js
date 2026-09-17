/**
 * VELORA Admin Panel - Complete Customer Reviews & Ratings Management System
 * Dual-view architecture:
 * View 1: Catalog products grid with live review stats, search & filtering
 * View 2: Product reviews management with full CRUD (Add, Edit, Delete) synchronized with Supabase
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();

  // ----------------------------------------------------
  // App State
  // ----------------------------------------------------
  const state = {
    products: [],
    categories: [],
    reviewsSummary: {}, // productId -> { total: number, approvedCount: number, approvedAvg: number }
    currentProduct: null,
    currentReviews: [],
    productFilter: {
      search: "",
      category: "",
      hasReviews: "",
      sort: "reviews-desc"
    },
    reviewFilter: {
      search: "",
      status: "",
      rating: ""
    }
  };

  // ----------------------------------------------------
  // DOM Elements
  // ----------------------------------------------------
  const dom = {
    // Views
    viewProducts: document.getElementById("view-products"),
    viewProductReviews: document.getElementById("view-product-reviews"),

    // Metrics
    statTotalProducts: document.getElementById("stat-total-products"),
    statReviewedProducts: document.getElementById("stat-reviewed-products"),
    statTotalReviews: document.getElementById("stat-total-reviews"),
    statAvgRating: document.getElementById("stat-avg-rating"),

    // View 1 (Products)
    searchProducts: document.getElementById("search-review-products"),
    filterCategory: document.getElementById("filter-review-category"),
    filterHasReviews: document.getElementById("filter-has-reviews"),
    sortProducts: document.getElementById("sort-review-products"),
    productCountBadge: document.getElementById("product-review-count-badge"),
    productsGrid: document.getElementById("review-products-grid"),

    // View 2 (Product Reviews)
    btnBackToProducts: document.getElementById("btn-back-to-products"),
    detailProductImg: document.getElementById("detail-product-img"),
    detailProductName: document.getElementById("detail-product-name"),
    detailProductCategory: document.getElementById("detail-product-category"),
    detailProductBrand: document.getElementById("detail-product-brand"),
    detailProductPrice: document.getElementById("detail-product-price"),
    detailProductRating: document.getElementById("detail-product-rating"),
    detailProductReviewCount: document.getElementById("detail-product-review-count"),
    btnOpenAddReview: document.getElementById("btn-open-add-review"),

    searchReviewsText: document.getElementById("search-reviews-text"),
    filterReviewStatus: document.getElementById("filter-review-status"),
    filterReviewRating: document.getElementById("filter-review-rating"),
    reviewsFilteredBadge: document.getElementById("reviews-filtered-count-badge"),
    productReviewsContainer: document.getElementById("product-reviews-container"),

    // Modal Add Review
    modalAddReview: document.getElementById("modal-add-review"),
    addModalProductTitle: document.getElementById("add-modal-product-title"),
    formAddReview: document.getElementById("form-add-review"),
    addReviewAuthor: document.getElementById("add-review-author"),
    addReviewRating: document.getElementById("add-review-rating"),
    addReviewRatingLabel: document.getElementById("add-review-rating-label"),
    addReviewStarsGroup: document.getElementById("add-review-stars-group"),
    addReviewStatus: document.getElementById("add-review-status"),
    addReviewComment: document.getElementById("add-review-comment"),
    btnCancelAddReview: document.getElementById("btn-cancel-add-review"),
    btnCloseAddModal: document.getElementById("btn-close-add-modal"),
    btnSaveAddReview: document.getElementById("btn-save-add-review"),

    // Modal Edit Review
    modalEditReview: document.getElementById("modal-edit-review"),
    formEditReview: document.getElementById("form-edit-review"),
    editReviewId: document.getElementById("edit-review-id"),
    editReviewAuthor: document.getElementById("edit-review-author"),
    editReviewRating: document.getElementById("edit-review-rating"),
    editReviewRatingLabel: document.getElementById("edit-review-rating-label"),
    editReviewStarsGroup: document.getElementById("edit-review-stars-group"),
    editReviewStatus: document.getElementById("edit-review-status"),
    editReviewComment: document.getElementById("edit-review-comment"),
    btnCancelEditReview: document.getElementById("btn-cancel-edit-review"),
    btnCloseEditModal: document.getElementById("btn-close-edit-modal"),
    btnSaveEditReview: document.getElementById("btn-save-edit-review"),

    // Modal Delete Review
    modalDeleteReview: document.getElementById("modal-delete-review"),
    deleteReviewId: document.getElementById("delete-review-id"),
    deleteReviewAuthor: document.getElementById("delete-review-author"),
    deleteReviewPreview: document.getElementById("delete-review-preview"),
    btnCancelDeleteReview: document.getElementById("btn-cancel-delete-review"),
    btnCloseDeleteModal: document.getElementById("btn-close-delete-modal"),
    btnConfirmDeleteReview: document.getElementById("btn-confirm-delete-review")
  };

  // ----------------------------------------------------
  // Star Helpers
  // ----------------------------------------------------
  function renderStarVisual(rating, max = 5) {
    const r = Math.round(Number(rating) || 0);
    return "★".repeat(Math.min(max, Math.max(0, r))) + "☆".repeat(Math.max(0, max - r));
  }

  function setupStarPicker(container, hiddenInput, labelEl) {
    if (!container) return;
    const stars = container.querySelectorAll(".star-item");

    function setRating(val) {
      hiddenInput.value = val;
      if (labelEl) {
        labelEl.textContent = `${val} Star${val === 1 ? "" : "s"}`;
      }
      stars.forEach(s => {
        const itemVal = parseInt(s.dataset.rating, 10);
        if (itemVal <= val) {
          s.classList.add("active");
        } else {
          s.classList.remove("active");
        }
      });
    }

    stars.forEach(star => {
      star.addEventListener("click", () => {
        const val = parseInt(star.dataset.rating, 10);
        setRating(val);
      });

      star.addEventListener("mouseenter", () => {
        const hoverVal = parseInt(star.dataset.rating, 10);
        stars.forEach(s => {
          const itemVal = parseInt(s.dataset.rating, 10);
          if (itemVal <= hoverVal) {
            s.classList.add("hovered");
          } else {
            s.classList.remove("hovered");
          }
        });
      });
    });

    container.addEventListener("mouseleave", () => {
      stars.forEach(s => s.classList.remove("hovered"));
      setRating(parseInt(hiddenInput.value || "5", 10));
    });

    return setRating;
  }

  const setAddStarRating = setupStarPicker(
    dom.addReviewStarsGroup,
    dom.addReviewRating,
    dom.addReviewRatingLabel
  );

  const setEditStarRating = setupStarPicker(
    dom.editReviewStarsGroup,
    dom.editReviewRating,
    dom.editReviewRatingLabel
  );

  // ----------------------------------------------------
  // Product Image Extraction Helper (Matches Storefront & Real Schema)
  // ----------------------------------------------------
  function getProductPrimaryImage(product) {
    if (!product) return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80";

    if (product.images) {
      if (Array.isArray(product.images) && product.images.length > 0) {
        const first = product.images[0];
        if (typeof first === "string" && first.trim()) return first.trim();
        if (first && typeof first === "object" && first.url) return first.url;
      }
      if (typeof product.images === "string") {
        try {
          const parsed = JSON.parse(product.images);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            if (typeof first === "string" && first.trim()) return first.trim();
            if (first && typeof first === "object" && first.url) return first.url;
          }
        } catch (_) {}
        const trimmed = product.images.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("../") || trimmed.startsWith("/")) {
          return trimmed;
        }
      }
    }
    return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80";
  }

  // ----------------------------------------------------
  // Initial Data Fetching
  // ----------------------------------------------------
  async function loadCatalogData() {
    try {
      // 1. Fetch categories
      const { data: categories } = await client
        .from("categories")
        .select("id, name, slug")
        .order("name");
      state.categories = categories || [];

      // Populate categories dropdown
      if (dom.filterCategory) {
        dom.filterCategory.innerHTML = '<option value="">All Categories</option>' +
          state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      }

      // 2. Fetch all products using existing schema columns (never query featured_image)
      const { data: products, error: prodErr } = await client
        .from("products")
        .select("id, name, slug, brand, price, original_price, rating, review_count, stock, images, category_id, is_active, categories(id, name, slug)")
        .order("name");

      if (prodErr) throw prodErr;
      state.products = products || [];

      // 3. Fetch all reviews to calculate live counts and ratings per product
      const { data: allReviews, error: revErr } = await client
        .from("reviews")
        .select("id, product_id, rating, status");

      if (revErr) {
        console.warn("Notice: Could not load full reviews summary directly:", revErr);
      }

      // Calculate summary maps
      const summary = {};
      state.products.forEach(p => {
        summary[p.id] = {
          total: 0,
          approvedCount: p.review_count || 0,
          approvedAvg: Number(p.rating || 0)
        };
      });

      if (allReviews && allReviews.length > 0) {
        const prodReviewsMap = {};
        allReviews.forEach(r => {
          if (!prodReviewsMap[r.product_id]) prodReviewsMap[r.product_id] = [];
          prodReviewsMap[r.product_id].push(r);
        });

        Object.keys(prodReviewsMap).forEach(pid => {
          const revs = prodReviewsMap[pid];
          const approved = revs.filter(r => r.status === "approved");
          const totalScore = approved.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
          const approvedAvg = approved.length > 0 ? Number((totalScore / approved.length).toFixed(1)) : 0;

          summary[pid] = {
            total: revs.length,
            approvedCount: approved.length,
            approvedAvg: approvedAvg
          };
        });
      }

      state.reviewsSummary = summary;
      updateMetricsCards();
      renderProductsGrid();
    } catch (err) {
      console.error("Error loading reviews catalog:", err);
      if (dom.productsGrid) {
        dom.productsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--admin-danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 12px; display:block;"></i>
            Failed to load products: ${err.message || err}
          </div>
        `;
      }
    }
  }

  // ----------------------------------------------------
  // Metrics Calculation & Update
  // ----------------------------------------------------
  function updateMetricsCards() {
    const totalProducts = state.products.length;
    let reviewedProductsCount = 0;
    let totalApprovedReviews = 0;
    let totalRatingSum = 0;
    let totalRatedProducts = 0;

    Object.keys(state.reviewsSummary).forEach(pid => {
      const stats = state.reviewsSummary[pid];
      if (stats.approvedCount > 0) {
        reviewedProductsCount++;
        totalApprovedReviews += stats.approvedCount;
        totalRatingSum += stats.approvedAvg;
        totalRatedProducts++;
      }
    });

    const catalogAvgRating = totalRatedProducts > 0
      ? (totalRatingSum / totalRatedProducts).toFixed(1)
      : "5.0";

    if (dom.statTotalProducts) dom.statTotalProducts.textContent = totalProducts;
    if (dom.statReviewedProducts) dom.statReviewedProducts.textContent = reviewedProductsCount;
    if (dom.statTotalReviews) dom.statTotalReviews.textContent = totalApprovedReviews;
    if (dom.statAvgRating) dom.statAvgRating.textContent = `${catalogAvgRating} ★`;
  }

  // ----------------------------------------------------
  // View 1: Render Products Catalog Grid
  // ----------------------------------------------------
  function renderProductsGrid() {
    if (!dom.productsGrid) return;

    let filtered = [...state.products];

    // Search filter
    const search = state.productFilter.search.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(p => {
        const name = (p.name || "").toLowerCase();
        const brand = (p.brand || "").toLowerCase();
        const catName = (p.categories?.name || "").toLowerCase();
        return name.includes(search) || brand.includes(search) || catName.includes(search);
      });
    }

    // Category filter
    const catId = state.productFilter.category;
    if (catId) {
      filtered = filtered.filter(p => p.category_id === catId || p.categories?.id === catId);
    }

    // Has reviews filter
    const hasRevs = state.productFilter.hasReviews;
    if (hasRevs === "with") {
      filtered = filtered.filter(p => {
        const stats = state.reviewsSummary[p.id];
        return stats && stats.approvedCount > 0;
      });
    } else if (hasRevs === "without") {
      filtered = filtered.filter(p => {
        const stats = state.reviewsSummary[p.id];
        return !stats || stats.approvedCount === 0;
      });
    }

    // Sorting
    const sort = state.productFilter.sort;
    filtered.sort((a, b) => {
      const statsA = state.reviewsSummary[a.id] || { approvedCount: 0, approvedAvg: 0 };
      const statsB = state.reviewsSummary[b.id] || { approvedCount: 0, approvedAvg: 0 };

      if (sort === "reviews-desc") {
        return statsB.approvedCount - statsA.approvedCount;
      }
      if (sort === "rating-desc") {
        return statsB.approvedAvg - statsA.approvedAvg;
      }
      if (sort === "rating-asc") {
        return statsA.approvedAvg - statsB.approvedAvg;
      }
      if (sort === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return 0;
    });

    if (dom.productCountBadge) {
      dom.productCountBadge.textContent = `${filtered.length} Product${filtered.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
      dom.productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--admin-card-border); border-radius: 12px; color: var(--admin-text-muted);">
          <i class="fas fa-search" style="font-size: 2.2rem; margin-bottom: 12px; opacity: 0.5; display:block;"></i>
          <h4 style="font-size: 1.1rem; color: #fff; margin-bottom: 6px;">No products match your criteria</h4>
          <p style="font-size: 0.85rem; margin: 0;">Try adjusting your search query or removing category filters.</p>
        </div>
      `;
      return;
    }

    dom.productsGrid.innerHTML = filtered.map(product => {
      const stats = state.reviewsSummary[product.id] || { approvedCount: 0, approvedAvg: 0 };
      const categoryName = product.categories?.name || "Apparel";
      const brand = product.brand || "VELORA";
      const imageSrc = getProductPrimaryImage(product);
      const priceFormatted = `₹${(product.price || 0).toLocaleString("en-IN")}`;
      const starsDisplay = renderStarVisual(stats.approvedAvg);

      return `
        <div class="review-product-card" data-id="${product.id}">
          <div class="review-product-image-wrap">
            <img src="${imageSrc}" alt="${product.name}" onerror="this.src='../assets/default-product.png'">
          </div>
          <div class="review-product-content">
            <div class="review-product-meta">
              <span class="badge badge-indigo">${categoryName}</span>
              <span class="badge badge-muted">${brand}</span>
            </div>
            <h3 class="review-product-title" title="${product.name}">${product.name}</h3>
            
            <div class="review-product-stats">
              <div class="review-product-rating">
                <span>${starsDisplay}</span>
                <span>${stats.approvedAvg.toFixed(1)}</span>
              </div>
              <div>
                <span class="badge ${stats.approvedCount > 0 ? 'badge-success' : 'badge-muted'}">
                  ${stats.approvedCount} Review${stats.approvedCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <span style="font-weight: 700; color: #fff; font-size: 1rem;">${priceFormatted}</span>
              <button type="button" class="btn-admin-primary btn-manage-reviews" data-id="${product.id}" style="padding: 7px 14px; font-size: 0.8rem;">
                <i class="fas fa-comments"></i> Manage Reviews
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach click listeners to cards and buttons
    dom.productsGrid.querySelectorAll(".btn-manage-reviews").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.dataset.id;
        openProductReviews(pid);
      });
    });

    dom.productsGrid.querySelectorAll(".review-product-card").forEach(card => {
      card.addEventListener("click", () => {
        const pid = card.dataset.id;
        openProductReviews(pid);
      });
    });
  }

  // ----------------------------------------------------
  // View 2: Open and Manage Product Reviews
  // ----------------------------------------------------
  async function openProductReviews(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) {
      window.showToast("Product not found.", "error");
      return;
    }

    state.currentProduct = product;

    // Transition view
    dom.viewProducts.style.display = "none";
    dom.viewProductReviews.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Update Product Banner Info
    const stats = state.reviewsSummary[product.id] || { approvedCount: 0, approvedAvg: 0 };
    dom.detailProductImg.src = getProductPrimaryImage(product);
    dom.detailProductName.textContent = product.name;
    dom.detailProductCategory.textContent = product.categories?.name || "General";
    dom.detailProductBrand.textContent = product.brand || "VELORA";
    dom.detailProductPrice.textContent = `₹${(product.price || 0).toLocaleString("en-IN")}`;
    dom.detailProductRating.textContent = `${stats.approvedAvg.toFixed(1)} ★`;
    dom.detailProductReviewCount.textContent = stats.approvedCount;

    // Reset Review Filter
    state.reviewFilter = { search: "", status: "", rating: "" };
    if (dom.searchReviewsText) dom.searchReviewsText.value = "";
    if (dom.filterReviewStatus) dom.filterReviewStatus.value = "";
    if (dom.filterReviewRating) dom.filterReviewRating.value = "";

    await loadProductReviewsList(productId);
  }

  async function loadProductReviewsList(productId) {
    if (!dom.productReviewsContainer) return;
    dom.productReviewsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.8rem; color: var(--admin-accent); margin-bottom: 10px; display: block;"></i>
        Loading customer reviews...
      </div>
    `;

    try {
      const { data: reviews, error } = await client
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      state.currentReviews = reviews || [];
      renderReviewsList();
    } catch (err) {
      console.error("Error loading product reviews:", err);
      dom.productReviewsContainer.innerHTML = `
        <div style="text-align: center; padding: 36px; color: var(--admin-danger);">
          Failed to load reviews: ${err.message || err}
        </div>
      `;
    }
  }

  function renderReviewsList() {
    if (!dom.productReviewsContainer) return;

    let filtered = [...state.currentReviews];

    // Search query
    const query = state.reviewFilter.search.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(r => {
        const name = (r.user_name || "").toLowerCase();
        const comment = (r.comment || "").toLowerCase();
        return name.includes(query) || comment.includes(query);
      });
    }

    // Status filter
    const status = state.reviewFilter.status;
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    // Rating filter
    const rating = state.reviewFilter.rating;
    if (rating) {
      filtered = filtered.filter(r => Number(r.rating) === Number(rating));
    }

    if (dom.reviewsFilteredBadge) {
      dom.reviewsFilteredBadge.textContent = `${filtered.length} Review${filtered.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
      dom.productReviewsContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 24px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--admin-card-border); border-radius: 12px; color: var(--admin-text-muted);">
          <i class="fas fa-star-half-alt" style="font-size: 2.2rem; margin-bottom: 12px; opacity: 0.5; display:block;"></i>
          <h4 style="font-size: 1.1rem; color: #fff; margin-bottom: 6px;">No Customer Reviews Found</h4>
          <p style="font-size: 0.85rem; margin-bottom: 18px;">
            ${state.currentReviews.length === 0 ? "This product has not received any reviews yet." : "No reviews match your current filters."}
          </p>
          <button type="button" class="btn-admin-primary btn-add-first-review" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fas fa-plus"></i> Add First Review
          </button>
        </div>
      `;
      dom.productReviewsContainer.querySelector(".btn-add-first-review")?.addEventListener("click", openAddReviewModal);
      return;
    }

    dom.productReviewsContainer.innerHTML = filtered.map(r => {
      const stars = renderStarVisual(r.rating);
      let statusBadge = '<span class="badge badge-success">Approved</span>';
      if (r.status === "pending") statusBadge = '<span class="badge badge-warning">Pending</span>';
      if (r.status === "rejected") statusBadge = '<span class="badge badge-danger">Rejected</span>';

      const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent";
      const initial = (r.user_name || "C").trim().charAt(0).toUpperCase();

      return `
        <div class="review-item-card" data-id="${r.id}">
          <div class="review-item-top">
            <div class="review-item-author">
              <div class="review-avatar-circle">${initial}</div>
              <div>
                <div class="review-item-author-name">${r.user_name}</div>
                <div class="review-item-date">${dateStr}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #f59e0b; font-size: 1.05rem; letter-spacing: 2px;">${stars}</span>
              ${statusBadge}
            </div>
          </div>

          <div class="review-item-body">
            ${r.comment}
          </div>

          <div class="review-item-actions">
            <button type="button" class="btn-admin-secondary btn-edit-review" data-id="${r.id}" style="padding: 5px 12px; font-size: 0.8rem;">
              <i class="fas fa-pencil-alt"></i> Edit
            </button>
            <button type="button" class="btn-admin-danger btn-delete-review" data-id="${r.id}">
              <i class="fas fa-trash-alt"></i> Delete
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Attach row action listeners
    dom.productReviewsContainer.querySelectorAll(".btn-edit-review").forEach(btn => {
      btn.addEventListener("click", () => {
        openEditReviewModal(btn.dataset.id);
      });
    });

    dom.productReviewsContainer.querySelectorAll(".btn-delete-review").forEach(btn => {
      btn.addEventListener("click", () => {
        openDeleteReviewModal(btn.dataset.id);
      });
    });
  }

  // ----------------------------------------------------
  // Sync Product Ratings & Review Counts to Supabase
  // ----------------------------------------------------
  async function syncProductStats(productId) {
    try {
      // 1. Fetch all current approved reviews for this product
      const { data: approvedReviews, error: qErr } = await client
        .from("reviews")
        .select("rating")
        .eq("product_id", productId)
        .eq("status", "approved");

      if (qErr) throw qErr;

      const newCount = approvedReviews ? approvedReviews.length : 0;
      let newAvg = 0.0;
      if (newCount > 0) {
        const total = approvedReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
        newAvg = Number((total / newCount).toFixed(1));
      }

      // 2. Direct database update to products table
      const { error: updErr } = await client
        .from("products")
        .update({
          rating: newAvg,
          review_count: newCount
        })
        .eq("id", productId);

      if (updErr) {
        console.warn("Direct product rating update error:", updErr);
      }

      // 3. Attempt RPC sync fallback
      try {
        await client.rpc("sync_product_review_stats", { p_product_id: productId });
      } catch (rpcErr) {
        // Safe to ignore if RPC is not installed
      }

      // 4. Update local state
      if (!state.reviewsSummary[productId]) {
        state.reviewsSummary[productId] = { total: 0, approvedCount: 0, approvedAvg: 0 };
      }
      state.reviewsSummary[productId].approvedCount = newCount;
      state.reviewsSummary[productId].approvedAvg = newAvg;

      // Update current product banner if open
      if (state.currentProduct && state.currentProduct.id === productId) {
        dom.detailProductRating.textContent = `${newAvg.toFixed(1)} ★`;
        dom.detailProductReviewCount.textContent = newCount;
      }

      updateMetricsCards();
    } catch (err) {
      console.error("Failed to synchronize product review stats:", err);
    }
  }

  // ----------------------------------------------------
  // Modal 1: Add Review Handlers
  // ----------------------------------------------------
  function openAddReviewModal() {
    if (!state.currentProduct) return;
    dom.addModalProductTitle.textContent = state.currentProduct.name;
    dom.addReviewAuthor.value = "";
    dom.addReviewComment.value = "";
    dom.addReviewStatus.value = "approved";
    setAddStarRating(5);
    dom.modalAddReview.classList.add("show");
  }

  function closeAddReviewModal() {
    dom.modalAddReview.classList.remove("show");
  }

  dom.btnOpenAddReview?.addEventListener("click", openAddReviewModal);
  dom.btnCancelAddReview?.addEventListener("click", closeAddReviewModal);
  dom.btnCloseAddModal?.addEventListener("click", closeAddReviewModal);

  dom.btnSaveAddReview?.addEventListener("click", async () => {
    const author = dom.addReviewAuthor.value.trim();
    const rating = parseInt(dom.addReviewRating.value || "5", 10);
    const status = dom.addReviewStatus.value;
    const comment = dom.addReviewComment.value.trim();

    if (!author) {
      window.showToast("Please enter a customer name.", "error");
      dom.addReviewAuthor.focus();
      return;
    }
    if (!comment) {
      window.showToast("Please enter review feedback.", "error");
      dom.addReviewComment.focus();
      return;
    }

    dom.btnSaveAddReview.disabled = true;
    dom.btnSaveAddReview.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const newReview = {
        product_id: state.currentProduct.id,
        user_name: author,
        rating: rating,
        comment: comment,
        status: status,
        created_at: new Date().toISOString()
      };

      const { error } = await client.from("reviews").insert([newReview]);
      if (error) throw error;

      window.showToast("Customer review added successfully!", "success");
      closeAddReviewModal();

      // Synchronize product aggregate ratings & review count
      await syncProductStats(state.currentProduct.id);

      // Refresh reviews list
      await loadProductReviewsList(state.currentProduct.id);
    } catch (err) {
      console.error("Failed to add review:", err);
      window.showToast(`Error adding review: ${err.message || err}`, "error");
    } finally {
      dom.btnSaveAddReview.disabled = false;
      dom.btnSaveAddReview.innerHTML = '<i class="fas fa-save"></i> Save Review';
    }
  });

  // ----------------------------------------------------
  // Modal 2: Edit Review Handlers
  // ----------------------------------------------------
  function openEditReviewModal(reviewId) {
    const review = state.currentReviews.find(r => r.id === reviewId);
    if (!review) return;

    dom.editReviewId.value = review.id;
    dom.editReviewAuthor.value = review.user_name || "";
    dom.editReviewStatus.value = review.status || "approved";
    dom.editReviewComment.value = review.comment || "";
    setEditStarRating(Number(review.rating) || 5);

    dom.modalEditReview.classList.add("show");
  }

  function closeEditReviewModal() {
    dom.modalEditReview.classList.remove("show");
  }

  dom.btnCancelEditReview?.addEventListener("click", closeEditReviewModal);
  dom.btnCloseEditModal?.addEventListener("click", closeEditReviewModal);

  dom.btnSaveEditReview?.addEventListener("click", async () => {
    const reviewId = dom.editReviewId.value;
    const author = dom.editReviewAuthor.value.trim();
    const rating = parseInt(dom.editReviewRating.value || "5", 10);
    const status = dom.editReviewStatus.value;
    const comment = dom.editReviewComment.value.trim();

    if (!author) {
      window.showToast("Please enter a customer name.", "error");
      dom.editReviewAuthor.focus();
      return;
    }
    if (!comment) {
      window.showToast("Please enter review feedback.", "error");
      dom.editReviewComment.focus();
      return;
    }

    dom.btnSaveEditReview.disabled = true;
    dom.btnSaveEditReview.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const { error } = await client
        .from("reviews")
        .update({
          user_name: author,
          rating: rating,
          status: status,
          comment: comment,
          updated_at: new Date().toISOString()
        })
        .eq("id", reviewId);

      if (error) throw error;

      window.showToast("Review updated successfully!", "success");
      closeEditReviewModal();

      // Synchronize product aggregate ratings & review count
      await syncProductStats(state.currentProduct.id);

      // Refresh reviews list
      await loadProductReviewsList(state.currentProduct.id);
    } catch (err) {
      console.error("Failed to update review:", err);
      window.showToast(`Error updating review: ${err.message || err}`, "error");
    } finally {
      dom.btnSaveEditReview.disabled = false;
      dom.btnSaveEditReview.innerHTML = '<i class="fas fa-check"></i> Save Changes';
    }
  });

  // ----------------------------------------------------
  // Modal 3: Delete Review Handlers
  // ----------------------------------------------------
  function openDeleteReviewModal(reviewId) {
    const review = state.currentReviews.find(r => r.id === reviewId);
    if (!review) return;

    dom.deleteReviewId.value = review.id;
    dom.deleteReviewAuthor.textContent = review.user_name || "Customer";
    dom.deleteReviewPreview.textContent = `"${(review.comment || "").slice(0, 120)}${(review.comment || "").length > 120 ? "..." : ""}"`;

    dom.modalDeleteReview.classList.add("show");
  }

  function closeDeleteReviewModal() {
    dom.modalDeleteReview.classList.remove("show");
  }

  dom.btnCancelDeleteReview?.addEventListener("click", closeDeleteReviewModal);
  dom.btnCloseDeleteModal?.addEventListener("click", closeDeleteReviewModal);

  dom.btnConfirmDeleteReview?.addEventListener("click", async () => {
    const reviewId = dom.deleteReviewId.value;
    if (!reviewId) return;

    dom.btnConfirmDeleteReview.disabled = true;
    dom.btnConfirmDeleteReview.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
      const { error } = await client
        .from("reviews")
        .delete()
        .eq("id", reviewId);

      if (error) throw error;

      window.showToast("Review deleted from database.", "info");
      closeDeleteReviewModal();

      // Synchronize product aggregate ratings & review count
      await syncProductStats(state.currentProduct.id);

      // Refresh reviews list
      await loadProductReviewsList(state.currentProduct.id);
    } catch (err) {
      console.error("Failed to delete review:", err);
      window.showToast(`Error deleting review: ${err.message || err}`, "error");
    } finally {
      dom.btnConfirmDeleteReview.disabled = false;
      dom.btnConfirmDeleteReview.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Review';
    }
  });

  // ----------------------------------------------------
  // Navigation & Filtering Handlers
  // ----------------------------------------------------
  dom.btnBackToProducts?.addEventListener("click", () => {
    dom.viewProductReviews.style.display = "none";
    dom.viewProducts.style.display = "block";
    renderProductsGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // View 1 Filter Event Listeners
  dom.searchProducts?.addEventListener("input", (e) => {
    state.productFilter.search = e.target.value;
    renderProductsGrid();
  });

  dom.filterCategory?.addEventListener("change", (e) => {
    state.productFilter.category = e.target.value;
    renderProductsGrid();
  });

  dom.filterHasReviews?.addEventListener("change", (e) => {
    state.productFilter.hasReviews = e.target.value;
    renderProductsGrid();
  });

  dom.sortProducts?.addEventListener("change", (e) => {
    state.productFilter.sort = e.target.value;
    renderProductsGrid();
  });

  // View 2 Filter Event Listeners
  dom.searchReviewsText?.addEventListener("input", (e) => {
    state.reviewFilter.search = e.target.value;
    renderReviewsList();
  });

  dom.filterReviewStatus?.addEventListener("change", (e) => {
    state.reviewFilter.status = e.target.value;
    renderReviewsList();
  });

  dom.filterReviewRating?.addEventListener("change", (e) => {
    state.reviewFilter.rating = e.target.value;
    renderReviewsList();
  });

  // Close modals when clicking backdrop
  [dom.modalAddReview, dom.modalEditReview, dom.modalDeleteReview].forEach(modal => {
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
      }
    });
  });

  // Initialize
  await loadCatalogData();
});
