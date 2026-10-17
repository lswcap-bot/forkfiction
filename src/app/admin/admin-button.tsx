"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { dismissReport, hideWork, restoreWork } from "./actions";

const ACTIONS = { hide: hideWork, restore: restoreWork, dismiss: dismissReport } as const;

export function AdminButton({
  action,
  id,
  confirmText,
  children,
}: {
  action: keyof typeof ACTIONS;
  id: string;
  confirmText?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={action === "hide" ? "destructive" : "outline"}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await ACTIONS[action](id);
            if (result) setError(result.error);
          });
        }}
      >
        {children}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  );
}
