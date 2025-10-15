// app/api/discord/route.js
import { NextResponse } from "next/server";

const MAX_BUFFER = 2; // keep only the latest 2 messages per channel
const SECRET = process.env.DISCORD_POST_SECRET || "";

// Per-channel buffers and SSE clients (stored globally so they persist across invocations)
globalThis.__DISCORD_CHANNELS = globalThis.__DISCORD_CHANNELS || {};
globalThis.__DISCORD_SSE_CLIENTS = globalThis.__DISCORD_SSE_CLIENTS || [];

const channels = globalThis.__DISCORD_CHANNELS;
const sseClients = globalThis.__DISCORD_SSE_CLIENTS;

/* -------------------- Helpers -------------------- */

// Forgiving normalization of incoming message objects
function normalizeIncomingMessages(raw) {
  const incoming = Array.isArray(raw) ? raw : [raw];
  const normalized = [];

  for (let i = 0; i < incoming.length; i++) {
    const m = incoming[i] || {};
    const id = m.id != null ? String(m.id) : `unknown-${Date.now()}-${i}`;
    const author = m.author != null ? String(m.author) : "Unknown";

    let content = m.content;
    if (content == null) content = "";
    else if (typeof content === "object") {
      try {
        content = JSON.stringify(content).slice(0, 20000);
      } catch {
        content = String(content);
      }
    } else {
      content = String(content);
    }
    if (content.length > 20000) content = content.slice(0, 20000);

    let createdAtNum = Number(m.createdAt);
    if (Number.isNaN(createdAtNum)) createdAtNum = Date.now();

    normalized.push({
      id,
      author,
      content,
      createdAt: createdAtNum,
      receivedAt: Date.now(),
    });
  }

  return normalized;
}

/* Robust broadcast: skip clients marked closed and avoid enqueue on invalid controllers.
   When enqueue fails we mark client.closed and close its controller (best-effort). */
function broadcastToClients(message) {
  const serialized = `data: ${JSON.stringify(message)}\n\n`;
  const alive = [];

  for (const client of sseClients) {
    // skip if previously marked closed
    if (client.closed) continue;

    // sanity checks
    if (!client.controller || typeof client.controller.enqueue !== "function") {
      client.closed = true;
      try { client.controller?.close?.(); } catch {}
      continue;
    }

    try {
      client.controller.enqueue(serialized);
      alive.push(client);
    } catch (err) {
      // Most likely "Invalid state: Controller is already closed"
      // Mark closed and close controller quietly.
      client.closed = true;
      try { client.controller.close?.(); } catch {}
      // Keep logs concise to avoid noisy repeats
      console.info("SSE client removed during broadcast (controller closed).");
    }
  }

  // Replace global list with alive clients
  globalThis.__DISCORD_SSE_CLIENTS = alive;
}

