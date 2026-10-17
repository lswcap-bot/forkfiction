// 갈래 지도(F6) 배치. 가로축은 장 번호, 세로는 줄(lane). 원작은 0번 줄.
// 갈래는 부모 줄의 갈림점에서 뻗어 나와 자기 줄에서 갈림점~마지막 장까지 이어진다.
// 화면(React Flow)과 떼어 둔 순수 함수라 규칙을 테스트할 수 있다.

export type TreeWork = {
  id: string;
  /** 원작이면 null */
  parentId: string | null;
  /** 부모의 몇 장에서 갈라졌는지(갈림점). 원작이면 null */
  forkPoint: number | null;
  chapterCount: number;
  stars: number;
  isCanon: boolean;
  createdAt: string;
};

export type Branch = {
  id: string;
  parentId: string | null;
  lane: number;
  /** 0: 원작, 1: 원작의 갈래, 2: 갈래의 갈래 … */
  depth: number;
  /** 이 줄이 시작하는 장(원작은 1, 갈래는 갈림점) */
  start: number;
  /** 이 줄의 마지막 장 */
  end: number;
  parentLane: number | null;
};

export type ForkTreeLayout = {
  /** 줄 순서(위에서 아래)대로 */
  branches: Branch[];
  lanes: number;
  /** 가로축 끝(가장 긴 줄의 마지막 장) */
  maxChapter: number;
  /** 지도에 그리지 않은 갈래 수('더 보기'로 보여 준다) */
  hidden: number;
  /** 줄(작품 id)마다, 장 번호별로 그 줄에서 직접 갈라진 갈래 수. 지도에서 잘린 갈래도 센다. */
  forksAt: Record<string, Record<number, number>>;
};

export const TREE_LIMIT = 50;

// 정사 → 별 많은 순 → 먼저 만든 순
function rank(a: TreeWork, b: TreeWork) {
  if (a.isCanon !== b.isCanon) return a.isCanon ? -1 : 1;
  if (a.stars !== b.stars) return b.stars - a.stars;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function layoutForkTree(root: TreeWork, forks: TreeWork[], opts: { limit?: number } = {}): ForkTreeLayout {
  const limit = opts.limit ?? TREE_LIMIT;
  const byId = new Map<string, TreeWork>([[root.id, root], ...forks.map((f) => [f.id, f] as const)]);

  // 뿌리까지 보이는 조상으로 이어지는 갈래만 그린다(중간 갈래가 비공개로 바뀌면 끊긴다)
  const connected = forks.filter((f) => {
    const seen = new Set<string>();
    let cur: TreeWork | undefined = f;
    while (cur && cur.id !== root.id) {
      if (seen.has(cur.id)) return false;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return cur?.id === root.id;
  });

  // 장별 갈래 수: 그 줄에서 직접 갈라진 갈래(잘린 갈래도 센다)
  const forksAt: Record<string, Record<number, number>> = {};
  for (const f of connected) {
    const at = (forksAt[f.parentId!] ??= {});
    at[f.forkPoint!] = (at[f.forkPoint!] ?? 0) + 1;
  }

  // limit개까지 순위대로 남기고, 남긴 갈래의 조상은 함께 남긴다
  const kept = new Set<string>([root.id]);
  for (const f of [...connected].sort(rank).slice(0, limit)) {
    for (let cur: TreeWork | undefined = f; cur && !kept.has(cur.id); cur = byId.get(cur.parentId!)) {
      kept.add(cur.id);
    }
  }

  const children = new Map<string, TreeWork[]>();
  for (const f of connected) {
    if (!kept.has(f.id)) continue;
    const list = children.get(f.parentId!) ?? [];
    list.push(f);
    children.set(f.parentId!, list);
  }

  // 깊이 우선으로 줄을 매긴다: 갈래 바로 아래에 그 갈래의 갈래가 온다
  const branches: Branch[] = [];
  const visit = (w: TreeWork, depth: number, parentLane: number | null) => {
    const lane = branches.length;
    branches.push({
      id: w.id,
      parentId: w.parentId,
      lane,
      depth,
      start: w.forkPoint ?? 1,
      end: Math.max(w.chapterCount, w.forkPoint ?? 1),
      parentLane,
    });
    for (const child of (children.get(w.id) ?? []).sort(rank)) visit(child, depth + 1, lane);
  };
  visit(root, 0, null);

  return {
    branches,
    lanes: branches.length,
    maxChapter: Math.max(...branches.map((b) => b.end)),
    hidden: forks.length - (branches.length - 1),
    forksAt,
  };
}
