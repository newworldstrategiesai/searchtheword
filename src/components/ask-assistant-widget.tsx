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

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    function apply() {
      if (mq.matches) document.documentElement.style.overflow = "hidden";
      else document.documentElement.style.overflow = "";
    }
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  if (hideOnAskPage) return null;

  const isAdmin = userIsAdmin;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close assistant"
          className={cn(
            "fixed inset-0 z-[190] border-0 p-0 lg:hidden",
            "bg-background/50 backdrop-blur-md dark:bg-background/55",
          )}
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className={cn(
          "pointer-events-auto fixed z-[200] flex flex-col gap-3",
          "bottom-[max(1rem,env(safe-area-inset-bottom,0px))]",
          open
            ? "max-lg:inset-x-3 max-lg:top-3 max-lg:items-stretch lg:right-4 lg:left-auto lg:items-end"
            : "right-4 items-end",
        )}
      >
        <div
          id="ask-assistant-widget-panel"
          role="dialog"
          aria-modal={open ? true : undefined}
          aria-hidden={!open}
          aria-label={isAdmin ? "Admin copilot" : "Ask AI assistant"}
          className={cn(
            !open && "hidden",
            open &&
              cn(
                "flex flex-col overflow-hidden rounded-2xl border border-border bg-background/95 p-3 shadow-2xl ring-1 ring-border/50 backdrop-blur-md dark:bg-card/95",
                "max-lg:min-h-0 max-lg:flex-1 max-lg:w-full max-lg:max-w-none",
                "lg:max-h-[min(calc(100dvh-8rem),36rem)] lg:w-[min(100vw-3rem,24rem)] lg:flex-none",
              ),
          )}
        >
          {open && (isAdmin ? <AdminAssistantChatLazy /> : <AskAssistantChatLazy variant="widget" />)}
        </div>

        <Button
          type="button"
          size="lg"
          className={cn(
            "h-14 shrink-0 gap-2 self-end rounded-full px-5 shadow-lg",
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
    </>
  );
}
