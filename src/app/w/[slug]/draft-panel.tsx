"use client";

import { useState, useTransition } from "react";
import { SlugField, useSlugCheck } from "@/components/slug-field";
import { Button } from "@/components/ui/button";
import { changeSlug, publishWork } from "./actions";

type Props = {
  workId: string;
  slug: string;
  /** 한 번이라도 공개한 적이 있으면 주소를 바꿀 수 없다 */
  slugLocked: boolean;
  allowFork: boolean;
};

// 작가 본인에게만 보이는 임시 저장 작품 관리: 주소 바꾸기, 공개하기
export function DraftPanel({ workId, slug, slugLocked, allowFork }: Props) {
  const [input, setInput] = useState(slug);
  const status = useSlugCheck(input, workId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slugChanged = status.state === "ready" && status.slug !== slug;

  function run(action: () => Promise<{ error: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result) setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border-[1.5px] border-dashed border-kind-draft-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">임시 저장 중인 작품입니다</h2>
        <p className="text-sm text-muted-foreground">나만 볼 수 있습니다. 공개하면 누구나 읽을 수 있습니다.</p>
      </div>

      {!slugLocked && (
        <div className="flex flex-col gap-2">
          <label htmlFor="draft-slug" className="text-sm font-medium">
            작품 주소
          </label>
          <SlugField id="draft-slug" value={input} onChange={setInput} status={status} />
          {slugChanged && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => status.state === "ready" && run(() => changeSlug(workId, status.slug))}
              >
                이 주소로 바꾸기
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        공개한 뒤에는 작품 주소를 바꿀 수 없습니다.
        {allowFork && " 갈래를 허용한 작품은, 나중에 갈래 금지로 바꿔도 이미 나온 갈래가 남습니다."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="button" disabled={pending} onClick={() => run(() => publishWork(workId))}>
          {pending ? "처리하는 중…" : `/w/${slug} 주소로 공개하기`}
        </Button>
      </div>
    </section>
  );
}
