import type { ReactNode } from "react";

// 이용약관·개인정보 처리방침 공통 틀. 전문가 검토 전 초안이라는 표시를 늘 위에 둔다.

export const OPERATOR = { name: "이석원", email: "lswcap@naver.com" } as const;
/** 시행일은 전문가 검토 뒤 정한다 */
export const EFFECTIVE_DATE = "[시행일 미정]";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div
        role="note"
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong>초안</strong> — 전문가 검토 전의 초안입니다. 내용은 출시 전에 바뀔 수 있습니다.
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          시행일: {EFFECTIVE_DATE} · 운영자: {OPERATOR.name} · 문의: {OPERATOR.email}
        </p>
      </header>
      <div className="flex flex-col gap-8 leading-relaxed">{children}</div>
    </main>
  );
}

export function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-[0.95rem] [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
