import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// 사용자 MD 렌더링. 반드시 rehype-sanitize를 거친다(원시 HTML은 react-markdown이
// 기본으로 그리지 않고, 링크·이미지 주소 등은 sanitize가 GitHub 기준으로 걸러 낸다).
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {children}
    </ReactMarkdown>
  );
}
