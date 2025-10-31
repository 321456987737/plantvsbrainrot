"use client";

import { useEffect, useRef, useState } from "react";

/* ===========================================================
   🧠 Parser 1 (Section-based for LiveStock)
=========================================================== */
function parseItemsFromHtml_v1(htmlContent) {
  if (!htmlContent) return { seeds: [], gear: [] };

  try {
    const lower = htmlContent.toLowerCase();
    const seedsStart = lower.indexOf("seeds stock:");
    const gearStart = lower.indexOf("gear stock:");

    const seedsHtml =
      seedsStart !== -1 && gearStart !== -1
        ? htmlContent.slice(seedsStart + 12, gearStart)
        : seedsStart !== -1
        ? htmlContent.slice(seedsStart + 12)
        : "";

    const gearHtml = gearStart !== -1 ? htmlContent.slice(gearStart + 11) : "";

    const parseSection = (sectionHtml) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sectionHtml, "text/html");
      const items = [];

      doc.querySelectorAll("img").forEach((el) => {
        let quantity = "";

        if (el.nextElementSibling?.tagName === "STRONG") {
          quantity = el.nextElementSibling.textContent.trim();
        } else if (el.nextSibling?.nodeType === Node.TEXT_NODE) {
          quantity = el.nextSibling.textContent.trim();
        }

        items.push({
          img: el.src,
          name: el.alt || "",
          quantity,
        });
      });

      return items;
    };

    return {
      seeds: parseSection(seedsHtml),
      gear: parseSection(gearHtml),
    };
  } catch (err) {
    console.error("parseItems_v1 error:", err);
    return { seeds: [], gear: [] };
  }
}

