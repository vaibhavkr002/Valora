/**
 * VELORA Admin Panel - Master Layout Controller
 * Handles sidebar rendering, active highlights, topbar admin info, and toast notifications.
 */

(function () {
  'use strict';

  function formatINR(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  }
  window.formatINR = formatINR;

  function showToast(message, type = "info") {
    let container = document.getElementById("admin-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "admin-toast-container";
      container.className = "admin-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `admin-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
  window.showToast = showToast;

  function initLayout(adminUser) {
    // 1. Mobile Sidebar toggle
    const menuToggle = document.getElementById("btn-menu-toggle");
    const sidebar = document.getElementById("admin-sidebar");
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
    }

    // 2. User dropdown toggle
    const userPill = document.getElementById("admin-user-pill");
    const dropdown = document.getElementById("admin-dropdown-menu");
    if (userPill && dropdown) {
      userPill.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
      });
      document.addEventListener("click", () => {
        dropdown.classList.remove("show");
      });
    }

    // 3. User initials and name
    if (adminUser) {
      const nameElem = document.getElementById("header-admin-name");
      const avatarElem = document.getElementById("header-admin-avatar");
      const name = (adminUser.profile && adminUser.profile.full_name) || adminUser.user.email.split('@')[0];
      if (nameElem) nameElem.textContent = name;
      if (avatarElem) avatarElem.textContent = name.substring(0, 2).toUpperCase();
    }

    // 4. Logout trigger
    const logoutBtn = document.getElementById("btn-admin-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (window.AdminAuth) window.AdminAuth.logout();
      });
    }

    // 5. Highlight active link
    const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
    document.querySelectorAll(".sidebar-link").forEach(link => {
      const href = link.getAttribute("href");
      if (href === currentPath || (currentPath === "" && href === "dashboard.html")) {
        link.classList.add("active");
      }
    });
  }
  window.initLayout = initLayout;
})();
