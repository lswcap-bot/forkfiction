"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/handle";
import { safeNextPath } from "@/lib/safe-next";

export type HandleCheck = { available: boolean; message: string };

// 입력 중 필명 중복 확인. 최종 판단은 insert 때 DB의 unique 제약이 한다.
export async function checkHandle(input: string): Promise<HandleCheck> {
  const result = validateHandle(input);
  if (!result.ok) return { available: false, message: result.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", result.handle)
    .maybeSingle();

  if (error) return { available: false, message: "확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  if (data) return { available: false, message: "이미 쓰는 필명입니다." };
  return { available: true, message: "쓸 수 있는 필명입니다." };
}

export type OnboardingState = {
  errors?: { handle?: string; displayName?: string; agree?: string; form?: string };
  values?: { handle: string; displayName: string };
};

export async function createProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const handleInput = String(formData.get("handle") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const agreed = formData.get("agree") === "on";
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const values = { handle: handleInput, displayName };

  const errors: NonNullable<OnboardingState["errors"]> = {};
  const handle = validateHandle(handleInput);
  if (!handle.ok) errors.handle = handle.message;
  if (displayName.length < 1 || displayName.length > 30) {
    errors.displayName = "표시 이름은 1~30자로 적어 주세요.";
  }
  if (!agreed) errors.agree = "이용약관과 개인정보 처리방침에 동의해야 글을 올리고 갈래를 낼 수 있습니다.";
  if (Object.keys(errors).length > 0 || !handle.ok) return { errors, values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    handle: handle.handle,
    display_name: displayName,
    terms_agreed_at: new Date().toISOString(),
  });

  if (error) {
    // 23505: unique 위반. 같은 필명을 먼저 잡았거나, 이미 프로필이 있다.
    if (error.code === "23505") {
      if (error.message.includes("profiles_pkey")) redirect(next);
      return { errors: { handle: "이미 쓰는 필명입니다." }, values };
    }
    // 23514: check 위반 (예약어 등). 앱 검증과 DB 목록이 어긋났을 때만 온다.
    if (error.code === "23514") {
      return { errors: { handle: "쓸 수 없는 필명입니다." }, values };
    }
    return { errors: { form: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, values };
  }

  redirect(next);
}
