// bot/index.js
import { createServer } from "http";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN not set. Exiting.");
  process.exit(1);
}

const clients = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function processMessage(m) {
  let stockData = m.content || "";

  if (m.embeds && m.embeds.length > 0) {
    stockData = m.embeds
      .map((e) => {
        let desc = e.description ?? "";
        if (e.fields?.length) desc += "\n" + e.fields.map((f) => `${f.name}: ${f.value}`).join("\n");
        if (e.title) desc = `${e.title}\n${desc}`;
        return desc;
      })
      .join("\n");
  }

  stockData = stockData.replace(/<:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) =>
    `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" style="width:20px;height:20px;vertical-align:middle;" />`
  );
  stockData = stockData.replace(/<t:(\d+):R>/g, (match, ts) => {
    const date = new Date(parseInt(ts, 10) * 1000);
    return date.toLocaleTimeString();
  });
  stockData = stockData.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return {
    id: m.id,
    author: m.author?.username || "Unknown",
    content: stockData,
    createdAt: m.createdTimestamp,
  };
}

// Discord ready + initial fetch
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  try {
    if (!CHANNEL_ID) {
      console.warn("⚠️ CHANNEL_ID not set — initial fetch skipped.");
      return;
    }
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("❌ Could not fetch channel.");
      return;
    }
    const messages = await channel.messages.fetch({ limit: 2 });
    const latest = messages.map(processMessage).sort((a, b) => a.createdAt - b.createdAt);
    // Broadcast initial messages
    clients.forEach((res) => {
      res.write(`data: ${JSON.stringify(latest)}\n\n`);
    });
    console.log("✅ Initial messages broadcasted");
  } catch (err) {
    console.error("❌ Error fetching messages:", err);
  }
});

// When new messages arrive
client.on("messageCreate", async (message) => {
  try {
    if (message.author?.bot) return;
    if (CHANNEL_ID && message.channel?.id !== CHANNEL_ID) return;
    const processed = processMessage(message);
    console.log("📨 New stock message:", processed);

    // Broadcast to SSE clients
    const payload = JSON.stringify([processed]); // you may send whole buffer if you keep one
    clients.forEach((res) => {
      try { res.write(`data: ${payload}\n\n`); } catch (e) { /* ignore closed */ }
    });
  } catch (err) {
    console.error("Error in messageCreate:", err);
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
  process.exit(1);
});

// === SSE HTTP server ===
const server = createServer((req, res) => {
  if (req.url === "/api/live-stock") {
    // Required SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Allow your front-end origin if you want restrict; "*" is easiest
      "Access-Control-Allow-Origin": "*",
    });

    // send a comment to keep connection alive
    res.write(":connected\n\n");

    clients.add(res);
    console.log("🌐 SSE client connected — total:", clients.size);

    req.on("close", () => {
      clients.delete(res);
      console.log("❌ SSE client disconnected — total:", clients.size);
    });
  } else if (req.method === "OPTIONS") {
    // CORS preflight
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => console.log(`📡 SSE server running on port ${PORT}`));


// import { createServer } from "http";
// import { Client, GatewayIntentBits } from "discord.js";
// import dotenv from "dotenv";
// dotenv.config();

// // === Discord Client ===
// const client = new Client({
//   intents: [
//     GatewayIntentBits.Guilds,
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.MessageContent,
//   ],
// });

// const CHANNEL_ID = process.env.CHANNEL_ID;
// let latestMessages = [];

// // === Helper: process messages, embeds, emojis, timestamps ===
// const processMessage = (m) => {
//   let stockData = m.content || "";

//   // Handle embeds
//   if (m.embeds.length > 0) {
//     stockData = m.embeds
//       .map((e) => {
//         let desc = e.description ?? "";
//         if (e.fields?.length) {
//           desc += "\n" + e.fields.map((f) => `${f.name}: ${f.value}`).join("\n");
//         }
//         if (e.title) {
//           desc = `${e.title}\n${desc}`;
//         }
//         return desc;
//       })
//       .join("\n");
//   }

//   // Convert custom Discord emojis to <img>
//   stockData = stockData.replace(/<:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) => {
//     return `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" style="width:20px;height:20px;vertical-align:middle;" />`;
//   });

//   // Convert Discord relative timestamps <t:...:R>
//   stockData = stockData.replace(/<t:(\d+):R>/g, (match, ts) => {
//     const date = new Date(parseInt(ts) * 1000);
//     return date.toLocaleTimeString();
//   });

//   // Convert markdown bold
//   stockData = stockData.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

//   return {
//     author: m.author.username,
//     content: stockData,
//     timestamp: m.createdTimestamp,
//   };
// };

// // === Discord Bot Ready ===
// client.once("clientReady", async () => {
//   console.log(`🤖 Logged in as ${client.user.tag}`);

//   try {
//     const channel = await client.channels.fetch(CHANNEL_ID);
//     if (!channel) return console.error("❌ Could not fetch channel.");

//     // Fetch last 2 messages for past + current
//     const messages = await channel.messages.fetch({ limit: 2 });
//     latestMessages = messages.map(processMessage).sort((a, b) => a.timestamp - b.timestamp);

//     console.log("✅ Initial messages fetched");

//     // Listen for new messages
//     client.on("messageCreate", (message) => {
//       if (message.channel.id !== CHANNEL_ID) return;

//       const processed = processMessage(message);
//       latestMessages.push(processed);

//       // Keep only last 2 messages
//       if (latestMessages.length > 2) latestMessages.shift();

//       console.log("📨 New stock message:", processed);

//       // Send latest messages to all SSE clients
//       clients.forEach((res) => {
//         res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);
//       });
//     });
//   } catch (err) {
//     console.error("❌ Error fetching messages:", err);
//   }
// });

// client.login(process.env.DISCORD_TOKEN);

// // === SSE Server ===
// const clients = new Set();

// const server = createServer((req, res) => {
//   if (req.url === "/api/live-stock") {
//     console.log("🌐 Client connected");

//     res.writeHead(200, {
//       "Content-Type": "text/event-stream",
//       "Cache-Control": "no-cache",
//       Connection: "keep-alive",
//       "Access-Control-Allow-Origin": "*",
//     });

//     clients.add(res);

//     // Send initial latest messages
//     res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);

//     req.on("close", () => {
//       clients.delete(res);
//       console.log("❌ Client disconnected");
//     });
//   } else {
//     res.writeHead(404);
//     res.end();
//   }
// });

// server.listen(5000, () => console.log("📡 SSE server running on port 5000"));

