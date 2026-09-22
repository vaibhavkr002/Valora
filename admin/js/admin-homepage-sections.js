/**
 * VADI Admin Panel - Homepage Sections Controller
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Central controller managing creation, configuration, reordering,
 * duplication, deletion, and previewing of dynamic homepage sections.
 */

document.addEventListener("DOMContentLoaded", async () => {
  'use strict';

  // 1. Guard route via AdminAuth
  if (window.AdminAuth && typeof window.AdminAuth.guardRoute === "function") {
    const auth = await window.AdminAuth.guardRoute();
    if (!auth || !auth.isAdmin) return;
  }

  const client = (window.AdminAuth && typeof window.AdminAuth.getClient === "function" && window.AdminAuth.getClient()) || window.supabaseClient;
  const STORAGE_KEY = "velora_homepage_sections";
  const formatPrice = (amt) => (window.formatINR ? window.formatINR(amt) : ('₹' + Math.round(amt).toLocaleString('en-IN')));

  // --- Default Sections Manifest (17 core storefront sections) ---
  const DEFAULT_SECTIONS_SEED = [
    { id: '11111111-1111-4111-a111-000000000001', section_type: 'hero', title: 'Hero Showcase', subtitle: 'Everything. Simply Yours.', is_active: true, display_order: 1, background_config: { theme: 'dark', padding: 'standard' }, content_config: {} },
    { id: '11111111-1111-4111-a111-000000000002', section_type: 'advertisement', title: 'Promotional Banner Below Hero', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 2, background_config: {}, content_config: { placement: 'below_hero' } },
    { id: '11111111-1111-4111-a111-000000000003', section_type: 'categories', title: 'Shop By Category', subtitle: 'Curated Collections', is_active: true, display_order: 3, background_config: { theme: 'dark', padding: 'standard' }, content_config: {} },
    { id: '11111111-1111-4111-a111-000000000004', section_type: 'brands', title: 'Shop by Brands', subtitle: 'Curated Labels', is_active: true, display_order: 4, background_config: { theme: 'dark', padding: 'compact' }, content_config: { autoplay: true } },
    { id: '11111111-1111-4111-a111-000000000005', section_type: 'advertisement', title: 'Ad Slot Above Trending', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 5, background_config: {}, content_config: { placement: 'above_trending' } },
    { id: '11111111-1111-4111-a111-000000000006', section_type: 'trending', title: 'Trending Now & Customer Favorites', subtitle: 'Discover the standout styles captivating nationwide attention this week', is_active: true, display_order: 6, background_config: { theme: 'dark', padding: 'standard' }, content_config: { badge: '⚡ VADI CURATED RADAR', limit: 8, columns: 4 } },
    { id: '11111111-1111-4111-a111-000000000007', section_type: 'advertisement', title: 'Ad Slot Below Trending', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 7, background_config: {}, content_config: { placement: 'below_trending' } },
    { id: '11111111-1111-4111-a111-000000000008', section_type: 'advertisement', title: 'Ad Slot Above New Arrivals', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 8, background_config: {}, content_config: { placement: 'above_new_arrivals' } },
    { id: '11111111-1111-4111-a111-000000000009', section_type: 'new_arrivals', title: 'New Arrivals', subtitle: 'Fresh silhouettes and elevated essentials just added to the catalog', is_active: true, display_order: 9, background_config: { theme: 'dark', padding: 'standard' }, content_config: { limit: 8, columns: 4 } },
    { id: '11111111-1111-4111-a111-000000000010', section_type: 'advertisement', title: 'Ad Slot Above Deals', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 10, background_config: {}, content_config: { placement: 'above_deals' } },
    { id: '11111111-1111-4111-a111-000000000011', section_type: 'deals', title: "Today's Flash Deals", subtitle: 'Limited-quantity private tier discounts updating in real time', is_active: true, display_order: 11, background_config: { theme: 'dark', padding: 'standard' }, content_config: { show_timer: true, limit: 8, columns: 4 } },
    { id: '11111111-1111-4111-a111-000000000012', section_type: 'bogo', title: 'Buy 1 Get 1 Free (BOGO)', subtitle: 'Curated promotional pairing festival', is_active: true, display_order: 12, background_config: { theme: 'dark', padding: 'standard' }, content_config: { limit: 6 } },
    { id: '11111111-1111-4111-a111-000000000013', section_type: 'advertisement', title: 'Ad Slot Below BOGO', subtitle: 'Dynamic Advertisement Slot', is_active: true, display_order: 13, background_config: {}, content_config: { placement: 'below_bogo' } },
    { id: '11111111-1111-4111-a111-000000000014', section_type: 'customer_stories', title: 'REAL CUSTOMERS. REAL LOVE.', subtitle: 'From a simple DM to a VADI experience — every order has a story', is_active: true, display_order: 14, background_config: { theme: 'dark', padding: 'standard' }, content_config: {} },
    { id: '11111111-1111-4111-a111-000000000015', section_type: 'features', title: 'Why Shop With Us?', subtitle: 'The VADI Standard', is_active: true, display_order: 15, background_config: { theme: 'dark', padding: 'standard' }, content_config: {} },
    { id: '11111111-1111-4111-a111-000000000016', section_type: 'delivery_partners', title: 'Express Shipping Network', subtitle: 'Trusted Logistics Partners', is_active: true, display_order: 16, background_config: { theme: 'dark', padding: 'compact' }, content_config: {} },
    { id: '11111111-1111-4111-a111-000000000017', section_type: 'newsletter', title: 'Unlock 15% Off Your Next Order', subtitle: 'Join The Collective', is_active: true, display_order: 17, background_config: { theme: 'dark', padding: 'compact' }, content_config: {} }
  ];

  // --- State ---
  let state = {
    sections: [],
    categories: [],
    products: [],
    sarojiniProducts: [],
    sarojiniCategories: [],
    currentStore: "main", // "main" or "sarojini"
    modalSelectedProductIds: [],
    hasPendingReorder: false,
    editingSectionId: null,
    searchQuery: ""
  };

  // --- DOM Elements ---
  const dom = {
    tableBody: document.getElementById("sections-table-body"),
    sectionCountBadge: document.getElementById("section-count-badge"),
    metricTotal: document.getElementById("metric-total-sections"),
    metricActive: document.getElementById("metric-active-sections"),
    metricGrids: document.getElementById("metric-grid-sections"),
    metricScheduled: document.getElementById("metric-scheduled-sections"),
    btnSaveOrder: document.getElementById("btn-save-order"),
    btnAddSection: document.getElementById("btn-add-section"),
    searchInput: document.getElementById("search-sections"),
    modalBuilder: document.getElementById("modal-section-builder"),
    modalPreview: document.getElementById("modal-section-preview"),
    btnCloseBuilder: document.getElementById("btn-close-builder-modal"),
    btnCancelBuilder: document.getElementById("btn-cancel-builder"),
    btnClosePreview: document.getElementById("btn-close-preview-modal"),
    btnClosePreviewFooter: document.getElementById("btn-close-preview-footer"),
    formBuilder: document.getElementById("form-section-builder"),
    builderTitle: document.getElementById("builder-modal-title"),
    secId: document.getElementById("sec-id"),
    secType: document.getElementById("sec-type"),
    secTitle: document.getElementById("sec-title"),
    secSubtitle: document.getElementById("sec-subtitle"),
    secTheme: document.getElementById("sec-theme"),
    secPadding: document.getElementById("sec-padding"),
    secOrder: document.getElementById("sec-display-order"),
    secStartDate: document.getElementById("sec-start-date"),
    secEndDate: document.getElementById("sec-end-date"),
    secIsActive: document.getElementById("sec-is-active"),
    dynamicConfigPanel: document.getElementById("dynamic-config-panel"),
    previewContentBox: document.getElementById("preview-content-box"),
    previewModalTitle: document.getElementById("preview-modal-title"),
    previewTypeBadge: document.getElementById("preview-type-badge"),
    tabStoreMain: document.getElementById("tab-store-main"),
    tabStoreSarojini: document.getElementById("tab-store-sarojini"),
    storeScopeLabel: document.getElementById("store-scope-label"),
    storeScopeHint: document.getElementById("store-scope-hint")
  };

  // --- Toast Helper ---
  function showToast(msg, type = "info") {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${msg}`);
      alert(msg);
    }
  }

  // --- Load Products & Categories Catalog for Selectors ---
  async function loadCatalogDependencies() {
    if (client) {
      try {
        const [prodRes, catRes, sarojiniProdRes, sarojiniCatRes] = await Promise.all([
          client.from("products").select("id, name, price, original_price, discount, rating, image, category, brand").order("name"),
          client.from("categories").select("id, name, slug").order("name"),
          client.from("sarojini_products").select("id, name, price, original_price, discount_percentage, rating, images, department, brand, is_active").order("created_at", { ascending: false }),
          client.from("sarojini_categories").select("id, name, slug, department").order("name")
        ]);
        if (prodRes && prodRes.data) state.products = prodRes.data;
        if (catRes && catRes.data) state.categories = catRes.data;
        if (sarojiniProdRes && Array.isArray(sarojiniProdRes.data) && sarojiniProdRes.data.length > 0) {
          state.sarojiniProducts = sarojiniProdRes.data.map(p => ({
            ...p,
            image: (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : (p.image || 'assets/sarojni/prod-1-graphic-tee.png')
          }));
        }
        if (sarojiniCatRes && Array.isArray(sarojiniCatRes.data)) state.sarojiniCategories = sarojiniCatRes.data;
      } catch (err) {
        console.warn("Catalog dependencies notice:", err);
      }
    }
    // Fallbacks if empty
    if (!state.categories || state.categories.length === 0) {
      state.categories = [
        { id: "shoes", name: "Shoes & Footwear", slug: "shoes" },
        { id: "watches", name: "Luxury Watches", slug: "watches" },
        { id: "bags", name: "Designer Bags", slug: "bags" },
        { id: "caps", name: "Caps & Headwear", slug: "caps" },
        { id: "clothes", name: "Tailored Clothing", slug: "clothes" },
        { id: "accessories", name: "Accessories", slug: "accessories" }
      ];
    }
    if (!state.products || state.products.length === 0) {
      state.products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    }
    if (!state.sarojiniProducts || state.sarojiniProducts.length === 0) {
      try {
        if (client) {
          const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
          if (sRow && Array.isArray(sRow.value)) {
            state.sarojiniProducts = sRow.value.map(p => ({
              ...p,
              image: (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : (p.image || 'assets/sarojni/prod-1-graphic-tee.png')
            }));
          }
        }
      } catch (_) {}
    }
  }

  // --- Load Sections from Supabase ---
  async function loadSections() {
    dom.tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--admin-text-muted);">
          <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading homepage sections from Supabase...
        </td>
      </tr>`;

    let loaded = null;

    // 1. Try public.homepage_sections
    if (client) {
      try {
        const { data, error } = await client
          .from("homepage_sections")
          .select("*")
          .order("display_order", { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          loaded = data;
        }
      } catch (e) {
        console.warn("homepage_sections query exception:", e);
      }
    }

    // 2. Fallback: store_settings table
    if (!loaded && client) {
      try {
        const { data } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "homepage_sections")
          .maybeSingle();
        if (data && Array.isArray(data.value) && data.value.length > 0) {
          loaded = data.value;
        }
      } catch (_) {}
    }

    // 3. Fallback: localStorage
    if (!loaded) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (_) {}
    }

    // 4. Fallback: Default Seed Manifest
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      loaded = [...DEFAULT_SECTIONS_SEED];
      // Automatically backfill into Supabase or localStorage
      try {
        if (client) {
          await client.from("store_settings").upsert([{
            key: "homepage_sections",
            value: loaded,
            description: "Dynamic Homepage Section Configurations",
            updated_at: new Date().toISOString()
          }], { onConflict: "key" });
        }
      } catch (_) {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }

    // Sort by display_order
    state.sections = loaded.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    renderSectionsTable();
    updateMetrics();
  }

  // --- Store Scoping Helpers ---
  function isSarojiniSection(sec) {
    if (!sec) return false;
    if (sec.section_type === 'sarojini_trending') return true;
    if (sec.content_config && sec.content_config.catalog_type === 'sarojini') return true;
    return false;
  }

  function getFilteredSectionsByStore() {
    if (state.currentStore === 'sarojini') {
      return state.sections.filter(s => isSarojiniSection(s));
    }
    return state.sections.filter(s => !isSarojiniSection(s));
  }

  function setStoreScope(storeName) {
    state.currentStore = storeName;
    if (dom.tabStoreMain && dom.tabStoreSarojini) {
      if (storeName === 'sarojini') {
        dom.tabStoreSarojini.classList.add('active');
        dom.tabStoreSarojini.style.background = '#e11d48';
        dom.tabStoreSarojini.style.color = '#fff';
        dom.tabStoreMain.classList.remove('active');
        dom.tabStoreMain.style.background = 'var(--admin-card-bg)';
        dom.tabStoreMain.style.color = 'var(--admin-text-muted)';
        if (dom.storeScopeLabel) dom.storeScopeLabel.textContent = 'Sarojini Bazaar';
      } else {
        dom.tabStoreMain.classList.add('active');
        dom.tabStoreMain.style.background = 'var(--admin-accent)';
        dom.tabStoreMain.style.color = '#fff';
        dom.tabStoreSarojini.classList.remove('active');
        dom.tabStoreSarojini.style.background = 'var(--admin-card-bg)';
        dom.tabStoreSarojini.style.color = 'var(--admin-text-muted)';
        if (dom.storeScopeLabel) dom.storeScopeLabel.textContent = 'Main VADI Store';
      }
    }
    renderSectionsTable();
    updateMetrics();
  }

  // --- Update Metrics ---
  function updateMetrics() {
    const scopedList = getFilteredSectionsByStore();
    const total = scopedList.length;
    const active = scopedList.filter(s => s.is_active !== false).length;
    const grids = scopedList.filter(s => s.section_type === 'product_grid' || s.section_type === 'sarojini_trending').length;
    const now = Date.now();
    const scheduled = scopedList.filter(s => (s.start_date && new Date(s.start_date).getTime() > now) || (s.end_date && new Date(s.end_date).getTime() < now)).length;

    dom.metricTotal.textContent = total;
    dom.metricActive.textContent = active;
    dom.metricGrids.textContent = grids;
    dom.metricScheduled.textContent = scheduled;
    dom.sectionCountBadge.textContent = `${total} Sections (${state.currentStore === 'sarojini' ? 'Sarojini Bazaar' : 'Main VADI'})`;
  }

  // --- Render Sections Table ---
  function renderSectionsTable() {
    let list = getFilteredSectionsByStore();
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s => (s.title || '').toLowerCase().includes(q) || (s.subtitle || '').toLowerCase().includes(q) || (s.section_type || '').toLowerCase().includes(q));
    }

    if (list.length === 0) {
      dom.tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
            <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5; display: block;"></i>
            No sections configured for ${state.currentStore === 'sarojini' ? 'Sarojini Bazaar' : 'Main VADI Store'}.
          </td>
        </tr>`;
      return;
    }

    dom.tableBody.innerHTML = list.map((sec, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === list.length - 1;
      const typeClass = sec.section_type || 'standard';
      const typeLabel = formatSectionTypeLabel(sec.section_type);
      const ruleDetail = formatContentRuleDetail(sec);

      return `
        <tr data-sec-id="${sec.id}" style="${sec.is_active === false ? 'opacity: 0.65;' : ''}">
          <td style="text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span style="font-weight: 700; font-size: 0.9rem; min-width: 20px; color: #f8fafc;">${sec.display_order || (idx + 1)}</span>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <button type="button" class="order-control-btn btn-move-up" data-id="${sec.id}" ${isFirst ? 'disabled' : ''} title="Move Up">
                  <i class="fas fa-chevron-up" style="font-size: 0.65rem;"></i>
                </button>
                <button type="button" class="order-control-btn btn-move-down" data-id="${sec.id}" ${isLast ? 'disabled' : ''} title="Move Down">
                  <i class="fas fa-chevron-down" style="font-size: 0.65rem;"></i>
                </button>
              </div>
            </div>
          </td>
          <td>
            <span class="type-badge ${typeClass}">
              <i class="${getSectionTypeIcon(sec.section_type)}"></i>
              ${typeLabel}
            </span>
          </td>
          <td>
            <div style="font-weight: 600; color: #f8fafc; font-size: 0.9rem;">${escapeHtml(sec.title || 'Untitled Section')}</div>
            ${sec.subtitle ? `<div style="font-size: 0.76rem; color: var(--admin-text-muted); margin-top: 2px;">${escapeHtml(sec.subtitle)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 0.78rem; color: #cbd5e1;">${ruleDetail}</div>
          </td>
          <td style="text-align: center;">
            <label class="status-switch">
              <input type="checkbox" class="sec-toggle-switch" data-id="${sec.id}" ${sec.is_active !== false ? 'checked' : ''}>
              <span class="status-slider"></span>
            </label>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn-admin-action btn-preview-sec" data-id="${sec.id}" title="Preview Section">
                <i class="fas fa-eye"></i>
              </button>
              <button type="button" class="btn-admin-action btn-edit-sec" data-id="${sec.id}" title="Edit Section">
                <i class="fas fa-pencil-alt"></i>
              </button>
              <button type="button" class="btn-admin-action btn-duplicate-sec" data-id="${sec.id}" title="Duplicate Section">
                <i class="fas fa-copy"></i>
              </button>
              <button type="button" class="btn-admin-action btn-delete-sec" data-id="${sec.id}" style="color: #ef4444;" title="Delete Section">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    bindTableEvents();
  }

  function generateUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try { return crypto.randomUUID(); } catch (_) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSectionTypeIcon(type) {
    const map = {
      hero: 'fas fa-star',
      categories: 'fas fa-th-large',
      category_grid: 'fas fa-th-large',
      brands: 'fas fa-gem',
      trending: 'fas fa-fire',
      deals: 'fas fa-bolt',
      new_arrivals: 'fas fa-sparkles',
      bogo: 'fas fa-gift',
      product_grid: 'fas fa-cubes',
      promotional_banner: 'fas fa-image',
      custom: 'fas fa-code',
      advertisement: 'fas fa-bullhorn',
      customer_stories: 'fas fa-comments',
      features: 'fas fa-shield-alt',
      delivery_partners: 'fas fa-truck-fast',
      newsletter: 'fas fa-envelope',
      sarojini_trending: 'fas fa-shopping-bag'
    };
    return map[type] || 'fas fa-layer-group';
  }

  function formatSectionTypeLabel(type) {
    const map = {
      hero: 'Hero Showcase',
      categories: 'Category Grid',
      category_grid: 'Category Grid',
      brands: 'Brand Strip',
      trending: 'Trending Now',
      deals: "Today's Deals",
      new_arrivals: 'New Arrivals',
      bogo: 'BOGO Offer',
      product_grid: 'Product Grid',
      promotional_banner: 'Promo Banner',
      custom: 'Custom Content',
      advertisement: 'Ad Slot',
      customer_stories: 'Customer Stories',
      features: 'Why Shop With Us',
      delivery_partners: 'Delivery Partners',
      newsletter: 'Newsletter',
      sarojini_trending: 'Sarojini Trending Finds'
    };
    return map[type] || (type ? type.replace(/_/g, ' ').toUpperCase() : 'Custom Section');
  }

  function formatContentRuleDetail(sec) {
    const cfg = sec.content_config || {};
    if (sec.section_type === 'sarojini_trending' || (cfg && cfg.catalog_type === 'sarojini')) {
      const pCount = (cfg.product_ids || []).length;
      return `<span class="badge" style="background:#4c0519; color:#fda4af; border: 1px solid rgba(225,29,72,0.4);"><i class="fas fa-check-circle" style="margin-right:4px;"></i> ${pCount} Curated Sarojini Products (Ordered)</span>`;
    }
    if (sec.section_type === 'product_grid') {
      const src = cfg.source || 'all';
      const limit = cfg.limit || 8;
      if (src === 'category') return `<span class="badge" style="background:#1e293b; color:#a5b4fc;">Category: ${cfg.category || 'All'} (${limit} items)</span>`;
      if (src === 'brand') return `<span class="badge" style="background:#1e293b; color:#f472b6;">Brand: ${cfg.brand || 'All'} (${limit} items)</span>`;
      if (src === 'specific') return `<span class="badge" style="background:#1e293b; color:#38bdf8;">${(cfg.product_ids || []).length} Selected Products</span>`;
      return `<span class="badge" style="background:#1e293b; color:#94a3b8;">Filter: ${src.toUpperCase()} (${limit} items)</span>`;
    }
    if (sec.section_type === 'category_grid' || sec.section_type === 'categories') {
      return `<span class="badge" style="background:#1e293b; color:#a5b4fc;">${cfg.columns || 4} Columns Grid</span>`;
    }
    if (sec.section_type === 'brands') {
      return `<span style="color:#f472b6;">Brand Strip (${cfg.autoplay !== false ? 'Autoplay' : 'Static'})</span>`;
    }
    if (sec.section_type === 'custom') {
      return `<span style="color:#38bdf8;">Custom Content Block</span>`;
    }
    if (sec.section_type === 'advertisement') {
      return `<span style="font-family:monospace; color:#38bdf8;">Placement: ${cfg.placement || 'below_hero'}</span>`;
    }
    if (sec.section_type === 'promotional_banner') {
      return `<span style="color:#f472b6;">CTA: ${cfg.cta_text || 'Explore'} → ${cfg.cta_link || 'shop.html'}</span>`;
    }
    return `<span style="color:var(--admin-text-muted);">Standard Component</span>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Sarojini Dedicated Product Manager Sub-Panel ---
  function renderSarojiniProductConfig(existingConfig = {}) {
    state.modalSelectedProductIds = Array.isArray(existingConfig.product_ids) ? [...existingConfig.product_ids] : [];
    const limit = existingConfig.limit || 6;
    const cols = existingConfig.columns || 6;
    const viewAllLink = existingConfig.view_all_link || 'sarojini-shop.html';
    const viewAllText = existingConfig.view_all_text || 'View All Finds';

    dom.dynamicConfigPanel.innerHTML = `
      <div style="background: rgba(225, 29, 72, 0.08); border: 1px solid rgba(225, 29, 72, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <h4 style="font-size: 0.88rem; color: #fecdd3; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.04em;">
            <i class="fas fa-shopping-bag" style="color: #e11d48; margin-right: 6px;"></i> Curated Sarojini Products Selection & Ordering
          </h4>
          <span class="badge" style="background: #e11d48; color: #fff; font-size: 0.72rem; padding: 3px 8px;" id="selected-prods-badge">
            ${state.modalSelectedProductIds.length} Selected
          </span>
        </div>
        <p style="font-size: 0.78rem; color: #cbd5e1; margin: 0; line-height: 1.4;">
          The customer storefront will display <strong>only</strong> the products listed below in this <strong>exact order</strong> (left to right). Use the arrow buttons (▲ / ▼) to reorder or (✕) to remove.
        </p>
      </div>

      <!-- 1. Currently Selected Products (Ordered List) -->
      <div style="margin-bottom: 18px;">
        <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
          <span>1. Selected Products in Display Order</span>
          <span style="font-size: 0.75rem; color: var(--admin-text-muted);">Top item appears first on storefront</span>
        </label>
        <div id="sarojini-selected-list" style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px; max-height: 240px; overflow-y: auto; padding: 4px; border: 1px solid var(--admin-card-border); border-radius: 8px; background: #090d16;">
          <!-- Populated by updateSarojiniSelectedList() -->
        </div>
      </div>

      <!-- 2. Product Picker / Add to Section -->
      <div style="margin-bottom: 16px;">
        <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
          <span>2. Add Sarojini Products to Section</span>
          <span style="font-size: 0.75rem; color: #94a3b8;">Click "+ Add" to append to the curated list</span>
        </label>
        <div style="display: flex; gap: 8px; margin-top: 6px; margin-bottom: 8px;">
          <input type="text" id="sarojini-picker-search" class="admin-input" placeholder="Search Sarojini products by title or department..." style="flex: 1; font-size: 0.85rem;">
          <select id="sarojini-picker-dept" class="admin-input" style="width: 140px; font-size: 0.82rem;">
            <option value="">All Lanes</option>
            <option value="WOMEN">Women</option>
            <option value="MEN">Men</option>
            <option value="ACCESSORIES">Accessories</option>
            <option value="FOOTWEAR">Footwear</option>
            <option value="BAGS">Bags</option>
            <option value="JEWELLERY">Jewellery</option>
            <option value="CAPS">Caps</option>
          </select>
        </div>
        <div id="sarojini-available-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; padding: 6px; border: 1px solid var(--admin-card-border); border-radius: 8px; background: #0f172a;">
          <!-- Populated by updateSarojiniAvailableList() -->
        </div>
      </div>

      <!-- Layout & Settings -->
      <div class="modal-grid-2" style="margin-top: 14px;">
        <div class="form-group">
          <label class="form-label">Grid Columns (Desktop)</label>
          <select id="cfg-grid-columns" class="admin-input" style="width: 100%;">
            <option value="6" ${cols == 6 ? 'selected' : ''}>6 Columns (Recommended Desktop Row)</option>
            <option value="4" ${cols == 4 ? 'selected' : ''}>4 Columns</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Max Limit to Display</label>
          <input type="number" id="cfg-grid-limit" class="admin-input" min="1" max="24" value="${limit}" style="width: 100%;">
        </div>
      </div>
      <div class="modal-grid-2" style="margin-top: 10px;">
        <div class="form-group">
          <label class="form-label">"View All" Button Link</label>
          <input type="text" id="cfg-grid-view-all-link" class="admin-input" value="${escapeHtml(viewAllLink)}" style="width: 100%;">
        </div>
        <div class="form-group">
          <label class="form-label">"View All" Button Text</label>
          <input type="text" id="cfg-grid-view-all-text" class="admin-input" value="${escapeHtml(viewAllText)}" style="width: 100%;">
        </div>
      </div>
    `;

    function updateSarojiniSelectedList() {
      const container = document.getElementById("sarojini-selected-list");
      const badge = document.getElementById("selected-prods-badge");
      if (badge) badge.textContent = `${state.modalSelectedProductIds.length} Selected`;

      if (state.modalSelectedProductIds.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--admin-text-muted); font-size: 0.85rem;">
            <i class="fas fa-box-open" style="font-size: 1.5rem; display: block; margin-bottom: 6px; opacity: 0.5;"></i>
            No products selected yet. Select products from the list below to feature in this section.
          </div>`;
        return;
      }

      container.innerHTML = state.modalSelectedProductIds.map((id, idx) => {
        const prod = state.sarojiniProducts.find(p => String(p.id) === String(id));
        const name = prod ? prod.name : `Product ID: ${id}`;
        const dept = prod?.department || 'BAZAAR';
        const price = prod ? formatPrice(prod.price) : '';
        const img = prod ? prod.image : 'assets/sarojni/prod-1-graphic-tee.png';
        const isInactive = prod && prod.is_active === false;
        const isFirst = idx === 0;
        const isLast = idx === state.modalSelectedProductIds.length - 1;

        return `
          <div class="sarojini-sel-item" data-id="${id}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #131b2e; border: 1px solid var(--admin-card-border); border-radius: 6px; padding: 6px 10px; ${isInactive ? 'opacity: 0.6;' : ''}">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <span style="font-weight: 800; font-size: 0.8rem; color: #a5b4fc; width: 22px; text-align: center;">#${idx + 1}</span>
              <img src="${img}" alt="" style="width: 34px; height: 34px; border-radius: 4px; object-fit: cover; background: #fff;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 600; font-size: 0.84rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(name)}
                  ${isInactive ? '<span class="badge" style="background:#450a0a; color:#f87171; font-size:0.65rem; margin-left:4px;">Deactivated</span>' : ''}
                </div>
                <div style="font-size: 0.72rem; color: #94a3b8;">
                  <span style="color: #e11d48; font-weight: 700;">${escapeHtml(dept)}</span> • ${price}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button type="button" class="btn-sarojini-move-up order-control-btn" data-idx="${idx}" ${isFirst ? 'disabled' : ''} title="Move Up">
                <i class="fas fa-chevron-up" style="font-size: 0.65rem;"></i>
              </button>
              <button type="button" class="btn-sarojini-move-down order-control-btn" data-idx="${idx}" ${isLast ? 'disabled' : ''} title="Move Down">
                <i class="fas fa-chevron-down" style="font-size: 0.65rem;"></i>
              </button>
              <button type="button" class="btn-sarojini-remove order-control-btn" data-id="${id}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Remove from Section">
                <i class="fas fa-times" style="font-size: 0.75rem;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Wire Up, Down, Remove
      container.querySelectorAll(".btn-sarojini-move-up").forEach(b => {
        b.addEventListener("click", () => {
          const idx = parseInt(b.getAttribute("data-idx"), 10);
          if (idx > 0) {
            const temp = state.modalSelectedProductIds[idx];
            state.modalSelectedProductIds[idx] = state.modalSelectedProductIds[idx - 1];
            state.modalSelectedProductIds[idx - 1] = temp;
            updateSarojiniSelectedList();
            updateSarojiniAvailableList();
          }
        });
      });

      container.querySelectorAll(".btn-sarojini-move-down").forEach(b => {
        b.addEventListener("click", () => {
          const idx = parseInt(b.getAttribute("data-idx"), 10);
          if (idx < state.modalSelectedProductIds.length - 1) {
            const temp = state.modalSelectedProductIds[idx];
            state.modalSelectedProductIds[idx] = state.modalSelectedProductIds[idx + 1];
            state.modalSelectedProductIds[idx + 1] = temp;
            updateSarojiniSelectedList();
            updateSarojiniAvailableList();
          }
        });
      });

      container.querySelectorAll(".btn-sarojini-remove").forEach(b => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          state.modalSelectedProductIds = state.modalSelectedProductIds.filter(pid => String(pid) !== String(id));
          updateSarojiniSelectedList();
          updateSarojiniAvailableList();
        });
      });
    }

    function updateSarojiniAvailableList() {
      const container = document.getElementById("sarojini-available-list");
      const searchBox = document.getElementById("sarojini-picker-search");
      const deptFilter = document.getElementById("sarojini-picker-dept");
      const q = (searchBox?.value || '').toLowerCase().trim();
      const dept = (deptFilter?.value || '').toUpperCase();

      const filtered = state.sarojiniProducts.filter(p => {
        if (q && !((p.name || '').toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q))) return false;
        if (dept && (p.department || '').toUpperCase() !== dept) return false;
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 18px; color: var(--admin-text-muted); font-size: 0.8rem;">
            No Sarojini products match the search query.
          </div>`;
        return;
      }

      container.innerHTML = filtered.map(p => {
        const isSelected = state.modalSelectedProductIds.some(id => String(id) === String(p.id));
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 6px; background: ${isSelected ? 'rgba(225, 29, 72, 0.1)' : '#0b1120'}; border: 1px solid ${isSelected ? 'rgba(225, 29, 72, 0.3)' : 'var(--admin-card-border)'};">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <img src="${p.image}" alt="" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; background: #fff;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 0.82rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(p.name)}
                </div>
                <div style="font-size: 0.72rem; color: #94a3b8;">
                  <span style="color: #e11d48; font-weight: 700;">${escapeHtml(p.department || 'BAZAAR')}</span> • ${formatPrice(p.price)}
                </div>
              </div>
            </div>
            <button type="button" class="btn-admin-secondary btn-toggle-sarojini-pick" data-id="${p.id}" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 700; ${isSelected ? 'background: #e11d48; color: #fff; border-color: #e11d48;' : ''}">
              ${isSelected ? '✓ Added' : '+ Add'}
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll(".btn-toggle-sarojini-pick").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const exists = state.modalSelectedProductIds.some(pid => String(pid) === String(id));
          if (exists) {
            state.modalSelectedProductIds = state.modalSelectedProductIds.filter(pid => String(pid) !== String(id));
          } else {
            state.modalSelectedProductIds.push(id);
          }
          updateSarojiniSelectedList();
          updateSarojiniAvailableList();
        });
      });
    }

    updateSarojiniSelectedList();
    updateSarojiniAvailableList();

    const searchInput = document.getElementById("sarojini-picker-search");
    const deptSelect = document.getElementById("sarojini-picker-dept");
    if (searchInput) searchInput.addEventListener("input", updateSarojiniAvailableList);
    if (deptSelect) deptSelect.addEventListener("change", updateSarojiniAvailableList);
  }

  // --- Dynamic Form Builder Sub-Panel ---
  function renderDynamicConfigFields(type, existingConfig = {}) {
    dom.dynamicConfigPanel.innerHTML = "";

    if (type === 'sarojini_trending' || (existingConfig && existingConfig.catalog_type === 'sarojini')) {
      renderSarojiniProductConfig(existingConfig);
      return;
    }

    if (type === 'product_grid') {
      const src = existingConfig.source || 'all';
      const limit = existingConfig.limit || 8;
      const cols = existingConfig.columns || 4;
      const selCat = existingConfig.category || '';
      const selBrand = existingConfig.brand || '';
      const selIds = new Set(existingConfig.product_ids || []);

      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-sliders-h" style="color: var(--admin-accent); margin-right: 6px;"></i> Product Grid Content Source
        </h4>

        <div class="modal-grid-2" style="margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Content Source</label>
            <select id="cfg-grid-source" class="admin-input" style="width: 100%;">
              <option value="all" ${src === 'all' ? 'selected' : ''}>All Catalog Products</option>
              <option value="category" ${src === 'category' ? 'selected' : ''}>By Category</option>
              <option value="brand" ${src === 'brand' ? 'selected' : ''}>By Brand</option>
              <option value="trending" ${src === 'trending' ? 'selected' : ''}>Trending Products</option>
              <option value="deals" ${src === 'deals' ? 'selected' : ''}>Discounted Deal Products</option>
              <option value="new_arrivals" ${src === 'new_arrivals' ? 'selected' : ''}>New Arrivals</option>
              <option value="specific" ${src === 'specific' ? 'selected' : ''}>Pick Specific Products</option>
            </select>
          </div>
          <div class="form-group" id="wrap-grid-category" style="${src === 'category' ? '' : 'display:none;'}">
            <label class="form-label">Select Category</label>
            <select id="cfg-grid-category" class="admin-input" style="width: 100%;">
              ${state.categories.map(c => `<option value="${c.slug || c.id}" ${selCat === (c.slug || c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="wrap-grid-brand" style="${src === 'brand' ? '' : 'display:none;'}">
            <label class="form-label">Enter Brand Name</label>
            <input type="text" id="cfg-grid-brand" class="admin-input" value="${escapeHtml(selBrand)}" placeholder="e.g. Nike, Jordan, VADI Atelier" style="width: 100%;">
          </div>
        </div>

        <!-- Specific Product Checklist (if source === specific) -->
        <div id="wrap-grid-specific" style="${src === 'specific' ? '' : 'display:none;'} margin-bottom: 14px;">
          <label class="form-label">Select Products to Feature</label>
          <input type="text" id="cfg-product-search" class="admin-input" placeholder="Search products by title..." style="width: 100%; margin-bottom: 8px; font-size: 0.85rem;">
          <div id="cfg-products-picker-list" style="max-height: 180px; overflow-y: auto; border: 1px solid var(--admin-card-border); border-radius: 6px; padding: 6px;">
            ${state.products.map(p => `
              <label class="product-pick-item" data-title="${(p.name || '').toLowerCase()}">
                <input type="checkbox" class="cfg-product-checkbox" value="${p.id}" ${selIds.has(p.id) ? 'checked' : ''}>
                <img src="${p.image}" class="product-pick-thumb" alt="">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 0.85rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${formatPrice(p.price)} • ${p.brand || 'VADI'}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Layout & Limits -->
        <div class="modal-grid-2" style="margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Max Products to Show</label>
            <select id="cfg-grid-limit" class="admin-input" style="width: 100%;">
              <option value="4" ${limit == 4 ? 'selected' : ''}>4 Products</option>
              <option value="6" ${limit == 6 ? 'selected' : ''}>6 Products</option>
              <option value="8" ${limit == 8 ? 'selected' : ''}>8 Products</option>
              <option value="12" ${limit == 12 ? 'selected' : ''}>12 Products</option>
              <option value="16" ${limit == 16 ? 'selected' : ''}>16 Products</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Columns Per Row</label>
            <select id="cfg-grid-columns" class="admin-input" style="width: 100%;">
              <option value="2" ${cols == 2 ? 'selected' : ''}>2 Columns</option>
              <option value="3" ${cols == 3 ? 'selected' : ''}>3 Columns</option>
              <option value="4" ${cols == 4 ? 'selected' : ''}>4 Columns (Default)</option>
            </select>
          </div>
        </div>

        <!-- Toggles & View All -->
        <div class="modal-grid-2">
          <div class="form-group">
            <label class="form-label">"View All" Button Link (Optional)</label>
            <input type="text" id="cfg-grid-view-all-link" class="admin-input" value="${escapeHtml(existingConfig.view_all_link || 'shop.html')}" placeholder="e.g. shop.html?category=shoes" style="width: 100%;">
          </div>
          <div class="form-group">
            <label class="form-label">"View All" Button Text</label>
            <input type="text" id="cfg-grid-view-all-text" class="admin-input" value="${escapeHtml(existingConfig.view_all_text || 'View All Collection')}" placeholder="e.g. View All Collection" style="width: 100%;">
          </div>
        </div>

        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 14px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #cbd5e1; cursor: pointer;">
            <input type="checkbox" id="cfg-grid-show-price" ${existingConfig.show_price !== false ? 'checked' : ''}> Show Price
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #cbd5e1; cursor: pointer;">
            <input type="checkbox" id="cfg-grid-show-rating" ${existingConfig.show_rating !== false ? 'checked' : ''}> Show Rating
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #cbd5e1; cursor: pointer;">
            <input type="checkbox" id="cfg-grid-show-discount" ${existingConfig.show_discount !== false ? 'checked' : ''}> Show Discount Badge
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #cbd5e1; cursor: pointer;">
            <input type="checkbox" id="cfg-grid-show-wishlist" ${existingConfig.show_wishlist !== false ? 'checked' : ''}> Show Wishlist Button
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #cbd5e1; cursor: pointer;">
            <input type="checkbox" id="cfg-grid-show-cart" ${existingConfig.show_add_to_cart !== false ? 'checked' : ''}> Show Add to Bag Button
          </label>
        </div>`;

      // Event listener for source select
      const srcEl = document.getElementById("cfg-grid-source");
      const catWrap = document.getElementById("wrap-grid-category");
      const brandWrap = document.getElementById("wrap-grid-brand");
      const specWrap = document.getElementById("wrap-grid-specific");
      srcEl.addEventListener("change", () => {
        catWrap.style.display = srcEl.value === 'category' ? 'block' : 'none';
        brandWrap.style.display = srcEl.value === 'brand' ? 'block' : 'none';
        specWrap.style.display = srcEl.value === 'specific' ? 'block' : 'none';
      });

      // Product search filter
      const searchBox = document.getElementById("cfg-product-search");
      if (searchBox) {
        searchBox.addEventListener("input", (e) => {
          const val = e.target.value.toLowerCase().trim();
          document.querySelectorAll("#cfg-products-picker-list .product-pick-item").forEach(item => {
            const title = item.getAttribute("data-title") || "";
            item.style.display = title.includes(val) ? "flex" : "none";
          });
        });
      }

    } else if (type === 'promotional_banner') {
      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-image" style="color: var(--admin-accent); margin-right: 6px;"></i> Promotional Banner Settings
        </h4>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Background Image URL</label>
          <input type="url" id="cfg-banner-img" class="admin-input" value="${escapeHtml(existingConfig.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80')}" placeholder="https://..." style="width: 100%;">
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Body Description Text</label>
          <textarea id="cfg-banner-body" class="admin-input" rows="2" placeholder="Explore exclusive artisan curations crafted for seasonal distinction." style="width: 100%;">${escapeHtml(existingConfig.body_text || '')}</textarea>
        </div>
        <div class="modal-grid-2">
          <div class="form-group">
            <label class="form-label">CTA Button Text</label>
            <input type="text" id="cfg-banner-cta-text" class="admin-input" value="${escapeHtml(existingConfig.cta_text || 'Shop The Look')}" style="width: 100%;">
          </div>
          <div class="form-group">
            <label class="form-label">CTA Button Link</label>
            <input type="text" id="cfg-banner-cta-link" class="admin-input" value="${escapeHtml(existingConfig.cta_link || 'shop.html')}" style="width: 100%;">
          </div>
        </div>`;

    } else if (type === 'category_grid' || type === 'categories') {
      const cols = existingConfig.columns || 4;
      const viewAllLink = existingConfig.view_all_link || 'shop.html';
      const viewAllText = existingConfig.view_all_text || 'Browse All Categories';
      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-th-large" style="color: var(--admin-accent); margin-right: 6px;"></i> Category Grid Configuration
        </h4>
        <div class="modal-grid-2" style="margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Grid Columns</label>
            <select id="cfg-cat-columns" class="admin-input" style="width: 100%;">
              <option value="3" ${cols == 3 ? 'selected' : ''}>3 Columns</option>
              <option value="4" ${cols == 4 ? 'selected' : ''}>4 Columns (Standard)</option>
              <option value="6" ${cols == 6 ? 'selected' : ''}>6 Columns</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">"View All" Button Link</label>
            <input type="text" id="cfg-cat-view-all-link" class="admin-input" value="${escapeHtml(viewAllLink)}" style="width: 100%;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">"View All" Button Text</label>
          <input type="text" id="cfg-cat-view-all-text" class="admin-input" value="${escapeHtml(viewAllText)}" style="width: 100%;">
        </div>`;

    } else if (type === 'brands') {
      const autoplay = existingConfig.autoplay !== false;
      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-gem" style="color: var(--admin-accent); margin-right: 6px;"></i> Brand Strip Settings
        </h4>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #e2e8f0; cursor: pointer;">
            <input type="checkbox" id="cfg-brand-autoplay" ${autoplay ? 'checked' : ''}>
            <span>Autoplay Marquee Scroll Animation</span>
          </label>
        </div>`;

    } else if (type === 'custom') {
      const htmlContent = existingConfig.html_content || '';
      const ctaText = existingConfig.cta_text || '';
      const ctaLink = existingConfig.cta_link || '';
      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-code" style="color: var(--admin-accent); margin-right: 6px;"></i> Custom Content Configuration
        </h4>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Custom HTML or Description Text</label>
          <textarea id="cfg-custom-html" class="admin-input" rows="4" placeholder="Enter custom text, marketing message, or HTML..." style="width: 100%; font-family: monospace; font-size: 0.85rem;">${escapeHtml(htmlContent)}</textarea>
        </div>
        <div class="modal-grid-2">
          <div class="form-group">
            <label class="form-label">Optional Button Text</label>
            <input type="text" id="cfg-custom-cta-text" class="admin-input" value="${escapeHtml(ctaText)}" placeholder="e.g. Learn More" style="width: 100%;">
          </div>
          <div class="form-group">
            <label class="form-label">Optional Button Link</label>
            <input type="text" id="cfg-custom-cta-link" class="admin-input" value="${escapeHtml(ctaLink)}" placeholder="e.g. shop.html" style="width: 100%;">
          </div>
        </div>`;

    } else if (type === 'advertisement') {
      const p = existingConfig.placement || 'below_hero';
      dom.dynamicConfigPanel.innerHTML = `
        <h4 style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">
          <i class="fas fa-bullhorn" style="color: var(--admin-accent); margin-right: 6px;"></i> Advertisement Placement Rule
        </h4>
        <div class="form-group">
          <label class="form-label">Target Placement Slot</label>
          <select id="cfg-ad-placement" class="admin-input" style="width: 100%;">
            <option value="below_hero" ${p === 'below_hero' ? 'selected' : ''}>Below Hero (Full-Width Showcase)</option>
            <option value="above_trending" ${p === 'above_trending' ? 'selected' : ''}>Above Trending Products</option>
            <option value="below_trending" ${p === 'below_trending' ? 'selected' : ''}>Below Trending Products</option>
            <option value="above_new_arrivals" ${p === 'above_new_arrivals' ? 'selected' : ''}>Above New Arrivals</option>
            <option value="above_deals" ${p === 'above_deals' ? 'selected' : ''}>Above Flash Deals</option>
            <option value="below_bogo" ${p === 'below_bogo' ? 'selected' : ''}>Below BOGO Showcase</option>
          </select>
          <span class="form-help">Connects to active banners created in Admin → Advertisements.</span>
        </div>`;
    } else {
      dom.dynamicConfigPanel.innerHTML = `
        <div style="font-size: 0.85rem; color: #94a3b8; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-check-circle" style="color: #10b981;"></i>
          <span>This is a core VADI storefront section. Its layout, dynamic queries, and responsive design are fully managed.</span>
        </div>`;
    }
  }

  // --- Modal Open / Close Handlers ---
  function openBuilderModal(sec = null) {
    state.editingSectionId = sec ? sec.id : null;
    dom.builderTitle.textContent = sec ? "Edit Homepage Section" : "Create Homepage Section";

    if (sec) {
      dom.secId.value = sec.id || '';
      dom.secType.value = sec.section_type || 'product_grid';
      dom.secTitle.value = sec.title || '';
      dom.secSubtitle.value = sec.subtitle || '';
      dom.secOrder.value = sec.display_order || (state.sections.length + 1);
      dom.secTheme.value = (sec.background_config && sec.background_config.theme) || (isSarojiniSection(sec) ? 'light' : 'dark');
      dom.secPadding.value = (sec.background_config && sec.background_config.padding) || 'standard';
      dom.secIsActive.checked = sec.is_active !== false;
      dom.secStartDate.value = sec.start_date ? sec.start_date.slice(0, 16) : '';
      dom.secEndDate.value = sec.end_date ? sec.end_date.slice(0, 16) : '';
      renderDynamicConfigFields(sec.section_type, sec.content_config || {});
    } else {
      dom.secId.value = "";
      const isSar = state.currentStore === 'sarojini';
      const defaultType = isSar ? 'sarojini_trending' : 'product_grid';
      dom.secType.value = defaultType;
      dom.secTitle.value = isSar ? "Trending Sarojini Finds" : "";
      dom.secSubtitle.value = isSar ? "Fresh streetwear drops, viral tops, and daily staples handpicked this week." : "";
      dom.secOrder.value = getFilteredSectionsByStore().length + 1;
      dom.secTheme.value = isSar ? "light" : "dark";
      dom.secPadding.value = "standard";
      dom.secIsActive.checked = true;
      dom.secStartDate.value = "";
      dom.secEndDate.value = "";
      renderDynamicConfigFields(defaultType, isSar ? { catalog_type: 'sarojini', source: 'specific', product_ids: [] } : {});
    }

    dom.modalBuilder.classList.add("active");
    dom.modalBuilder.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeBuilderModal() {
    dom.modalBuilder.classList.remove("active");
    dom.modalBuilder.classList.remove("show");
    document.body.style.overflow = "";
    state.editingSectionId = null;
  }

  dom.secType.addEventListener("change", () => {
    renderDynamicConfigFields(dom.secType.value, {});
  });

  dom.btnAddSection.addEventListener("click", () => openBuilderModal());
  dom.btnCloseBuilder.addEventListener("click", closeBuilderModal);
  dom.btnCancelBuilder.addEventListener("click", closeBuilderModal);

  // --- Collect Form Config Data ---
  function collectFormPayload() {
    const type = dom.secType.value;
    const contentCfg = {};

    if (type === 'sarojini_trending') {
      contentCfg.catalog_type = 'sarojini';
      contentCfg.source = 'specific';
      contentCfg.product_ids = Array.isArray(state.modalSelectedProductIds) ? [...state.modalSelectedProductIds] : [];
      contentCfg.limit = parseInt(document.getElementById("cfg-grid-limit")?.value, 10) || 6;
      contentCfg.columns = parseInt(document.getElementById("cfg-grid-columns")?.value, 10) || 6;
      contentCfg.view_all_link = document.getElementById("cfg-grid-view-all-link")?.value.trim() || 'sarojini-shop.html';
      contentCfg.view_all_text = document.getElementById("cfg-grid-view-all-text")?.value.trim() || 'View All Finds';

    } else if (type === 'product_grid') {
      const srcEl = document.getElementById("cfg-grid-source");
      contentCfg.source = srcEl ? srcEl.value : 'all';
      if (contentCfg.source === 'category') {
        const catEl = document.getElementById("cfg-grid-category");
        contentCfg.category = catEl ? catEl.value : '';
      } else if (contentCfg.source === 'brand') {
        const brandEl = document.getElementById("cfg-grid-brand");
        contentCfg.brand = brandEl ? brandEl.value.trim() : '';
      } else if (contentCfg.source === 'specific') {
        const checked = Array.from(document.querySelectorAll(".cfg-product-checkbox:checked")).map(cb => cb.value);
        contentCfg.product_ids = checked;
      }
      contentCfg.limit = parseInt(document.getElementById("cfg-grid-limit").value, 10) || 8;
      contentCfg.columns = parseInt(document.getElementById("cfg-grid-columns").value, 10) || 4;
      contentCfg.view_all_link = (document.getElementById("cfg-grid-view-all-link") ? document.getElementById("cfg-grid-view-all-link").value.trim() : '');
      contentCfg.view_all_text = (document.getElementById("cfg-grid-view-all-text") ? document.getElementById("cfg-grid-view-all-text").value.trim() : '');
      contentCfg.show_price = document.getElementById("cfg-grid-show-price").checked;
      contentCfg.show_rating = document.getElementById("cfg-grid-show-rating").checked;
      contentCfg.show_discount = document.getElementById("cfg-grid-show-discount").checked;
      contentCfg.show_wishlist = document.getElementById("cfg-grid-show-wishlist").checked;
      contentCfg.show_add_to_cart = document.getElementById("cfg-grid-show-cart").checked;

    } else if (type === 'promotional_banner') {
      contentCfg.image_url = document.getElementById("cfg-banner-img") ? document.getElementById("cfg-banner-img").value.trim() : '';
      contentCfg.body_text = document.getElementById("cfg-banner-body") ? document.getElementById("cfg-banner-body").value.trim() : '';
      contentCfg.cta_text = document.getElementById("cfg-banner-cta-text") ? document.getElementById("cfg-banner-cta-text").value.trim() : 'Explore Offer';
      contentCfg.cta_link = document.getElementById("cfg-banner-cta-link") ? document.getElementById("cfg-banner-cta-link").value.trim() : 'shop.html';

    } else if (type === 'category_grid' || type === 'categories') {
      contentCfg.columns = parseInt(document.getElementById("cfg-cat-columns")?.value, 10) || 4;
      contentCfg.view_all_link = document.getElementById("cfg-cat-view-all-link")?.value.trim() || 'shop.html';
      contentCfg.view_all_text = document.getElementById("cfg-cat-view-all-text")?.value.trim() || 'Browse All Categories';

    } else if (type === 'brands') {
      contentCfg.autoplay = document.getElementById("cfg-brand-autoplay")?.checked !== false;

    } else if (type === 'custom') {
      contentCfg.html_content = document.getElementById("cfg-custom-html")?.value || '';
      contentCfg.cta_text = document.getElementById("cfg-custom-cta-text")?.value.trim() || '';
      contentCfg.cta_link = document.getElementById("cfg-custom-cta-link")?.value.trim() || '';

    } else if (type === 'advertisement') {
      contentCfg.placement = document.getElementById("cfg-ad-placement") ? document.getElementById("cfg-ad-placement").value : 'below_hero';
    }

    const bgCfg = {
      theme: dom.secTheme.value,
      padding: dom.secPadding.value
    };

    const existingId = dom.secId.value ? dom.secId.value.trim() : null;
    const finalId = existingId || generateUuid();

    let displayOrder = parseInt(dom.secOrder.value, 10);
    if (isNaN(displayOrder) || displayOrder <= 0) {
      displayOrder = state.sections.length + 1;
    }

    return {
      id: finalId,
      section_type: type,
      title: dom.secTitle.value.trim(),
      subtitle: dom.secSubtitle.value.trim(),
      is_active: dom.secIsActive.checked,
      display_order: displayOrder,
      background_config: bgCfg,
      content_config: contentCfg,
      start_date: dom.secStartDate.value ? new Date(dom.secStartDate.value).toISOString() : null,
      end_date: dom.secEndDate.value ? new Date(dom.secEndDate.value).toISOString() : null,
      updated_at: new Date().toISOString()
    };
  }

  // --- Save Section (Create / Update) ---
  dom.formBuilder.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("btn-save-section");
    const origBtnHtml = saveBtn ? saveBtn.innerHTML : "Save Section";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving to Database...`;
    }

    try {
      const payload = collectFormPayload();
      const isEdit = Boolean(state.editingSectionId);

      // Save directly to Supabase first
      const saveRes = await saveSectionToSupabase(payload);
      if (!saveRes.success) {
        showToast("Database Save Failed: " + (saveRes.error || "Permission Denied"), "error");
        return;
      }

      if (isEdit) {
        const idx = state.sections.findIndex(s => s.id === payload.id);
        if (idx !== -1) state.sections[idx] = payload;
        else state.sections.push(payload);
      } else {
        state.sections.push(payload);
      }

      // Re-index display_order and sort
      state.sections.sort((a, b) => (parseInt(a.display_order, 10) || 0) - (parseInt(b.display_order, 10) || 0));

      closeBuilderModal();
      renderSectionsTable();
      updateMetrics();
      showToast(isEdit ? "Section updated successfully!" : "New section added successfully!", "success");
    } catch (err) {
      console.error("Save section error:", err);
      showToast("Error saving section: " + (err.message || err), "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origBtnHtml;
      }
    }
  });

  // --- Save Individual Section to Supabase ---
  async function saveSectionToSupabase(payload) {
    let savedInTable = false;
    let tableError = null;

    if (client) {
      try {
        const { data, error } = await client
          .from("homepage_sections")
          .upsert([payload], { onConflict: "id" })
          .select();
        if (error) {
          tableError = error;
          console.warn("[HomepageSections] Direct table upsert notice:", error);
        } else {
          savedInTable = true;
        }
      } catch (err) {
        tableError = err;
        console.warn("[HomepageSections] Table upsert exception:", err);
      }
    }

    // Sync to store_settings table (key = 'homepage_sections') for instant fallback read
    const updatedSections = [...state.sections];
    const idx = updatedSections.findIndex(s => s.id === payload.id);
    if (idx !== -1) updatedSections[idx] = payload;
    else updatedSections.push(payload);
    updatedSections.sort((a, b) => (parseInt(a.display_order, 10) || 0) - (parseInt(b.display_order, 10) || 0));

    let settingsSaved = false;
    let settingsError = null;
    if (client) {
      try {
        const { error } = await client.from("store_settings").upsert([{
          key: "homepage_sections",
          value: updatedSections,
          description: "Dynamic Homepage Section Configurations",
          updated_at: new Date().toISOString()
        }], { onConflict: "key" });
        if (!error) settingsSaved = true;
        else settingsError = error;
      } catch (err) {
        settingsError = err;
      }

      // Sync Sarojini specific section for dual redundancy
      if (isSarojiniSection(payload)) {
        try {
          await client.from("store_settings").upsert([{
            key: "sarojini_featured_section",
            value: payload,
            description: "Curated Sarojini Bazaar Trending Section",
            updated_at: new Date().toISOString()
          }], { onConflict: "key" });
        } catch (_) {}
      }
    }

    // Always update localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSections));
      localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
    } catch (_) {}

    // Invalidate client cache
    if (window.VeloraCache) {
      try { window.VeloraCache.invalidate('homepage_sections'); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("velora:homepage-sections-updated"));

    // If both failed with errors, return detailed error
    if (!savedInTable && !settingsSaved && (tableError || settingsError)) {
      return {
        success: false,
        error: tableError?.message || settingsError?.message || "Check Supabase permissions"
      };
    }

    return { success: true, savedInTable, settingsSaved };
  }

  // --- Persist All Sections to Supabase ---
  async function persistAllSectionsToSupabase() {
    let savedInTable = false;
    let tableError = null;

    if (client) {
      try {
        const { error } = await client
          .from("homepage_sections")
          .upsert(state.sections, { onConflict: "id" });
        if (!error) savedInTable = true;
        else tableError = error;
      } catch (err) {
        tableError = err;
        console.warn("homepage_sections upsert notice:", err);
      }
    }

    // Synchronize to store_settings table (key = 'homepage_sections') for guaranteed persistence
    let settingsSaved = false;
    let settingsError = null;
    if (client) {
      try {
        const { error } = await client.from("store_settings").upsert([{
          key: "homepage_sections",
          value: state.sections,
          description: "Dynamic Homepage Section Configurations",
          updated_at: new Date().toISOString()
        }], { onConflict: "key" });
        if (!error) settingsSaved = true;
        else settingsError = error;
      } catch (err) {
        settingsError = err;
      }
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sections));
      localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
    } catch (_) {}

    // Invalidate client cache
    if (window.VeloraCache) {
      try { window.VeloraCache.invalidate('homepage_sections'); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("velora:homepage-sections-updated"));

    if (!savedInTable && !settingsSaved && (tableError || settingsError)) {
      return { success: false, error: tableError?.message || settingsError?.message };
    }
    return { success: true };
  }

  // --- Reorder Actions (Up / Down) ---
  function moveSection(id, direction) {
    const idx = state.sections.findIndex(s => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= state.sections.length) return;

    // Swap items
    const temp = state.sections[idx];
    state.sections[idx] = state.sections[targetIdx];
    state.sections[targetIdx] = temp;

    // Re-assign display_order sequentially
    state.sections.forEach((sec, i) => {
      sec.display_order = i + 1;
    });

    state.hasPendingReorder = true;
    dom.btnSaveOrder.style.display = "inline-flex";
    dom.btnSaveOrder.classList.add("btn-admin-primary");
    renderSectionsTable();
  }

  dom.btnSaveOrder.addEventListener("click", async () => {
    dom.btnSaveOrder.disabled = true;
    dom.btnSaveOrder.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    const res = await persistAllSectionsToSupabase();
    state.hasPendingReorder = false;
    dom.btnSaveOrder.style.display = "none";
    dom.btnSaveOrder.disabled = false;
    dom.btnSaveOrder.innerHTML = `<i class="fas fa-sort-amount-down"></i> Save Display Order`;
    if (res.success) {
      showToast("Homepage section order saved successfully!", "success");
    } else {
      showToast("Notice: " + (res.error || "Order updated locally"), "info");
    }
  });

  // --- Bind Table Actions ---
  function bindTableEvents() {
    // Reorder buttons
    document.querySelectorAll(".btn-move-up").forEach(btn => {
      btn.addEventListener("click", () => moveSection(btn.dataset.id, 'up'));
    });
    document.querySelectorAll(".btn-move-down").forEach(btn => {
      btn.addEventListener("click", () => moveSection(btn.dataset.id, 'down'));
    });

    // Active Toggle Switch
    document.querySelectorAll(".sec-toggle-switch").forEach(sw => {
      sw.addEventListener("change", async () => {
        const sec = state.sections.find(s => s.id === sw.dataset.id);
        if (sec) {
          sec.is_active = sw.checked;
          const res = await saveSectionToSupabase(sec);
          updateMetrics();
          renderSectionsTable();
          if (res.success) {
            showToast(`Section "${sec.title}" is now ${sec.is_active ? 'Active' : 'Inactive'}`, "info");
          } else {
            showToast(`Status updated: ${res.error || 'Saved locally'}`, "info");
          }
        }
      });
    });

    // Edit button
    document.querySelectorAll(".btn-edit-sec").forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = state.sections.find(s => s.id === btn.dataset.id);
        if (sec) openBuilderModal(sec);
      });
    });

    // Duplicate button
    document.querySelectorAll(".btn-duplicate-sec").forEach(btn => {
      btn.addEventListener("click", async () => {
        const sec = state.sections.find(s => s.id === btn.dataset.id);
        if (!sec) return;
        const copy = JSON.parse(JSON.stringify(sec));
        copy.id = generateUuid();
        copy.title = `${copy.title} (Copy)`;
        copy.display_order = state.sections.length + 1;
        state.sections.push(copy);
        await saveSectionToSupabase(copy);
        renderSectionsTable();
        updateMetrics();
        showToast(`Duplicated "${copy.title}" successfully!`, "success");
      });
    });

    // Delete button
    document.querySelectorAll(".btn-delete-sec").forEach(btn => {
      btn.addEventListener("click", async () => {
        const sec = state.sections.find(s => s.id === btn.dataset.id);
        if (!sec) return;
        if (confirm(`Are you sure you want to delete "${sec.title}"?`)) {
          state.sections = state.sections.filter(s => s.id !== sec.id);
          state.sections.forEach((s, i) => s.display_order = i + 1);
          if (client) {
            try {
              await client.from("homepage_sections").delete().eq("id", sec.id);
            } catch (e) {
              console.warn("Direct delete notice:", e);
            }
          }
          await persistAllSectionsToSupabase();
          renderSectionsTable();
          updateMetrics();
          showToast(`Deleted section "${sec.title}"`, "info");
        }
      });
    });

    // Preview button
    document.querySelectorAll(".btn-preview-sec").forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = state.sections.find(s => s.id === btn.dataset.id);
        if (sec) renderPreviewModal(sec);
      });
    });
  }

  // --- Live Preview Modal ---
  function renderPreviewModal(sec) {
    dom.previewModalTitle.textContent = sec.title || "Section Preview";
    dom.previewTypeBadge.textContent = formatSectionTypeLabel(sec.section_type);
    dom.previewTypeBadge.className = `type-badge ${sec.section_type}`;

    let html = "";
    if (sec.section_type === 'sarojini_trending' || (sec.content_config && sec.content_config.catalog_type === 'sarojini')) {
      const cfg = sec.content_config || {};
      const selIds = cfg.product_ids || [];
      const prodMap = new Map();
      state.sarojiniProducts.forEach(p => prodMap.set(String(p.id), p));
      const displayProds = selIds.map(id => prodMap.get(String(id))).filter(Boolean);

      html = `
        <div style="margin-bottom: 20px; background: #faf7f2; border: 1px solid #dfd7c8; border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <span style="font-size: 0.75rem; text-transform: uppercase; color: #9e2a2b; font-weight: 700; letter-spacing: 0.05em;">${escapeHtml(sec.subtitle || 'Live From The Market')}</span>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: #1c1917; margin-top: 4px; font-family: Playfair Display, serif;">${escapeHtml(sec.title || 'Trending Sarojini Finds')}</h2>
            </div>
            <span class="badge" style="background: #9e2a2b; color: #fff;">${displayProds.length} Curated Cards (6-Col Layout)</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
            ${displayProds.map(p => `
              <div style="background: #fff; border: 1px solid #dfd7c8; border-radius: 8px; overflow: hidden; padding: 8px;">
                <div style="width: 100%; aspect-ratio: 1/1; background: #f6f3ec; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  <img src="${p.image}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="">
                </div>
                <div style="margin-top: 6px;">
                  <div style="font-size: 0.65rem; color: #9e2a2b; font-weight: 700; text-transform: uppercase;">${escapeHtml(p.department || 'BAZAAR')}</div>
                  <div style="font-size: 0.78rem; font-weight: 600; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                  <div style="font-size: 0.82rem; font-weight: 700; color: #1c1917; margin-top: 2px;">${formatPrice(p.price)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    } else if (sec.section_type === 'product_grid') {
      const cfg = sec.content_config || {};
      const cols = cfg.columns || 4;
      const limit = cfg.limit || 4;
      let prods = [...state.products];
      if (cfg.source === 'category' && cfg.category) prods = prods.filter(p => (p.category || '').toLowerCase() === cfg.category.toLowerCase());
      if (cfg.source === 'brand' && cfg.brand) prods = prods.filter(p => (p.brand || '').toLowerCase() === cfg.brand.toLowerCase());
      const displayProds = prods.slice(0, limit);

      html = `
        <div style="margin-bottom: 20px;">
          <span style="font-size: 0.75rem; text-transform: uppercase; color: #a5b4fc; letter-spacing: 0.05em;">${escapeHtml(sec.subtitle || 'Curated Picks')}</span>
          <h2 style="font-size: 1.6rem; font-weight: 700; color: #fff; margin-top: 4px;">${escapeHtml(sec.title || 'Product Grid')}</h2>
        </div>
        <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 16px;">
          ${displayProds.map(p => `
            <div style="background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; padding: 12px;">
              <img src="${p.image}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px;" alt="">
              <div style="margin-top: 10px;">
                <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">${p.brand || 'VADI'}</div>
                <div style="font-size: 0.88rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-top: 4px;">${formatPrice(p.price)}</div>
              </div>
            </div>
          `).join('')}
        </div>`;
    } else if (sec.section_type === 'promotional_banner') {
      const cfg = sec.content_config || {};
      const img = cfg.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80';
      html = `
        <div style="position: relative; border-radius: 12px; padding: 36px; background: linear-gradient(rgba(10,14,26,0.85), rgba(10,14,26,0.9)), url('${img}') center/cover no-repeat; border: 1px solid rgba(255,255,255,0.1);">
          <span style="font-size: 0.75rem; text-transform: uppercase; color: #f472b6; font-weight: 700;">${escapeHtml(sec.subtitle || 'Special Feature')}</span>
          <h2 style="font-size: 2rem; color: #fff; font-weight: 700; margin: 8px 0;">${escapeHtml(sec.title || 'Seasonal Showcase')}</h2>
          <p style="color: #cbd5e1; font-size: 0.95rem; max-width: 500px; margin-bottom: 20px;">${escapeHtml(cfg.body_text || 'Discover effortless elevated style crafted for distinction.')}</p>
          <button type="button" class="btn-admin-primary" style="padding: 10px 24px;">${escapeHtml(cfg.cta_text || 'Explore Offer')} →</button>
        </div>`;
    } else {
      html = `
        <div style="text-align: center; padding: 40px 20px;">
          <i class="${getSectionTypeIcon(sec.section_type)}" style="font-size: 3rem; color: var(--admin-accent); margin-bottom: 16px;"></i>
          <h2 style="color: #fff; font-size: 1.5rem; margin-bottom: 8px;">${escapeHtml(sec.title || formatSectionTypeLabel(sec.section_type))}</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; max-width: 480px; margin: 0 auto;">${escapeHtml(sec.subtitle || 'Standard responsive storefront component rendered with live data.')}</p>
        </div>`;
    }

    dom.previewContentBox.innerHTML = html;
    dom.modalPreview.classList.add("active");
    dom.modalPreview.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closePreviewModal() {
    dom.modalPreview.classList.remove("active");
    dom.modalPreview.classList.remove("show");
    document.body.style.overflow = "";
  }

  dom.btnClosePreview.addEventListener("click", closePreviewModal);
  dom.btnClosePreviewFooter.addEventListener("click", closePreviewModal);

  // Close modals on backdrop click
  dom.modalBuilder.addEventListener("click", (e) => {
    if (e.target === dom.modalBuilder) closeBuilderModal();
  });
  dom.modalPreview.addEventListener("click", (e) => {
    if (e.target === dom.modalPreview) closePreviewModal();
  });

  // Close modals on Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (dom.modalBuilder.classList.contains("active") || dom.modalBuilder.classList.contains("show")) {
        closeBuilderModal();
      }
      if (dom.modalPreview.classList.contains("active") || dom.modalPreview.classList.contains("show")) {
        closePreviewModal();
      }
    }
  });

  // Search filter
  if (dom.searchInput) {
    dom.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderSectionsTable();
    });
  }

  // Store Scope Tabs
  if (dom.tabStoreMain) {
    dom.tabStoreMain.addEventListener("click", () => setStoreScope("main"));
  }
  if (dom.tabStoreSarojini) {
    dom.tabStoreSarojini.addEventListener("click", () => setStoreScope("sarojini"));
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("store") === "sarojini") {
    state.currentStore = "sarojini";
  }

  // --- Initial Load ---
  await loadCatalogDependencies();
  await loadSections();

  // If query param set to sarojini, ensure visual active state on tabs
  if (state.currentStore === "sarojini") {
    setStoreScope("sarojini");
  }
});

