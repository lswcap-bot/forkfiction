"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next !== "/") callback.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        // 이미 구글에 로그인돼 있어도 매번 계정을 고르게 한다(여러 계정을 쓰는 사람)
        queryParams: { prompt: "select_account" },
      },
    });
    // 성공하면 구글 화면으로 넘어가므로 여기로 돌아오지 않는다.
    if (error) {
      setError("구글 로그인을 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={signIn} disabled={pending}>
        {pending ? "구글로 이동하는 중…" : "구글로 계속하기"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
