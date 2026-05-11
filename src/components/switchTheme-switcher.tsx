import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { SwitchSelector, type SwitchSelectorChoices } from "./switch-selector";

enum Modes {
  light = "light",
  dark = "dark",
}

export const SwitchThemeSwitcher: FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      onChange={setTheme}
      color="text"
      size="sm"
    />
  );
};
