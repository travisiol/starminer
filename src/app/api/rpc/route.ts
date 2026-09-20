import { RPC_URL } from "@/config/chains";

export const runtime = "nodejs";

/**
 * JSON-RPC relay for live mode. The browser never talks to the public RPC
 * directly (CORS and rate limits differ per chain); Node scripts go direct.
 */
export async function POST(req: Request) {
  const body = await req.text();
  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: (e as Error).message } }, { status: 502 });
  }
}
