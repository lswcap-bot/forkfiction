"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// 장 읽기 글자 크기. 고른 크기는 이 브라우저에 기억한다.
const SIZES = [
  { label: "작게", value: "1rem" },
  { label: "보통", value: "1.125rem" },
  { label: "크게", value: "1.3rem" },
  { label: "아주 크게", value: "1.5rem" },
];
const DEFAULT = 1;
const STORAGE_KEY = "ff:reading-size";
// 회색 트랙 안의 '가' 버튼(44px). 더 줄이거나 키울 수 없으면 흐리게 둔다.
const STEP =
  "grid size-11 place-items-center rounded-full font-serif text-ink-2 transition-colors hover:bg-surface hover:text-ink hover:shadow-ff-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

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
      <div className="flex items-center justify-end gap-2" role="group" aria-label="글자 크기">
        <span className="text-xs text-ink-3">글자 크기</span>
        <div className="inline-flex gap-0.5 rounded-full bg-line-soft p-[3px]">
          <button
            type="button"
            aria-label="글자 작게"
            disabled={index === 0}
            onClick={() => change(index - 1)}
            className={STEP}
          >
            <span className="text-[13px]">가</span>
          </button>
          <button
            type="button"
            aria-label="글자 크게"
            disabled={index === SIZES.length - 1}
            onClick={() => change(index + 1)}
            className={STEP}
          >
            <span className="text-[19px]">가</span>
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {SIZES[index].label}
        </span>
      </div>
      {children}
    </div>
  );
}
