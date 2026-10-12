// 『칼의 여행』(seed/kalui-yeohaeng.md)을 원작 하나로 넣는다.
//
//   npm run seed:kalui -- --handle=<필명>            지정한 필명의 사용자 작품으로 넣는다
//   npm run seed:kalui -- --handle=<필명> --dry-run  장 분할 결과만 보여 준다
//
// 맨 위 `#`은 작품 제목, 그 아래 `#`들을 장으로 본다. 장 제목의 "N장 — "은 장 번호와 겹치므로 뺀다.
// service role 키로 돌리며, 같은 주소(slug)의 작품이 이미 있으면 아무것도 하지 않는다.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const SLUG = "kalui-yeohaeng";
const SOURCE = new URL("../seed/kalui-yeohaeng.md", import.meta.url);
const SUMMARY =
  "칼을 쥘 줄도 모르는 윤재하가 1910년 도록 속 쌍룡검 사진을 만지고 고조선으로 떨어진다. " +
  "시대마다 꺾인 칼을 되살리고 동료를 만나고 떠나보내며, 사진 구석의 군복 입은 청년을 쫓아 1910년 서울까지 간다.";

type Chapter = { title: string; body: string };

function splitChapters(md: string): { title: string; chapters: Chapter[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const headings = lines.flatMap((line, i) => (/^# \S/.test(line) ? [i] : []));
  if (headings.length < 2) throw new Error("작품 제목(#) 아래에 장(#)이 없습니다.");

  const title = lines[headings[0]].slice(2).trim();
  const chapters = headings.slice(1).map((start, i) => {
    const end = headings[i + 2] ?? lines.length;
    return {
      title: lines[start].slice(2).trim().replace(/^\d+장\s*[—–-]\s*/, ""),
      body: lines.slice(start + 1, end).join("\n").trim() + "\n",
    };
  });
  return { title, chapters };
}

const { values } = parseArgs({
  options: { handle: { type: "string" }, "dry-run": { type: "boolean", default: false } },
});

const { title, chapters } = splitChapters(readFileSync(SOURCE, "utf8"));
console.log(`『${title}』 ${chapters.length}개 장`);
chapters.forEach((ch, i) => console.log(`  ${i + 1}. ${ch.title} (${ch.body.length.toLocaleString()}자)`));

if (values["dry-run"]) process.exit(0);
if (!values.handle) {
  console.error("--handle=<필명>으로 작품 주인을 정해 주세요.");
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
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const owner = await db.from("profiles").select("id").eq("handle", values.handle).maybeSingle();
if (owner.error) throw owner.error;
if (!owner.data) {
  console.error(`필명 '${values.handle}'인 사용자가 없습니다. 먼저 로그인해 필명을 정해 주세요.`);
  process.exit(1);
}

const ownerId = owner.data.id;

const existing = await db.from("works").select("id").eq("slug", SLUG).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data) {
  console.log(`이미 있습니다: ${SLUG} (${existing.data.id}). 건너뜁니다.`);
  process.exit(0);
}

const work = await db
  .from("works")
  .insert({
    owner_id: ownerId,
    slug: SLUG,
    title,
    summary: SUMMARY,
    license: "CC-BY-SA-4.0",
    allow_fork: true,
    ai_usage: "mostly",
    visibility: "public",
  })
  .select("id")
  .single();
if (work.error) throw work.error;

// 장과 수정본은 서로를 가리키므로 id를 미리 정하고 수정본부터 넣는다
const rows = chapters.map((ch, i) => ({
  chapterId: randomUUID(),
  revisionId: randomUUID(),
  position: i + 1,
  ...ch,
}));

const revisions = await db.from("revisions").insert(
  rows.map((r) => ({
    id: r.revisionId,
    chapter_id: r.chapterId,
    author_id: ownerId,
    title: r.title,
    body_md: r.body,
    message: "시드",
  })),
);
const inserted = revisions.error
  ? revisions
  : await db.from("chapters").insert(
      rows.map((r) => ({
        id: r.chapterId,
        work_id: work.data.id,
        position: r.position,
        head_revision_id: r.revisionId,
        state: "new",
      })),
    );

if (inserted.error) {
  // 반쯤 들어간 작품을 남기지 않는다
  await db.from("works").delete().eq("id", work.data.id);
  await db.from("revisions").delete().in("id", rows.map((r) => r.revisionId));
  throw inserted.error;
}

console.log(`넣었습니다: ${SLUG} (${work.data.id})`);
