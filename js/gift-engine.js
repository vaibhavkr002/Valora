/**
 * VELORA - Dynamic Gift Offers Engine
 * Centralized client engine for resolving category-level and product-level
 * free gift bundles awarded on 100% full online payments.
 * 
 * Powered by Supabase backend with store_settings fallback.
 */

(function () {
  'use strict';

  // Default seed configuration in case backend table has not been initialized
  const DEFAULT_OFFERS = [
    {
      id: "offer-shoes-001",
      title: "Shoes & Footwear Luxury Pack",
      target_type: "category",
      category_id: "c0000000-0000-0000-0000-000000000001",
      category_name: "Shoes & Footwear",
      category_slug: "shoes",
      product_id: null,
      product_name: null,
      is_active: true,
      priority: 10,
      start_date: null,
      end_date: null,
      gifts: [
        {
          id: "gift-shoes-1",
          name: "Complimentary Luxury Cotton Crew Socks",
          description: "Premium combed cotton comfort socks",
          icon_or_image: "https://images.unsplash.com/photo-1582966772680-860e372bb558?w=200",
          quantity: 1,
          display_order: 1
        },
        {
          id: "gift-shoes-2",
          name: "Complimentary Premium Extra Laces",
          description: "Signature woven replacement laces",
          icon_or_image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=200",
          quantity: 1,
          display_order: 2
        },
        {
          id: "gift-shoes-3",
          name: "Complimentary Signature VELORA Keychain",
          description: "Brushed stainless luxury metal accessory",
          icon_or_image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200",
          quantity: 1,
          display_order: 3
        }
      ]
    },
    {
      id: "offer-watches-002",
      title: "Watch Care & Storage Bundle",
      target_type: "category",
      category_id: "c0000000-0000-0000-0000-000000000002",
      category_name: "Luxury Watches",
      category_slug: "watches",
      product_id: null,
      product_name: null,
      is_active: true,
      priority: 10,
      start_date: null,
      end_date: null,
      gifts: [
        {
          id: "gift-watch-1",
          name: "Complimentary Premium Travel Watch Case",
          description: "Cushioned protective leather watch pouch",
          icon_or_image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=200",
          quantity: 1,
          display_order: 1
        },
        {
          id: "gift-watch-2",
          name: "Microfiber Watch Polishing Cloth",
          description: "High-density scratch-free watch cleaner",
          icon_or_image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200",
          quantity: 1,
          display_order: 2
        }
      ]
    },
    {
      id: "offer-bags-003",
      title: "Bag Organizer & Key Ring Kit",
      target_type: "category",
      category_id: "c0000000-0000-0000-0000-000000000004",
      category_name: "Bags & Backpacks",
      category_slug: "bags",
      product_id: null,
      product_name: null,
      is_active: true,
      priority: 10,
      start_date: null,
      end_date: null,
      gifts: [
        {
          id: "gift-bag-1",
          name: "Compact Bag Organizer Insert",
          description: "Multi-compartment organizer for totes & duffels",
          icon_or_image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200",
          quantity: 1,
          display_order: 1
        },
        {
          id: "gift-bag-2",
          name: "Complimentary Signature VELORA Keychain",
          description: "Luxury metal key ring with clip",
          icon_or_image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200",
          quantity: 1,
          display_order: 2
        }
      ]
    }
  ];

  let cachedOffers = null;
  let cachePromise = null;
  let isSubscribed = false;

  function getClient() {
    if (window.VeloraAuth && typeof window.VeloraAuth.getClient === "function") {
      return window.VeloraAuth.getClient();
    }
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.getSupabase === "function") return window.getSupabase();
    return null;
  }

  /**
   * Fetch active offers from Supabase with resilient fallbacks
   */
  async function fetchOffers(forceRefresh = false) {
    if (!forceRefresh && cachedOffers) {
      return cachedOffers;
    }
    if (!forceRefresh && cachePromise) {
      return cachePromise;
    }

    cachePromise = (async () => {
      const client = getClient();
      let offers = null;

      // 1. Try reading from dedicated Supabase tables: online_gift_offers + online_gift_items
      if (client) {
        try {
          const { data: dbOffers, error } = await client
            .from("online_gift_offers")
            .select("*, online_gift_items(*), categories(name, slug), products(name)")
            .order("priority", { ascending: false });

          if (!error && dbOffers && dbOffers.length > 0) {
            offers = dbOffers.map(o => ({
              id: o.id,
              title: o.title,
              target_type: o.target_type,
              category_id: o.category_id,
              category_name: o.categories?.name || null,
              category_slug: o.categories?.slug || null,
              product_id: o.product_id,
              product_name: o.products?.name || null,
              is_active: Boolean(o.is_active),
              priority: Number(o.priority) || 0,
              start_date: o.start_date,
              end_date: o.end_date,
              gifts: (o.online_gift_items || [])
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map(g => ({
                  id: g.id,
                  name: g.name,
                  description: g.description,
                  icon_or_image: g.icon_or_image,
                  quantity: g.quantity || 1,
                  display_order: g.display_order || 0
                }))
            }));
          }
        } catch (_) {
          // Schema cache notice: fallback to store_settings
        }

        // 2. Fallback to store_settings.gift_offers_config
        if (!offers) {
          try {
            const { data: settingRow, error: setErr } = await client
              .from("store_settings")
              .select("value")
              .eq("key", "gift_offers_config")
              .maybeSingle();

            if (!setErr && settingRow && Array.isArray(settingRow.value)) {
              offers = settingRow.value;
            }
          } catch (_) {}
        }
      }

      // 3. Fallback to localStorage cache if network is offline
      if (!offers) {
        try {
          const local = localStorage.getItem("velora_gift_offers_config");
          if (local) {
            offers = JSON.parse(local);
          }
        } catch (_) {}
      }

      // 4. Default Seed Fallback
      if (!offers || offers.length === 0) {
        offers = DEFAULT_OFFERS;
      }

      cachedOffers = offers;
      try {
        localStorage.setItem("velora_gift_offers_config", JSON.stringify(offers));
      } catch (_) {}

      // Set up real-time updates
      setupRealtime();

      return offers;
    })();

    return cachePromise;
  }

  /**
   * Subscribe to Supabase Realtime changes
   */
  function setupRealtime() {
    if (isSubscribed) return;
    const client = getClient();
    if (!client || typeof client.channel !== "function") return;

    try {
      client.channel("gift-offers-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "online_gift_offers" }, () => {
          refreshOffers();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "online_gift_items" }, () => {
          refreshOffers();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "store_settings", filter: "key=eq.gift_offers_config" }, () => {
          refreshOffers();
        })
        .subscribe();

      isSubscribed = true;
    } catch (_) {}
  }

  async function refreshOffers() {
    cachedOffers = null;
    cachePromise = null;
    const fresh = await fetchOffers(true);
    window.dispatchEvent(new CustomEvent("velora:gift-offers-updated", { detail: fresh }));
    return fresh;
  }

  /**
   * Check date range validity for an offer
   */
  function isOfferTimeValid(offer) {
    const now = new Date();
    if (offer.start_date && new Date(offer.start_date) > now) return false;
    if (offer.end_date && new Date(offer.end_date) < now) return false;
    return true;
  }

  /**
   * Resolve applicable gifts for a single product
   * Priority: Product-specific override > Category offer > None
   */
  async function resolveProductGifts(product) {
    if (!product) return { eligible: false, offer: null, gifts: [] };
    const offers = await fetchOffers();

    const prodId = product.id || product.supabase_id;
    const catId = product.category_id;
    const catName = (product.categoryLabel || product.category || "").toLowerCase();

    // 1. Check Product-Level Override
    const productOffer = offers.find(o => 
      o.target_type === "product" && 
      o.product_id && 
      (o.product_id === prodId || o.product_id === String(prodId))
    );

    if (productOffer) {
      if (productOffer.is_active && isOfferTimeValid(productOffer) && (productOffer.gifts || []).length > 0) {
        return {
          eligible: true,
          level: "product",
          offer: productOffer,
          gifts: productOffer.gifts
        };
      }
      // Explicit product override with is_active = false blocks category gifts
      return { eligible: false, level: "product", offer: null, gifts: [] };
    }

    // 2. Check Category-Level Offer
    const categoryOffer = offers.find(o => {
      if (o.target_type !== "category") return false;
      if (!o.is_active || !isOfferTimeValid(o)) return false;

      // Match by category_id
      if (catId && o.category_id && (o.category_id === catId || o.category_id === String(catId))) {
        return true;
      }

      // Match by category name or slug
      if (catName) {
        const oName = (o.category_name || "").toLowerCase();
        const oSlug = (o.category_slug || "").toLowerCase();
        if (oName && (catName.includes(oName) || oName.includes(catName))) return true;
        if (oSlug && (catName.includes(oSlug) || oSlug.includes(catName))) return true;
      }

      return false;
    });

    if (categoryOffer && (categoryOffer.gifts || []).length > 0) {
      return {
        eligible: true,
        level: "category",
        offer: categoryOffer,
        gifts: categoryOffer.gifts
      };
    }

    // 3. No offer configured
    return { eligible: false, level: "none", offer: null, gifts: [] };
  }

  /**
   * Resolve aggregated gifts for multiple products in cart
   * Collects all unique gifts from eligible products, avoiding duplicates
   */
  async function resolveCartGifts(cartItems) {
    if (!cartItems || cartItems.length === 0) {
      return { eligible: false, gifts: [], offers: [] };
    }

    const offers = await fetchOffers();
    const giftsMap = new Map();
    const matchedOffers = new Set();
    let hasAnyEligibleProduct = false;

    for (const item of cartItems) {
      const res = await resolveProductGifts(item);
      if (res.eligible && res.gifts.length > 0) {
        hasAnyEligibleProduct = true;
        if (res.offer) matchedOffers.add(res.offer);

        res.gifts.forEach(gift => {
          const key = gift.name.trim().toLowerCase();
          if (!giftsMap.has(key)) {
            giftsMap.set(key, { ...gift });
          }
        });
      }
    }

    const uniqueGifts = Array.from(giftsMap.values());
    return {
      eligible: hasAnyEligibleProduct && uniqueGifts.length > 0,
      gifts: uniqueGifts,
      offers: Array.from(matchedOffers)
    };
  }

  /**
   * Save offers configuration (Used by Admin Panel)
   * Dual-saves to dedicated tables (if available) and store_settings
   */
  async function saveOffers(newOffers, customClient = null) {
    // Standardize items <-> gifts
    const normalizedOffers = newOffers.map(o => {
      const itemsList = Array.isArray(o.gifts) ? o.gifts : (Array.isArray(o.items) ? o.items : []);
      return {
        ...o,
        gifts: itemsList,
        items: itemsList
      };
    });

    // Update in-memory cache and localStorage immediately for instant UI response
    cachedOffers = normalizedOffers;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("velora_gift_offers_config", JSON.stringify(normalizedOffers));
        window.localStorage.setItem("velora_gift_offers_override", JSON.stringify(normalizedOffers));
      }
    } catch (_) {}

    const client = customClient || getClient();
    if (!client) {
      window.dispatchEvent(new CustomEvent("velora:gift-offers-updated", { detail: normalizedOffers }));
      return true;
    }

    // 1. Dual-save to store_settings for guaranteed universal durability
    try {
      const { data: existRow } = await client
        .from("store_settings")
        .select("key")
        .eq("key", "gift_offers_config")
        .maybeSingle();

      if (existRow) {
        await client
          .from("store_settings")
          .update({ value: normalizedOffers, updated_at: new Date().toISOString() })
          .eq("key", "gift_offers_config");
      } else {
        await client
          .from("store_settings")
          .insert([{
            key: "gift_offers_config",
            value: normalizedOffers,
            description: "Dynamic Full Online Payment Free Gift Offers configuration"
          }]);
      }
    } catch (sErr) {
      console.warn("store_settings save notice:", sErr);
    }

    // 2. Dual-save to dedicated tables if present
    try {
      for (const offer of normalizedOffers) {
        const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const offerPayload = {
          title: offer.title,
          target_type: offer.target_type || "category",
          category_id: isUuid(offer.category_id) ? offer.category_id : null,
          product_id: isUuid(offer.product_id) ? offer.product_id : null,
          is_active: Boolean(offer.is_active),
          priority: Number(offer.priority) || 0,
          start_date: offer.start_date || null,
          end_date: offer.end_date || null,
          updated_at: new Date().toISOString()
        };

        let savedOfferId = isUuid(offer.id) ? offer.id : null;

        if (savedOfferId) {
          await client.from("online_gift_offers").upsert({ id: savedOfferId, ...offerPayload });
        } else {
          const { data: insOffer } = await client.from("online_gift_offers").insert([offerPayload]).select().single();
          if (insOffer) savedOfferId = insOffer.id;
        }

        const offerGifts = offer.gifts || offer.items || [];
        if (savedOfferId && Array.isArray(offerGifts)) {
          // Replace gift items for this offer
          await client.from("online_gift_items").delete().eq("offer_id", savedOfferId);
          if (offerGifts.length > 0) {
            const itemsPayload = offerGifts.map((g, idx) => ({
              offer_id: savedOfferId,
              name: g.name,
              description: g.description || null,
              icon_or_image: g.icon_or_image || null,
              quantity: g.quantity || 1,
              display_order: g.display_order || (idx + 1)
            }));
            await client.from("online_gift_items").insert(itemsPayload);
          }
        }
      }
    } catch (tErr) {
      console.warn("online_gift_offers table save notice:", tErr);
    }

    // Invalidate and refresh cache
    cachedOffers = newOffers;
    localStorage.setItem("velora_gift_offers_config", JSON.stringify(newOffers));
    window.dispatchEvent(new CustomEvent("velora:gift-offers-updated", { detail: newOffers }));
    return true;
  }

  // Export to window
  window.GiftEngine = {
    fetchOffers,
    refreshOffers,
    resolveProductGifts,
    resolveCartGifts,
    saveOffers,
    DEFAULT_OFFERS
  };

  // Pre-load offers on script execution
  fetchOffers().catch(() => {});

})();
