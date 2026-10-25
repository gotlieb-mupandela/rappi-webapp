import { NextResponse, type NextRequest } from "next/server";
import { fixedSlugRedirect } from "@/lib/slug-redirects";
import { updateSession } from "@/lib/supabase/middleware";

// Next's middleware adapter reads Location with headers.get and rejects a
// relative URL. In the edge runtime the first read returns a fixed absolute
// URL so that parser accepts it. The stored header stays the relative path.
// The fixed host is not the request host, so the adapter does not replace it.
function relativeRedirect(target: string): Response {
  const response = new NextResponse(null, {
    status: 308,
    headers: { Location: target },
  });
  if (process.env.NEXT_RUNTIME !== "edge") return response;

  let parsedForAdapter = false;
  const headers = response.headers;
  return new Proxy(response, {
    get(targetResponse, prop, receiver) {
      if (prop === "headers") {
        return new Proxy(headers, {
          get(headerTarget, headerProp, headerReceiver) {
            if (headerProp === "get") {
              return (name: string) => {
                if (!parsedForAdapter && name.toLowerCase() === "location") {
                  parsedForAdapter = true;
                  return new URL(target, "https://redirect.invalid").href;
                }
                return headerTarget.get(name);
              };
            }
            const value = Reflect.get(headerTarget, headerProp, headerReceiver);
            return typeof value === "function" ? value.bind(headerTarget) : value;
          },
        });
      }
      const value = Reflect.get(targetResponse, prop, receiver);
      return typeof value === "function" ? value.bind(targetResponse) : value;
    },
  });
}

export async function middleware(request: NextRequest) {
  const target = fixedSlugRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (target) return relativeRedirect(target);
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/shop/:path*", "/category/:path*"],
};
