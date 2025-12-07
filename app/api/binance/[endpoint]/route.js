export const runtime = "edge";

const BINANCE_BASE = "https://fapi.binance.com/fapi/v1";

export async function GET(req, ctx) {
  try {
    const { endpoint } = await ctx.params;
    const incomingSecret = req.headers.get("x-proxy-secret");
    if (incomingSecret !== process.env.PROXY_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const reqUrl = new URL(req.url);
    const target = `${BINANCE_BASE}/${endpoint}${reqUrl.search}`;

    const res = await fetch(target);

    let cacheHeader = "no-store";
    if (endpoint === "time") {
      cacheHeader = "public, s-maxage=1, stale-while-revalidate=1";
    }
    if (endpoint === "exchangeInfo") {
      cacheHeader = "public, s-maxage=300, stale-while-revalidate=600";
    }
    const outgoingHeaders = {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Cache-Control": cacheHeader,
    };

    for (let [key, value] of res.headers.entries()) {
      if (key.startsWith("x-mbx")) {
        outgoingHeaders[key] = value;
      }
    }

    return new Response(res.body, {
      status: res.status,
      headers: outgoingHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy failed", details: err.message }),
      { status: 500 }
    );
  }
}
