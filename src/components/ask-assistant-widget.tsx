"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Shield, X } from "lucide-react";
import { AskAssistantChat } from "@/components/ask-assistant-chat";
import { AdminAssistantChat } from "@/components/admin-assistant-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function AskAssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState<boolean | null>(null);
  const checkedRef = useRef(false);

  const hide = pathname === "/ask" || pathname.startsWith("/ask/");

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.app_metadata?.role;
      setUserIsAdmin(role === "admin");
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  if (hide) return null;

  const isAdmin = userIsAdmin === true;

  return (
    <div
      className="fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-3"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      <div
        id="ask-assistant-widget-panel"
        role="dialog"
        aria-modal="false"
        aria-label={isAdmin ? "Admin copilot" : "Ask AI assistant"}
        aria-hidden={!open}
        className={cn(
          "flex max-h-[min(calc(100dvh-6rem),36rem)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background/95 p-3 shadow-2xl ring-1 ring-border/50 backdrop-blur-md dark:bg-card/95 sm:w-[min(100vw-3rem,24rem)]",
          !open && "hidden",
        )}
      >
        {isAdmin ? (
          <AdminAssistantChat />
        ) : (
          <AskAssistantChat variant="widget" />
        )}
      </div>

      <Button
        type="button"
        size="lg"
        className={cn(
          "h-14 gap-2 rounded-full px-5 shadow-lg",
          open && "bg-muted text-foreground hover:bg-muted",
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ask-assistant-widget-panel"
      >
        {open ? (
          <>
            <X className="h-5 w-5" aria-hidden />
            <span>Close</span>
          </>
        ) : isAdmin ? (
          <>
            <Shield className="h-5 w-5 shrink-0" aria-hidden />
            <span className="font-medium">Admin</span>
          </>
        ) : (
          <>
            <Bot className="h-5 w-5 shrink-0" aria-hidden />
            <span className="font-medium">Ask AI</span>
          </>
        )}
      </Button>
    </div>
  );
}
