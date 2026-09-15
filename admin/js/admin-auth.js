/**
 * VELORA Admin Panel - Centralized Authentication Guard
 * Connects to Supabase Auth and verifies role === 'admin'
 */

(function () {
  'use strict';

  const AdminAuth = {
    getClient: function () {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof window.getSupabase === 'function') return window.getSupabase();
      return null;
    },

    /**
     * Check if user is signed in and has admin role
     */
    checkAdmin: async function () {
      const client = this.getClient();
      if (!client) {
        console.warn("Supabase client initializing...");
        await new Promise(r => setTimeout(r, 200));
        return this.checkAdmin();
      }

      try {
        const { data: { user }, error: userErr } = await client.auth.getUser();
        if (userErr || !user) {
          return { isAdmin: false, reason: "unauthenticated" };
        }

        // Query public.profiles for role (strictly database-authoritative)
        const { data: profile, error: profErr } = await client
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile && profile.role === "admin") {
          return { isAdmin: true, user: user, profile: profile };
        }

        // Fallback: check user metadata
        if (user.user_metadata && user.user_metadata.role === "admin") {
          return { isAdmin: true, user: user, profile: profile || user.user_metadata };
        }

        return { isAdmin: false, reason: "unauthorized", user: user };
      } catch (err) {
        console.error("Admin check failed:", err);
        return { isAdmin: false, reason: "error" };
      }
    },

    /**
     * Guard protected admin pages
     */
    guardRoute: async function () {
      const res = await this.checkAdmin();
      if (!res.isAdmin) {
        if (res.reason === "unauthorized") {
          alert("Access Denied: Your account does not have administrator privileges.");
          await this.logout();
        }
        window.location.href = "index.html";
        return null;
      }
      return res;
    },

    /**
     * Admin login handler
     */
    login: async function (email, password) {
      const client = this.getClient();
      if (!client) return { success: false, error: "Database client connecting..." };

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password
        });

        if (error) {
          return { success: false, error: error.message };
        }

        // Verify role strictly from database profile or metadata
        const { data: profile } = await client
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", data.user.id)
          .maybeSingle();

        const role = (profile && profile.role) || (data.user.user_metadata && data.user.user_metadata.role);
        if (role !== "admin") {
          await client.auth.signOut();
          return {
            success: false,
            error: "Access Denied: This account is not authorized as a VELORA administrator."
          };
        }

        return { success: true, user: data.user, profile: profile };
      } catch (err) {
        return { success: false, error: err.message || "Authentication error." };
      }
    },

    /**
     * Admin logout handler
     */
    logout: async function () {
      const client = this.getClient();
      try {
        if (client) await client.auth.signOut();
      } catch (e) {}
      window.location.href = "index.html";
    }
  };

  window.AdminAuth = AdminAuth;
})();
