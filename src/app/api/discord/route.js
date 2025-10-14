import { NextResponse } from "next/server";

// === Configuration ===
const MAX_BUFFER = 200;
const SECRET = process.env.DISCORD_POST_SECRET || "";

// Use a global in-memory buffer (survives hot reloads in dev)
globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
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

// === POST: Receive new messages from Discord bot ===
export async function POST(req) {
  const header = req.headers.get("x-bot-secret") || "";

  // Validate shared secret
  if (!SECRET || header !== SECRET) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  console.log(header, "header");

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!validateMessage(body)) {
    return NextResponse.json(
      { success: false, error: "Invalid message shape" },
      { status: 400 }
    );
  }

  const msg = {
    id: body.id,
    author: body.author,
    content: body.content,
    createdAt:
      typeof body.createdAt === "string"
        ? Number(body.createdAt)
        : body.createdAt,
    receivedAt: Date.now(),
  };

  console.log(msg, "msg");

  // Push to front and cap memory buffer size
  memoryBuffer.unshift(msg);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

  console.log("POST /api/discord received:", msg.id, msg.author);

  return NextResponse.json({ success: true }, { status: 200 });
}

// === GET: Return latest messages for frontend ===
export async function GET() {
  // Return up to 50 messages (oldest → newest)
  const copy = [...memoryBuffer].slice(0, 50).reverse();

  return NextResponse.json(
    { success: true, messages: copy },
    { status: 200 }
  );
}
