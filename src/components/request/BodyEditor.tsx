import { Button } from "@ui-sdk/react/button";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import type { BodyMode, RequestDef } from "../../types";
import { prettyJson } from "../../lib/format";
import { CodeEditor } from "../common/CodeEditor";
import { KeyValueEditor } from "./KeyValueEditor";

interface BodyEditorProps {
  body: RequestDef["body"];
  onChange: (body: RequestDef["body"]) => void;
}

export function BodyEditor({ body, onChange }: BodyEditorProps) {
  const setMode = (mode: BodyMode) => {
    if (mode !== body.mode) onChange({ ...body, mode });
  };

  return (
    <Tabs value={body.mode} onValueChange={(value) => value && setMode(value as BodyMode)}>
      <TabsList className="body-mode-tabs" aria-label="Body type">
        <TabsTab value="none">None</TabsTab>
        <TabsTab value="json">JSON</TabsTab>
        <TabsTab value="text">Text</TabsTab>
        <TabsTab value="form">Form</TabsTab>
      </TabsList>
      <TabsPanel value="none">
        <p className="inline-empty">This request doesn't send a body.</p>
      </TabsPanel>
      <TabsPanel value="json">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <Button
            className="small-button ghost-button"
            onClick={() =>
              onChange({ ...body, content: prettyJson(body.content) })
            }
          >
            Format JSON
          </Button>
        </div>
        <CodeEditor
          value={body.content}
          onChange={(content) => onChange({ ...body, content })}
          language="json"
          height={240}
          ariaLabel="JSON request body"
        />
      </TabsPanel>
      <TabsPanel value="text">
        <CodeEditor
          value={body.content}
          onChange={(content) => onChange({ ...body, content })}
          language="text"
          height={240}
          ariaLabel="Text request body"
        />
      </TabsPanel>
      <TabsPanel value="form">
        <KeyValueEditor
          items={body.fields}
          onChange={(fields) => onChange({ ...body, fields })}
          labelPrefix="Form field"
          addLabel="Add field"
        />
      </TabsPanel>
    </Tabs>
  );
}
