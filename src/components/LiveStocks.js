// app/discord/page.js
"use client";

import { useEffect, useRef, useState } from "react";

/* ========== Helper: parseItemsFromHtml ========== */
function parseItemsFromHtml(htmlContent) {
  if (!htmlContent) return { seeds: [], gear: [] };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const extractSection = (name) => {
      const header = Array.from(doc.querySelectorAll("strong")).find(
        (el) => el.textContent.trim() === name
      );
      if (!header) return [];
      const items = [];
      let el = header.nextElementSibling;
      while (el && el.tagName !== "STRONG") {
        if (el.tagName === "IMG") {
          items.push({
            img: el.src,
            name: el.alt,
            quantity: el.nextSibling?.textContent?.trim() || "",
          });
        } else if (el.tagName === "DIV") {
          el.querySelectorAll("img").forEach((i) =>
            items.push({
              img: i.src,
              name: i.alt,
              quantity: i.nextSibling?.textContent?.trim() || "",
            })
          );
        }
        el = el.nextElementSibling;
      }
      return items;
    };

    return { seeds: extractSection("Seeds"), gear: extractSection("Gear") };
  } catch (err) {
    console.error("parseItems error:", err);
    return { seeds: [], gear: [] };
  }
}

/* ========== Card render helpers ========== */
function StockCard({ stock, variant = "current" }) {
  if (!stock) return null;
  const sections = parseItemsFromHtml(stock.content);
  const isCurrent = variant === "current";
  const cardClass = isCurrent
    ? "bg-white shadow-lg border-l-4 border-green-500"
    : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

  return (
    <div key={stock.id || stock.createdAt} className={`${cardClass} rounded-lg p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
            alt="Bot Logo"
            className="w-10 h-10 rounded-full"
          />
          <p className="font-semibold text-gray-700">{stock.author}</p>
        </div>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>

      {sections.seeds?.length > 0 && (
        <div className="mb-3">
          <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
          {sections.seeds.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1"
            >
              <img src={item.img} alt={item.name} className="w-6 h-6" />
              <span className="font-semibold">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {sections.gear?.length > 0 && (
        <div>
          <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
          {sections.gear.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1"
            >
              <img src={item.img} alt={item.name} className="w-6 h-6" />
              <span className="font-semibold">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GenericHtmlCard({ msg, variant = "current" }) {
  if (!msg) return null;
  const isCurrent = variant === "current";
  const cardClass = isCurrent
    ? "bg-white shadow-lg border-l-4 border-green-500"
    : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

  return (
    <div key={msg.id || msg.createdAt} className={`${cardClass} rounded-lg p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
            alt="Bot Logo"
            className="w-10 h-10 rounded-full"
          />
          <p className="font-semibold text-gray-700">{msg.author}</p>
        </div>
        <small className="text-gray-500">
          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>

      <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: msg.content }} />
    </div>
  );
}

