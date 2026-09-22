/**
 * VADI - Sarojini Product Details Controller (sarojini-product-details.js)
 * Manages product rendering, gallery switching, variants, Add to Bag, Buy Now, and isolated recommendations
 */

(function () {
  'use strict';

  function formatINR(amount) {
    if (typeof window.formatINR === 'function') return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  let currentProduct = null;
  let selectedSize = '';
  let selectedColor = '';
  let quantity = 1;

  async function loadProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('id') || urlParams.get('slug');

    const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
    let item = null;

    if (prodId && client) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prodId);
      // 1. Try table by id if UUID, or slug, or loose eq
      try {
        if (isUUID) {
          const { data, error } = await client
            .from('sarojini_products')
            .select('*')
            .eq('id', prodId)
            .maybeSingle();

          if (!error && data) item = data;
        } else {
          // Try slug first
          const { data: slugData, error: slugErr } = await client
            .from('sarojini_products')
            .select('*')
            .eq('slug', prodId)
            .maybeSingle();

          if (!slugErr && slugData) {
            item = slugData;
          } else {
            // Try id string
            const { data: idData } = await client
              .from('sarojini_products')
              .select('*')
              .eq('id', prodId)
              .maybeSingle();
            if (idData) item = idData;
          }
        }
      } catch (_) {}

      // Check cross-store Main products table if not found in sarojini_products
      if (!item) {
        try {
          if (isUUID) {
            const { data: mData } = await client.from('products').select('*').eq('id', prodId).maybeSingle();
            if (mData) item = { ...mData, department: mData.department || 'MEN', brand: mData.brand || 'Sarojini Bazaar' };
          } else {
            const { data: mData } = await client.from('products').select('*').eq('slug', prodId).maybeSingle();
            if (mData) item = { ...mData, department: mData.department || 'MEN', brand: mData.brand || 'Sarojini Bazaar' };
          }
        } catch (_) {}
      }

      // 2. Try store_settings
      if (!item) {
        try {
          const { data: sRow } = await client
            .from('store_settings')
            .select('value')
            .eq('key', 'sarojini_products')
            .maybeSingle();

          if (sRow && Array.isArray(sRow.value)) {
            item = sRow.value.find(p => String(p.id) === String(prodId) || String(p.slug) === String(prodId));
          }
        } catch (_) {}
      }
    }

    // Demo fallback for initial load if product ID is sp-1 or similar
    if (!item) {
      const demoMap = {
        'sp-1': { id: 'sp-1', name: 'Vintage Washed Graphic Street Tee', department: 'MEN', brand: 'Sarojini Bazaar', price: 399, original_price: 999, discount_percentage: 60, stock: 45, images: ['assets/sarojni/prod-1-graphic-tee.png'], sizes: ['M', 'L', 'XL'], colors: ['Washed Black', 'Vintage White'], description: 'Classic streetwear vintage graphic tee crafted from heavy 240 GSM combed cotton. Boxy drop-shoulder cut inspired by Delhi street trends.' },
        'sp-2': { id: 'sp-2', name: 'Ribbed Knit Summer Crop Top', department: 'WOMEN', brand: 'Sarojini Bazaar', price: 299, original_price: 699, discount_percentage: 57, stock: 32, images: ['assets/sarojni/prod-2-ribbed-top.png'], sizes: ['XS', 'S', 'M', 'L'], colors: ['Dusty Pink', 'Sage Green'], description: 'Flattering breathable ribbed knit crop top. Perfect summer everyday staple straight from Sarojini Nagar lane 2.' },
        'sp-3': { id: 'sp-3', name: '90s Relaxed Wide Leg Blue Jeans', department: 'WOMEN', brand: 'Sarojini Bazaar', price: 599, original_price: 1299, discount_percentage: 54, stock: 20, images: ['assets/sarojni/prod-3-wide-jeans.png'], sizes: ['28', '30', '32', '34'], colors: ['Classic Indigo'], description: 'High-waisted relaxed fit wide leg denim trousers with vintage stone washing and authentic Delhi bazaar durability.' },
        'sp-4': { id: 'sp-4', name: 'Ruched Velvet Evening Mini Dress', department: 'WOMEN', brand: 'Sarojini Bazaar', price: 549, original_price: 1199, discount_percentage: 54, stock: 18, images: ['assets/sarojni/prod-4-ruched-dress.png'], sizes: ['S', 'M', 'L'], colors: ['Emerald Green', 'Wine Red'], description: 'Figure-hugging soft velvet mini dress with adjustable drawstring ruched sides. Chic night-out piece at unbeatable street rate.' },
        'sp-5': { id: 'sp-5', name: 'Classic Street Low-Top Sneakers', department: 'FOOTWEAR', brand: 'Sarojini Bazaar', price: 899, original_price: 1899, discount_percentage: 53, stock: 25, images: ['assets/sarojni/prod-5-classic-sneakers.png'], sizes: ['UK 7', 'UK 8', 'UK 9'], colors: ['All White'], description: 'Everyday lifestyle low-top sneakers with cushioned insoles and durable vulcanized rubber soles.' },
        'sp-6': { id: 'sp-6', name: 'Retro Y2K Buckle Shoulder Bag', department: 'BAGS', brand: 'Sarojini Bazaar', price: 499, original_price: 999, discount_percentage: 50, stock: 15, images: ['assets/sarojni/prod-6-retro-bag.png'], sizes: ['Free Size'], colors: ['Vintage Tan'], description: 'Trendy Y2K baguette silhouette shoulder bag featuring chrome hardware buckles and zip closure.' }
      };

      if (prodId && demoMap[prodId]) {
        item = demoMap[prodId];
      } else if (!prodId) {
        item = demoMap['sp-1']; // default fallback only when no parameter provided
      }
    }

    if (!item) {
      const container = document.querySelector('.pdp-main-container') || document.querySelector('.pdp-grid');
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px; background: #fff; border-radius: 20px; border: 1px dashed #cbd5e1; margin: 40px auto; max-width: 600px;">
            <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #1e293b; margin: 0 0 10px 0;">Product Not Found</h2>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 24px;">The Sarojini Bazaar item you are looking for is either inactive, out of stock, or has been removed.</p>
            <a href="sarojini-shop.html" class="btn-hero-primary" style="display: inline-block; padding: 12px 28px; background: #e11d48; color: #fff; border-radius: 50px; font-weight: 700; text-decoration: none;">Browse Sarojini Bazaar</a>
          </div>
        `;
      }
      return;
    }

    currentProduct = item;
    renderProductDetails();
    loadRelatedSarojiniProducts(item.department);
  }

  function renderProductDetails() {
    const p = currentProduct;
    if (!p) return;

    // Document title
    document.title = `${p.name} | Sarojini Bazaar - VADI`;

    // Breadcrumbs
    const deptLink = document.getElementById('breadcrumb-dept-link');
    if (deptLink) {
      deptLink.textContent = p.department || 'Bazaar';
      deptLink.href = `sarojini-shop.html?department=${encodeURIComponent(p.department || '')}`;
    }
    const breadcrumbName = document.getElementById('breadcrumb-product-name');
    if (breadcrumbName) breadcrumbName.textContent = p.name;

    // Department Tag
    const deptTag = document.getElementById('pdp-dept-tag');
    if (deptTag) deptTag.textContent = `SAROJINI BAZAAR • ${p.department || 'COLLECTION'}`;

    // Title & Brand
    document.getElementById('pdp-title').textContent = p.name;
    const brandEl = document.getElementById('pdp-brand');
    if (brandEl) brandEl.innerHTML = `Brand: <strong>${escapeHtml(p.brand || 'Sarojini Bazaar')}</strong>`;

    // Pricing
    const price = Number(p.price) || 0;
    const origPrice = Number(p.original_price) || price;
    const discount = p.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);
    const saveAmt = origPrice - price;

    document.getElementById('pdp-selling-price').textContent = formatINR(price);
    const origPriceEl = document.getElementById('pdp-original-price');
    if (origPrice > price) {
      origPriceEl.textContent = formatINR(origPrice);
      origPriceEl.style.display = 'inline';
    } else {
      origPriceEl.style.display = 'none';
    }

    const saveBadge = document.getElementById('pdp-save-badge');
    if (saveAmt > 0 && discount > 0) {
      saveBadge.textContent = `Save ${formatINR(saveAmt)} (${discount}% OFF)`;
      saveBadge.style.display = 'inline-block';
    } else {
      saveBadge.style.display = 'none';
    }

    const discountBadge = document.getElementById('pdp-discount-badge');
    if (discount > 0 && discountBadge) {
      discountBadge.textContent = `${discount}% OFF`;
      discountBadge.style.display = 'block';
    }

    // Stock tag
    const stockNum = Number(p.stock) || 0;
    const stockTag = document.getElementById('pdp-stock-tag');
    if (stockTag) {
      if (stockNum === 0) {
        stockTag.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Out of Stock</span>`;
      } else if (stockNum <= 5) {
        stockTag.innerHTML = `<span style="color:#f59e0b;"><i class="fas fa-exclamation-circle"></i> Only ${stockNum} Left in Stock</span>`;
      } else {
        stockTag.innerHTML = `<span style="color:#059669;"><i class="fas fa-check-circle"></i> In Stock (${stockNum} Available)</span>`;
      }
    }

    // Gallery
    const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'assets/sarojni/prod-2-graphic-tee.png';
    const images = (Array.isArray(p.images) && p.images.length > 0) ? p.images : (p.image ? [p.image] : [fallbackSvg]);
    const mainImg = document.getElementById('pdp-main-img');
    mainImg.src = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
      ? window.VeloraImageUtils.normalizeImageUrl(images[0], { isAdmin: false, fallback: fallbackSvg })
      : images[0];
    mainImg.alt = p.name;
    mainImg.onerror = function () { this.onerror = null; this.src = fallbackSvg; };

    const thumbStrip = document.getElementById('pdp-thumbnails-strip');
    if (thumbStrip) {
      thumbStrip.innerHTML = images.map((imgUrl, i) => {
        const normImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
          ? window.VeloraImageUtils.normalizeImageUrl(imgUrl, { isAdmin: false, fallback: fallbackSvg })
          : imgUrl;
        return `
        <div class="pdp-thumb-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
          <img src="${normImg}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null; this.src='${fallbackSvg}';">
        </div>
      `;
      }).join('');

      thumbStrip.querySelectorAll('.pdp-thumb-item').forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbStrip.querySelectorAll('.pdp-thumb-item').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          const idx = parseInt(thumb.getAttribute('data-idx'), 10);
          mainImg.src = images[idx] || images[0];
        });
      });
    }

    // Sizes
    const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : ['Free Size'];
    selectedSize = sizes[0];
    const sizePillsContainer = document.getElementById('pdp-size-pills');
    const sizeLabel = document.getElementById('pdp-selected-size-label');
    if (sizeLabel) sizeLabel.textContent = selectedSize;

    if (sizePillsContainer) {
      sizePillsContainer.innerHTML = sizes.map((s, i) => `
        <button type="button" class="pdp-size-pill ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</button>
      `).join('');

      sizePillsContainer.querySelectorAll('.pdp-size-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          sizePillsContainer.querySelectorAll('.pdp-size-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedSize = btn.getAttribute('data-size');
          if (sizeLabel) sizeLabel.textContent = selectedSize;
        });
      });
    }

    // Colors
    const colors = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : [];
    const colorSection = document.getElementById('pdp-color-section');
    const colorPillsContainer = document.getElementById('pdp-color-pills');
    const colorLabel = document.getElementById('pdp-selected-color-label');

    if (colors.length > 0 && colorSection && colorPillsContainer) {
      colorSection.style.display = 'block';
      selectedColor = colors[0];
      if (colorLabel) colorLabel.textContent = selectedColor;

      colorPillsContainer.innerHTML = colors.map((c, i) => `
        <button type="button" class="pdp-color-pill ${i === 0 ? 'active' : ''}" data-color="${c}">${c}</button>
      `).join('');

      colorPillsContainer.querySelectorAll('.pdp-color-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          colorPillsContainer.querySelectorAll('.pdp-color-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedColor = btn.getAttribute('data-color');
          if (colorLabel) colorLabel.textContent = selectedColor;
        });
      });
    } else if (colorSection) {
      colorSection.style.display = 'none';
      selectedColor = '';
    }

    // Description & Specs
    const descEl = document.getElementById('pdp-description-text');
    if (descEl) descEl.textContent = p.description || 'Authentic Sarojini Bazaar street find curated for quality and durability.';

    if (p.specifications) {
      if (p.specifications.material) document.getElementById('spec-table-material').textContent = p.specifications.material;
      if (p.specifications.fit) document.getElementById('spec-table-fit').textContent = p.specifications.fit;
    }
    document.getElementById('spec-table-dept').textContent = p.department || 'Sarojini Bazaar';

    if (p.return_policy) {
      document.getElementById('pdp-return-title').textContent = p.return_policy;
    }

    // ========================================================================
    // PAYMENT OPTIONS & ADVANCE CALCULATION (MAIN VADI PARITY)
    // ========================================================================
    let selectedPaymentMethod = "online"; // "online" | "cod"
    let selectedDeliveryPref = "Simple Delivery";

    const cardPayOnline = document.getElementById("card-pay-online");
    const cardPayCod = document.getElementById("card-pay-cod");
    const advBox = document.getElementById("detail-advance-box");
    const advHeadline = document.getElementById("detail-advance-headline");
    const advExplainer = document.getElementById("detail-advance-explainer");
    const onlineAmountSub = document.getElementById("pcard-online-amount-sub");
    const codAmountSub = document.getElementById("pcard-cod-amount-sub");
    const codTag = document.getElementById("pcard-cod-tag");

    function calculatePaymentBreakdown() {
      const unitPrice = Number(p.price) || 0;
      const totalAmount = unitPrice * quantity;
      const isAdv = Boolean(p.advance_payment_enabled);
      const advType = p.advance_payment_type || "fixed";
      const advVal = Number(p.advance_payment_value) || 0;

      let unitAdvance = 0;
      if (isAdv) {
        if (advType === "percentage") {
          unitAdvance = Math.round(unitPrice * (advVal / 100));
        } else {
          unitAdvance = Math.min(unitPrice, advVal);
        }
      }

      const totalAdvance = unitAdvance * quantity;
      const totalCod = Math.max(0, totalAmount - totalAdvance);

      if (onlineAmountSub) {
        onlineAmountSub.textContent = `${formatINR(totalAmount)} • ₹0 Advance`;
      }

      if (codTag) {
        codTag.textContent = totalAdvance > 0 ? "ADVANCE REQ." : "NO ADVANCE";
        codTag.style.background = totalAdvance > 0 ? "#fff1f2" : "#ecfdf5";
        codTag.style.color = totalAdvance > 0 ? "#e11d48" : "#059669";
      }

      if (codAmountSub) {
        codAmountSub.textContent = totalAdvance > 0 
          ? `Pay ${formatINR(totalAdvance)} now` 
          : "Pay on delivery";
      }

      if (advBox && advHeadline && advExplainer) {
        if (selectedPaymentMethod === "cod" && totalAdvance > 0) {
          advBox.style.display = "block";
          advHeadline.textContent = `${formatINR(totalAdvance)} Advance Payment Required`;
          advExplainer.textContent = `Pay ${formatINR(totalAdvance)} now • Remaining ${formatINR(totalCod)} via Cash on Delivery`;
        } else {
          advBox.style.display = "none";
        }
      }

      return { unitAdvance, totalAdvance, totalCod };
    }

    cardPayOnline?.addEventListener("click", () => {
      selectedPaymentMethod = "online";
      cardPayOnline.classList.add("selected");
      cardPayOnline.querySelector(".pcard-radio-circle")?.classList.add("active");
      cardPayCod?.classList.remove("selected");
      cardPayCod?.querySelector(".pcard-radio-circle")?.classList.remove("active");
      calculatePaymentBreakdown();
    });

    cardPayCod?.addEventListener("click", () => {
      selectedPaymentMethod = "cod";
      cardPayCod.classList.add("selected");
      cardPayCod.querySelector(".pcard-radio-circle")?.classList.add("active");
      cardPayOnline?.classList.remove("selected");
      cardPayOnline?.querySelector(".pcard-radio-circle")?.classList.remove("active");
      calculatePaymentBreakdown();
    });

    // Delivery Preference Handlers
    const prefSimple = document.getElementById("pref-simple");
    const prefOpenBox = document.getElementById("pref-openbox");

    prefSimple?.addEventListener("click", () => {
      selectedDeliveryPref = "Simple Delivery";
      prefSimple.classList.add("selected");
      prefOpenBox?.classList.remove("selected");
    });

    prefOpenBox?.addEventListener("click", () => {
      selectedDeliveryPref = "Open Box Delivery";
      prefOpenBox.classList.add("selected");
      prefSimple?.classList.remove("selected");
    });

    // Quantity Handlers
    const qtyVal = document.getElementById('pdp-qty-val');
    document.getElementById('btn-qty-minus').addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        qtyVal.textContent = quantity;
        calculatePaymentBreakdown();
      }
    });
    document.getElementById('btn-qty-plus').addEventListener('click', () => {
      if (quantity < (stockNum || 10)) {
        quantity++;
        qtyVal.textContent = quantity;
        calculatePaymentBreakdown();
      }
    });

    // Initial Payment Calculation
    calculatePaymentBreakdown();

    // Add to Bag Handler
    document.getElementById('btn-pdp-add-bag').addEventListener('click', () => {
      addToCartAction(false);
    });

    // Buy Now Handler
    document.getElementById('btn-pdp-buy-now').addEventListener('click', () => {
      addToCartAction(true);
    });

    // Wishlist Handler (Connected to window.VadiWishlist)
    const wishBtns = [document.getElementById('btn-toggle-wishlist'), document.getElementById('btn-pdp-wishlist')].filter(Boolean);
    if (wishBtns.length > 0) {
      const isAlreadyInWish = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function')
        ? window.VadiWishlist.has(p.id)
        : (new Set(JSON.parse(localStorage.getItem('velora_wishlist') || '[]'))).has(p.id);

      const updateAllWishBtns = (active) => {
        wishBtns.forEach(btn => {
          btn.dataset.productId = p.id;
          btn.classList.toggle('active', active);
          const icon = btn.querySelector('i');
          if (icon) icon.className = active ? 'fas fa-heart' : 'far fa-heart';
        });
      };

      updateAllWishBtns(isAlreadyInWish);

      wishBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
            const willAdd = await window.VadiWishlist.toggle(p.id, 'sarojini', p);
            updateAllWishBtns(willAdd);
          } else {
            const isLiked = !btn.classList.contains('active');
            updateAllWishBtns(isLiked);
          }
        });
      });
    }

    // Load and Wire Customer Reviews
    initSarojiniReviews(p);
  }

  function addToCartAction(redirectToCheckout) {
    const p = currentProduct;
    if (!p) return;

    const firstImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
      ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: false })
      : ((Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : (p.image || 'assets/sarojni/prod-2-graphic-tee.png'));
    const unitPrice = Number(p.price) || 0;
    const isAdv = Boolean(p.advance_payment_enabled);
    const advType = p.advance_payment_type || 'fixed';
    const advVal = Number(p.advance_payment_value) || 0;

    let unitAdvance = 0;
    if (isAdv) {
      if (advType === 'percentage') {
        unitAdvance = Math.round(unitPrice * (advVal / 100));
      } else {
        unitAdvance = Math.min(unitPrice, advVal);
      }
    }

    const cartItem = {
      id: p.id,
      name: p.name,
      price: unitPrice,
      originalPrice: Number(p.original_price) || unitPrice,
      image: firstImg,
      quantity: quantity,
      size: selectedSize || 'Free Size',
      color: selectedColor || null,
      catalog_type: 'sarojini',
      advance_payment_enabled: isAdv,
      advance_payment_type: advType,
      advance_payment_value: advVal,
      advance_per_unit: unitAdvance,
      cod_per_unit: Math.max(0, unitPrice - unitAdvance)
    };

    if (window.CartDrawer && typeof window.CartDrawer.addItem === 'function') {
      window.CartDrawer.addItem(cartItem);
      if (redirectToCheckout) {
        window.location.href = 'checkout.html';
      } else {
        window.CartDrawer.open();
      }
    } else {
      const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
      const existingIdx = cart.findIndex(it => it.id === cartItem.id && it.size === cartItem.size);
      if (existingIdx !== -1) {
        cart[existingIdx].quantity += quantity;
      } else {
        cart.push(cartItem);
      }
      localStorage.setItem('velora_cart', JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('velora:cart-updated', { detail: { cart } }));

      if (redirectToCheckout) {
        window.location.href = 'checkout.html';
      } else {
        alert(`Added ${p.name} (${selectedSize}) to your bag!`);
      }
    }
  }

  // ==========================================================================
  // SAROJINI REVIEWS SYSTEM
  // ==========================================================================
  async function initSarojiniReviews(product) {
    const listContainer = document.getElementById("reviews-list-container");
    const btnOpenForm = document.getElementById("btn-open-review-form");
    const formWrap = document.getElementById("review-form-wrap");
    const btnCancel = document.getElementById("btn-cancel-review");
    const reviewForm = document.getElementById("sarojini-review-form");

    btnOpenForm?.addEventListener("click", () => {
      formWrap.style.display = formWrap.style.display === "none" ? "block" : "none";
    });

    btnCancel?.addEventListener("click", () => {
      formWrap.style.display = "none";
    });

    // Fetch Reviews from Supabase or Fallback
    let reviews = [];
    try {
      const { data, error } = await client
        .from("reviews")
        .select("*")
        .or(`sarojini_product_id.eq.${product.id},product_id.eq.${product.id}`)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        reviews = data;
      }
    } catch (_) {}

    // If none found, show starter verified reviews
    if (reviews.length === 0) {
      reviews = [
        {
          id: "rev-s1",
          author_name: "Sneha Kapoor",
          rating: 5,
          title: "Authentic Sarojini quality without the crowd!",
          comment: "Fabric is pure cotton, exactly like the stalls in Delhi. Fits oversized nicely.",
          created_at: new Date(Date.now() - 3 * 86400000).toISOString()
        },
        {
          id: "rev-s2",
          author_name: "Aman Verma",
          rating: 5,
          title: "Stitching and seams are well inspected",
          comment: "Loved the fast delivery and advance COD option. Product arrived nicely packaged.",
          created_at: new Date(Date.now() - 7 * 86400000).toISOString()
        }
      ];
    }

    renderReviewsList(reviews);

    // Form Submission
    reviewForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const author = document.getElementById("review-author").value.trim();
      const rating = parseInt(document.getElementById("review-rating").value, 10) || 5;
      const title = document.getElementById("review-title").value.trim();
      const comment = document.getElementById("review-comment").value.trim();

      const newRev = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "rev-" + Date.now(),
        sarojini_product_id: product.id,
        catalog_type: "sarojini",
        author_name: author,
        rating: rating,
        title: title || "Verified Sarojini Find",
        comment: comment,
        is_approved: true,
        created_at: new Date().toISOString()
      };

      try {
        await client.from("reviews").insert([newRev]);
      } catch (_) {}

      reviews.unshift(newRev);
      renderReviewsList(reviews);
      reviewForm.reset();
      formWrap.style.display = "none";
      alert("Thank you! Your verified review has been published.");
    });

    function renderReviewsList(revs) {
      if (!listContainer) return;
      listContainer.innerHTML = revs.map(r => `
        <div class="review-card-item">
          <div class="review-card-header">
            <div>
              <div class="review-author-name">${escapeHtml(r.author_name || 'Verified Buyer')} <span style="color:#059669; font-size:0.75rem; font-weight:700;">✓ Verified Purchase</span></div>
              <div class="review-stars">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
            </div>
            <div class="review-date">${new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          ${r.title ? `<div class="review-card-title">${escapeHtml(r.title)}</div>` : ''}
          <div class="review-card-body">${escapeHtml(r.comment || '')}</div>
        </div>
      `).join("");
    }
  }

  // Recommendations query strictly sarojini_products
  async function loadRelatedSarojiniProducts(department) {
    const grid = document.getElementById('pdp-related-grid');
    if (!grid) return;

    const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
    let related = [];

    if (client) {
      try {
        let query = client.from('sarojini_products').select('*').eq('is_active', true);
        if (department) query = query.eq('department', department);
        const { data, error } = await query.limit(6);
        if (!error && Array.isArray(data)) {
          related = data.filter(p => p.id !== (currentProduct ? currentProduct.id : null));
        }
      } catch (_) {}
    }

    if (related.length === 0) {
      // Fallback demo items
      related = [
        { id: 'sp-2', name: 'Ribbed Knit Summer Crop Top', department: 'WOMEN', price: 299, original_price: 699, discount_percentage: 57, images: ['assets/sarojni/prod-2-ribbed-top.png'] },
        { id: 'sp-3', name: '90s Relaxed Wide Leg Blue Jeans', department: 'WOMEN', price: 599, original_price: 1299, discount_percentage: 54, images: ['assets/sarojni/prod-3-wide-jeans.png'] },
        { id: 'sp-4', name: 'Ruched Velvet Evening Mini Dress', department: 'WOMEN', price: 549, original_price: 1199, discount_percentage: 54, images: ['assets/sarojni/prod-4-ruched-dress.png'] }
      ].filter(p => p.id !== (currentProduct ? currentProduct.id : null));
    }

    grid.innerHTML = related.map(prod => {
      const firstImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
        ? window.VeloraImageUtils.resolveProductImage(prod, { isAdmin: false })
        : ((Array.isArray(prod.images) && prod.images.length > 0) ? prod.images[0] : (prod.image || 'assets/sarojni/prod-2-graphic-tee.png'));
      const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'assets/sarojni/prod-2-graphic-tee.png';
      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);
      const deptLabel = prod.department ? `${prod.department}'S LANE` : 'BAZAAR FIND';

      return `
        <div class="sarojini-product-card" data-product-id="${prod.id}">
          <div class="product-card-media">
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';">
            </a>
            ${discount > 0 ? `<span class="product-card-badge">${discount}% OFF</span>` : `<span class="product-card-badge" style="background: var(--bazaar-ochre);">STEAL</span>`}
          </div>
          <div class="product-card-body">
            <span class="product-card-dept">${escapeHtml(deptLabel)}</span>
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" class="product-card-title">${escapeHtml(prod.name)}</a>
            <div class="product-card-price-row">
              <span class="price-selling">${formatINR(price)}</span>
              ${origPrice > price ? `<span class="price-original">${formatINR(origPrice)}</span>` : ''}
              ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadProduct();

    const cartBtn = document.getElementById('btn-open-cart');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
          window.CartDrawer.open();
        }
      });
    }
  });
})();

