import Link from "next/link";
import { Fragment } from "react";
import { initials } from "@/components/ff";
import type { LineageItem } from "@/lib/works";
import { cn } from "@/lib/utils";

// 계보 줄: 『칼의 여행』(이석원) → 8장에서 → 『울라의 길』(아무개)
// 라이선스의 출처 표시를 대신하므로 어떤 화면에서도 숨기거나 지울 수 없다.
// 관리자가 숨긴 조상은 자리를 지우지 않고 제목·작가 없이 '숨겨진 작품'으로 적는다.
// 원작(계보가 자기 자신뿐)이면 그리지 않는다.
// variant="panel"은 작품 대문·갈래 지도의 흰 패널(작품마다 알약, 사이에 'N장에서 갈라짐'),
// 기본은 장 읽기 머리의 한 줄 글이다. 담는 내용은 같다.
export function LineageLine({ lineage, variant = "line" }: { lineage: LineageItem[]; variant?: "line" | "panel" }) {
  if (lineage.length < 2) return null;
  if (variant === "panel") return <LineagePanel lineage={lineage} />;
  return (
    <p className="text-sm leading-relaxed text-ink-3" aria-label="계보">
      {lineage.map((item, i) => (
        <Fragment key={item.depth}>
          {i > 0 && (
            <span className="whitespace-nowrap">
              {" "}→ {item.fork_chapter_position}장에서 →{" "}
            </span>
          )}
          {item.ancestor_slug === null ? (
            <span className="italic">숨겨진 작품</span>
          ) : (
            <>
              <Link href={`/w/${item.ancestor_slug}`} className="text-ink underline-offset-4 hover:underline">
                『{item.ancestor_title}』
              </Link>
              <Link href={`/@${item.ancestor_owner_handle}`} className="hover:underline">
                ({item.ancestor_owner_display_name})
              </Link>
            </>
          )}
        </Fragment>
      ))}
    </p>
  );
}

function LineagePanel({ lineage }: { lineage: LineageItem[] }) {
  const last = lineage.length - 1;
  return (
    <div aria-label="계보" role="group" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-surface px-4 py-3">
      <span className="px-1.5 text-[13px] font-semibold text-ink-3">계보</span>
      {lineage.map((item, i) => (
        <Fragment key={item.depth}>
          {i > 0 && (
            <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-2">
              <i className="block h-0.5 w-6 rounded-[1px] bg-ink sm:w-8" aria-hidden />
              {item.fork_chapter_position}장에서 갈라짐
            </span>
          )}
          <span
            aria-current={i === last ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 max-w-full items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-semibold",
              item.ancestor_slug === null ? "bg-mute pl-4" : i === 0 ? "bg-kind-original" : "bg-kind-fork",
              i === last && "ring-2 ring-ink",
            )}
          >
            {item.ancestor_slug === null ? (
              <span className="font-normal italic text-ink-2">숨겨진 작품</span>
            ) : (
              <>
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold">
                  {initials(item.ancestor_owner_display_name ?? "")}
                </span>
                <span className="min-w-0">
                  <Link href={`/w/${item.ancestor_slug}`} className="underline-offset-4 hover:underline">
                    『{item.ancestor_title}』
                  </Link>{" "}
                  <Link href={`/@${item.ancestor_owner_handle}`} className="text-xs font-normal text-ink-2 hover:underline">
                    ({item.ancestor_owner_display_name})
                  </Link>
                </span>
              </>
            )}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
