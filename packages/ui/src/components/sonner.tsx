"use client";

import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";

export type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Shared toaster. `theme` is sonner's own `'light' | 'dark' | 'system'` and
 * defaults to sonner's default (`'light'`) so existing consumers render
 * exactly as before; an app that tracks its own theme (the CRM's
 * ThemeProvider) passes `theme={resolvedTheme}` so toasts follow the console
 * palette (sonner paints dark rich colours via `data-sonner-theme="dark"`).
 * Consumers (grep `<Toaster`): CRM ClientProviders (passes theme), Admin
 * layout, member-portal agent layout, advisor-portal layout (all default).
 */
export function Toaster({ theme, ...props }: ToasterProps) {
  return (
    <Sonner
      richColors
      closeButton
      position="top-right"
      theme={theme}
      {...props}
    />
  );
}

export { toast };
