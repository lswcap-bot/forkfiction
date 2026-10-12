"use server";

import { redirect } from "next/navigation";
import { validateSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export type OwnerActionResult = { error: string } | undefined;

// 임시 저장 작품의 주소 바꾸기. 공개한 적이 있으면 DB(works_guard)가 막는다.
// 화면에 보여 준 최종 주소를 그대로 저장한다(겹치면 unique 위반).
export async function changeSlug(workId: string, slugInput: string): Promise<OwnerActionResult> {
  const slug = validateSlug(slugInput);
  if (!slug.ok) return { error: slug.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .update({ slug: slug.slug })
    .eq("id", workId)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { error: "그 사이 다른 작품이 이 주소를 먼저 썼습니다. 다른 주소를 골라 주세요." };
    if (error.code === "42501") return { error: "공개한 작품의 주소는 바꿀 수 없습니다." };
    return { error: "주소를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  if (!data) return { error: "내 작품만 고칠 수 있습니다." };

  redirect(`/w/${data.slug}`);
}

// 임시 저장 작품 공개하기
export async function publishWork(workId: string): Promise<OwnerActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .update({ visibility: "public" })
    .eq("id", workId)
    .eq("visibility", "draft")
    .select("slug")
    .maybeSingle();

  if (error || !data) return { error: "공개하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  redirect(`/w/${data.slug}`);
}
