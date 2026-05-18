// Cloudflare Worker: прокси для api.anthropic.com
//
// Деплой (5 минут, бесплатно):
// 1. Зайти на https://dash.cloudflare.com → Workers & Pages → Create application → Create Worker
// 2. Вставить этот код → нажать Deploy
// 3. Скопировать URL вида https://your-worker.workers.dev
// 4. Добавить в .env на сервере: ANTHROPIC_BASE_URL=https://your-worker.workers.dev
// 5. docker-compose restart backend
//
// Бесплатный тариф: 100 000 запросов/день — более чем достаточно.

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
