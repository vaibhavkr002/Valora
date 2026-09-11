/**
 * VELORA - Centralized Supabase Client Configuration
 * Initializes and exports the shared Supabase client for all storefront pages.
 * Never expose the service-role key; only public anon key is used here.
 */

const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

// Ensure supabase library is available
let supabaseClient = null;

try {
  if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
    supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    window.supabaseClient = supabaseClient;
  }
} catch (err) {
  console.error("Failed to initialize Supabase client:", err);
}

// Global fallback helper
window.getSupabase = function () {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
    window.supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    return window.supabaseClient;
  }
  return null;
};
