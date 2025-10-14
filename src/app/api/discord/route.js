// app/api/discord/route.js
const MAX_BUFFER = 200;
const memoryBuffer = global.__DISCORD_MEMORY_BUFFER ||= [];
const SECRET = process.env.DISCORD_POST_SECRET || "";

function validateMessage(body) {
  if (!body) return false;
  return typeof body.id === "string" &&
         typeof body.author === "string" &&
         (typeof body.content === "string" || typeof body.content === "object") &&
         (typeof body.createdAt === "number" || typeof body.createdAt === "string");
}

export async function POST(req) {
  const header = req.headers.get("x-bot-secret") || "";
  if (!SECRET || header !== SECRET) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { status: 400 });
  }

  if (!validateMessage(body)) {
    return new Response(JSON.stringify({ success: false, error: "Invalid message shape" }), { status: 400 });
  }

  const msg = {
    id: body.id,
    author: body.author,
    content: body.content,
    createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
    receivedAt: Date.now()
  };

  memoryBuffer.unshift(msg);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export async function GET() {
  // return messages oldest -> newest
  const copy = [...memoryBuffer].slice().reverse();
  return new Response(JSON.stringify({ success: true, messages: copy }), { status: 200 });
}
