// app/api/discord/route.js
import { NextResponse } from "next/server";

const MAX_BUFFER = 2; // keep only the latest 2 messages
const SECRET = process.env.DISCORD_POST_SECRET || "";

globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// Broadcast to SSE clients and prune dead ones
function broadcastToClients(message) {
  const serialized = `data: ${JSON.stringify(message)}\n\n`;
  const alive = [];
  for (const client of globalThis.__DISCORD_CLIENTS) {
    try {
      client.controller.enqueue(serialized);
      alive.push(client);
    } catch (err) {
      try { client.controller.close?.(); } catch {}
      console.warn("Removed dead SSE client due to error:", err?.message || err);
    }
  }
  globalThis.__DISCORD_CLIENTS = alive;
}

// forgiving normalization (accepts array or single object)
function normalizeIncomingMessages(raw) {
  let incoming = Array.isArray(raw) ? raw : [raw];
  const normalized = [];

  for (let i = 0; i < incoming.length; i++) {
    const m = incoming[i] || {};

    // Coerce id and author to string if present, otherwise fallback
    const id = m.id != null ? String(m.id) : null;
    const author = m.author != null ? String(m.author) : "Unknown";

    // Handle content: accept string or object (stringify small objects)
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

    // createdAt: coerce to number (milliseconds). If invalid, fallback to Date.now()
    let createdAtNum = null;
    if (m.createdAt != null) {
      createdAtNum = Number(m.createdAt);
      if (Number.isNaN(createdAtNum)) createdAtNum = null;
    }
    if (createdAtNum == null) {
      console.warn(`normalizeIncomingMessages: message index ${i} has invalid createdAt; using Date.now()`);
      createdAtNum = Date.now();
    }

    const finalId = id || `unknown-${Date.now()}-${i}`;

    normalized.push({
      id: finalId,
      author,
      content,
      createdAt: createdAtNum,
      receivedAt: Date.now(),
    });
  }

  return normalized;
}

