export function createEventStream() {
  const clients = new Set();

  function send(data) {
    for (const res of clients) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  function handler(req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    clients.add(res);

    req.on("close", () => clients.delete(res));

    return { send };
  }

  return handler();
}
