import Link from "next/link";

// 작품 대문의 탭: 목차 · 갈래 지도
export function WorkTabs({ slug, current }: { slug: string; current: "toc" | "tree" }) {
  const tabs = [
    { key: "toc", label: "목차", href: `/w/${slug}` },
    { key: "tree", label: "갈래 지도", href: `/w/${slug}/tree` },
  ] as const;
  return (
    <nav className="flex gap-1 border-b" aria-label="작품 탭">
      {tabs.map((tab) =>
        tab.key === current ? (
          <span key={tab.key} aria-current="page" className="-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium">
            {tab.label}
          </span>
        ) : (
          <Link key={tab.key} href={tab.href} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
