import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DemoStore } from "./store.js";
import type {
  AssetInfoData,
  BackendConnection,
  FileView,
  P4PilotBackend,
  ReviewData,
} from "../backend/types.js";
import type { ChangelistSummary } from "@p4pilot/core/browser";

export const operationKey = {
  smartEdit: (path: string) => `smart-edit:${path}`,
  revert: (path: string) => `revert:${path}`,
  assetInfo: (path: string) => `asset-info:${path}`,
  review: (change: string) => `review:${change}`,
  createChangelist: "create-changelist",
} as const;

interface DemoContextValue {
  files: FileView[];
  changelists: ChangelistSummary[];
  ready: boolean;
  connection: BackendConnection | null;
  error: string | null;
  pending: readonly string[];
  clearError: () => void;
  smartEdit: (clientFile: string, changelist?: string) => Promise<boolean>;
  createChangelist: (description: string) => Promise<boolean>;
  revert: (clientFile: string) => Promise<boolean>;
  inspectAsset: (path: string) => Promise<AssetInfoData | undefined>;
  loadReview: (change: string) => Promise<ReviewData | undefined>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DemoProvider({
  children,
  store: providedStore,
}: {
  children: ReactNode;
  store?: P4PilotBackend;
}) {
  const [store] = useState(() => providedStore ?? new DemoStore());
  const [files, setFiles] = useState<FileView[]>([]);
  const [changelists, setChangelists] = useState<ChangelistSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<BackendConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<readonly string[]>([]);
  const pendingRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const snapshot = await store.getWorkspace();
    setFiles(snapshot.files);
    setChangelists(snapshot.changelists);
    setConnection(snapshot.connection);
  }, [store]);

  const runOperation = useCallback(
    async <T,>(
      key: string,
      operation: () => Promise<T>,
    ): Promise<T | undefined> => {
      if (pendingRef.current.has(key)) return undefined;
      pendingRef.current.add(key);
      setPending([...pendingRef.current]);
      setError(null);
      try {
        return await operation();
      } catch (operationError) {
        setError(errorMessage(operationError));
        return undefined;
      } finally {
        pendingRef.current.delete(key);
        setPending([...pendingRef.current]);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void refresh()
      .catch((refreshError: unknown) => {
        if (active) {
          setConnection(null);
          setError(errorMessage(refreshError));
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const smartEdit = useCallback(
    async (clientFile: string, changelist?: string) => {
      const result = await runOperation(
        operationKey.smartEdit(clientFile),
        async () => {
          await store.smartEdit(clientFile, changelist);
          await refresh();
          return true;
        },
      );
      return result === true;
    },
    [refresh, runOperation, store],
  );
  const createChangelist = useCallback(
    async (description: string) => {
      const result = await runOperation(
        operationKey.createChangelist,
        async () => {
          await store.createChangelist(description);
          await refresh();
          return true;
        },
      );
      return result === true;
    },
    [refresh, runOperation, store],
  );
  const revert = useCallback(
    async (clientFile: string) => {
      const result = await runOperation(
        operationKey.revert(clientFile),
        async () => {
          await store.revert(clientFile);
          await refresh();
          return true;
        },
      );
      return result === true;
    },
    [refresh, runOperation, store],
  );
  const inspectAsset = useCallback(
    (path: string) =>
      runOperation(operationKey.assetInfo(path), () => store.assetInfo(path)),
    [runOperation, store],
  );
  const loadReview = useCallback(
    (change: string) =>
      runOperation(operationKey.review(change), () => store.review(change)),
    [runOperation, store],
  );

  const value: DemoContextValue = {
    files,
    changelists,
    ready,
    connection,
    error,
    pending,
    clearError: () => setError(null),
    smartEdit,
    createChangelist,
    revert,
    inspectAsset,
    loadReview,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (ctx === null)
    throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
