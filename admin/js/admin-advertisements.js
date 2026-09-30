/**
 * VELORA & Sarojini Bazaar - Admin Advertisement Management Controller
 * Fully dynamic campaign CRUD with dual-store identity (VADI & Sarojini),
 * cross-store promotions, live desktop/mobile preview, product/category linking,
 * scheduling, and dual-layer Supabase persistence.
 */

(function () {
  'use strict';

  let allAds = [];
  let isMobilePreview = false;
  let client = null;

  // Cached product & category lists for dynamic destination linking
  let vadiProducts = [];
  let sarojiniProducts = [];
  let vadiCategories = [];
  const SAROJINI_DEPARTMENTS = [
    { id: "WOMEN", name: "Women's Lane" },
    { id: "MEN", name: "Men's Lane" },
    { id: "ACCESSORIES", name: "Accessories Corner" },
    { id: "FOOTWEAR", name: "Sneaker Street" },
    { id: "BAGS", name: "Bag Corner" },
    { id: "JEWELLERY", name: "Jewellery Lane" },
    { id: "CAPS", name: "Cap Corner" }
  ];

  const PLACEMENT_LABELS = {
    top_announcement: "Top Announcement Bar",
    hero: "Hero / Main Promotional Banner",
    below_hero: "Hero / Main Promotional Banner",
    between_sections_1: "Between Sections (Slot 1)",
    above_trending: "Between Sections (Slot 1)",
    between_sections_2: "Between Sections (Slot 2)",
    above_deals: "Between Sections (Slot 2)",
    below_bogo: "Between Sections (Slot 2)",
    above_new_arrivals: "Between Sections (Slot 2)",
    below_trending: "Between Sections (Slot 1)",
    below_new_arrivals: "Between Sections (Slot 2)",
    product_grid: "Product Grid Promo Card",
    category_page: "Category / Shop Top Banner",
    shop_top: "Category / Shop Top Banner",
    product_page: "Product Contextual Strip",
    product_contextual: "Product Contextual Strip",
    cart_checkout: "Cart / Checkout Offer",
    cart_drawer: "Cart / Checkout Offer",
    checkout_secure: "Cart / Checkout Offer",
    floating: "Floating Promo Card",
    auth_visual: "Authentication 3D Visual Card",
    wishlist_promo: "Wishlist Strip"
  };

  const DEFAULT_SEED_ADS = [
    // --- MAIN VALORA Store ADS ---
    {
      id: "ad-vadi-1",
      store: "vadi",
      is_cross_promotion: false,
      title: "WEEKEND LUXURY SALE — UP TO 40% OFF",
      subtitle: "Handcrafted couture & fine jewellery at celebratory prices",
      badge_text: "LIMITED TIME",
      ad_type: "top_announcement",
      placement: "top_announcement",
      target_pages: ["all"],
      image_url: "",
      cta_text: "Shop Now",
      cta_link: "shop.html",
      priority: 10,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-vadi-2",
      store: "vadi",
      is_cross_promotion: false,
      title: "VALORA ROYAL BOGO FESTIVAL",
      subtitle: "Select any 2 pieces from our master artisanal collection — the second piece is complimentary.",
      badge_text: "ROYAL PRIVILEGE",
      ad_type: "hero_banner",
      placement: "hero",
      target_pages: ["homepage", "shop"],
      image_url: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1400&q=80",
      cta_text: "Shop BOGO Collection",
      cta_link: "bogo.html",
      priority: 10,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-vadi-3",
      store: "vadi",
      is_cross_promotion: false,
      title: "THE CURATED TRENDING SUITE",
      subtitle: "Handpicked by our stylists. Explore this week's highest rated luxury ensembles.",
      badge_text: "MOST LOVED",
      ad_type: "section_banner",
      placement: "between_sections_1",
      target_pages: ["homepage"],
      image_url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80",
      cta_text: "Discover Styles",
      cta_link: "trending.html",
      priority: 8,
      sort_order: 1,
      is_active: true
    },

    // --- SAROJINI BAZAAR ADS ---
    {
      id: "ad-sarojini-1",
      store: "sarojini",
      is_cross_promotion: false,
      title: "🛍️ SAROJINI BAZAAR — DIRECT STREET RATES ACROSS INDIA",
      subtitle: "Authentic Delhi market bargains, surplus export pieces & daily drops.",
      badge_text: "BAZAAR RATES",
      ad_type: "top_announcement",
      placement: "top_announcement",
      target_pages: ["all", "sarojini"],
      image_url: "",
      cta_text: "Explore Finds →",
      cta_link: "sarojini-shop.html",
      priority: 10,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-sarojini-2",
      store: "sarojini",
      is_cross_promotion: false,
      title: "DELHI STREET EXPORT SURPLUS — UP TO 70% OFF",
      subtitle: "Handpicked export surplus, viral streetwear drops & authentic bargains delivered straight to your door.",
      badge_text: "🔥 70% OFF",
      ad_type: "hero_banner",
      placement: "hero",
      target_pages: ["homepage", "shop", "sarojini"],
      image_url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1400&q=80",
      cta_text: "Shop Bazaar Loot",
      cta_link: "sarojini-shop.html?min_discount=50",
      priority: 10,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-sarojini-3",
      store: "sarojini",
      is_cross_promotion: false,
      title: "UNDER ₹199 BAZAAR FINDS & STAPLES",
      subtitle: "Unbeatable Delhi street fashion, daily crop tops, and accessories under ₹199.",
      badge_text: "⚡ UNDER ₹199",
      ad_type: "section_banner",
      placement: "between_sections_1",
      target_pages: ["homepage", "sarojini"],
      image_url: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80",
      cta_text: "Grab Deals Under ₹199",
      cta_link: "sarojini-shop.html?max_price=199",
      priority: 9,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-sarojini-4",
      store: "sarojini",
      is_cross_promotion: false,
      title: "BUY 1 GET 1 & STREET COMBO DROPS",
      subtitle: "Pair up statement jewelry, shoulder bags, and oversized tees for extra savings.",
      badge_text: "🎁 COMBO LOOT",
      ad_type: "section_banner",
      placement: "between_sections_2",
      target_pages: ["homepage", "sarojini"],
      image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
      cta_text: "Explore Combos",
      cta_link: "sarojini-shop.html?department=ACCESSORIES",
      priority: 8,
      sort_order: 1,
      is_active: true
    }
  ];

  document.addEventListener("DOMContentLoaded", async () => {
    const admin = await window.AdminAuth.guardRoute();
    if (!admin) return;
    window.initLayout(admin);

    client = window.AdminAuth.getClient();
    setupEventListeners();
    await loadCatalogs();
    await loadAdvertisements();
  });

  function setupEventListeners() {
    // Modal openers/closers
    document.getElementById("btn-open-add-modal").addEventListener("click", () => openModal());
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);

    // Filter toolbar
    document.getElementById("filter-search").addEventListener("input", renderTable);
    document.getElementById("filter-store").addEventListener("change", renderTable);
    document.getElementById("filter-placement").addEventListener("change", renderTable);
    document.getElementById("filter-status").addEventListener("change", renderTable);

    // Form submission
    document.getElementById("ad-form").addEventListener("submit", handleFormSubmit);

    // Store radio change: toggle store visual styling & refresh destination product/category dropdowns
    document.querySelectorAll('input[name="ad_store"]').forEach(radio => {
      radio.addEventListener("change", () => {
        syncStoreCardUI();
        populateDestinationDropdowns();
        updateLivePreview();
      });
    });

    // Destination Link Type radio change
    document.querySelectorAll('input[name="ad_dest_type"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        syncDestinationPickersUI(e.target.value);
      });
    });

    // Destination product dropdown change
    const prodSelect = document.getElementById("ad-target-product");
    if (prodSelect) {
      prodSelect.addEventListener("change", (e) => {
        const prodId = e.target.value;
        if (!prodId) return;
        const currentStore = getSelectedStore();
        const linkInput = document.getElementById("ad-cta-link");
        if (linkInput) {
          linkInput.value = (currentStore === 'sarojini')
            ? `sarojini-product-details.html?id=${prodId}`
            : `product.html?id=${prodId}`;
        }
        updateLivePreview();
      });
    }

    // Destination category dropdown change
    const catSelect = document.getElementById("ad-target-category");
    if (catSelect) {
      catSelect.addEventListener("change", (e) => {
        const catVal = e.target.value;
        if (!catVal) return;
        const currentStore = getSelectedStore();
        const linkInput = document.getElementById("ad-cta-link");
        if (linkInput) {
          linkInput.value = (currentStore === 'sarojini')
            ? `sarojini-shop.html?department=${encodeURIComponent(catVal)}`
            : `shop.html?category=${encodeURIComponent(catVal)}`;
        }
        updateLivePreview();
      });
    }

    // Destination style dropdown change
    const styleSelect = document.getElementById("ad-target-style");
    if (styleSelect) {
      styleSelect.addEventListener("change", (e) => {
        const styleVal = e.target.value;
        if (!styleVal) return;
        const linkInput = document.getElementById("ad-cta-link");
        if (linkInput) {
          linkInput.value = `sarojini-shop.html?style=${encodeURIComponent(styleVal)}`;
        }
        updateLivePreview();
      });
    }

    // Reactive Preview Triggers
    const previewInputs = [
      "ad-title", "ad-subtitle", "ad-badge", "ad-type", "ad-placement", 
      "ad-image-url", "ad-mobile-image-url", "ad-cta-text", "ad-cta-link", "ad-is-cross-promo"
    ];
    previewInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", updateLivePreview);
        el.addEventListener("change", updateLivePreview);
      }
    });

    // Preview device toggles
    document.getElementById("btn-preview-desktop").addEventListener("click", () => {
      isMobilePreview = false;
      document.getElementById("btn-preview-desktop").classList.add("active");
      document.getElementById("btn-preview-mobile").classList.remove("active");
      document.getElementById("preview-wrapper").style.maxWidth = "100%";
      updateLivePreview();
    });

    document.getElementById("btn-preview-mobile").addEventListener("click", () => {
      isMobilePreview = true;
      document.getElementById("btn-preview-mobile").classList.add("active");
      document.getElementById("btn-preview-desktop").classList.remove("active");
      document.getElementById("preview-wrapper").style.maxWidth = "360px";
      document.getElementById("preview-wrapper").style.margin = "14px auto 0 auto";
      updateLivePreview();
    });

    // "All" checkbox logic
    const allPagesCheckbox = document.querySelector('input[name="target_pages"][value="all"]');
    if (allPagesCheckbox) {
      allPagesCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          document.querySelectorAll('input[name="target_pages"]').forEach(cb => {
            if (cb.value !== "all") cb.checked = false;
          });
        }
      });
      document.querySelectorAll('input[name="target_pages"]').forEach(cb => {
        if (cb.value !== "all") {
          cb.addEventListener("change", () => {
            if (cb.checked && allPagesCheckbox.checked) {
              allPagesCheckbox.checked = false;
            }
          });
        }
      });
    }
  }

  function getSelectedStore() {
    const checked = document.querySelector('input[name="ad_store"]:checked');
    return checked ? checked.value : 'vadi';
  }

  function syncStoreCardUI() {
    const store = getSelectedStore();
    const vadiCard = document.getElementById("card-store-vadi");
    const sarojiniCard = document.getElementById("card-store-sarojini");

    if (store === 'sarojini') {
      if (sarojiniCard) {
        sarojiniCard.style.borderColor = "#e11d48";
        sarojiniCard.style.background = "rgba(225, 29, 72, 0.12)";
      }
      if (vadiCard) {
        vadiCard.style.borderColor = "var(--admin-card-border)";
        vadiCard.style.background = "#0f172a";
      }
    } else {
      if (vadiCard) {
        vadiCard.style.borderColor = "#6366f1";
        vadiCard.style.background = "rgba(99, 102, 241, 0.12)";
      }
      if (sarojiniCard) {
        sarojiniCard.style.borderColor = "var(--admin-card-border)";
        sarojiniCard.style.background = "#0f172a";
      }
    }
  }

  function syncDestinationPickersUI(type) {
    const pWrap = document.getElementById("dest-picker-product-wrap");
    const cWrap = document.getElementById("dest-picker-category-wrap");
    const sWrap = document.getElementById("dest-picker-style-wrap");

    if (pWrap) pWrap.style.display = (type === 'product') ? 'block' : 'none';
    if (cWrap) cWrap.style.display = (type === 'category') ? 'block' : 'none';
    if (sWrap) sWrap.style.display = (type === 'style') ? 'block' : 'none';
  }

  /**
   * Fetch live catalogs to populate product & category link pickers
   */
  async function loadCatalogs() {
    if (!client) return;

    try {
      // 1. VADI Main Products
      const { data: vProds } = await client
        .from("products")
        .select("id, name, title, price")
        .order("name", { ascending: true })
        .limit(150);
      if (Array.isArray(vProds)) vadiProducts = vProds;

      // 2. Sarojini Bazaar Products
      const { data: sProds } = await client
        .from("sarojini_products")
        .select("id, name, price, department")
        .order("name", { ascending: true })
        .limit(150);
      if (Array.isArray(sProds)) sarojiniProducts = sProds;

      // 3. VADI Categories
      const { data: vCats } = await client
        .from("categories")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (Array.isArray(vCats)) vadiCategories = vCats;

      populateDestinationDropdowns();
    } catch (err) {
      console.warn("[Advertisements] Error preloading catalogs:", err);
    }
  }

  function populateDestinationDropdowns() {
    const store = getSelectedStore();
    const prodSelect = document.getElementById("ad-target-product");
    const catSelect = document.getElementById("ad-target-category");

    if (prodSelect) {
      const items = (store === 'sarojini') ? sarojiniProducts : vadiProducts;
      prodSelect.innerHTML = `<option value="">Select a ${store === 'sarojini' ? 'Sarojini' : 'VALORA'} product to link...</option>` +
        items.map(p => {
          const name = p.name || p.title || 'Product';
          const price = p.price ? ` — ₹${p.price}` : '';
          return `<option value="${p.id}">${escapeHtml(name)}${price}</option>`;
        }).join('');
    }

    if (catSelect) {
      if (store === 'sarojini') {
        catSelect.innerHTML = `<option value="">Select a Sarojini department...</option>` +
          SAROJINI_DEPARTMENTS.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      } else {
        catSelect.innerHTML = `<option value="">Select a VALORA category...</option>` +
          vadiCategories.map(c => `<option value="${c.slug || c.id}">${escapeHtml(c.name)}</option>`).join('');
      }
    }
  }

  /**
   * Load advertisements from Supabase banners table and store_settings
   */
  async function loadAdvertisements() {
    try {
      let loaded = null;

      // 1. Query store_settings key 'advertisements' (primary unified store for full schema)
      const { data: settings } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "advertisements")
        .maybeSingle();

      if (settings && settings.value && Array.isArray(settings.value) && settings.value.length > 0) {
        loaded = settings.value.map(normalizeAd);
      }

      // 2. Also query banners table
      if (!loaded || loaded.length === 0) {
        const { data: banners, error: bannerErr } = await client
          .from("banners")
          .select("*")
          .order("sort_order", { ascending: true, nullsFirst: false });

        if (!bannerErr && banners && banners.length > 0) {
          loaded = banners.map(normalizeAd);
        }
      }

      // 3. Fallback to seed defaults if empty, or ensure Sarojini ads are present
      if (!loaded || loaded.length === 0) {
        loaded = DEFAULT_SEED_ADS;
        await saveAdsToStoreSettings(loaded);
      } else {
        const hasSarojini = loaded.some(a => a.store === 'sarojini');
        if (!hasSarojini) {
          const sarojiniDefaults = DEFAULT_SEED_ADS.filter(a => a.store === 'sarojini');
          loaded = [...loaded, ...sarojiniDefaults];
          await saveAdsToStoreSettings(loaded);
        }
      }

      allAds = loaded;
      updateKpis();
      renderTable();
    } catch (err) {
      console.error("[Advertisements] Error loading:", err);
      allAds = DEFAULT_SEED_ADS;
      updateKpis();
      renderTable();
    }
  }

  function normalizeAd(b) {
    const rawStore = String(b.store || b.ad_type || '').toLowerCase();
    const isSarojini = rawStore.includes('sarojini') || String(b.title || '').toLowerCase().includes('sarojini');
    const store = b.store ? b.store.toLowerCase() : (isSarojini ? 'sarojini' : 'vadi');

    return {
      id: b.id || 'ad-' + Math.random().toString(36).substring(2, 9),
      store: store,
      is_cross_promotion: Boolean(b.is_cross_promotion),
      target_store: b.target_store || (store === 'sarojini' ? 'vadi' : 'sarojini'),
      destination_type: b.destination_type || 'custom',
      product_id: b.product_id || null,
      category_id: b.category_id || null,
      style_filter: b.style_filter || null,
      title: b.title || "Untitled Advertisement",
      subtitle: b.subtitle || "",
      badge_text: b.badge_text || "PROMOTION",
      ad_type: b.ad_type || (b.placement === 'top_announcement' ? 'top_announcement' : 'hero_banner'),
      placement: b.placement || "hero",
      target_pages: Array.isArray(b.target_pages) ? b.target_pages : (b.target_pages ? [b.target_pages] : ["all"]),
      image_url: b.image_url || "",
      mobile_image_url: b.mobile_image_url || "",
      cta_text: b.cta_text || b.button_text || "Shop Now",
      cta_link: b.cta_link || b.button_link || "shop.html",
      priority: b.priority || 5,
      sort_order: b.sort_order || b.display_order || 1,
      is_active: b.is_active !== false,
      start_at: b.start_at || null,
      end_at: b.end_at || null,
      coupon_code: b.coupon_code || null
    };
  }

  function updateKpis() {
    const total = allAds.length;
    const active = allAds.filter(a => a.is_active).length;
    const vadiCount = allAds.filter(a => (a.store || 'vadi') === 'vadi').length;
    const sarojiniCount = allAds.filter(a => a.store === 'sarojini').length;

    const elTotal = document.getElementById("kpi-total-ads");
    const elActive = document.getElementById("kpi-active-ads");
    const elVadi = document.getElementById("kpi-vadi-ads");
    const elSarojini = document.getElementById("kpi-sarojini-ads");

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elVadi) elVadi.textContent = vadiCount;
    if (elSarojini) elSarojini.textContent = sarojiniCount;
  }

  function renderTable() {
    const tbody = document.getElementById("ads-table-body");
    const searchVal = (document.getElementById("filter-search").value || "").toLowerCase().trim();
    const storeVal = document.getElementById("filter-store").value;
    const placementVal = document.getElementById("filter-placement").value;
    const statusVal = document.getElementById("filter-status").value;

    const now = Date.now();

    const filtered = allAds.filter(ad => {
      // 1. Store Filter
      const adStore = (ad.store || 'vadi').toLowerCase();
      if (storeVal === 'vadi' && adStore !== 'vadi') return false;
      if (storeVal === 'sarojini' && adStore !== 'sarojini') return false;
      if (storeVal === 'cross_promo' && !ad.is_cross_promotion) return false;

      // 2. Placement Filter
      if (placementVal !== 'all') {
        const matches = (ad.placement === placementVal) ||
          (placementVal === 'hero' && (ad.placement === 'below_hero' || ad.placement === 'hero')) ||
          (placementVal === 'between_sections_1' && (ad.placement === 'between_sections_1' || ad.placement === 'above_trending' || ad.placement === 'below_trending')) ||
          (placementVal === 'between_sections_2' && (ad.placement === 'between_sections_2' || ad.placement === 'above_deals' || ad.placement === 'above_new_arrivals' || ad.placement === 'below_bogo')) ||
          (placementVal === 'category_page' && (ad.placement === 'category_page' || ad.placement === 'shop_top')) ||
          (placementVal === 'product_page' && (ad.placement === 'product_page' || ad.placement === 'product_contextual')) ||
          (placementVal === 'cart_checkout' && (ad.placement === 'cart_checkout' || ad.placement === 'cart_drawer' || ad.placement === 'checkout_secure'));
        if (!matches) return false;
      }

      // 3. Status Filter
      if (statusVal === 'active' && !ad.is_active) return false;
      if (statusVal === 'inactive' && ad.is_active) return false;
      if (statusVal === 'scheduled') {
        if (!ad.is_active) return false;
        if (ad.start_at && new Date(ad.start_at).getTime() > now) return false;
        if (ad.end_at && new Date(ad.end_at).getTime() < now) return false;
      }

      // 4. Search Filter
      if (searchVal) {
        const matchTitle = (ad.title || "").toLowerCase().includes(searchVal);
        const matchBadge = (ad.badge_text || "").toLowerCase().includes(searchVal);
        const matchSubtitle = (ad.subtitle || "").toLowerCase().includes(searchVal);
        const matchStore = (ad.store || "").toLowerCase().includes(searchVal);
        const matchPages = (ad.target_pages || []).some(p => p.toLowerCase().includes(searchVal));
        if (!matchTitle && !matchBadge && !matchSubtitle && !matchStore && !matchPages) return false;
      }
      return true;
    });

    document.getElementById("ad-count-indicator").textContent = `Showing ${filtered.length} of ${allAds.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 36px; color: var(--admin-text-muted);">
            No advertisements match your current search and store filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((ad, idx) => {
      const placementText = PLACEMENT_LABELS[ad.placement] || ad.placement;
      const isSarojini = (ad.store === 'sarojini');
      const storeBadgeClass = isSarojini ? 'store-sarojini' : 'store-vadi';
      const storeName = isSarojini ? 'SAROJINI' : 'VALORA';
      const crossPromoHtml = ad.is_cross_promotion ? `<div class="cross-promo-pill">CROSS-PROMO</div>` : '';

      const pagesHtml = (ad.target_pages && ad.target_pages.length > 0)
        ? ad.target_pages.map(p => `<span class="page-tag-chip">${p}</span>`).join("")
        : `<span class="page-tag-chip">all</span>`;

      let scheduleText = "Always Active";
      if (ad.start_at || ad.end_at) {
        const start = ad.start_at ? new Date(ad.start_at).toLocaleDateString() : 'Start';
        const end = ad.end_at ? new Date(ad.end_at).toLocaleDateString() : 'No expiry';
        scheduleText = `${start} → ${end}`;
      }

      return `
        <tr data-id="${ad.id}">
          <td style="font-weight: 700; color: var(--admin-text-muted);">${ad.sort_order || idx + 1}</td>
          <td>
            <span class="store-badge ${storeBadgeClass}">${storeName}</span>
            ${crossPromoHtml}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              ${ad.image_url ? `
                <div style="width: 48px; height: 36px; border-radius: 4px; background: url('${ad.image_url}') center/cover no-repeat; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;"></div>
              ` : `
                <div style="width: 48px; height: 36px; border-radius: 4px; background: ${isSarojini ? 'rgba(225,29,72,0.1)' : 'rgba(99,102,241,0.1)'}; display:flex; align-items:center; justify-content:center; color: ${isSarojini ? '#fb7185' : 'var(--admin-accent)'}; font-size: 0.9rem; flex-shrink: 0;">
                  <i class="fas ${ad.placement === 'top_announcement' ? 'fa-bolt' : 'fa-bullhorn'}"></i>
                </div>
              `}
              <div>
                <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 2px;">
                  <span style="font-weight: 700; color: #fff; font-size: 0.88rem;">${escapeHtml(ad.title)}</span>
                  ${ad.badge_text ? `<span class="badge ${isSarojini ? 'badge-rose' : 'badge-indigo'}" style="font-size:0.65rem; padding: 2px 6px;">${escapeHtml(ad.badge_text)}</span>` : ''}
                </div>
                <div style="font-size: 0.76rem; color: var(--admin-text-muted); max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(ad.subtitle || 'No description')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="placement-badge">
              <i class="fas fa-map-pin" style="color: ${isSarojini ? '#e11d48' : 'var(--admin-accent)'}; font-size: 0.7rem;"></i>
              ${placementText}
            </span>
          </td>
          <td>${pagesHtml}</td>
          <td style="font-size: 0.76rem; color: var(--admin-text-muted);">${scheduleText}</td>
          <td>
            <label class="status-switch">
              <input type="checkbox" class="toggle-ad-status" data-id="${ad.id}" ${ad.is_active ? 'checked' : ''}>
              <span class="status-slider"></span>
            </label>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn-admin-secondary btn-edit-ad" data-id="${ad.id}" title="Edit Campaign" style="padding: 5px 9px; font-size: 0.78rem;">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn-admin-secondary btn-dup-ad" data-id="${ad.id}" title="Duplicate Campaign" style="padding: 5px 9px; font-size: 0.78rem;">
                <i class="fas fa-copy"></i>
              </button>
              <button class="btn-admin-danger btn-del-ad" data-id="${ad.id}" title="Delete Campaign" style="padding: 5px 9px; font-size: 0.78rem;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Attach row action listeners
    document.querySelectorAll(".toggle-ad-status").forEach(input => {
      input.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.checked;
        await updateAdStatus(id, newStatus);
      });
    });

    document.querySelectorAll(".btn-edit-ad").forEach(btn => {
      btn.addEventListener("click", () => {
        const ad = allAds.find(a => String(a.id) === String(btn.dataset.id));
        if (ad) openModal(ad);
      });
    });

    document.querySelectorAll(".btn-dup-ad").forEach(btn => {
      btn.addEventListener("click", () => {
        duplicateAd(btn.dataset.id);
      });
    });

    document.querySelectorAll(".btn-del-ad").forEach(btn => {
      btn.addEventListener("click", () => {
        deleteAd(btn.dataset.id);
      });
    });
  }

  function openModal(ad = null) {
    const modal = document.getElementById("ad-modal-backdrop");
    const modalTitle = document.getElementById("modal-title");
    const form = document.getElementById("ad-form");

    form.reset();

    if (ad) {
      modalTitle.textContent = "Edit Advertisement Campaign";
      document.getElementById("ad-id").value = ad.id;

      // Store identity radio
      const storeVal = (ad.store || 'vadi').toLowerCase();
      const storeRadio = document.querySelector(`input[name="ad_store"][value="${storeVal}"]`);
      if (storeRadio) storeRadio.checked = true;

      // Cross-promo checkbox
      const crossPromoCb = document.getElementById("ad-is-cross-promo");
      if (crossPromoCb) crossPromoCb.checked = Boolean(ad.is_cross_promotion);

      document.getElementById("ad-title").value = ad.title || "";
      document.getElementById("ad-subtitle").value = ad.subtitle || "";
      document.getElementById("ad-badge").value = ad.badge_text || "";
      document.getElementById("ad-type").value = ad.ad_type || "top_announcement";
      document.getElementById("ad-placement").value = ad.placement || "hero";
      document.getElementById("ad-image-url").value = ad.image_url || "";
      document.getElementById("ad-mobile-image-url").value = ad.mobile_image_url || "";
      document.getElementById("ad-cta-text").value = ad.cta_text || "";
      document.getElementById("ad-cta-link").value = ad.cta_link || "";
      document.getElementById("ad-priority").value = ad.priority || 5;
      document.getElementById("ad-sort-order").value = ad.sort_order || 1;
      document.getElementById("ad-coupon-code").value = ad.coupon_code || "";
      document.getElementById("ad-is-active").checked = ad.is_active !== false;

      // Destination type
      const destType = ad.destination_type || 'custom';
      const destRadio = document.querySelector(`input[name="ad_dest_type"][value="${destType}"]`);
      if (destRadio) destRadio.checked = true;
      syncDestinationPickersUI(destType);

      if (ad.product_id && document.getElementById("ad-target-product")) {
        document.getElementById("ad-target-product").value = ad.product_id;
      }
      if (ad.category_id && document.getElementById("ad-target-category")) {
        document.getElementById("ad-target-category").value = ad.category_id;
      }
      if (ad.style_filter && document.getElementById("ad-target-style")) {
        document.getElementById("ad-target-style").value = ad.style_filter;
      }

      if (ad.start_at) {
        document.getElementById("ad-start-at").value = new Date(ad.start_at).toISOString().slice(0, 16);
      }
      if (ad.end_at) {
        document.getElementById("ad-end-at").value = new Date(ad.end_at).toISOString().slice(0, 16);
      }

      const targetPages = ad.target_pages || ["all"];
      document.querySelectorAll('input[name="target_pages"]').forEach(cb => {
        cb.checked = targetPages.includes(cb.value);
      });
    } else {
      modalTitle.textContent = "Create New Advertisement";
      document.getElementById("ad-id").value = "";
      document.querySelector('input[name="ad_store"][value="vadi"]').checked = true;
      const crossPromoCb = document.getElementById("ad-is-cross-promo");
      if (crossPromoCb) crossPromoCb.checked = false;

      document.querySelector('input[name="ad_dest_type"][value="custom"]').checked = true;
      syncDestinationPickersUI('custom');

      document.getElementById("ad-priority").value = "5";
      document.getElementById("ad-sort-order").value = (allAds.length + 1);
      document.getElementById("ad-coupon-code").value = "";
      document.getElementById("ad-is-active").checked = true;
      document.querySelector('input[name="target_pages"][value="all"]').checked = true;
    }

    syncStoreCardUI();
    populateDestinationDropdowns();
    modal.classList.add("show");
    updateLivePreview();
  }

  function closeModal() {
    document.getElementById("ad-modal-backdrop").classList.remove("show");
  }

  function updateLivePreview() {
    const container = document.getElementById("ad-live-preview-container");
    const store = getSelectedStore();
    const isSarojini = (store === 'sarojini');
    const isCrossPromo = document.getElementById("ad-is-cross-promo")?.checked;

    const title = document.getElementById("ad-title").value.trim() || (isSarojini ? "Delhi Street Fashion Sale" : "Promotional Campaign Title");
    const subtitle = document.getElementById("ad-subtitle").value.trim() || (isSarojini ? "Authentic export surplus pieces and viral street staples direct from Delhi." : "Exclusive bespoke collection available for a limited time.");
    const badge = document.getElementById("ad-badge").value.trim() || (isSarojini ? "BAZAAR LOOT" : "SPECIAL OFFER");
    const placement = document.getElementById("ad-placement").value;
    const imageUrl = document.getElementById("ad-image-url").value.trim();
    const ctaText = document.getElementById("ad-cta-text").value.trim() || (isSarojini ? "Shop Street Drops" : "Shop Now");

    const accentBg = isSarojini ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, #d4af37, #f59e0b)';
    const accentText = isSarojini ? '#fff' : '#000';
    const storePill = isSarojini
      ? `<span style="background: rgba(225,29,72,0.25); color: #fb7185; border: 1px solid rgba(225,29,72,0.4); padding: 1px 6px; border-radius: 4px; font-weight: 800; font-size: 0.62rem; text-transform: uppercase;">SAROJINI BAZAAR</span>`
      : `<span style="background: rgba(99,102,241,0.25); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4); padding: 1px 6px; border-radius: 4px; font-weight: 800; font-size: 0.62rem; text-transform: uppercase;">Main VALORA</span>`;
    const crossTag = isCrossPromo
      ? `<span style="background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); padding: 1px 5px; border-radius: 3px; font-size: 0.6rem; font-weight: 800;">CROSS-PROMO</span>`
      : '';

    if (placement === "top_announcement") {
      const barBg = isSarojini
        ? 'linear-gradient(90deg, #1c1917 0%, #4c0519 50%, #1c1917 100%)'
        : 'linear-gradient(90deg, #111827 0%, #1e1b4b 50%, #111827 100%)';

      container.innerHTML = `
        <div style="background: ${barBg}; border: 1px solid ${isSarojini ? 'rgba(225,29,72,0.4)' : 'rgba(212,175,55,0.4)'}; border-radius: 6px; padding: 10px 16px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #fff; font-size: ${isMobilePreview ? '0.75rem' : '0.82rem'}; text-align: center; flex-wrap: wrap;">
          ${storePill}
          ${crossTag}
          <span style="background: ${isSarojini ? 'rgba(225,29,72,0.2)' : 'rgba(212,175,55,0.2)'}; color: ${isSarojini ? '#fb7185' : '#f59e0b'}; border: 1px solid ${isSarojini ? 'rgba(225,29,72,0.4)' : 'rgba(212,175,55,0.4)'}; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">
            ${escapeHtml(badge)}
          </span>
          <span style="font-weight: 600; letter-spacing: 0.02em;">${escapeHtml(title)}</span>
          <span style="color: #cbd5e1; display: ${isMobilePreview ? 'none' : 'inline'};">— ${escapeHtml(subtitle)}</span>
          <span style="color: ${isSarojini ? '#f43f5e' : '#fbbf24'}; font-weight: 700; text-decoration: underline; cursor: pointer; white-space: nowrap;">
            ${escapeHtml(ctaText)} →
          </span>
        </div>
      `;
    } else {
      // Banner format (Hero or Between Sections)
      const bannerBg = imageUrl
        ? `linear-gradient(${isSarojini ? 'rgba(76,5,25,0.78), rgba(28,25,23,0.92)' : 'rgba(10,12,18,0.7), rgba(10,12,18,0.9)'}), url('${imageUrl}') center/cover no-repeat`
        : (isSarojini ? 'linear-gradient(135deg, #4c0519 0%, #1c1917 100%)' : 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)');

      container.innerHTML = `
        <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1px solid ${isSarojini ? 'rgba(225,29,72,0.35)' : 'rgba(212,175,55,0.25)'}; min-height: ${isMobilePreview ? '140px' : '170px'}; background: ${bannerBg}; display: flex; flex-direction: column; justify-content: center; padding: ${isMobilePreview ? '16px' : '24px'}; box-shadow: 0 8px 24px rgba(0,0,0,0.35);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            ${storePill}
            ${crossTag}
            <span style="background: ${isSarojini ? 'rgba(225,29,72,0.25)' : 'rgba(212,175,55,0.2)'}; color: ${isSarojini ? '#fb7185' : '#fbbf24'}; border: 1px solid ${isSarojini ? 'rgba(225,29,72,0.45)' : 'rgba(212,175,55,0.4)'}; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 0.68rem; text-transform: uppercase;">
              ${escapeHtml(badge)}
            </span>
          </div>
          <h3 style="color: #fff; font-size: ${isMobilePreview ? '1.05rem' : '1.35rem'}; font-weight: 800; margin-bottom: 6px; text-shadow: 0 2px 4px rgba(0,0,0,0.6); line-height: 1.25;">
            ${escapeHtml(title)}
          </h3>
          <p style="color: #e2e8f0; font-size: ${isMobilePreview ? '0.78rem' : '0.88rem'}; max-width: 540px; margin-bottom: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); line-height: 1.45;">
            ${escapeHtml(subtitle)}
          </p>
          <div>
            <button type="button" style="background: ${accentBg}; color: ${accentText}; border: none; font-weight: 700; font-size: 0.82rem; padding: 8px 18px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(ctaText)}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      `;
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("ad-id").value;
    const store = getSelectedStore();
    const is_cross_promotion = document.getElementById("ad-is-cross-promo")?.checked || false;
    const target_store = is_cross_promotion ? (store === 'vadi' ? 'sarojini' : 'vadi') : store;

    const title = document.getElementById("ad-title").value.trim();
    const subtitle = document.getElementById("ad-subtitle").value.trim();
    const badge_text = document.getElementById("ad-badge").value.trim() || "PROMOTION";
    const ad_type = document.getElementById("ad-type").value;
    const placement = document.getElementById("ad-placement").value;
    const image_url = document.getElementById("ad-image-url").value.trim();
    const mobile_image_url = document.getElementById("ad-mobile-image-url").value.trim();
    const cta_text = document.getElementById("ad-cta-text").value.trim() || "Shop Now";
    const cta_link = document.getElementById("ad-cta-link").value.trim() || (store === 'sarojini' ? 'sarojini-shop.html' : 'shop.html');

    const destTypeRadio = document.querySelector('input[name="ad_dest_type"]:checked');
    const destination_type = destTypeRadio ? destTypeRadio.value : 'custom';

    const product_id = (destination_type === 'product') ? (document.getElementById("ad-target-product")?.value || null) : null;
    const category_id = (destination_type === 'category') ? (document.getElementById("ad-target-category")?.value || null) : null;
    const style_filter = (destination_type === 'style') ? (document.getElementById("ad-target-style")?.value || null) : null;

    const priority = parseInt(document.getElementById("ad-priority").value, 10) || 5;
    const sort_order = parseInt(document.getElementById("ad-sort-order").value, 10) || 1;
    const coupon_code = (document.getElementById("ad-coupon-code").value || "").trim().toUpperCase() || null;
    const start_at = document.getElementById("ad-start-at").value || null;
    const end_at = document.getElementById("ad-end-at").value || null;
    const is_active = document.getElementById("ad-is-active").checked;

    const selectedPages = [];
    document.querySelectorAll('input[name="target_pages"]:checked').forEach(cb => {
      selectedPages.push(cb.value);
    });
    if (selectedPages.length === 0) selectedPages.push("all");

    const adPayload = {
      store,
      is_cross_promotion,
      target_store,
      destination_type,
      product_id,
      category_id,
      style_filter,
      title,
      subtitle,
      badge_text,
      ad_type,
      placement,
      target_pages: selectedPages,
      image_url,
      mobile_image_url,
      button_text: cta_text,
      button_link: cta_link,
      cta_text,
      cta_link,
      priority,
      sort_order,
      display_order: sort_order,
      coupon_code,
      is_active,
      start_at: start_at ? new Date(start_at).toISOString() : null,
      end_at: end_at ? new Date(end_at).toISOString() : null,
      updated_at: new Date().toISOString()
    };

    try {
      let savedId = id;

      if (id) {
        // Update existing in local state
        const idx = allAds.findIndex(a => String(a.id) === String(id));
        if (idx !== -1) {
          allAds[idx] = { ...allAds[idx], ...adPayload, id };
        }

        // Try direct update on banners table (strip unmapped columns if schema error)
        try {
          const { error } = await client.from("banners").update(adPayload).eq("id", id);
          if (error && error.code === "42703") {
            const { store: _s, is_cross_promotion: _cp, target_store: _ts, destination_type: _dt, product_id: _p, category_id: _c, style_filter: _sf, ...safePayload } = adPayload;
            await client.from("banners").update(safePayload).eq("id", id);
          }
        } catch (_) {}
      } else {
        savedId = "ad-" + Date.now();
        const insertPayload = {
          ...adPayload,
          id: savedId,
          created_at: new Date().toISOString()
        };
        allAds.push(insertPayload);

        // Try insert into banners table
        try {
          const { error } = await client.from("banners").insert([insertPayload]);
          if (error && error.code === "42703") {
            const { store: _s, is_cross_promotion: _cp, target_store: _ts, destination_type: _dt, product_id: _p, category_id: _c, style_filter: _sf, ...safePayload } = insertPayload;
            await client.from("banners").insert([safePayload]);
          }
        } catch (_) {}
      }

      // Synchronize full rich JSON to store_settings
      await saveAdsToStoreSettings(allAds);

      window.showToast("Advertisement campaign saved successfully!", "success");
      closeModal();
      updateKpis();
      renderTable();
    } catch (err) {
      console.error("[Advertisements] Save error:", err);
      window.showToast("Saved locally and synchronized.", "info");
      closeModal();
      updateKpis();
      renderTable();
    }
  }

  async function updateAdStatus(id, isActive) {
    const idx = allAds.findIndex(a => String(a.id) === String(id));
    if (idx !== -1) {
      allAds[idx].is_active = isActive;
    }

    try {
      await client.from("banners").update({ is_active: isActive }).eq("id", id);
    } catch (_) {}

    await saveAdsToStoreSettings(allAds);
    window.showToast(`Campaign ${isActive ? 'activated' : 'deactivated'}.`, "success");
    updateKpis();
  }

  async function duplicateAd(id) {
    const orig = allAds.find(a => String(a.id) === String(id));
    if (!orig) return;

    const dup = {
      ...orig,
      id: "ad-" + Date.now(),
      title: `${orig.title} (Copy)`,
      sort_order: allAds.length + 1,
      is_active: false,
      created_at: new Date().toISOString()
    };

    allAds.push(dup);
    await saveAdsToStoreSettings(allAds);
    window.showToast("Campaign duplicated as inactive draft.", "success");
    updateKpis();
    renderTable();
  }

  async function deleteAd(id) {
    if (!confirm("Are you sure you want to permanently delete this advertisement campaign?")) return;

    allAds = allAds.filter(a => String(a.id) !== String(id));

    try {
      await client.from("banners").delete().eq("id", id);
    } catch (_) {}

    await saveAdsToStoreSettings(allAds);
    window.showToast("Campaign deleted.", "success");
    updateKpis();
    renderTable();
  }

  async function saveAdsToStoreSettings(adsList) {
    if (!client) return;

    try {
      await client.from("store_settings").upsert([{
        key: "advertisements",
        value: adsList,
        updated_at: new Date().toISOString()
      }], { onConflict: "key" });
    } catch (e) {
      console.warn("store_settings sync notice:", e);
    }

    // Invalidate local storage cache and dispatch global sync event
    try {
      localStorage.setItem("velora_ads_cache_v2", JSON.stringify({
        timestamp: Date.now(),
        ads: adsList
      }));
      localStorage.setItem("velora_ads_cache_invalidated", Date.now().toString());
    } catch (_) {}

    window.dispatchEvent(new CustomEvent("velora:ads-updated", { detail: { ads: adsList } }));
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
