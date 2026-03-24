"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

type ListRow = {
  id: string;
  title: string;
  preacher: string;
  date: string | null;
  series: string | null;
  external_id: string | null;
  updated_at: string;
};

const PAGE_SIZE = 25;

export default function AdminSermonsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formInitial, setFormInitial] = useState<SermonFormValues>(() => emptySermonForm());
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const offset = page * PAGE_SIZE;

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch(`/api/admin/sermons?limit=${PAGE_SIZE}&offset=${offset}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        rows?: ListRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Could not load sermons", { description: json.error ?? res.statusText });
        return;
      }
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Network error", { description: "Could not reach the server." });
    } finally {
      setListLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openCreate() {
    setEditingId("new");
    setFormInitial(emptySermonForm());
    setSheetOpen(true);
  }

  async function openEdit(id: string) {
    setSheetOpen(true);
    setEditingId(id);
    setFormInitial(emptySermonForm());
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/admin/sermons/${id}`, { credentials: "same-origin" });
      const json = (await res.json()) as { sermon?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        toast.error("Could not load sermon", { description: json.error ?? res.statusText });
        setSheetOpen(false);
        return;
      }
      if (json.sermon) {
        setFormInitial(recordToSermonForm(json.sermon));
      }
    } catch {
      toast.error("Network error");
      setSheetOpen(false);
    } finally {
      setSheetLoading(false);
    }
  }

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
          toast.warning("Sermon created with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon created");
        }
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
          toast.warning("Sermon updated with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon updated");
        }
      }
      setSheetOpen(false);
      setEditingId(null);
      await loadList();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId || editingId === "new") return;
    if (!window.confirm(`Delete “${formInitial.title}”? This cannot be undone.`)) return;
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
      await loadList();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="text-2xl font-bold">All sermons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, create, edit, or delete sermon records. Changes sync keywords and scripture references like ingest.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Upload &amp; tools
          </Link>
          <Button size="sm" onClick={() => openCreate()} className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            Add sermon
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/50 px-4 py-3 dark:bg-muted/20">
          <p className="text-sm text-muted-foreground">
            {listLoading ? "Loading…" : `${total} sermon${total === 1 ? "" : "s"} total`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 dark:bg-muted/10">
                <th className="px-3 py-2.5 font-semibold">Title</th>
                <th className="px-3 py-2.5 font-semibold">Preacher</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 font-semibold">Series</th>
                <th className="px-3 py-2.5 font-semibold">External ID</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                    No sermons yet. Import a spreadsheet or add a row.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 dark:hover:bg-muted/15">
                    <td className="max-w-[240px] px-3 py-2">
                      <Link
                        href={`/sermon/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.preacher}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {row.date ? row.date.slice(0, 10) : "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground" title={row.series ?? ""}>
                      {row.series ?? "—"}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={row.external_id ?? ""}>
                      {row.external_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => void openEdit(row.id)}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0 || listLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-border p-0 sm:max-w-2xl"
          showCloseButton
        >
          <SheetHeader className="border-b border-border px-4 pb-4 pt-6">
            <SheetTitle>{editingId === "new" ? "New sermon" : "Edit sermon"}</SheetTitle>
            <SheetDescription>
              Required fields: title and preacher. Tags and scripture links are rebuilt after save.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
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
                  <div className="border-t border-border pb-8 pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
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
    </div>
  );
}
