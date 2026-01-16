"use client";

import { Toaster as Sonner, toast } from "sonner";

export type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      richColors
      closeButton
      position="top-right"
      {...props}
    />
  );
}

export { toast };
