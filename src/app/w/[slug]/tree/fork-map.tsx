"use client";

import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import type { Branch, ForkTreeLayout } from "@/lib/fork-tree";

// 갈래 지도 그림. 배치는 서버에서 layoutForkTree()로 계산해 넘겨받고, 여기서는 좌표로 옮겨 그리기만 한다.
// 확대·축소는 MVP에서 다루지 않으므로(PLAN) 끄고, 끌어서 옮기기만 둔다.

export type MapEntry = {
  slug: string;
  title: string;
  author: string;
  stars: number;
  note: string | null;
  isCanon: boolean;
};

type Props = {
  layout: ForkTreeLayout;
  entries: Record<string, MapEntry>;
  currentId: string;
};

const COL = 112; // 장 하나의 폭
const ROW = 92; // 줄 하나의 높이
const AXIS = 40; // 위쪽 장 번호 축
const BAR_TOP = 10; // 가지 노드 안에서 막대의 세로 위치

type AxisData = { maxChapter: number };
type BranchData = {
  branch: Branch;
  entry: MapEntry;
  current: boolean;
  forksAt: Record<number, number>;
};

const nodeTypes = { axis: AxisNode, branch: BranchNode };

export function ForkMap({ layout, entries, currentId }: Props) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      {
        id: "__axis",
        type: "axis",
        position: { x: 0, y: 0 },
        data: { maxChapter: layout.maxChapter } satisfies AxisData,
        style: { width: layout.maxChapter * COL },
        selectable: false,
      },
    ];
    const edges: Edge[] = [];

    for (const branch of layout.branches) {
      const entry = entries[branch.id];
      nodes.push({
        id: branch.id,
        type: "branch",
        position: { x: (branch.start - 1) * COL, y: AXIS + 12 + branch.lane * ROW },
        data: {
          branch,
          entry,
          current: branch.id === currentId,
          forksAt: layout.forksAt[branch.id] ?? {},
        } satisfies BranchData,
        style: { width: (branch.end - branch.start + 1) * COL - 8 },
      });
      if (branch.parentId) {
        edges.push({
          id: `${branch.parentId}->${branch.id}`,
          source: branch.parentId,
          sourceHandle: `at-${branch.start}`,
          target: branch.id,
          type: "straight",
          style: {
            stroke: entry.isCanon ? "var(--color-amber-500, #f59e0b)" : "var(--muted-foreground)",
            strokeWidth: 2,
          },
        });
      }
    }
    return { nodes, edges };
  }, [layout, entries, currentId]);

  const width = layout.maxChapter * COL;
  const height = AXIS + 12 + layout.lanes * ROW;
  // 갈래에서 열었으면 그 갈래의 갈림점 근처부터 보여 준다
  const current = layout.branches.find((b) => b.id === currentId);
  const startX = current && current.depth > 0 ? Math.max(0, (current.start - 2) * COL) : 0;

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background" style={{ height: height + 24 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="system"
        defaultViewport={{ x: 16 - startX, y: 12, zoom: 1 }}
        translateExtent={[
          [-24, -12],
          // 마지막 장 가지의 이름표가 오른쪽으로 넘칠 수 있어 여유를 둔다
          [width + 200, height + 12],
        ]}
        minZoom={1}
        maxZoom={1}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        preventScrolling={false}
        panOnDrag
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => {
          if (node.type === "branch") router.push(`/w/${(node.data as BranchData).entry.slug}`);
        }}
      />
    </div>
  );
}

function AxisNode({ data }: NodeProps<Node<AxisData>>) {
  return (
    <div className="flex h-8 text-xs text-muted-foreground" aria-hidden>
      {Array.from({ length: data.maxChapter }, (_, i) => (
        <div key={i} className="flex flex-col items-center border-l border-dashed first:border-l-0" style={{ width: COL }}>
          <span className="font-medium text-foreground tabular-nums">{i + 1}장</span>
        </div>
      ))}
    </div>
  );
}

function BranchNode({ data }: NodeProps<Node<BranchData>>) {
  const { branch, entry, current, forksAt } = data;
  const root = branch.depth === 0;
  const bar = entry.isCanon
    ? "bg-amber-500"
    : root
      ? "bg-foreground"
      : current
        ? "bg-primary"
        : "bg-muted-foreground/70";
  const points = Object.entries(forksAt).map(([chapter, count]) => ({ chapter: Number(chapter), count }));

  return (
    <div className="group relative h-[76px] cursor-pointer" title={`『${entry.title}』 열기`}>
      {/* 부모 줄에서 내려오는 선이 닿는 곳 */}
      {!root && (
        <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" style={{ left: COL / 2, top: BAR_TOP }} />
      )}
      <div
        className={`absolute right-0 left-0 rounded-full ${bar} ${current ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        style={{ top: BAR_TOP - (root ? 5 : 3), height: root ? 10 : 6, left: root ? 0 : COL / 2 - 4 }}
      />
      {/* 이 줄의 장에서 갈라진 갈래 수 */}
      {points.map(({ chapter, count }) => {
        const x = (chapter - branch.start) * COL + COL / 2;
        return (
          <div key={chapter}>
            <Handle
              id={`at-${chapter}`}
              type="source"
              position={Position.Bottom}
              isConnectable={false}
              className="!opacity-0"
              style={{ left: x, top: BAR_TOP }}
            />
            <span
              className="absolute z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-[0.65rem] font-medium tabular-nums"
              style={{ left: x, top: BAR_TOP }}
              title={`${chapter}장에서 갈라진 갈래 ${count}개`}
            >
              {count}
            </span>
          </div>
        );
      })}
      <div
        // 한 줄에는 가지 하나뿐이라, 짧은 가지의 이름표는 오른쪽 빈 곳으로 넘쳐도 된다
        className="absolute flex w-max max-w-72 min-w-0 flex-col rounded-sm bg-background/85 px-1 text-xs leading-snug group-hover:bg-muted"
        style={{ top: BAR_TOP + 10, left: root ? 0 : COL / 2 + 6 }}
      >
        <span className={`truncate font-serif text-sm ${current ? "font-bold" : "font-medium"}`}>
          {entry.isCanon && <span className="mr-1 rounded bg-amber-100 px-1 text-[0.65rem] text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">정사</span>}
          『{entry.title}』
        </span>
        <span className="truncate text-muted-foreground">
          {entry.author} · ★ {entry.stars.toLocaleString()}
          {entry.note && <> · {entry.note}</>}
        </span>
      </div>
    </div>
  );
}
