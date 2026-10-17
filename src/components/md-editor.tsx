"use client";

import { useEffect, useRef } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, placeholder as placeholderExt } from "@codemirror/view";
import { minimalSetup } from "codemirror";

type Props = {
  /** 처음 값. 바깥에서 글을 바꾸려면(다른 장, 임시 보관본 불러오기) key를 바꿔 새로 만든다. */
  initialValue: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel: string;
};

// 장 본문 편집기: CodeMirror 6 마크다운 모드.
// 값은 편집기가 들고 있고 바깥으로 알리기만 한다. 입력 중에 바깥 값을 다시 밀어 넣지 않아야
// 한글 조합(IME)이 끊기지 않는다.
export function MdEditor({ initialValue, onChange, readOnly = false, placeholder, ariaLabel }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const editable = useRef(new Compartment());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          minimalSetup,
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": ariaLabel, lang: "ko", spellcheck: "false" }),
          placeholder ? placeholderExt(placeholder) : [],
          editable.current.of(editableExtensions(readOnly)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
          editorTheme,
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // 처음 값은 만들 때 한 번만 쓴다(위 설명 참고)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure(editableExtensions(readOnly)) });
  }, [readOnly]);

  return <div ref={host} className="h-full min-h-0" />;
}

function editableExtensions(readOnly: boolean) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "1rem", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-serif, serif)",
    lineHeight: "1.9",
    overflow: "auto",
  },
  ".cm-content": { padding: "1rem 0.25rem", caretColor: "currentColor" },
  ".cm-line": { padding: "0 0.75rem" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-cursor": { borderLeftColor: "currentColor" },
});
