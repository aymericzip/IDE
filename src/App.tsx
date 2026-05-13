import { AlertTriangle } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { fetchTree, setGithubToken } from "./repo-api";
import { filesFromSearch, repoFromLocation } from "./url-utils";
import { Providers } from "./providers";
import { Loader } from "./components/loader";
import "./main.css";

const Explorer = lazy(() =>
  import("./explorer").then((mod) => ({ default: mod.Explorer })),
);

const NoRepo = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="font-medium text-sm">No repository specified</p>
      <p className="text-muted-foreground text-xs">
        Open <code className="rounded bg-muted px-1">/owner/repo</code> (e.g.{" "}
        <code className="rounded bg-muted px-1">/facebook/react</code>
        ), or use legacy{" "}
        <code className="rounded bg-muted px-1">?repo=owner/name</code> /{" "}
        <code className="rounded bg-muted px-1">?url=https://github.com/…</code>
      </p>
    </div>
  );
};

const IdeApp = () => {
  const initialRepo = useMemo(
    () => repoFromLocation(window.location.pathname, window.location.search),
    [],
  );
  const initialFiles = useMemo(
    () => filesFromSearch(window.location.search),
    [],
  );
  const [entry, setEntry] = useState<{
    repo: string;
    tree: Awaited<ReturnType<typeof fetchTree>>;
  } | null>(null);
  const [loadError, setLoadError] = useState<null | string>(null);

  useEffect(() => {
    if (!initialRepo) return;
    void import("./explorer");
  }, [initialRepo]);

  const [tokenTick, setTokenTick] = useState(0);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "INTLAYER_SET_TOKEN") {
        setGithubToken(event.data.token);
        setTokenTick((prevTick) => prevTick + 1);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!initialRepo) {
      return;
    }

    let isAlive = true;
    setEntry(null);
    setLoadError(null);

    void (async () => {
      try {
        const tree = await fetchTree(initialRepo);

        if (!isAlive) {
          return;
        }

        if (tree.length === 0) {
          setLoadError(
            "Could not load a file tree. Check the repo name or URL.",
          );
        } else {
          setEntry({ repo: initialRepo, tree });
        }
      } catch (error: any) {
        if (!isAlive) {
          return;
        }

        if (error.message === "PRIVATE_REPO_OR_NOT_FOUND") {
          console.error(error);
          setLoadError(
            "This repository is private or not found. A GitHub token is needed. Waiting for token...",
          );
        } else {
          setLoadError("An error occurred while fetching the repository.");
        }
      }
    })();

    return () => {
      isAlive = false;
    };
  }, [initialRepo, tokenTick]);

  if (!initialRepo) return <NoRepo />;

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="size-8 text-amber-500" />
        <p className="font-medium text-destructive text-sm">{loadError}</p>
        <p className="text-muted-foreground text-xs">
          Check <code className="rounded bg-muted px-1">/owner/repo</code> or
          legacy <code className="rounded bg-muted px-1">?repo=</code> /{" "}
          <code className="rounded bg-muted px-1">?url=</code>
        </p>
      </div>
    );
  }

  if (!entry) {
    return <Loader />;
  }

  return (
    <Suspense fallback={<Loader />}>
      <Explorer
        initialFiles={initialFiles}
        initialRepo={entry.repo}
        initialTree={entry.tree}
      />
    </Suspense>
  );
};

export const App = () => {
  return (
    <Providers>
      <div className="h-dvh min-h-0 w-full">
        <IdeApp />
      </div>
    </Providers>
  );
};
