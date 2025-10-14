import { NextResponse } from "next/server";

// === Configuration ===
const MAX_BUFFER = 200;
const SECRET = process.env.DISCORD_POST_SECRET || "";

// Use a global in-memory buffer and client connections
globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// === Helper: Validate message shape ===
function validateMessage(body) {
  if (!body) return false;
  return (
    typeof body.id === "string" &&
    typeof body.author === "string" &&
    (typeof body.content === "string" || typeof body.content === "object") &&
    (typeof body.createdAt === "number" || typeof body.createdAt === "string")
  );
}

// === Helper: Broadcast to all connected clients ===
function broadcastToClients(message) {
  globalThis.__DISCORD_CLIENTS.forEach((client) => {
    try {
      client.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
    } catch (error) {
      console.error("Error sending to client:", error);
    }
  });
}

// === POST: Receive new messages from Discord bot ===
export async function POST(req) {
  const header = req.headers.get("x-bot-secret") || "";
  console.log(1)
  if (!SECRET || header !== SECRET) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  console.log(2)

  let body;
  try {
    body = await req.json();
     console.log("📩 [Next.js API] Received from bot:", body);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
console.log(3)
  if (!validateMessage(body)) {
    return NextResponse.json(
      { success: false, error: "Invalid message shape" },
      { status: 400 }
    );
  }
  console.log(4)
  const msg = {
    id: body.id,
    author: body.author,
    content: body.content,
    createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
    receivedAt: Date.now(),
  };
console.log(5)
  // Push to front and cap memory buffer size
  memoryBuffer.unshift(msg);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

  // Broadcast to all connected clients
  broadcastToClients({
    type: "NEW_MESSAGE",
    message: msg
  });
  console.log(6)
  return NextResponse.json({ success: true }, { status: 200 });
}

// === GET: Server-Sent Events endpoint for real-time updates ===
// app/api/discord/route.js

export async function GET(req) {
  const url = new URL(req.url);

  // ✅ Handle Server-Sent Events (live updates)
  if (url.searchParams.get("stream") === "true") {
    console.log("🔗 SSE connection opened");

    const stream = new ReadableStream({
      start(controller) {
        const client = { controller };
        globalThis.__DISCORD_CLIENTS.push(client);

        // Send initial batch of messages
        const initialMessages = [...memoryBuffer].slice(0, 50).reverse();
        controller.enqueue(`data: ${JSON.stringify({
          type: "INITIAL_DATA",
          messages: initialMessages,
        })}\n\n`);

        // Handle disconnects
        req.signal.addEventListener("abort", () => {
          console.log("❌ SSE client disconnected");
          globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter(
            (c) => c !== client
          );
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ✅ Regular GET fallback (returns latest messages)
  const copy = [...memoryBuffer].slice(0, 50).reverse();
  return NextResponse.json({ success: true, messages: copy });
}
