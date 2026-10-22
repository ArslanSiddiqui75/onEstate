import { readServerInbox } from "@/lib/lettings/server-inbox";
import { demoInboxJson } from "@/lib/server/demo-inbox";

export async function GET() {
  return demoInboxJson(readServerInbox());
}
