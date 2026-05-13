import { useCallback, useMemo, useState, useEffect } from "react";

type ParamType = "string" | "number" | "boolean" | "stringArray";

type ParamConfig = {
  type: ParamType;
  fallbackValue?: string | number | boolean | string[];
};

type ConfigMap = Record<string, ParamConfig>;

type InferType<T extends ParamType> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : string[];

type StateFromConfig<TConfig extends ConfigMap> = {
  [K in keyof TConfig]: InferType<TConfig[K]["type"]>;
};

const defaultForType = (type: ParamType): unknown => {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "stringArray":
      return [];
    default:
      return "";
  }
};

const isAtDefault = (value: unknown, config: ParamConfig): boolean => {
  if (Array.isArray(value)) return value.length === 0;
  const fallback = config.fallbackValue ?? defaultForType(config.type);
  return value === fallback;
};

const parseValue = (val: unknown, cfg: ParamConfig): unknown => {
  if (val === undefined || val === null) {
    return cfg.fallbackValue ?? defaultForType(cfg.type);
  }

  switch (cfg.type) {
    case "string":
      return String(val);
    case "number": {
      const parsed = Number(val);
      return Number.isNaN(parsed)
        ? (cfg.fallbackValue ?? defaultForType("number"))
        : parsed;
    }
    case "boolean": {
      if (typeof val === "boolean") return val;
      const truthy = ["true", "1", "yes", "on"];
      return truthy.includes(String(val).toLowerCase());
    }
    case "stringArray": {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === "string") return [val];
      return [];
    }
    default:
      return val;
  }
};

export const useSearchParamState = <TConfig extends ConfigMap>(
  config: TConfig,
) => {
  const getInitialSearch = () =>
    typeof window !== "undefined" ? window.location.search : "";

  const [searchString, setSearchString] = useState(getInitialSearch);

  // Sync state with browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => setSearchString(window.location.search);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Parse raw URLSearchParams based on config
  const searchParams = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const parsed: Record<string, unknown> = {};

    for (const key of Object.keys(config)) {
      const isArray = config[key].type === "stringArray";
      const val = isArray ? params.getAll(key) : params.get(key);
      // Fallback to undefined if the key isn't in the URL to trigger default logic
      parsed[key] = isArray
        ? (val as string[]).length > 0
          ? val
          : undefined
        : (val ?? undefined);
    }

    return parsed;
  }, [searchString, config]);

  // Compute final state with fallbacks and types
  const params = useMemo(() => {
    const computed: Partial<StateFromConfig<TConfig>> = {};

    for (const [key, cfg] of Object.entries(config)) {
      computed[key as keyof TConfig] = parseValue(
        searchParams[key],
        cfg,
      ) as InferType<TConfig[keyof TConfig]["type"]>;
    }

    return computed as StateFromConfig<TConfig>;
  }, [searchParams, config]);

  const updateUrl = useCallback(
    (updates: Partial<Record<keyof TConfig, unknown>>) => {
      if (typeof window === "undefined") return;

      const url = new URL(window.location.href);

      for (const [key, value] of Object.entries(updates)) {
        const cfg = config[key];

        // Always wipe the existing key before setting/appending
        url.searchParams.delete(key);

        if (
          value === null ||
          value === undefined ||
          (cfg && isAtDefault(value, cfg))
        ) {
          continue; // Leave it deleted
        }

        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }

      const newUrl = url.pathname + url.search + url.hash;

      // Update browser history natively
      window.history.replaceState(null, "", newUrl);

      // Force React re-render since replaceState doesn't fire the popstate event
      setSearchString(url.search);
    },
    [config],
  );

  const setParam = useCallback(
    <K extends keyof TConfig>(
      key: K,
      value: StateFromConfig<TConfig>[K] | null,
    ) => {
      updateUrl({ [key]: value } as Partial<Record<keyof TConfig, unknown>>);
    },
    [updateUrl],
  );

  const setParams = useCallback(
    (updates: Partial<StateFromConfig<TConfig>>) => {
      updateUrl(updates as Partial<Record<keyof TConfig, unknown>>);
    },
    [updateUrl],
  );

  return { params, setParam, setParams } as const;
};
