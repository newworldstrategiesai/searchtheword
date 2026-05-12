"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const AskAssistantChatLazy = dynamic(
  () => import("@/components/ask-assistant-chat").then((m) => ({ default: m.AskAssistantChat })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>
    ),
  },
);

const AdminAssistantChatLazy = dynamic(
  () => import("@/components/admin-assistant-chat").then((m) => ({ default: m.AdminAssistantChat })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>
    ),
  },
);

export function AskAssistantWidget() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const hideOnAskPage = pathname === "/ask" || pathname.startsWith("/ask/");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const supabase = createClient();

    async function syncRoleFromSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        setUserIsAdmin(session?.user?.app_metadata?.role === "admin");
      } catch {
        if (!cancelled) setUserIsAdmin(false);
      }
    }

    void syncRoleFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncRoleFromSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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

  if (hideOnAskPage) return null;

  const isAdmin = userIsAdmin;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed right-4 z-[200] flex flex-col items-end gap-3",
        "bottom-[max(1rem,env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div
        id="ask-assistant-widget-panel"
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        aria-label={isAdmin ? "Admin copilot" : "Ask AI assistant"}
        className={cn(
          !open && "hidden",
          open &&
            "flex max-h-[min(calc(100dvh-8rem),36rem)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background/95 p-3 shadow-2xl ring-1 ring-border/50 backdrop-blur-md dark:bg-card/95 sm:w-[min(100vw-3rem,24rem)]",
        )}
      >
        {open && (isAdmin ? <AdminAssistantChatLazy /> : <AskAssistantChatLazy variant="widget" />)}
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
