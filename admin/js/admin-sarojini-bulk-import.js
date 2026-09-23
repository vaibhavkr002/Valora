/**
 * VADI Admin Panel - Sarojini Bulk Product Import Engine
 *
 * Implements:
 * 1. Multi-tier metadata extraction & public page fetcher (JSON-LD, OpenGraph, HTML metadata)
 * 2. Real product-data importer: ZERO fake placeholders, ZERO fabricated prices/descriptions
 * 3. Multi-image gallery support: Extracts all images, groups same-product images, upgrades Meesho CDN to 1024 master assets
 * 4. Universal Sarojini Watermark code-cover pipeline on EVERY imported image
 * 5. Interactive Gallery Viewer Modal: Click image counter to inspect, delete, or add gallery images
 * 6. Transparent field-level badges: Shows exactly what was fetched and what is missing
 * 7. CSV Importer supporting pipe-separated (|) multi-image galleries, sizes, and colors
 * 8. Strict validation: Prohibits importing products lacking price or images
 * 9. Controlled batch insertion (batches of 5, progress bar, error resilience, retry)
 * 10. Draft / Inactive creation by default (is_active: false)
 */

(function () {
  'use strict';

  // State
  let stagedProducts = [];
  let existingProductUrls = new Set();
  let existingProductSlugs = new Set();
  let existingProductNames = new Set();
  let sarojiniCategories = [];

  // Active product index in Gallery Viewer Modal
  let activeGalleryStagedIdx = null;

  // DOM Elements
  let modalEl = null;
  let tabUrlsBtn = null;
  let tabCsvBtn = null;
  let tabUrlsPane = null;
  let tabCsvPane = null;
  let inputUrls = null;
  let btnFetchUrls = null;
  let urlCounterLabel = null;
  let inputCsvFile = null;
  let btnDownloadTemplate = null;
  let btnParseCsv = null;
  let inputCsvText = null;

  let globalDeptSelect = null;
  let globalCatSelect = null;
  let globalAdvToggle = null;
  let globalAdvType = null;
  let globalAdvVal = null;
  let btnApplyGlobalSettings = null;

  let previewSection = null;
  let previewStatsBar = null;
  let previewTbody = null;
  let chkSelectAll = null;
  let btnImportSelected = null;
  let btnClearStaging = null;

  let progressSection = null;
  let progressFill = null;
  let progressText = null;
  let progressStats = null;
  let resultSection = null;
  let resultSummary = null;
  let resultFailuresList = null;
  let btnRetryFailed = null;
  let btnDoneClose = null;

  // Gallery Viewer Modal Elements
  let galleryModalEl = null;
  let galleryModalSubtitle = null;
  let galleryModalGrid = null;
  let inputAddGalleryUrl = null;
  let btnConfirmAddGalleryImg = null;
  let btnCloseGalleryModal = null;
  let btnDoneGalleryModal = null;

  // Add Gallery Images Modal Elements
  let addGalleryModalEl = null;
  let addGalleryModalTitle = null;
  let tabAddUploadBtn = null;
  let tabAddUrlsBtn = null;
  let paneAddUpload = null;
  let paneAddUrls = null;
  let dropZoneAddGallery = null;
  let inputUploadGalleryFiles = null;
  let uploadPreviewsContainer = null;
  let textareaAddGalleryUrls = null;
  let btnCancelAddGallery = null;
  let btnConfirmAddGallery = null;
  let btnCloseAddGalleryModal = null;
  let pendingUploadedFiles = []; // Array of { name, dataUrl }

  // Lightbox Modal Elements
  let lightboxModalEl = null;
  let lightboxImg = null;
  let lightboxWatermarkBadge = null;
  let lightboxCaption = null;
  let btnCloseImageLightbox = null;

  let activeAddGalleryStagedIdx = null;

  let failedItems = [];

  /**
   * Initializes the Bulk Import modal and binds all event listeners.
   */
  async function initBulkImport() {
    modalEl = document.getElementById('modal-bulk-import');
    if (!modalEl) return;

    // Cache main modal elements
    tabUrlsBtn = document.getElementById('tab-btn-urls');
    tabCsvBtn = document.getElementById('tab-btn-csv');
    tabUrlsPane = document.getElementById('tab-pane-urls');
    tabCsvPane = document.getElementById('tab-pane-csv');
    inputUrls = document.getElementById('bulk-urls-input');
    btnFetchUrls = document.getElementById('btn-fetch-urls');
    urlCounterLabel = document.getElementById('url-counter-label');
    inputCsvFile = document.getElementById('bulk-csv-file');
    btnDownloadTemplate = document.getElementById('btn-download-csv-template');
    btnParseCsv = document.getElementById('btn-parse-csv');
    inputCsvText = document.getElementById('bulk-csv-text');

    globalDeptSelect = document.getElementById('bulk-global-dept');
    globalCatSelect = document.getElementById('bulk-global-cat');
    globalAdvToggle = document.getElementById('bulk-global-adv-toggle');
    globalAdvType = document.getElementById('bulk-global-adv-type');
    globalAdvVal = document.getElementById('bulk-global-adv-val');
    btnApplyGlobalSettings = document.getElementById('btn-apply-global-settings');

    previewSection = document.getElementById('bulk-preview-section');
    previewStatsBar = document.getElementById('bulk-preview-stats');
    previewTbody = document.getElementById('bulk-preview-tbody');
    chkSelectAll = document.getElementById('chk-bulk-select-all');
    btnImportSelected = document.getElementById('btn-import-selected');
    btnClearStaging = document.getElementById('btn-clear-staging');

    progressSection = document.getElementById('bulk-progress-section');
    progressFill = document.getElementById('bulk-progress-bar-fill');
    progressText = document.getElementById('bulk-progress-text');
    progressStats = document.getElementById('bulk-progress-stats');
    resultSection = document.getElementById('bulk-result-section');
    resultSummary = document.getElementById('bulk-result-summary');
    resultFailuresList = document.getElementById('bulk-result-failures');
    btnRetryFailed = document.getElementById('btn-retry-failed');
    btnDoneClose = document.getElementById('btn-bulk-done-close');

    // Cache gallery modal elements
    galleryModalEl = document.getElementById('modal-bulk-gallery-viewer');
    galleryModalSubtitle = document.getElementById('gallery-modal-subtitle');
    galleryModalGrid = document.getElementById('gallery-modal-grid');
    inputAddGalleryUrl = document.getElementById('input-add-gallery-url');
    btnConfirmAddGalleryImg = document.getElementById('btn-confirm-add-gallery-img');
    btnCloseGalleryModal = document.getElementById('btn-close-gallery-modal');
    btnDoneGalleryModal = document.getElementById('btn-done-gallery-modal');

    // Cache Add Gallery Images modal elements
    addGalleryModalEl = document.getElementById('modal-add-gallery-images');
    addGalleryModalTitle = document.getElementById('add-gallery-modal-title');
    tabAddUploadBtn = document.getElementById('tab-add-upload-btn');
    tabAddUrlsBtn = document.getElementById('tab-add-urls-btn');
    paneAddUpload = document.getElementById('pane-add-upload');
    paneAddUrls = document.getElementById('pane-add-urls');
    dropZoneAddGallery = document.getElementById('drop-zone-add-gallery');
    inputUploadGalleryFiles = document.getElementById('input-upload-gallery-files');
    uploadPreviewsContainer = document.getElementById('upload-previews-container');
    textareaAddGalleryUrls = document.getElementById('textarea-add-gallery-urls');
    btnCancelAddGallery = document.getElementById('btn-cancel-add-gallery');
    btnConfirmAddGallery = document.getElementById('btn-confirm-add-gallery');
    btnCloseAddGalleryModal = document.getElementById('btn-close-add-gallery-modal');

    // Cache Lightbox modal elements
    lightboxModalEl = document.getElementById('modal-image-lightbox');
    lightboxImg = document.getElementById('lightbox-img');
    lightboxWatermarkBadge = document.getElementById('lightbox-watermark-badge');
    lightboxCaption = document.getElementById('lightbox-caption');
    btnCloseImageLightbox = document.getElementById('btn-close-image-lightbox');

    // Load reference categories and existing products
    await loadReferenceData();

    // Bind triggers
    bindEvents();

    // Check if openBulk query parameter is present in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openBulk') === 'true' || urlParams.get('bulk') === 'true') {
      openBulkModal();
    }
  }

  /**
   * Loads categories and existing products to detect duplicates accurately.
   */
  async function loadReferenceData() {
    const client = window.AdminAuth?.getClient() || window.supabaseClient;
    if (!client) return;

    try {
      const { data: cats } = await client.from('sarojini_categories').select('id, name, department, slug').eq('is_active', true);
      if (Array.isArray(cats)) {
        sarojiniCategories = cats;
        populateGlobalCategories();
      }
    } catch (e) {
      console.warn('[BulkImport] Categories load error:', e);
    }

    try {
      const { data: prods } = await client.from('sarojini_products').select('name, slug, specifications');
      if (Array.isArray(prods)) {
        existingProductUrls.clear();
        existingProductSlugs.clear();
        existingProductNames.clear();

        prods.forEach(p => {
          if (p.name) existingProductNames.add(p.name.trim().toLowerCase());
          if (p.slug) existingProductSlugs.add(p.slug.trim().toLowerCase());
          if (p.specifications && p.specifications.source_url) {
            existingProductUrls.add(p.specifications.source_url.trim().toLowerCase());
          }
        });
      }
    } catch (e) {
      console.warn('[BulkImport] Existing products load error:', e);
    }
  }

  function populateGlobalCategories() {
    if (!globalCatSelect) return;
    const selectedDept = (globalDeptSelect?.value || '').toUpperCase();
    const filtered = selectedDept
      ? sarojiniCategories.filter(c => (c.department || '').toUpperCase() === selectedDept)
      : sarojiniCategories;

    globalCatSelect.innerHTML = '<option value="">(Auto-Detect Category)</option>' +
      filtered.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.department})</option>`).join('');
  }

  /**
   * Binds modal controls and input listeners.
   */
  function bindEvents() {
    // Open modal button
    const openBtn = document.getElementById('btn-open-bulk-import');
    if (openBtn) {
      openBtn.addEventListener('click', openBulkModal);
    }

    // Close buttons
    const closeBtns = modalEl.querySelectorAll('.modal-close, .btn-close-bulk-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', closeBulkModal));

    // Tab switching
    tabUrlsBtn?.addEventListener('click', () => switchTab('urls'));
    tabCsvBtn?.addEventListener('click', () => switchTab('csv'));

    // URL counter
    inputUrls?.addEventListener('input', updateUrlCount);

    // Fetch from URLs
    btnFetchUrls?.addEventListener('click', handleFetchUrls);

    // CSV Parse
    btnParseCsv?.addEventListener('click', handleParseCsv);
    btnDownloadTemplate?.addEventListener('click', downloadCsvTemplate);

    // Global settings change & apply
    globalDeptSelect?.addEventListener('change', populateGlobalCategories);
    globalAdvToggle?.addEventListener('change', () => {
      const opts = document.getElementById('bulk-global-adv-options');
      if (opts) opts.style.display = globalAdvToggle.checked ? 'flex' : 'none';
    });
    btnApplyGlobalSettings?.addEventListener('click', applyGlobalSettingsToStaging);

    // Staging table select all
    chkSelectAll?.addEventListener('change', () => {
      const isChecked = chkSelectAll.checked;
      previewTbody?.querySelectorAll('.row-chk-import').forEach(chk => {
        if (!chk.disabled) {
          chk.checked = isChecked;
          const idx = parseInt(chk.dataset.stgIdx, 10);
          if (stagedProducts[idx]) stagedProducts[idx].selected = isChecked;
        }
      });
      updateImportSelectedButton();
    });

    // Clear staging
    btnClearStaging?.addEventListener('click', () => {
      if (confirm('Clear all staged products and start over?')) {
        stagedProducts = [];
        renderStagingTable();
        previewSection.style.display = 'none';
      }
    });

    // Import Selected button
    btnImportSelected?.addEventListener('click', executeBatchImport);

    // Retry failed items
    btnRetryFailed?.addEventListener('click', retryFailedImport);

    // Done Close button
    btnDoneClose?.addEventListener('click', () => {
      closeBulkModal();
      window.location.reload();
    });

    // Gallery Modal Bindings
    if (btnCloseGalleryModal) btnCloseGalleryModal.addEventListener('click', closeGalleryViewer);
    if (btnDoneGalleryModal) btnDoneGalleryModal.addEventListener('click', closeGalleryViewer);
    if (btnConfirmAddGalleryImg) btnConfirmAddGalleryImg.addEventListener('click', handleAddImageToGallery);
    if (inputAddGalleryUrl) {
      inputAddGalleryUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddImageToGallery();
        }
      });
    }

    // Add Gallery Images Modal Bindings
    tabAddUploadBtn?.addEventListener('click', () => switchAddGalleryTab('upload'));
    tabAddUrlsBtn?.addEventListener('click', () => switchAddGalleryTab('urls'));
    btnCancelAddGallery?.addEventListener('click', closeAddGalleryModal);
    btnCloseAddGalleryModal?.addEventListener('click', closeAddGalleryModal);
    btnConfirmAddGallery?.addEventListener('click', confirmAddImagesToProduct);

    // Drop zone & file input
    dropZoneAddGallery?.addEventListener('click', () => {
      inputUploadGalleryFiles?.click();
    });
    inputUploadGalleryFiles?.addEventListener('change', (e) => {
      handleFileSelection(e.target.files);
    });
    dropZoneAddGallery?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZoneAddGallery.style.borderColor = '#e11d48';
      dropZoneAddGallery.style.background = 'rgba(225, 29, 72, 0.12)';
    });
    dropZoneAddGallery?.addEventListener('dragleave', () => {
      dropZoneAddGallery.style.borderColor = 'rgba(225, 29, 72, 0.4)';
      dropZoneAddGallery.style.background = 'rgba(225, 29, 72, 0.04)';
    });
    dropZoneAddGallery?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZoneAddGallery.style.borderColor = 'rgba(225, 29, 72, 0.4)';
      dropZoneAddGallery.style.background = 'rgba(225, 29, 72, 0.04)';
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFileSelection(e.dataTransfer.files);
      }
    });

    // Lightbox bindings
    btnCloseImageLightbox?.addEventListener('click', closeImageLightbox);
    lightboxModalEl?.addEventListener('click', (e) => {
      if (e.target === lightboxModalEl) closeImageLightbox();
    });
  }

  function openBulkModal() {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadReferenceData();
  }

  function closeBulkModal() {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  function switchTab(tab) {
    if (tab === 'urls') {
      tabUrlsBtn?.classList.add('active');
      tabCsvBtn?.classList.remove('active');
      if (tabUrlsPane) tabUrlsPane.style.display = 'block';
      if (tabCsvPane) tabCsvPane.style.display = 'none';
    } else {
      tabCsvBtn?.classList.add('active');
      tabUrlsBtn?.classList.remove('active');
      if (tabCsvPane) tabCsvPane.style.display = 'block';
      if (tabUrlsPane) tabUrlsPane.style.display = 'none';
    }
  }

  function updateUrlCount() {
    if (!inputUrls || !urlCounterLabel) return;
    const lines = inputUrls.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    urlCounterLabel.textContent = `${lines.length} URLs entered`;
  }

  // ==========================================================================
  // MULTI-TIER URL PARSER & PRODUCT METADATA EXTRACTOR
  // ==========================================================================
  async function handleFetchUrls() {
    const text = inputUrls ? inputUrls.value.trim() : '';
    if (!text) {
      alert('Please paste at least one product URL or image URL.');
      return;
    }

    const rawLines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      alert('No valid URLs found.');
      return;
    }

    btnFetchUrls.disabled = true;
    btnFetchUrls.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching product data...';

    const newItems = [];
    const meeshoCodeMap = new Map(); // S-Code -> index in newItems for multi-image grouping

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      btnFetchUrls.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing ${i + 1} of ${rawLines.length}...`;

      const parsed = await parseAndFetchSingleUrl(line, i + 1);

      // Check if this is an image that belongs to an existing staged item with the same Meesho S-code
      if (parsed.is_direct_image && parsed.detected_code && meeshoCodeMap.has(parsed.detected_code)) {
        const existingIdx = meeshoCodeMap.get(parsed.detected_code);
        parsed.images.forEach(img => {
          if (!newItems[existingIdx].images.includes(img)) {
            newItems[existingIdx].images.push(img);
          }
        });
        continue;
      }

      // Check duplicates
      const normalizedUrl = (parsed.source_url || '').toLowerCase();
      if (existingProductUrls.has(normalizedUrl)) {
        parsed.is_duplicate = true;
        parsed.status = 'Already in catalog (Skipped)';
        parsed.selected = false;
      } else if (parsed.name && existingProductNames.has(parsed.name.toLowerCase())) {
        parsed.is_duplicate = true;
        parsed.status = 'Product name already exists';
        parsed.selected = false;
      } else {
        parsed.is_duplicate = false;
        // Require valid price AND at least one real image to be Ready
        const hasPrice = Number(parsed.price) > 0;
        const hasImages = Array.isArray(parsed.images) && parsed.images.length > 0;

        if (hasPrice && hasImages) {
          parsed.status = 'Ready';
          parsed.selected = true;
        } else if (!hasImages && !hasPrice) {
          parsed.status = parsed.fetch_failed
            ? 'Could not fetch product data automatically'
            : 'Images and Price missing — please enter';
          parsed.selected = false;
        } else if (!hasPrice) {
          parsed.status = 'Price missing — please enter';
          parsed.selected = false;
        } else {
          parsed.status = 'Images missing — please add';
          parsed.selected = false;
        }
      }

      if (parsed.is_direct_image && parsed.detected_code) {
        meeshoCodeMap.set(parsed.detected_code, newItems.length);
      }

      newItems.push(parsed);
    }

    stagedProducts = newItems;
    renderStagingTable();

    btnFetchUrls.disabled = false;
    btnFetchUrls.innerHTML = '<i class="fas fa-search"></i> Fetch Products';
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Intelligently parses a line which can be:
   * 1. Direct Image URL or multiple image URLs separated by pipe/semicolon/comma
   * 2. Product web page URL (fetches structured JSON-LD, OpenGraph, or reports blocked status without fake data)
   */
  async function parseAndFetchSingleUrl(rawLine, index) {
    let line = rawLine.trim();

    // Check if line contains pipe/semicolon separated image URLs (multi-image input)
    const delimiterParts = line.split(/[|;]+/).map(p => p.trim()).filter(Boolean);
    const isMultiImageLine = delimiterParts.length > 1;

    const isAllImages = delimiterParts.every(p =>
      /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(p) || p.includes('images.meesho.com/images/products/')
    );

    // =========================================================================
    // CASE 1: DIRECT IMAGE URL(S)
    // =========================================================================
    if (isAllImages || isMultiImageLine) {
      const highResImages = [];
      let detectedCode = null;

      delimiterParts.forEach(part => {
        let u = part;
        if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;

        // Upgrade Meesho CDN image to 1024 master resolution
        if (u.includes('images.meesho.com')) {
          u = u.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
          const m = u.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
          if (m && !detectedCode) {
            detectedCode = `S-${m[1]}`;
          }
        }
        if (!highResImages.includes(u)) {
          highResImages.push(u);
        }
      });

      const primaryImg = highResImages[0];
      const deptInfo = autoSuggestDepartmentAndCategory(detectedCode ? `Sarojini Street ${detectedCode}` : primaryImg);

      return {
        id: 'stg-' + Date.now() + '-' + index,
        source_url: primaryImg,
        name: detectedCode ? `Sarojini Street Find ${detectedCode}` : `Sarojini Bazaar Item ${index}`,
        title_source: detectedCode ? 'code' : 'default',
        description: null, // ZERO fake description
        price: null, // ZERO fake price
        original_price: null,
        department: deptInfo.department,
        category_id: deptInfo.category_id,
        category_name: deptInfo.category_name,
        images: highResImages, // Real gallery images
        sizes: [], // ZERO fake sizes
        colors: [],
        stock: 25,
        stock_source: 'default',
        detected_code: detectedCode,
        is_direct_image: true,
        fetch_failed: false,
        is_duplicate: false,
        is_invalid: false,
        status: 'Price missing — please enter',
        selected: false,
        advance_payment_enabled: globalAdvToggle ? globalAdvToggle.checked : true,
        advance_payment_type: globalAdvType ? globalAdvType.value : 'fixed',
        advance_payment_value: globalAdvVal ? (parseFloat(globalAdvVal.value) || 80) : 80,
        specs: {
          material: '',
          fabric: '',
          fit: '',
          pattern: '',
          neck: '',
          sleeve: '',
          gender: '',
          country_of_origin: 'India',
          care_instructions: '',
          brand: 'Sarojini Bazaar',
          custom: []
        },
        show_specs: false
      };
    }

    // =========================================================================
    // CASE 2: PRODUCT WEB PAGE URL
    // =========================================================================
    let url = line;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (_) {
      return {
        id: 'stg-' + Date.now() + '-' + index,
        source_url: url,
        name: `Invalid URL (${url.substring(0, 30)})`,
        price: null,
        original_price: null,
        department: 'WOMEN',
        category_id: null,
        category_name: 'Unassigned',
        images: [],
        sizes: [],
        colors: [],
        stock: 25,
        description: null,
        is_invalid: true,
        fetch_failed: true,
        status: 'Invalid URL format',
        selected: false,
        specs: {
          material: '',
          fabric: '',
          fit: '',
          pattern: '',
          neck: '',
          sleeve: '',
          gender: '',
          country_of_origin: 'India',
          care_instructions: '',
          brand: 'Sarojini Bazaar',
          custom: []
        },
        show_specs: false
      };
    }

    // Extract title from slug as a fallback
    let slugTitle = null;
    const meeshoMatch = parsedUrl.pathname.match(/^\/([^\/]+)\/p\/([a-z0-9]+)/i);
    if (meeshoMatch) {
      slugTitle = meeshoMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } else {
      const segs = parsedUrl.pathname.split('/').filter(Boolean);
      if (segs.length > 0) {
        slugTitle = segs[segs.length - 1].replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }

    // Attempt multi-tier network extraction
    const extractionResult = await fetchAndExtractProduct(parsedUrl.href);

    const isAdv = globalAdvToggle ? globalAdvToggle.checked : true;
    const advType = globalAdvType ? globalAdvType.value : 'fixed';
    const advVal = globalAdvVal ? (parseFloat(globalAdvVal.value) || 80) : 80;

    if (extractionResult.success) {
      const deptInfo = autoSuggestDepartmentAndCategory((extractionResult.name || slugTitle || '') + ' ' + parsedUrl.href);
      return {
        id: 'stg-' + Date.now() + '-' + index,
        source_url: parsedUrl.href,
        name: extractionResult.name || slugTitle || 'Sarojini Bazaar Item',
        title_source: extractionResult.name ? 'fetched' : 'slug',
        description: extractionResult.description || null,
        price: extractionResult.price,
        original_price: extractionResult.original_price,
        department: deptInfo.department,
        category_id: deptInfo.category_id,
        category_name: deptInfo.category_name,
        images: extractionResult.images || [],
        sizes: extractionResult.sizes || [],
        colors: extractionResult.colors || [],
        stock: extractionResult.stock || 25,
        stock_source: extractionResult.stock ? 'fetched' : 'default',
        detected_code: extractionResult.detected_code || null,
        fetch_failed: false,
        is_direct_image: false,
        is_duplicate: false,
        is_invalid: false,
        status: extractionResult.price > 0 && extractionResult.images.length > 0 ? 'Ready' : 'Incomplete data',
        selected: Boolean(extractionResult.price > 0 && extractionResult.images.length > 0),
        advance_payment_enabled: isAdv,
        advance_payment_type: advType,
        advance_payment_value: advVal,
        specs: {
          material: extractionResult.material || '',
          fabric: extractionResult.fabric || '',
          fit: extractionResult.fit || '',
          pattern: extractionResult.pattern || '',
          neck: extractionResult.neck || '',
          sleeve: extractionResult.sleeve || '',
          gender: extractionResult.gender || '',
          country_of_origin: 'India',
          care_instructions: '',
          brand: extractionResult.brand || 'Sarojini Bazaar',
          custom: []
        },
        show_specs: false
      };
    } else {
      // Fetch failed or source blocked automated access:
      // STRICT REQUIREMENT: ZERO fake placeholder data! No fake images, no fake price, no fake description.
      const deptInfo = autoSuggestDepartmentAndCategory((slugTitle || '') + ' ' + parsedUrl.href);

      return {
        id: 'stg-' + Date.now() + '-' + index,
        source_url: parsedUrl.href,
        name: slugTitle || 'Sarojini Product',
        title_source: slugTitle ? 'slug' : 'default',
        description: null, // ZERO fake description
        price: null, // ZERO fake price
        original_price: null,
        department: deptInfo.department,
        category_id: deptInfo.category_id,
        category_name: deptInfo.category_name,
        images: [], // ZERO fake placeholder image
        sizes: [], // ZERO fake sizes
        colors: [],
        stock: 25,
        stock_source: 'default',
        detected_code: null,
        fetch_failed: true,
        fetch_error: extractionResult.error || 'Could not fetch product data automatically (source blocked automated access). Use CSV / direct image fallback.',
        is_direct_image: false,
        is_duplicate: false,
        is_invalid: false,
        status: 'Could not fetch product data automatically',
        selected: false,
        advance_payment_enabled: isAdv,
        advance_payment_type: advType,
        advance_payment_value: advVal,
        specs: {
          material: '',
          fabric: '',
          fit: '',
          pattern: '',
          neck: '',
          sleeve: '',
          gender: '',
          country_of_origin: 'India',
          care_instructions: '',
          brand: 'Sarojini Bazaar',
          custom: []
        },
        show_specs: false
      };
    }
  }

  /**
   * Attempts to fetch public page content and extract structured data:
   * 1. JSON-LD (<script type="application/ld+json">)
   * 2. OpenGraph tags
   * 3. Public HTML metadata
   * 4. High-res image assets
   */
  async function fetchAndExtractProduct(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return { success: false, error: `Upstream status: ${resp.status} ${resp.statusText}` };
      }

      const html = await resp.text();

      // Check if blocked by Akamai / Cloudflare / Access Denied
      if (
        html.includes('<TITLE>Access Denied</TITLE>') ||
        html.includes('errors.edgesuite.net') ||
        html.includes('Attention Required! | Cloudflare') ||
        html.includes('Just a moment...')
      ) {
        return {
          success: false,
          blocked: true,
          error: 'Could not fetch product data automatically (source blocked automated access).'
        };
      }

      return parseHtmlProductData(html, url);

    } catch (err) {
      return {
        success: false,
        error: 'Could not fetch product data automatically (source blocked automated access).'
      };
    }
  }

  /**
   * Parses HTML for structured product metadata.
   */
  function parseHtmlProductData(html, sourceUrl) {
    let name = null;
    let description = null;
    let price = null;
    let original_price = null;
    let images = [];
    let sizes = [];
    let colors = [];
    let detected_code = null;

    // 1. Try JSON-LD
    const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
        for (const item of items) {
          if (item['@type'] === 'Product' || item.name) {
            if (!name && item.name) name = item.name.trim();
            if (!description && item.description) description = item.description.trim();

            if (item.image) {
              const rawImgs = Array.isArray(item.image) ? item.image : [item.image];
              rawImgs.forEach(img => {
                const u = typeof img === 'string' ? img : img.url || img.contentUrl;
                if (u && !images.includes(u)) images.push(u);
              });
            }

            if (item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              const first = offers[0];
              if (first) {
                if (first.price) price = parseFloat(first.price);
                if (first.priceSpecification?.price) {
                  original_price = parseFloat(first.priceSpecification.price);
                }
              }
            }
          }
        }
      } catch (_) {}
    }

    // 2. Try OpenGraph
    if (!name) {
      const ogTitle = html.match(/<meta\s+[^>]*property=["']og:title["']\s+content=["'](.*?)["']/i);
      if (ogTitle) name = ogTitle[1].trim();
    }
    if (!description) {
      const ogDesc = html.match(/<meta\s+[^>]*property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                     html.match(/<meta\s+[^>]*name=["']description["']\s+content=["'](.*?)["']/i);
      if (ogDesc) description = ogDesc[1].trim();
    }
    if (images.length === 0) {
      const ogImages = html.matchAll(/<meta\s+[^>]*property=["']og:image(?::secure_url)?["']\s+content=["'](.*?)["']/gi);
      for (const m of ogImages) {
        if (m[1] && !images.includes(m[1])) images.push(m[1]);
      }
    }
    if (price === null) {
      const ogPrice = html.match(/<meta\s+[^>]*property=["']product:price:amount["']\s+content=["'](.*?)["']/i);
      if (ogPrice) price = parseFloat(ogPrice[1]);
    }

    // 3. Fallback <title>
    if (!name) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        name = titleMatch[1].replace(/[-|•].*$/, '').trim();
      }
    }

    // 4. Upgrade any Meesho images to 1024 high-res master assets
    images = images.map(img => {
      if (img.includes('images.meesho.com')) {
        const m = img.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
        if (m && !detected_code) detected_code = `S-${m[1]}`;
        return img.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
      }
      return img;
    });

    const hasUsefulData = Boolean(name || images.length > 0 || (price !== null && price > 0));

    return {
      success: hasUsefulData,
      name,
      description,
      price,
      original_price,
      images,
      sizes,
      colors,
      detected_code
    };
  }

  /**
   * Intelligently maps name or tokens to Sarojini Department and Lane Category.
   */
  function autoSuggestDepartmentAndCategory(corpus) {
    const text = (corpus || '').toLowerCase();

    let department = 'WOMEN'; // default
    if (/\b(men|man|mens|boy|oversized|hoodie|polo|cargo|cargos|male)\b/i.test(text)) {
      department = 'MEN';
    } else if (/\b(sneaker|sneakers|kicks|shoe|shoes|footwear|loafers|slides)\b/i.test(text)) {
      department = 'FOOTWEAR';
    } else if (/\b(bag|bags|tote|backpack|handbag|crossbody|clutch|purse)\b/i.test(text)) {
      department = 'BAGS';
    } else if (/\b(sunglass|sunglasses|shades|eyewear|glasses|wallet|belt)\b/i.test(text)) {
      department = 'ACCESSORIES';
    } else if (/\b(jewellery|jewelry|earring|earrings|necklace|pendant|ring|bangle|bracelet)\b/i.test(text)) {
      department = 'JEWELLERY';
    } else if (/\b(cap|caps|hat|hats|beanie|bucket hat)\b/i.test(text)) {
      department = 'CAPS';
    }

    // Find closest category in this department
    const deptCats = sarojiniCategories.filter(c => (c.department || '').toUpperCase() === department);
    let matchedCat = null;

    if (deptCats.length > 0) {
      matchedCat = deptCats.find(c => {
        const cName = c.name.toLowerCase();
        return text.includes(cName) || cName.split(/\s+/).some(w => w.length > 3 && text.includes(w));
      });
      if (!matchedCat) matchedCat = deptCats[0];
    }

    return {
      department,
      category_id: matchedCat ? matchedCat.id : null,
      category_name: matchedCat ? matchedCat.name : department
    };
  }

  // ==========================================================================
  // CSV PARSER & TEMPLATE GENERATOR (Supports Pipe | Images & Arrays)
  // ==========================================================================
  function downloadCsvTemplate() {
    const headers = [
      'name',
      'price',
      'original_price',
      'department',
      'category',
      'images',
      'sizes',
      'colors',
      'stock',
      'description',
      'advance_amount',
      'source_url'
    ];

    const sampleRows = [
      [
        'Oversized Anime Street Graphic T-Shirt',
        '399',
        '899',
        'MEN',
        'Oversized T-Shirts',
        'https://images.meesho.com/images/products/1084290722/ylpxd_1024.jpg|https://images.meesho.com/images/products/1084290722/2_1024.jpg',
        'M|L|XL',
        'Black|White',
        '50',
        'Pure heavy cotton oversized tee inspired by Japanese manga art.',
        '80',
        'https://www.meesho.com/trendy-oversized-anime-tshirt/p/sample1'
      ],
      [
        'Vintage Relaxed 90s Wide Leg Denim',
        '599',
        '1299',
        'WOMEN',
        'Jeans',
        'https://images.meesho.com/images/products/990006640/8nyjx_1024.jpg',
        '28|30|32',
        'Light Blue',
        '35',
        'High-waisted relaxed aesthetic denim jeans from Sarojini Nagar Lane.',
        '100',
        'https://www.meesho.com/vintage-relaxed-denim/p/sample2'
      ]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sarojini_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleParseCsv() {
    let csvText = inputCsvText ? inputCsvText.value.trim() : '';

    if (inputCsvFile && inputCsvFile.files && inputCsvFile.files[0]) {
      const file = inputCsvFile.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        parseCsvData(e.target.result);
      };
      reader.readAsText(file);
    } else if (csvText) {
      parseCsvData(csvText);
    } else {
      alert('Please choose a CSV file or paste CSV content.');
    }
  }

  function parseCsvData(content) {
    if (!content || typeof content !== 'string') return;

    btnParseCsv.disabled = true;
    btnParseCsv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Parsing CSV...';

    const rows = parseCsvTokens(content);
    if (rows.length < 2) {
      alert('CSV is empty or missing headers.');
      btnParseCsv.disabled = false;
      btnParseCsv.innerHTML = '<i class="fas fa-file-code"></i> Parse CSV';
      return;
    }

    const header = rows[0].map(h => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const priceIdx = header.indexOf('price');
    const origIdx = header.indexOf('original_price');
    const deptIdx = header.indexOf('department');
    const catIdx = header.indexOf('category');
    const imgIdx = header.indexOf('images');
    const sizeIdx = header.indexOf('sizes');
    const colIdx = header.indexOf('colors');
    const stockIdx = header.indexOf('stock');
    const descIdx = header.indexOf('description');
    const advIdx = header.indexOf('advance_amount');
    const urlIdx = header.indexOf('source_url');

    // Specifications headers
    const matIdx = header.indexOf('material');
    const fabIdx = header.indexOf('fabric');
    const fitIdx = header.indexOf('fit') !== -1 ? header.indexOf('fit') : header.indexOf('fit_type');
    const patIdx = header.indexOf('pattern');
    const neckIdx = header.indexOf('neck');
    const slvIdx = header.indexOf('sleeve');
    const genIdx = header.indexOf('gender');
    const origCtryIdx = header.indexOf('country_of_origin') !== -1 ? header.indexOf('country_of_origin') : header.indexOf('origin');
    const careIdx = header.indexOf('care_instructions') !== -1 ? header.indexOf('care_instructions') : header.indexOf('care');
    const brandIdx = header.indexOf('brand');

    if (nameIdx === -1 || priceIdx === -1) {
      alert('CSV must contain at least "name" and "price" columns.');
      btnParseCsv.disabled = false;
      btnParseCsv.innerHTML = '<i class="fas fa-file-code"></i> Parse CSV';
      return;
    }

    const parsedItems = [];
    const seenUrlsInCsv = new Set();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length === 0 || (r.length === 1 && !r[0])) continue;

      const name = (r[nameIdx] || '').trim();
      const rawPrice = parseFloat(r[priceIdx]);
      const price = (!isNaN(rawPrice) && rawPrice > 0) ? rawPrice : null;
      const rawOrig = (origIdx !== -1 && r[origIdx]) ? parseFloat(r[origIdx]) : null;
      const origPrice = (!isNaN(rawOrig) && rawOrig > 0) ? rawOrig : price;
      const dept = (deptIdx !== -1 && r[deptIdx]) ? r[deptIdx].trim().toUpperCase() : 'WOMEN';
      const catName = (catIdx !== -1 && r[catIdx]) ? r[catIdx].trim() : '';

      // Support pipe |, semicolon ;, or comma separated image URLs
      const rawImgs = (imgIdx !== -1 && r[imgIdx])
        ? r[imgIdx].split(/[|;]+/).map(s => s.trim()).filter(Boolean)
        : [];

      // Upgrade Meesho images to 1024 master assets
      let detectedCode = null;
      const cleanImgs = rawImgs.map(img => {
        if (img.includes('images.meesho.com')) {
          const m = img.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
          if (m && !detectedCode) detectedCode = `S-${m[1]}`;
          return img.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
        }
        return img;
      });

      const sizes = (sizeIdx !== -1 && r[sizeIdx])
        ? r[sizeIdx].split(/[|;,]+/).map(s => s.trim()).filter(Boolean)
        : [];

      const colors = (colIdx !== -1 && r[colIdx])
        ? r[colIdx].split(/[|;,]+/).map(s => s.trim()).filter(Boolean)
        : [];

      const stockRaw = (stockIdx !== -1 && r[stockIdx]) ? parseInt(r[stockIdx], 10) : null;
      const stock = (!isNaN(stockRaw) && stockRaw >= 0) ? stockRaw : 25;
      const desc = (descIdx !== -1 && r[descIdx]) ? r[descIdx].trim() : null;
      const advAmount = (advIdx !== -1 && r[advIdx]) ? parseFloat(r[advIdx]) || 0 : 80;
      const sourceUrl = (urlIdx !== -1 && r[urlIdx]) ? r[urlIdx].trim() : `csv-row-${i}`;

      const matchedCat = sarojiniCategories.find(c =>
        c.name.toLowerCase() === catName.toLowerCase() &&
        (c.department || '').toUpperCase() === dept
      );

      const normUrl = sourceUrl.toLowerCase();
      let isDup = false;
      let status = 'Ready';

      if (seenUrlsInCsv.has(normUrl)) {
        isDup = true;
        status = 'Duplicate in CSV (Skipped)';
      } else if (existingProductUrls.has(normUrl)) {
        isDup = true;
        status = 'Already in catalog (Skipped)';
      } else if (name && existingProductNames.has(name.toLowerCase())) {
        isDup = true;
        status = 'Product name already exists';
      } else if (price === null) {
        status = 'Price missing — please enter';
      } else if (cleanImgs.length === 0) {
        status = 'Images missing — please add';
      }

      seenUrlsInCsv.add(normUrl);

      parsedItems.push({
        id: 'stg-csv-' + Date.now() + '-' + i,
        source_url: sourceUrl,
        name: name || `Sarojini Item ${i}`,
        title_source: name ? 'csv' : 'default',
        price,
        original_price: origPrice,
        department: dept,
        category_id: matchedCat ? matchedCat.id : null,
        category_name: matchedCat ? matchedCat.name : (catName || dept),
        images: cleanImgs, // ZERO fake images
        sizes,
        colors,
        stock,
        stock_source: stockRaw !== null ? 'fetched' : 'default',
        description: desc, // ZERO fake description
        detected_code: detectedCode,
        advance_payment_enabled: advAmount > 0,
        advance_payment_type: 'fixed',
        advance_payment_value: advAmount,
        is_duplicate: isDup,
        is_invalid: false,
        status,
        selected: !isDup && price !== null && cleanImgs.length > 0,
        specs: {
          material: (matIdx !== -1 && r[matIdx]) ? r[matIdx].trim() : '',
          fabric: (fabIdx !== -1 && r[fabIdx]) ? r[fabIdx].trim() : '',
          fit: (fitIdx !== -1 && r[fitIdx]) ? r[fitIdx].trim() : '',
          pattern: (patIdx !== -1 && r[patIdx]) ? r[patIdx].trim() : '',
          neck: (neckIdx !== -1 && r[neckIdx]) ? r[neckIdx].trim() : '',
          sleeve: (slvIdx !== -1 && r[slvIdx]) ? r[slvIdx].trim() : '',
          gender: (genIdx !== -1 && r[genIdx]) ? r[genIdx].trim() : '',
          country_of_origin: (origCtryIdx !== -1 && r[origCtryIdx]) ? r[origCtryIdx].trim() : 'India',
          care_instructions: (careIdx !== -1 && r[careIdx]) ? r[careIdx].trim() : '',
          brand: (brandIdx !== -1 && r[brandIdx]) ? r[brandIdx].trim() : 'Sarojini Bazaar',
          custom: []
        },
        show_specs: false
      });
    }

    stagedProducts = parsedItems;
    renderStagingTable();

    btnParseCsv.disabled = false;
    btnParseCsv.innerHTML = '<i class="fas fa-file-code"></i> Parse CSV';
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * RFC 4180 CSV parser supporting commas inside quotes and escaped quotes.
   */
  function parseCsvTokens(text) {
    const lines = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
      lines.push(row);
    }
    return lines;
  }

  // ==========================================================================
  // SYNC STAGING ROW INPUTS (PRESERVES USER DATA ACROSS RE-RENDERS)
  // ==========================================================================
  function syncStagingRowInputs() {
    if (!previewTbody) return;
    const rows = previewTbody.querySelectorAll('tr[data-stg-id]');
    if (rows.length === 0) return;
    rows.forEach(tr => {
      const idxEl = tr.querySelector('[data-stg-idx]');
      if (!idxEl) return;
      const idx = parseInt(idxEl.dataset.stgIdx, 10);
      const prod = stagedProducts[idx];
      if (!prod) return;

      const nameInp = tr.querySelector('.stg-name');
      if (nameInp) prod.name = nameInp.value;

      const descInp = tr.querySelector('.stg-desc');
      if (descInp) prod.description = descInp.value;

      const sizesInp = tr.querySelector('.stg-sizes');
      if (sizesInp) {
        prod.sizes = sizesInp.value.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
      }

      const colorsInp = tr.querySelector('.stg-colors');
      if (colorsInp) {
        prod.colors = colorsInp.value.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
      }

      const stockInp = tr.querySelector('.stg-stock');
      if (stockInp) {
        prod.stock = parseInt(stockInp.value, 10) || 0;
      }

      const deptSel = tr.querySelector('.stg-dept');
      if (deptSel) {
        prod.department = deptSel.value;
      }

      const catSel = tr.querySelector('.stg-cat');
      if (catSel) {
        prod.category_id = catSel.value || null;
      }

      const priceInp = tr.querySelector('.stg-price');
      if (priceInp) {
        const val = parseFloat(priceInp.value);
        prod.price = (!isNaN(val) && val > 0) ? val : null;
      }

      const origInp = tr.querySelector('.stg-orig');
      if (origInp) {
        const val = parseFloat(origInp.value);
        prod.original_price = (!isNaN(val) && val > 0) ? val : null;
      }

      const advInp = tr.querySelector('.stg-adv');
      if (advInp) {
        prod.advance_payment_value = parseFloat(advInp.value) || 0;
      }

      const chk = tr.querySelector('.row-chk-import');
      if (chk) {
        prod.selected = chk.checked;
      }

      if (prod.specs) {
        tr.querySelectorAll('.stg-spec-input').forEach(specInp => {
          const key = specInp.dataset.specKey;
          if (key) prod.specs[key] = specInp.value;
        });

        tr.querySelectorAll('.stg-custom-name').forEach(nameInp => {
          const cIdx = parseInt(nameInp.dataset.customIdx, 10);
          if (prod.specs.custom && prod.specs.custom[cIdx]) {
            prod.specs.custom[cIdx].name = nameInp.value;
          }
        });

        tr.querySelectorAll('.stg-custom-val').forEach(valInp => {
          const cIdx = parseInt(valInp.dataset.customIdx, 10);
          if (prod.specs.custom && prod.specs.custom[cIdx]) {
            prod.specs.custom[cIdx].value = valInp.value;
          }
        });
      }
    });
  }

  // ==========================================================================
  // STAGING PREVIEW TABLE & INLINE EDITING
  // ==========================================================================
  function renderStagingTable() {
    if (!previewTbody) return;

    // Preserve any existing user input values before re-rendering the DOM
    if (previewTbody.children && previewTbody.children.length > 0 && stagedProducts.length > 0) {
      syncStagingRowInputs();
    }

    if (stagedProducts.length === 0) {
      previewTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No products staged yet. Paste URLs or upload a CSV above.</td></tr>`;
      updateStagingStats();
      return;
    }

    previewTbody.innerHTML = stagedProducts.map((p, idx) => {
      // Ensure specs object exists
      if (!p.specs) {
        p.specs = {
          material: '',
          fabric: '',
          fit: '',
          pattern: '',
          neck: '',
          sleeve: '',
          gender: '',
          country_of_origin: 'India',
          care_instructions: '',
          brand: 'Sarojini Bazaar',
          custom: []
        };
      }
      if (!Array.isArray(p.specs.custom)) {
        p.specs.custom = [];
      }

      const hasImages = Array.isArray(p.images) && p.images.length > 0;
      const hasPrice = p.price !== null && Number(p.price) > 0;
      const isReadyToImport = hasPrice && hasImages && !p.is_duplicate && !p.is_invalid;

      // Status Badge
      let statusBadge = `<span class="badge badge-success">${escapeHtml(p.status)}</span>`;
      if (p.is_duplicate) {
        statusBadge = `<span class="badge badge-warning">${escapeHtml(p.status)}</span>`;
      } else if (!isReadyToImport) {
        statusBadge = `<span class="badge badge-danger">${escapeHtml(p.status)}</span>`;
      }

      // Field-Level Badges
      const fieldBadges = [];
      if (p.name) {
        if (p.title_source === 'fetched' || p.title_source === 'csv') {
          fieldBadges.push(`<span class="stg-badge-pill success">✓ Title fetched</span>`);
        } else if (p.title_source === 'code') {
          fieldBadges.push(`<span class="stg-badge-pill success">✓ Title from Code (${p.detected_code})</span>`);
        } else {
          fieldBadges.push(`<span class="stg-badge-pill warning">⚠ Title from slug</span>`);
        }
      } else {
        fieldBadges.push(`<span class="stg-badge-pill danger">⚠ Title missing</span>`);
      }

      if (hasImages) {
        fieldBadges.push(`<span class="stg-badge-pill success">✓ ${p.images.length} Image${p.images.length === 1 ? '' : 's'}</span>`);
      } else {
        fieldBadges.push(`<span class="stg-badge-pill danger">⚠ Gallery unavailable</span>`);
      }

      if (hasPrice) {
        fieldBadges.push(`<span class="stg-badge-pill success">✓ Price ₹${p.price}</span>`);
      } else {
        fieldBadges.push(`<span class="stg-badge-pill danger">⚠ Price unavailable</span>`);
      }

      if (p.original_price && p.original_price > 0) {
        fieldBadges.push(`<span class="stg-badge-pill success">✓ MRP ₹${p.original_price}</span>`);
      } else {
        fieldBadges.push(`<span class="stg-badge-pill muted">⚠ MRP unavailable</span>`);
      }

      if (p.description) {
        fieldBadges.push(`<span class="stg-badge-pill success">✓ Description fetched</span>`);
      } else {
        fieldBadges.push(`<span class="stg-badge-pill warning">⚠ Description unavailable</span>`);
      }

      if (p.sizes && p.sizes.length > 0) {
        fieldBadges.push(`<span class="stg-badge-pill success">✓ Sizes (${p.sizes.length})</span>`);
      } else {
        fieldBadges.push(`<span class="stg-badge-pill muted">⚠ Sizes unavailable</span>`);
      }

      const rowClass = [
        'stg-card-row',
        p.is_duplicate ? 'row-duplicate' : '',
        !isReadyToImport ? 'row-missing-required' : ''
      ].filter(Boolean).join(' ');

      // Build compact thumbnail strip
      const thumbStripHtml = hasImages ? p.images.map((imgUrl, imgIdx) => {
        const isMain = imgIdx === 0;
        const codeDet = window.SarojiniWatermark ? window.SarojiniWatermark.detectSupplierCode(imgUrl) : { detected: false };
        return `
          <div class="stg-thumb-box ${isMain ? 'is-main' : ''}" data-stg-idx="${idx}" data-img-idx="${imgIdx}" title="${isMain ? 'MAIN IMAGE' : 'Gallery Image ' + (imgIdx + 1)} (Click to view full size)">
            <img src="${escapeHtml(imgUrl)}" alt="Product" onerror="this.src='../assets/sarojni/prod-1-graphic-tee.png'">
            ${isMain ? `<span class="stg-main-badge"><i class="fas fa-star" style="font-size:0.5rem;"></i> MAIN</span>` : ''}
            ${codeDet.detected ? `<span class="watermark-tag" style="position:absolute; bottom:0; left:0; right:0; font-size:0.5rem; background:rgba(0,0,0,0.88); color:#fff; text-align:center; padding:1px 0;">● Watermark</span>` : ''}
            <div class="stg-thumb-actions">
              ${!isMain ? `<button type="button" class="stg-thumb-btn btn-set-main" data-stg-idx="${idx}" data-img-idx="${imgIdx}" title="Set as Main Image">★</button>` : ''}
              ${imgIdx > 0 ? `<button type="button" class="stg-thumb-btn btn-move-left" data-stg-idx="${idx}" data-img-idx="${imgIdx}" title="Move Left">←</button>` : ''}
              ${imgIdx < p.images.length - 1 ? `<button type="button" class="stg-thumb-btn btn-move-right" data-stg-idx="${idx}" data-img-idx="${imgIdx}" title="Move Right">→</button>` : ''}
              <button type="button" class="stg-thumb-btn btn-remove-thumb" data-stg-idx="${idx}" data-img-idx="${imgIdx}" title="Remove image">&times;</button>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="font-size: 0.7rem; color: #f87171; padding: 12px 8px; text-align: center; border: 1px dashed rgba(239,68,68,0.4); border-radius: 6px; width: 100%;">
          <i class="fas fa-image" style="font-size: 1.2rem; display: block; margin-bottom: 3px;"></i>
          No Images
        </div>
      `;

      return `
        <tr data-stg-id="${p.id}" class="${rowClass}">
          <td style="text-align: center; vertical-align: top; padding-top: 16px;">
            <input type="checkbox" class="row-chk-import" data-stg-idx="${idx}" ${p.selected ? 'checked' : ''} ${!isReadyToImport ? 'disabled title="Cannot import: Selling price and at least 1 image required"' : ''}>
          </td>
          
          <!-- GALLERY & IMAGES COLUMN -->
          <td style="width: 220px; min-width: 210px; vertical-align: top; padding-top: 14px;">
            <div class="stg-gallery-wrap">
              <div class="stg-thumb-strip">
                ${thumbStripHtml}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                <!-- Per-row native hidden file input for multiple image selection -->
                <input type="file" class="stg-file-input" data-stg-idx="${idx}" accept="image/*" multiple style="display: none;">
                
                <div style="display: flex; align-items: center; gap: 4px;">
                  <button type="button" class="btn-admin-secondary btn-open-add-images" data-stg-idx="${idx}" title="Select image(s) from your computer" style="font-size: 0.74rem; padding: 3px 8px; border-color: rgba(225,29,72,0.5); color: #fb7185; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    <i class="fas fa-plus"></i> Add Images
                  </button>
                  <button type="button" class="btn-admin-secondary btn-open-url-modal" data-stg-idx="${idx}" title="Paste image URL(s)" style="font-size: 0.72rem; padding: 3px 6px; border-color: rgba(148,163,184,0.3); color: var(--admin-text-muted); display: inline-flex; align-items: center; gap: 3px; cursor: pointer;">
                    <i class="fas fa-link"></i> + URL
                  </button>
                </div>
                <span style="font-size: 0.72rem; color: var(--admin-text-muted); font-weight: 600;">
                  ${p.images ? p.images.length : 0} Image${(p.images && p.images.length === 1) ? '' : 's'}
                </span>
              </div>
            </div>
          </td>

          <!-- PRODUCT DETAILS & SPECIFICATIONS COLUMN -->
          <td style="vertical-align: top; padding-top: 14px;">
            <!-- Title -->
            <input type="text" class="admin-input stg-name" data-stg-idx="${idx}" value="${escapeHtml(p.name)}" placeholder="Product Title *" style="width: 100%; font-size: 0.88rem; font-weight: 700; margin-bottom: 6px;">
            
            <!-- Description -->
            <textarea class="admin-input stg-desc" data-stg-idx="${idx}" rows="2" placeholder="Product description... (or add manually)" style="width: 100%; font-size: 0.78rem; resize: vertical; line-height: 1.4; margin-bottom: 6px;">${escapeHtml(p.description || '')}</textarea>
            
            <!-- Sizes & Colors in one line -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px;">
              <input type="text" class="admin-input stg-sizes" data-stg-idx="${idx}" value="${escapeHtml(p.sizes ? p.sizes.join(', ') : '')}" placeholder="Sizes (e.g. S, M, L, XL)" style="font-size: 0.75rem;">
              <input type="text" class="admin-input stg-colors" data-stg-idx="${idx}" value="${escapeHtml(p.colors ? p.colors.join(', ') : '')}" placeholder="Colors (e.g. Black, White)" style="font-size: 0.75rem;">
            </div>

            <!-- Field Badges -->
            <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 4px;">
              ${fieldBadges.join('')}
            </div>

            <!-- Expandable Product Specifications Accordion -->
            <div style="margin-top: 6px;">
              <button type="button" class="stg-specs-toggle" data-stg-idx="${idx}">
                <i class="fas fa-chevron-${p.show_specs ? 'up' : 'down'}"></i>
                <span>${p.show_specs ? '▲ Hide Product Specifications' : '▼ Product Specifications'}</span>
              </button>

              <div class="stg-specs-container" id="specs-box-${idx}" style="display: ${p.show_specs ? 'block' : 'none'};">
                <div class="stg-specs-grid">
                  <div class="stg-spec-item">
                    <label>Material</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="material" value="${escapeHtml(p.specs.material || '')}" placeholder="e.g. Cotton Blend">
                  </div>
                  <div class="stg-spec-item">
                    <label>Fabric</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="fabric" value="${escapeHtml(p.specs.fabric || '')}" placeholder="e.g. Denim / Fleece">
                  </div>
                  <div class="stg-spec-item">
                    <label>Fit Type</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="fit" value="${escapeHtml(p.specs.fit || '')}" placeholder="e.g. Oversized / Slim">
                  </div>
                  <div class="stg-spec-item">
                    <label>Pattern</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="pattern" value="${escapeHtml(p.specs.pattern || '')}" placeholder="e.g. Graphic Print / Solid">
                  </div>
                  <div class="stg-spec-item">
                    <label>Neck</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="neck" value="${escapeHtml(p.specs.neck || '')}" placeholder="e.g. Round Neck / Collar">
                  </div>
                  <div class="stg-spec-item">
                    <label>Sleeve</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="sleeve" value="${escapeHtml(p.specs.sleeve || '')}" placeholder="e.g. Half / Full Sleeve">
                  </div>
                  <div class="stg-spec-item">
                    <label>Gender</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="gender" value="${escapeHtml(p.specs.gender || '')}" placeholder="e.g. Women / Men / Unisex">
                  </div>
                  <div class="stg-spec-item">
                    <label>Country of Origin</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="country_of_origin" value="${escapeHtml(p.specs.country_of_origin || 'India')}" placeholder="India">
                  </div>
                  <div class="stg-spec-item">
                    <label>Care Instructions</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="care_instructions" value="${escapeHtml(p.specs.care_instructions || '')}" placeholder="e.g. Machine Wash Cold">
                  </div>
                  <div class="stg-spec-item">
                    <label>Brand</label>
                    <input type="text" class="stg-spec-input" data-stg-idx="${idx}" data-spec-key="brand" value="${escapeHtml(p.specs.brand || 'Sarojini Bazaar')}" placeholder="Sarojini Bazaar">
                  </div>
                </div>

                <!-- Custom Specifications -->
                <div class="stg-custom-specs-list" id="custom-specs-list-${idx}">
                  <div style="font-size: 0.72rem; font-weight: 700; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span>Custom Specifications</span>
                    <button type="button" class="btn-admin-secondary btn-add-custom-spec" data-stg-idx="${idx}" style="font-size: 0.68rem; padding: 2px 8px; border-color: rgba(56,189,248,0.4); color: #38bdf8;">
                      <i class="fas fa-plus"></i> Add Specification
                    </button>
                  </div>
                  ${p.specs.custom.map((c, cIdx) => `
                    <div class="stg-custom-spec-row">
                      <input type="text" class="stg-custom-name" data-stg-idx="${idx}" data-custom-idx="${cIdx}" value="${escapeHtml(c.name || '')}" placeholder="Name (e.g. Closure, Occasion)" style="flex: 1;">
                      <input type="text" class="stg-custom-val" data-stg-idx="${idx}" data-custom-idx="${cIdx}" value="${escapeHtml(c.value || '')}" placeholder="Value (e.g. Button, Festive)" style="flex: 1;">
                      <button type="button" class="btn-admin-danger btn-remove-custom-spec" data-stg-idx="${idx}" data-custom-idx="${cIdx}" style="padding: 2px 7px; font-size: 0.75rem;" title="Remove specification">&times;</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Source Link / Error Alert -->
            ${p.fetch_failed ? `
              <div style="color: #f87171; font-size: 0.72rem; margin-top: 4px; line-height: 1.3;">
                <i class="fas fa-exclamation-triangle"></i> ${escapeHtml(p.fetch_error || 'Could not fetch product data automatically. Please add image and price.')}
              </div>
            ` : `
              <div style="font-size: 0.7rem; color: var(--admin-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px; margin-top: 4px;" title="${escapeHtml(p.source_url)}">
                🔗 ${escapeHtml(p.source_url)}
              </div>
            `}
          </td>

          <!-- Department & Category -->
          <td style="width: 170px; vertical-align: top; padding-top: 14px;">
            <select class="admin-select stg-dept" data-stg-idx="${idx}" style="font-size: 0.78rem; margin-bottom: 6px; width: 100%;">
              <option value="WOMEN" ${p.department === 'WOMEN' ? 'selected' : ''}>WOMEN'S LANE</option>
              <option value="MEN" ${p.department === 'MEN' ? 'selected' : ''}>MEN'S LANE</option>
              <option value="FOOTWEAR" ${p.department === 'FOOTWEAR' ? 'selected' : ''}>SNEAKER STREET</option>
              <option value="BAGS" ${p.department === 'BAGS' ? 'selected' : ''}>BAG CORNER</option>
              <option value="ACCESSORIES" ${p.department === 'ACCESSORIES' ? 'selected' : ''}>ACCESSORIES</option>
              <option value="JEWELLERY" ${p.department === 'JEWELLERY' ? 'selected' : ''}>JEWELLERY</option>
              <option value="CAPS" ${p.department === 'CAPS' ? 'selected' : ''}>CAP CORNER</option>
            </select>
            <select class="admin-select stg-cat" data-stg-idx="${idx}" style="font-size: 0.78rem; width: 100%;">
              ${getCategoryOptionsForDept(p.department, p.category_id)}
            </select>
            <div style="margin-top: 8px;">
              <label style="font-size: 0.7rem; color: var(--admin-text-muted); display: block;">Stock Units:</label>
              <input type="number" class="admin-input stg-stock" data-stg-idx="${idx}" value="${p.stock || 25}" min="0" style="width: 100%; font-size: 0.78rem; padding: 4px 6px;">
            </div>
          </td>

          <!-- Selling Price -->
          <td style="width: 110px; vertical-align: top; padding-top: 14px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: var(--admin-text-muted); font-size: 0.8rem;">₹</span>
              <input type="number" class="admin-input stg-price" data-stg-idx="${idx}" value="${p.price !== null ? p.price : ''}" placeholder="Price *" min="1" style="width: 82px; font-weight: 700; ${!hasPrice ? 'border-color: #ef4444; background: rgba(239,68,68,0.08);' : ''}">
            </div>
            ${!hasPrice ? `<div style="color: #f87171; font-size: 0.68rem; margin-top: 3px;">Required</div>` : ''}
          </td>

          <!-- MRP -->
          <td style="width: 110px; vertical-align: top; padding-top: 14px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: var(--admin-text-muted); font-size: 0.8rem;">₹</span>
              <input type="number" class="admin-input stg-orig" data-stg-idx="${idx}" value="${p.original_price !== null ? p.original_price : ''}" placeholder="MRP" min="1" style="width: 82px;">
            </div>
          </td>

          <!-- Advance Amount -->
          <td style="width: 100px; vertical-align: top; padding-top: 14px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: var(--admin-text-muted); font-size: 0.8rem;">₹</span>
              <input type="number" class="admin-input stg-adv" data-stg-idx="${idx}" value="${p.advance_payment_value !== undefined ? p.advance_payment_value : 80}" placeholder="Advance" min="0" style="width: 72px;">
            </div>
          </td>

          <!-- Status -->
          <td style="width: 140px; vertical-align: top; padding-top: 14px;">
            ${statusBadge}
          </td>

          <!-- Actions -->
          <td style="text-align: right; width: 60px; vertical-align: top; padding-top: 14px;">
            <button type="button" class="btn-admin-danger btn-stg-remove" data-stg-idx="${idx}" style="padding: 4px 8px; font-size: 0.75rem;" title="Remove from list">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    bindStagingRowEvents();
    updateStagingStats();
  }

  function getCategoryOptionsForDept(dept, selectedCatId) {
    const cats = sarojiniCategories.filter(c => (c.department || '').toUpperCase() === (dept || '').toUpperCase());
    return '<option value="">(Select Category)</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === selectedCatId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  }

  function bindStagingRowEvents() {
    // Checkbox change
    previewTbody.querySelectorAll('.row-chk-import').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].selected = e.target.checked;
          updateImportSelectedButton();
        }
      });
    });

    // Name change
    previewTbody.querySelectorAll('.stg-name').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) stagedProducts[idx].name = e.target.value;
      });
    });

    // Description change
    previewTbody.querySelectorAll('.stg-desc').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) stagedProducts[idx].description = e.target.value;
      });
    });

    // Sizes change
    previewTbody.querySelectorAll('.stg-sizes').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].sizes = e.target.value.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
        }
      });
    });

    // Colors change
    previewTbody.querySelectorAll('.stg-colors').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].colors = e.target.value.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
        }
      });
    });

    // Stock change
    previewTbody.querySelectorAll('.stg-stock').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].stock = parseInt(e.target.value, 10) || 0;
        }
      });
    });

    // Department change -> updates categories
    previewTbody.querySelectorAll('.stg-dept').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].department = e.target.value;
          stagedProducts[idx].category_id = null;
          const catSel = previewTbody.querySelector(`.stg-cat[data-stg-idx="${idx}"]`);
          if (catSel) catSel.innerHTML = getCategoryOptionsForDept(e.target.value, null);
        }
      });
    });

    // Category change
    previewTbody.querySelectorAll('.stg-cat').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].category_id = e.target.value || null;
        }
      });
    });

    // Price change
    previewTbody.querySelectorAll('.stg-price').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          const val = parseFloat(e.target.value);
          stagedProducts[idx].price = (!isNaN(val) && val > 0) ? val : null;
          const hasImages = stagedProducts[idx].images && stagedProducts[idx].images.length > 0;

          if (stagedProducts[idx].price > 0 && hasImages && !stagedProducts[idx].is_duplicate) {
            stagedProducts[idx].status = 'Ready';
            stagedProducts[idx].selected = true;
          } else if (!hasImages) {
            stagedProducts[idx].status = 'Images missing — please add';
            stagedProducts[idx].selected = false;
          } else {
            stagedProducts[idx].status = 'Price missing — please enter';
            stagedProducts[idx].selected = false;
          }
          renderStagingTable();
        }
      });
    });

    // MRP change
    previewTbody.querySelectorAll('.stg-orig').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          const val = parseFloat(e.target.value);
          stagedProducts[idx].original_price = (!isNaN(val) && val > 0) ? val : null;
        }
      });
    });

    // Advance amount change
    previewTbody.querySelectorAll('.stg-adv').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].advance_payment_value = parseFloat(e.target.value) || 0;
        }
      });
    });

    // Remove single row button
    previewTbody.querySelectorAll('.btn-stg-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stgIdx, 10);
        stagedProducts.splice(idx, 1);
        renderStagingTable();
      });
    });

    // Click thumbnail to enlarge (Lightbox)
    previewTbody.querySelectorAll('.stg-thumb-box').forEach(box => {
      box.addEventListener('click', (e) => {
        if (e.target.closest('.stg-thumb-btn')) return;
        const stgIdx = parseInt(box.dataset.stgIdx, 10);
        const imgIdx = parseInt(box.dataset.imgIdx, 10);
        const prod = stagedProducts[stgIdx];
        if (prod && prod.images && prod.images[imgIdx]) {
          openImageLightbox(prod.images[imgIdx], prod.name, imgIdx);
        }
      });
    });

    // Set as Main Image button
    previewTbody.querySelectorAll('.btn-set-main').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stgIdx = parseInt(btn.dataset.stgIdx, 10);
        const imgIdx = parseInt(btn.dataset.imgIdx, 10);
        setAsMainImage(stgIdx, imgIdx);
      });
    });

    // Move Left button
    previewTbody.querySelectorAll('.btn-move-left').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stgIdx = parseInt(btn.dataset.stgIdx, 10);
        const imgIdx = parseInt(btn.dataset.imgIdx, 10);
        moveGalleryImage(stgIdx, imgIdx, -1);
      });
    });

    // Move Right button
    previewTbody.querySelectorAll('.btn-move-right').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stgIdx = parseInt(btn.dataset.stgIdx, 10);
        const imgIdx = parseInt(btn.dataset.imgIdx, 10);
        moveGalleryImage(stgIdx, imgIdx, 1);
      });
    });

    // Remove Thumbnail button
    previewTbody.querySelectorAll('.btn-remove-thumb').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stgIdx = parseInt(btn.dataset.stgIdx, 10);
        const imgIdx = parseInt(btn.dataset.imgIdx, 10);
        removeGalleryImage(stgIdx, imgIdx);
      });
    });

    // Clicking "+ Add Images" directly opens native browser file picker for this row
    previewTbody.querySelectorAll('.btn-open-add-images').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.stgIdx, 10);
        const fileInp = previewTbody.querySelector(`.stg-file-input[data-stg-idx="${idx}"]`);
        if (fileInp) {
          fileInp.click();
        }
      });
    });

    // Clicking "+ URL" opens the Add Images modal on the URLs tab for pasting URLs
    previewTbody.querySelectorAll('.btn-open-url-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.stgIdx, 10);
        openAddImagesModal(idx);
        switchAddGalleryTab('urls');
      });
    });

    // Handle per-row file selection
    previewTbody.querySelectorAll('.stg-file-input').forEach(inp => {
      inp.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        syncStagingRowInputs();

        const prod = stagedProducts[idx];
        if (!prod) return;
        if (!Array.isArray(prod.images)) prod.images = [];

        const readPromises = files.map(file => {
          return new Promise((resolve) => {
            const ext = (file.name || '').split('.').pop().toLowerCase();
            const isImg = (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(ext);
            if (!isImg) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
        });

        const results = await Promise.all(readPromises);
        let addedCount = 0;
        let detectedCodesCount = 0;

        results.forEach(dataUrl => {
          if (dataUrl && !prod.images.includes(dataUrl)) {
            prod.images.push(dataUrl);
            addedCount++;
            if (window.SarojiniWatermark) {
              const d = window.SarojiniWatermark.detectSupplierCode(dataUrl);
              if (d && d.detected && d.code) {
                detectedCodesCount++;
                if (!prod.detected_code) prod.detected_code = d.code;
              }
            }
          }
        });

        // Clear input value so selecting the same file again later still triggers change
        e.target.value = '';

        // Re-evaluate Ready status
        const hasPrice = prod.price !== null && Number(prod.price) > 0;
        const hasImages = prod.images.length > 0;
        if (hasPrice && hasImages && !prod.is_duplicate) {
          prod.status = 'Ready';
          prod.selected = true;
        } else if (!hasImages) {
          prod.status = 'Images missing — please add';
          prod.selected = false;
        } else {
          prod.status = 'Price missing — please enter';
        }

        renderStagingTable();
        window.showToast?.(`Added ${addedCount} image(s) to product.${detectedCodesCount > 0 ? ' Supplier code flagged for watermark.' : ''}`, 'success');
      });
    });

    // Toggle Specifications Accordion
    previewTbody.querySelectorAll('.stg-specs-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stgIdx, 10);
        if (stagedProducts[idx]) {
          stagedProducts[idx].show_specs = !stagedProducts[idx].show_specs;
          const box = document.getElementById(`specs-box-${idx}`);
          if (box) {
            box.style.display = stagedProducts[idx].show_specs ? 'block' : 'none';
          }
          btn.innerHTML = `<i class="fas fa-chevron-${stagedProducts[idx].show_specs ? 'up' : 'down'}"></i> <span>${stagedProducts[idx].show_specs ? '▲ Hide Product Specifications' : '▼ Product Specifications'}</span>`;
        }
      });
    });

    // Standard Specifications input changes
    previewTbody.querySelectorAll('.stg-spec-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.stgIdx, 10);
        const key = e.target.dataset.specKey;
        if (stagedProducts[idx] && stagedProducts[idx].specs) {
          stagedProducts[idx].specs[key] = e.target.value;
        }
      });
    });

    // Add Custom Specification row button
    previewTbody.querySelectorAll('.btn-add-custom-spec').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stgIdx, 10);
        if (stagedProducts[idx] && stagedProducts[idx].specs) {
          if (!Array.isArray(stagedProducts[idx].specs.custom)) stagedProducts[idx].specs.custom = [];
          stagedProducts[idx].specs.custom.push({ name: '', value: '' });
          renderStagingTable();
        }
      });
    });

    // Custom Spec Name input
    previewTbody.querySelectorAll('.stg-custom-name').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const stgIdx = parseInt(e.target.dataset.stgIdx, 10);
        const customIdx = parseInt(e.target.dataset.customIdx, 10);
        if (stagedProducts[stgIdx]?.specs?.custom?.[customIdx]) {
          stagedProducts[stgIdx].specs.custom[customIdx].name = e.target.value;
        }
      });
    });

    // Custom Spec Value input
    previewTbody.querySelectorAll('.stg-custom-val').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const stgIdx = parseInt(e.target.dataset.stgIdx, 10);
        const customIdx = parseInt(e.target.dataset.customIdx, 10);
        if (stagedProducts[stgIdx]?.specs?.custom?.[customIdx]) {
          stagedProducts[stgIdx].specs.custom[customIdx].value = e.target.value;
        }
      });
    });

    // Remove Custom Spec row
    previewTbody.querySelectorAll('.btn-remove-custom-spec').forEach(btn => {
      btn.addEventListener('click', () => {
        const stgIdx = parseInt(btn.dataset.stgIdx, 10);
        const customIdx = parseInt(btn.dataset.customIdx, 10);
        if (stagedProducts[stgIdx]?.specs?.custom) {
          stagedProducts[stgIdx].specs.custom.splice(customIdx, 1);
          renderStagingTable();
        }
      });
    });
  }

  // ==========================================================================
  // GALLERY MANAGEMENT & REORDERING
  // ==========================================================================
  function setAsMainImage(stgIdx, imgIdx) {
    const prod = stagedProducts[stgIdx];
    if (!prod || !prod.images || imgIdx < 0 || imgIdx >= prod.images.length) return;
    const [moved] = prod.images.splice(imgIdx, 1);
    prod.images.unshift(moved);
    renderStagingTable();
    window.showToast?.('Image set as MAIN', 'info');
  }

  function moveGalleryImage(stgIdx, imgIdx, direction) {
    const prod = stagedProducts[stgIdx];
    if (!prod || !prod.images) return;
    const targetIdx = imgIdx + direction;
    if (targetIdx < 0 || targetIdx >= prod.images.length) return;
    const temp = prod.images[imgIdx];
    prod.images[imgIdx] = prod.images[targetIdx];
    prod.images[targetIdx] = temp;
    renderStagingTable();
  }

  function removeGalleryImage(stgIdx, imgIdx) {
    const prod = stagedProducts[stgIdx];
    if (!prod || !prod.images) return;
    prod.images.splice(imgIdx, 1);
    if (prod.images.length === 0) {
      prod.status = 'Images missing — please add';
      prod.selected = false;
    }
    renderStagingTable();
  }

  // ==========================================================================
  // ADD GALLERY IMAGES MODAL (UPLOAD PC + PASTE URLS)
  // ==========================================================================
  function openAddImagesModal(stgIdx) {
    activeAddGalleryStagedIdx = stgIdx;
    const prod = stagedProducts[stgIdx];
    if (!prod || !addGalleryModalEl) return;

    if (addGalleryModalTitle) {
      addGalleryModalTitle.textContent = `Add Gallery Images — ${prod.name}`;
    }

    pendingUploadedFiles = [];
    if (uploadPreviewsContainer) uploadPreviewsContainer.innerHTML = '';
    if (textareaAddGalleryUrls) textareaAddGalleryUrls.value = '';
    if (inputUploadGalleryFiles) inputUploadGalleryFiles.value = '';

    switchAddGalleryTab('upload');
    addGalleryModalEl.style.display = 'flex';
  }

  function closeAddGalleryModal() {
    if (addGalleryModalEl) addGalleryModalEl.style.display = 'none';
    pendingUploadedFiles = [];
    activeAddGalleryStagedIdx = null;
  }

  function switchAddGalleryTab(tab) {
    if (tab === 'upload') {
      if (tabAddUploadBtn) {
        tabAddUploadBtn.classList.add('active');
        tabAddUploadBtn.style.background = '#e11d48';
        tabAddUploadBtn.style.borderColor = '#e11d48';
        tabAddUploadBtn.style.color = '#fff';
      }
      if (tabAddUrlsBtn) {
        tabAddUrlsBtn.classList.remove('active');
        tabAddUrlsBtn.style.background = 'transparent';
        tabAddUrlsBtn.style.borderColor = 'var(--admin-card-border)';
        tabAddUrlsBtn.style.color = 'var(--admin-text-muted)';
      }
      if (paneAddUpload) paneAddUpload.style.display = 'block';
      if (paneAddUrls) paneAddUrls.style.display = 'none';
    } else {
      if (tabAddUrlsBtn) {
        tabAddUrlsBtn.classList.add('active');
        tabAddUrlsBtn.style.background = '#e11d48';
        tabAddUrlsBtn.style.borderColor = '#e11d48';
        tabAddUrlsBtn.style.color = '#fff';
      }
      if (tabAddUploadBtn) {
        tabAddUploadBtn.classList.remove('active');
        tabAddUploadBtn.style.background = 'transparent';
        tabAddUploadBtn.style.borderColor = 'var(--admin-card-border)';
        tabAddUploadBtn.style.color = 'var(--admin-text-muted)';
      }
      if (paneAddUpload) paneAddUpload.style.display = 'none';
      if (paneAddUrls) paneAddUrls.style.display = 'block';
    }
  }

  function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        pendingUploadedFiles.push({ name: file.name, dataUrl });
        renderUploadPreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderUploadPreviews() {
    if (!uploadPreviewsContainer) return;
    uploadPreviewsContainer.innerHTML = pendingUploadedFiles.map((item, idx) => `
      <div style="position: relative; width: 68px; height: 68px; border-radius: 6px; overflow: hidden; background: #18181b; border: 1px solid rgba(255,255,255,0.15);">
        <img src="${item.dataUrl}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;">
        <button type="button" class="btn-remove-pending-file" data-file-idx="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.85); color: #fff; border: none; width: 18px; height: 18px; border-radius: 50%; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
    `).join('');

    uploadPreviewsContainer.querySelectorAll('.btn-remove-pending-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fileIdx, 10);
        pendingUploadedFiles.splice(idx, 1);
        renderUploadPreviews();
      });
    });
  }

  function confirmAddImagesToProduct() {
    if (activeAddGalleryStagedIdx === null) return;
    const prod = stagedProducts[activeAddGalleryStagedIdx];
    if (!prod) return;

    if (!Array.isArray(prod.images)) prod.images = [];
    const addedImages = [];

    const isUploadTab = paneAddUpload && paneAddUpload.style.display !== 'none';

    if (isUploadTab) {
      if (pendingUploadedFiles.length === 0) {
        alert('Please choose or drag at least one image file from your PC.');
        return;
      }
      pendingUploadedFiles.forEach(f => {
        addedImages.push(f.dataUrl);
      });
    } else {
      const urlsText = textareaAddGalleryUrls ? textareaAddGalleryUrls.value.trim() : '';
      if (!urlsText) {
        alert('Please paste at least one image URL.');
        return;
      }
      const rawUrls = urlsText.split(/[\r\n|,;]+/).map(u => u.trim()).filter(Boolean);
      rawUrls.forEach(raw => {
        let u = raw;
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          u = 'https://' + u;
        }
        if (u.includes('images.meesho.com')) {
          u = u.replace(/_[0-9]+\.(avif|webp|jpeg|png)$/i, '_1024.jpg');
        }
        addedImages.push(u);
      });
    }

    if (addedImages.length === 0) {
      alert('No valid images to add.');
      return;
    }

    // Process universal watermark detection on every image added
    let detectedCodesCount = 0;
    addedImages.forEach(img => {
      if (!prod.images.includes(img)) {
        prod.images.push(img);
        if (window.SarojiniWatermark) {
          const d = window.SarojiniWatermark.detectSupplierCode(img);
          if (d && d.detected && d.code) {
            detectedCodesCount++;
            if (!prod.detected_code) prod.detected_code = d.code;
          }
        }
      }
    });

    // Re-evaluate Ready status
    const hasPrice = prod.price !== null && Number(prod.price) > 0;
    const hasImages = prod.images.length > 0;
    if (hasPrice && hasImages && !prod.is_duplicate) {
      prod.status = 'Ready';
      prod.selected = true;
    } else if (!hasPrice) {
      prod.status = 'Price missing — please enter';
    }

    closeAddGalleryModal();
    renderStagingTable();
    window.showToast?.(`Added ${addedImages.length} image(s) to product.${detectedCodesCount > 0 ? ' Supplier code covered.' : ''}`, 'success');
  }

  // ==========================================================================
  // LIGHTBOX MODAL CONTROLLER
  // ==========================================================================
  function openImageLightbox(imgUrl, prodName, imgIdx) {
    if (!lightboxModalEl || !lightboxImg) return;
    lightboxImg.src = imgUrl;

    const codeDet = window.SarojiniWatermark ? window.SarojiniWatermark.detectSupplierCode(imgUrl) : { detected: false };
    if (lightboxWatermarkBadge) {
      lightboxWatermarkBadge.style.display = codeDet.detected ? 'block' : 'none';
      if (codeDet.detected) {
        lightboxWatermarkBadge.innerHTML = `● VADI STORE Watermark Applied (${escapeHtml(codeDet.code || 'Supplier Code')})`;
      }
    }

    if (lightboxCaption) {
      lightboxCaption.innerHTML = `<strong>${escapeHtml(prodName || 'Product')}</strong> — Image ${imgIdx + 1}`;
    }

    lightboxModalEl.style.display = 'flex';
  }

  function closeImageLightbox() {
    if (lightboxModalEl) lightboxModalEl.style.display = 'none';
    if (lightboxImg) lightboxImg.src = '';
  }

  // ==========================================================================
  // GALLERY VIEWER MODAL CONTROLLER (LEGACY BACKWARDS COMPATIBILITY)
  // ==========================================================================
  function openGalleryViewer(stgIdx) {
    openAddImagesModal(stgIdx);
  }

  function closeGalleryViewer() {
    closeAddGalleryModal();
  }

  function renderGalleryGrid() {
    // Legacy stub
  }

  function handleAddImageToGallery() {
    // Legacy stub
  }

  function updateStagingStats() {
    if (!previewStatsBar) return;
    const total = stagedProducts.length;
    const ready = stagedProducts.filter(p => p.price > 0 && p.images && p.images.length > 0 && !p.is_duplicate).length;
    const dupes = stagedProducts.filter(p => p.is_duplicate).length;
    const missing = total - ready - dupes;

    previewStatsBar.innerHTML = `
      <span class="badge badge-success" style="font-size: 0.8rem; padding: 4px 10px;">✓ ${ready} Ready</span>
      ${missing > 0 ? `<span class="badge badge-danger" style="font-size: 0.8rem; padding: 4px 10px;">⚠ ${missing} Incomplete</span>` : ''}
      ${dupes > 0 ? `<span class="badge badge-warning" style="font-size: 0.8rem; padding: 4px 10px;">✕ ${dupes} Duplicates</span>` : ''}
    `;

    updateImportSelectedButton();
  }

  function updateImportSelectedButton() {
    if (!btnImportSelected) return;
    const selectedCount = stagedProducts.filter(p => p.selected && !p.is_duplicate && p.price > 0 && p.images && p.images.length > 0).length;
    btnImportSelected.innerHTML = `<i class="fas fa-file-import"></i> Import Selected (${selectedCount}) as Drafts`;
    btnImportSelected.disabled = selectedCount === 0;
  }

  function applyGlobalSettingsToStaging() {
    const dept = globalDeptSelect ? globalDeptSelect.value : '';
    const catId = globalCatSelect ? globalCatSelect.value : '';
    const isAdv = globalAdvToggle ? globalAdvToggle.checked : true;
    const advType = globalAdvType ? globalAdvType.value : 'fixed';
    const advVal = globalAdvVal ? parseFloat(globalAdvVal.value) || 0 : 0;

    let appliedCount = 0;
    stagedProducts.forEach(p => {
      if (dept) {
        p.department = dept;
        p.category_id = catId || null;
      }
      p.advance_payment_enabled = isAdv;
      p.advance_payment_type = advType;
      p.advance_payment_value = advVal;
      appliedCount++;
    });

    renderStagingTable();
    window.showToast?.(`Applied global settings to ${appliedCount} staged products.`, 'success');
  }

  // ==========================================================================
  // CONTROLLED BATCH INSERTION (STRICT DRAFTS ONLY)
  // ==========================================================================
  async function executeBatchImport() {
    syncStagingRowInputs();
    // CRITICAL: Strictly filter out any items missing valid price (>0) or missing images
    const toImport = stagedProducts.filter(p => p.selected && !p.is_duplicate && p.price > 0 && p.images && p.images.length > 0);

    if (toImport.length === 0) {
      alert('No valid products selected to import.\n\nPlease ensure selected products have a valid selling price (> 0) and at least one gallery image.');
      return;
    }

    const client = window.AdminAuth?.getClient() || window.supabaseClient;
    if (!client) {
      alert('Supabase client not initialized. Please log in again.');
      return;
    }

    // Switch to progress view
    previewSection.style.display = 'none';
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';

    failedItems = [];
    let successfulCount = 0;
    const totalCount = toImport.length;
    const BATCH_SIZE = 5;

    for (let i = 0; i < totalCount; i += BATCH_SIZE) {
      const chunk = toImport.slice(i, i + BATCH_SIZE);
      const currentBatchIdx = Math.min(i + BATCH_SIZE, totalCount);

      // Update progress bar
      const pct = Math.round((currentBatchIdx / totalCount) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `Importing ${currentBatchIdx} of ${totalCount} products... (${pct}%)`;
      if (progressStats) {
        progressStats.innerHTML = `
          <span style="color: #10b981;">✓ ${successfulCount} imported</span>
          ${failedItems.length > 0 ? `<span style="color: #ef4444; margin-left: 12px;">⚠ ${failedItems.length} failed</span>` : ''}
        `;
      }

      // Prepare payloads: STRICTLY REAL DATA, ZERO FABRICATIONS
      const payloads = chunk.map(p => {
        const cleanSlug = (p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7)).replace(/^-+|-+$/g, '');
        const orig = (p.original_price && p.original_price >= p.price) ? p.original_price : p.price;
        const discountPct = orig > p.price ? Math.round(((orig - p.price) / orig) * 100) : 0;

        // Process supplier codes for EVERY image in gallery
        const detectedCodes = [];
        (p.images || []).forEach(imgUrl => {
          if (window.SarojiniWatermark) {
            const d = window.SarojiniWatermark.detectSupplierCode(imgUrl);
            if (d && d.detected && d.code && !detectedCodes.includes(d.code)) {
              detectedCodes.push(d.code);
            }
          }
        });

        const specPayload = {
          source_url: p.source_url || null,
          detected_code: detectedCodes[0] || p.detected_code || null,
          detected_codes: detectedCodes,
          original_images: p.images,
          imported_at: new Date().toISOString()
        };

        if (p.specs) {
          ['material', 'fabric', 'fit', 'pattern', 'neck', 'sleeve', 'gender', 'country_of_origin', 'care_instructions', 'brand'].forEach(k => {
            if (p.specs[k] && typeof p.specs[k] === 'string' && p.specs[k].trim()) {
              specPayload[k] = p.specs[k].trim();
            }
          });

          if (Array.isArray(p.specs.custom)) {
            p.specs.custom.forEach(item => {
              if (item && item.name && item.name.trim() && item.value && item.value.trim()) {
                specPayload[item.name.trim()] = item.value.trim();
              }
            });
          }
        }

        return {
          name: p.name.trim(),
          brand: (p.specs && p.specs.brand && p.specs.brand.trim()) || 'Sarojini Bazaar',
          slug: cleanSlug,
          description: p.description ? p.description.trim() : null,
          price: Number(p.price) || 0,
          original_price: Number(orig) || Number(p.price),
          discount_percentage: discountPct,
          stock: parseInt(p.stock, 10) || 20,
          department: (p.department || 'WOMEN').toUpperCase(),
          category_id: p.category_id || null,
          images: p.images, // REAL IMAGES ONLY - NO PLACEHOLDER
          sizes: p.sizes && p.sizes.length > 0 ? p.sizes : [], // REAL SIZES ONLY
          colors: p.colors || [],
          specifications: specPayload,
          return_policy: '7-Day Easy Returns',
          is_active: false, // CRITICAL: Always imported as DRAFT (Inactive)
          is_featured: false,
          is_deal: discountPct >= 50,
          is_new: true,
          advance_payment_enabled: Boolean(p.advance_payment_enabled),
          advance_payment_type: p.advance_payment_type || 'fixed',
          advance_payment_value: Number(p.advance_payment_value) || 0,
          updated_at: new Date().toISOString()
        };
      });

      try {
        const { data, error } = await client
          .from('sarojini_products')
          .insert(payloads)
          .select('id, name');

        if (error) {
          throw error;
        }

        successfulCount += (data ? data.length : payloads.length);
      } catch (err) {
        console.error('[BulkImport] Batch failed:', err);
        chunk.forEach(failedItem => {
          failedItems.push({
            item: failedItem,
            reason: err.message || String(err)
          });
        });
      }

      // Micro-pause to prevent connection spike
      await new Promise(res => setTimeout(res, 120));
    }

    // Invalidate caches
    try {
      sessionStorage.removeItem('velora_sarojini_catalog_cache_v1');
      localStorage.removeItem('velora_sarojini_catalog_cache_v1');
      localStorage.setItem('sarojini_global_cache_invalidated', Date.now().toString());
    } catch (_) {}

    // Complete view
    progressSection.style.display = 'none';
    resultSection.style.display = 'block';

    if (resultSummary) {
      resultSummary.innerHTML = `
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
        <h3 style="margin: 0 0 6px 0; color: #fff;">Import Completed</h3>
        <p style="margin: 0; font-size: 0.95rem; color: var(--admin-text-muted);">
          <strong style="color: #10b981;">${successfulCount}</strong> products imported as <strong>Drafts (Inactive)</strong>.
          ${failedItems.length > 0 ? `<br><strong style="color: #ef4444;">${failedItems.length}</strong> items failed to insert.` : ''}
        </p>
      `;
    }

    if (failedItems.length > 0 && resultFailuresList) {
      resultFailuresList.style.display = 'block';
      resultFailuresList.innerHTML = `
        <h4 style="color: #ef4444; margin-bottom: 8px;"><i class="fas fa-exclamation-triangle"></i> Failed Products:</h4>
        <div style="max-height: 180px; overflow-y: auto;">
          ${failedItems.map(f => `
            <div style="font-size: 0.8rem; margin-bottom: 6px; padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
              <strong>${escapeHtml(f.item.name)}:</strong> <span style="color: #fca5a5;">${escapeHtml(f.reason)}</span>
            </div>
          `).join('')}
        </div>
      `;
      if (btnRetryFailed) btnRetryFailed.style.display = 'inline-flex';
    } else {
      if (resultFailuresList) resultFailuresList.style.display = 'none';
      if (btnRetryFailed) btnRetryFailed.style.display = 'none';
    }
  }

  async function retryFailedImport() {
    if (failedItems.length === 0) return;
    stagedProducts = failedItems.map(f => f.item);
    renderStagingTable();
    resultSection.style.display = 'none';
    previewSection.style.display = 'block';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Export engine
  window.SarojiniBulkImport = {
    init: initBulkImport,
    openModal: openBulkModal,
    closeModal: closeBulkModal,
    parseAndFetchSingleUrl,
    autoSuggestDepartmentAndCategory,
    parseCsvTokens,
    openGalleryViewer
  };

  document.addEventListener('DOMContentLoaded', initBulkImport);
})();
