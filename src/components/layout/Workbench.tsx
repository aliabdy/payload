import {
  Resizable,
  ResizableHandle,
  ResizablePanel,
} from "@ui-sdk/react/resizable";
import { useAppStore } from "../../store/useAppStore";
import { RequestPanel } from "../request/RequestPanel";
import { ResponsePanel } from "../response/ResponsePanel";
import { RequestTabStrip } from "./RequestTabStrip";
import { Sidebar } from "./Sidebar";

function MainPane() {
  const layout = useAppStore((state) => state.data.layout);
  const setLayout = useAppStore((state) => state.setLayout);

  return (
    <main className="main-pane">
      <RequestTabStrip />
      <div className="workspace">
        <Resizable
          aria-label="Request and response layout"
          orientation="vertical"
          defaultLayout={[layout.split[0] ?? 53, layout.split[1] ?? 47]}
          onLayoutCommit={(sizes) => {
            if (sizes.length === 2) setLayout("split", sizes);
          }}
        >
          <ResizablePanel defaultSize={layout.split[0] ?? 53} minSize={20}>
            <RequestPanel />
          </ResizablePanel>
          <ResizableHandle aria-label="Resize request pane" />
          <ResizablePanel defaultSize={layout.split[1] ?? 47} minSize={18}>
            <ResponsePanel />
          </ResizablePanel>
        </Resizable>
      </div>
    </main>
  );
}

export function Workbench({ sidebarVisible }: { sidebarVisible: boolean }) {
  const layout = useAppStore((state) => state.data.layout);
  const setLayout = useAppStore((state) => state.setLayout);

  if (!sidebarVisible) {
    return (
      <div className="app-body">
        <MainPane />
      </div>
    );
  }

  return (
    <div className="app-body">
      <Resizable
        aria-label="Workspace layout"
        defaultLayout={[layout.sidebar[0] ?? 22, layout.sidebar[1] ?? 78]}
        onLayoutCommit={(sizes) => {
          if (sizes.length === 2) setLayout("sidebar", sizes);
        }}
      >
        <ResizablePanel defaultSize={layout.sidebar[0] ?? 22} minSize="184px">
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle aria-label="Resize sidebar" />
        <ResizablePanel defaultSize={layout.sidebar[1] ?? 78} minSize={40}>
          <MainPane />
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
