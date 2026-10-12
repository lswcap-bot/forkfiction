"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

// 장 읽기 글자 크기. 고른 크기는 이 브라우저에 기억한다.
const SIZES = [
  { label: "작게", value: "1rem" },
  { label: "보통", value: "1.125rem" },
  { label: "크게", value: "1.3rem" },
  { label: "아주 크게", value: "1.5rem" },
];
const DEFAULT = 1;
const STORAGE_KEY = "ff:reading-size";

function load(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < SIZES.length ? saved : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function ReadingSize({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(DEFAULT);

  useEffect(() => {
    setIndex(load()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  function change(next: number) {
    setIndex(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 바꾼다
    }
  }

  return (
    <div style={{ "--reading-size": SIZES[index].value } as CSSProperties} className="flex flex-col gap-8">
      <div className="flex items-center justify-end gap-1" role="group" aria-label="글자 크기">
        <span className="mr-1 text-xs text-muted-foreground">글자 크기</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="글자 작게"
          disabled={index === 0}
          onClick={() => change(index - 1)}
        >
          <span className="text-xs">가</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="글자 크게"
          disabled={index === SIZES.length - 1}
          onClick={() => change(index + 1)}
        >
          <span className="text-base">가</span>
        </Button>
        <span className="sr-only" aria-live="polite">
          {SIZES[index].label}
        </span>
      </div>
      {children}
    </div>
  );
}
