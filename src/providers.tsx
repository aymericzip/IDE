import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParamState } from './hooks/useSearchParamState';

export type Theme = 'light' | 'dark';

/**
 * Shared with the pre-paint script in `index.html`, which reads the same key
 * so the first frame already carries the persisted theme.
 */
const THEME_STORAGE_KEY = 'theme';
const THEME_ATTRIBUTE = 'data-theme';
const DEFAULT_THEME: Theme = 'dark';

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark';

const readStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

/**
 * Swaps the theme with every CSS transition disabled for one frame, so
 * elements that animate their colors do not each fade at their own pace.
 */
const applyTheme = (theme: Theme): void => {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none!important}')
  );
  document.head.appendChild(style);

  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;

  // Forces a style recalculation before the override is lifted.
  window.getComputedStyle(document.body);
  setTimeout(() => document.head.removeChild(style), 1);
};

type ThemeContextValue = {
  theme: Theme;
  /** Kept as an alias of `theme`: there is no system theme to resolve. */
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Light/dark theme state persisted in `localStorage` and mirrored onto the
 * `data-theme` attribute of `<html>`.
 *
 * Replaces `next-themes`, whose provider injects an inline `<script>` on every
 * mount. That script is redundant here (see `index.html`) and it is refused by
 * the hash-based `script-src` in `server.ts`, as its body is the minified
 * source of a function and so changes with every build.
 */
const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage may be unavailable (private mode, blocked site data).
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follows theme changes made from another tab of the IDE.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(isTheme(event.newValue) ? event.newValue : DEFAULT_THEME);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within <Providers>');
  }
  return context;
};

const ThemeInitializer = () => {
  const { setTheme } = useTheme();
  const { params } = useSearchParamState({
    theme: { type: 'string' },
  });

  useEffect(() => {
    if (isTheme(params.theme)) {
      setTheme(params.theme);
    }
  }, [params.theme, setTheme]);

  return null;
};

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider>
      <ThemeInitializer />
      {children}
    </ThemeProvider>
  );
};