/* ===========================================================
   🧠 Parser 2 (Strong Header-based fallback)
=========================================================== */
function parseItemsFromHtml_v2(htmlContent) {
  if (!htmlContent) return { seeds: [], gear: [] };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const extractSection = (name) => {
      const header = Array.from(doc.querySelectorAll("strong")).find(
        (el) => el.textContent.trim().toLowerCase() === name.toLowerCase()
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

    return {
      seeds: extractSection("Seeds"),
      gear: extractSection("Gear"),
    };
  } catch (err) {
    console.error("parseItems_v2 error:", err);
    return { seeds: [], gear: [] };
  }
}

/* ===========================================================
   🧠 Unified Parser (auto-selects working one)
=========================================================== */
function parseItemsFromHtml(htmlContent) {
  const v1 = parseItemsFromHtml_v1(htmlContent);
  if (v1.seeds.length || v1.gear.length) return v1;
  return parseItemsFromHtml_v2(htmlContent);
}

/* ===========================================================
   🌱 Live Stock Card (Seeds + Gear)
=========================================================== */
function StockCard({ stock, variant = "current" }) {
  if (!stock) return null;

  const sections = parseItemsFromHtml(stock.content);
  const isCurrent = variant === "current";
  const cardClass = isCurrent
    ? "bg-white shadow-lg border-l-4 border-green-500"
    : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

  return (
    <div key={stock.id || stock.createdAt} className={`${cardClass} rounded-lg p-4 mb-3.5`}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-700">{stock.author}</p>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>

      {sections.seeds?.length > 0 && (
        <div className="mb-3">
          <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
          {sections.seeds.map((item, i) => (
            <div key={i} className="flex items-center gap-4 mb-1 border-b border-gray-200 pb-1">
              <img src={item.img} alt={item.name} className="w-6 h-6" />
              <span className="font-semibold">{item.name}</span>
              <span className="text-gray-700">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {sections.gear?.length > 0 && (
        <div>
          <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
          {sections.gear.map((item, i) => (
            <div key={i} className="flex items-center gap-4 mb-1 border-b border-gray-200 pb-1">
              <img src={item.img} alt={item.name} className="w-6 h-6" />
              <span className="font-semibold">{item.name}</span>
              <span className="text-gray-700">{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   🌦️ Weather Card
=========================================================== */
function WeatherCard({ stock }) {
  if (!stock) return null;
  return (
    <div className="bg-blue-50 p-4 rounded-lg mb-3.5 border-l-4 border-blue-400 shadow">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold text-blue-800">{stock.author}</p>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
    </div>
  );
}

/* ===========================================================
   🔮 Predictor Card
=========================================================== */
function PredictorCard({ stock }) {
  if (!stock) return null;
  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-3.5 border-l-4 border-purple-400 shadow">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold text-purple-800">{stock.author}</p>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
    </div>
  );
}

/* ===========================================================
   🔁 Channel-Specific Renderer
=========================================================== */
function getCardForChannel(channel, stock, variant) {
  if (!stock) return null;

  const name = channel.toLowerCase();

  if (name.includes("live")) return <StockCard stock={stock} variant={variant} />;
  if (name.includes("weather")) return <WeatherCard stock={stock} />;
  if (name.includes("predictor")) return <PredictorCard stock={stock} />;

  // Default fallback card
  return (
    <div className="bg-gray-100 p-4 rounded-lg border mb-3.5">
      <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
    </div>
  );
}

/* ===========================================================
   ⚙️ Main Unified Component
=========================================================== */
export default function LiveDiscordUnified() {
  const [channelsState, setChannelsState] = useState({});
  const esRef = useRef(null);

  useEffect(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource("/api/discord?stream=true");
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // Uncomment this for debugging incoming data:
        // console.log("SSE incoming:", data);

        if (data.type === "INITIAL_DATA") {
          setChannelsState(data.channels || {});
        } else if (data.type === "NEW_BATCH") {
          const { channel, messages } = data;
          setChannelsState((prev) => ({
            ...prev,
            [channel]: messages.slice(-2),
          }));
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
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

  return (
    <div className="max-w-6xl mx-auto sm:p-4">
      <div className="flex flex-col gap-6">
        {Object.keys(channelsState).map((channel) => {
          const { current, previous } = getMessages(channel);
          return (
            <div key={channel} className="bg-gray-50 rounded-xl sm:p-6 p-1 shadow">
              <h2 className="text-xl font-semibold mb-4 text-green-700">{channel}</h2>

              <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
              {getCardForChannel(channel, current, "current")}

              <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
              {getCardForChannel(channel, previous, "past")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "use client";

// import { useEffect, useRef, useState } from "react";

// /* ========== Parser 1 (Section-based) ========== */
// function parseItemsFromHtml_v1(htmlContent) {
//   if (!htmlContent) return { seeds: [], gear: [] };

//   try {
//     const lower = htmlContent.toLowerCase();
//     const seedsStart = lower.indexOf("seeds stock:");
//     const gearStart = lower.indexOf("gear stock:");

//     const seedsHtml =
//       seedsStart !== -1 && gearStart !== -1
//         ? htmlContent.slice(seedsStart + 12, gearStart)
//         : seedsStart !== -1
//         ? htmlContent.slice(seedsStart + 12)
//         : "";

//     const gearHtml = gearStart !== -1 ? htmlContent.slice(gearStart + 11) : "";

//     const parseSection = (sectionHtml) => {
//       const parser = new DOMParser();
//       const doc = parser.parseFromString(sectionHtml, "text/html");
//       const items = [];

//       doc.querySelectorAll("img").forEach((el) => {
//         let quantity = "";

//         if (el.nextElementSibling?.tagName === "STRONG") {
//           quantity = el.nextElementSibling.textContent.trim();
//         } else if (el.nextSibling?.nodeType === Node.TEXT_NODE) {
//           quantity = el.nextSibling.textContent.trim();
//         }

//         items.push({
//           img: el.src,
//           name: el.alt || "",
//           quantity,
//         });
//       });

//       return items;
//     };

//     return {
//       seeds: parseSection(seedsHtml),
//       gear: parseSection(gearHtml),
//     };
//   } catch (err) {
//     console.error("parseItems_v1 error:", err);
//     return { seeds: [], gear: [] };
//   }
// }

// /* ========== Parser 2 (Strong Header-based) ========== */
// function parseItemsFromHtml_v2(htmlContent) {
//   if (!htmlContent) return { seeds: [], gear: [] };

//   try {
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(htmlContent, "text/html");

//     const extractSection = (name) => {
//       const header = Array.from(doc.querySelectorAll("strong")).find(
//         (el) => el.textContent.trim().toLowerCase() === name.toLowerCase()
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

//     return {
//       seeds: extractSection("Seeds"),
//       gear: extractSection("Gear"),
//     };
//   } catch (err) {
//     console.error("parseItems_v2 error:", err);
//     return { seeds: [], gear: [] };
//   }
// }

// /* ========== Unified Parser (Fallback Mechanism) ========== */
// function parseItemsFromHtml(htmlContent) {
//   const v1 = parseItemsFromHtml_v1(htmlContent);
//   if (v1.seeds.length || v1.gear.length) return v1;
//   return parseItemsFromHtml_v2(htmlContent);
// }

// /* ========== Stock Card ========== */
// function StockCard({ stock, variant = "current" }) {
//   if (!stock) return null;

//   const sections = parseItemsFromHtml(stock.content);
//   const isCurrent = variant === "current";
//   const cardClass = isCurrent
//     ? "bg-white shadow-lg border-l-4 border-green-500"
//     : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

//   return (
//     <div key={stock.id || stock.createdAt} className={`${cardClass} rounded-lg p-4 mb-3.5`}>
//       <div className="flex items-center justify-between mb-3">
//         <div className="flex items-center gap-3">
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
//             <div key={i} className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1">
//               <img src={item.img} alt={item.name} className="w-6 h-6" />
//               <span className="font-semibold">{item.name}</span>
//               <span className="text-gray-700">{item.quantity}</span>
//             </div>
//           ))}
//         </div>
//       )}

//       {sections.gear?.length > 0 && (
//         <div>
//           <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
//           {sections.gear.map((item, i) => (
//             <div key={i} className="flex items-center gap-4 mb-1 border-b-2 border-gray-200 pb-1">
//               <img src={item.img} alt={item.name} className="w-6 h-6" />
//               <span className="font-semibold">{item.name}</span>
//               <span className="text-gray-700">{item.quantity}</span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* ========== Main Unified Layout ========== */
// export default function LiveDiscordUnified() {
//   const [channelsState, setChannelsState] = useState({});
//   const esRef = useRef(null);

//   useEffect(() => {
//     if (esRef.current) esRef.current.close();
//     const es = new EventSource("/api/discord?stream=true");
//     esRef.current = es;

//     es.onmessage = (ev) => {
//       try {
//         const data = JSON.parse(ev.data);

//         if (data.type === "INITIAL_DATA") {
//           setChannelsState(data.channels || {});
//         } else if (data.type === "NEW_BATCH") {
//           const { channel, messages } = data;
//           setChannelsState((prev) => ({
//             ...prev,
//             [channel]: messages.slice(-2),
//           }));
//         }
//       } catch {}
//     };

//     return () => {
//       es.close();
//       esRef.current = null;
//     };
//   }, []);

//   const getMessages = (key) => {
//     const msgs = channelsState[key] || [];
//     return {
//       current: msgs[msgs.length - 1] || null,
//       previous: msgs[msgs.length - 2] || null,
//     };
//   };

//   const liveStock = getMessages("LiveStock");
//   const weather = getMessages("Weather");
//   const predictor = getMessages("StockPredictor");

//   return (
//     <div className="max-w-6xl mx-auto sm:p-4">
//       <div className="flex flex-col gap-6">
//         {/* Live Stock Section */}
//         <div className="bg-gray-50 rounded-xl sm:p-6 p-1 shadow">
//           <h2 className="text-xl font-semibold mb-4 text-green-700">Live Stock</h2>
//           <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
//           <StockCard stock={liveStock.current} />
//         </div>

//         {/* Weather Section */}
//         <div className="bg-gray-50 rounded-xl sm:p-6 p-1 shadow">
//           <h2 className="text-xl font-semibold mb-4 text-blue-700">Weather</h2>
//           <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
//           <StockCard stock={weather.current} />

//           <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
//           <StockCard stock={weather.previous} variant="past" />
//         </div>

//         {/* Stock Predictor Section */}
//         <div className="bg-gray-50 rounded-xl sm:p-6 p-1 shadow">
//           <h2 className="text-xl font-semibold mb-4 text-purple-700">Stock Predictor</h2>
//           <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
//           <StockCard stock={predictor.current} />

//           <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
//           <StockCard stock={predictor.previous} variant="past" />
//         </div>
//       </div>
//     </div>
//   );
// }
