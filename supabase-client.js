(() => {
  const config = window.GOODGRID_SUPABASE_CONFIG || {};
  const hasConfig = config.url && config.publishableKey
    && !config.url.includes("YOUR_PROJECT_REF")
    && !config.publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY");

  window.goodGridSupabase = null;
  window.goodGridSupabaseConfigured = false;

  if (!hasConfig || !window.supabase || typeof window.supabase.createClient !== "function") return;

  window.goodGridSupabase = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  window.goodGridSupabaseConfigured = true;
})();
