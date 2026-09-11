/**
 * VELORA - Unified Authentication & Session Service
 * Powered by Supabase Auth (PostgreSQL backend)
 * 
 * Handles registration, login, session persistence, route protection,
 * profile fetching from public.profiles, password recovery, and dynamic navbar state.
 */

(function () {
  'use strict';

  // --- 1. Toast Notification Utility ---
  function showAuthToast(message, type = 'info') {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconSvg = '';

    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-content" style="display:flex; align-items:center; gap:10px;">
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-message" style="font-size:0.9rem; font-weight:600;">${message}</span>
      </div>
      <button class="toast-close" aria-label="Close">✕</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const removeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 4000);
  }

  // --- 2. State & Cache ---
  let cachedUser = null;
  let cachedProfile = null;
  let isInitialized = false;

  // --- 3. Core Authentication Service ---
  const VeloraAuth = {
    /**
     * Get the active Supabase client instance
     */
    getClient: function () {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof window.getSupabase === 'function') return window.getSupabase();
      return null;
    },

    /**
     * Initialize auth listeners and update navbar
     */
    init: async function () {
      const client = this.getClient();
      if (!client) {
        // Retry shortly if Supabase CDN is still loading
        setTimeout(() => this.init(), 100);
        return;
      }

      if (isInitialized) return;
      isInitialized = true;

      try {
        // Fetch current session
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          cachedUser = session.user;
          await this.loadProfile(session.user.id);
        } else {
          cachedUser = null;
          cachedProfile = null;
        }
      } catch (err) {
        console.warn("Session check warning:", err);
      }

      // Listen to auth changes (login, logout, token refresh)
      client.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          cachedUser = session.user;
          await this.loadProfile(session.user.id);
        } else {
          cachedUser = null;
          cachedProfile = null;
        }
        this.updateNavbarAuth();

        // Handle password recovery redirect
        if (event === 'PASSWORD_RECOVERY') {
          if (!window.location.pathname.includes('forgot-password.html')) {
            window.location.href = 'forgot-password.html#type=recovery';
          }
        }
      });

      this.updateNavbarAuth();
    },

    /**
     * Fetch user profile from public.profiles
     */
    loadProfile: async function (userId) {
      if (!userId) return null;
      const client = this.getClient();
      if (!client) return null;

      try {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (data && !error) {
          cachedProfile = data;
          return data;
        }

        // If profile row doesn't exist yet, construct from user metadata
        if (cachedUser && cachedUser.user_metadata) {
          const meta = cachedUser.user_metadata;
          cachedProfile = {
            id: userId,
            full_name: meta.full_name || meta.name || '',
            email: cachedUser.email || '',
            phone: meta.phone || '',
            role: meta.role || 'customer'
          };
          // Attempt insertion
          await client.from('profiles').upsert([cachedProfile], { onConflict: 'id' });
          return cachedProfile;
        }
      } catch (e) {
        console.warn("Failed to load profile:", e);
      }
      return null;
    },

    /**
     * Get current user object (sync with cached data)
     */
    getCurrentUser: function () {
      if (cachedProfile && (cachedProfile.full_name || cachedProfile.email)) {
        return {
          id: cachedProfile.id,
          name: cachedProfile.full_name || (cachedUser && cachedUser.user_metadata ? (cachedUser.user_metadata.full_name || cachedUser.user_metadata.name) : '') || (cachedProfile.email ? cachedProfile.email.split('@')[0] : 'Member'),
          email: cachedProfile.email || (cachedUser ? cachedUser.email : ''),
          phone: cachedProfile.phone || (cachedUser && cachedUser.user_metadata ? cachedUser.user_metadata.phone : '') || '',
          role: cachedProfile.role || 'customer'
        };
      }
      if (cachedUser) {
        const meta = cachedUser.user_metadata || {};
        return {
          id: cachedUser.id,
          name: meta.full_name || meta.name || (cachedUser.email ? cachedUser.email.split('@')[0] : 'Member'),
          email: cachedUser.email,
          phone: meta.phone || '',
          role: meta.role || 'customer'
        };
      }
      // Read active Supabase token from localStorage if memory cache not populated
      if (typeof localStorage !== 'undefined') {
        const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (sbKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(sbKey));
            if (parsed && parsed.user) {
              const u = parsed.user;
              const meta = u.user_metadata || {};
              return {
                id: u.id,
                name: meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'Member'),
                email: u.email,
                phone: meta.phone || '',
                role: meta.role || 'customer'
              };
            }
          } catch (e) {}
        }
      }
      return null;
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn: function () {
      return this.getCurrentUser() !== null;
    },

    /**
     * Sign in with Supabase email and password
     */
    login: async function (email, password, rememberMe = true) {
      const client = this.getClient();
      if (!client) {
        return { success: false, error: 'Database connection initializing. Please try again in a moment.' };
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = password || '';

      if (!cleanEmail || !cleanPass) {
        return { success: false, error: 'Please provide both email address and password.' };
      }

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (error) {
          // Translate common Supabase error messages into clean, user-friendly copy
          let msg = error.message;
          if (msg.includes('Invalid login credentials')) {
            msg = 'Invalid email or password. Please check your credentials and try again.';
          } else if (msg.includes('Email not confirmed')) {
            msg = 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
          }
          return { success: false, error: msg };
        }

        cachedUser = data.user;
        await this.loadProfile(data.user.id);
        this.updateNavbarAuth();
        showAuthToast('Welcome back, ' + (this.getCurrentUser().name || 'Member') + '!', 'success');

        return { success: true, user: this.getCurrentUser(), session: data.session };
      } catch (err) {
        return { success: false, error: err.message || 'An unexpected error occurred during sign in.' };
      }
    },

    /**
     * Sign up with Supabase email, password, and metadata
     */
    signup: async function ({ name, email, phone, password }) {
      const client = this.getClient();
      if (!client) {
        return { success: false, error: 'Database connection initializing. Please try again in a moment.' };
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (name || '').trim();
      const cleanPhone = (phone || '').trim();
      const cleanPass = password || '';

      if (!cleanEmail || !cleanPass) {
        return { success: false, error: 'Email and password are required.' };
      }

      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
              role: 'customer'
            }
          }
        });

        if (error) {
          let msg = error.message;
          if (msg.includes('User already registered')) {
            msg = 'An account with this email address already exists. Please sign in instead.';
          }
          return { success: false, error: msg };
        }

        if (data.user) {
          cachedUser = data.user;
          // Ensure profile record is created in public.profiles with user's actual name and email
          try {
            await client.from('profiles').upsert([{
              id: data.user.id,
              full_name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              role: 'customer',
              updated_at: new Date().toISOString()
            }], { onConflict: 'id' });
          } catch (e) {
            console.warn("Profile upsert error:", e);
          }

          await this.loadProfile(data.user.id);
          this.updateNavbarAuth();
          showAuthToast('Account created successfully! Welcome to VELORA.', 'success');
        }

        return {
          success: true,
          user: data.user,
          session: data.session,
          requiresEmailConfirmation: !data.session
        };
      } catch (err) {
        return { success: false, error: err.message || 'An unexpected error occurred during registration.' };
      }
    },

    /**
     * Log out from Supabase Auth
     */
    logout: async function () {
      const client = this.getClient();
      try {
        if (client) {
          await client.auth.signOut();
        }
      } catch (err) {
        console.warn("Sign out notice:", err);
      }

      cachedUser = null;
      cachedProfile = null;

      // Clear any legacy auth keys
      localStorage.removeItem('velora_user_session');

      this.updateNavbarAuth();
      showAuthToast('You have signed out successfully.', 'info');

      // If on protected page, redirect to login
      const currentPath = window.location.pathname;
      if (currentPath.includes('account.html') || currentPath.includes('checkout.html') || currentPath.includes('wishlist.html')) {
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 400);
      }
    },

    /**
     * Send password reset email via Supabase
     */
    resetPassword: async function (email) {
      const client = this.getClient();
      if (!client) {
        return { success: false, error: 'Database connection initializing.' };
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      try {
        const redirectUrl = window.location.origin + window.location.pathname.replace(/[^\/]+$/, '') + 'forgot-password.html';
        const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          message: 'If an account matches that email, password reset instructions have been dispatched.'
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Update user password (used after reset link callback)
     */
    updatePassword: async function (newPassword) {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Database connection initializing.' };

      try {
        const { data, error } = await client.auth.updateUser({
          password: newPassword
        });

        if (error) return { success: false, error: error.message };
        showAuthToast('Password updated successfully! You may now sign in.', 'success');
        return { success: true, user: data.user };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Route protection guard for private pages
     */
    requireAuth: function (redirectUrl) {
      if (!this.isLoggedIn()) {
        const target = redirectUrl || window.location.pathname.split('/').pop() + window.location.search;
        window.location.href = `login.html?redirect=${encodeURIComponent(target)}`;
        return false;
      }
      return true;
    },

    /**
     * Retrieve preserved redirect URL from query string
     */
    getRedirectUrl: function (fallback = 'account.html') {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect && !redirect.startsWith('http') && !redirect.startsWith('//')) {
        return redirect;
      }
      return fallback;
    },

    /**
     * Calculate password strength score (0 to 4)
     */
    checkPasswordStrength: function (pwd) {
      if (!pwd) return { score: 0, label: 'Too short', percent: 0 };
      let score = 0;
      if (pwd.length >= 8) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/[0-9]/.test(pwd)) score++;
      if (/[^A-Za-z0-9]/.test(pwd)) score++;

      const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
      return {
        score: score,
        label: labels[score] || 'Weak',
        percent: score * 25
      };
    },

    /**
     * Dynamic navbar updater that attaches/replaces account icon with user avatar & menu
     */
    updateNavbarAuth: function () {
      const currentUser = this.getCurrentUser();
      const accountBtns = document.querySelectorAll(".action-btn[aria-label*='Account'], .action-btn[title*='Account'], .action-btn[title*='Sign In']");

      accountBtns.forEach(btn => {
        let wrapper = btn.closest('.nav-account-wrapper');
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'nav-account-wrapper';
          btn.parentNode.insertBefore(wrapper, btn);
          wrapper.appendChild(btn);
        }

        if (currentUser) {
          // Logged in: Render user initials avatar and interactive dropdown
          const initials = currentUser.name
            ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : 'ME';
          const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'Account';

          wrapper.innerHTML = `
            <button type="button" class="user-nav-avatar-btn" aria-label="Open Account Menu" aria-haspopup="true">
              <span class="user-avatar-circle">${initials}</span>
              <span class="user-nav-name">${firstName}</span>
              <svg class="user-nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="nav-user-dropdown" role="menu">
              <div class="dropdown-user-header">
                <div class="dropdown-user-name">${currentUser.name || 'Member'}</div>
                <div class="dropdown-user-email">${currentUser.email}</div>
              </div>
              <ul class="dropdown-menu-list">
                <li class="dropdown-menu-item">
                  <a href="account.html">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    My Profile & Settings
                  </a>
                </li>
                <li class="dropdown-menu-item">
                  <a href="account.html#orders">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    My Orders
                  </a>
                </li>
                <li class="dropdown-menu-item">
                  <a href="wishlist.html">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    Saved Wishlist
                  </a>
                </li>
                <li class="dropdown-menu-item">
                  <a href="shop.html">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    Continue Shopping
                  </a>
                </li>
                <li class="dropdown-menu-item logout">
                  <button type="button" id="btn-nav-logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                  </button>
                </li>
              </ul>
            </div>
          `;

          const toggleBtn = wrapper.querySelector('.user-nav-avatar-btn');
          const logoutBtn = wrapper.querySelector('#btn-nav-logout');

          if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              wrapper.classList.toggle('open');
            });
          }

          if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
              e.preventDefault();
              VeloraAuth.logout();
            });
          }
        } else {
          // Logged out: Restore normal account icon linking to login.html
          wrapper.innerHTML = `
            <a href="login.html" class="action-btn" aria-label="Account Profile" title="Sign In / Register">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </a>
          `;
        }
      });
    }
  };

  // Close nav dropdown when clicking outside
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-account-wrapper')) {
        document.querySelectorAll('.nav-account-wrapper.open').forEach(w => w.classList.remove('open'));
      }
    });
  }

  // Export to global window
  window.VeloraAuth = VeloraAuth;

  // Auto-init when DOM is loaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => VeloraAuth.init());
    } else {
      VeloraAuth.init();
    }
  }
})();
