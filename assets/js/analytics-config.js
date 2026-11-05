/* Private analytics endpoint config for harshvirverse.com
   After you deploy the Cloudflare Worker, set ENDPOINT to your worker URL
   (no trailing slash), e.g. "https://harshvirverse-analytics.<you>.workers.dev"
   Leave empty for local DEMO mode (events stay in this browser only). */
window.HV_ANALYTICS = {
  ENDPOINT: "https://harshvirverse-analytics.harshvirverse.workers.dev",
  /* Demo password for /admin/stats/ when ENDPOINT is empty. CHANGE after go-live. */
  DEMO_PASSWORD: "change-me-hv-stats",
};
