import { PillLink } from "@/components/ff";

// 작품 대문의 탭: 목차 · 갈래 지도. 필터 알약과 같은 모양이다.
export function WorkTabs({ slug, current }: { slug: string; current: "toc" | "tree" }) {
  const tabs = [
    { key: "toc", label: "목차", href: `/w/${slug}` },
    { key: "tree", label: "갈래 지도", href: `/w/${slug}/tree` },
  ] as const;
  return (
    <nav className="mt-6 flex gap-2 sm:mt-10" aria-label="작품 탭">
      {tabs.map((tab) => (
        <PillLink key={tab.key} href={tab.href} current={tab.key === current}>
          {tab.label}
        </PillLink>
      ))}
    </nav>
  );
}
