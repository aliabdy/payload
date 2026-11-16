export const EditorView = {
  theme: () => [],
};

interface CodeEditorStubProps {
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  height?: number;
}

export default function CodeEditorStub({
  value = "",
  onChange,
  readOnly = false,
  ariaLabel = "Code editor",
}: CodeEditorStubProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
