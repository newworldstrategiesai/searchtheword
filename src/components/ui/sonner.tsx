"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-background text-foreground shadow-lg backdrop-blur-sm dark:bg-card",
          title: "font-medium",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
