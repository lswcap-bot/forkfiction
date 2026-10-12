import Link from "next/link";
import { Fragment } from "react";
import type { LineageItem } from "@/lib/works";

// 계보 줄: 『칼의 여행』(이석원) → 8장에서 → 『울라의 길』(아무개)
// 라이선스의 출처 표시를 대신하므로 어떤 화면에서도 숨기거나 지울 수 없다.
// 원작(계보가 자기 자신뿐)이면 그리지 않는다.
export function LineageLine({ lineage }: { lineage: LineageItem[] }) {
  if (lineage.length < 2) return null;
  return (
    <p className="text-sm leading-relaxed text-muted-foreground" aria-label="계보">
      {lineage.map((item, i) => (
        <Fragment key={item.ancestor_slug}>
          {i > 0 && (
            <span className="whitespace-nowrap">
              {" "}→ {item.fork_chapter_position}장에서 →{" "}
            </span>
          )}
          <Link href={`/w/${item.ancestor_slug}`} className="text-foreground underline-offset-4 hover:underline">
            『{item.ancestor_title}』
          </Link>
          <Link href={`/@${item.ancestor_owner_handle}`} className="hover:underline">
            ({item.ancestor_owner_display_name})
          </Link>
        </Fragment>
      ))}
    </p>
  );
}
