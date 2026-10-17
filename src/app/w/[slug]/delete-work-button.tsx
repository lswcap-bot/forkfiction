"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteWork } from "./actions";

// 한 번도 공개하지 않았고 갈래도 없는 내 작품 지우기. 되돌릴 수 없으므로 한 번 더 묻는다.
export function DeleteWorkButton({ workId, title, isFork }: { workId: string; title: string; isFork: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={() => setError(null)}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" className="text-destructive" />}>
        <Trash2 />
        삭제
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>『{title}』을 지울까요?</DialogTitle>
          <DialogDescription>
            한 번도 공개하지 않은 {isFork ? "갈래" : "작품"}라 지울 수 있습니다. 모든 장이 함께 사라지고 되돌릴 수
            없습니다.
            {isFork && " 원작은 그대로 남습니다."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>그만두기</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                // 성공하면 내 프로필로 이동하므로 돌아오는 것은 오류뿐이다
                const result = await deleteWork(workId);
                if (result) setError(result.error);
              })
            }
          >
            {pending ? "지우는 중…" : "지우기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
