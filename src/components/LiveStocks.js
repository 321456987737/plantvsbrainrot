"use client";

import { useEffect, useRef, useState } from "react";

/* ===========================================================
   🧠 LIVE STOCK PARSER (Seeds + Gear)
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

function parseItemsFromHtml(htmlContent) {
  const v1 = parseItemsFromHtml_v1(htmlContent);
  if (v1.seeds.length || v1.gear.length) return v1;
  return parseItemsFromHtml_v2(htmlContent);
}

/* ===========================================================
   🔮 PARSER FOR STOCK PREDICTOR
=========================================================== */
function parsePredictorHtml(htmlContent) {
  if (!htmlContent) return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const items = [];
    let currentTitle = "";
    let timeSlots = [];

    doc.body.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "STRONG") {
        if (currentTitle && timeSlots.length) {
          items.push({ title: currentTitle, times: [...timeSlots] });
        }

        currentTitle = node.textContent.trim();
        timeSlots = [];
      }

      if (node.nodeType === Node.TEXT_NODE || node.tagName === "T") {
        const text = node.textContent.trim();
        if (text.startsWith("<t:") || text.includes(":")) {
          timeSlots.push(text);
        }
      }
    });

    if (currentTitle && timeSlots.length) {
      items.push({ title: currentTitle, times: timeSlots });
    }

    return items;
  } catch (err) {
    console.error("Predictor parser error:", err);
    return [];
  }
}

/* ===========================================================
   🌦️ WEATHER PARSER
=========================================================== */
function parseWeatherHtml(htmlContent) {
  if (!htmlContent) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const lines = doc.body.textContent
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let type = "";
    let ends = "";
    let duration = "";

    // ✅ First non-empty line becomes the weather type (general solution)
    if (lines.length > 0) {
      type = lines[0];
    }

    // ✅ Loop through for Ends & Duration
    lines.forEach((line) => {
      if (line.startsWith("- Ends:")) {
        ends = line.replace("- Ends:", "").trim();
      }

      if (line.startsWith("- Duration:")) {
        duration = line.replace("- Duration:", "").trim();
      }
    });

    return { type, ends, duration };
  } catch (err) {
    console.error("Weather parser error:", err);
    return null;
  }
}

// function parseWeatherHtml(htmlContent) {
//   if (!htmlContent) return null;

//   try {
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(htmlContent, "text/html");

//     const lines = doc.body.textContent.trim().split("\n");

//     let type = "";
//     let ends = "";
//     let duration = "";

//     lines.forEach((line) => {
//       line = line.trim();

//       if (
//         line.startsWith("❄️") ||
//         line.startsWith("⛈️") ||
//         line.startsWith("🌧️") ||
//         line.startsWith("🔥")
//       ) {
//         type = line;
//       }

//       if (line.startsWith("- Ends:")) {
//         ends = line.replace("- Ends:", "").trim();
//       }

//       if (line.startsWith("- Duration:")) {
//         duration = line.replace("- Duration:", "").trim();
//       }
//     });

//     return { type, ends, duration };
//   } catch (err) {
//     console.error("Weather parser error:", err);
//     return null;
//   }
// }

