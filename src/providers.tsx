import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { useSearchParamState } from "./hooks/useSearchParamState";

const ThemeInitializer = () => {
  const { setTheme } = useTheme();
  const { params } = useSearchParamState({
    theme: { type: "string" },
  });

  useEffect(() => {
    if (params.theme && (params.theme === "dark" || params.theme === "light")) {
      setTheme(params.theme);
    }
  }, [params.theme, setTheme]);

  return null;
};

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      disableTransitionOnChange
      enableSystem={false}
    >
      <ThemeInitializer />
      {children}
    </ThemeProvider>
  );
};
