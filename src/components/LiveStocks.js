// app/discord/page.js
"use client";

import { useEffect, useRef, useState } from "react";

export default function LiveStocks() {
  const [messages, setMessages] = useState([]); // oldest -> newest
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    function setupEventSource() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      eventSourceRef.current = new EventSource("/api/discord?stream=true");

      eventSourceRef.current.onopen = () => {
        setConnected(true);
        setLoading(false);
        console.log("SSE connected");
      };

      eventSourceRef.current.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "INITIAL_DATA") {
            // ensure it's oldest -> newest and keep only 2
            const arr = Array.isArray(data.messages) ? data.messages : [];
            const lastTwo = arr.slice(-2);
            setMessages(lastTwo);
          } else if (data.type === "NEW_BATCH") {
            // incoming is expected oldest -> newest
            const arr = Array.isArray(data.messages) ? data.messages : [];
            const lastTwo = arr.slice(-2);
            setMessages(lastTwo);
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };

      eventSourceRef.current.onerror = (err) => {
        console.warn("SSE error", err);
        setConnected(false);
        // EventSource auto-reconnects; show a notice to user
      };
    }

    setupEventSource();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // parse items out of message.content (safe: we only read img.src and alt and textContent)
  const parseItems = (htmlContent) => {
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
            const src = validateImageUrl(el.src);
            const alt = el.alt || "";
            const quantity = el.nextSibling?.textContent?.trim() || "";
            if (src) items.push({ img: src, name: alt, quantity });
          } else if (el.tagName === "DIV") {
            el.querySelectorAll("img").forEach((i) => {
              const src = validateImageUrl(i.src);
              const alt = i.alt || "";
              const quantity = i.nextSibling?.textContent?.trim() || "";
              if (src) items.push({ img: src, name: alt, quantity });
            });
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
  };

  // Only allow https image urls to avoid weird schemes
  const validateImageUrl = (u) => {
    try {
      const url = new URL(u, window.location.origin);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch (e) {}
    return null;
  };

  const renderStockCard = (stock, type) => {
    const sections = parseItems(stock.content);
    const isCurrent = type === "current";
    const cardClass = isCurrent
      ? "bg-white shadow-lg border-l-4 border-green-500"
      : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

    return (
      <div
        key={stock.id || stock.createdAt}
        className={`${cardClass} rounded-lg p-4 mb-4 transition-all`}
      >
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
                className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
              >
                <div className="flex items-center gap-2">
                  <img src={item.img} alt={item.name} className="w-6 h-6" />
                </div>
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
                className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
              >
                <div className="flex items-center gap-2">
                  <img src={item.img} alt={item.name} className="w-6 h-6" />
                </div>
                <span className="font-semibold">{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // messages is oldest -> newest. current = newest
  const current = messages.length > 0 ? messages[messages.length - 1] : null;
  const previous = messages.length > 1 ? messages[messages.length - 2] : null;

  return (
    <div className="max-w-5xl mx-auto sm:p-4">
      <div className="flex items-center justify-between pb-6">
        <div className="flex items-center sm:gap-4 gap-1">
          <h1 className="sm:text-3xl text-1xl font-bold text-center">Live Stocks Dashboard</h1>
          <div
            className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-white hover:bg-gray-200 border-2 border-gray-400 hover:border-gray-700  text-white sm:py-2 sm:px-4 py-0.5 px-2  rounded-2xl cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-center text-gray-500">Loading…</p>}
      {!loading && !connected && <p className="text-center text-yellow-600">Reconnecting…</p>}

      {current && (
        <>
          <h2 className="text-xl font-semibold mb-2 text-green-600">Current Stock</h2>
          {renderStockCard(current, "current")}
        </>
      )}

      {previous && (
        <>
          <h2 className="text-xl font-semibold mb-2 text-gray-600">Previous Stock</h2>
          {renderStockCard(previous, "past")}
        </>
      )}
    </div>
  );
}

// "use client";

// import { useEffect, useState, useRef } from "react";

// export default function LiveStocks() {
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [connected, setConnected] = useState(false);
//   const eventSourceRef = useRef(null);

//   useEffect(() => {
//     // Set up Server-Sent Events connection
//     const setupEventSource = () => {
//       if (eventSourceRef.current) {
//         eventSourceRef.current.close();
//       }

//       eventSourceRef.current = new EventSource('/api/discord?stream=true');

//       eventSourceRef.current.onopen = () => {
//         console.log("Connected to real-time updates");
//         setConnected(true);
//         setLoading(false);
//       };

//       eventSourceRef.current.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
          
//           if (data.type === "INITIAL_DATA") {
//             setMessages(data.messages || []);
//           } else if (data.type === "NEW_MESSAGE") {
//             setMessages(prev => {
//               // Avoid duplicates
//               if (prev.some(msg => msg.id === data.message.id)) {
//                 return prev;
//               }
//               return [...prev, data.message];
//             });
//           }
//         } catch (error) {
//           console.error("Error parsing SSE data:", error);
//         }
//       };

//       eventSourceRef.current.onerror = (error) => {
//         console.error("SSE error:", error);
//         setConnected(false);
        
//         // Attempt reconnect after 3 seconds
//         setTimeout(() => {
//           if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
//             setupEventSource();
//           }
//         }, 3000);
//       };
//     };

//     setupEventSource();

//     // Cleanup on unmount
//     return () => {
//       if (eventSourceRef.current) {
//         eventSourceRef.current.close();
//         eventSourceRef.current = null;
//       }
//     };
//   }, []);

//   const parseItems = (htmlContent) => {
//     if (!htmlContent) return { seeds: [], gear: [] };
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(htmlContent, "text/html");
//     const sections = {};
    
//     const extractSection = (name) => {
//       const header = Array.from(doc.querySelectorAll("strong")).find(
//         (el) => el.textContent === name
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
//       console.log(sections)
//     sections.seeds = extractSection("Seeds");
//     sections.gear = extractSection("Gear");
//     return sections;
//   };

//   const sorted = [...messages].sort(
//     (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
//   );
//   const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;
//   const past = sorted.slice(0, Math.max(0, sorted.length - 1));

//   const renderStockCard = (stock, type) => {
//     const sections = parseItems(stock.content);
//     const cardClass =
//       type === "current"
//         ? "bg-white shadow-lg border-l-4 border-green-500"
//         : "bg-gray-50 shadow-sm border-l-4 border-gray-300";
    
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
//             {stock.createdAt
//               ? new Date(stock.createdAt).toLocaleTimeString()
//               : ""}
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

//   return (
//     <div className="max-w-5xl mx-auto sm:p-4">
//       <div className="flex items-center justify-between pb-6">
//         <div className="flex items-center gap-4">
//           <h1 className="sm:text-3xl text-2xl font-bold text-center">
//             Live Stocks Dashboard
//           </h1>
//           <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} 
//                title={connected ? 'Connected' : 'Disconnected'} />
//         </div>
//         <button
//           onClick={() => {
//             // Manual refresh if needed
//             window.location.reload();
//           }}
//           className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer"
//         >
//           Refresh
//         </button>
//       </div>
      
//       {loading && <p className="text-center text-gray-500">Loading…</p>}
      
//       {!loading && !connected && (
//         <p className="text-center text-yellow-600">Reconnecting…</p>
//       )}

//       {current && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-green-600">
//             Current Stock
//           </h2>
//           {renderStockCard(current, "current")}
//         </>
//       )}
      
//       {past.length > 0 && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-gray-600">
//             Past Stocks
//           </h2>
//           {past.map((s) => renderStockCard(s, "past"))}
//         </>
//       )}
//     </div>
//   );
// }
