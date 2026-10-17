"use client";

import { useId, useState, useTransition } from "react";
import { AI_USAGES, type AiUsage } from "@/lib/work-meta";
import { changeAiUsage } from "./actions";

// 작품 대문의 'AI 활용' 칸. 작가 본인에게만 고를 수 있는 칸으로 보인다.
// 갈래는 만들 때 원작의 표기를 물려받으므로 여기서 사실대로 고친다.
export function AiUsageField({ workId, value, inherited }: { workId: string; value: AiUsage; inherited: boolean }) {
  const id = useId();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        AI 활용 표기 바꾸기
      </label>
      <select
        id={id}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as AiUsage;
          const prev = current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await changeAiUsage(workId, next);
            if (result) {
              setCurrent(prev);
              setError(result.error);
            }
          });
        }}
        className="rounded-md border bg-transparent px-1.5 py-0.5 text-sm text-foreground disabled:opacity-60"
      >
        {AI_USAGES.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs">저장하는 중…</span>}
      {inherited && !pending && <span className="text-xs">갈래는 원작의 표기를 물려받습니다. 내 갈래에 맞게 고쳐 주세요.</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
