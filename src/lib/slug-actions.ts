"use server";

import { validateSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export type SlugCheck =
  | { ok: true; input: string; slug: string }
  | { ok: false; input: string; message: string };

/**
 * 저장 전에 보여 줄 최종 주소. 이미 있는 주소면 -2, -3을 붙인다.
 * exceptWorkId: 내 임시 저장 작품의 주소를 고칠 때 자기 자신은 빼고 본다.
 */
export async function resolveSlug(input: string, exceptWorkId?: string): Promise<SlugCheck> {
  const valid = validateSlug(input);
  if (!valid.ok) return { ok: false, input, message: valid.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_slug", {
    p_slug: valid.slug,
    p_except_work_id: exceptWorkId ?? null,
  });
  if (error || typeof data !== "string") {
    return { ok: false, input, message: "주소를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  return { ok: true, input, slug: data };
}