// POST handler: accepts { messages: [...] } or a single message body
export async function POST(req) {
  // Debug headers
  try {
    const hdrs = {};
    for (const [k, v] of req.headers.entries()) hdrs[k] = v;
    console.log("Incoming POST headers:", JSON.stringify(hdrs, null, 2));
  } catch (e) {
    console.warn("Could not enumerate headers:", e);
  }

  const header = req.headers.get("x-bot-secret") || "";
  if (!SECRET || header !== SECRET) {
    console.warn("Unauthorized POST - secret missing or mismatch");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Read and log raw body (trimmed)
  let raw;
  try {
    raw = await req.text();
  } catch (err) {
    console.error("Failed to read raw body:", err);
    return NextResponse.json({ success: false, error: "Failed to read body" }, { status: 400 });
  }

  const rawTrim = typeof raw === "string" ? raw.slice(0, 3000) : raw;
  console.log("Incoming raw body (trimmed):", rawTrim);

  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Invalid JSON in request body:", err?.message || err);
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Determine payload: prefer body.messages if array, otherwise use body
  const payload = Array.isArray(body.messages) ? body.messages : body;

  // Normalize (forgiving)
  let normalized;
  try {
    normalized = normalizeIncomingMessages(payload);
  } catch (err) {
    console.error("Normalization error:", err);
    return NextResponse.json({ success: false, error: "Normalization failed" }, { status: 400 });
  }

  // Append normalized messages to buffer (oldest -> newest)
  for (const msg of normalized) {
    memoryBuffer.push(msg);
  }

  // Trim buffer to last MAX_BUFFER messages (oldest removed)
  while (memoryBuffer.length > MAX_BUFFER) memoryBuffer.shift();

  // Broadcast the normalized batch (oldest -> newest)
  try {
    broadcastToClients({ type: "NEW_BATCH", messages: normalized });
  } catch (err) {
    console.warn("Broadcast error:", err);
  }

  console.log("POST processed successfully. Buffer length:", memoryBuffer.length);
  return NextResponse.json({ success: true }, { status: 200 });
}

// GET: SSE when ?stream=true else return JSON latest messages
export async function GET(req) {
  const url = new URL(req.url);

  if (url.searchParams.get("stream") === "true") {
    const stream = new ReadableStream({
      start(controller) {
        const client = { controller };
        globalThis.__DISCORD_CLIENTS.push(client);

        // Send INITIAL_DATA (last MAX_BUFFER messages, oldest->newest)
        const initialMessages = [...memoryBuffer].slice(-MAX_BUFFER);
        controller.enqueue(`data: ${JSON.stringify({ type: "INITIAL_DATA", messages: initialMessages })}\n\n`);

        // remove client on abort
        req.signal.addEventListener("abort", () => {
          globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter((c) => c !== client);
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

  // non-stream GET returns the last MAX_BUFFER messages
  const copy = [...memoryBuffer].slice(-MAX_BUFFER);
  return NextResponse.json({ success: true, messages: copy });
}





// // app/api/discord/route.js  (Next.js App Router API route)
// import { NextResponse } from "next/server";

// const MAX_BUFFER = 2; // keep only the latest 2 messages
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
// globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

// const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// function validateMessageShape(m) {
//   if (!m) return false;
//   return (
//     typeof m.id === "string" &&
//     typeof m.author === "string" &&
//     (typeof m.content === "string" || typeof m.content === "object") &&
//     (typeof m.createdAt === "number" || typeof m.createdAt === "string")
//   );
// }

// function pruneClients() {
//   globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter(Boolean);
// }

// function broadcastToClients(message) {
//   // message will be an object like { type: "NEW_BATCH", messages: [...] }
//   const serialized = `data: ${JSON.stringify(message)}\n\n`;
//   const alive = [];

//   for (const client of globalThis.__DISCORD_CLIENTS) {
//     try {
//       client.controller.enqueue(serialized);
//       alive.push(client);
//     } catch (err) {
//       try {
//         client.controller.close?.();
//       } catch {}
//       // skip adding to alive
//       console.warn("Removed dead SSE client due to error:", err?.message || err);
//     }
//   }

//   globalThis.__DISCORD_CLIENTS = alive;
// }

// // POST: accept either { messages: [...] } or a single message body
// export async function POST(req) {
//   const header = req.headers.get("x-bot-secret") || "";
//   console.log("he comes")
//   if (!SECRET || header !== SECRET) {
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }
//   console.log("he comes 1")

//   let body;
//   try {
//     body = await req.json();
//   } catch (err) {
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }
//   console.log("he comes2")

//   // Normalize to an array of messages (oldest -> newest)
//   let incoming = [];
//   if (Array.isArray(body.messages)) {
//     incoming = body.messages;
//   } else if (validateMessageShape(body)) {
//     incoming = [body];
//   } else {
//     return NextResponse.json({ success: false, error: "Invalid message shape" }, { status: 400 });
//   }
//     console.log("he comes3")

//   // Validate each message
//   for (const m of incoming) {
//     if (!validateMessageShape(m)) {
//       return NextResponse.json({ success: false, error: "Invalid message in batch" }, { status: 400 });
//     }
//   }
//   console.log("he comes4")

//   // Append each message to buffer as oldest -> newest
//   for (const m of incoming) {
//     const msg = {
//       id: m.id,
//       author: m.author,
//       content: m.content,
//       createdAt: typeof m.createdAt === "string" ? Number(m.createdAt) : m.createdAt,
//       receivedAt: Date.now(),
//     };
//     memoryBuffer.push(msg);
//   }
//   console.log("he comes5")

//   // Trim to keep only latest MAX_BUFFER messages (oldest -> newest)
//   while (memoryBuffer.length > MAX_BUFFER) {
//     memoryBuffer.shift();
//   }

//   // Broadcast the batch we just received (send them as provided to clients)
//   // For clarity, send messages in oldest -> newest order
//   broadcastToClients({ type: "NEW_BATCH", messages: incoming });

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
//         controller.enqueue(
//           `data: ${JSON.stringify({ type: "INITIAL_DATA", messages: initialMessages })}\n\n`
//         );

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







// import { NextResponse } from "next/server";

// // === Configuration ===
// const MAX_BUFFER = 2; // keep only the latest 2 messages
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// // Use a global in-memory buffer and client connections
// globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
// globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

// const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// // === Helper: Validate message shape ===
// function validateMessage(body) {
//   if (!body) return false;
//   return (
//     typeof body.id === "string" &&
//     typeof body.author === "string" &&
//     (typeof body.content === "string" || typeof body.content === "object") &&
//     (typeof body.createdAt === "number" || typeof body.createdAt === "string")
//   );
// }

// // === Helper: Broadcast to all connected clients ===
// function broadcastToClients(message) {
//   globalThis.__DISCORD_CLIENTS.forEach((client) => {
//     try {
//       client.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
//     } catch (error) {
//       console.error("Error sending to client:", error);
//     }
//   });
// }

// // === POST: Receive new messages from Discord bot ===
// export async function POST(req) {
//   const header = req.headers.get("x-bot-secret") || "";
//   if (!SECRET || header !== SECRET) {
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   let body;
//   try {
//     body = await req.json();
//     console.log("📩 [Next.js API] Received from bot:", body);
//   } catch (err) {
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!validateMessage(body)) {
//     return NextResponse.json({ success: false, error: "Invalid message shape" }, { status: 400 });
//   }

//   const msg = {
//     id: body.id,
//     author: body.author,
//     content: body.content,
//     createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
//     receivedAt: Date.now(),
//   };

//   // Push newest to front
//   memoryBuffer.unshift(msg);

//   // Trim buffer to keep only the latest MAX_BUFFER messages (here MAX_BUFFER = 2)
//   if (memoryBuffer.length > MAX_BUFFER) {
//     // remove oldest entries
//     while (memoryBuffer.length > MAX_BUFFER) {
//       memoryBuffer.pop();
//     }
//   }

//   console.log("✅ Message added to buffer (trimmed to latest 2):", memoryBuffer);

//   // Broadcast to all connected clients (NEW_MESSAGE)
//   broadcastToClients({ type: "NEW_MESSAGE", message: msg });

//   return NextResponse.json({ success: true }, { status: 200 });
// }

// // === GET: Server-Sent Events endpoint for real-time updates ===
// export async function GET(req) {
//   const url = new URL(req.url);

//   // Handle Server-Sent Events (live updates)
//   if (url.searchParams.get("stream") === "true") {
//     console.log("🔗 SSE connection opened");

//     const stream = new ReadableStream({
//       start(controller) {
//         const client = { controller };
//         globalThis.__DISCORD_CLIENTS.push(client);

//         // Send only the latest 2 messages
//         const initialMessages = [...memoryBuffer].slice(0, MAX_BUFFER).reverse();
//         console.log("📡 Sending initial messages (SSE):", initialMessages);

//         controller.enqueue(
//           `data: ${JSON.stringify({
//             type: "INITIAL_DATA",
//             messages: initialMessages,
//           })}\n\n`
//         );

//         req.signal.addEventListener("abort", () => {
//           console.log("❌ SSE client disconnected");
//           globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter((c) => c !== client);
//         });
//       },
//     });

//     return new Response(stream, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         Connection: "keep-alive",
//       },
//     });
//   }

//   // Regular GET fallback (returns latest MAX_BUFFER messages)
//   const copy = [...memoryBuffer].slice(0, MAX_BUFFER).reverse();
//   console.log("📡 Sending latest messages (GET):", copy);

//   return NextResponse.json({ success: true, messages: copy });
// }








// import { NextResponse } from "next/server";

// // === Configuration ===
// const MAX_BUFFER = 200;
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// // Use a global in-memory buffer and client connections
// globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
// globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

// const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// // === Helper: Validate message shape ===
// function validateMessage(body) {
//   if (!body) return false;
//   return (
//     typeof body.id === "string" &&
//     typeof body.author === "string" &&
//     (typeof body.content === "string" || typeof body.content === "object") &&
//     (typeof body.createdAt === "number" || typeof body.createdAt === "string")
//   );
// }

// // === Helper: Broadcast to all connected clients ===
// function broadcastToClients(message) {
//   globalThis.__DISCORD_CLIENTS.forEach((client) => {
//     try {
//       client.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
//     } catch (error) {
//       console.error("Error sending to client:", error);
//     }
//   });
// }

// // === POST: Receive new messages from Discord bot ===
// export async function POST(req) {
//   const header = req.headers.get("x-bot-secret") || "";
//   if (!SECRET || header !== SECRET) {
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   let body;
//   try {
//     body = await req.json();
//     console.log("📩 [Next.js API] Received from bot:", body);
//   } catch (err) {
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!validateMessage(body)) {
//     return NextResponse.json({ success: false, error: "Invalid message shape" }, { status: 400 });
//   }

//   const msg = {
//     id: body.id,
//     author: body.author,
//     content: body.content,
//     createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
//     receivedAt: Date.now(),
//   };

//   // Push to front and cap memory buffer size
//   memoryBuffer.unshift(msg);
//   if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

//   // Broadcast to all connected clients
//   broadcastToClients({ type: "NEW_MESSAGE", message: msg });

//   console.log("✅ Message added to buffer:", msg);

//   return NextResponse.json({ success: true }, { status: 200 });
// }

// // === GET: Server-Sent Events endpoint for real-time updates ===
// export async function GET(req) {
//   const url = new URL(req.url);

//   // Handle Server-Sent Events (live updates)
//   if (url.searchParams.get("stream") === "true") {
//     console.log("🔗 SSE connection opened");

//     const stream = new ReadableStream({
//       start(controller) {
//         const client = { controller };
//         globalThis.__DISCORD_CLIENTS.push(client);

//         // Send only the latest 2 messages
//         const initialMessages = [...memoryBuffer].slice(0, 2).trim().reverse();
//         console.log("📡 Sending initial 2 messages (SSE):", initialMessages);

//         controller.enqueue(`data: ${JSON.stringify({
//           type: "INITIAL_DATA",
//           messages: initialMessages,
//         })}\n\n`);

//         req.signal.addEventListener("abort", () => {
//           console.log("❌ SSE client disconnected");
//           globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter((c) => c !== client);
//         });
//       },
//     });

//     return new Response(stream, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         Connection: "keep-alive",
//       },
//     });
//   }

//   // Regular GET fallback (returns latest 2 messages)
//   const copy = [...memoryBuffer].slice(0, 2).reverse();
//   console.log("📡 Sending latest 2 messages (GET):", copy);

//   return NextResponse.json({ success: true, messages: copy });
// }



// import { NextResponse } from "next/server";

// // === Configuration ===
// const MAX_BUFFER = 200;
// const SECRET = process.env.DISCORD_POST_SECRET || "";

// // Use a global in-memory buffer and client connections
// globalThis.__DISCORD_MEMORY_BUFFER = globalThis.__DISCORD_MEMORY_BUFFER || [];
// globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS || [];

// const memoryBuffer = globalThis.__DISCORD_MEMORY_BUFFER;

// // === Helper: Validate message shape ===
// function validateMessage(body) {
//   if (!body) return false;
//   return (
//     typeof body.id === "string" &&
//     typeof body.author === "string" &&
//     (typeof body.content === "string" || typeof body.content === "object") &&
//     (typeof body.createdAt === "number" || typeof body.createdAt === "string")
//   );
// }

// // === Helper: Broadcast to all connected clients ===
// function broadcastToClients(message) {
//   globalThis.__DISCORD_CLIENTS.forEach((client) => {
//     try {
//       client.controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
//     } catch (error) {
//       console.error("Error sending to client:", error);
//     }
//   });
// }

// // === POST: Receive new messages from Discord bot ===
// export async function POST(req) {
//   const header = req.headers.get("x-bot-secret") || "";
//   console.log(1)
//   if (!SECRET || header !== SECRET) {
//     return NextResponse.json(
//       { success: false, error: "Unauthorized" },
//       { status: 401 }
//     );
//   }
//   console.log(2)

//   let body;
//   try {
//     body = await req.json();
//      console.log("📩 [Next.js API] Received from bot:", body);
//   } catch (err) {
//     return NextResponse.json(
//       { success: false, error: "Invalid JSON" },
//       { status: 400 }
//     );
//   }
// console.log(3)
//   if (!validateMessage(body)) {
//     return NextResponse.json(
//       { success: false, error: "Invalid message shape" },
//       { status: 400 }
//     );
//   }
//   console.log(4)
//   const msg = {
//     id: body.id,
//     author: body.author,
//     content: body.content,
//     createdAt: typeof body.createdAt === "string" ? Number(body.createdAt) : body.createdAt,
//     receivedAt: Date.now(),
//   };
// console.log(5)
//   // Push to front and cap memory buffer size
//   memoryBuffer.unshift(msg);
//   if (memoryBuffer.length > MAX_BUFFER) memoryBuffer.length = MAX_BUFFER;

//   // Broadcast to all connected clients
//   broadcastToClients({
//     type: "NEW_MESSAGE",
//     message: msg
//   });
//   console.log(6)
//   return NextResponse.json({ success: true }, { status: 200 });
// }

// // === GET: Server-Sent Events endpoint for real-time updates ===
// // app/api/discord/route.js

// export async function GET(req) {
//   const url = new URL(req.url);

//   // ✅ Handle Server-Sent Events (live updates)
//   if (url.searchParams.get("stream") === "true") {
//     console.log("🔗 SSE connection opened");

//     const stream = new ReadableStream({
//       start(controller) {
//         const client = { controller };
//         globalThis.__DISCORD_CLIENTS.push(client);

//         // Send initial batch of messages
//         const initialMessages = [...memoryBuffer].slice(0, 50).reverse();
//         controller.enqueue(`data: ${JSON.stringify({
//           type: "INITIAL_DATA",
//           messages: initialMessages,
//         })}\n\n`);

//         // Handle disconnects
//         req.signal.addEventListener("abort", () => {
//           console.log("❌ SSE client disconnected");
//           globalThis.__DISCORD_CLIENTS = globalThis.__DISCORD_CLIENTS.filter(
//             (c) => c !== client
//           );
//         });
//       },
//     });

//     return new Response(stream, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         Connection: "keep-alive",
//       },
//     });
//   }

//   // ✅ Regular GET fallback (returns latest messages)
//   const copy = [...memoryBuffer].slice(0, 50).reverse();
//   return NextResponse.json({ success: true, messages: copy });
// }
