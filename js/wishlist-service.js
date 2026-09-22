/**
 * VADI & SAROJINI BAZAAR - UNIFIED SHARED WISHLIST SERVICE
 * 
 * Provides a single, database-authoritative, two-way synchronized wishlist
 * shared across both Main VADI and Sarojini Bazaar storefronts.
 * 
 * Features:
 * - Realtime Supabase PostgreSQL synchronization with RLS compliance.
 * - Multi-catalog support: handles Main VADI products and Sarojini Bazaar products.
 * - Cross-storefront consistency: hearts update instantly everywhere.
 * - Session & auth isolation: prevents data leaking between different customers.
 * - Local optimistic caching for instantaneous UX.
 */

(function () {
  'use strict';

  // In-memory state
  const state = {
    wishlistIds: new Set(),
    itemsMap: new Map(), // id -> { id, catalog_type, product_id, sarojini_product_id }
    initialized: false,
    currentUser: null,
    sarojiniCache: []
  };

  // Safe UUID check
  const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

  // Get Supabase Client
  function getClient() {
    return window.supabaseClient ||
           (typeof window.getSupabase === 'function' ? window.getSupabase() : null) ||
           (window.VeloraAuth && typeof window.VeloraAuth.getClient === 'function' ? window.VeloraAuth.getClient() : null);
  }

  // Get current authenticated user
  async function getAuthUser() {
    const client = getClient();
    if (!client) return null;
    try {
      if (window.VeloraAuth && typeof window.VeloraAuth.getUser === 'function') {
        const u = await window.VeloraAuth.getUser();
        if (u) return u;
      }
      if (client.auth) {
        const { data } = await client.auth.getUser();
        if (data && data.user) return data.user;
      }
    } catch (_) {}
    return null;
  }

  // Read local cache
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem("velora_wishlist");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          state.wishlistIds = new Set(arr);
        }
      }
    } catch (_) {}
  }

  // Save local cache
  function saveLocalCache() {
    try {
      localStorage.setItem("velora_wishlist", JSON.stringify(Array.from(state.wishlistIds)));
    } catch (_) {}
  }

  // Toast notification helper
  function notify(message, type = "info") {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    const container = document.getElementById("toast-container") || document.body;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 100000;
      background: ${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#0f172a')};
      color: #fff; padding: 12px 20px; border-radius: 8px; font-weight: 600;
      font-size: 0.88rem; box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Update all badges in navbar and header
  function updateAllBadges() {
    const count = state.wishlistIds.size;
    const badges = document.querySelectorAll(".wishlist-count-badge, #nav-wishlist-count, #wishlist-count-badge");
    badges.forEach(b => {
      b.textContent = count;
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
    });
  }

  // Sync heart button states in the DOM
  function updateHeartButtonUI(productId, isActive) {
    const strId = String(productId);
    
    // 1. Main storefront buttons: .wishlist-btn[data-wishlist-id="..."]
    document.querySelectorAll(`.wishlist-btn[data-wishlist-id="${strId}"]`).forEach(btn => {
      btn.classList.toggle("active", isActive);
    });

    // 2. Sarojini product card buttons: .product-card-wishlist[data-prod-id="..."]
    document.querySelectorAll(`.product-card-wishlist[data-prod-id="${strId}"]`).forEach(btn => {
      btn.classList.toggle("active", isActive);
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = isActive ? "fas fa-heart" : "far fa-heart";
      }
    });

    // 3. Sarojini carousel card buttons: .sarojini-card-wishlist-btn
    document.querySelectorAll(`.sarojini-card-wishlist-btn[data-wishlist-id="${strId}"]`).forEach(btn => {
      btn.classList.toggle("active", isActive);
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", isActive ? "#ef4444" : "none");
        svg.setAttribute("stroke", isActive ? "#ef4444" : "currentColor");
      }
    });

    // 4. PDP Main / Sarojini Wishlist Buttons
    const pdpWishBtn = document.getElementById("btn-toggle-wishlist") || 
                       document.getElementById("btn-pdp-wishlist") || 
                       document.getElementById("wishlist-btn");
    if (pdpWishBtn) {
      const pageProdId = pdpWishBtn.dataset.productId || 
                         (window.state && window.state.currentProduct ? window.state.currentProduct.id : null);
      if (pageProdId && String(pageProdId) === strId) {
        pdpWishBtn.classList.toggle("active", isActive);
        const icon = pdpWishBtn.querySelector("i");
        if (icon) {
          icon.className = isActive ? "fas fa-heart" : "far fa-heart";
        }
      }
    }
  }

  // Sync all heart buttons currently rendered on the page
  function syncAllHeartButtons() {
    state.wishlistIds.forEach(id => updateHeartButtonUI(id, true));

    // Also uncheck buttons not in wishlist
    document.querySelectorAll(".wishlist-btn, .product-card-wishlist, .sarojini-card-wishlist-btn").forEach(btn => {
      const pid = btn.dataset.wishlistId || btn.dataset.prodId;
      if (pid && !state.wishlistIds.has(pid)) {
        btn.classList.remove("active");
        const icon = btn.querySelector("i");
        if (icon) icon.className = "far fa-heart";
        const svg = btn.querySelector("svg");
        if (svg) {
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "currentColor");
        }
      }
    });
  }

  // Synchronize with Supabase database
  async function syncFromDatabase() {
    const client = getClient();
    if (!client) return;

    try {
      const user = await getAuthUser();
      state.currentUser = user;

      if (!user) {
        // Guest mode - rely on local cache
        loadLocalCache();
        updateAllBadges();
        syncAllHeartButtons();
        return;
      }

      // Query database for user's authoritative wishlist
      const { data: dbRows, error } = await client
        .from("wishlist")
        .select("id, product_id, sarojini_product_id, catalog_type, created_at")
        .eq("user_id", user.id);

      if (error) {
        console.warn("[VadiWishlist] Database sync warning:", error.message);
        return;
      }

      // Build authoritative sets
      const newIds = new Set();
      state.itemsMap.clear();

      if (Array.isArray(dbRows)) {
        dbRows.forEach(row => {
          const key = row.catalog_type === 'sarojini' 
            ? (row.sarojini_product_id || row.product_id)
            : (row.product_id || row.sarojini_product_id);

          if (key) {
            newIds.add(key);
            state.itemsMap.set(key, row);
          }
        });
      }

      // Merge any pending guest items from local cache if user just logged in
      const localIds = JSON.parse(localStorage.getItem("velora_wishlist") || "[]");
      if (Array.isArray(localIds) && localIds.length > 0) {
        for (const localId of localIds) {
          if (!newIds.has(localId) && isUUID(localId)) {
            // Push guest item to database
            try {
              const isSarojini = state.sarojiniCache.some(sp => sp.id === localId) || 
                                 (window.location.pathname.includes("sarojini"));
              
              const payload = {
                user_id: user.id,
                catalog_type: isSarojini ? 'sarojini' : 'main',
                product_id: isSarojini ? null : localId,
                sarojini_product_id: isSarojini ? localId : null
              };

              const { data: insData } = await client.from("wishlist").insert([payload]).select().maybeSingle();
              if (insData) {
                newIds.add(localId);
                state.itemsMap.set(localId, insData);
              }
            } catch (_) {}
          }
        }
      }

      state.wishlistIds = newIds;
      saveLocalCache();
      updateAllBadges();
      syncAllHeartButtons();

      window.dispatchEvent(new CustomEvent("vadi:wishlist-updated", { detail: { count: state.wishlistIds.size } }));
      window.dispatchEvent(new CustomEvent("velora:wishlist-updated", { detail: { count: state.wishlistIds.size } }));

    } catch (err) {
      console.warn("[VadiWishlist] Exception during DB sync:", err);
    }
  }

  // Load Sarojini products into cache for instant resolution
  async function loadSarojiniCatalog() {
    const client = getClient();
    if (!client) return;

    try {
      const { data, error } = await client.from("sarojini_products").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        state.sarojiniCache = data.map(p => ({
          ...p,
          catalog_type: 'sarojini',
          image: (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
            ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: false })
            : ((Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.image || 'assets/sarojni/prod-2-graphic-tee.png')),
          originalPrice: Number(p.original_price) || Number(p.price) || 0,
          original_price: Number(p.original_price) || Number(p.price) || 0
        }));
      }
    } catch (_) {}
  }

  // Setup Realtime Subscription
  function setupRealtime(user) {
    const client = getClient();
    if (!client || !user || !user.id) return;

    try {
      client
        .channel(`public:wishlist_${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "wishlist", filter: `user_id=eq.${user.id}` }, () => {
          syncFromDatabase();
        })
        .subscribe();
    } catch (_) {}
  }

  // The Public API
  const VadiWishlist = {
    /**
     * Check if product ID is currently in wishlist
     */
    has: function (productId) {
      if (!productId) return false;
      return state.wishlistIds.has(String(productId));
    },

    /**
     * Get set of all wishlisted product IDs
     */
    getIds: function () {
      return new Set(state.wishlistIds);
    },

    /**
     * Get total count of items
     */
    getCount: function () {
      return state.wishlistIds.size;
    },

    /**
     * Main Toggle Action - Adds or removes a product
     */
    toggle: async function (productId, explicitCatalogType = null, productInfo = null) {
      if (!productId) return false;
      const id = String(productId);
      const isCurrentlySaved = state.wishlistIds.has(id);
      const willAdd = !isCurrentlySaved;

      // Determine catalog type
      let catalogType = explicitCatalogType;
      if (!catalogType) {
        if (state.sarojiniCache.some(sp => String(sp.id) === id) || 
            window.location.pathname.includes("sarojini") ||
            (productInfo && productInfo.catalog_type === 'sarojini')) {
          catalogType = 'sarojini';
        } else {
          catalogType = 'main';
        }
      }

      // Optimistic UI updates
      if (willAdd) {
        state.wishlistIds.add(id);
      } else {
        state.wishlistIds.delete(id);
        state.itemsMap.delete(id);
      }

      saveLocalCache();
      updateHeartButtonUI(id, willAdd);
      updateAllBadges();

      // Product name for toast
      let prodName = productInfo?.name || productInfo?.title;
      if (!prodName) {
        const resolved = this.resolveProduct(id);
        prodName = resolved?.name || (catalogType === 'sarojini' ? 'Sarojini Product' : 'Product');
      }

      notify(
        willAdd ? `Added "${prodName}" to wishlist!` : `Removed "${prodName}" from wishlist`,
        willAdd ? "success" : "info"
      );

      // Trigger custom events
      window.dispatchEvent(new CustomEvent("vadi:wishlist-updated", { detail: { productId: id, willAdd, count: state.wishlistIds.size } }));
      window.dispatchEvent(new CustomEvent("velora:wishlist-updated", { detail: { productId: id, willAdd, count: state.wishlistIds.size } }));

      // Analytics tracking if present
      if (window.VeloraAnalytics && typeof window.VeloraAnalytics.trackWishlist === 'function') {
        window.VeloraAnalytics.trackWishlist(id, willAdd ? 'add' : 'remove');
      }

      // Database Synchronization
      const client = getClient();
      const user = await getAuthUser();

      if (client && user && user.id && isUUID(id)) {
        try {
          if (willAdd) {
            const rowPayload = {
              user_id: user.id,
              catalog_type: catalogType,
              product_id: catalogType === 'main' ? id : null,
              sarojini_product_id: catalogType === 'sarojini' ? id : null
            };

            const { data: insData, error: insErr } = await client
              .from("wishlist")
              .insert([rowPayload])
              .select()
              .maybeSingle();

            if (!insErr && insData) {
              state.itemsMap.set(id, insData);
            }
          } else {
            // Delete
            if (catalogType === 'sarojini') {
              await client.from("wishlist").delete()
                .eq("user_id", user.id)
                .eq("sarojini_product_id", id);
            } else {
              await client.from("wishlist").delete()
                .eq("user_id", user.id)
                .eq("product_id", id);
            }
          }
        } catch (dbErr) {
          console.warn("[VadiWishlist] Supabase operation note:", dbErr);
        }
      }

      return willAdd;
    },

    /**
     * Resolve product metadata from either Main VADI or Sarojini Bazaar catalogs
     */
    resolveProduct: function (id) {
      const strId = String(id);

      // 1. Try window.getProductById (Main VADI)
      if (typeof window.getProductById === 'function') {
        const p = window.getProductById(strId);
        if (p) return { ...p, catalog_type: 'main' };
      }

      // 2. Try window.PRODUCTS_DATA (Main VADI)
      if (Array.isArray(window.PRODUCTS_DATA)) {
        const p = window.PRODUCTS_DATA.find(x => String(x.id) === strId || String(x.slug) === strId);
        if (p) return { ...p, catalog_type: 'main' };
      }

      // 3. Try Sarojini catalog cache
      if (state.sarojiniCache.length > 0) {
        const sp = state.sarojiniCache.find(x => String(x.id) === strId || String(x.slug) === strId);
        if (sp) return { ...sp, catalog_type: 'sarojini' };
      }

      return null;
    },

    /**
     * Fetch all items in wishlist with full product metadata
     */
    getAllProducts: async function () {
      // Refresh database to guarantee 100% current state
      await syncFromDatabase();
      await loadSarojiniCatalog();

      const missingUUIDs = [];
      const resolvedList = [];

      state.wishlistIds.forEach(id => {
        const p = this.resolveProduct(id);
        if (p) {
          resolvedList.push(p);
        } else if (isUUID(id)) {
          missingUUIDs.push(id);
        }
      });

      // If any UUIDs weren't in memory, fetch from Supabase
      if (missingUUIDs.length > 0) {
        const client = getClient();
        if (client) {
          try {
            // Main products
            const { data: dbMain } = await client.from("products").select("*").in("id", missingUUIDs);
            if (Array.isArray(dbMain)) {
              dbMain.forEach(p => {
                const prod = {
                  ...p,
                  catalog_type: 'main',
                  image: (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
                    ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: false })
                    : (Array.isArray(p.images) && p.images[0] ? p.images[0] : (p.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400')),
                  originalPrice: Number(p.original_price) || Number(p.price) || 0,
                  reviewsCount: p.review_count || 0
                };
                resolvedList.push(prod);
              });
            }

            // Sarojini products
            const { data: dbSar } = await client.from("sarojini_products").select("*").in("id", missingUUIDs);
            if (Array.isArray(dbSar)) {
              dbSar.forEach(sp => {
                const prod = {
                  ...sp,
                  catalog_type: 'sarojini',
                  image: (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
                    ? window.VeloraImageUtils.resolveProductImage(sp, { isAdmin: false })
                    : (Array.isArray(sp.images) && sp.images[0] ? sp.images[0] : (sp.image || 'assets/sarojni/prod-1-graphic-tee.png')),
                  originalPrice: Number(sp.original_price) || Number(sp.price) || 0,
                  reviewsCount: sp.review_count || 0
                };
                resolvedList.push(prod);
                state.sarojiniCache.push(prod);
              });
            }
          } catch (_) {}
        }
      }

      return resolvedList;
    },

    /**
     * Clear all wishlist items for current user
     */
    clear: async function () {
      const client = getClient();
      const user = await getAuthUser();

      state.wishlistIds.clear();
      state.itemsMap.clear();
      saveLocalCache();
      updateAllBadges();
      syncAllHeartButtons();

      if (client && user && user.id) {
        try {
          await client.from("wishlist").delete().eq("user_id", user.id);
        } catch (_) {}
      }

      window.dispatchEvent(new CustomEvent("vadi:wishlist-updated", { detail: { count: 0 } }));
      window.dispatchEvent(new CustomEvent("velora:wishlist-updated", { detail: { count: 0 } }));
    },

    /**
     * Force synchronization
     */
    sync: function () {
      return syncFromDatabase();
    },

    /**
     * Sync UI elements
     */
    refreshUI: function () {
      updateAllBadges();
      syncAllHeartButtons();
    }
  };

  // Expose globally
  window.VadiWishlist = VadiWishlist;
  // Expose toggleWishlist for legacy compatibility
  window.toggleWishlist = function (productId, catalogType, info) {
    return VadiWishlist.toggle(productId, catalogType, info);
  };

  // Initialization lifecycle
  async function init() {
    loadLocalCache();
    updateAllBadges();
    syncAllHeartButtons();

    await loadSarojiniCatalog();
    await syncFromDatabase();

    const client = getClient();
    if (client && client.auth) {
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session && session.user) {
            setupRealtime(session.user);
            await syncFromDatabase();
          }
        } else if (event === "SIGNED_OUT") {
          // Prevent customer data leakage on logout
          state.wishlistIds.clear();
          state.itemsMap.clear();
          saveLocalCache();
          updateAllBadges();
          syncAllHeartButtons();
        }
      });

      const user = await getAuthUser();
      if (user) setupRealtime(user);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