/* ========== Main Unified Layout ========== */
export default function LiveDiscordUnified() {
  const [channelsState, setChannelsState] = useState({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const esRef = useRef(null);

  useEffect(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource("/api/discord?stream=true");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setLoading(false);
      console.log("SSE connected to /api/discord");
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "INITIAL_DATA") {
          setChannelsState(data.channels || {});
        } else if (data.type === "NEW_BATCH") {
          const { channel, messages } = data;
          setChannelsState((prev) => ({ ...prev, [channel]: messages.slice(-2) }));
        }
      } catch (err) {
        console.error("Failed to parse SSE data:", err, ev.data);
      }
    };

    es.onerror = (err) => {
      console.warn("SSE error:", err);
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const getMessages = (key) => {
    const msgs = channelsState[key] || [];
    return {
      current: msgs[msgs.length - 1] || null,
      previous: msgs[msgs.length - 2] || null,
    };
  };

  const liveStock = getMessages("LiveStock");
  const weather = getMessages("Weather");
  const predictor = getMessages("StockPredictor");

  return (
    <div className="max-w-6xl mx-auto sm:p-4">
      <div className="flex items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <h1 className="sm:text-3xl text-2xl font-bold">Live Dashboard</h1>
          <div
            className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
      </div>

      {/* Layout: LiveStock on top, Weather + Predictor side-by-side on large, stacked on small */}
      <div className="flex flex-col gap-6">
        {/* Live Stock (top always full width) */}
        <div className="bg-gray-50 rounded-xl p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 text-green-700">Live Stock</h2>
          <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
          <StockCard stock={liveStock.current} />
          <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
          <StockCard stock={liveStock.previous} variant="past" />
        </div>

        {/* Bottom grid for Weather + Predictor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weather Section */}
          <div className="bg-gray-50 rounded-xl p-6 shadow">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Weather</h2>
            <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
            <GenericHtmlCard msg={weather.current} />
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
            <GenericHtmlCard msg={weather.previous} variant="past" />
          </div>

          {/* Stock Predictor Section */}
          <div className="bg-gray-50 rounded-xl p-6 shadow">
            <h2 className="text-xl font-semibold mb-4 text-purple-700">Stock Predictor</h2>
            <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
            <GenericHtmlCard msg={predictor.current} />
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
            <GenericHtmlCard msg={predictor.previous} variant="past" />
          </div>
        </div>
      </div>
    </div>
  );
}



// // app/discord/page.js
// "use client";

// import { useEffect, useRef, useState } from "react";

// /* ========== Helper: parseItems (same logic you had) ========== */
// function parseItemsFromHtml(htmlContent) {
//   if (!htmlContent) return { seeds: [], gear: [] };
//   try {
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(htmlContent, "text/html");

//     const extractSection = (name) => {
//       const header = Array.from(doc.querySelectorAll("strong")).find(
//         (el) => el.textContent.trim() === name
//       );
//       if (!header) return [];
//       const items = [];
//       let el = header.nextElementSibling;
//       while (el && el.tagName !== "STRONG") {
//         if (el.tagName === "IMG") {
//           items.push({
//             img: el.src,
//             name: el.alt,
//             quantity: el.nextSibling?.textContent?.trim() || "",
//           });
//         } else if (el.tagName === "DIV") {
//           el.querySelectorAll("img").forEach((i) =>
//             items.push({
//               img: i.src,
//               name: i.alt,
//               quantity: i.nextSibling?.textContent?.trim() || "",
//             })
//           );
//         }
//         el = el.nextElementSibling;
//       }
//       return items;
//     };

//     return { seeds: extractSection("Seeds"), gear: extractSection("Gear") };
//   } catch (err) {
//     console.error("parseItems error:", err);
//     return { seeds: [], gear: [] };
//   }
// }

// /* ========== Card render helpers (shared styles) ========== */

// function StockCard({ stock, variant = "current" }) {
//   if (!stock) return null;
//   const sections = parseItemsFromHtml(stock.content);
//   const isCurrent = variant === "current";
//   const cardClass = isCurrent
//     ? "bg-white shadow-lg border-l-4 border-green-500"
//     : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

//   return (
//     <div key={stock.id || stock.createdAt} className={`${cardClass} rounded-lg p-4 mb-4`}>
//       <div className="flex items-center justify-between mb-3">
//         <div className="flex items-center gap-3">
//           <img
//             src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
//             alt="Bot Logo"
//             className="w-10 h-10 rounded-full"
//           />
//           <p className="font-semibold text-gray-700">{stock.author}</p>
//         </div>
//         <small className="text-gray-500">
//           {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
//         </small>
//       </div>

//       {sections.seeds?.length > 0 && (
//         <div className="mb-3">
//           <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
//           {sections.seeds.map((item, i) => (
//             <div
//               key={i}
//               className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//             >
//               <div className="flex items-center gap-2">
//                 <img src={item.img} alt={item.name} className="w-6 h-6" />
//               </div>
//               <span className="font-semibold">{item.quantity}</span>
//             </div>
//           ))}
//         </div>
//       )}

//       {sections.gear?.length > 0 && (
//         <div>
//           <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
//           {sections.gear.map((item, i) => (
//             <div
//               key={i}
//               className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//             >
//               <div className="flex items-center gap-2">
//                 <img src={item.img} alt={item.name} className="w-6 h-6" />
//               </div>
//               <span className="font-semibold">{item.quantity}</span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// function GenericHtmlCard({ msg, variant = "current" }) {
//   if (!msg) return null;
//   const isCurrent = variant === "current";
//   const cardClass = isCurrent
//     ? "bg-white shadow-lg border-l-4 border-green-500"
//     : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

//   return (
//     <div key={msg.id || msg.createdAt} className={`${cardClass} rounded-lg p-4 mb-4`}>
//       <div className="flex items-center justify-between mb-3">
//         <div className="flex items-center gap-3">
//           <img
//             src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
//             alt="Bot Logo"
//             className="w-10 h-10 rounded-full"
//           />
//           <p className="font-semibold text-gray-700">{msg.author}</p>
//         </div>
//         <small className="text-gray-500">
//           {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
//         </small>
//       </div>

//       <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: msg.content }} />
//     </div>
//   );
// }

// /* ========== Main component: Unified single-section UI with tabs ========== */

// export default function LiveDiscordUnified() {
//   const [channelsState, setChannelsState] = useState({}); // { LiveStock: [...], Weather: [...], StockPredictor: [...] }
//   const [connected, setConnected] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [selectedChannel, setSelectedChannel] = useState("LiveStock");
//   const esRef = useRef(null);

//   // list of channel tabs and their display titles
//   const channelTabs = [
//     { key: "LiveStock", title: "Live Stock" },
//     { key: "Weather", title: "Weather" },
//     { key: "StockPredictor", title: "Stock Predictor" },
//   ];

//   useEffect(() => {
//     if (esRef.current) esRef.current.close();
//     const es = new EventSource("/api/discord?stream=true");
//     esRef.current = es;

//     es.onopen = () => {
//       setConnected(true);
//       setLoading(false);
//       console.log("SSE connected to /api/discord");
//     };

//     es.onmessage = (ev) => {
//       try {
//         const data = JSON.parse(ev.data);
//         console.log("SSE message received:", data); // helpful console to see channel + payload

//         if (data.type === "INITIAL_DATA") {
//           // data.channels: { LiveStock: [...], Weather: [...], StockPredictor: [...] }
//           setChannelsState(data.channels || {});
//         } else if (data.type === "NEW_BATCH") {
//           const { channel, messages } = data;
//           setChannelsState((prev) => ({ ...prev, [channel]: messages.slice(-2) }));
//         }
//       } catch (err) {
//         console.error("Failed to parse SSE data:", err, ev.data);
//       }
//     };

//     es.onerror = (err) => {
//       console.warn("SSE error:", err);
//       setConnected(false);
//     };

//     return () => {
//       es.close();
//       esRef.current = null;
//     };
//   }, []);

//   // helpers to get current/previous for selected channel
//   const selectedMessages = channelsState[selectedChannel] || [];
//   const current = selectedMessages.length ? selectedMessages[selectedMessages.length - 1] : null;
//   const previous = selectedMessages.length > 1 ? selectedMessages[selectedMessages.length - 2] : null;

//   return (
//     <div className="max-w-5xl mx-auto sm:p-4">
//       <div className="flex items-center justify-between pb-6">
//         <div className="flex items-center gap-4">
//           <h1 className="sm:text-3xl text-2xl font-bold">Live Dashboard</h1>
//           <div
//             className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
//             title={connected ? "Connected" : "Disconnected"}
//           />
//         </div>

//         <div className="flex items-center gap-3">
//           <div className="hidden sm:flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm">
//             {channelTabs.map((tab) => (
//               <button
//                 key={tab.key}
//                 onClick={() => setSelectedChannel(tab.key)}
//                 className={`px-3 py-1 rounded-lg text-sm font-medium ${
//                   selectedChannel === tab.key ? "bg-gray-900 text-white" : "text-gray-700"
//                 }`}
//               >
//                 {tab.title}
//               </button>
//             ))}
//           </div>

//           <button
//             onClick={() => window.location.reload()}
//             className="bg-white hover:bg-gray-200 border-2 border-gray-400 hover:border-gray-700 text-black py-2 px-4 rounded cursor-pointer"
//           >
//             Refresh
//           </button>
//         </div>
//       </div>

//       {/* Mobile tabs (below header) */}
//       <div className="sm:hidden mb-4">
//         <div className="flex gap-2">
//           {channelTabs.map((tab) => (
//             <button
//               key={tab.key}
//               onClick={() => setSelectedChannel(tab.key)}
//               className={`flex-1 text-sm py-2 rounded-md font-medium ${
//                 selectedChannel === tab.key ? "bg-gray-900 text-white" : "bg-white text-gray-700"
//               }`}
//             >
//               {tab.title}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Main unified section */}
//       <div className="bg-gray-50 rounded-xl p-6 shadow">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-xl font-semibold">
//             {channelTabs.find((c) => c.key === selectedChannel)?.title || selectedChannel}
//           </h2>
//           <small className="text-gray-600">
//             Showing: <span className="font-medium">{selectedMessages.length} message(s)</span>
//           </small>
//         </div>

//         {/* Current */}
//         <div>
//           <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>

//           {selectedChannel === "LiveStock" ? (
//             <StockCard stock={current} variant="current" />
//           ) : (
//             <GenericHtmlCard msg={current} variant="current" />
//           )}

//           {!current && <p className="text-gray-400">No current message for this channel.</p>}
//         </div>

//         {/* Previous */}
//         <div className="mt-4">
//           <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>

//           {selectedChannel === "LiveStock" ? (
//             <StockCard stock={previous} variant="past" />
//           ) : (
//             <GenericHtmlCard msg={previous} variant="past" />
//           )}

//           {!previous && <p className="text-gray-400">No previous message for this channel.</p>}
//         </div>
//       </div>
//     </div>
//   );
// }
















// // app/discord/page.js
// "use client";

// import { useEffect, useRef, useState } from "react";

// export default function LiveStocks() {
//   const [messages, setMessages] = useState([]); // oldest -> newest
//   const [connected, setConnected] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const eventSourceRef = useRef(null);

//   useEffect(() => {
//     function setupEventSource() {
//       if (eventSourceRef.current) {
//         eventSourceRef.current.close();
//       }

//       eventSourceRef.current = new EventSource("/api/discord?stream=true");

//       eventSourceRef.current.onopen = () => {
//         setConnected(true);
//         setLoading(false);
//         console.log("SSE connected");
//       };

//       eventSourceRef.current.onmessage = (ev) => {
//         try {
//           const data = JSON.parse(ev.data);
//           if (data.type === "INITIAL_DATA") {
//             // ensure it's oldest -> newest and keep only 2
//             const arr = Array.isArray(data.messages) ? data.messages : [];
//             const lastTwo = arr.slice(-2);
//             setMessages(lastTwo);
//           } else if (data.type === "NEW_BATCH") {
//             // incoming is expected oldest -> newest
//             const arr = Array.isArray(data.messages) ? data.messages : [];
//             const lastTwo = arr.slice(-2);
//             setMessages(lastTwo);
//           }
//         } catch (err) {
//           console.error("Error parsing SSE message:", err);
//         }
//       };

//       eventSourceRef.current.onerror = (err) => {
//         console.warn("SSE error", err);
//         setConnected(false);
//         // EventSource auto-reconnects; show a notice to user
//       };
//     }

//     setupEventSource();

//     return () => {
//       if (eventSourceRef.current) {
//         eventSourceRef.current.close();
//         eventSourceRef.current = null;
//       }
//     };
//   }, []);

//   // parse items out of message.content (safe: we only read img.src and alt and textContent)
//   const parseItems = (htmlContent) => {
//     if (!htmlContent) return { seeds: [], gear: [] };
//     try {
//       const parser = new DOMParser();
//       const doc = parser.parseFromString(htmlContent, "text/html");

//       const extractSection = (name) => {
//         const header = Array.from(doc.querySelectorAll("strong")).find(
//           (el) => el.textContent.trim() === name
//         );
//         if (!header) return [];
//         const items = [];
//         let el = header.nextElementSibling;
//         while (el && el.tagName !== "STRONG") {
//           if (el.tagName === "IMG") {
//             const src = validateImageUrl(el.src);
//             const alt = el.alt || "";
//             const quantity = el.nextSibling?.textContent?.trim() || "";
//             if (src) items.push({ img: src, name: alt, quantity });
//           } else if (el.tagName === "DIV") {
//             el.querySelectorAll("img").forEach((i) => {
//               const src = validateImageUrl(i.src);
//               const alt = i.alt || "";
//               const quantity = i.nextSibling?.textContent?.trim() || "";
//               if (src) items.push({ img: src, name: alt, quantity });
//             });
//           }
//           el = el.nextElementSibling;
//         }
//         return items;
//       };

//       return { seeds: extractSection("Seeds"), gear: extractSection("Gear") };
//     } catch (err) {
//       console.error("parseItems error:", err);
//       return { seeds: [], gear: [] };
//     }
//   };

//   // Only allow https image urls to avoid weird schemes
//   const validateImageUrl = (u) => {
//     try {
//       const url = new URL(u, window.location.origin);
//       if (url.protocol === "https:" || url.protocol === "http:") return url.href;
//     } catch (e) {}
//     return null;
//   };

//   const renderStockCard = (stock, type) => {
//     const sections = parseItems(stock.content);
//     const isCurrent = type === "current";
//     const cardClass = isCurrent
//       ? "bg-white shadow-lg border-l-4 border-green-500"
//       : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

//     return (
//       <div
//         key={stock.id || stock.createdAt}
//         className={`${cardClass} rounded-lg p-4 mb-4 transition-all`}
//       >
//         <div className="flex items-center justify-between mb-3">
//           <div className="flex items-center gap-3">
//             <img
//               src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
//               alt="Bot Logo"
//               className="w-10 h-10 rounded-full"
//             />
//             <p className="font-semibold text-gray-700">{stock.author}</p>
//           </div>
//           <small className="text-gray-500">
//             {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
//           </small>
//         </div>

//         {sections.seeds?.length > 0 && (
//           <div className="mb-3">
//             <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
//             {sections.seeds.map((item, i) => (
//               <div
//                 key={i}
//                 className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//               >
//                 <div className="flex items-center gap-2">
//                   <img src={item.img} alt={item.name} className="w-6 h-6" />
//                 </div>
//                 <span className="font-semibold">{item.quantity}</span>
//               </div>
//             ))}
//           </div>
//         )}

//         {sections.gear?.length > 0 && (
//           <div>
//             <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
//             {sections.gear.map((item, i) => (
//               <div
//                 key={i}
//                 className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//               >
//                 <div className="flex items-center gap-2">
//                   <img src={item.img} alt={item.name} className="w-6 h-6" />
//                 </div>
//                 <span className="font-semibold">{item.quantity}</span>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     );
//   };

//   // messages is oldest -> newest. current = newest
//   const current = messages.length > 0 ? messages[messages.length - 1] : null;
//   const previous = messages.length > 1 ? messages[messages.length - 2] : null;

//   return (
//     <div className="max-w-5xl mx-auto sm:p-4">
//       <div className="flex items-center justify-between pb-6">
//         <div className="flex items-center sm:gap-4 gap-1">
//           <h1 className="sm:text-3xl text-1xl font-bold text-center">Live Stocks Dashboard</h1>
//           <div
//             className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
//             title={connected ? "Connected" : "Disconnected"}
//           />
//         </div>
//         <button
//           onClick={() => window.location.reload()}
//           className="bg-white hover:bg-gray-200 border-2 border-gray-400 hover:border-gray-700  text-black sm:py-2 sm:px-4 py-0.5 px-2  rounded-2xl cursor-pointer"
//         >
//           Refresh
//         </button>
//       </div>

//       {loading && <p className="text-center text-gray-500">Loading…</p>}
//       {!loading && !connected && <p className="text-center text-yellow-600">Reconnecting…</p>}

//       {current && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-green-600">Current Stock</h2>
//           {renderStockCard(current, "current")}
//         </>
//       )}

//       {previous && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-gray-600">Previous Stock</h2>
//           {renderStockCard(previous, "past")}
//         </>
//       )}
//     </div>
//   );
// }
