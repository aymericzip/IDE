import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    disableTransitionOnChange
    enableSystem={false}
  >
    {children}
  </ThemeProvider>
);

export { Providers };
