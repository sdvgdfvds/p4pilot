import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ChangelistSummary } from "@p4pilot/core/browser";
import { DemoStore, type FileView } from "./store.js";

interface DemoContextValue {
  files: FileView[];
  changelists: ChangelistSummary[];
  ready: boolean;
  smartEdit: (clientFile: string, changelist?: string) => Promise<void>;
  createChangelist: (description: string) => Promise<void>;
  revert: (clientFile: string) => Promise<void>;
  store: DemoStore;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new DemoStore(), []);
  const [files, setFiles] = useState<FileView[]>([]);
  const [changelists, setChangelists] = useState<ChangelistSummary[]>([]);
  const [ready, setReady] = useState(false);

  async function refresh() {
    setFiles(await store.listFiles());
    setChangelists(await store.listChangelists());
    setReady(true);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: DemoContextValue = {
    files,
    changelists,
    ready,
    store,
    smartEdit: async (clientFile, changelist) => {
      await store.smartEdit(clientFile, changelist);
      await refresh();
    },
    createChangelist: async (description) => {
      await store.createChangelist(description);
      await refresh();
    },
    revert: async (clientFile) => {
      await store.revert(clientFile);
      await refresh();
    },
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (ctx === null) throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
