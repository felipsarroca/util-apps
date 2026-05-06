(function () {
  const config = window.BIBLIOTECA_SOL_CONFIG || {};

  window.BibliotecaSolSupabase = {
    isConfigured() {
      return Boolean(config.supabaseUrl && config.supabaseAnonKey);
    },
    getConfig() {
      return {
        url: config.supabaseUrl,
        anonKey: config.supabaseAnonKey
      };
    }
  };
})();
