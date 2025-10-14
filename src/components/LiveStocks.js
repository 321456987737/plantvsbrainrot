"use client";

import { useEffect, useState, useRef } from "react";
export default function LiveStocks() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const backoffRef = useRef(3000);
  const timerRef = useRef(null);
  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/discord");
      console.log(res, "res");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        setLoading(false);
        backoffRef.current = 3000;
      } else {
        throw new Error(data.error || "Unknown");
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      backoffRef.current = Math.min(backoffRef.current * 1.8, 30000);
    } finally {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fetchMessages, backoffRef.current);
    }
  };

  useEffect(() => {
    fetchMessages();
    return () => clearTimeout(timerRef.current);
  }, []);
  const parseItems = (htmlContent) => {
    if (!htmlContent) return { seeds: [], gear: [] };
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const sections = {};
    const extractSection = (name) => {
      const header = Array.from(doc.querySelectorAll("strong")).find(
        (el) => el.textContent === name
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
    sections.seeds = extractSection("Seeds");
    sections.gear = extractSection("Gear");
    return sections;
  };
  const sorted = [...messages].sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
  );
  const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const past = sorted.slice(0, Math.max(0, sorted.length - 1));
  const renderStockCard = (stock, type) => {
    const sections = parseItems(stock.content);
    const cardClass =
      type === "current"
        ? "bg-white shadow-lg border-l-4 border-green-500"
        : "bg-gray-50 shadow-sm border-l-4 border-gray-300";
    return (
      <div
        key={stock.id || stock.createdAt}
        className={`${cardClass} rounded-lg p-4 mb-4 transition-all`}
      >
        {" "}
        <div className="flex items-center justify-between mb-3">
          {" "}
          <div className="flex items-center gap-3">
            <img
              src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
              alt="Bot Logo"
              className="w-10 h-10 rounded-full"
            />{" "}
            <p className="font-semibold text-gray-700">{stock.author}</p>{" "}
          </div>{" "}
          <small className="text-gray-500">
            {stock.createdAt
              ? new Date(stock.createdAt).toLocaleTimeString()
              : ""}
          </small>{" "}
        </div>{" "}
        {sections.seeds?.length > 0 && (
          <div className="mb-3">
            {" "}
            <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>{" "}
            {sections.seeds.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
              >
                {" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-6 h-6"
                  />{" "}
                </div>{" "}
                <span className="font-semibold">{item.quantity}</span>{" "}
              </div>
            ))}{" "}
          </div>
        )}{" "}
        {sections.gear?.length > 0 && (
          <div>
            {" "}
            <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>{" "}
            {sections.gear.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
              >
                {" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-6 h-6"
                  />{" "}
                </div>{" "}
                <span className="font-semibold">{item.quantity}</span>{" "}
              </div>
            ))}
          </div>
        )}{" "}
      </div>
    );
  };
  return (
    <div className="max-w-5xl mx-auto sm:p-4">
      {" "}
      <div className="flex items-center justify-between pb-6">
        {" "}
        <h1 className="sm:text-3xl text-2xl font-bold text-center">
          Live Stocks Dashboard
        </h1>{" "}
        <button
          onClick={() => {
            backoffRef.current = 3000;
            fetchMessages();
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer"
        >
          {" "}
          Refresh{" "}
        </button>{" "}
      </div>{" "}
      {loading && <p className="text-center text-gray-500">Loading…</p>}{" "}
      {current && (
        <>
          {" "}
          <h2 className="text-xl font-semibold mb-2 text-green-600">
            Current Stock
          </h2>{" "}
          {renderStockCard(current, "current")}{" "}
        </>
      )}{" "}
      {past.length > 0 && (
        <>
          {" "}
          <h2 className="text-xl font-semibold mb-2 text-gray-600">
            Past Stocks
          </h2>{" "}
          {past.map((s) => renderStockCard(s, "past"))}{" "}
        </>
      )}{" "}
    </div>
  );
}
// "use client";
// import { useEffect, useState } from "react";

// export default function LiveStocks() {
//   const [stocks, setStocks] = useState([]);

//   useEffect(() => {
//     const eventSource = new EventSource("https://plantvsbrainrot-rho.vercel.app/api/discord");

//     eventSource.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         setStocks(data);
//       } catch (err) {
//         console.error("Error parsing SSE data:", err);
//       }
//     };

//     eventSource.onerror = (err) => {
//       console.error("SSE error:", err);
//       eventSource.close();
//     };

//     return () => eventSource.close();
//   }, []);

//   const parseItems = (htmlContent) => {
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
//             quantity: el.nextSibling?.textContent || "",
//           });
//         } else if (el.tagName === "DIV") {
//           el.querySelectorAll("img").forEach((i) =>
//             items.push({
//               img: i.src,
//               name: i.alt,
//               quantity: i.nextSibling?.textContent || "",
//             })
//           );
//         }
//         el = el.nextElementSibling;
//       }
//       return items;
//     };

//     sections.seeds = extractSection("Seeds");
//     sections.gear = extractSection("Gear");
//     return sections;
//   };

//   // Sort and separate current & past
//   const sortedStocks = [...stocks].sort((a, b) => a.timestamp - b.timestamp);
//   const currentStock = sortedStocks[sortedStocks.length - 1];
//   const pastStocks = sortedStocks.slice(0, sortedStocks.length - 1);

//   const renderStockCard = (stock, type) => {
//     const sections = parseItems(stock.content);
//     const cardClass =
//       type === "current"
//         ? "bg-white shadow-lg border-l-4 border-green-500"
//         : "bg-gray-50 shadow-sm border-l-4 border-gray-300";

//     return (
//       <div
//         key={stock.timestamp}
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
//             {new Date(stock.timestamp).toLocaleTimeString()}
//           </small>
//         </div>

//         {sections.seeds.length > 0 && (
//           <div className="mb-3">
//             <h3 className="text-green-600 font-semibold mb-2">Seeds</h3>
//             {sections.seeds.map((item, i) => (
//               <div
//                 key={i}
//                 className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//               >
//                 <div className="flex items-center gap-2">
//                   <img src={item.img} alt={item.name} className="w-6 h-6" />
//                   {/* <span>{item.name}</span> */}
//                 </div>
//                 <span className="font-semibold">{item.quantity}</span>
//               </div>
//             ))}
//           </div>
//         )}

//         {sections.gear.length > 0 && (
//           <div>
//             <h3 className="text-blue-600 font-semibold mb-2">Gear</h3>
//             {sections.gear.map((item, i) => (
//               <div
//                 key={i}
//                 className="flex items-center justify-start gap-4 mb-1 border-b-2 border-gray-200 pb-1"
//               >
//                 <div className="flex items-center gap-2">
//                   <img src={item.img} alt={item.name} className="w-6 h-6" />
//                   {/* <span>{item.name}</span> */}
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

//       <h1 className="sm:text-3xl text-2xl font-bold text-center ">
//         Live Stocks Dashboard
//       </h1>
//          <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer" >Refresh</button>
//       </div>
//       {currentStock && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-green-600">
//             Current Stock
//           </h2>
//           {renderStockCard(currentStock, "current")}
//         </>
//       )}

//       {pastStocks.length > 0 && (
//         <>
//           <h2 className="text-xl font-semibold mb-2 text-gray-600">
//             Past Stocks
//           </h2>
//           {pastStocks.map((stock) => renderStockCard(stock, "past"))}
//         </>
//       )}
//     </div>
//   );
// }
