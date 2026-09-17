/**
 * VELORA - Mobile-Only App Interaction Engine
 * 
 * STRICT DESKTOP PROTECTION:
 * Features in this script only initialize and run when viewport is phone-width (<= 767px).
 * On desktop (>= 768px), it does nothing, leaving desktop behavior 100% unchanged.
 */

(function () {
  'use strict';

  function isMobile() {
    return window.innerWidth <= 767;
  }

  // ==========================================================================
  // 1. MOBILE BOTTOM-SHEET FILTER FOR SHOP PAGE
  // ==========================================================================
  function initMobileFilterBottomSheet() {
    const filterBtn = document.getElementById("btn-mobile-filter");
    const sidebar = document.getElementById("shop-filter-sidebar") || document.querySelector(".shop-sidebar") || document.querySelector(".shop-filter-sidebar");
    if (!filterBtn || !sidebar) return;

    // Create backdrop if not already existing
    let backdrop = document.getElementById("mobile-filter-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "mobile-filter-backdrop";
      backdrop.className = "mobile-filter-backdrop";
      document.body.appendChild(backdrop);
    }

    // Add Close button to sidebar header on mobile if missing
    let closeBtn = sidebar.querySelector(".btn-close-filter-sheet");
    if (!closeBtn) {
      const header = sidebar.querySelector(".sidebar-header") || sidebar;
      closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-close-filter-sheet";
      closeBtn.innerHTML = "✕";
      closeBtn.setAttribute("aria-label", "Close Filters");
      closeBtn.style.cssText = "background: transparent; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer; padding: 4px 8px; margin-left: auto;";
      header.appendChild(closeBtn);
    }

    // Add sticky "Apply Filters" bar inside mobile bottom sheet if missing
    let applyBar = sidebar.querySelector(".mobile-filter-apply-bar");
    if (!applyBar) {
      applyBar = document.createElement("div");
      applyBar.className = "mobile-filter-apply-bar";
      applyBar.style.cssText = "position: sticky; bottom: 0; left: 0; right: 0; background: #ffffff; padding: 12px 0 6px 0; border-top: 1px solid #f1f5f9; display: flex; gap: 10px; z-index: 10;";
      applyBar.innerHTML = `
        <button type="button" class="clear-all-filters-action" style="flex: 1; height: 42px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.85rem; color: #334155; cursor: pointer;">
          Reset
        </button>
        <button type="button" id="btn-apply-filters-sheet" style="flex: 1.5; height: 42px; border-radius: 10px; background: #0f172a; border: none; font-weight: 800; font-size: 0.88rem; color: #ffffff; cursor: pointer;">
          View Results
        </button>
      `;
      sidebar.appendChild(applyBar);
    }

    function openFilterSheet() {
      if (!isMobile()) return;
      sidebar.classList.add("active");
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeFilterSheet() {
      sidebar.classList.remove("active");
      backdrop.classList.remove("active");
      document.body.style.overflow = "";
    }

    filterBtn.addEventListener("click", openFilterSheet);
    backdrop.addEventListener("click", closeFilterSheet);
    closeBtn.addEventListener("click", closeFilterSheet);

    const applyBtn = document.getElementById("btn-apply-filters-sheet");
    if (applyBtn) {
      applyBtn.addEventListener("click", closeFilterSheet);
    }
  }

  // ==========================================================================
  // 2. MOBILE BOTTOM-SHEET SORT FOR SHOP PAGE
  // ==========================================================================
  function initMobileSortBottomSheet() {
    const sortDropdown = document.getElementById("sort-dropdown");
    if (!sortDropdown) return;

    // Look for or create mobile sort trigger button in toolbar
    const toolbarLeft = document.querySelector(".shop-toolbar .toolbar-left");
    let sortBtn = document.getElementById("btn-mobile-sort");

    if (!sortBtn && toolbarLeft) {
      sortBtn = document.createElement("button");
      sortBtn.id = "btn-mobile-sort";
      sortBtn.type = "button";
      sortBtn.className = "btn-mobile-sort";
      sortBtn.setAttribute("aria-label", "Sort Options");
      sortBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12m-9 6h6"/></svg>
        <span>Sort: <strong id="mobile-current-sort-label">Featured</strong></span>
      `;
      const filterBtn = document.getElementById("btn-mobile-filter");
      if (filterBtn && filterBtn.nextSibling) {
        toolbarLeft.insertBefore(sortBtn, filterBtn.nextSibling);
      } else {
        toolbarLeft.appendChild(sortBtn);
      }
    }

    if (!sortBtn) return;

    // Create sort backdrop
    let sortBackdrop = document.getElementById("mobile-sort-backdrop");
    if (!sortBackdrop) {
      sortBackdrop = document.createElement("div");
      sortBackdrop.id = "mobile-sort-backdrop";
      sortBackdrop.className = "mobile-sort-backdrop";
      document.body.appendChild(sortBackdrop);
    }

    // Create sort sheet
    let sortSheet = document.getElementById("mobile-sort-sheet");
    if (!sortSheet) {
      sortSheet = document.createElement("div");
      sortSheet.id = "mobile-sort-sheet";
      sortSheet.className = "mobile-sort-sheet";
      sortSheet.innerHTML = `
        <div class="sort-sheet-header">
          <h4 class="sort-sheet-title">Sort Products By</h4>
          <button type="button" id="btn-close-sort-sheet" style="background:transparent; border:none; font-size:1.2rem; color:#64748b; cursor:pointer;">✕</button>
        </div>
        <div class="sort-options-list">
          <div class="sort-option-item selected" data-sort-val="featured">
            <span>Featured</span>
            <span class="sort-check">✓</span>
          </div>
          <div class="sort-option-item" data-sort-val="newest">
            <span>Newest Arrivals</span>
            <span class="sort-check">✓</span>
          </div>
          <div class="sort-option-item" data-sort-val="price-low">
            <span>Price: Low to High</span>
            <span class="sort-check">✓</span>
          </div>
          <div class="sort-option-item" data-sort-val="price-high">
            <span>Price: High to Low</span>
            <span class="sort-check">✓</span>
          </div>
          <div class="sort-option-item" data-sort-val="rating">
            <span>Highest Rated</span>
            <span class="sort-check">✓</span>
          </div>
          <div class="sort-option-item" data-sort-val="discount">
            <span>Biggest Discount</span>
            <span class="sort-check">✓</span>
          </div>
        </div>
      `;
      document.body.appendChild(sortSheet);
    }

    function openSortSheet() {
      if (!isMobile()) return;
      sortSheet.classList.add("active");
      sortBackdrop.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeSortSheet() {
      sortSheet.classList.remove("active");
      sortBackdrop.classList.remove("active");
      document.body.style.overflow = "";
    }

    sortBtn.addEventListener("click", openSortSheet);
    sortBackdrop.addEventListener("click", closeSortSheet);

    const closeBtn = document.getElementById("btn-close-sort-sheet");
    if (closeBtn) closeBtn.addEventListener("click", closeSortSheet);

    const sortItems = sortSheet.querySelectorAll(".sort-option-item");
    sortItems.forEach(item => {
      item.addEventListener("click", () => {
        const val = item.getAttribute("data-sort-val");
        sortItems.forEach(i => i.classList.remove("selected"));
        item.classList.add("selected");

        const labelElem = document.getElementById("mobile-current-sort-label");
        if (labelElem) {
          labelElem.textContent = item.querySelector("span").textContent.trim();
        }

        if (sortDropdown) {
          sortDropdown.value = val;
          sortDropdown.dispatchEvent(new Event("change", { bubbles: true }));
        }

        closeSortSheet();
      });
    });
  }

  // ==========================================================================
  // 3. COMPACT MOBILE ACCORDION FOOTER
  // ==========================================================================
  function initMobileFooterAccordions() {
    const titles = document.querySelectorAll(".footer-col-title, .footer-links-col h4");
    titles.forEach(title => {
      const col = title.closest(".footer-links-col");
      if (!col) return;

      title.addEventListener("click", (e) => {
        if (!isMobile()) return;
        e.preventDefault();
        const isOpen = col.classList.contains("open");
        
        // Optional: close other columns for single-open accordion
        document.querySelectorAll(".footer-links-col.open").forEach(c => {
          if (c !== col) c.classList.remove("open");
        });

        col.classList.toggle("open", !isOpen);
      });
    });
  }

  // ==========================================================================
  // 4. STICKY BOTTOM PURCHASE BAR FOR PRODUCT DETAILS (product.html)
  // ==========================================================================
  function initMobileStickyPurchaseBar() {
    const mainView = document.getElementById("product-main-view");
    const detailAddBtn = document.getElementById("btn-detail-add-cart");
    const detailBuyBtn = document.getElementById("btn-detail-buy-now");
    if (!mainView || !detailAddBtn) return;

    let stickyBar = document.querySelector(".mobile-sticky-purchase-bar");
    if (!stickyBar) {
      stickyBar = document.createElement("div");
      stickyBar.className = "mobile-sticky-purchase-bar";
      stickyBar.innerHTML = `
        <button type="button" class="btn-sticky-cart" id="btn-sticky-cart" aria-label="Add to Cart">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <span class="btn-text">Add to Cart</span>
        </button>
        <button type="button" class="btn-sticky-buy" id="btn-sticky-buy" aria-label="Buy Now">
          <span id="sticky-buy-text">Buy Now ⚡</span>
        </button>
      `;
      document.body.appendChild(stickyBar);

      const stickyCartBtn = document.getElementById("btn-sticky-cart");
      const stickyBuyBtn = document.getElementById("btn-sticky-buy");
      const stickyBuyText = document.getElementById("sticky-buy-text");

      const priceElem = document.getElementById("detail-price-main") || document.querySelector(".detail-price-main");
      if (priceElem && stickyBuyText) {
        const updatePriceText = () => {
          const pText = priceElem.textContent.trim();
          if (pText) stickyBuyText.textContent = `Buy Now • ${pText}`;
        };
        updatePriceText();
        const observer = new MutationObserver(updatePriceText);
        observer.observe(priceElem, { childList: true, characterData: true, subtree: true });
      }

      if (stickyCartBtn) {
        stickyCartBtn.addEventListener("click", () => {
          detailAddBtn.click();
          stickyCartBtn.innerHTML = `<span>✓ Added</span>`;
          setTimeout(() => {
            stickyCartBtn.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span class="btn-text">Add to Cart</span>
            `;
          }, 2000);
        });
      }

      if (stickyBuyBtn && detailBuyBtn) {
        stickyBuyBtn.addEventListener("click", () => {
          detailBuyBtn.click();
        });
      }
    }

    // Touch Swipe Gallery on Mobile for Product Images
    const mainImgDisplay = document.querySelector(".main-image-display");
    if (mainImgDisplay) {
      let touchStartX = 0;
      let touchEndX = 0;

      mainImgDisplay.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      mainImgDisplay.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
          const thumbs = Array.from(document.querySelectorAll("#thumbnails-strip .thumbnail-item, .thumbnails-strip .thumb-btn"));
          if (thumbs.length > 1) {
            const activeIdx = thumbs.findIndex(t => t.classList.contains("active"));
            if (diff < 0 && activeIdx < thumbs.length - 1) {
              thumbs[activeIdx + 1].click();
            } else if (diff > 0 && activeIdx > 0) {
              thumbs[activeIdx - 1].click();
            }
          }
        }
      }, { passive: true });
    }
  }

  // ==========================================================================
  // 5. APP-STYLE QUICK SEARCH HANDLER
  // ==========================================================================
  function initMobileHeaderQuickSearch() {
    const quickInput = document.getElementById("mobile-home-search-input");
    if (quickInput) {
      quickInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const q = quickInput.value.trim();
          if (q) {
            window.location.href = `shop.html?search=${encodeURIComponent(q)}`;
          }
        }
      });
    }
  }

  // ==========================================================================
  // 6. DEDICATED MOBILE HEADER SEARCH ACTION BUTTON
  // ==========================================================================
  function initMobileHeaderSearchBtn() {
    const navActions = document.querySelector(".nav-actions");
    if (!navActions) return;

    let searchBtn = navActions.querySelector(".mobile-search-btn");
    if (!searchBtn) {
      searchBtn = document.createElement("button");
      searchBtn.type = "button";
      searchBtn.className = "action-btn mobile-search-btn";
      searchBtn.setAttribute("aria-label", "Search");
      searchBtn.setAttribute("title", "Search Products");
      searchBtn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      `;

      const wishlistBtn = navActions.querySelector(".wishlist-drawer-trigger");
      if (wishlistBtn) {
        navActions.insertBefore(searchBtn, wishlistBtn);
      } else {
        navActions.prepend(searchBtn);
      }
    }

    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const quickRow = document.querySelector(".mobile-search-bar-row");
      const quickInput = document.getElementById("mobile-home-search-input");
      if (quickRow && quickInput) {
        quickInput.focus();
        quickInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        const toggleBtn = document.getElementById("mobile-toggle-btn");
        if (toggleBtn) {
          toggleBtn.click();
          setTimeout(() => {
            const drawerInput = document.getElementById("mobile-search-input");
            if (drawerInput) drawerInput.focus();
          }, 300);
        } else {
          window.location.href = "shop.html";
        }
      }
    });
  }

  // ==========================================================================
  // 7. MOBILE DRAWER USER PROFILE CARD (OPTION A - PREFERRED)
  // ==========================================================================
  function updateMobileDrawerUser() {
    const drawerContent = document.querySelector(".mobile-drawer-content");
    if (!drawerContent) return;

    let userContainer = drawerContent.querySelector(".mobile-drawer-user-container");
    if (!userContainer) {
      userContainer = document.createElement("div");
      userContainer.className = "mobile-drawer-user-container";
      const drawerHeader = drawerContent.querySelector(".mobile-drawer-header");
      if (drawerHeader && drawerHeader.nextSibling) {
        drawerContent.insertBefore(userContainer, drawerHeader.nextSibling);
      } else {
        drawerContent.prepend(userContainer);
      }
    }

    const currentUser = window.VeloraAuth && typeof window.VeloraAuth.getCurrentUser === "function"
      ? window.VeloraAuth.getCurrentUser()
      : null;

    if (currentUser) {
      const initials = currentUser.name
        ? currentUser.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
        : "ME";
      const fullName = currentUser.name || "Member";
      const email = currentUser.email || "";

      userContainer.innerHTML = `
        <div class="mobile-drawer-profile-card">
          <div class="drawer-avatar-circle">${initials}</div>
          <div class="drawer-user-meta">
            <div class="drawer-user-greeting">Welcome back,</div>
            <div class="drawer-user-name">${fullName}</div>
            <div class="drawer-user-email">${email}</div>
          </div>
        </div>
        <div class="drawer-quick-links">
          <a href="account.html" class="drawer-quick-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            My Profile
          </a>
          <a href="account.html#orders" class="drawer-quick-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            My Orders
          </a>
        </div>
      `;
    } else {
      userContainer.innerHTML = `
        <div class="mobile-drawer-auth-cta">
          <div class="drawer-auth-text">Sign in to track orders & view wishlist</div>
          <div class="drawer-auth-btns">
            <a href="login.html" class="drawer-auth-btn primary">Sign In</a>
            <a href="signup.html" class="drawer-auth-btn secondary">Register</a>
          </div>
        </div>
      `;
    }
  }

  function hookAuthUpdates() {
    if (window.VeloraAuth && typeof window.VeloraAuth.updateNavbarAuth === "function") {
      const originalUpdate = window.VeloraAuth.updateNavbarAuth;
      window.VeloraAuth.updateNavbarAuth = function () {
        originalUpdate.apply(this, arguments);
        updateMobileDrawerUser();
      };
    }
  }

  // ==========================================================================
  // 8. MOBILE DRAWER TOGGLE BINDING
  // ==========================================================================
  function initMobileDrawer() {
    const toggleBtn = document.getElementById("mobile-toggle-btn");
    const drawer = document.getElementById("mobile-drawer");
    const closeBtn = document.getElementById("mobile-drawer-close");
    const backdrop = document.getElementById("mobile-drawer-backdrop");

    if (!toggleBtn || !drawer) return;

    function openDrawer() {
      updateMobileDrawerUser();
      drawer.classList.add("active");
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      drawer.classList.remove("active");
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }

    toggleBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);
  }

  // ==========================================================================
  // 9. SMOOTH MOBILE SCROLL ENTRANCE OBSERVER
  // ==========================================================================
  function initMobileScrollEntrance() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = document.querySelectorAll(".product-card, .category-card, .benefit-card-3d, .advertisement-card");
    if (!cards.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("mobile-in-view");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -20px 0px" });

    cards.forEach(c => {
      c.classList.add("mobile-fade-up");
      observer.observe(c);
    });
  }

  // ==========================================================================
  // 10. MOBILE ACCOUNT TABS HANDLER (Guaranteed instant switching)
  // ==========================================================================
  function initMobileAccountTabs() {
    const tabBtns = document.querySelectorAll(".account-tab-btn[data-tab]");
    if (!tabBtns.length) return;

    const panels = {
      profile: document.getElementById("panel-profile"),
      orders: document.getElementById("panel-orders"),
      addresses: document.getElementById("panel-addresses")
    };

    function switchTab(tabKey) {
      tabBtns.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabKey);
      });
      Object.keys(panels).forEach(key => {
        if (panels[key]) panels[key].classList.toggle("active", key === tabKey);
      });
    }

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab) switchTab(btn.dataset.tab);
      });
    });
  }

  // ==========================================================================
  // INITIALIZE ON DOM LOAD (ONLY IF MOBILE VIEWPORT ACTIVE)
  // ==========================================================================
  function init() {
    initMobileDrawer();
    hookAuthUpdates();
    updateMobileDrawerUser();

    if (isMobile()) {
      initMobileHeaderSearchBtn();
      initMobileFilterBottomSheet();
      initMobileSortBottomSheet();
      initMobileFooterAccordions();
      initMobileStickyPurchaseBar();
      initMobileHeaderQuickSearch();
      initMobileScrollEntrance();
      initMobileAccountTabs();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("resize", () => {
    if (isMobile()) {
      initMobileHeaderSearchBtn();
      initMobileFilterBottomSheet();
      initMobileSortBottomSheet();
      initMobileFooterAccordions();
      initMobileStickyPurchaseBar();
    }
  }, { passive: true });

})();
