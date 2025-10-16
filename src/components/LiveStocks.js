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
    <div key={stock.id || stock.createdAt} className={`${cardClass} rounded-lg p-4 mb-3.5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* <img
            src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
            alt="Bot Logo"
            className="w-10 h-10 rounded-full"
          /> */}
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
          {/* <img
            src="https://cdn-icons-png.flaticon.com/512/616/616408.png"
            alt="Bot Logo"
            className="w-10 h-10 rounded-full"
          /> */}
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
      {/* <div className="flex items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
      </div> */}

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
            {/* <h3 className="text-lg font-semibold mb-2 text-gray-600">Previous</h3> */}
            {/* <GenericHtmlCard msg={predictor.previous} variant="past" /> */}
          </div>
      </div>
    </div>
  );
}