/* ===========================================================
   🌱 STOCK CARD (Seeds + Gear)
=========================================================== */
function StockCard({ stock, variant = "current" }) {
  if (!stock) return null;

  const sections = parseItemsFromHtml(stock.content);

  return (
    <div className="bg-white shadow-lg border-l-4 border-green-500 rounded-lg p-4 mb-3.5">
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
   🌦️ WEATHER CARD
=========================================================== */
function WeatherCard({ stock }) {
  if (!stock) return null;

  const parsed = parseWeatherHtml(stock.content);
  console.log(parsed,"parsed")
  console.log(stock,"stock")
  return (
    <div className="bg-blue-50 p-4 rounded-lg mb-3.5 border-l-4 border-blue-400 shadow">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold text-blue-800">{stock.author}</p>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>

      {parsed ? (
        <>
        <div>
          {parsed.content}
        </div>
        <div>
          <p className="text-xl font-bold text-blue-700">{parsed.type}</p>
          <p className="text-gray-700">Ends: {parsed.ends}</p>
          <p className="text-gray-700">Duration: {parsed.duration}</p>
        </div>
        </>
      ) : (
        <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
      )}
    </div>
  );
}

/* ===========================================================
   🔮 PREDICTOR CARD
=========================================================== */
function PredictorCard({ stock }) {
  if (!stock) return null;

  const parsed = parsePredictorHtml(stock.content);

  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-3.5 border-l-4 border-purple-400 shadow">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold text-purple-800">{stock.author}</p>
        <small className="text-gray-500">
          {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
        </small>
      </div>

      {parsed.map((block, index) => (
        <div key={index} className="mb-3 border-b pb-2">
          <h3 className="font-bold text-purple-700">{block.title}</h3>
          {block.times.map((time, i) => (
            <p key={i} className="text-gray-700">{time}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ===========================================================
   🔁 CARD ROUTER (Which Card to Show?)
=========================================================== */
function getCardForChannel(channel, stock, variant) {
  if (!stock) return null;

  const name = channel.toLowerCase();

  if (name.includes("live")) return <StockCard stock={stock} variant={variant} />;
  if (name.includes("weather")) return <WeatherCard stock={stock} />;
  if (name.includes("predictor")) return <PredictorCard stock={stock} />;

  return (
    <div className="bg-gray-100 p-4 rounded-lg border mb-3.5">
      <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
    </div>
  );
}

/* ===========================================================
   ⚙️ MAIN COMPONENT
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

// /* ===========================================================
//    🧠 Parser 1 (Section-based for LiveStock)
// =========================================================== */
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

// /* ===========================================================
//    🧠 Parser 2 (Strong Header-based fallback)
// =========================================================== */
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

// /* ===========================================================
//    🧠 Unified Parser (auto-selects working one)
// =========================================================== */
// function parseItemsFromHtml(htmlContent) {
//   const v1 = parseItemsFromHtml_v1(htmlContent);
//   if (v1.seeds.length || v1.gear.length) return v1;
//   return parseItemsFromHtml_v2(htmlContent);
// }

// /* ===========================================================
//    🌱 Live Stock Card (Seeds + Gear)
// =========================================================== */
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
//         <p className="font-semibold text-gray-700">{stock.author}</p>
//         <small className="text-gray-500">
//           {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
//         </small>
//       </div>

//       {sections.seeds?.length > 0 && (
//         <div className="mb-3">
//           <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
//           {sections.seeds.map((item, i) => (
//             <div key={i} className="flex items-center gap-4 mb-1 border-b border-gray-200 pb-1">
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
//             <div key={i} className="flex items-center gap-4 mb-1 border-b border-gray-200 pb-1">
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

// /* ===========================================================
//    🌦️ Weather Card
// =========================================================== */
// function WeatherCard({ stock }) {
//   if (!stock) return null;
//   return (
//     <div className="bg-blue-50 p-4 rounded-lg mb-3.5 border-l-4 border-blue-400 shadow">
//       <div className="flex justify-between items-center mb-2">
//         <p className="font-semibold text-blue-800">{stock.author}</p>
//         <small className="text-gray-500">
//           {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
//         </small>
//       </div>
//       <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
//     </div>
//   );
// }

// /* ===========================================================
//    🔮 Predictor Card
// =========================================================== */
// function PredictorCard({ stock }) {
//   if (!stock) return null;
//   return (
//     <div className="bg-purple-50 p-4 rounded-lg mb-3.5 border-l-4 border-purple-400 shadow">
//       <div className="flex justify-between items-center mb-2">
//         <p className="font-semibold text-purple-800">{stock.author}</p>
//         <small className="text-gray-500">
//           {stock.createdAt ? new Date(stock.createdAt).toLocaleTimeString() : ""}
//         </small>
//       </div>
//       <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
//     </div>
//   );
// }

// /* ===========================================================
//    🔁 Channel-Specific Renderer
// =========================================================== */
// function getCardForChannel(channel, stock, variant) {
//   if (!stock) return null;

//   const name = channel.toLowerCase();

//   if (name.includes("live")) return <StockCard stock={stock} variant={variant} />;
//   if (name.includes("weather")) return <WeatherCard stock={stock} />;
//   if (name.includes("predictor")) return <PredictorCard stock={stock} />;

//   // Default fallback card
//   return (
//     <div className="bg-gray-100 p-4 rounded-lg border mb-3.5">
//       <p className="text-gray-700 whitespace-pre-wrap">{stock.content}</p>
//     </div>
//   );
// }

// /* ===========================================================
//    ⚙️ Main Unified Component
// =========================================================== */
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
//         // Uncomment this for debugging incoming data:
//         // console.log("SSE incoming:", data);

//         if (data.type === "INITIAL_DATA") {
//           setChannelsState(data.channels || {});
//         } else if (data.type === "NEW_BATCH") {
//           const { channel, messages } = data;
//           setChannelsState((prev) => ({
//             ...prev,
//             [channel]: messages.slice(-2),
//           }));
//         }
//       } catch (err) {
//         console.error("SSE parse error:", err);
//       }
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

//   return (
//     <div className="max-w-6xl mx-auto sm:p-4">
//       <div className="flex flex-col gap-6">
//         {Object.keys(channelsState).map((channel) => {
//           const { current, previous } = getMessages(channel);
//           return (
//             <div key={channel} className="bg-gray-50 rounded-xl sm:p-6 p-1 shadow">
//               <h2 className="text-xl font-semibold mb-4 text-green-700">{channel}</h2>

//               <h3 className="text-lg font-semibold mb-2 text-green-600">Current</h3>
//               {getCardForChannel(channel, current, "current")}

//               <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3>
//               {getCardForChannel(channel, previous, "past")}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }
