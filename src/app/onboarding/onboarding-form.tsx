"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateHandle } from "@/lib/handle";
import { checkHandle, createProfile, type HandleCheck, type OnboardingState } from "./actions";

type Props = { next: string; defaultDisplayName: string };

export function OnboardingForm({ next, defaultDisplayName }: Props) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createProfile,
    {},
  );
  const [handle, setHandle] = useState(state.values?.handle ?? "");
  const [check, setCheck] = useState<(HandleCheck & { for: string }) | null>(null);

  // 형식이 맞으면 입력이 멈춘 뒤 중복을 확인한다.
  const local = handle ? validateHandle(handle) : null;
  useEffect(() => {
    if (!local?.ok) return;
    const target = local.handle;
    const timer = setTimeout(async () => {
      const result = await checkHandle(target);
      setCheck({ ...result, for: target });
    }, 400);
    return () => clearTimeout(timer);
  }, [local?.ok, local?.ok ? local.handle : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessage = (() => {
    if (state.errors?.handle && handle === state.values?.handle) {
      return { text: state.errors.handle, ok: false };
    }
    if (!local) return null;
    if (!local.ok) return { text: local.message, ok: false };
    if (check?.for !== local.handle) return { text: "확인하는 중…", ok: null };
    return { text: check.message, ok: check.available };
  })();

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">필명</Label>
        <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="pl-2.5 text-sm text-muted-foreground">@</span>
          <Input
            id="handle"
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            required
            aria-describedby="handle-help"
            aria-invalid={handleMessage?.ok === false || undefined}
            className="border-0 pl-1 shadow-none focus-visible:ring-0"
          />
        </div>
        <p
          id="handle-help"
          aria-live="polite"
          className={
            handleMessage?.ok === false
              ? "text-sm text-destructive"
              : handleMessage?.ok
                ? "text-sm text-emerald-700 dark:text-emerald-400"
                : "text-sm text-muted-foreground"
          }
        >
          {handleMessage?.text ?? "영문 소문자, 숫자, 밑줄(_) 3~20자"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">표시 이름</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={state.values?.displayName ?? defaultDisplayName}
          maxLength={30}
          required
          aria-describedby="displayName-help"
          aria-invalid={!!state.errors?.displayName || undefined}
        />
        <p
          id="displayName-help"
          className={state.errors?.displayName ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {state.errors?.displayName ?? "작품과 계보에 보이는 이름입니다. 한글도 됩니다. 나중에 바꿀 수 있습니다."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Checkbox id="agree" name="agree" value="on" className="mt-0.5" aria-invalid={!!state.errors?.agree || undefined} />
          <Label htmlFor="agree" className="leading-snug font-normal">
            <span>
              <Link href="/terms" target="_blank" className="underline underline-offset-4">
                이용약관
              </Link>
              과{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                개인정보 처리방침
              </Link>
              에 동의합니다.
            </span>
          </Label>
        </div>
        {state.errors?.agree && <p className="text-sm text-destructive">{state.errors.agree}</p>}
      </div>

      {state.errors?.form && <p className="text-sm text-destructive">{state.errors.form}</p>}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "저장하는 중…" : "시작하기"}
      </Button>
    </form>
  );
}
