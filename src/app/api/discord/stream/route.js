// src/app/api/discord/stream/route.js
export const runtime = "nodejs";

const HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Access-Control-Allow-Origin": "*", // change to your allowed origin in production
};

function getClientsSet() {
  globalThis.__DISCORD_SSE_CLIENTS = globalThis.__DISCORD_SSE_CLIENTS || new Set();
  return globalThis.__DISCORD_SSE_CLIENTS;
}

// Exported helper so other server code (POST route) can notify clients
export function notifyClients(payload) {
  const clients = getClientsSet();
  const s = `data: ${JSON.stringify(payload)}\n\n`;
  for (const controller of [...clients]) {
    try {
      controller.enqueue(s);
    } catch (err) {
      // if enqueue fails remove controller
      clients.delete(controller);
    }
  }
}

export function GET() {
  const clients = getClientsSet();

  const stream = new ReadableStream({
    start(controller) {
      // add the controller to global set so notifyClients can use it
      clients.add(controller);

      // send initial buffer (global memory buffer kept by your POST route)
      const mem = globalThis.__DISCORD_MEMORY_BUFFER || [];
      // send oldest -> newest
      controller.enqueue(`data: ${JSON.stringify(mem.slice(0, 50).reverse())}\n\n`);

      // keepalive ping every 20s to avoid proxies/idle timeouts
      const keepAlive = setInterval(() => {
        try { controller.enqueue(":\n\n"); } catch (e) {}
      }, 20000);

      // store keepAlive so cancel() can clear
      controller._keepAlive = keepAlive;
    },
    cancel() {
      // nothing extra here; GC/close handled below by removing from set if closed
    }
  });

  const response = new Response(stream, { status: 200, headers: HEADERS });
  return response;
}
