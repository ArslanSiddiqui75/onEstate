import { NextResponse } from "next/server";

/** Admin API JSON — never cached by shared proxies or the browser. */
export function adminJson(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
