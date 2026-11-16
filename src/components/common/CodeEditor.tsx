import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "json" | "text";
  readOnly?: boolean;
  height?: number | string;
  ariaLabel: string;
}

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--code-property)" },
  { tag: t.string, color: "var(--code-string)" },
  { tag: [t.number, t.bool], color: "var(--code-number)" },
  { tag: t.null, color: "var(--code-null)" },
  { tag: t.punctuation, color: "var(--code-punctuation)" },
  { tag: t.invalid, color: "var(--code-invalid)" },
]);

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-gutters": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

export function CodeEditor({
  value,
  onChange,
  language = "text",
  readOnly = false,
  height = 240,
  ariaLabel,
}: CodeEditorProps) {
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;

  const extensions = useMemo(() => {
    const list = [editorTheme, syntaxHighlighting(highlight)];
    if (language === "json") list.push(json());
    return list;
  }, [language]);

  return (
    <div className="code-editor" style={{ height: resolvedHeight }}>
      <CodeMirror
        value={value}
        height={resolvedHeight}
        theme="none"
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={onChange}
        aria-label={ariaLabel}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
        }}
      />
    </div>
  );
}
