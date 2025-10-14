import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const NEXT_API_URL = process.env.NEXT_API_URL; // e.g. "https://plantvsbrainrot-rho.vercel.app"
const POST_SECRET = process.env.DISCORD_POST_SECRET; // shared secret with Next.js
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN not set. Exiting.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// === Helper: POST data to Next.js API ===
async function postToNext(payload) {
  if (!NEXT_API_URL || !POST_SECRET) return;

  try {
    console.log(1);
    await fetch(`${NEXT_API_URL}/api/discord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": POST_SECRET,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to POST to Next.js:", err?.message || err);
  }
}

// === Helper: process messages, embeds, emojis, timestamps ===
const processMessage = (m) => {
  let stockData = m.content || "";

  console.log(2);

  // Handle embeds
  if (m.embeds && m.embeds.length > 0) {
    stockData = m.embeds
      .map((e) => {
        let desc = e.description ?? "";

        if (e.fields?.length) {
          desc +=
            "\n" +
            e.fields.map((f) => `${f.name}: ${f.value}`).join("\n");
        }

        if (e.title) {
          desc = `${e.title}\n${desc}`;
        }

        return desc;
      })
      .join("\n");
  }

  console.log(3);

  // Convert custom Discord emojis to <img>
  stockData = stockData.replace(
    /<:([a-zA-Z0-9_]+):(\d+)>/g,
    (match, name, id) => {
      return `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" style="width:20px;height:20px;vertical-align:middle;" />`;
    }
  );

  // Convert Discord relative timestamps <t:...:R> to local time string
  stockData = stockData.replace(/<t:(\d+):R>/g, (match, ts) => {
    const date = new Date(parseInt(ts, 10) * 1000);
    return date.toLocaleTimeString();
  });

  // Convert markdown bold
  stockData = stockData.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return {
    id: m.id,
    author: m.author?.username || "Unknown",
    content: stockData,
    createdAt: m.createdTimestamp, // epoch ms
  };
};

// === When bot is ready ===
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    if (!CHANNEL_ID) {
      console.warn("CHANNEL_ID not set — bot will not fetch initial messages.");
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("❌ Could not fetch channel.");
      return;
    }

    // Fetch last 2 messages
    const messages = await channel.messages.fetch({ limit: 2 });
    const latestMessages = messages
      .map(processMessage)
      .sort((a, b) => a.createdAt - b.createdAt);

    console.log("✅ Initial messages fetched");

    // Send initial messages (so UI sees something immediately)
    for (const msg of latestMessages) {
      await postToNext(msg);
    }
  } catch (err) {
    console.error("❌ Error fetching messages:", err);
  }
});

// === On new message ===
client.on("messageCreate", async (message) => {
  try {
    console.log(10);

    // Skip bots and unrelated channels
    if (message.author?.bot) return;
    if (CHANNEL_ID && message.channel?.id !== CHANNEL_ID) return;

    const processed = processMessage(message);
    console.log("📨 New stock message:", processed);

    // Push to Next.js UI
    await postToNext({
      id: processed.id,
      author: processed.author,
      content: processed.content,
      createdAt: processed.createdAt,
    });

    console.log("Posted to Next.js successfully");
  } catch (err) {
    console.error("Error handling messageCreate:", err);
  }
});

console.log(11);

// === Login the bot ===
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
  process.exit(1);
});

          // // bot/index.js
// import { Client, GatewayIntentBits } from "discord.js";
// import dotenv from "dotenv";
// dotenv.config();

// const NEXT_API_URL = process.env.NEXT_API_URL; // e.g. "https://plantvsbrainrot-rho.vercel.app"
// const POST_SECRET = process.env.DISCORD_POST_SECRET; // shared secret with Next.js
// const CHANNEL_ID = process.env.CHANNEL_ID;

// if (!process.env.DISCORD_TOKEN) {
//   console.error("DISCORD_TOKEN not set. Exiting.");
//   process.exit(1);
// }

// const client = new Client({
//   intents: [
//     GatewayIntentBits.Guilds,
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.MessageContent,
//   ],
// });

// // small helper to POST to Next.js
// async function postToNext(payload) {
//   if (!NEXT_API_URL || !POST_SECRET) return;
//   try {
//     // Node 18+/22 has global fetch; this will also work on Render
//     console.log(1)
//     await fetch(`${NEXT_API_URL}/api/discord`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-bot-secret": POST_SECRET,
//       },
//       body: JSON.stringify(payload),
//     });
//   } catch (err) {
//     console.error("Failed to POST to Next.js:", err?.message || err);
//   }
// }

// // === Helper: process messages, embeds, emojis, timestamps ===
// const processMessage = (m) => {
//   let stockData = m.content || "";

//   // Handle embeds
//       console.log(2)

//   if (m.embeds && m.embeds.length > 0) {
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
//     console.log(3)

//   // Convert custom Discord emojis to <img>
//   stockData = stockData.replace(/<:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) => {
//     return `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" style="width:20px;height:20px;vertical-align:middle;" />`;
//   });

//   // Convert Discord relative timestamps <t:...:R> to local time string
//   stockData = stockData.replace(/<t:(\d+):R>/g, (match, ts) => {
//     const date = new Date(parseInt(ts, 10) * 1000);
//     return date.toLocaleTimeString();
//   });

//   // Convert markdown bold
//   stockData = stockData.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

//   return {
//     id: m.id,
//     author: m.author?.username || "Unknown",
//     content: stockData,
//     createdAt: m.createdTimestamp, // epoch ms
//   };
// };

// // When bot is ready
// client.once("clientReady ", async () => {
//   console.log(`🤖 Logged in as ${client.user.tag}`);

//   try {
//     if (!CHANNEL_ID) {
//       console.warn("CHANNEL_ID not set — bot will not fetch initial messages.");
//       return;
//     }

//     const channel = await client.channels.fetch(CHANNEL_ID);
//     if (!channel) {
//       console.error("❌ Could not fetch channel.");
//       return;
//     }

//     // Fetch last 2 messages
//     const messages = await channel.messages.fetch({ limit: 2 });
//     const latestMessages = messages.map(processMessage).sort((a, b) => a.createdAt - b.createdAt);
//     console.log(latestMessages,"latest mesagea")
//     console.log("✅ Initial messages fetched");

//     // Send initial messages (so UI sees something immediately)
//     for (const msg of latestMessages) {
//       // POST each initial message (this is fine, Next.js will buffer)
//       postToNext(msg);
//     }
//   } catch (err) {
//     console.error("❌ Error fetching messages:", err);
//   }
// });

// client.on("messageCreate", async (message) => {
//   try {
//         console.log(10)

//     // skip bots and unrelated channels
//     // if (message.author?.bot) return;
//     if (CHANNEL_ID && message.channel?.id !== CHANNEL_ID) return;

//     const processed = processMessage(message);
//     console.log("📨 New stock message:", processed);

//     // Push to Next.js UI
//     await postToNext({
//       id: processed.id,
//       author: processed.author,
//       content: processed.content,
//       createdAt: processed.createdAt,
//     });
//     console.log(postToNext,"podttonext")
//   } catch (err) {
//     console.error("Error handling messageCreate:", err);
//   }
// });    console.log(11)


// client.login(process.env.DISCORD_TOKEN).catch((err) => {
//   console.error("Failed to login:", err);
//   process.exit(1);
// });




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

