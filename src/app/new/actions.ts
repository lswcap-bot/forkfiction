"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { validateSlug } from "@/lib/slug";
import { resolveSlug } from "@/lib/slug-actions";
import { createClient } from "@/lib/supabase/server";
import {
  CHAPTERS_MAX,
  SUMMARY_MAX,
  TITLE_MAX,
  chapterProblem,
  isAiUsage,
  isLicense,
} from "@/lib/work-meta";

export type NewWorkInput = {
  title: string;
  summary: string;
  /** resolveSlug로 확인해 작가에게 보여 준 최종 주소. 그대로 저장한다. */
  slug: string;
  /** 작가가 적은 주소(번호를 붙이기 전). 주소가 겹쳤을 때 여기서 다시 정한다. */
  slugInput: string;
  license: string;
  allowFork: boolean;
  aiUsage: string;
  rightsConfirmed: boolean;
  visibility: "draft" | "public";
  chapters: { title: string; body: string }[];
};

export type NewWorkResult = {
  error: string;
  /** 그 사이 다른 작품이 주소를 먼저 썼을 때 새로 정한 최종 주소 */
  slug?: string;
};

export async function createWork(input: NewWorkInput): Promise<NewWorkResult> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/new");
  if (!viewer.profile) redirect("/onboarding?next=/new");

  const title = input.title.trim();
  if (!title || title.length > TITLE_MAX) return { error: `제목은 1~${TITLE_MAX}자로 적어 주세요.` };
  if (input.summary.trim().length > SUMMARY_MAX) return { error: `소개는 ${SUMMARY_MAX}자까지입니다.` };
  if (!isLicense(input.license)) return { error: "라이선스를 골라 주세요." };
  if (!isAiUsage(input.aiUsage)) return { error: "AI 활용 여부를 골라 주세요." };
  if (input.visibility !== "draft" && input.visibility !== "public") return { error: "저장 방식이 맞지 않습니다." };
  if (!input.rightsConfirmed) return { error: "이 작품을 올릴 권리가 있는지 확인해 주세요." };
  if (input.chapters.length === 0) return { error: "장이 하나도 없습니다." };
  if (input.chapters.length > CHAPTERS_MAX) return { error: `장은 ${CHAPTERS_MAX}개까지 올릴 수 있습니다.` };
  for (const [i, ch] of input.chapters.entries()) {
    const problem = chapterProblem(ch);
    if (problem) return { error: `${i + 1}장: ${problem}` };
  }
  const slug = validateSlug(input.slug);
  if (!slug.ok) return { error: slug.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_work", {
    p_title: title,
    p_summary: input.summary,
    p_slug: slug.slug,
    p_license: input.license,
    p_allow_fork: input.license !== "ARR" && input.allowFork,
    p_ai_usage: input.aiUsage,
    p_visibility: input.visibility,
    p_chapters: input.chapters.map((ch) => ({ title: ch.title.trim(), body: ch.body })),
  });

  if (error) {
    // 23505: 확인한 뒤 저장하기 전에 다른 작품이 그 주소를 먼저 썼다. 말없이 바꾸지 않고 새 주소를 보여 준다.
    if (error.code === "23505") {
      const next = await resolveSlug(input.slugInput);
      return {
        error: "그 사이 다른 작품이 이 주소를 먼저 썼습니다. 새 주소를 확인하고 다시 저장해 주세요.",
        slug: next.ok ? next.slug : undefined,
      };
    }
    if (error.code === "42501") redirect("/onboarding?next=/new");
    return { error: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  redirect(`/w/${slug.slug}`);
}
