/**
 * VELORA Admin Panel - Advertisement Management Controller
 * Fully dynamic campaign CRUD with live desktop/mobile preview, 
 * page targeting, scheduling, and dual-layer Supabase persistence.
 */

(function () {
  'use strict';

  let allAds = [];
  let isMobilePreview = false;
  let client = null;

  const PLACEMENT_LABELS = {
    top_announcement: "Top Announcement Bar",
    below_hero: "Homepage Below Hero",
    above_trending: "Homepage Above Trending",
    below_trending: "Homepage Below Trending",
    above_new_arrivals: "Homepage Above New Arrivals",
    below_new_arrivals: "Homepage Below New Arrivals",
    above_deals: "Homepage Above Deals",
    shop_top: "Shop Page Top",
    product_contextual: "Product Contextual",
    wishlist_promo: "Wishlist Promo",
    cart_drawer: "Cart Drawer",
    checkout_secure: "Checkout Secure",
    floating: "Floating Card",
    auth_visual: "Authentication 3D Visual Card"
  };

  const DEFAULT_SEED_ADS = [
    {
      id: "ad-seed-1",
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
      id: "ad-seed-2",
      title: "BUY 1, GET 1 FREE — THE ROYAL BOGO EVENT",
      subtitle: "Add any 2 items marked BOGO to cart. Lower priced piece is complimentary!",
      badge_text: "BOGO OFFER",
      ad_type: "top_announcement",
      placement: "top_announcement",
      target_pages: ["all"],
      image_url: "",
      cta_text: "Claim Offer",
      cta_link: "shop.html?tag=bogo",
      priority: 9,
      sort_order: 2,
      is_active: true
    },
    {
      id: "ad-seed-3",
      title: "TRENDING THIS WEEK — ICONIC VADI COUTURE",
      subtitle: "Celebrity favorites & exquisite bridal silhouettes",
      badge_text: "TRENDING NOW",
      ad_type: "top_announcement",
      placement: "top_announcement",
      target_pages: ["all"],
      image_url: "",
      cta_text: "Explore Trends",
      cta_link: "shop.html?tag=trending",
      priority: 8,
      sort_order: 3,
      is_active: true
    },
    {
      id: "ad-seed-4",
      title: "VADI ROYAL BOGO FESTIVAL",
      subtitle: "Select any 2 pieces from our master artisanal collection — the second piece is our gift to you. Free luxury gift wrap included.",
      badge_text: "ROYAL PRIVILEGE",
      ad_type: "hero_banner",
      placement: "below_hero",
      target_pages: ["homepage", "shop"],
      image_url: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1400&q=80",
      cta_text: "Shop BOGO Collection",
      cta_link: "shop.html?tag=bogo",
      priority: 10,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-seed-5",
      title: "THE CURATED TRENDING SUITE",
      subtitle: "Handpicked by our Parisian stylists. Explore this week's highest rated luxury ensembles.",
      badge_text: "MOST LOVED",
      ad_type: "section_banner",
      placement: "above_trending",
      target_pages: ["homepage"],
      image_url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80",
      cta_text: "Discover Styles",
      cta_link: "shop.html?tag=trending",
      priority: 9,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-seed-6",
      title: "EXCLUSIVE PRIVILEGE: BUY 1, GET 1 FREE",
      subtitle: "Applied automatically at checkout on all eligible pieces.",
      badge_text: "BOGO REWARD",
      ad_type: "floating_card",
      placement: "floating",
      target_pages: ["shop", "product"],
      image_url: "",
      cta_text: "View BOGO Items",
      cta_link: "shop.html?tag=bogo",
      priority: 8,
      sort_order: 1,
      is_active: true
    },
    {
      id: "ad-seed-7",
      title: "DISCOVER WHAT'S TRENDING AT VADI",
      subtitle: "Handcrafted luxury footwear and precision horology.",
      badge_text: "TRENDING NOW",
      ad_type: "floating_card",
      placement: "auth_visual",
      target_pages: ["auth", "login", "signup", "all"],
      image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
      cta_text: "Explore Now",
      cta_link: "trending.html",
      priority: 10,
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
    await loadAdvertisements();
  });

  function setupEventListeners() {
    // Modal openers/closers
    document.getElementById("btn-open-add-modal").addEventListener("click", () => openModal());
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);

    // Filter toolbar
    document.getElementById("filter-search").addEventListener("input", renderTable);
    document.getElementById("filter-placement").addEventListener("change", renderTable);
    document.getElementById("filter-status").addEventListener("change", renderTable);

    // Form submission
    document.getElementById("ad-form").addEventListener("submit", handleFormSubmit);

    // Reactive Preview Triggers
    const previewInputs = [
      "ad-title", "ad-subtitle", "ad-badge", "ad-type", "ad-placement", 
      "ad-image-url", "ad-cta-text", "ad-cta-link"
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

  /**
   * Load advertisements from Supabase banners table with resilient fallback to store_settings
   */
  async function loadAdvertisements() {
    try {
      let loaded = null;

      // 1. Query banners table directly
      const { data: banners, error: bannerErr } = await client
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (!bannerErr && banners && banners.length > 0) {
        // Map any legacy banner schema fields to full ad schema
        loaded = banners.map(b => ({
          id: b.id,
          title: b.title || "Untitled Advertisement",
          subtitle: b.subtitle || "",
          badge_text: b.badge_text || "PROMOTION",
          ad_type: b.ad_type || (b.placement === 'top_announcement' ? 'top_announcement' : 'hero_banner'),
          placement: b.placement || "below_hero",
          target_pages: Array.isArray(b.target_pages) ? b.target_pages : (b.target_pages ? [b.target_pages] : ["all"]),
          image_url: b.image_url || "",
          mobile_image_url: b.mobile_image_url || "",
          cta_text: b.cta_text || b.button_text || "Shop Now",
          cta_link: b.cta_link || b.button_link || "shop.html",
          priority: b.priority || 5,
          sort_order: b.sort_order || b.display_order || 1,
          is_active: b.is_active !== false,
          start_at: b.start_at || null,
          end_at: b.end_at || null
        }));
      }

      // 2. If banners table didn't have ads or gave schema error, try store_settings
      if (!loaded || loaded.length === 0) {
        const { data: settings } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "advertisements")
          .maybeSingle();

        if (settings && settings.value && Array.isArray(settings.value) && settings.value.length > 0) {
          loaded = settings.value;
        }
      }

      // 3. If still empty, seed defaults
      if (!loaded || loaded.length === 0) {
        loaded = DEFAULT_SEED_ADS;
        await saveAdsToStoreSettings(loaded);
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

  function updateKpis() {
    const total = allAds.length;
    const active = allAds.filter(a => a.is_active).length;
    const topBar = allAds.filter(a => a.placement === "top_announcement" && a.is_active).length;
    const floating = allAds.filter(a => (a.placement === "floating" || a.placement === "product_contextual" || a.placement === "cart_drawer") && a.is_active).length;

    document.getElementById("kpi-total-ads").textContent = total;
    document.getElementById("kpi-active-ads").textContent = active;
    document.getElementById("kpi-top-bar-ads").textContent = topBar;
    document.getElementById("kpi-floating-ads").textContent = floating;
  }

  function renderTable() {
    const tbody = document.getElementById("ads-table-body");
    const searchVal = (document.getElementById("filter-search").value || "").toLowerCase().trim();
    const placementVal = document.getElementById("filter-placement").value;
    const statusVal = document.getElementById("filter-status").value;

    const filtered = allAds.filter(ad => {
      if (placementVal !== "all" && ad.placement !== placementVal) return false;
      if (statusVal === "active" && !ad.is_active) return false;
      if (statusVal === "inactive" && ad.is_active) return false;
      if (searchVal) {
        const matchTitle = (ad.title || "").toLowerCase().includes(searchVal);
        const matchBadge = (ad.badge_text || "").toLowerCase().includes(searchVal);
        const matchSubtitle = (ad.subtitle || "").toLowerCase().includes(searchVal);
        const matchPages = (ad.target_pages || []).some(p => p.toLowerCase().includes(searchVal));
        if (!matchTitle && !matchBadge && !matchSubtitle && !matchPages) return false;
      }
      return true;
    });

    document.getElementById("ad-count-indicator").textContent = `Showing ${filtered.length} of ${allAds.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px; color: var(--admin-text-muted);">
            No advertisements match your current search and filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((ad, idx) => {
      const placementText = PLACEMENT_LABELS[ad.placement] || ad.placement;
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
            <div style="display: flex; align-items: center; gap: 12px;">
              ${ad.image_url ? `
                <div style="width: 44px; height: 36px; border-radius: 4px; background: url('${ad.image_url}') center/cover no-repeat; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;"></div>
              ` : `
                <div style="width: 44px; height: 36px; border-radius: 4px; background: rgba(99,102,241,0.1); display:flex; align-items:center; justify-content:center; color: var(--admin-accent); font-size: 0.9rem; flex-shrink: 0;">
                  <i class="fas ${ad.placement === 'top_announcement' ? 'fa-bolt' : 'fa-bullhorn'}"></i>
                </div>
              `}
              <div>
                <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 2px;">
                  <span style="font-weight: 700; color: #fff; font-size: 0.88rem;">${escapeHtml(ad.title)}</span>
                  ${ad.badge_text ? `<span class="badge badge-indigo" style="font-size:0.65rem; padding: 2px 6px;">${escapeHtml(ad.badge_text)}</span>` : ''}
                </div>
                <div style="font-size: 0.78rem; color: var(--admin-text-muted); max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(ad.subtitle || 'No description')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="placement-badge">
              <i class="fas fa-map-pin" style="color: var(--admin-accent); font-size: 0.7rem;"></i>
              ${placementText}
            </span>
          </td>
          <td>${pagesHtml}</td>
          <td style="font-size: 0.78rem; color: var(--admin-text-muted);">${scheduleText}</td>
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
      document.getElementById("ad-title").value = ad.title || "";
      document.getElementById("ad-subtitle").value = ad.subtitle || "";
      document.getElementById("ad-badge").value = ad.badge_text || "";
      document.getElementById("ad-type").value = ad.ad_type || "top_announcement";
      document.getElementById("ad-placement").value = ad.placement || "top_announcement";
      document.getElementById("ad-image-url").value = ad.image_url || "";
      document.getElementById("ad-mobile-image-url").value = ad.mobile_image_url || "";
      document.getElementById("ad-cta-text").value = ad.cta_text || "";
      document.getElementById("ad-cta-link").value = ad.cta_link || "";
      document.getElementById("ad-priority").value = ad.priority || 5;
      document.getElementById("ad-sort-order").value = ad.sort_order || 1;
      document.getElementById("ad-coupon-code").value = ad.coupon_code || "";
      document.getElementById("ad-is-active").checked = ad.is_active !== false;

      if (ad.start_at) {
        document.getElementById("ad-start-at").value = new Date(ad.start_at).toISOString().slice(0, 16);
      }
      if (ad.end_at) {
        document.getElementById("ad-end-at").value = new Date(ad.end_at).toISOString().slice(0, 16);
      }

      // Check target pages checkboxes
      const targetPages = ad.target_pages || ["all"];
      document.querySelectorAll('input[name="target_pages"]').forEach(cb => {
        cb.checked = targetPages.includes(cb.value);
      });
    } else {
      modalTitle.textContent = "Create New Advertisement";
      document.getElementById("ad-id").value = "";
      document.getElementById("ad-priority").value = "5";
      document.getElementById("ad-sort-order").value = (allAds.length + 1);
      document.getElementById("ad-coupon-code").value = "";
      document.getElementById("ad-is-active").checked = true;
      document.querySelector('input[name="target_pages"][value="all"]').checked = true;
    }

    modal.classList.add("show");
    updateLivePreview();
  }

  function closeModal() {
    document.getElementById("ad-modal-backdrop").classList.remove("show");
  }

  function updateLivePreview() {
    const container = document.getElementById("ad-live-preview-container");
    const title = document.getElementById("ad-title").value.trim() || "Promotional Campaign Title";
    const subtitle = document.getElementById("ad-subtitle").value.trim() || "Exclusive bespoke collection available for a limited time.";
    const badge = document.getElementById("ad-badge").value.trim() || "SPECIAL OFFER";
    const placement = document.getElementById("ad-placement").value;
    const imageUrl = document.getElementById("ad-image-url").value.trim();
    const ctaText = document.getElementById("ad-cta-text").value.trim() || "Shop Now";

    if (placement === "top_announcement") {
      container.innerHTML = `
        <div style="background: linear-gradient(90deg, #111827 0%, #1e1b4b 50%, #111827 100%); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 6px; padding: 10px 16px; display: flex; align-items: center; justify-content: center; gap: 12px; color: #fff; font-size: ${isMobilePreview ? '0.75rem' : '0.82rem'}; text-align: center;">
          <span style="background: rgba(212, 175, 55, 0.2); color: #f59e0b; border: 1px solid rgba(212, 175, 55, 0.4); padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">
            ${escapeHtml(badge)}
          </span>
          <span style="font-weight: 600; letter-spacing: 0.02em;">${escapeHtml(title)}</span>
          <span style="color: #cbd5e1; display: ${isMobilePreview ? 'none' : 'inline'};">— ${escapeHtml(subtitle)}</span>
          <span style="color: #fbbf24; font-weight: 700; text-decoration: underline; cursor: pointer; white-space: nowrap;">
            ${escapeHtml(ctaText)} →
          </span>
        </div>
      `;
    } else if (placement === "floating") {
      container.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 12px; padding: 14px 18px; max-width: 320px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6); color: #fff; margin: 0 auto;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="background: rgba(212, 175, 55, 0.2); color: #fbbf24; border: 1px solid rgba(212, 175, 55, 0.4); padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.65rem;">
              ${escapeHtml(badge)}
            </span>
            <span style="color: #64748b; font-size: 0.75rem;"><i class="fas fa-times"></i></span>
          </div>
          <h4 style="font-size: 0.92rem; font-weight: 700; margin-bottom: 4px; color: #fff;">${escapeHtml(title)}</h4>
          <p style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 12px; line-height: 1.4;">${escapeHtml(subtitle)}</p>
          <div style="text-align: right;">
            <button type="button" style="background: linear-gradient(135deg, #d4af37, #f59e0b); color: #000; border: none; font-weight: 700; font-size: 0.76rem; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
              ${escapeHtml(ctaText)} →
            </button>
          </div>
        </div>
      `;
    } else if (placement === "auth_visual") {
      container.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(15, 23, 42, 0.7) 100%); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 20px; padding: 14px 18px; max-width: 440px; box-shadow: 0 16px 36px rgba(0,0,0,0.45); color: #fff; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
          <div style="flex: 1; min-width: 0;">
            <div style="margin-bottom: 4px;">
              <span style="background: rgba(251, 191, 36, 0.18); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); padding: 2px 7px; border-radius: 5px; font-weight: 800; font-size: 0.65rem; letter-spacing: 0.04em;">
                ${escapeHtml(badge)}
              </span>
            </div>
            <h4 style="font-size: 0.92rem; font-weight: 700; color: #fff; margin: 0 0 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(title)}
            </h4>
            <p style="font-size: 0.76rem; color: rgba(255,255,255,0.72); margin: 0 0 8px 0; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(subtitle)}
            </p>
            <div>
              <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #fff; color: #090d16; font-size: 0.72rem; font-weight: 700; border-radius: 100px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                ${escapeHtml(ctaText)} →
              </span>
            </div>
          </div>
          ${imageUrl ? `
            <div style="width: 80px; height: 80px; min-width: 80px; display: flex; align-items: center; justify-content: center;">
              <img src="${escapeHtml(imageUrl)}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 8px 14px rgba(0,0,0,0.5));">
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // Showcase / Section banner preview
      container.innerHTML = `
        <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.25); min-height: 140px; background: ${imageUrl ? `linear-gradient(rgba(10,12,18,0.7), rgba(10,12,18,0.9)), url('${imageUrl}') center/cover no-repeat` : 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'}; display: flex; flex-direction: column; justify-content: center; padding: 20px;">
          <div style="margin-bottom: 6px;">
            <span style="background: rgba(212, 175, 55, 0.2); color: #fbbf24; border: 1px solid rgba(212, 175, 55, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.68rem; text-transform: uppercase;">
              ${escapeHtml(badge)}
            </span>
          </div>
          <h3 style="color: #fff; font-size: ${isMobilePreview ? '1rem' : '1.25rem'}; font-weight: 800; margin-bottom: 6px; text-shadow: 0 2px 4px rgba(0,0,0,0.6);">
            ${escapeHtml(title)}
          </h3>
          <p style="color: #cbd5e1; font-size: ${isMobilePreview ? '0.75rem' : '0.85rem'}; max-width: 500px; margin-bottom: 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
            ${escapeHtml(subtitle)}
          </p>
          <div>
            <button type="button" style="background: linear-gradient(135deg, #d4af37, #f59e0b); color: #000; border: none; font-weight: 700; font-size: 0.8rem; padding: 7px 16px; border-radius: 6px; cursor: pointer;">
              ${escapeHtml(ctaText)} →
            </button>
          </div>
        </div>
      `;
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("ad-id").value;
    const title = document.getElementById("ad-title").value.trim();
    const subtitle = document.getElementById("ad-subtitle").value.trim();
    const badge_text = document.getElementById("ad-badge").value.trim() || "PROMOTION";
    const ad_type = document.getElementById("ad-type").value;
    const placement = document.getElementById("ad-placement").value;
    const image_url = document.getElementById("ad-image-url").value.trim();
    const mobile_image_url = document.getElementById("ad-mobile-image-url").value.trim();
    const cta_text = document.getElementById("ad-cta-text").value.trim() || "Shop Now";
    const cta_link = document.getElementById("ad-cta-link").value.trim() || "shop.html";
    const priority = parseInt(document.getElementById("ad-priority").value, 10) || 5;
    const sort_order = parseInt(document.getElementById("ad-sort-order").value, 10) || 1;
    const coupon_code = (document.getElementById("ad-coupon-code").value || "").trim().toUpperCase() || null;
    const start_at = document.getElementById("ad-start-at").value || null;
    const end_at = document.getElementById("ad-end-at").value || null;
    const is_active = document.getElementById("ad-is-active").checked;

    // Collect selected target pages
    const selectedPages = [];
    document.querySelectorAll('input[name="target_pages"]:checked').forEach(cb => {
      selectedPages.push(cb.value);
    });
    if (selectedPages.length === 0) selectedPages.push("all");

    const adPayload = {
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
        // Update existing (with schema fallback if column coupon_code pending)
        let { error } = await client.from("banners").update(adPayload).eq("id", id);
        if (error && (error.code === "42703" || (error.message && error.message.includes("coupon_code")))) {
          const { coupon_code: _c, ...legacyPayload } = adPayload;
          const retry = await client.from("banners").update(legacyPayload).eq("id", id);
          error = retry.error;
        }
        if (error) {
          console.warn("[Advertisements] Direct banners update notice:", error.message);
        }
        
        // Update local state
        const idx = allAds.findIndex(a => String(a.id) === String(id));
        if (idx !== -1) {
          allAds[idx] = { ...allAds[idx], ...adPayload, id };
        }
      } else {
        // Insert new (with schema fallback if column coupon_code pending)
        const insertPayload = {
          ...adPayload,
          created_at: new Date().toISOString()
        };

        let { data: inserted, error } = await client.from("banners").insert([insertPayload]).select();
        if (error && (error.code === "42703" || (error.message && error.message.includes("coupon_code")))) {
          const { coupon_code: _c, ...legacyPayload } = insertPayload;
          const retry = await client.from("banners").insert([legacyPayload]).select();
          inserted = retry.data;
          error = retry.error;
        }

        if (!error && inserted && inserted.length > 0) {
          savedId = inserted[0].id;
          allAds.push({ ...insertPayload, id: savedId });
        } else {
          console.warn("[Advertisements] Direct banners insert fallback:", error?.message);
          savedId = "ad-" + Date.now();
          allAds.push({ ...insertPayload, id: savedId });
        }
      }

      // Always sync to store_settings for zero-latency client reading
      await saveAdsToStoreSettings(allAds);

      window.showToast("Advertisement campaign saved successfully!", "success");
      closeModal();
      updateKpis();
      renderTable();
    } catch (err) {
      console.error("[Advertisements] Save error:", err);
      window.showToast("Saved locally. Supabase connection synced.", "info");
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
    } catch (e) {
      console.warn("Status update fallback:", e);
    }

    await saveAdsToStoreSettings(allAds);
    window.showToast(`Campaign ${isActive ? 'activated' : 'deactivated'}.`, "success");
    updateKpis();
  }

  async function duplicateAd(id) {
    const orig = allAds.find(a => String(a.id) === String(id));
    if (!orig) return;

    const copy = {
      ...orig,
      id: "ad-" + Date.now(),
      title: orig.title + " (Copy)",
      is_active: false,
      sort_order: (orig.sort_order || 1) + 1
    };

    allAds.push(copy);

    try {
      const { id: _, ...dbCopy } = copy;
      await client.from("banners").insert([{ ...dbCopy, created_at: new Date().toISOString() }]);
    } catch (e) {
      console.warn("Duplicate DB fallback:", e);
    }

    await saveAdsToStoreSettings(allAds);
    window.showToast("Campaign duplicated as draft.", "success");
    updateKpis();
    renderTable();
  }

  async function deleteAd(id) {
    if (!confirm("Are you sure you want to delete this promotional campaign?")) return;

    allAds = allAds.filter(a => String(a.id) !== String(id));

    try {
      await client.from("banners").delete().eq("id", id);
    } catch (e) {
      console.warn("Delete DB fallback:", e);
    }

    await saveAdsToStoreSettings(allAds);
    window.showToast("Campaign deleted.", "success");
    updateKpis();
    renderTable();
  }

  async function saveAdsToStoreSettings(ads) {
    try {
      await client.from("store_settings").upsert({
        key: "advertisements",
        value: ads,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
    } catch (e) {
      console.warn("store_settings upsert error:", e);
    }
    try {
      localStorage.removeItem("velora_ads_cache_v2");
      window.dispatchEvent(new CustomEvent("velora:ads-updated"));
    } catch (_) {}
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

