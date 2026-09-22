/**
 * VADI & SAROJINI BAZAAR - Normalized Cross-Store Availability Service
 * 
 * Manages store availability assignments between Main VADI Store and Sarojini Bazaar
 * WITHOUT duplicating, cloning, moving, or deleting product database records.
 * Products strictly reside in their origin catalog:
 *   - Main VADI products reside in `public.products`
 *   - Sarojini Bazaar products reside in `public.sarojini_products`
 * Multi-store availability is stored as a clean, normalized registry in `store_settings.cross_store_mapping`.
 */

(function (window) {
  'use strict';

  const SETTING_KEY = "cross_store_mapping";

  const CrossStoreService = {
    /**
     * Retrieve the normalized cross-store availability registry from store_settings.
     * Schema:
     * {
     *   main_available_in_sarojini: { [mainId]: { available: true, department, category_id, is_featured, added_at } },
     *   sarojini_available_in_main: { [sarojiniId]: { available: true, category_id, is_featured, added_at } }
     * }
     */
    async getMapping(client) {
      const defaultState = {
        main_available_in_sarojini: {},
        sarojini_available_in_main: {},
        main_to_sarojini: {},
        sarojini_to_main: {}
      };

      if (!client) return defaultState;

      try {
        const { data, error } = await client
          .from("store_settings")
          .select("value")
          .eq("key", SETTING_KEY)
          .maybeSingle();

        if (error) {
          console.warn("[CrossStoreService] Failed to load mapping:", error);
          return defaultState;
        }

        if (data && data.value && typeof data.value === "object") {
          const mainInSarojini = data.value.main_available_in_sarojini || {};
          const sarojiniInMain = data.value.sarojini_available_in_main || {};

          // Maintain backward compatibility aliases
          const mainToSarojini = {};
          Object.keys(mainInSarojini).forEach(id => {
            mainToSarojini[id] = id;
          });
          const sarojiniToMain = {};
          Object.keys(sarojiniInMain).forEach(id => {
            sarojiniToMain[id] = id;
          });

          return {
            main_available_in_sarojini: mainInSarojini,
            sarojini_available_in_main: sarojiniInMain,
            main_to_sarojini: mainToSarojini,
            sarojini_to_main: sarojiniToMain
          };
        }
      } catch (err) {
        console.warn("[CrossStoreService] Exception loading mapping:", err);
      }

      return defaultState;
    },

    /**
     * Persist normalized mapping in store_settings
     */
    async saveMapping(client, mapping) {
      if (!client) throw new Error("Database client required");

      const payload = {
        key: SETTING_KEY,
        value: {
          main_available_in_sarojini: mapping.main_available_in_sarojini || {},
          sarojini_available_in_main: mapping.sarojini_available_in_main || {},
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from("store_settings")
        .upsert(payload, { onConflict: "key" });

      if (error) {
        console.error("[CrossStoreService] Failed to save mapping:", error);
        throw error;
      }
      return true;
    },

    /**
     * Helper to test whether a product is available in Main Store
     */
    isAvailableInMain(mapping, product) {
      if (!product || !product.id) return false;
      const origin = product.origin_catalog || (product.department ? "sarojini" : "main");
      if (origin === "main") return true;
      return Boolean(mapping?.sarojini_available_in_main?.[product.id]?.available);
    },

    /**
     * Helper to test whether a product is available in Sarojini Bazaar
     */
    isAvailableInSarojini(mapping, product) {
      if (!product || !product.id) return false;
      const origin = product.origin_catalog || (product.department ? "sarojini" : "main");
      if (origin === "sarojini") return true;
      return Boolean(mapping?.main_available_in_sarojini?.[product.id]?.available);
    },

    /**
     * Add Main VADI Product to Sarojini Bazaar (NO DUPLICATION of product row)
     */
    async addMainToSarojini(client, mainProduct, options = {}) {
      if (!mainProduct || !mainProduct.id) {
        throw new Error("Invalid Main product provided.");
      }

      const mapping = await this.getMapping(client);
      const existing = mapping.main_available_in_sarojini[mainProduct.id];

      if (existing && existing.available) {
        return {
          success: true,
          alreadyExists: true,
          targetId: mainProduct.id,
          message: `Product "${mainProduct.name}" is already available in Sarojini Bazaar.`
        };
      }

      const department = (options.department || "MEN").toUpperCase();
      const categoryId = options.categoryId || null;
      const isFeatured = Boolean(options.isFeatured);

      mapping.main_available_in_sarojini[mainProduct.id] = {
        available: true,
        department: department,
        category_id: categoryId,
        category_slug: options.categorySlug || null,
        is_featured: isFeatured,
        added_at: new Date().toISOString()
      };

      await this.saveMapping(client, mapping);

      // If marked featured, sync to homepage section product_ids
      if (isFeatured) {
        try {
          const SAROJINI_SEC_ID = '22222222-2222-4222-a222-000000000001';
          const { data: sec } = await client.from('homepage_sections').select('*').eq('id', SAROJINI_SEC_ID).maybeSingle();
          if (sec) {
            const cfg = sec.content_config || {};
            let pids = Array.isArray(cfg.product_ids) ? [...cfg.product_ids] : [];
            if (!pids.includes(mainProduct.id)) {
              pids.unshift(mainProduct.id);
              cfg.product_ids = pids;
              await client.from('homepage_sections').update({
                content_config: cfg,
                updated_at: new Date().toISOString()
              }).eq('id', SAROJINI_SEC_ID);
            }
          }
        } catch (e) {
          console.warn("[CrossStoreService] Homepage section feature sync note:", e);
        }
      }

      this.invalidateCaches();

      return {
        success: true,
        alreadyExists: false,
        targetId: mainProduct.id,
        message: `Successfully made "${mainProduct.name}" available in Sarojini Bazaar!`
      };
    },

    /**
     * Add Sarojini Product to Main VADI Store (NO DUPLICATION of product row)
     */
    async addSarojiniToMain(client, sarojiniProduct, options = {}) {
      if (!sarojiniProduct || !sarojiniProduct.id) {
        throw new Error("Invalid Sarojini product provided.");
      }

      const mapping = await this.getMapping(client);
      const existing = mapping.sarojini_available_in_main[sarojiniProduct.id];

      if (existing && existing.available) {
        return {
          success: true,
          alreadyExists: true,
          targetId: sarojiniProduct.id,
          message: `Product "${sarojiniProduct.name}" is already available in Main VADI Store.`
        };
      }

      const categoryId = options.categoryId || null;
      const isFeatured = Boolean(options.isFeatured);

      mapping.sarojini_available_in_main[sarojiniProduct.id] = {
        available: true,
        category_id: categoryId,
        is_featured: isFeatured,
        added_at: new Date().toISOString()
      };

      await this.saveMapping(client, mapping);

      this.invalidateCaches();

      return {
        success: true,
        alreadyExists: false,
        targetId: sarojiniProduct.id,
        message: `Successfully made "${sarojiniProduct.name}" available in Main VADI Store!`
      };
    },

    /**
     * Remove availability from target store WITHOUT deleting the underlying product record.
     * @param {Object} options - { originCatalog: 'main'|'sarojini', productId, targetStore: 'sarojini'|'main' }
     */
    async removeFromStore(client, { originCatalog, productId, targetStore }) {
      if (!productId) throw new Error("Product ID required for removal.");
      const mapping = await this.getMapping(client);

      const isRemovingFromSarojini = (targetStore === "sarojini") || (originCatalog === "main");
      const isRemovingFromMain = (targetStore === "main") || (originCatalog === "sarojini");

      if (isRemovingFromSarojini) {
        delete mapping.main_available_in_sarojini[productId];

        // Clean up from homepage_sections if present
        try {
          const SAROJINI_SEC_ID = '22222222-2222-4222-a222-000000000001';
          const { data: sec } = await client.from('homepage_sections').select('*').eq('id', SAROJINI_SEC_ID).maybeSingle();
          if (sec && sec.content_config && Array.isArray(sec.content_config.product_ids)) {
            const filteredPids = sec.content_config.product_ids.filter(id => String(id) !== String(productId));
            if (filteredPids.length !== sec.content_config.product_ids.length) {
              sec.content_config.product_ids = filteredPids;
              await client.from('homepage_sections').update({
                content_config: sec.content_config,
                updated_at: new Date().toISOString()
              }).eq('id', SAROJINI_SEC_ID);
            }
          }
        } catch (_) {}

        await this.saveMapping(client, mapping);
        this.invalidateCaches();
        return { success: true, message: "Product availability removed from Sarojini Bazaar." };
      }

      if (isRemovingFromMain) {
        delete mapping.sarojini_available_in_main[productId];

        await this.saveMapping(client, mapping);
        this.invalidateCaches();
        return { success: true, message: "Product availability removed from Main VADI Store." };
      }

      throw new Error(`Unsupported removal request: origin=${originCatalog}, target=${targetStore}`);
    },

    /**
     * Synchronize product edits.
     * Because products are single canonical records with normalized availability,
     * updates to the underlying product row are instantly shared!
     */
    async syncProductEdits(client, productId, originCatalog, payload) {
      this.invalidateCaches();
      return { synced: true, message: "Product synchronized across availability channels." };
    },

    invalidateCaches() {
      try {
        localStorage.setItem("sarojini_global_cache_invalidated", Date.now().toString());
        localStorage.setItem("velora_global_cache_invalidated", Date.now().toString());
        if (window.VeloraCache && typeof window.VeloraCache.invalidate === "function") {
          window.VeloraCache.invalidate();
        }
      } catch (_) {}
    }
  };

  window.CrossStoreService = CrossStoreService;
})(window);
