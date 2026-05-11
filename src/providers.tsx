import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

export const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="data-theme"
    defaultTheme="dark"
    disableTransitionOnChange
    enableSystem={false}
  >
    {children}
  </ThemeProvider>
);
