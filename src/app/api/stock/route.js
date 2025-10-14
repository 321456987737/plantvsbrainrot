import axios from "axios";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "AAPL";
  const API_KEY = process.env.ALPHAVANTAGE_API_KEY;

  try {
   //  const response = await axios.get(
   //    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
   //  );

    const data = response.data["Global Quote"];

    if (!data) {
      return Response.json({ error: "No data found" }, { status: 404 });
    }

    return Response.json({
      symbol: data["01. symbol"],
      price: data["05. price"],
      change: data["09. change"],
      percentChange: data["10. change percent"],
    });
  } catch (error) {
    console.error("Error fetching stock:", error.message);
    return Response.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
