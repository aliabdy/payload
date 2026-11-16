import { useRef, useState } from "react";
import {
  Check,
  MoreHorizontal,
  Save,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { METHODS } from "../../types";
import type { Method, RequestDef } from "../../types";
import { copyText } from "../../lib/clipboard";
import { toCurl } from "../../lib/curl";
import { methodClass } from "../../lib/format";
import { toastError, toastSuccess } from "../../lib/toast";
import { isRequestUrlReady } from "../../lib/validation";
import { resolveVariables } from "../../lib/variables";
import { tabDisplayNames } from "../../lib/tabs";
import { useAppStore } from "../../store/useAppStore";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { AuthEditor } from "./AuthEditor";
import { BodyEditor } from "./BodyEditor";
import { KeyValueEditor } from "./KeyValueEditor";

function OptionsPopover({
  options,
  onChange,
}: {
  options: RequestDef["options"];
  onChange: (options: RequestDef["options"]) => void;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              className="icon-button"
              aria-label="Request options"
            />
          }
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent data-agent-hidden>Request options</TooltipContent>
      </Tooltip>
      <PopoverContent className="popover-content">
        <PopoverTitle className="popover-title">Request options</PopoverTitle>
        <div className="options-grid">
          <label className="options-label" htmlFor="request-timeout">
            Timeout (ms)
          </label>
          <Input
            id="request-timeout"
            aria-label="Request timeout in milliseconds"
            type="number"
            min={0}
            step={1000}
            value={String(options.timeoutMs)}
            onValueChange={(value) =>
              onChange({ ...options, timeoutMs: Math.max(0, Number(value) || 0) })
            }
            style={{ width: 110 }}
          />
          <span className="options-label">Follow redirects</span>
          <Switch
            checked={options.followRedirects}
            onCheckedChange={(checked) =>
              onChange({ ...options, followRedirects: checked === true })
            }
            aria-label="Follow redirects"
          >
            <SwitchThumb />
          </Switch>
          <span className="options-label">Verify TLS certificates</span>
          <Switch
            checked={options.verifyTls}
            onCheckedChange={(checked) =>
              onChange({ ...options, verifyTls: checked === true })
            }
            aria-label="Verify TLS certificates"
          >
            <SwitchThumb />
          </Switch>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RequestPanel() {
  const tab = useAppStore((state) =>
    state.tabs.find((item) => item.id === state.activeTabId),
  );
  const tabTitle = useAppStore(
    (state) =>
      tabDisplayNames(state.tabs).get(state.activeTabId) ?? "",
  );
  const environments = useAppStore((state) => state.data.environments);
  const activeEnvId = useAppStore((state) => state.data.activeEnvId);
  const update = useAppStore((state) => state.updateActiveRequest);
  const sendActive = useAppStore((state) => state.sendActive);
  const cancelActive = useAppStore((state) => state.cancelActive);
  const openSaveDialog = useAppStore((state) => state.openSaveDialog);
  const duplicateActive = useAppStore((state) => state.duplicateActive);
  const deleteActiveSaved = useAppStore((state) => state.deleteActiveSaved);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  if (!tab) return null;
  const request = tab.request;
  const environment = environments.find((env) => env.id === activeEnvId) ?? null;
  const urlResolution = resolveVariables(request.url, environment);
  const urlEmpty = request.url.trim().length === 0;
  const urlInvalid = !isRequestUrlReady(request.url);
  const showUrlError = urlTouched && urlInvalid;

  const count = (items: RequestDef["params"]) =>
    items.filter((item) => item.enabled && item.key).length;

  const copyCurl = async () => {
    const copied = await copyText(toCurl(request));
    if (copied) toastSuccess("cURL copied");
    else toastError("Could not copy to clipboard");
  };

  return (
    <section className="pane" aria-label="Request">
      <div className="pane-head request-toolbar">
        <span className="request-title" title={tabTitle}>
          {tabTitle || tab.name}
        </span>
        {tab.dirty ? (
          <>
            <span className="tab-dirty" aria-hidden="true" title="Unsaved draft" />
            <span className="sr-only">Unsaved draft</span>
          </>
        ) : null}
        <span className="grow" />
        {tab.savedRequestId ? (
          <span
            className="saved-state"
            title="Changes to saved requests persist automatically"
          >
            <Check size={13} aria-hidden="true" />
            Saved
          </span>
        ) : (
          <Button
            className="small-button ghost-button"
            onClick={openSaveDialog}
          >
            <Save size={13} />
            Save request
          </Button>
        )}
        <Menu
          onAction={(value) => {
            if (value === "curl") void copyCurl();
            if (value === "duplicate") duplicateActive();
            if (value === "delete") setConfirmDelete(true);
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <MenuTrigger
                  className="icon-button"
                  aria-label="More request actions"
                />
              }
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent data-agent-hidden>More request actions</TooltipContent>
          </Tooltip>
          <MenuContent className="popup-content">
            <MenuItem value="curl">Copy as cURL</MenuItem>
            <MenuItem value="duplicate">Duplicate request</MenuItem>
            <MenuSeparator />
            <MenuItem value="delete" destructive disabled={!tab.savedRequestId}>
              Delete saved request
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="url-row">
        <div className="request-bar" data-method={request.method}>
          <Select
            value={request.method}
            onValueChange={(value) => {
              if (value && METHODS.includes(value as Method)) {
                update({ method: value as Method });
              }
            }}
          >
            <SelectTrigger className="method-select" aria-label="Method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="select-content">
              {METHODS.map((method) => (
                <SelectItem key={method} value={method} label={method}>
                  <span className={methodClass(method)}>{method}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="request-bar-divider" aria-hidden="true" />

          <Field invalid={showUrlError} className="url-field">
            <FieldLabel>Request URL</FieldLabel>
            <Input
              ref={urlInputRef}
              data-request-url
              value={request.url}
              onValueChange={(url) => update({ url })}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://api.example.com/users/{{id}}"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {showUrlError ? (
              <FieldError>Enter a full http:// or https:// URL.</FieldError>
            ) : null}
          </Field>

          <OptionsPopover
            options={request.options}
            onChange={(options) => update({ options })}
          />

          <Button
            className="send-button primary-button"
            disabled={!tab.sending && urlEmpty}
            onClick={() => {
              if (tab.sending) {
                void cancelActive();
                return;
              }
              if (urlInvalid) {
                setUrlTouched(true);
                urlInputRef.current?.focus();
                return;
              }
              void sendActive();
            }}
          >
            {tab.sending ? (
              <>
                <X size={14} />
                Cancel
              </>
            ) : (
              <>
                <Send size={13} />
                Send
              </>
            )}
          </Button>
        </div>

        {urlResolution.unresolved.length > 0 ? (
          <p className="unresolved url-warning">
            Unresolved: {urlResolution.unresolved.map((name) => `{{${name}}}`).join(", ")}
          </p>
        ) : null}
      </div>

      <div className="request-scroll">
        <Tabs defaultValue="params" className="section-tabs">
          <TabsList aria-label="Request sections">
            <TabsTab value="params">
              Params
              {count(request.params) > 0 ? (
                <span className="count-badge">{count(request.params)}</span>
              ) : null}
            </TabsTab>
            <TabsTab value="headers">
              Headers
              {count(request.headers) > 0 ? (
                <span className="count-badge">{count(request.headers)}</span>
              ) : null}
            </TabsTab>
            <TabsTab value="body">
              Body
              {request.body.mode !== "none" ? (
                <span className="count-badge">1</span>
              ) : null}
            </TabsTab>
            <TabsTab value="auth">
              Auth
              {request.auth.type !== "none" ? (
                <span className="count-badge">1</span>
              ) : null}
            </TabsTab>
          </TabsList>
          <TabsPanel value="params" className="section-panel">
            <KeyValueEditor
              items={request.params}
              onChange={(params) => update({ params })}
              labelPrefix="Parameter"
              addLabel="Add parameter"
              keyPlaceholder="key"
              valuePlaceholder="value"
            />
          </TabsPanel>
          <TabsPanel value="headers" className="section-panel">
            <KeyValueEditor
              items={request.headers}
              onChange={(headers) => update({ headers })}
              labelPrefix="Header"
              addLabel="Add header"
              keyPlaceholder="Content-Type"
              valuePlaceholder="application/json"
            />
          </TabsPanel>
          <TabsPanel value="body" className="section-panel">
            <BodyEditor
              body={request.body}
              onChange={(body) => update({ body })}
            />
          </TabsPanel>
          <TabsPanel value="auth" className="section-panel">
            <AuthEditor
              auth={request.auth}
              onChange={(auth) => update({ auth })}
            />
          </TabsPanel>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete saved request?"
        description="This removes the request from its collection and closes any open tab for it."
        confirmLabel="Delete request"
        agentConfirm="Deletes this saved request and closes its tabs"
        onConfirm={deleteActiveSaved}
      />
    </section>
  );
}
