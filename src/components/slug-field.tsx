"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { validateSlug } from "@/lib/slug";
import { resolveSlug, type SlugCheck } from "@/lib/slug-actions";

/**
 * 작품 주소 입력. 입력이 멈추면 최종 주소(겹치면 -2, -3을 붙인 주소)를 확인해 보여 준다.
 * 저장할 때는 화면에 보여 준 최종 주소를 그대로 쓴다.
 */
export function useSlugCheck(input: string, exceptWorkId?: string) {
  const [check, setCheck] = useState<SlugCheck | null>(null);
  const local = input ? validateSlug(input) : null;
  const target = local?.ok ? local.slug : null;

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await resolveSlug(target, exceptWorkId);
      if (!cancelled) setCheck(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target, exceptWorkId]);

  if (!local) return { state: "empty" as const };
  if (!local.ok) return { state: "invalid" as const, message: local.message };
  if (check?.input !== local.slug) return { state: "checking" as const };
  if (!check.ok) return { state: "invalid" as const, message: check.message };
  return { state: "ready" as const, input: local.slug, slug: check.slug, changed: check.slug !== local.slug };
}

export type SlugStatus = ReturnType<typeof useSlugCheck>;

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  status: SlugStatus;
  placeholder?: string;
};

export function SlugField({ id, value, onChange, status, placeholder }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <span className="pl-2.5 text-sm text-muted-foreground">/w/</span>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={80}
          aria-describedby={`${id}-help`}
          aria-invalid={status.state === "invalid" || undefined}
          className="border-0 pl-0.5 shadow-none focus-visible:ring-0"
        />
      </div>
      <div id={`${id}-help`} aria-live="polite" className="text-sm">
        {status.state === "empty" && (
          <p className="text-muted-foreground">영문 소문자, 숫자, 하이픈(-) 3~80자</p>
        )}
        {status.state === "invalid" && <p className="text-destructive">{status.message}</p>}
        {status.state === "checking" && <p className="text-muted-foreground">주소를 확인하는 중…</p>}
        {status.state === "ready" && (
          <div
            className={
              status.changed
                ? "rounded-md bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                : "text-muted-foreground"
            }
          >
            {status.changed && (
              <p>
                <code>{status.input}</code>은(는) 이미 다른 작품이 쓰고 있어 번호를 붙였습니다.
              </p>
            )}
            <p>
              최종 주소: <strong className="font-medium text-foreground">/w/{status.slug}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
