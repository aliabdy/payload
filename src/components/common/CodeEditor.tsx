import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import {
  foldedRanges,
  HighlightStyle,
  syntaxHighlighting,
  unfoldEffect,
} from "@codemirror/language";
import { RangeSetBuilder, type StateEffect } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { MatchRange } from "../../lib/search";

export interface EditorSearch {
  ranges: MatchRange[];
  activeIndex: number;
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "json" | "text";
  readOnly?: boolean;
  height?: number | string;
  ariaLabel: string;
  search?: EditorSearch;
  nativeSearch?: boolean;
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

function searchDecorations(ranges: MatchRange[], activeIndex: number) {
  return EditorView.decorations.compute(["doc"], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    ranges.forEach((range, index) => {
      if (range.end > state.doc.length) return;
      builder.add(
        range.start,
        range.end,
        Decoration.mark({
          class:
            index === activeIndex
              ? "cm-search-match cm-search-match-active"
              : "cm-search-match",
        }),
      );
    });
    return builder.finish();
  });
}

function revealMatch(view: EditorView, range: MatchRange) {
  const effects: StateEffect<unknown>[] = [];
  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
    if (from <= range.end && to >= range.start) {
      effects.push(unfoldEffect.of({ from, to }));
    }
  });
  effects.push(EditorView.scrollIntoView(range.start, { y: "center" }));
  view.dispatch({ effects });
}

export function CodeEditor({
  value,
  onChange,
  language = "text",
  readOnly = false,
  height = 240,
  ariaLabel,
  search,
  nativeSearch = true,
}: CodeEditorProps) {
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  const revealActive = (view?: EditorView | null) => {
    const editor = view ?? editorRef.current?.view;
    const current = searchRef.current;
    if (!editor || !current || current.activeIndex < 0) return;
    const range = current.ranges[current.activeIndex];
    if (range) revealMatch(editor, range);
  };

  const extensions = useMemo(() => {
    const list = [editorTheme, syntaxHighlighting(highlight)];
    if (language === "json") list.push(json());
    if (search && search.ranges.length > 0) {
      list.push(searchDecorations(search.ranges, search.activeIndex));
    }
    return list;
  }, [language, search?.ranges, search?.activeIndex]);

  useEffect(() => {
    revealActive();
  }, [search?.ranges, search?.activeIndex]);

  return (
    <div className="code-editor" style={{ height: resolvedHeight }}>
      <CodeMirror
        ref={editorRef}
        value={value}
        height={resolvedHeight}
        style={{ height: resolvedHeight }}
        theme="none"
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={onChange}
        onCreateEditor={(view) => revealActive(view)}
        aria-label={ariaLabel}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: nativeSearch,
        }}
      />
    </div>
  );
}
