/**
 * VADI - Sarojini Bazaar Catalog Controller (sarojini-shop.js)
 * Manages URL parameter routing, subcategory chips, multi-layered filters, sorting, and isolated Supabase data
 */

(function () {
  'use strict';

  function formatINR(amount) {
    if (typeof window.formatINR === 'function') return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  // State
  const state = {
    department: '',
    category: '',
    search: '',
    priceRange: '',
    minDiscount: 0,
    selectedSize: '',
    inStockOnly: true,
    sort: 'popular'
  };

  let allProducts = [];
  let allCategories = [];

  // DOM Elements
  let gridEl, countEl, breadcrumbCurrentEl, deptTabsEl, subcatChipsEl, searchInputEl;
  let sortSelectEl, filtersSidebarEl, btnMobileFilterEl, btnCloseMobileFilterEl, btnResetFiltersEl;

  function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    state.department = (params.get('department') || '').toUpperCase();
    state.category = params.get('category') || '';
    state.search = params.get('search') || '';
    
    if (params.get('max_price')) {
      const maxP = parseInt(params.get('max_price'), 10);
      if (maxP === 199) state.priceRange = '0-199';
      else if (maxP === 299) state.priceRange = '0-299';
      else if (maxP === 499) state.priceRange = '299-499';
    }

    if (params.get('min_discount')) {
      state.minDiscount = parseInt(params.get('min_discount'), 10) || 0;
    }

    if (params.get('sort')) {
      state.sort = params.get('sort');
    }
  }

  // Update UI to match current state
  function syncStateToUI() {
    // 1. Department Tabs
    deptTabsEl.querySelectorAll('.catalog-dept-btn').forEach(btn => {
      const btnDept = (btn.getAttribute('data-dept') || '').toUpperCase();
      if (btnDept === state.department) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Breadcrumbs
    if (state.department) {
      let catName = state.category;
      if (state.category && Array.isArray(allCategories) && allCategories.length > 0) {
        const foundCat = allCategories.find(c =>
          String(c.id).toLowerCase() === state.category.toLowerCase() ||
          (c.slug && c.slug.toLowerCase() === state.category.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === state.category.toLowerCase())
        );
        if (foundCat) catName = foundCat.name;
      }
      breadcrumbCurrentEl.textContent = catName 
        ? `${state.department} / ${catName}` 
        : `${state.department} Collection`;
    } else if (state.search) {
      breadcrumbCurrentEl.textContent = `Search: "${state.search}"`;
    } else {
      breadcrumbCurrentEl.textContent = 'All Sarojini Finds';
    }

    // 3. Search Input
    if (searchInputEl) searchInputEl.value = state.search;

    // 4. Sort select
    if (sortSelectEl) sortSelectEl.value = state.sort;

    // 5. Price radio
    document.querySelectorAll('input[name="price-filter"]').forEach(radio => {
      radio.checked = radio.value === state.priceRange;
    });

    // 6. Discount radio
    document.querySelectorAll('input[name="discount-filter"]').forEach(radio => {
      radio.checked = Number(radio.value) === state.minDiscount;
    });

    // 7. Subcategory Chips
    renderSubcategoryChips();
  }

  // Render Subcategory Chips when department changes
  function renderSubcategoryChips() {
    if (!state.department) {
      subcatChipsEl.style.display = 'none';
      return;
    }

    const deptCats = allCategories.filter(c => (c.department || '').toUpperCase() === state.department);
    if (deptCats.length === 0) {
      subcatChipsEl.style.display = 'none';
      return;
    }

    subcatChipsEl.style.display = 'flex';
    let html = `
      <button type="button" class="subcat-chip-btn ${!state.category ? 'active' : ''}" data-cat="">
        All ${state.department}
      </button>
    `;

    deptCats.forEach(c => {
      const slug = c.slug || c.id;
      const isAct = state.category.toLowerCase() === slug.toLowerCase() || state.category.toLowerCase() === c.name.toLowerCase();
      html += `
        <button type="button" class="subcat-chip-btn ${isAct ? 'active' : ''}" data-cat="${slug}">
          ${c.name}
        </button>
      `;
    });

    subcatChipsEl.innerHTML = html;

    subcatChipsEl.querySelectorAll('.subcat-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.getAttribute('data-cat') || '';
        syncStateToUI();
        applyFiltersAndRender();
        updateURLParams();
      });
    });
  }

  // Load Data from Supabase
  async function loadData() {
    const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);

    // 1. Categories
    try {
      if (client) {
        const { data } = await client.from('sarojini_categories').select('*').eq('is_active', true);
        if (Array.isArray(data) && data.length > 0) allCategories = data;
      }
    } catch (_) {}

    if (allCategories.length === 0 && client) {
      try {
        const { data: sRow } = await client.from('store_settings').select('value').eq('key', 'sarojini_categories').maybeSingle();
        if (sRow && Array.isArray(sRow.value)) allCategories = sRow.value;
      } catch (_) {}
    }

    // 2. Products (Strictly from sarojini_products)
    try {
      if (client) {
        const { data, error } = await client
          .from('sarojini_products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          allProducts = data;
        }
      }
    } catch (_) {}

    // 2.1 Cross-store: Load Main products assigned to Sarojini Bazaar
    if (client) {
      try {
        const { data: mSet } = await client
          .from('store_settings')
          .select('value')
          .eq('key', 'cross_store_mapping')
          .maybeSingle();

        if (mSet && mSet.value && mSet.value.main_available_in_sarojini) {
          const mapping = mSet.value.main_available_in_sarojini;
          const mainIds = Object.keys(mapping).filter(id => mapping[id]?.available);
          if (mainIds.length > 0) {
            const { data: crossMain } = await client
              .from('products')
              .select('*')
              .in('id', mainIds)
              .eq('is_active', true);
            if (Array.isArray(crossMain)) {
              crossMain.forEach(mp => {
                const conf = mapping[mp.id] || {};
                allProducts.push({
                  ...mp,
                  department: conf.department || 'MEN',
                  category_id: conf.category_id || mp.category_id,
                  category_slug: conf.category_slug || null,
                  brand: mp.brand || 'Sarojini Bazaar',
                  is_featured: (conf.is_featured !== undefined) ? conf.is_featured : mp.is_featured
                });
              });
            }
          }
        }
      } catch (_) {}
    }

    // Fallback to store_settings if table empty
    if (allProducts.length === 0 && client) {
      try {
        const { data: sRow } = await client.from('store_settings').select('value').eq('key', 'sarojini_products').maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          allProducts = sRow.value.filter(p => p.is_active !== false);
        }
      } catch (_) {}
    }

    // If still 0 products, seed default curated products for display
    if (allProducts.length === 0) {
      allProducts = [
        {
          id: 'sp-1',
          name: 'Vintage Washed Graphic Street Tee',
          department: 'MEN',
          category_slug: 'men-t-shirts',
          brand: 'Sarojini Bazaar',
          price: 399,
          original_price: 999,
          discount_percentage: 60,
          stock: 45,
          images: ['assets/sarojni/prod-1-graphic-tee.png'],
          sizes: ['M', 'L', 'XL'],
          is_featured: true,
          is_new: true,
          is_active: true
        },
        {
          id: 'sp-2',
          name: 'Ribbed Knit Summer Crop Top',
          department: 'WOMEN',
          category_slug: 'women-tops',
          brand: 'Sarojini Bazaar',
          price: 299,
          original_price: 699,
          discount_percentage: 57,
          stock: 32,
          images: ['assets/sarojni/prod-2-ribbed-top.png'],
          sizes: ['XS', 'S', 'M', 'L'],
          is_featured: true,
          is_deal: true,
          is_active: true
        },
        {
          id: 'sp-3',
          name: '90s Relaxed Wide Leg Blue Jeans',
          department: 'WOMEN',
          category_slug: 'women-jeans',
          brand: 'Sarojini Bazaar',
          price: 599,
          original_price: 1299,
          discount_percentage: 54,
          stock: 20,
          images: ['assets/sarojni/prod-3-wide-jeans.png'],
          sizes: ['28', '30', '32', '34'],
          is_featured: true,
          is_active: true
        },
        {
          id: 'sp-4',
          name: 'Ruched Velvet Evening Mini Dress',
          department: 'WOMEN',
          category_slug: 'women-dresses',
          brand: 'Sarojini Bazaar',
          price: 549,
          original_price: 1199,
          discount_percentage: 54,
          stock: 18,
          images: ['assets/sarojni/prod-4-ruched-dress.png'],
          sizes: ['S', 'M', 'L'],
          is_deal: true,
          is_active: true
        },
        {
          id: 'sp-5',
          name: 'Classic Street Low-Top Sneakers',
          department: 'FOOTWEAR',
          category_slug: 'footwear-sneakers',
          brand: 'Sarojini Bazaar',
          price: 899,
          original_price: 1899,
          discount_percentage: 53,
          stock: 25,
          images: ['assets/sarojni/prod-5-classic-sneakers.png'],
          sizes: ['UK 7', 'UK 8', 'UK 9'],
          is_featured: true,
          is_active: true
        },
        {
          id: 'sp-6',
          name: 'Retro Y2K Buckle Shoulder Bag',
          department: 'BAGS',
          category_slug: 'bags-shoulder',
          brand: 'Sarojini Bazaar',
          price: 499,
          original_price: 999,
          discount_percentage: 50,
          stock: 15,
          images: ['assets/sarojni/prod-6-retro-bag.png'],
          sizes: ['Free Size'],
          is_deal: true,
          is_active: true
        }
      ];
    }

    syncStateToUI();
    applyFiltersAndRender();
  }

  // Filter & Sort Logic
  function applyFiltersAndRender() {
    let list = allProducts.filter(p => {
      // 1. Department
      if (state.department && (p.department || '').toUpperCase() !== state.department) {
        return false;
      }

      // 2. Category
      if (state.category) {
        const targetCat = Array.isArray(allCategories) ? allCategories.find(c =>
          String(c.id).toLowerCase() === state.category.toLowerCase() ||
          (c.slug && c.slug.toLowerCase() === state.category.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === state.category.toLowerCase())
        ) : null;

        if (targetCat) {
          const pCatId = String(p.category_id || '').toLowerCase();
          const pSubId = String(p.subcategory_id || '').toLowerCase();
          const pCatSlug = String(p.category_slug || '').toLowerCase();
          const targetId = String(targetCat.id).toLowerCase();
          const targetSlug = String(targetCat.slug || '').toLowerCase();

          const matches = (pCatId && pCatId === targetId) ||
                          (pSubId && pSubId === targetId) ||
                          (targetSlug && pCatSlug === targetSlug);
          if (!matches) return false;
        } else {
          const pCat = String(p.category_slug || p.category_id || '').toLowerCase();
          if (!pCat.includes(state.category.toLowerCase())) return false;
        }
      }

      // 3. Keyword Search
      if (state.search) {
        const q = state.search.toLowerCase();
        const mName = p.name && p.name.toLowerCase().includes(q);
        const mSlug = p.slug && p.slug.toLowerCase().includes(q);
        const mBrand = p.brand && p.brand.toLowerCase().includes(q);
        const mDept = p.department && p.department.toLowerCase().includes(q);
        if (!mName && !mSlug && !mBrand && !mDept) return false;
      }

      // 4. Price range
      if (state.priceRange) {
        const [minStr, maxStr] = state.priceRange.split('-');
        const minVal = parseFloat(minStr) || 0;
        const maxVal = parseFloat(maxStr) || 999999;
        const pPrice = Number(p.price) || 0;
        if (pPrice < minVal || pPrice > maxVal) return false;
      }

      // 5. Min discount
      if (state.minDiscount > 0) {
        const disc = p.discount_percentage || 0;
        if (disc < state.minDiscount) return false;
      }

      // 6. Size
      if (state.selectedSize) {
        const sizes = Array.isArray(p.sizes) ? p.sizes : [];
        if (!sizes.includes(state.selectedSize) && !sizes.includes('Free Size')) return false;
      }

      // 7. Stock
      if (state.inStockOnly && (Number(p.stock) || 0) <= 0) {
        return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      const pA = Number(a.price) || 0;
      const pB = Number(b.price) || 0;
      const dA = Number(a.discount_percentage) || 0;
      const dB = Number(b.discount_percentage) || 0;

      switch (state.sort) {
        case 'price-asc': return pA - pB;
        case 'price-desc': return pB - pA;
        case 'discount': return dB - dA;
        case 'newest': return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'popular':
        default:
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return pA - pB;
      }
    });

    countEl.textContent = list.length;
    renderGrid(list);
  }

  function renderGrid(products) {
    if (products.length === 0) {
      gridEl.innerHTML = `
        <div class="sarojini-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #fff; border-radius: 18px; border: 1px dashed #cbd5e1;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🛍️</div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0 0 6px 0;">No Sarojini Finds Found</h3>
          <p style="color: #64748b; font-size: 0.9rem; max-width: 420px; margin: 0 auto 20px auto;">
            Try adjusting your search query, price filter, or department selection to see more products.
          </p>
          <button type="button" class="btn-hero-primary" id="empty-reset-btn" style="padding: 10px 24px; font-size: 0.88rem; cursor: pointer;">
            Reset All Filters
          </button>
        </div>
      `;

      const rBtn = document.getElementById('empty-reset-btn');
      if (rBtn) {
        rBtn.addEventListener('click', resetAllFilters);
      }
      return;
    }

    gridEl.innerHTML = products.map(prod => {
      const firstImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
        ? window.VeloraImageUtils.resolveProductImage(prod, { isAdmin: false })
        : ((Array.isArray(prod.images) && prod.images.length > 0) ? prod.images[0] : (prod.image || 'assets/sarojni/prod-2-graphic-tee.png'));
      const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'assets/sarojni/prod-2-graphic-tee.png';
      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);
      const isWishlisted = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function')
        ? window.VadiWishlist.has(prod.id)
        : false;

      const stockCount = Number(prod.stock);
      const isLowStock = !isNaN(stockCount) && stockCount > 0 && stockCount <= 5;
      const stockBadge = isLowStock ? `<span class="product-card-stock-tag">Only ${stockCount} left</span>` : '';
      const deptLabel = prod.department ? `${prod.department}'S LANE` : 'BAZAAR FIND';

      return `
        <div class="sarojini-product-card" data-product-id="${prod.id}">
          <div class="product-card-media">
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';">
            </a>
            ${discount > 0 ? `<span class="product-card-badge">${discount}% OFF</span>` : `<span class="product-card-badge" style="background: var(--bazaar-ochre);">STEAL</span>`}
            ${stockBadge}
            <button type="button" class="product-card-wishlist ${isWishlisted ? 'active' : ''}" data-prod-id="${prod.id}" aria-label="Save to Wishlist">
              <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
            </button>
          </div>
          <div class="product-card-body">
            <span class="product-card-dept">${escapeHtml(deptLabel)}</span>
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" class="product-card-title">${escapeHtml(prod.name)}</a>
            <div class="product-card-price-row">
              <span class="price-selling">${formatINR(price)}</span>
              ${origPrice > price ? `<span class="price-original">${formatINR(origPrice)}</span>` : ''}
              ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
            </div>
            <button type="button" class="btn-card-add-bag" data-prod-id="${prod.id}" data-prod-name="${encodeURIComponent(prod.name)}" data-prod-price="${price}" data-prod-img="${encodeURIComponent(firstImg)}">
              <i class="fas fa-shopping-bag"></i>
              <span>Add to Bag</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire Wishlist
    gridEl.querySelectorAll('.product-card-wishlist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prodId = btn.getAttribute('data-prod-id');
        const prod = allProducts.find(p => String(p.id) === String(prodId));
        if (window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
          window.VadiWishlist.toggle(prodId, 'sarojini', prod);
          const isNowActive = window.VadiWishlist.has(prodId);
          btn.classList.toggle('active', isNowActive);
          const icon = btn.querySelector('i');
          if (icon) {
            icon.className = isNowActive ? 'fas fa-heart' : 'far fa-heart';
          }
        } else {
          const icon = btn.querySelector('i');
          const isLiked = btn.classList.toggle('active');
          if (icon) {
            icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
          }
        }
      });
    });

    // Wire Add to Bag
    gridEl.querySelectorAll('.btn-card-add-bag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const prodId = btn.getAttribute('data-prod-id');
        const prodName = decodeURIComponent(btn.getAttribute('data-prod-name'));
        const prodPrice = Number(btn.getAttribute('data-prod-price'));
        const prodImg = decodeURIComponent(btn.getAttribute('data-prod-img'));

        const itemPayload = {
          id: prodId,
          name: prodName,
          price: prodPrice,
          image: prodImg,
          quantity: 1,
          catalog_type: 'sarojini'
        };

        if (window.CartDrawer && typeof window.CartDrawer.addItem === 'function') {
          window.CartDrawer.addItem(itemPayload);
          window.CartDrawer.open();
        } else {
          const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
          const existing = cart.find(i => String(i.id) === String(prodId) && i.catalog_type === 'sarojini');
          if (existing) {
            existing.quantity = (Number(existing.quantity) || 1) + 1;
          } else {
            cart.push(itemPayload);
          }
          localStorage.setItem('velora_cart', JSON.stringify(cart));
          window.dispatchEvent(new CustomEvent('velora:cart-updated', { detail: { cart } }));
        }

        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> <span>Added!</span>';
        setTimeout(() => {
          btn.innerHTML = origText;
        }, 1500);
      });
    });
  }

  function resetAllFilters() {
    state.department = '';
    state.category = '';
    state.search = '';
    state.priceRange = '';
    state.minDiscount = 0;
    state.selectedSize = '';
    state.sort = 'popular';
    
    document.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    syncStateToUI();
    applyFiltersAndRender();
    updateURLParams();
  }

  function updateURLParams() {
    const params = new URLSearchParams();
    if (state.department) params.set('department', state.department);
    if (state.category) params.set('category', state.category);
    if (state.search) params.set('search', state.search);
    if (state.priceRange) {
      const parts = state.priceRange.split('-');
      if (parts[1]) params.set('max_price', parts[1]);
    }
    if (state.minDiscount) params.set('min_discount', state.minDiscount);
    if (state.sort && state.sort !== 'popular') params.set('sort', state.sort);

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    gridEl = document.getElementById('catalog-products-grid');
    countEl = document.getElementById('results-count-number');
    breadcrumbCurrentEl = document.getElementById('catalog-breadcrumb-current');
    deptTabsEl = document.getElementById('catalog-dept-tabs');
    subcatChipsEl = document.getElementById('subcat-chips-bar');
    searchInputEl = document.getElementById('catalog-search-input');
    sortSelectEl = document.getElementById('catalog-sort-select');
    filtersSidebarEl = document.getElementById('catalog-filters-sidebar');
    btnMobileFilterEl = document.getElementById('btn-toggle-filters-mobile');
    btnCloseMobileFilterEl = document.getElementById('btn-close-filters-mobile');
    btnResetFiltersEl = document.getElementById('btn-reset-filters');

    parseQueryParams();

    // Wire Department Tabs
    deptTabsEl.querySelectorAll('.catalog-dept-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.department = (btn.getAttribute('data-dept') || '').toUpperCase();
        state.category = '';
        syncStateToUI();
        applyFiltersAndRender();
        updateURLParams();
      });
    });

    // Wire Search Input
    if (searchInputEl) {
      searchInputEl.addEventListener('input', () => {
        state.search = searchInputEl.value.trim();
        applyFiltersAndRender();
        updateURLParams();
      });
    }

    // Wire Sort Select
    if (sortSelectEl) {
      sortSelectEl.addEventListener('change', () => {
        state.sort = sortSelectEl.value;
        applyFiltersAndRender();
        updateURLParams();
      });
    }

    // Wire Price Filter Radios
    document.querySelectorAll('input[name="price-filter"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          state.priceRange = radio.value;
          applyFiltersAndRender();
          updateURLParams();
        }
      });
    });

    // Wire Discount Filter Radios
    document.querySelectorAll('input[name="discount-filter"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          state.minDiscount = parseInt(radio.value, 10) || 0;
          applyFiltersAndRender();
          updateURLParams();
        }
      });
    });

    // Wire Size Chips
    document.querySelectorAll('.size-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.getAttribute('data-size');
        if (state.selectedSize === s) {
          state.selectedSize = '';
          btn.classList.remove('active');
        } else {
          document.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
          state.selectedSize = s;
          btn.classList.add('active');
        }
        applyFiltersAndRender();
      });
    });

    // Wire In-Stock Checkbox
    const inStockCheck = document.getElementById('filter-in-stock-only');
    if (inStockCheck) {
      inStockCheck.addEventListener('change', () => {
        state.inStockOnly = inStockCheck.checked;
        applyFiltersAndRender();
      });
    }

    // Wire Reset Button
    if (btnResetFiltersEl) {
      btnResetFiltersEl.addEventListener('click', resetAllFilters);
    }

    // Mobile Filter Drawer Toggle
    if (btnMobileFilterEl && filtersSidebarEl) {
      btnMobileFilterEl.addEventListener('click', () => {
        filtersSidebarEl.classList.add('open');
      });
    }
    if (btnCloseMobileFilterEl && filtersSidebarEl) {
      btnCloseMobileFilterEl.addEventListener('click', () => {
        filtersSidebarEl.classList.remove('open');
      });
    }

    loadData();
  });
})();

