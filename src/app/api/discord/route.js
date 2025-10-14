// app/api/discord/route.js
import { NextResponse } from "next/server";

const MAX_BUFFER = 200;
globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;
const SECRET = process.env.DISCORD_POST_SECRET || "";

function validateMessage(body) {
  if (!body) return false;
  return (
    typeof body.id === "string" &&
    typeof body.author === "string" &&
    (typeof body.content === "string" || typeof body.content === "object") &&
    (typeof body.createdAt === "number" || typeof body.createdAt === "string")
  );
}

export async function POST(req) {
  const header = req.headers.get("x-bot-secret") || "";
  if (!SECRET || header !== SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!validateMessage(body)) {
    return NextResponse.json({ success: false, error: "Invalid message shape" }, { status: 400 });
  }

  const msg = {
    id: body.id,
    author: body.author,
    content: body.content,
    createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
    receivedAt: Date.now(),
  };

  // push to front and cap size
  memoryBuffer.unshift(msg);
  if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

  // debug log visible in Vercel logs
  console.log("POST /api/discord received:", msg.id, msg.author);

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(req) {
  // return messages oldest -> newest
  const copy = [...memoryBuffer].slice(0, 50).reverse();
  return NextResponse.json({ success: true, messages: copy }, { status: 200 });
}
