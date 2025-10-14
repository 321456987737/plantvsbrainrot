import { createServer } from "http";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

// === Discord Client ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_ID = process.env.CHANNEL_ID;
let latestMessages = [];

// === Helper: process messages, embeds, emojis, timestamps ===
const processMessage = (m) => {
  let stockData = m.content || "";

  // Handle embeds
  if (m.embeds.length > 0) {
    stockData = m.embeds
      .map((e) => {
        let desc = e.description ?? "";
        if (e.fields?.length) {
          desc += "\n" + e.fields.map((f) => `${f.name}: ${f.value}`).join("\n");
        }
        if (e.title) {
          desc = `${e.title}\n${desc}`;
        }
        return desc;
      })
      .join("\n");
  }

  // Convert custom Discord emojis to <img>
  stockData = stockData.replace(/<:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) => {
    return `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" style="width:20px;height:20px;vertical-align:middle;" />`;
  });

  // Convert Discord relative timestamps <t:...:R>
  stockData = stockData.replace(/<t:(\d+):R>/g, (match, ts) => {
    const date = new Date(parseInt(ts) * 1000);
    return date.toLocaleTimeString();
  });

  // Convert markdown bold
  stockData = stockData.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return {
    author: m.author.username,
    content: stockData,
    timestamp: m.createdTimestamp,
  };
};

// === Discord Bot Ready ===
client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.error("❌ Could not fetch channel.");

    // Fetch last 2 messages for past + current
    const messages = await channel.messages.fetch({ limit: 2 });
    latestMessages = messages.map(processMessage).sort((a, b) => a.timestamp - b.timestamp);

    console.log("✅ Initial messages fetched");

    // Listen for new messages
    client.on("messageCreate", (message) => {
      if (message.channel.id !== CHANNEL_ID) return;

      const processed = processMessage(message);
      latestMessages.push(processed);

      // Keep only last 2 messages
      if (latestMessages.length > 2) latestMessages.shift();

      console.log("📨 New stock message:", processed);

      // Send latest messages to all SSE clients
      clients.forEach((res) => {
        res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);
      });
    });
  } catch (err) {
    console.error("❌ Error fetching messages:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);

// === SSE Server ===
const clients = new Set();

const server = createServer((req, res) => {
  if (req.url === "/api/live-stock") {
    console.log("🌐 Client connected");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    clients.add(res);

    // Send initial latest messages
    res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);

    req.on("close", () => {
      clients.delete(res);
      console.log("❌ Client disconnected");
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(5000, () => console.log("📡 SSE server running on port 5000"));


// // bot/index.js
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

//   // Convert Discord relative timestamps <t:1760359505:R>
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
//     if (!channel) {
//       console.error("❌ Could not fetch channel. Check CHANNEL_ID in .env");
//       return;
//     }
//     console.log(`📡 Listening to messages in: ${channel.name} (${channel.id})`);

//     const fetchMessages = async () => {
//       try {
//         const messages = await channel.messages.fetch({ limit: 2 });
//         if (!messages.size) {
//           console.warn("⚠️ No messages found in channel yet.");
//           return;
//         }

//         latestMessages = messages.map(processMessage);

//         console.log("✅ Latest messages fetched:");
//         latestMessages.forEach((m) => console.log(m.author, "-", m.timestamp));
//       } catch (err) {
//         console.error("❌ Error fetching messages:", err);
//       }
//     };

//     // Initial fetch
//     await fetchMessages();

//     // Repeat every 50 seconds
//     setInterval(fetchMessages, 300000 );
//   } catch (err) {
//     console.error("❌ Error fetching channel:", err);
//   }
// });

// client.login(process.env.DISCORD_TOKEN);

// // === SSE Server ===
// const clients = new Set();

// const server = createServer((req, res) => {
//   if (req.url === "/api/live-stock") {
//     console.log("🌐 Client connected to SSE endpoint");

//    //  res.writeHead(200, {
//    //    "Content-Type": "text/event-stream",
//    //    "Cache-Control": "no-cache",
//    //    Connection: "keep-alive",
//    //  });
// res.writeHead(200, {
//   "Content-Type": "text/event-stream",
//   "Cache-Control": "no-cache",
//   Connection: "keep-alive",
//   "Access-Control-Allow-Origin": "*", // allow requests from any origin
// });
//     clients.add(res);

//     // Send initial data
//     res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);

//     const interval = setInterval(() => {
//       res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);
//     }, 300000 );

//     req.on("close", () => {
//       clearInterval(interval);
//       clients.delete(res);
//       console.log("❌ Client disconnected from SSE");
//     });
//   } else {
//     res.writeHead(404);
//     res.end();
//   }
// });

// server.listen(5000, () => console.log("📡 SSE server running on port 5000"));















// // bot/index.js
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

// // Helper function to process messages including embeds
// const processMessage = (m) => {
//   let stockData = m.content || "";

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
//     if (!channel) {
//       console.error("❌ Could not fetch channel. Check CHANNEL_ID in .env");
//       return;
//     }
//     console.log(`📡 Listening to messages in: ${channel.name} (${channel.id})`);

//     const fetchMessages = async () => {
//       try {
//         const messages = await channel.messages.fetch({ limit: 10 });
//         if (!messages.size) {
//           console.warn("⚠️ No messages found in channel yet.");
//           return;
//         }

//         latestMessages = messages.map(processMessage);

//         console.log("✅ Latest messages fetched:");
//         console.log(latestMessages);
//       } catch (err) {
//         console.error("❌ Error fetching messages:", err);
//       }
//     };

//     // Initial fetch
//     await fetchMessages();

//     // Repeat every 5 seconds
//     setInterval(fetchMessages, 50000);
//   } catch (err) {
//     console.error("❌ Error fetching channel:", err);
//   }
// });

// client.login(process.env.DISCORD_TOKEN);

// // === SSE Server ===
// const clients = new Set();

// const server = createServer((req, res) => {
//   if (req.url === "/api/live-stock") {
//     console.log("🌐 Client connected to SSE endpoint");

//     res.writeHead(200, {
//       "Content-Type": "text/event-stream",
//       "Cache-Control": "no-cache",
//       Connection: "keep-alive",
//     });

//     clients.add(res);

//     // Send initial data
//     res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);

//     const interval = setInterval(() => {
//       res.write(`data: ${JSON.stringify(latestMessages)}\n\n`);
//     }, 5000);

//     req.on("close", () => {
//       clearInterval(interval);
//       clients.delete(res);
//       console.log("❌ Client disconnected from SSE");
//     });
//   }
// });

// server.listen(5000, () => console.log("📡 SSE server running on port 5000"));




