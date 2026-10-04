/**
 * VALORA Admin Panel - Advance Payment Manager Controller
 * Handles global/bulk advance payment operations, targeting scopes, KPI cards,
 * pre-apply live previews, overwrite warnings, and individual product overrides.
 */

(function () {
  'use strict';

  let client = null;
  let allProducts = [];
  let mainCategories = [];
  let sarojiniCategories = [];
  let globalSettings = null;
  let currentScope = 'all'; // 'all' | 'main' | 'sarojini' | 'category' | 'selected' | 'active'
  const selectedProductIds = new Set();
  let pendingOverrideParams = null;
  let editingProduct = null;

  // DOM Elements
  const kpiGlobalDefault = document.getElementById('kpi-global-default');
  const kpiTotalProds = document.getElementById('kpi-total-prods');
  const kpiCustomOverrides = document.getElementById('kpi-custom-overrides');
  const kpiDisabledCount = document.getElementById('kpi-disabled-count');

  const globalToggle = document.getElementById('manager-global-toggle');
  const globalStatusLabel = document.getElementById('manager-global-status-label');
  const advanceAmountInput = document.getElementById('manager-advance-amount');

  const scopeContainer = document.getElementById('scope-buttons-container');
  const scopeCategoryWrapper = document.getElementById('scope-category-wrapper');
  const scopeCategorySelect = document.getElementById('scope-category-select');
  const scopeSelectedCountSpan = document.getElementById('scope-selected-count');

  const summaryTargetCount = document.getElementById('summary-target-count');
  const summaryCurrDefault = document.getElementById('summary-curr-default');
  const summaryNewAdvance = document.getElementById('summary-new-advance');
  const summaryCustomCount = document.getElementById('summary-custom-count');

  const btnApplyDefault = document.getElementById('btn-apply-default');
  const btnApplyOverride = document.getElementById('btn-apply-override');

  const tableSearch = document.getElementById('table-search');
  const tableFilterCatalog = document.getElementById('table-filter-catalog');
  const tableFilterOverride = document.getElementById('table-filter-override');
  const tableBadgeCount = document.getElementById('table-badge-count');
  const thSelectAll = document.getElementById('th-select-all');
  const tableTbody = document.getElementById('table-tbody');

  // Modal elements
  const modalOverride = document.getElementById('modal-override-confirm');
  const modalOverrideCustomCount = document.getElementById('modal-override-custom-count');
  const modalOverrideTotalCount = document.getElementById('modal-override-total-count');
  const modalOverrideNewAmount = document.getElementById('modal-override-new-amount');
  const btnCancelOverride = document.getElementById('btn-cancel-override-modal');
  const btnConfirmOverride = document.getElementById('btn-confirm-override-action');

  // Quick edit single product modal
  const modalQuickEdit = document.getElementById('modal-quick-edit');
  const quickEditProdTitle = document.getElementById('quick-edit-prod-title');
  const quickEditProdSub = document.getElementById('quick-edit-prod-sub');
  const quickEditGlobalLabel = document.getElementById('quick-edit-global-label');
  const quickEditCustomInputWrap = document.getElementById('quick-edit-custom-input-wrap');
  const quickEditAmount = document.getElementById('quick-edit-amount');
  const btnCloseQuickEdit = document.getElementById('btn-close-quick-edit');
  const btnCancelQuickEdit = document.getElementById('btn-cancel-quick-edit');
  const btnSaveQuickEdit = document.getElementById('btn-save-quick-edit');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- INITIALIZATION ---
  async function init(adminUser) {
    if (!client) {
      client = (window.AdminAuth && typeof window.AdminAuth.getClient === 'function')
        ? window.AdminAuth.getClient()
        : (window.supabaseClient || (typeof window.getSupabase === 'function' ? window.getSupabase() : null));
    }
    if (!client) {
      console.error('Supabase client unavailable');
      if (tableTbody) {
        tableTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--admin-danger, #ef4444); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Unable to load products: Supabase client unavailable</td></tr>';
      }
      return;
    }

    try {
      if (window.AdvancePaymentService && typeof window.AdvancePaymentService.getGlobalSettings === 'function') {
        globalSettings = await window.AdvancePaymentService.getGlobalSettings(client);
      }

      if (globalSettings) {
        if (globalToggle) {
          globalToggle.checked = globalSettings.enabled !== false;
          if (globalStatusLabel) {
            globalStatusLabel.textContent = globalSettings.enabled !== false ? 'ENABLED' : 'DISABLED';
            globalStatusLabel.style.color = globalSettings.enabled !== false ? '#10b981' : '#f87171';
          }
        }
        if (advanceAmountInput && globalSettings.default_amount != null) {
          advanceAmountInput.value = globalSettings.default_amount;
        }
      }

      await loadCategories();
      await loadAllProducts();
      setupEventListeners();
      updateUI();
    } catch (err) {
      console.error('Initialization error:', err);
      if (tableTbody) {
        tableTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--admin-danger, #ef4444); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Unable to load products: ${escapeHtml(err.message)}</td></tr>`;
      }
      window.showToast?.('Failed to load advance payment catalog: ' + err.message, 'danger');
    }
  }

  // --- LOAD CATEGORIES ---
  async function loadCategories() {
    try {
      const { data: mCats } = await client.from('categories').select('id, name').order('name');
      mainCategories = mCats || [];

      const { data: sCats } = await client.from('sarojini_categories').select('id, name, department').order('name');
      sarojiniCategories = sCats || [];

      // Populate scopeCategorySelect
      scopeCategorySelect.innerHTML = '<option value="">-- Choose Category or Department --</option>';

      if (mainCategories.length > 0) {
        const grpMain = document.createElement('optgroup');
        grpMain.label = 'Main Store Categories';
        mainCategories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = `main:${c.id}`;
          opt.textContent = `Main: ${c.name}`;
          grpMain.appendChild(opt);
        });
        scopeCategorySelect.appendChild(grpMain);
      }

      if (sarojiniCategories.length > 0) {
        const grpSar = document.createElement('optgroup');
        grpSar.label = 'Sarojini Bazaar Categories';
        sarojiniCategories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = `sarojini:${c.id}`;
          opt.textContent = `Sarojini: ${c.name} (${c.department || 'Bazaar'})`;
          grpSar.appendChild(opt);
        });
        scopeCategorySelect.appendChild(grpSar);
      }

      // Add Sarojini Departments
      const sarDepts = ['WOMEN', 'MEN', 'SNEAKERS', 'BAGS', 'JEWELLERY', 'CAPS', 'ACCESSORIES'];
      const grpDepts = document.createElement('optgroup');
      grpDepts.label = 'Sarojini Departments';
      sarDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = `dept:${d}`;
        opt.textContent = `Sarojini Dept: ${d}`;
        grpDepts.appendChild(opt);
      });
      scopeCategorySelect.appendChild(grpDepts);
    } catch (err) {
      console.warn('Categories load notice:', err);
    }
  }

  // --- LOAD PRODUCTS FROM BOTH STORES ---
  async function loadAllProducts() {
    if (tableTbody) {
      tableTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 28px; color: var(--admin-text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading catalog from Main Store and Sarojini Bazaar...</td></tr>';
    }

    const prodMap = new Map();
    let mainErrObj = null;
    let sarErrObj = null;

    // 1. Fetch Main Store Products
    try {
      const { data: mainProds, error: mainErr } = await client
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

      if (mainErr) throw mainErr;

      (mainProds || []).forEach(p => {
        prodMap.set(String(p.id), {
          ...p,
          origin_catalog: 'main',
          dept_name: p.categories ? p.categories.name : 'Main Catalog'
        });
      });
    } catch (mErr) {
      console.warn('Main products query with relation warning (retrying without join):', mErr);
      try {
        const { data: fallbackProds, error: fbErr } = await client
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (fbErr) throw fbErr;

        (fallbackProds || []).forEach(p => {
          prodMap.set(String(p.id), {
            ...p,
            origin_catalog: 'main',
            dept_name: 'Main Catalog'
          });
        });
      } catch (fbErr2) {
        console.error('Main products query failed:', fbErr2);
        mainErrObj = fbErr2;
      }
    }

    // 2. Fetch Sarojini Products
    try {
      const { data: sarProds, error: sarErr } = await client
        .from('sarojini_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (sarErr) throw sarErr;

      (sarProds || []).forEach(p => {
        const sid = String(p.id);
        if (!prodMap.has(sid)) {
          prodMap.set(sid, {
            ...p,
            origin_catalog: 'sarojini',
            dept_name: p.department || 'Sarojini Bazaar'
          });
        }
      });
    } catch (sErr) {
      console.error('Sarojini products query failed:', sErr);
      sarErrObj = sErr;
    }

    if (prodMap.size === 0 && (mainErrObj || sarErrObj)) {
      const msg = mainErrObj?.message || sarErrObj?.message || 'Database error occurred';
      console.error('Unable to load products from database:', { mainErrObj, sarErrObj });
      if (tableTbody) {
        tableTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--admin-danger, #ef4444); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Unable to load products: ${escapeHtml(msg)}</td></tr>`;
      }
      return;
    }

    allProducts = Array.from(prodMap.values());
    renderTable();
    updateKPIs();
    updateLiveSummary();
  }

  // --- GET TARGETED PRODUCTS BY SCOPE ---
  function getScopedProducts() {
    if (!Array.isArray(allProducts)) return [];

    switch (currentScope) {
      case 'main':
        return allProducts.filter(p => p.origin_catalog !== 'sarojini');
      case 'sarojini':
        return allProducts.filter(p => p.origin_catalog === 'sarojini');
      case 'selected':
        return allProducts.filter(p => selectedProductIds.has(String(p.id)));
      case 'active':
        return allProducts.filter(p => Boolean(p.is_active));
      case 'category': {
        const catVal = scopeCategorySelect.value;
        if (!catVal) return [];
        const [type, id] = catVal.split(':');
        if (type === 'main') {
          return allProducts.filter(p => p.origin_catalog !== 'sarojini' && String(p.category_id) === String(id));
        } else if (type === 'sarojini') {
          return allProducts.filter(p => p.origin_catalog === 'sarojini' && (String(p.category_id) === String(id) || (p.department && p.department.toLowerCase() === id.toLowerCase())));
        } else if (type === 'dept') {
          return allProducts.filter(p => p.origin_catalog === 'sarojini' && (p.department && p.department.toUpperCase() === id.toUpperCase()));
        }
        return [];
      }
      case 'all':
      default:
        return [...allProducts];
    }
  }

  // --- UPDATE KPI METRICS ---
  function updateKPIs() {
    const isGlobalEnabled = Boolean(globalToggle.checked);
    const defaultAmt = parseFloat(advanceAmountInput.value) || (globalSettings?.default_amount || 120);

    if (kpiGlobalDefault) {
      kpiGlobalDefault.innerHTML = isGlobalEnabled
        ? `<span style="color:#10b981;">₹${defaultAmt}</span> <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(Active)</span>`
        : `<span style="color:#f87171;">Disabled</span> <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(₹0)</span>`;
    }

    if (kpiTotalProds) {
      kpiTotalProds.textContent = allProducts.length;
    }

    let customCount = 0;
    let disabledCount = 0;

    allProducts.forEach(p => {
      const info = window.AdvancePaymentService.getProductAdvanceInfo(p, globalSettings);
      if (info.isCustom) customCount++;
      if (!info.isEnabled || info.amount <= 0) disabledCount++;
    });

    if (kpiCustomOverrides) {
      kpiCustomOverrides.textContent = customCount;
    }

    if (kpiDisabledCount) {
      kpiDisabledCount.textContent = disabledCount;
    }
  }

  // --- UPDATE PRE-APPLY LIVE SUMMARY ---
  function updateLiveSummary() {
    const scoped = getScopedProducts();
    const isGlobalEnabled = Boolean(globalToggle.checked);
    const newAmt = isGlobalEnabled ? (parseFloat(advanceAmountInput.value) || 0) : 0;
    const currDefaultAmt = globalSettings?.default_amount || 120;

    let customInScope = 0;
    scoped.forEach(p => {
      if (window.AdvancePaymentService.isCustomOverride(p, globalSettings)) {
        customInScope++;
      }
    });

    if (summaryTargetCount) {
      summaryTargetCount.textContent = `${scoped.length} Product${scoped.length === 1 ? '' : 's'}`;
    }

    if (summaryCurrDefault) {
      summaryCurrDefault.textContent = `₹${currDefaultAmt}`;
    }

    if (summaryNewAdvance) {
      summaryNewAdvance.textContent = isGlobalEnabled ? `₹${newAmt}` : '₹0 (Disabled)';
      summaryNewAdvance.style.color = isGlobalEnabled ? '#10b981' : '#f87171';
    }

    if (summaryCustomCount) {
      summaryCustomCount.textContent = `${customInScope} Product${customInScope === 1 ? '' : 's'}`;
      summaryCustomCount.style.color = customInScope > 0 ? '#fbbf24' : '#94a3b8';
    }

    // Toggle button state if 0 items in scope
    const disabled = scoped.length === 0;
    if (btnApplyDefault) btnApplyDefault.disabled = disabled;
    if (btnApplyOverride) btnApplyOverride.disabled = disabled;
  }

  // --- RENDER PRODUCTS TABLE ---
  function renderTable() {
    const searchTerm = (tableSearch.value || '').toLowerCase().trim();
    const catalogFilter = tableFilterCatalog.value;
    const overrideFilter = tableFilterOverride.value;

    const scoped = getScopedProducts();

    const filtered = scoped.filter(p => {
      // Search filter
      if (searchTerm) {
        const titleMatch = (p.name || '').toLowerCase().includes(searchTerm);
        const slugMatch = (p.slug || '').toLowerCase().includes(searchTerm);
        const brandMatch = (p.brand || '').toLowerCase().includes(searchTerm);
        if (!titleMatch && !slugMatch && !brandMatch) return false;
      }

      // Catalog filter
      if (catalogFilter === 'main' && p.origin_catalog === 'sarojini') return false;
      if (catalogFilter === 'sarojini' && p.origin_catalog !== 'sarojini') return false;

      // Override filter
      if (overrideFilter) {
        const info = window.AdvancePaymentService.getProductAdvanceInfo(p, globalSettings);
        if (overrideFilter === 'custom' && !info.isCustom) return false;
        if (overrideFilter === 'default' && (info.isCustom || !info.isEnabled || info.amount <= 0)) return false;
        if (overrideFilter === 'disabled' && (info.isEnabled && info.amount > 0)) return false;
      }

      return true;
    });

    if (tableBadgeCount) {
      tableBadgeCount.textContent = `${filtered.length} of ${allProducts.length} Products`;
    }

    if (filtered.length === 0) {
      tableTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--admin-text-muted);">No products match your current search and filter criteria.</td></tr>';
      syncSelectAllCheckbox();
      return;
    }

    tableTbody.innerHTML = filtered.map(p => {
      const pId = String(p.id);
      const isChecked = selectedProductIds.has(pId);
      const primaryImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'https://via.placeholder.com/60');
      const isSarojini = p.origin_catalog === 'sarojini';
      const storeBadge = isSarojini
        ? `<span class="badge" style="background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.3); font-size: 0.72rem;"><i class="fas fa-tshirt"></i> Sarojini</span>`
        : `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 0.72rem;"><i class="fas fa-store"></i> Main Store</span>`;

      const advanceInfo = window.AdvancePaymentService.getProductAdvanceInfo(p, globalSettings);
      const activeBadge = p.is_active
        ? '<span class="badge badge-success" style="font-size: 0.72rem;">Active</span>'
        : '<span class="badge badge-danger" style="font-size: 0.72rem;">Inactive</span>';

      const editPageUrl = isSarojini
        ? `sarojini-add-product.html?id=${encodeURIComponent(p.id)}`
        : `edit-product.html?id=${encodeURIComponent(p.id)}`;

      return `
        <tr data-prod-id="${pId}">
          <td style="text-align: center;">
            <input type="checkbox" class="row-checkbox" data-id="${pId}" ${isChecked ? 'checked' : ''}>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${primaryImg}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: contain; background: #1e293b; padding: 2px;" onerror="this.src='https://via.placeholder.com/44';">
              <div>
                <a href="${editPageUrl}" style="font-weight: 700; color: #fff; text-decoration: none; font-size: 0.88rem;" title="Edit product in store catalog">${escapeHtml(p.name)}</a>
                <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 2px;">
                  ${escapeHtml(p.brand || 'VALORA')} • <code>${escapeHtml(p.slug || '')}</code>
                </div>
              </div>
            </div>
          </td>
          <td>
            ${storeBadge}
            <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 3px;">${escapeHtml(p.dept_name || '')}</div>
          </td>
          <td>
            <strong style="color: #10b981; font-size: 0.92rem;">₹${p.price || 0}</strong>
          </td>
          <td>
            ${advanceInfo.badgeHtml}
          </td>
          <td>
            ${advanceInfo.isCustom
              ? `<span style="color: #fbbf24; font-size: 0.78rem; font-weight: 600;"><i class="fas fa-lock" style="font-size: 0.7rem;"></i> Custom Override</span>`
              : (advanceInfo.isEnabled && advanceInfo.amount > 0
                ? `<span style="color: #60a5fa; font-size: 0.78rem;"><i class="fas fa-sync" style="font-size: 0.7rem;"></i> Tracks Global Default</span>`
                : `<span style="color: #94a3b8; font-size: 0.78rem;"><i class="fas fa-ban" style="font-size: 0.7rem;"></i> Disabled</span>`)}
          </td>
          <td>
            ${activeBadge}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn-admin-secondary btn-quick-configure" data-id="${pId}" style="padding: 4px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;" title="Quick configure advance for this product">
                <i class="fas fa-cog"></i> Configure
              </button>
              <a href="${editPageUrl}" class="btn-admin-secondary" style="padding: 4px 8px; font-size: 0.75rem;" title="Full Product Edit">
                <i class="fas fa-external-link-alt"></i>
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    syncSelectAllCheckbox();
  }

  function syncSelectAllCheckbox() {
    const visibleCheckboxes = Array.from(tableTbody.querySelectorAll('.row-checkbox'));
    if (visibleCheckboxes.length === 0) {
      thSelectAll.checked = false;
      thSelectAll.indeterminate = false;
      return;
    }

    const allChecked = visibleCheckboxes.every(cb => cb.checked);
    const someChecked = visibleCheckboxes.some(cb => cb.checked);

    thSelectAll.checked = allChecked;
    thSelectAll.indeterminate = someChecked && !allChecked;
  }

  let listenersInitialized = false;

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // 1. Global toggle
    globalToggle.addEventListener('change', () => {
      const isEnabled = globalToggle.checked;
      globalStatusLabel.textContent = isEnabled ? 'ENABLED' : 'DISABLED';
      globalStatusLabel.style.color = isEnabled ? '#10b981' : '#f87171';
      updateKPIs();
      updateLiveSummary();
    });

    // 2. Advance amount input
    advanceAmountInput.addEventListener('input', () => {
      updateKPIs();
      updateLiveSummary();
    });

    // 3. Quick amount buttons
    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = btn.getAttribute('data-amt');
        advanceAmountInput.value = amt;
        updateKPIs();
        updateLiveSummary();
      });
    });

    // 4. Scope pill buttons
    scopeContainer.querySelectorAll('.scope-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        scopeContainer.querySelectorAll('.scope-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentScope = btn.getAttribute('data-scope');

        if (currentScope === 'category') {
          scopeCategoryWrapper.style.display = 'block';
        } else {
          scopeCategoryWrapper.style.display = 'none';
        }

        if (currentScope === 'main') {
          tableFilterCatalog.value = 'main';
        } else if (currentScope === 'sarojini') {
          tableFilterCatalog.value = 'sarojini';
        } else if (currentScope === 'all') {
          tableFilterCatalog.value = '';
        }

        updateLiveSummary();
        renderTable();
      });
    });

    // Scope category change
    scopeCategorySelect.addEventListener('change', () => {
      updateLiveSummary();
      renderTable();
    });

    // 5. Table Search & Filters
    tableSearch.addEventListener('input', renderTable);

    tableFilterCatalog.addEventListener('change', () => {
      const val = tableFilterCatalog.value;
      if (val === 'main') {
        currentScope = 'main';
      } else if (val === 'sarojini') {
        currentScope = 'sarojini';
      } else {
        currentScope = 'all';
      }
      scopeContainer.querySelectorAll('.scope-pill-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-scope') === currentScope);
      });
      scopeCategoryWrapper.style.display = 'none';
      updateLiveSummary();
      renderTable();
    });

    tableFilterOverride.addEventListener('change', renderTable);

    // 6. Select all visible checkbox
    thSelectAll.addEventListener('change', () => {
      const isChecked = thSelectAll.checked;
      const visibleCheckboxes = tableTbody.querySelectorAll('.row-checkbox');
      visibleCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        const id = cb.getAttribute('data-id');
        if (isChecked) {
          selectedProductIds.add(id);
        } else {
          selectedProductIds.delete(id);
        }
      });
      scopeSelectedCountSpan.textContent = selectedProductIds.size;
      updateLiveSummary();
      if (currentScope === 'selected') {
        renderTable();
      }
    });

    // 7. Individual row checkboxes
    tableTbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-checkbox')) {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) {
          selectedProductIds.add(id);
        } else {
          selectedProductIds.delete(id);
        }
        scopeSelectedCountSpan.textContent = selectedProductIds.size;
        syncSelectAllCheckbox();
        updateLiveSummary();
        if (currentScope === 'selected') {
          renderTable();
        }
      }
    });

    // 8. Row Quick Configure button
    tableTbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-quick-configure');
      if (btn) {
        const id = btn.getAttribute('data-id');
        const prod = allProducts.find(p => String(p.id) === String(id));
        if (prod) {
          openQuickEditModal(prod);
        }
      }
    });

    // 9. Apply Default Button
    btnApplyDefault.addEventListener('click', async () => {
      const scoped = getScopedProducts();
      if (scoped.length === 0) {
        window.showToast?.('No products match current targeting scope.', 'warning');
        return;
      }

      const isEnabled = globalToggle.checked;
      const amount = parseFloat(advanceAmountInput.value) || 0;

      btnApplyDefault.disabled = true;
      btnApplyDefault.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying Default...';

      try {
        const result = await window.AdvancePaymentService.applyBulkAdvance(client, {
          products: scoped,
          isEnabled,
          amount,
          overrideCustom: false
        });

        globalSettings = await window.AdvancePaymentService.getGlobalSettings(client);
        updateKPIs();
        updateLiveSummary();
        renderTable();

        window.showToast?.(
          `Successfully applied default advance (₹${amount}) to ${result.updatedCount} product(s)! Preserved ${result.skippedCustomCount} custom override(s).`,
          'success'
        );
      } catch (err) {
        console.error('Apply default error:', err);
        window.showToast?.('Failed to apply default advance: ' + err.message, 'danger');
      } finally {
        btnApplyDefault.disabled = false;
        btnApplyDefault.innerHTML = '<i class="fas fa-check-circle"></i> Apply Default (Skip Custom Overrides)';
      }
    });

    // 10. Apply & Override Custom Amounts Button
    btnApplyOverride.addEventListener('click', () => {
      const scoped = getScopedProducts();
      if (scoped.length === 0) {
        window.showToast?.('No products match current targeting scope.', 'warning');
        return;
      }

      const isEnabled = globalToggle.checked;
      const amount = parseFloat(advanceAmountInput.value) || 0;

      let customInScope = 0;
      scoped.forEach(p => {
        if (window.AdvancePaymentService.isCustomOverride(p, globalSettings)) {
          customInScope++;
        }
      });

      pendingOverrideParams = {
        products: scoped,
        isEnabled,
        amount,
        overrideCustom: true
      };

      modalOverrideCustomCount.textContent = `${customInScope} product${customInScope === 1 ? '' : 's'}`;
      modalOverrideTotalCount.textContent = `${scoped.length} product${scoped.length === 1 ? '' : 's'}`;
      modalOverrideNewAmount.textContent = isEnabled ? `₹${amount}` : '₹0 (Disabled)';

      modalOverride.style.display = 'flex';
    });

    btnCancelOverride.addEventListener('click', () => {
      modalOverride.style.display = 'none';
      pendingOverrideParams = null;
    });

    btnConfirmOverride.addEventListener('click', async () => {
      if (!pendingOverrideParams) return;

      btnConfirmOverride.disabled = true;
      btnConfirmOverride.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Overwriting...';

      try {
        const result = await window.AdvancePaymentService.applyBulkAdvance(client, pendingOverrideParams);
        globalSettings = await window.AdvancePaymentService.getGlobalSettings(client);

        modalOverride.style.display = 'none';
        pendingOverrideParams = null;

        updateKPIs();
        updateLiveSummary();
        renderTable();

        window.showToast?.(
          `Force applied ₹${result.totalMatched > 0 ? (pendingOverrideParams?.amount || 0) : 0} to all ${result.updatedCount} product(s) and reset custom overrides.`,
          'success'
        );
      } catch (err) {
        console.error('Confirm override error:', err);
        window.showToast?.('Failed to overwrite custom advance: ' + err.message, 'danger');
      } finally {
        btnConfirmOverride.disabled = false;
        btnConfirmOverride.innerHTML = '<i class="fas fa-check"></i> Yes, Overwrite &amp; Apply';
      }
    });

    // 11. Quick Edit Single Product Modal Events
    btnCloseQuickEdit.addEventListener('click', () => { modalQuickEdit.style.display = 'none'; });
    btnCancelQuickEdit.addEventListener('click', () => { modalQuickEdit.style.display = 'none'; });

    document.querySelectorAll("input[name='quick-edit-mode']").forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'custom') {
          quickEditCustomInputWrap.style.display = 'block';
        } else {
          quickEditCustomInputWrap.style.display = 'none';
        }
      });
    });

    btnSaveQuickEdit.addEventListener('click', async () => {
      if (!editingProduct) return;

      const selectedMode = document.querySelector("input[name='quick-edit-mode']:checked").value;
      const defaultAmt = globalSettings?.default_amount || 120;
      let newEnabled = true;
      let newType = 'fixed';
      let newAmt = defaultAmt;
      let isCustom = false;

      if (selectedMode === 'default') {
        newEnabled = true;
        newAmt = defaultAmt;
        isCustom = false;
      } else if (selectedMode === 'custom') {
        const parsed = parseFloat(quickEditAmount.value);
        if (isNaN(parsed) || parsed < 0) {
          alert('Please enter a valid positive advance amount.');
          return;
        }
        newEnabled = true;
        newAmt = parsed;
        isCustom = true;
      } else if (selectedMode === 'disabled') {
        newEnabled = false;
        newAmt = 0;
        isCustom = true; // explicitly disabled is a custom override
      }

      btnSaveQuickEdit.disabled = true;
      btnSaveQuickEdit.textContent = 'Saving...';

      try {
        const table = editingProduct.origin_catalog === 'sarojini' ? 'sarojini_products' : 'products';
        const { error } = await client
          .from(table)
          .update({
            advance_payment_enabled: newEnabled,
            advance_payment_type: newType,
            advance_payment_value: newAmt,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProduct.id);

        if (error) throw error;

        // Update local object
        editingProduct.advance_payment_enabled = newEnabled;
        editingProduct.advance_payment_type = newType;
        editingProduct.advance_payment_value = newAmt;

        // Update custom_overrides map in store_settings
        await window.AdvancePaymentService.markCustomOverride(client, editingProduct.id, isCustom);
        globalSettings = await window.AdvancePaymentService.getGlobalSettings(client);

        modalQuickEdit.style.display = 'none';
        editingProduct = null;

        updateKPIs();
        updateLiveSummary();
        renderTable();

        window.showToast?.('Product advance payment settings updated successfully!', 'success');
      } catch (err) {
        console.error('Quick edit save error:', err);
        window.showToast?.('Failed to save product advance: ' + err.message, 'danger');
      } finally {
        btnSaveQuickEdit.disabled = false;
        btnSaveQuickEdit.textContent = 'Save Changes';
      }
    });
  }

  // --- OPEN QUICK EDIT MODAL ---
  function openQuickEditModal(prod) {
    editingProduct = prod;
    quickEditProdTitle.textContent = prod.name;
    quickEditProdSub.textContent = `Selling Price: ₹${prod.price || 0} • Catalog: ${prod.origin_catalog === 'sarojini' ? 'Sarojini Bazaar' : 'Main Store'}`;

    const defaultAmt = globalSettings?.default_amount || 120;
    quickEditGlobalLabel.textContent = `₹${defaultAmt}`;

    const info = window.AdvancePaymentService.getProductAdvanceInfo(prod, globalSettings);

    const modeRadios = document.querySelectorAll("input[name='quick-edit-mode']");
    if (!info.isEnabled || info.amount <= 0) {
      modeRadios.forEach(r => { r.checked = (r.value === 'disabled'); });
      quickEditCustomInputWrap.style.display = 'none';
    } else if (info.isCustom) {
      modeRadios.forEach(r => { r.checked = (r.value === 'custom'); });
      quickEditCustomInputWrap.style.display = 'block';
      quickEditAmount.value = info.amount;
    } else {
      modeRadios.forEach(r => { r.checked = (r.value === 'default'); });
      quickEditCustomInputWrap.style.display = 'none';
    }

    modalQuickEdit.style.display = 'flex';
  }

  function updateUI() {
    updateKPIs();
    updateLiveSummary();
    renderTable();
  }

  // Launch on document ready
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      let admin = null;
      if (window.AdminAuth && typeof window.AdminAuth.guardRoute === 'function') {
        admin = await window.AdminAuth.guardRoute();
        if (!admin) return;
        if (typeof window.initLayout === 'function') {
          window.initLayout(admin);
        }
      }

      client = (window.AdminAuth && typeof window.AdminAuth.getClient === 'function')
        ? window.AdminAuth.getClient()
        : (window.supabaseClient || (typeof window.getSupabase === 'function' ? window.getSupabase() : null));

      if (!client) {
        throw new Error('Supabase client unavailable');
      }

      await init(admin);
    } catch (err) {
      console.error('Advance Payment Manager init error:', err);
      if (tableTbody) {
        tableTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--admin-danger, #ef4444); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Unable to load products: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  });

})();
