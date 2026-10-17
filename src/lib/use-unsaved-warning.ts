"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 저장하지 않은 변경이 있으면 페이지를 떠날 때 묻는다.
 * - 새로고침·탭 닫기·다른 사이트로 가기: beforeunload(브라우저 기본 경고창)
 * - 사이트 안 링크(next/link 포함): 링크를 누를 때 confirm. 캡처 단계에서 먼저 받아
 *   취소하면 React의 링크 처리까지 가지 않게 막는다.
 * 돌려주는 함수를 부르면 그 뒤로는 묻지 않는다(임시 보관한 뒤 새로고침할 때).
 */
export function useUnsavedWarning(dirty: boolean, message: string) {
  const skip = useRef(false);

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (skip.current) return;
      e.preventDefault();
      // 오래된 브라우저는 returnValue가 있어야 경고창을 띄운다
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      if (skip.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;

      const to = new URL(link.href, window.location.href);
      const here = window.location;
      // 같은 화면 안의 #앵커 이동은 떠나는 것이 아니다
      if (to.origin === here.origin && to.pathname === here.pathname && to.search === here.search) return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);

  return useCallback(() => {
    skip.current = true;
  }, []);
}
