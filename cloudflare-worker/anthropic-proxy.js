// Cloudflare Worker: прокси для api.anthropic.com
//
// Деплой автоматический через GitHub Actions (deploy-cf-worker.yml)
// URL после деплоя: https://anthropic-proxy.<subdomain>.workers.dev

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      return new Response("Not found", { status: 404 })
    }

    const upstream = new Request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: request.headers,
      body: request.body,
    })

    return fetch(upstream)
  },
}
