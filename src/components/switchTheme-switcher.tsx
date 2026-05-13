import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSearchParamState } from "../hooks/useSearchParamState";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { SwitchSelector, type SwitchSelectorChoices } from "./switch-selector";

const Modes = {
  light: "light",
  dark: "dark",
} as const;

type Modes = (typeof Modes)[keyof typeof Modes];

export const SwitchThemeSwitcher: FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const { params, setParam } = useSearchParamState({
    theme: { type: "string" },
  });

  useEffect(() => {
    if (params.theme && (params.theme === "dark" || params.theme === "light")) {
      setTheme(params.theme);
    }
  }, [params.theme, setTheme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeSwitcher = [
    {
      content: (
        <SunIcon
          size={14}
          data-mode="light"
          aria-label="Switch to light mode"
        />
      ),
      value: Modes.light,
    },
    {
      content: (
        <MoonIcon size={14} data-mode="dark" aria-label="Switch to dark mode" />
      ),
      value: Modes.dark,
    },
  ] as SwitchSelectorChoices<Modes>;

  if (!mounted) {
    return <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />;
  }

  return (
    <SwitchSelector
      choices={themeSwitcher}
      value={resolvedTheme as Modes}
      onChange={(value) => {
        setTheme(value);
        setParam("theme", value);
      }}
      color="text"
      size="sm"
    />
  );
};
