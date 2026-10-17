// 관리자 켜고 끄기. profiles.is_admin은 사용자가 직접 바꿀 수 없으므로 service role로 바꾼다.
//
//   npm run admin:set -- --handle=<필명>         관리자로 만든다
//   npm run admin:set -- --handle=<필명> --off   관리자에서 뺀다

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: { handle: { type: "string" }, off: { type: "boolean", default: false } },
});

if (!values.handle) {
  console.error("사용법: npm run admin:set -- --handle=<필명> [--off]");
  process.exit(1);
}

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경 변수를 직접 넣은 경우
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const isAdmin = !values.off;

const { data, error } = await admin
  .from("profiles")
  .update({ is_admin: isAdmin })
  .eq("handle", values.handle)
  .select("handle, display_name, is_admin");

if (error) {
  console.error("바꾸지 못했습니다:", error.message);
  process.exit(1);
}
if (data.length === 0) {
  console.error(`@${values.handle} 필명의 사용자가 없습니다.`);
  process.exit(1);
}
console.log(`@${data[0].handle}(${data[0].display_name}): 관리자 ${data[0].is_admin ? "켬" : "끔"}`);
