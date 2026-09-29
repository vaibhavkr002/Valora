/**
 * VADI Admin Panel - Sarojini Homepage Sections Controller
 * Full backend-driven management for all 19 Sarojini Bazaar storefront sections.
 * Supports manual product curation, reordering, automatic rule overrides,
 * combo offer badge labelling, and instant client synchronization.
 */

document.addEventListener("DOMContentLoaded", async () => {
  'use strict';

  // 1. Guard route via AdminAuth
  let admin = null;
  if (window.AdminAuth && typeof window.AdminAuth.guardRoute === "function") {
    admin = await window.AdminAuth.guardRoute();
    if (!admin || !admin.isAdmin) return;
  }
  if (typeof window.initLayout === "function") {
    window.initLayout(admin);
  }

  const client = (window.AdminAuth && typeof window.AdminAuth.getClient === "function" && window.AdminAuth.getClient()) || window.supabaseClient;
  const STORAGE_KEY = "sarojini_homepage_sections";
  const formatPrice = (amt) => (window.formatINR ? window.formatINR(amt) : ('₹' + Math.round(Number(amt) || 0).toLocaleString('en-IN')));

  // --- 19 Standard Sarojini Homepage Sections Manifest ---
  const DEFAULT_SAROJINI_SECTIONS = [
    {
      id: "22222222-2222-4222-a222-000000000001",
      section_type: "sarojini_hero",
      title: "Hero / Sarojini Bazaar Banner",
      subtitle: "Delhi's Iconic Street Bazaar. Curated & Delivered.",
      management_type: "config",
      is_active: true,
      display_order: 1,
      content_config: {
        catalog_type: "sarojini",
        tagline: "Authentic Delhi Street Fashion Online",
        badge_text: "VERIFIED STREET FINDS",
        button_text: "Explore Street Drops",
        button_link: "sarojini-shop.html"
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000002",
      section_type: "sarojini_departments",
      title: "Shop By Department",
      subtitle: "Navigate Delhi's famous market corners & lanes",
      management_type: "manual",
      is_active: true,
      display_order: 2,
      content_config: {
        catalog_type: "sarojini",
        departments: [
          { code: "WOMEN", name: "Women's Lane", lane: "LANE 01", label: "TOPS, DRESSES & KURTIS" },
          { code: "MEN", name: "Men's Lane", lane: "LANE 02", label: "OVERSIZED, SHIRTS & CARGOS" },
          { code: "ACCESSORIES", name: "Accessories Corner", lane: "CORNER 03", label: "BELTS, SCARVES & SHADES" },
          { code: "FOOTWEAR", name: "Footwear & Kicks", lane: "STREET 04", label: "SNEAKERS, SLIDES & FLATS" },
          { code: "BAGS", name: "Bags & Totes", lane: "CORNER 05", label: "SLINGS, TOTES & BACKPACKS" },
          { code: "JEWELLERY", name: "Jewellery Lane", lane: "LANE 06", label: "OXIDISED, EARRINGS & RINGS" },
          { code: "CAPS", name: "Cap Corner", lane: "CORNER 07", label: "HATS & SNAPBACKS" }
        ]
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000003",
      section_type: "sarojini_vibes",
      title: "What Are You Looking For?",
      subtitle: "Explore curated vibes and styles inspired by Delhi's trendiest streets.",
      management_type: "manual",
      is_active: true,
      display_order: 3,
      content_config: {
        catalog_type: "sarojini",
        vibes: [
          { id: "cute_girly", emoji: "🌸", title: "Cute & Girly", cue: "Floral & Pastels", style_query: "Cute & Girly", product_ids: [] },
          { id: "street_style", emoji: "🖤", title: "Street Style", cue: "Edgy & Oversized", style_query: "Streetwear", product_ids: [] },
          { id: "party_wear", emoji: "✨", title: "Party Wear", cue: "Glam & Chic", style_query: "Party Wear", product_ids: [] },
          { id: "minimal", emoji: "🤍", title: "Minimal", cue: "Clean & Neutral", style_query: "Minimal", product_ids: [] },
          { id: "y2k", emoji: "🔥", title: "Y2K", cue: "Retro 2000s Hits", style_query: "Y2K", product_ids: [] },
          { id: "premium_look", emoji: "💎", title: "Premium Look", cue: "Luxe Export Surplus", style_query: "Premium Look", product_ids: [] }
        ]
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000004",
      section_type: "sarojini_flash_deals",
      title: "⚡ Flash Deals",
      subtitle: "Limited-quantity street steals at rock-bottom prices. Grab before the timer runs out!",
      management_type: "automatic",
      is_active: true,
      display_order: 4,
      content_config: {
        catalog_type: "sarojini",
        limit: 6,
        min_discount: 20,
        show_timer: true,
        product_ids: []
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000005",
      section_type: "sarojini_trending",
      title: "Trending Sarojini Finds",
      subtitle: "Fresh streetwear drops, viral tops, and daily staples handpicked this week.",
      management_type: "manual",
      is_active: true,
      display_order: 5,
      content_config: {
        catalog_type: "sarojini",
        limit: 6,
        product_ids: []
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000006",
      section_type: "sarojini_under_199",
      title: "Under ₹199",
      subtitle: "Unbeatable Delhi street fashion and daily staples priced at ₹199 or less.",
      management_type: "automatic",
      is_active: true,
      display_order: 6,
      content_config: {
        catalog_type: "sarojini",
        limit: 6,
        max_price: 199
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000007",
      section_type: "sarojini_combo_offers",
      title: "Buy 1 Get 1 Free & Combo Offers",
      subtitle: "Exclusive street combo sets, multi-packs & buy-1-get-1 bazaar deals handpicked for maximum value.",
      management_type: "manual",
      is_active: true,
      display_order: 7,
      content_config: {
        catalog_type: "sarojini",
        limit: 6,
        product_ids: [],
        product_labels: {}
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000008",
      section_type: "sarojini_new_arrivals",
      title: "✨ New Arrivals",
      subtitle: "Directly unpacked from this week's fresh Delhi surplus shipments.",
      management_type: "automatic",
      is_active: true,
      display_order: 8,
      content_config: {
        catalog_type: "sarojini",
        limit: 6
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000009",
      section_type: "sarojini_styles",
      title: "🛍️ Shop By Style",
      subtitle: "Browse your favorite cuts, fits, and silhouettes tailored to your aesthetic.",
      management_type: "manual",
      is_active: true,
      display_order: 9,
      content_config: {
        catalog_type: "sarojini",
        styles: [
          { id: "casual", icon: "👕", title: "Casual", cue: "Easy Everyday", query: "Casual" },
          { id: "streetwear", icon: "🧢", title: "Streetwear", cue: "Urban Vibes", query: "Streetwear" },
          { id: "party_wear", icon: "🪩", title: "Party Wear", cue: "Club & Night Out", query: "Party Wear" },
          { id: "ethnic", icon: "🥻", title: "Ethnic", cue: "Desi Street Fusion", query: "Ethnic" },
          { id: "coord", icon: "✨", title: "Co-ord Sets", cue: "Matching Pairs", query: "Co-ord" },
          { id: "oversized", icon: "📦", title: "Oversized", cue: "Boxy Relaxed Fits", query: "Oversized" },
          { id: "everyday", icon: "☕", title: "Everyday", cue: "Campus & Daily", query: "Everyday" },
          { id: "trendy", icon: "⚡", title: "Trendy", cue: "Instagram Hits", query: "Trendy" }
        ]
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000010",
      section_type: "sarojini_bestsellers",
      title: "🔥 Bestsellers",
      subtitle: "Most-loved bazaar pieces flying off the racks right now.",
      management_type: "automatic",
      is_active: true,
      display_order: 10,
      content_config: {
        catalog_type: "sarojini",
        limit: 6
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000011",
      section_type: "sarojini_budget_finds",
      title: "💸 Budget Finds",
      subtitle: "Direct street pricing without the hassle of bargaining.",
      management_type: "automatic",
      is_active: true,
      display_order: 11,
      content_config: {
        catalog_type: "sarojini",
        limit: 6,
        max_price: 299
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000012",
      section_type: "sarojini_colors",
      title: "🎨 Shop By Color",
      subtitle: "Curate your wardrobe by your signature color palette.",
      management_type: "manual",
      is_active: true,
      display_order: 12,
      content_config: {
        catalog_type: "sarojini",
        colors: [
          { name: "Black", color: "#1c1917", cue: "Classic & Bold" },
          { name: "White", color: "#f8fafc", cue: "Clean & Crisp", border: "#cbd5e1" },
          { name: "Tan", color: "#d4a373", cue: "Earth Warmth" },
          { name: "Red", color: "#dc2626", cue: "Vibrant & Bold" },
          { name: "Blue", color: "#2563eb", cue: "Denim & Royal" },
          { name: "Pink", color: "#ec4899", cue: "Pastel & Rose" },
          { name: "Green", color: "#16a34a", cue: "Olive & Sage" }
        ]
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000013",
      section_type: "sarojini_low_stock",
      title: "⏳ Almost Gone / Low Stock",
      subtitle: "Final pieces remaining. Once sold out, these unique surplus lots are gone forever!",
      management_type: "automatic",
      is_active: true,
      display_order: 13,
      content_config: {
        catalog_type: "sarojini",
        limit: 6
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000014",
      section_type: "sarojini_accessories",
      title: "👓 Accessories Edit",
      subtitle: "Scarves, sunglasses, belts & statement street accents.",
      management_type: "manual",
      is_active: true,
      display_order: 14,
      content_config: {
        catalog_type: "sarojini",
        department: "ACCESSORIES",
        limit: 6,
        product_ids: []
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000015",
      section_type: "sarojini_bags",
      title: "👜 Bags Edit",
      subtitle: "Totes, sling bags, crossbody pouches & daily shoulder bags.",
      management_type: "manual",
      is_active: true,
      display_order: 15,
      content_config: {
        catalog_type: "sarojini",
        department: "BAGS",
        limit: 6,
        product_ids: []
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000016",
      section_type: "sarojini_footwear",
      title: "👟 Footwear Edit",
      subtitle: "Casual sneakers, slides, street kicks & everyday flats.",
      management_type: "manual",
      is_active: true,
      display_order: 16,
      content_config: {
        catalog_type: "sarojini",
        department: "FOOTWEAR",
        limit: 6,
        product_ids: []
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000017",
      section_type: "sarojini_spotlight",
      title: "Sarojini Style / VALORA Looks",
      subtitle: "New Street Drops Every Friday",
      management_type: "manual",
      is_active: true,
      display_order: 17,
      content_config: {
        catalog_type: "sarojini",
        pill_text: "WEEKLY REFRESH",
        headline: "New Street Drops Every Friday",
        description: "Freshly sourced from Delhi's export surplus hubs and local artisan workshops. Limited pieces per drop, never mass-produced, always authentic.",
        button_text: "Explore New Arrivals",
        button_link: "sarojini-shop.html?sort=newest",
        image: "assets/sarojni/srh2.png"
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000018",
      section_type: "sarojini_recently_viewed",
      title: "👀 Recently Viewed",
      subtitle: "Pick up right where you left off in the bazaar.",
      management_type: "automatic",
      is_active: true,
      display_order: 18,
      content_config: {
        catalog_type: "sarojini",
        limit: 6
      }
    },
    {
      id: "22222222-2222-4222-a222-000000000019",
      section_type: "sarojini_why_vadi",
      title: "Why Shop With VALORA",
      subtitle: "The Sarojini Bazaar Authenticity Promise",
      management_type: "config",
      is_active: true,
      display_order: 19,
      content_config: {
        catalog_type: "sarojini",
        pillars: [
          { icon: "fas fa-tags", title: "Real Street Rates", desc: "Authentic bazaar prices direct to you with zero retail markups." },
          { icon: "fas fa-shield-alt", title: "Every Piece Checked", desc: "Individually inspected for stitching, seams, and fabric quality." },
          { icon: "fas fa-box-open", title: "Open Box Delivery", desc: "Inspect your parcel at your doorstep before final payment." },
          { icon: "fas fa-undo-alt", title: "7-Day Easy Returns", desc: "Hassle-free size replacement or returns on all bazaar orders." }
        ]
      }
    }
  ];

  // --- State ---
  let state = {
    sections: [],
    sarojiniProducts: [],
    activeFilter: "all",
    searchQuery: "",
    catalogSearch: "",
    selectedDept: "",
    activeManagingSection: null,
    tempSelectedProductIds: [],
    tempProductLabels: {},
    editingSection: null
  };

  // --- DOM Elements ---
  const dom = {
    tableBody: document.getElementById("sections-table-body"),
    sectionCountBadge: document.getElementById("section-count-badge"),
    metricTotal: document.getElementById("metric-total"),
    metricActive: document.getElementById("metric-active"),
    metricManual: document.getElementById("metric-manual"),
    metricAuto: document.getElementById("metric-auto"),
    searchInput: document.getElementById("search-sections-input"),
    filterTabsContainer: document.getElementById("filter-tabs-container"),
    btnSaveOrder: document.getElementById("btn-save-all-order"),
    btnResetDefaults: document.getElementById("btn-reset-defaults"),

    // Product Selector Modal
    modalSelector: document.getElementById("modal-product-selector"),
    selectorTitle: document.getElementById("selector-modal-title"),
    selectorSubtitle: document.getElementById("selector-modal-subtitle"),
    btnCloseSelector: document.getElementById("btn-close-selector"),
    btnCancelSelector: document.getElementById("btn-cancel-selector"),
    btnSaveSelector: document.getElementById("btn-save-selector-products"),
    btnClearSelected: document.getElementById("btn-clear-selected"),
    catalogItemsList: document.getElementById("catalog-items-list"),
    selectedItemsList: document.getElementById("selected-items-list"),
    catalogSearchInput: document.getElementById("catalog-search-input"),
    catalogDeptFilters: document.getElementById("catalog-dept-filters"),
    catalogAvailableCount: document.getElementById("catalog-available-count"),
    selectedCount: document.getElementById("selected-count"),
    comboOfferNotice: document.getElementById("combo-offer-notice"),

    // Settings Modal
    modalSettings: document.getElementById("modal-section-settings"),
    formSettings: document.getElementById("form-section-settings"),
    settingsTitle: document.getElementById("settings-modal-title"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    btnCancelSettings: document.getElementById("btn-cancel-settings"),
    btnSaveSettings: document.getElementById("btn-save-settings"),
    settingSecId: document.getElementById("setting-sec-id"),
    settingSecTitle: document.getElementById("setting-sec-title"),
    settingSecSubtitle: document.getElementById("setting-sec-subtitle"),
    settingSecOrder: document.getElementById("setting-sec-order"),
    settingSecLimit: document.getElementById("setting-sec-limit"),
    settingSecStart: document.getElementById("setting-sec-start"),
    settingSecEnd: document.getElementById("setting-sec-end"),
    settingSecActive: document.getElementById("setting-sec-active"),
    flashDatesGroup: document.getElementById("flash-dates-group")
  };

  // --- Toast Notification ---
  function showToast(msg, type = "success") {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      const toast = document.createElement("div");
      toast.style.position = "fixed";
      toast.style.bottom = "24px";
      toast.style.right = "24px";
      toast.style.background = type === "success" ? "#10b981" : (type === "danger" ? "#ef4444" : "#2563eb");
      toast.style.color = "#fff";
      toast.style.padding = "12px 22px";
      toast.style.borderRadius = "8px";
      toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.3)";
      toast.style.zIndex = "99999";
      toast.style.fontWeight = "700";
      toast.style.fontSize = "0.88rem";
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3200);
    }
  }

  // --- Load Products Catalog ---
  async function loadCatalog() {
    if (client) {
      try {
        const { data, error } = await client
          .from("sarojini_products")
          .select("id, name, price, original_price, discount_percentage, images, department, brand, stock, is_active, specifications")
          .order("name", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          state.sarojiniProducts = data.map(p => ({
            ...p,
            image: (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : 'assets/sarojni/prod-2-graphic-tee.png'
          }));
        }
      } catch (e) {
        console.warn("Sarojini catalog load notice:", e);
      }
    }

    // Fallback: localStorage / store_settings
    if (state.sarojiniProducts.length === 0) {
      try {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "sarojini_products").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          state.sarojiniProducts = sRow.value.map(p => ({
            ...p,
            image: (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : 'assets/sarojni/prod-2-graphic-tee.png'
          }));
        }
      } catch (_) {}
    }
  }

  // --- Load Sections from Supabase ---
  async function loadSections() {
    dom.tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px; color: #94a3b8;">
          <i class="fas fa-spinner fa-spin fa-2x" style="color: #e11d48; margin-bottom: 12px; display: block;"></i>
          Loading Sarojini sections from Supabase...
        </td>
      </tr>`;

    let loaded = null;

    // 1. Try store_settings table (key = 'sarojini_homepage_sections')
    if (client) {
      try {
        const { data, error } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "sarojini_homepage_sections")
          .maybeSingle();

        if (!error && data && Array.isArray(data.value) && data.value.length > 0) {
          loaded = data.value;
        }
      } catch (_) {}
    }

    // 2. Try homepage_sections table directly
    if (!loaded && client) {
      try {
        const { data, error } = await client
          .from("homepage_sections")
          .select("*")
          .like("section_type", "sarojini_%")
          .order("display_order", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          loaded = data;
        }
      } catch (_) {}
    }

    // 3. Try localStorage
    if (!loaded) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (_) {}
    }

    // 4. Default Manifest Seed
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      loaded = JSON.parse(JSON.stringify(DEFAULT_SAROJINI_SECTIONS));
      await saveSectionsToBackend(loaded, { silent: true });
    }

    // Ensure all 19 default sections exist (merge if new sections added)
    const existingTypes = new Set(loaded.map(s => s.section_type));
    DEFAULT_SAROJINI_SECTIONS.forEach(def => {
      if (!existingTypes.has(def.section_type)) {
        loaded.push(JSON.parse(JSON.stringify(def)));
      }
    });

    // Ensure display_order
    state.sections = loaded.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));
    renderSectionsTable();
    updateMetrics();
  }

  // --- Save Sections to Supabase & Store Settings ---
  async function saveSectionsToBackend(sectionsList, options = {}) {
    // Sort and normalize orders
    sectionsList.forEach((s, idx) => {
      s.display_order = idx + 1;
      s.updated_at = new Date().toISOString();
    });

    let saved = false;

    // 1. Save to store_settings table (primary resilient key)
    if (client) {
      try {
        const { error } = await client
          .from("store_settings")
          .upsert([{
            key: "sarojini_homepage_sections",
            value: sectionsList,
            description: "Curated Sarojini Bazaar 19 Homepage Sections Configuration",
            updated_at: new Date().toISOString()
          }], { onConflict: "key" });

        if (!error) saved = true;
      } catch (err) {
        console.warn("store_settings save notice:", err);
      }

      // Also sync sarojini_featured_section for backwards compatibility
      const trendingSec = sectionsList.find(s => s.section_type === 'sarojini_trending');
      if (trendingSec) {
        try {
          await client.from("store_settings").upsert([{
            key: "sarojini_featured_section",
            value: trendingSec,
            updated_at: new Date().toISOString()
          }], { onConflict: "key" });
        } catch (_) {}
      }

      // 2. Synchronize to public.homepage_sections table
      try {
        await client.from("homepage_sections").upsert(sectionsList.map(s => ({
          id: s.id,
          section_type: s.section_type,
          title: s.title,
          subtitle: s.subtitle,
          is_active: s.is_active !== false,
          display_order: s.display_order,
          background_config: s.background_config || {},
          content_config: s.content_config || {},
          start_date: s.start_date || null,
          end_date: s.end_date || null,
          updated_at: new Date().toISOString()
        })), { onConflict: "id" });
      } catch (e) {
        console.warn("homepage_sections table sync notice:", e);
      }
    }

    // 3. Always update localStorage and dispatch cache invalidation
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionsList));
      localStorage.setItem("sarojini_global_cache_invalidated", Date.now().toString());
      localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
    } catch (_) {}

    window.dispatchEvent(new CustomEvent("velora:homepage-sections-updated"));

    if (!options.silent) {
      showToast("Sarojini homepage sections saved successfully!");
    }

    state.sections = sectionsList;
    renderSectionsTable();
    updateMetrics();
  }

  // --- Update Dashboard Metrics ---
  function updateMetrics() {
    const total = state.sections.length;
    const active = state.sections.filter(s => s.is_active !== false).length;
    const manual = state.sections.filter(s => s.management_type === 'manual').length;
    const auto = state.sections.filter(s => s.management_type === 'automatic' || s.management_type === 'config').length;

    dom.metricTotal.textContent = total;
    dom.metricActive.textContent = active;
    dom.metricManual.textContent = manual;
    dom.metricAuto.textContent = auto;
    dom.sectionCountBadge.textContent = `${total} Sections (${active} Active)`;
  }

  // --- Render Sections Table ---
  function renderSectionsTable() {
    let list = [...state.sections];

    // Filter tabs
    if (state.activeFilter === 'manual') {
      list = list.filter(s => s.management_type === 'manual');
    } else if (state.activeFilter === 'automatic') {
      list = list.filter(s => s.management_type === 'automatic' || s.management_type === 'config');
    } else if (state.activeFilter === 'active') {
      list = list.filter(s => s.is_active !== false);
    } else if (state.activeFilter === 'hidden') {
      list = list.filter(s => s.is_active === false);
    }

    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s => (s.title || '').toLowerCase().includes(q) || (s.subtitle || '').toLowerCase().includes(q) || (s.section_type || '').toLowerCase().includes(q));
    }

    if (list.length === 0) {
      dom.tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px; color: #94a3b8;">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.4; display: block;"></i>
            No sections match your filter criteria.
          </td>
        </tr>`;
      return;
    }

    dom.tableBody.innerHTML = list.map((sec, index) => {
      const isManual = sec.management_type === 'manual';
      const isAuto = sec.management_type === 'automatic';
      const isConfig = sec.management_type === 'config';

      const typeBadgeClass = isManual ? 'manual' : (isAuto ? 'automatic' : 'config');
      const typeBadgeLabel = isManual ? 'Admin-Managed' : (isAuto ? 'Automatic / Dynamic' : 'Store Config');

      // Product count or rules summary
      let summaryHtml = '';
      const cfg = sec.content_config || {};
      const prodIds = Array.isArray(cfg.product_ids) ? cfg.product_ids : [];

      if (sec.section_type === 'sarojini_under_199') {
        summaryHtml = `<span style="font-size:0.78rem; color:#34d399;"><i class="fas fa-bolt"></i> Selling Price &le; ₹199 (Max ${cfg.limit || 6})</span>`;
      } else if (sec.section_type === 'sarojini_new_arrivals') {
        summaryHtml = `<span style="font-size:0.78rem; color:#38bdf8;"><i class="fas fa-clock"></i> Newest Drops (Limit ${cfg.limit || 6})</span>`;
      } else if (sec.section_type === 'sarojini_low_stock') {
        summaryHtml = `<span style="font-size:0.78rem; color:#f87171;"><i class="fas fa-fire"></i> Lowest Active Stock (Limit ${cfg.limit || 6})</span>`;
      } else if (sec.section_type === 'sarojini_bestsellers') {
        summaryHtml = `<span style="font-size:0.78rem; color:#fbbf24;"><i class="fas fa-star"></i> High Rated &amp; Orders (Limit ${cfg.limit || 6})</span>`;
      } else if (sec.section_type === 'sarojini_budget_finds') {
        summaryHtml = `<span style="font-size:0.78rem; color:#cbd5e1;"><i class="fas fa-tags"></i> Sarojini Bargain Rack + Under ₹299</span>`;
      } else if (sec.section_type === 'sarojini_recently_viewed') {
        summaryHtml = `<span style="font-size:0.78rem; color:#94a3b8;"><i class="fas fa-history"></i> Customer Local History</span>`;
      } else if (sec.section_type === 'sarojini_vibes') {
        const vCount = Array.isArray(cfg.vibes) ? cfg.vibes.length : 6;
        summaryHtml = `<span style="font-size:0.78rem; color:#f472b6;"><i class="fas fa-palette"></i> ${vCount} Style Vibes Configured</span>`;
      } else if (sec.section_type === 'sarojini_styles') {
        const sCount = Array.isArray(cfg.styles) ? cfg.styles.length : 8;
        summaryHtml = `<span style="font-size:0.78rem; color:#a78bfa;"><i class="fas fa-tshirt"></i> ${sCount} Silhouettes Configured</span>`;
      } else if (sec.section_type === 'sarojini_departments') {
        const dCount = Array.isArray(cfg.departments) ? cfg.departments.length : 7;
        summaryHtml = `<span style="font-size:0.78rem; color:#38bdf8;"><i class="fas fa-store"></i> ${dCount} Market Lanes</span>`;
      } else if (sec.section_type === 'sarojini_colors') {
        const cCount = Array.isArray(cfg.colors) ? cfg.colors.length : 7;
        summaryHtml = `<span style="font-size:0.78rem; color:#fbbf24;"><i class="fas fa-paint-brush"></i> ${cCount} Color Swatches</span>`;
      } else if (sec.section_type === 'sarojini_combo_offers') {
        summaryHtml = `<span style="font-size:0.78rem; color:#fb7185; font-weight:700;"><i class="fas fa-gift"></i> ${prodIds.length} Offers Curated</span>`;
      } else if (isManual) {
        summaryHtml = `<span style="font-size:0.78rem; color:#e2e8f0; font-weight:700;"><i class="fas fa-check-circle" style="color:#10b981;"></i> ${prodIds.length} Products Picked</span>`;
      } else {
        summaryHtml = `<span style="font-size:0.78rem; color:#94a3b8;">Store Layout Component</span>`;
      }

      const isFirst = index === 0;
      const isLast = index === list.length - 1;

      // Primary Action Button
      let manageBtnHtml = '';
      if (isManual && sec.section_type !== 'sarojini_vibes' && sec.section_type !== 'sarojini_styles' && sec.section_type !== 'sarojini_departments' && sec.section_type !== 'sarojini_colors') {
        manageBtnHtml = `
          <button class="btn-admin-primary btn-manage-products" data-id="${sec.id}" style="background:#e11d48; border-color:#e11d48; padding:5px 12px; font-size:0.76rem;">
            <i class="fas fa-hand-pointer"></i> Manage Products
          </button>
        `;
      } else if (sec.section_type === 'sarojini_flash_deals') {
        manageBtnHtml = `
          <button class="btn-admin-primary btn-manage-products" data-id="${sec.id}" style="background:#ef4444; border-color:#ef4444; padding:5px 12px; font-size:0.76rem;">
            <i class="fas fa-bolt"></i> Curate Deals
          </button>
        `;
      }

      return `
        <tr data-sec-id="${sec.id}" style="${!sec.is_active ? 'opacity: 0.65;' : ''}">
          <td style="text-align: center;">
            <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
              <span style="font-size:0.82rem; font-weight:800; color:#cbd5e1; width:22px;">#${sec.display_order}</span>
              <div class="order-btn-group">
                <button type="button" class="order-control-btn btn-move-up" data-id="${sec.id}" ${isFirst ? 'disabled' : ''} title="Move Up">
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button type="button" class="order-control-btn btn-move-down" data-id="${sec.id}" ${isLast ? 'disabled' : ''} title="Move Down">
                  <i class="fas fa-chevron-down"></i>
                </button>
              </div>
            </div>
          </td>

          <td>
            <div style="font-weight: 800; font-size: 0.92rem; color: #f8fafc; margin-bottom: 2px;">
              ${escapeHtml(sec.title)}
            </div>
            <div style="font-size: 0.76rem; color: #94a3b8; line-height: 1.35;">
              ${escapeHtml(sec.subtitle || 'Sarojini Bazaar Section')}
            </div>
          </td>

          <td>
            <span class="badge-managed ${typeBadgeClass}">
              ${isManual ? '<i class="fas fa-hand-pointer"></i>' : (isAuto ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-cog"></i>')}
              ${typeBadgeLabel}
            </span>
          </td>

          <td style="text-align: center;">
            <label class="status-switch" title="Toggle section visibility">
              <input type="checkbox" class="sec-status-toggle" data-id="${sec.id}" ${sec.is_active !== false ? 'checked' : ''}>
              <span class="status-slider"></span>
            </label>
          </td>

          <td>
            ${summaryHtml}
          </td>

          <td style="text-align: right;">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              ${manageBtnHtml}
              <button type="button" class="btn-admin-secondary btn-edit-section" data-id="${sec.id}" style="padding:5px 10px; font-size:0.76rem;" title="Edit Section Settings">
                <i class="fas fa-sliders-h"></i> Settings
              </button>
              <button type="button" class="btn-admin-secondary btn-reset-sec" data-id="${sec.id}" style="padding:5px 8px; font-size:0.76rem;" title="Reset this section to defaults">
                <i class="fas fa-undo"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachTableEvents();
  }

  // --- Attach Table Event Handlers ---
  function attachTableEvents() {
    // 1. Move Up / Down Reordering
    dom.tableBody.querySelectorAll(".btn-move-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        moveSection(id, -1);
      });
    });

    dom.tableBody.querySelectorAll(".btn-move-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        moveSection(id, 1);
      });
    });

    // 2. Active Toggle Switch
    dom.tableBody.querySelectorAll(".sec-status-toggle").forEach(toggle => {
      toggle.addEventListener("change", async (e) => {
        const id = toggle.getAttribute("data-id");
        const sec = state.sections.find(s => s.id === id);
        if (sec) {
          sec.is_active = toggle.checked;
          await saveSectionsToBackend(state.sections, { silent: false });
        }
      });
    });

    // 3. Manage Products Button
    dom.tableBody.querySelectorAll(".btn-manage-products").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openProductSelectorModal(id);
      });
    });

    // 4. Section Settings Button
    dom.tableBody.querySelectorAll(".btn-edit-section").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openSettingsModal(id);
      });
    });

    // 5. Reset Individual Section
    dom.tableBody.querySelectorAll(".btn-reset-sec").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const def = DEFAULT_SAROJINI_SECTIONS.find(s => s.id === id);
        if (def && confirm(`Reset "${def.title}" to standard defaults?`)) {
          const idx = state.sections.findIndex(s => s.id === id);
          if (idx !== -1) {
            state.sections[idx] = JSON.parse(JSON.stringify(def));
            await saveSectionsToBackend(state.sections);
          }
        }
      });
    });
  }

  // --- Move Section Position ---
  async function moveSection(secId, direction) {
    const idx = state.sections.findIndex(s => s.id === secId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.sections.length) return;

    // Swap positions
    const temp = state.sections[idx];
    state.sections[idx] = state.sections[targetIdx];
    state.sections[targetIdx] = temp;

    // Renumber display_order
    state.sections.forEach((s, i) => s.display_order = i + 1);
    await saveSectionsToBackend(state.sections);
  }

  // ========================================================================
  // PRODUCT SELECTOR MODAL LOGIC (STRICT SAROJINI ISOLATION)
  // ========================================================================
  function openProductSelectorModal(sectionId) {
    const sec = state.sections.find(s => s.id === sectionId);
    if (!sec) return;

    state.activeManagingSection = sec;
    const cfg = sec.content_config || {};
    state.tempSelectedProductIds = Array.isArray(cfg.product_ids) ? [...cfg.product_ids] : [];
    state.tempProductLabels = (cfg.product_labels && typeof cfg.product_labels === 'object')
      ? { ...cfg.product_labels }
      : {};

    dom.selectorTitle.textContent = `Manage Products: ${sec.title}`;
    dom.selectorSubtitle.textContent = `Curate and order products for "${sec.title}". Desktop shows top ${cfg.limit || 6} cards.`;

    // Toggle combo offer label notice
    if (sec.section_type === 'sarojini_combo_offers') {
      dom.comboOfferNotice.style.display = 'block';
    } else {
      dom.comboOfferNotice.style.display = 'none';
    }

    renderCatalogPane();
    renderSelectedPane();
    dom.modalSelector.classList.add("active");
  }

  function closeProductSelectorModal() {
    dom.modalSelector.classList.remove("active");
    state.activeManagingSection = null;
    state.tempSelectedProductIds = [];
    state.tempProductLabels = {};
  }

  // Render Left Pane: Available Products
  function renderCatalogPane() {
    let prods = [...state.sarojiniProducts];

    // Department Filter
    if (state.selectedDept) {
      prods = prods.filter(p => String(p.department).toUpperCase() === state.selectedDept.toUpperCase());
    }

    // Specific section department restrictions
    if (state.activeManagingSection) {
      const type = state.activeManagingSection.section_type;
      if (type === 'sarojini_accessories') prods = prods.filter(p => String(p.department).toUpperCase() === 'ACCESSORIES');
      else if (type === 'sarojini_bags') prods = prods.filter(p => String(p.department).toUpperCase() === 'BAGS');
      else if (type === 'sarojini_footwear') prods = prods.filter(p => String(p.department).toUpperCase() === 'FOOTWEAR');
    }

    // Search query
    if (state.catalogSearch) {
      const q = state.catalogSearch.toLowerCase();
      prods = prods.filter(p => (p.name || '').toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q));
    }

    dom.catalogAvailableCount.textContent = `${prods.length} products available`;

    if (prods.length === 0) {
      dom.catalogItemsList.innerHTML = `
        <div style="text-align:center; padding:32px; color:#64748b; font-size:0.82rem;">
          No matching Sarojini products found.
        </div>`;
      return;
    }

    dom.catalogItemsList.innerHTML = prods.map(prod => {
      const isSelected = state.tempSelectedProductIds.includes(String(prod.id));
      const img = prod.image || 'assets/sarojni/prod-2-graphic-tee.png';
      const price = Number(prod.price) || 0;

      return `
        <div class="product-row-item" data-id="${prod.id}">
          <img src="${img}" class="product-row-thumb" alt="${escapeHtml(prod.name)}" onerror="this.src='assets/sarojni/prod-2-graphic-tee.png';">
          <div class="product-row-info">
            <div class="product-row-title" title="${escapeHtml(prod.name)}">${escapeHtml(prod.name)}</div>
            <div class="product-row-meta">
              <span class="price">${formatPrice(price)}</span>
              <span class="dept-tag">${escapeHtml(prod.department || 'BAZAAR')}</span>
              <span>Stock: ${prod.stock ?? 'N/A'}</span>
            </div>
          </div>
          <div class="product-row-action">
            ${isSelected ? `
              <span style="font-size:0.75rem; color:#10b981; font-weight:700;"><i class="fas fa-check"></i> Added</span>
            ` : `
              <button type="button" class="btn-add-prod" data-id="${prod.id}">
                <i class="fas fa-plus"></i> Add
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Attach Add event listeners
    dom.catalogItemsList.querySelectorAll(".btn-add-prod").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!state.tempSelectedProductIds.includes(id)) {
          state.tempSelectedProductIds.push(id);
          // Default combo label if combo offers section
          if (state.activeManagingSection?.section_type === 'sarojini_combo_offers') {
            state.tempProductLabels[id] = "Buy 1 Get 1 Free";
          }
          renderCatalogPane();
          renderSelectedPane();
        }
      });
    });
  }

  // Render Right Pane: Selected Products (Reorderable)
  function renderSelectedPane() {
    dom.selectedCount.textContent = state.tempSelectedProductIds.length;

    if (state.tempSelectedProductIds.length === 0) {
      dom.selectedItemsList.innerHTML = `
        <div style="text-align:center; padding:48px 16px; color:#64748b;">
          <i class="fas fa-hand-pointer" style="font-size:1.8rem; margin-bottom:8px; opacity:0.4; display:block;"></i>
          <p style="margin:0; font-size:0.82rem;">No products selected yet.</p>
          <span style="font-size:0.74rem;">Click "+ Add" on the left catalog pane to curate products.</span>
        </div>`;
      return;
    }

    const isCombo = state.activeManagingSection?.section_type === 'sarojini_combo_offers';

    dom.selectedItemsList.innerHTML = state.tempSelectedProductIds.map((id, index) => {
      const prod = state.sarojiniProducts.find(p => String(p.id) === String(id)) || {
        id,
        name: `Product ${id.substring(0, 8)}...`,
        price: 0,
        department: 'SAROJINI',
        image: 'assets/sarojni/prod-2-graphic-tee.png'
      };

      const isFirst = index === 0;
      const isLast = index === state.tempSelectedProductIds.length - 1;
      const currentLabel = state.tempProductLabels[id] || "Buy 1 Get 1 Free";

      const comboSelectorHtml = isCombo ? `
        <select class="combo-label-select" data-id="${id}">
          <option value="Buy 1 Get 1 Free" ${currentLabel === 'Buy 1 Get 1 Free' ? 'selected' : ''}>Buy 1 Get 1 Free</option>
          <option value="Combo Offer" ${currentLabel === 'Combo Offer' ? 'selected' : ''}>Combo Offer</option>
          <option value="Buy 2 for ₹299" ${currentLabel === 'Buy 2 for ₹299' ? 'selected' : ''}>Buy 2 for ₹299</option>
          <option value="Buy 2 for ₹399" ${currentLabel === 'Buy 2 for ₹399' ? 'selected' : ''}>Buy 2 for ₹399</option>
          <option value="Special Combo" ${currentLabel === 'Special Combo' ? 'selected' : ''}>Special Combo</option>
          <option value="2-Piece Set" ${currentLabel === '2-Piece Set' ? 'selected' : ''}>2-Piece Set</option>
        </select>
      ` : '';

      return `
        <div class="selected-card-row" data-id="${id}">
          <div class="selected-card-order-badge">${index + 1}</div>
          <img src="${prod.image}" class="product-row-thumb" style="width:36px; height:36px;" onerror="this.src='assets/sarojni/prod-2-graphic-tee.png';">
          <div class="product-row-info">
            <div class="product-row-title" style="font-size:0.8rem;">${escapeHtml(prod.name)}</div>
            <div class="product-row-meta" style="font-size:0.7rem;">
              <span class="price">${formatPrice(prod.price)}</span>
              <span>${escapeHtml(prod.department || '')}</span>
            </div>
          </div>
          ${comboSelectorHtml}
          <div class="order-btn-group" style="flex-direction:row;">
            <button type="button" class="order-control-btn btn-sel-up" data-idx="${index}" ${isFirst ? 'disabled' : ''} title="Move Up">
              <i class="fas fa-chevron-up"></i>
            </button>
            <button type="button" class="order-control-btn btn-sel-down" data-idx="${index}" ${isLast ? 'disabled' : ''} title="Move Down">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <button type="button" class="btn-remove-prod" data-id="${id}" title="Remove Product">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).join('');

    // Reorder Handlers
    dom.selectedItemsList.querySelectorAll(".btn-sel-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (idx > 0) {
          const item = state.tempSelectedProductIds.splice(idx, 1)[0];
          state.tempSelectedProductIds.splice(idx - 1, 0, item);
          renderSelectedPane();
        }
      });
    });

    dom.selectedItemsList.querySelectorAll(".btn-sel-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (idx < state.tempSelectedProductIds.length - 1) {
          const item = state.tempSelectedProductIds.splice(idx, 1)[0];
          state.tempSelectedProductIds.splice(idx + 1, 0, item);
          renderSelectedPane();
        }
      });
    });

    // Remove Handler
    dom.selectedItemsList.querySelectorAll(".btn-remove-prod").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        state.tempSelectedProductIds = state.tempSelectedProductIds.filter(x => x !== id);
        delete state.tempProductLabels[id];
        renderCatalogPane();
        renderSelectedPane();
      });
    });

    // Combo Label Change
    dom.selectedItemsList.querySelectorAll(".combo-label-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const id = sel.getAttribute("data-id");
        state.tempProductLabels[id] = e.target.value;
      });
    });
  }

  // Save Modal Selected Products
  async function saveSelectedProducts() {
    if (!state.activeManagingSection) return;

    state.activeManagingSection.content_config = state.activeManagingSection.content_config || {};
    state.activeManagingSection.content_config.product_ids = [...state.tempSelectedProductIds];
    state.activeManagingSection.content_config.product_labels = { ...state.tempProductLabels };

    await saveSectionsToBackend(state.sections);
    closeProductSelectorModal();
    showToast(`Updated products for "${state.activeManagingSection.title}"`);
  }

  // ========================================================================
  // SETTINGS MODAL LOGIC
  // ========================================================================
  function openSettingsModal(sectionId) {
    const sec = state.sections.find(s => s.id === sectionId);
    if (!sec) return;

    state.editingSection = sec;
    dom.settingsTitle.textContent = `Configure Section: ${sec.title}`;
    dom.settingSecId.value = sec.id;
    dom.settingSecTitle.value = sec.title || '';
    dom.settingSecSubtitle.value = sec.subtitle || '';
    dom.settingSecOrder.value = sec.display_order ?? 1;
    dom.settingSecLimit.value = sec.content_config?.limit || 6;
    dom.settingSecActive.checked = sec.is_active !== false;

    if (sec.section_type === 'sarojini_flash_deals') {
      dom.flashDatesGroup.style.display = 'block';
      dom.settingSecStart.value = sec.start_date ? sec.start_date.substring(0, 16) : '';
      dom.settingSecEnd.value = sec.end_date ? sec.end_date.substring(0, 16) : '';
    } else {
      dom.flashDatesGroup.style.display = 'none';
    }

    dom.modalSettings.classList.add("active");
  }

  function closeSettingsModal() {
    dom.modalSettings.classList.remove("active");
    state.editingSection = null;
  }

  async function saveSettings() {
    if (!state.editingSection) return;

    state.editingSection.title = dom.settingSecTitle.value.trim() || state.editingSection.title;
    state.editingSection.subtitle = dom.settingSecSubtitle.value.trim();
    state.editingSection.display_order = parseInt(dom.settingSecOrder.value, 10) || state.editingSection.display_order;
    state.editingSection.is_active = dom.settingSecActive.checked;

    state.editingSection.content_config = state.editingSection.content_config || {};
    state.editingSection.content_config.limit = parseInt(dom.settingSecLimit.value, 10) || 6;

    if (state.editingSection.section_type === 'sarojini_flash_deals') {
      state.editingSection.start_date = dom.settingSecStart.value ? new Date(dom.settingSecStart.value).toISOString() : null;
      state.editingSection.end_date = dom.settingSecEnd.value ? new Date(dom.settingSecEnd.value).toISOString() : null;
    }

    // Sort by new order
    state.sections.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));
    await saveSectionsToBackend(state.sections);
    closeSettingsModal();
    showToast(`Saved settings for "${state.editingSection.title}"`);
  }

  // ========================================================================
  // INITIALIZATION & EVENT LISTENERS
  // ========================================================================
  function initEvents() {
    // Filter tabs
    dom.filterTabsContainer.querySelectorAll(".filter-tab-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        dom.filterTabsContainer.querySelectorAll(".filter-tab-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        state.activeFilter = pill.getAttribute("data-filter");
        renderSectionsTable();
      });
    });

    // Main search
    dom.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderSectionsTable();
    });

    // Save All Order Button
    dom.btnSaveOrder.addEventListener("click", async () => {
      await saveSectionsToBackend(state.sections);
    });

    // Reset All to Defaults Button
    dom.btnResetDefaults.addEventListener("click", async () => {
      if (confirm("Reset ALL 19 Sarojini sections to standard defaults? This will restore the default section order, titles, and styles.")) {
        const fresh = JSON.parse(JSON.stringify(DEFAULT_SAROJINI_SECTIONS));
        await saveSectionsToBackend(fresh);
      }
    });

    // Selector Modal Events
    dom.btnCloseSelector.addEventListener("click", closeProductSelectorModal);
    dom.btnCancelSelector.addEventListener("click", closeProductSelectorModal);
    dom.btnSaveSelector.addEventListener("click", saveSelectedProducts);
    dom.btnClearSelected.addEventListener("click", () => {
      state.tempSelectedProductIds = [];
      state.tempProductLabels = {};
      renderCatalogPane();
      renderSelectedPane();
    });

    dom.catalogSearchInput.addEventListener("input", (e) => {
      state.catalogSearch = e.target.value.trim();
      renderCatalogPane();
    });

    dom.catalogDeptFilters.querySelectorAll(".filter-tab-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        dom.catalogDeptFilters.querySelectorAll(".filter-tab-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        state.selectedDept = pill.getAttribute("data-dept");
        renderCatalogPane();
      });
    });

    // Settings Modal Events
    dom.btnCloseSettings.addEventListener("click", closeSettingsModal);
    dom.btnCancelSettings.addEventListener("click", closeSettingsModal);
    dom.btnSaveSettings.addEventListener("click", (e) => {
      e.preventDefault();
      saveSettings();
    });

    // Global listener for cross-tab sync
    window.addEventListener("storage", (e) => {
      if (e.key === "sarojini_global_cache_invalidated" || e.key === "velora_global_cache_invalidated") {
        loadSections();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Boot
  await loadCatalog();
  await loadSections();
  initEvents();
});
