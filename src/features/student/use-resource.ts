"use client";

import { useEffect, useState } from "react";
import { studentApi } from "./api";

export function useResource<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({
    data: null, error: null, loading: true,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ data: null, error: null, loading: Boolean(url) });
      if (!url) return;
      try {
        const data = await studentApi<T>(url, { signal: controller.signal });
        if (active) setState({ data, error: null, loading: false });
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setState({ data: null, error: error instanceof Error ? error : new Error("Không thể tải dữ liệu."), loading: false });
        }
      }
    });
    return () => { active = false; controller.abort(); };
  }, [url, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}
