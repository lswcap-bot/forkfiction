// 알림(F8) 문구. 화면과 떼어 둔 순수 함수라 규칙을 테스트할 수 있다.

export const NOTIFICATION_KINDS = ["fork", "star", "canon", "hidden", "restored"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationView = {
  kind: NotificationKind;
  /** 보낸 사람 표시 이름. 관리자 숨김·복구나 탈퇴한 사용자면 null */
  actorName: string | null;
  /** 알림이 가리키는 작품. 지금 볼 수 없으면(비공개·숨김) null */
  work: {
    title: string;
    slug: string;
    forkPosition: number | null;
    /** 새 갈래 알림에서 갈라져 나온 작품(받는 사람의 작품) 제목 */
    parentTitle: string | null;
  } | null;
};

const HIDDEN_TITLE = "볼 수 없는 작품";

/** 『제목』 뒤에 받침에 맞는 조사를 붙인다. 끝 글자가 한글이 아니면 '을(를)'처럼 둘 다 적는다. */
export function withParticle(title: string, afterBatchim: string, afterVowel: string) {
  const code = title.charCodeAt(title.length - 1) - 0xac00;
  const particle =
    code >= 0 && code <= 11171 ? (code % 28 === 0 ? afterVowel : afterBatchim) : `${afterBatchim}(${afterVowel})`;
  return `『${title}』${particle}`;
}

export function notificationText(n: NotificationView): string {
  const title = n.work?.title ?? HIDDEN_TITLE;
  const actor = n.actorName ? `${n.actorName}님이` : "누군가가";

  switch (n.kind) {
    case "fork": {
      const from = n.work?.parentTitle ? `『${n.work.parentTitle}』 ` : "";
      const at = n.work?.forkPosition ? `${n.work.forkPosition}장에서 ` : "";
      return `${actor} ${from}${at}갈라진 ${withParticle(title, "을", "를")} 공개했습니다.`;
    }
    case "star":
      return `${actor} 『${title}』에 별을 주었습니다.`;
    case "canon":
      return `${withParticle(title, "이", "가")} 정사로 인정되었습니다.`;
    case "hidden":
      return `${withParticle(title, "이", "가")} 관리자에 의해 숨겨졌습니다.`;
    case "restored":
      return `『${title}』의 숨김이 풀렸습니다.`;
  }
}

export function notificationHref(n: NotificationView): string | null {
  return n.work ? `/w/${n.work.slug}` : null;
}
