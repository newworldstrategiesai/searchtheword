"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useSearchBarShortcut(inputRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearchNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateToSearch = useCallback(
    (q: string, page = 1) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
      }
      if (page > 1) {
        params.set("page", String(page));
      } else {
        params.delete("page");
      }
      router.push(`/search?${params.toString()}`);
    },
    [router, searchParams],
  );

  return { navigateToSearch };
}