/* -------------------- POST handler -------------------- */
/* Expects POST body: { channel: "SomeName", messages: [ {id,author,content,createdAt}, ... ] } */
const ALLOWED_ORIGINS = [
  "https://plantvsbrainrotstock.com",
  "https://bot-1-8at8.onrender.com"
];
export async function POST(req) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  
  // Allow if origin starts with any approved domain
  if (!ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const header = req.headers.get("x-bot-secret") || "";
  if (!SECRET || header !== SECRET) {
    console.warn("Unauthorized POST - secret missing or mismatch");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let raw;
  try {
    raw = await req.text();
  } catch (err) {
    console.error("Failed to read raw body:", err);
    return NextResponse.json({ success: false, error: "Failed to read body" }, { status: 400 });
  }

  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Invalid JSON in request body:", err?.message || err);
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { channel, messages } = body;
  if (!channel || !Array.isArray(messages)) {
    console.error("Missing channel or messages in POST body:", body);
    return NextResponse.json({ success: false, error: "Missing channel or messages" }, { status: 400 });
  }

  // Normalize incoming messages and append to per-channel buffer
  const normalized = normalizeIncomingMessages(messages);

  if (!channels[channel]) channels[channel] = [];
  for (const msg of normalized) channels[channel].push(msg);

  // Trim to last MAX_BUFFER messages
  while (channels[channel].length > MAX_BUFFER) channels[channel].shift();

  // Broadcast NEW_BATCH with channel name (oldest -> newest order)
  try {
    broadcastToClients({ type: "NEW_BATCH", channel, messages: normalized });
  } catch (err) {
    console.warn("Broadcast error:", err);
  }

  console.log(`POST processed for channel=${channel}. bufferLength=${channels[channel].length}`);
  return NextResponse.json({ success: true }, { status: 200 });
}

/* -------------------- GET handler (SSE + snapshot) -------------------- */
export async function GET(req) {
  const url = new URL(req.url);

  if (url.searchParams.get("stream") === "true") {
    const stream = new ReadableStream({
      start(controller) {
        // client object stores controller and closed flag
        const client = { controller, closed: false };
        sseClients.push(client);

        // Prepare initial snapshot: last MAX_BUFFER messages per channel
        const initial = {};
        for (const [ch, msgs] of Object.entries(channels)) {
          initial[ch] = msgs.slice(-MAX_BUFFER);
        }

        // send the initial data
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: "INITIAL_DATA", channels: initial })}\n\n`);
        } catch (err) {
          // If enqueue fails immediately, mark closed and return
          client.closed = true;
          try { controller.close?.(); } catch {}
        }

        // On abort (client disconnected) mark client closed and remove it
        req.signal.addEventListener("abort", () => {
          client.closed = true;
          try {
            client.controller.close?.();
          } catch (e) {
            // ignore
          }
          globalThis.__DISCORD_SSE_CLIENTS = globalThis.__DISCORD_SSE_CLIENTS.filter((c) => c !== client);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // non-stream GET returns snapshot of channels
  return NextResponse.json(channels);
}

// // app/api/discord/route.js
// import { NextResponse } from "next/server";

// const MAX_BUFFER = 2; // keep only the latest 2 messages per channel
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// // per-channel buffers and SSE clients
// globalThis.__DISCORD_CHANNELS = globalThis.__DISCORD_CHANNELS || {};
// globalThis.__DISCORD_SSE_CLIENTS = globalThis.__DISCORD_SSE_CLIENTS || [];

// const channels = globalThis.__DISCORD_CHANNELS;
// const sseClients = globalThis.__DISCORD_SSE_CLIENTS;

// // Broadcast to all SSE clients and prune dead ones
// function broadcastToClients(message) {
//   const serialized = `data: ${JSON.stringify(message)}\n\n`;
//   const alive = [];
//   for (const client of sseClients) {
//     try {
//       client.controller.enqueue(serialized);
//       alive.push(client);
//     } catch (err) {
//       try { client.controller.close?.(); } catch {}
//       console.warn("Removed dead SSE client due to error:", err?.message || err);
//     }
//   }
//   globalThis.__DISCORD_SSE_CLIENTS = alive;
// }

// // forgiving normalization helper (same as before)
// function normalizeIncomingMessages(raw) {
//   const incoming = Array.isArray(raw) ? raw : [raw];
//   const normalized = [];

//   for (let i = 0; i < incoming.length; i++) {
//     const m = incoming[i] || {};
//     const id = m.id != null ? String(m.id) : `unknown-${Date.now()}-${i}`;
//     const author = m.author != null ? String(m.author) : "Unknown";

//     let content = m.content;
//     if (content == null) content = "";
//     else if (typeof content === "object") {
//       try { content = JSON.stringify(content).slice(0, 20000); }
//       catch { content = String(content); }
//     } else content = String(content);

//     if (content.length > 20000) content = content.slice(0, 20000);

//     let createdAtNum = Number(m.createdAt);
//     if (Number.isNaN(createdAtNum)) createdAtNum = Date.now();

//     normalized.push({
//       id,
//       author,
//       content,
//       createdAt: createdAtNum,
//       receivedAt: Date.now(),
//     });
//   }

//   return normalized;
// }

// // POST: accept { channel: "Name", messages: [...] }
// export async function POST(req) {
//   const header = req.headers.get("x-bot-secret") || "";
//   if (!SECRET || header !== SECRET) {
//     console.warn("Unauthorized POST - secret missing or mismatch");
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   let raw;
//   try { raw = await req.text(); }
//   catch (err) {
//     console.error("Failed to read raw body:", err);
//     return NextResponse.json({ success: false, error: "Failed to read body" }, { status: 400 });
//   }

//   let body;
//   try { body = raw ? JSON.parse(raw) : {}; }
//   catch (err) {
//     console.error("Invalid JSON in request body:", err?.message || err);
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }

//   const { channel, messages } = body;
//   if (!channel || !Array.isArray(messages)) {
//     console.error("Missing channel or messages in POST body:", body);
//     return NextResponse.json({ success: false, error: "Missing channel or messages" }, { status: 400 });
//   }

//   const normalized = normalizeIncomingMessages(messages);

//   // init channel buffer
//   if (!channels[channel]) channels[channel] = [];

//   // append normalized messages (oldest -> newest)
//   for (const msg of normalized) channels[channel].push(msg);

//   // trim to last MAX_BUFFER
//   while (channels[channel].length > MAX_BUFFER) channels[channel].shift();

//   // Broadcast to SSE clients: include channel name
//   broadcastToClients({ type: "NEW_BATCH", channel, messages: normalized });

//   console.log(`POST processed for channel=${channel}. bufferLength=${channels[channel].length}`);
//   return NextResponse.json({ success: true }, { status: 200 });
// }

// // GET: SSE when ?stream=true else return JSON snapshot of channels
// export async function GET(req) {
//   const url = new URL(req.url);

//   if (url.searchParams.get("stream") === "true") {
//     const stream = new ReadableStream({
//       start(controller) {
//         const client = { controller };
//         sseClients.push(client);

//         // Send INITIAL_DATA: last MAX_BUFFER messages per channel
//         const initial = {};
//         for (const [ch, msgs] of Object.entries(channels)) {
//           initial[ch] = msgs.slice(-MAX_BUFFER);
//         }
//         controller.enqueue(`data: ${JSON.stringify({ type: "INITIAL_DATA", channels: initial })}\n\n`);

//         req.signal.addEventListener("abort", () => {
//           globalThis.__DISCORD_SSE_CLIENTS = globalThis.__DISCORD_SSE_CLIENTS.filter((c) => c !== client);
//         });
//       },
//     });

//     return new Response(stream, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache, no-transform",
//         Connection: "keep-alive",
//       },
//     });
//   }

//   // non-stream GET returns full channels snapshot
//   return NextResponse.json(channels);
// }



// // app/api/discord/route.js
// import { NextResponse } from "next/server";

// const MAX_BUFFER = 2; // keep only the latest 2 messages
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
// globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

// const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// // Broadcast to SSE clients and prune dead ones
// function broadcastToClients(message) {
//   const serialized = `data: ${JSON.stringify(message)}\n\n`;
//   const alive = [];
//   for (const client of globalThis.__DISCORD_CLIENTS) {
//     try {
//       client.controller.enqueue(serialized);
//       alive.push(client);
//     } catch (err) {
//       try { client.controller.close?.(); } catch {}
//       console.warn("Removed dead SSE client due to error:", err?.message || err);
//     }
//   }
//   globalThis.__DISCORD_CLIENTS = alive;
// }

// // forgiving normalization (accepts array or single object)
// function normalizeIncomingMessages(raw) {
//   let incoming = Array.isArray(raw) ? raw : [raw];
//   const normalized = [];

//   for (let i = 0; i < incoming.length; i++) {
//     const m = incoming[i] || {};

//     // Coerce id and author to string if present, otherwise fallback
//     const id = m.id != null ? String(m.id) : null;
//     const author = m.author != null ? String(m.author) : "Unknown";

//     // Handle content: accept string or object (stringify small objects)
//     let content = m.content;
//     if (content == null) content = "";
//     else if (typeof content === "object") {
//       try {
//         content = JSON.stringify(content).slice(0, 20000);
//       } catch {
//         content = String(content);
//       }
//     } else {
//       content = String(content);
//     }
//     if (content.length > 20000) content = content.slice(0, 20000);

//     // createdAt: coerce to number (milliseconds). If invalid, fallback to Date.now()
//     let createdAtNum = null;
//     if (m.createdAt != null) {
//       createdAtNum = Number(m.createdAt);
//       if (Number.isNaN(createdAtNum)) createdAtNum = null;
//     }
//     if (createdAtNum == null) {
//       console.warn(`normalizeIncomingMessages: message index ${i} has invalid createdAt; using Date.now()`);
//       createdAtNum = Date.now();
//     }

//     const finalId = id || `unknown-${Date.now()}-${i}`;

//     normalized.push({
//       id: finalId,
//       author,
//       content,
//       createdAt: createdAtNum,
//       receivedAt: Date.now(),
//     });
//   }

//   return normalized;
// }

// // POST handler: accepts { messages: [...] } or a single message body
// export async function POST(req) {
//   // Debug headers
//   try {
//     const hdrs = {};
//     for (const [k, v] of req.headers.entries()) hdrs[k] = v;
//     console.log("Incoming POST headers:", JSON.stringify(hdrs, null, 2));
//   } catch (e) {
//     console.warn("Could not enumerate headers:", e);
//   }

//   const header = req.headers.get("x-bot-secret") || "";
//   if (!SECRET || header !== SECRET) {
//     console.warn("Unauthorized POST - secret missing or mismatch");
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   // Read and log raw body (trimmed)
//   let raw;
//   try {
//     raw = await req.text();
//   } catch (err) {
//     console.error("Failed to read raw body:", err);
//     return NextResponse.json({ success: false, error: "Failed to read body" }, { status: 400 });
//   }

//   const rawTrim = typeof raw === "string" ? raw.slice(0, 3000) : raw;
//   console.log("Incoming raw body (trimmed):", rawTrim);

//   let body;
//   try {
//     body = raw ? JSON.parse(raw) : {};
//   } catch (err) {
//     console.error("Invalid JSON in request body:", err?.message || err);
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }

//   // Determine payload: prefer body.messages if array, otherwise use body
//   const payload = Array.isArray(body.messages) ? body.messages : body;

//   // Normalize (forgiving)
//   let normalized;
//   try {
//     normalized = normalizeIncomingMessages(payload);
//   } catch (err) {
//     console.error("Normalization error:", err);
//     return NextResponse.json({ success: false, error: "Normalization failed" }, { status: 400 });
//   }

//   // Append normalized messages to buffer (oldest -> newest)
//   for (const msg of normalized) {
//     memoryBuffer.push(msg);
//   }

//   // Trim buffer to last MAX_BUFFER messages (oldest removed)
//   while (memoryBuffer.length > MAX_BUFFER) memoryBuffer.shift();

//   // Broadcast the normalized batch (oldest -> newest)
//   try {
//     broadcastToClients({ type: "NEW_BATCH", messages: normalized });
//   } catch (err) {
//     console.warn("Broadcast error:", err);
//   }

//   console.log("POST processed successfully. Buffer length:", memoryBuffer.length);
//   return NextResponse.json({ success: true }, { status: 200 });
// }

// // GET: SSE when ?stream=true else return JSON latest messages
// export async function GET(req) {
//   const url = new URL(req.url);

//   if (url.searchParams.get("stream") === "true") {
//     const stream = new ReadableStream({
//       start(controller) {
//         const client = { controller };
//         globalThis.__DISCORD_CLIENTS.push(client);

//         // Send INITIAL_DATA (last MAX_BUFFER messages, oldest->newest)
//         const initialMessages = [...memoryBuffer].slice(-MAX_BUFFER);
//         controller.enqueue(`data: ${JSON.stringify({ type: "INITIAL_DATA", messages: initialMessages })}\n\n`);

//         // remove client on abort
//         req.signal.addEventListener("abort", () => {
//           globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter((c) => c !== client);
//         });
//       },
//     });

//     return new Response(stream, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache, no-transform",
//         Connection: "keep-alive",
//       },
//     });
//   }

//   // non-stream GET returns the last MAX_BUFFER messages
//   const copy = [...memoryBuffer].slice(-MAX_BUFFER);
//   return NextResponse.json({ success: true, messages: copy });
// }



