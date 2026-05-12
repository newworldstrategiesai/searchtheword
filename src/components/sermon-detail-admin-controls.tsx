"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  emptySermonForm,
  recordToSermonForm,
  SermonForm,
  type SermonFormValues,
} from "@/components/admin/sermon-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  sermonId: string;
  sermonTitle: string;
};

export function SermonDetailAdminControls({ sermonId, sermonTitle }: Props) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formInitial, setFormInitial] = useState<SermonFormValues>(() => emptySermonForm());
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsAdmin(user?.app_metadata?.role === "admin");
      } catch {
        setIsAdmin(false);
      }
    };
    void run();
  }, []);

  const openEdit = useCallback(async () => {
    setSheetOpen(true);
    setEditingId(sermonId);
    setFormInitial(emptySermonForm());
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/admin/sermons/${sermonId}`, { credentials: "same-origin" });
      const json = (await res.json()) as { sermon?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        toast.error("Could not load sermon", { description: json.error ?? res.statusText });
        setSheetOpen(false);
        return;
      }
      if (json.sermon) setFormInitial(recordToSermonForm(json.sermon));
    } catch {
      toast.error("Network error");
      setSheetOpen(false);
    } finally {
      setSheetLoading(false);
    }
  }, [sermonId]);

  const openCreate = useCallback(() => {
    setEditingId("new");
    setFormInitial(emptySermonForm());
    setSheetLoading(false);
    setSheetOpen(true);
  }, []);

  async function handleSave(values: SermonFormValues) {
    setSaving(true);
    try {
      if (editingId === "new") {
        const res = await fetch("/api/admin/sermons", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const json = (await res.json()) as { id?: string; warnings?: string[]; error?: string };
        if (!res.ok) {
          toast.error("Could not create sermon", { description: json.error ?? res.statusText });
          return;
        }
        if (json.warnings?.length) {
          toast.warning("Created with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon created");
        }
        setSheetOpen(false);
        setEditingId(null);
        if (json.id) router.push(`/sermon/${json.id}`);
        else router.refresh();
      } else if (editingId) {
        const res = await fetch(`/api/admin/sermons/${editingId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const json = (await res.json()) as { warnings?: string[]; error?: string };
        if (!res.ok) {
          toast.error("Could not update sermon", { description: json.error ?? res.statusText });
          return;
        }
        if (json.warnings?.length) {
          toast.warning("Updated with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon updated");
        }
        setSheetOpen(false);
        setEditingId(null);
        router.refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId || editingId === "new") return;
    if (!window.confirm(`Delete “${formInitial.title || sermonTitle}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sermons/${editingId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error("Could not delete", { description: json.error ?? res.statusText });
        return;
      }
      toast.success("Sermon deleted");
      setSheetOpen(false);
      setEditingId(null);
      router.push("/search");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin !== true) return null;

  return (
    <>
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:bg-primary/10",
        )}
      >
        <p className="text-sm font-medium text-foreground">Signed in as admin — you can change this sermon.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => void openEdit()}>
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-3.5" aria-hidden />
            New sermon
          </Button>
          <Link href="/admin/sermons" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            All sermons
          </Link>
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col overflow-hidden border-border p-0 sm:max-w-2xl"
          showCloseButton
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 pb-4 pt-6 sm:px-6">
            <SheetTitle>{editingId === "new" ? "New sermon" : "Edit sermon"}</SheetTitle>
            <SheetDescription>Title and preacher are required.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
            {sheetLoading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="size-8 animate-spin" aria-hidden />
              </div>
            ) : (
              <>
                <SermonForm
                  initial={formInitial}
                  onSubmit={handleSave}
                  submitting={saving}
                  submitLabel={editingId === "new" ? "Create sermon" : "Save changes"}
                />
                {editingId && editingId !== "new" && (
                  <div className="border-t border-border pb-4 pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full gap-2 sm:w-auto"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete sermon
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
