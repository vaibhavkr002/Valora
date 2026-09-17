(function () {
  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

  if (typeof window === "undefined") return;

  try {
    if (!window.supabaseClient && window.supabase && typeof window.supabase.createClient === "function") {
      window.supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
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
})();
