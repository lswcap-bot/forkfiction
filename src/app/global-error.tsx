"use client";

// 최상위 레이아웃까지 무너졌을 때. 전역 스타일이 들어오지 않으므로 인라인 스타일만 쓴다.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 16,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <title>문제가 생겼습니다 · ForkFiction</title>
        <h1 style={{ fontSize: 24, margin: 0 }}>문제가 생겼습니다</h1>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          잠시 뒤 다시 시도해 주세요. 계속되면 lswcap@naver.com으로 알려 주세요.
          {error.digest && <><br />오류 번호 {error.digest}</>}
        </p>
        <button
          onClick={() => retry()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
