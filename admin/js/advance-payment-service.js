/**
 * VALORA Admin Panel - Advance Payment Service
 * Authoritative management for Global, Bulk, and Individual Product Advance Payments.
 * Integrates with store_settings (key = 'advance_payment') and public.products / public.sarojini_products.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'valora_advance_payment_settings';
  const DEFAULT_SETTINGS = {
    enabled: true,
    default_amount: 120,
    applies_to: 'both', // 'main' | 'sarojini' | 'both'
    custom_overrides: {}, // Map of productId -> true
    updated_at: new Date().toISOString()
  };

  let inMemorySettings = null;

  /**
   * Retrieves global advance payment settings from store_settings or localStorage fallback.
   * @param {Object} client - Supabase client
   * @returns {Promise<Object>} Settings object
   */
  async function getGlobalSettings(client) {
    if (inMemorySettings) return inMemorySettings;

    // 1. Check store_settings table
    if (client) {
      try {
        const { data, error } = await client
          .from('store_settings')
          .select('value, updated_at')
          .eq('key', 'advance_payment')
          .maybeSingle();

        if (!error && data && data.value) {
          inMemorySettings = {
            ...DEFAULT_SETTINGS,
            ...data.value,
            custom_overrides: data.value.custom_overrides || {}
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemorySettings));
          } catch (_) {}
          return inMemorySettings;
        }
      } catch (err) {
        console.warn('[AdvanceService] DB fetch warning:', err);
      }
    }

    // 2. Check localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        inMemorySettings = JSON.parse(cached);
        return inMemorySettings;
      }
    } catch (_) {}

    // 3. Fallback default
    inMemorySettings = { ...DEFAULT_SETTINGS };
    return inMemorySettings;
  }

  /**
   * Persists global advance payment settings to store_settings and localStorage.
   * @param {Object} client - Supabase client
   * @param {Object} newSettings - Updated settings
   * @returns {Promise<Object>} Saved settings
   */
  async function saveGlobalSettings(client, newSettings) {
    const updated = {
      ...DEFAULT_SETTINGS,
      ...(inMemorySettings || {}),
      ...newSettings,
      updated_at: new Date().toISOString()
    };

    inMemorySettings = updated;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}

    if (client) {
      try {
        const { error } = await client
          .from('store_settings')
          .upsert([{
            key: 'advance_payment',
            value: updated,
            description: 'Global Advance Payment Management Settings',
            updated_at: updated.updated_at
          }], { onConflict: 'key' });

        if (error) {
          console.warn('[AdvanceService] DB upsert warning:', error.message);
        }
      } catch (err) {
        console.warn('[AdvanceService] DB upsert exception:', err);
      }
    }

    // Invalidate storefront and cross-store caches
    try {
      localStorage.setItem('velora_global_cache_invalidated', Date.now().toString());
      if (window.VeloraCache && typeof window.VeloraCache.invalidate === 'function') {
        window.VeloraCache.invalidate();
      }
    } catch (_) {}

    return updated;
  }

  /**
   * Determines if a specific product has a custom product-level advance override.
   * Priority Logic:
   * 1. If explicit productId is in custom_overrides map -> true
   * 2. If product has custom advance_payment_value differing from global default -> true
   * 3. If product has advance_payment_enabled !== globalSettings.enabled -> true
   * @param {Object} product - Product record
   * @param {Object} globalSettings - Global advance settings
   * @returns {boolean}
   */
  function isCustomOverride(product, globalSettings) {
    if (!product) return false;
    const settings = globalSettings || inMemorySettings || DEFAULT_SETTINGS;
    const pId = String(product.id);

    // 1. Registered in custom_overrides map
    if (settings.custom_overrides && settings.custom_overrides[pId]) {
      return true;
    }

    const pEnabled = Boolean(product.advance_payment_enabled);
    const pVal = Number(product.advance_payment_value) || 0;
    const defaultVal = Number(settings.default_amount) || 120;
    const globalEnabled = Boolean(settings.enabled);

    // If global is enabled and product has a different non-zero amount or different type
    if (product.advance_payment_type === 'percentage') {
      return true;
    }

    if (globalEnabled && pEnabled && pVal > 0 && pVal !== defaultVal) {
      return true;
    }

    // If global is enabled but product was specifically disabled
    if (globalEnabled && !pEnabled && product.advance_payment_enabled !== undefined && product.advance_payment_enabled !== null) {
      // If product explicitly has false stored and was created/edited
      if (product.advance_payment_value === 0 && !pEnabled) {
        return true;
      }
    }

    return false;
  }

  /**
   * Registers or clears a product from the custom overrides registry.
   * @param {Object} client - Supabase client
   * @param {string} productId - Product UUID
   * @param {boolean} isCustom - Whether product is a custom override
   * @returns {Promise<void>}
   */
  async function markCustomOverride(client, productId, isCustom) {
    if (!productId) return;
    const settings = await getGlobalSettings(client);
    const overrides = { ...(settings.custom_overrides || {}) };

    if (isCustom) {
      overrides[String(productId)] = true;
    } else {
      delete overrides[String(productId)];
    }

    await saveGlobalSettings(client, {
      ...settings,
      custom_overrides: overrides
    });
  }

  /**
   * Calculates advance amount and badges for a product row.
   * @param {Object} product - Product record
   * @param {Object} globalSettings - Global advance settings
   * @returns {Object} { amount, isEnabled, isCustom, type, badgeHtml, statusText }
   */
  function getProductAdvanceInfo(product, globalSettings) {
    const settings = globalSettings || inMemorySettings || DEFAULT_SETTINGS;
    const isCustom = isCustomOverride(product, settings);
    const isEnabled = product.advance_payment_enabled !== undefined && product.advance_payment_enabled !== null
      ? Boolean(product.advance_payment_enabled)
      : Boolean(settings.enabled);

    const type = product.advance_payment_type || 'fixed';
    let amount = Number(product.advance_payment_value);
    if (isNaN(amount) || amount === null || amount === undefined) {
      amount = isEnabled ? Number(settings.default_amount) || 120 : 0;
    }

    const fmt = window.formatINR || (v => `₹${v}`);

    let badgeHtml = '';
    let statusText = '';

    if (!isEnabled || amount <= 0) {
      badgeHtml = `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 0.72rem;">₹0 (Disabled)</span>`;
      statusText = 'Disabled (₹0)';
    } else if (isCustom) {
      const displayVal = type === 'percentage' ? `${amount}%` : fmt(amount);
      badgeHtml = `<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="Custom product override"><i class="fas fa-user-cog" style="font-size: 0.65rem;"></i> ${displayVal} (Custom)</span>`;
      statusText = `${displayVal} (Custom Override)`;
    } else {
      const displayVal = fmt(amount);
      badgeHtml = `<span class="badge badge-indigo" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="Store global default"><i class="fas fa-globe" style="font-size: 0.65rem;"></i> ${displayVal} (Default)</span>`;
      statusText = `${displayVal} (Global Default)`;
    }

    return {
      amount,
      isEnabled,
      isCustom,
      type,
      badgeHtml,
      statusText
    };
  }

  /**
   * Applies advance payment in bulk to target products.
   * Supports:
   * 1. Apply Default (Skip Custom Overrides)
   * 2. Apply & Override Custom Amounts
   *
   * @param {Object} client - Supabase client
   * @param {Object} options
   * @param {Array<Object>} options.products - Array of product objects to process
   * @param {boolean} options.isEnabled - Enable/disable advance payment
   * @param {number} options.amount - Advance amount in ₹
   * @param {boolean} options.overrideCustom - Force override custom product amounts
   * @returns {Promise<Object>} Statistics of execution
   */
  async function applyBulkAdvance(client, options) {
    const {
      products = [],
      isEnabled = true,
      amount = 120,
      overrideCustom = false
    } = options;

    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No products provided for advance payment update.');
    }

    const settings = await getGlobalSettings(client);
    const overrides = { ...(settings.custom_overrides || {}) };

    const parsedAmount = Math.max(0, parseFloat(amount) || 0);
    const numericEnabled = Boolean(isEnabled && parsedAmount > 0);

    const toUpdate = [];
    let customCount = 0;
    let skippedCustomCount = 0;

    for (const prod of products) {
      const isCustom = isCustomOverride(prod, settings);
      if (isCustom) customCount++;

      if (isCustom && !overrideCustom) {
        // Skip this product to preserve individual product custom override
        skippedCustomCount++;
        continue;
      }

      toUpdate.push(prod);
    }

    if (toUpdate.length === 0) {
      return {
        totalMatched: products.length,
        updatedCount: 0,
        skippedCustomCount,
        customOverridesCount: customCount
      };
    }

    // Split toUpdate into Main Store (products) and Sarojini Bazaar (sarojini_products)
    const mainProducts = toUpdate.filter(p => p.origin_catalog !== 'sarojini');
    const sarojiniProducts = toUpdate.filter(p => p.origin_catalog === 'sarojini');

    const updatePayload = {
      advance_payment_enabled: numericEnabled,
      advance_payment_type: 'fixed',
      advance_payment_value: parsedAmount,
      updated_at: new Date().toISOString()
    };

    // Batch update Main products in chunks of 50
    if (client && mainProducts.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < mainProducts.length; i += chunkSize) {
        const chunkIds = mainProducts.slice(i, i + chunkSize).map(p => p.id);
        const { error } = await client
          .from('products')
          .update(updatePayload)
          .in('id', chunkIds);

        if (error) throw error;
      }
    }

    // Batch update Sarojini products in chunks of 50
    if (client && sarojiniProducts.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < sarojiniProducts.length; i += chunkSize) {
        const chunkIds = sarojiniProducts.slice(i, i + chunkSize).map(p => p.id);
        const { error } = await client
          .from('sarojini_products')
          .update(updatePayload)
          .in('id', chunkIds);

        if (error) throw error;
      }
    }

    // Update in-memory product objects
    toUpdate.forEach(p => {
      p.advance_payment_enabled = numericEnabled;
      p.advance_payment_type = 'fixed';
      p.advance_payment_value = parsedAmount;
    });

    // If overrideCustom was selected, remove updated products from custom_overrides map
    if (overrideCustom) {
      toUpdate.forEach(p => {
        delete overrides[String(p.id)];
      });
    }

    // Update global settings
    await saveGlobalSettings(client, {
      ...settings,
      enabled: numericEnabled,
      default_amount: parsedAmount,
      custom_overrides: overrides
    });

    return {
      totalMatched: products.length,
      updatedCount: toUpdate.length,
      skippedCustomCount,
      customOverridesCount: customCount
    };
  }

  // Export public service API
  window.AdvancePaymentService = {
    getGlobalSettings,
    saveGlobalSettings,
    isCustomOverride,
    markCustomOverride,
    getProductAdvanceInfo,
    applyBulkAdvance
  };

})();
