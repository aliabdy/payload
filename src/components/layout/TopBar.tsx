import { useState } from "react";
import {
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  Sun,
  Terminal,
} from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { useAppStore } from "../../store/useAppStore";
import { useResolvedTheme } from "../../lib/appearance";
import { CurlImportDialog } from "../dialogs/CurlImportDialog";
import { EnvManagerDialog } from "../environments/EnvManagerDialog";
import { SettingsDialog } from "../settings/SettingsDialog";

export function TopBar({
  sidebarVisible,
  onToggleSidebar,
}: {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}) {
  const environments = useAppStore((state) => state.data.environments);
  const activeEnvId = useAppStore((state) => state.data.activeEnvId);
  const theme = useAppStore((state) => state.data.settings.theme);
  const resolvedTheme = useResolvedTheme(theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setActiveEnvironment = useAppStore((state) => state.setActiveEnvironment);
  const [envManagerOpen, setEnvManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [curlOpen, setCurlOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-mark" src="/payload.svg" alt="" aria-hidden="true" />
        Payload
        <span className="brand-beta">local</span>
      </div>
      <span className="topbar-sep" aria-hidden="true" />

      <Field className="topbar-select env-select">
        <FieldLabel>Environment</FieldLabel>
        <Select
          value={activeEnvId ?? "none"}
          onValueChange={(value) =>
            setActiveEnvironment(value === "none" ? null : value)
          }
        >
          <SelectTrigger aria-label="Environment">
            <SelectValue placeholder="No environment" />
          </SelectTrigger>
          <SelectContent className="select-content">
            <SelectItem value="none" label="No environment">
              No environment
            </SelectItem>
            {environments.map((environment) => (
              <SelectItem
                key={environment.id}
                value={environment.id}
                label={environment.name}
              >
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Tooltip>
        <TooltipTrigger
          className="icon-button"
          aria-label="Manage environments"
          onClick={() => setEnvManagerOpen(true)}
        >
          <SlidersHorizontal size={14} />
        </TooltipTrigger>
        <TooltipContent>Manage environments</TooltipContent>
      </Tooltip>

      <span className="grow" />

      <div className="topbar-tools">
        <Button
          className="small-button ghost-button"
          onClick={() => setCurlOpen(true)}
        >
          <Terminal size={13} />
          Import cURL
        </Button>

        <span className="topbar-sep" aria-hidden="true" />

        <Tooltip>
          <TooltipTrigger
            className="icon-button"
            aria-label="Theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun size={15} />
            ) : (
              <Moon size={15} />
            )}
          </TooltipTrigger>
          <TooltipContent>
            {theme === "system"
              ? `System theme is ${resolvedTheme}. Switch to ${resolvedTheme === "dark" ? "light" : "dark"}.`
              : resolvedTheme === "dark"
                ? "Use light theme"
                : "Use dark theme"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            className="icon-button"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </TooltipTrigger>
          <TooltipContent>
            {sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            className="icon-button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={15} />
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>

      <EnvManagerDialog open={envManagerOpen} onOpenChange={setEnvManagerOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CurlImportDialog open={curlOpen} onOpenChange={setCurlOpen} />
    </header>
  );
}
