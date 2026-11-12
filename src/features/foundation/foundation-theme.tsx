"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import FoundationIcon from "./foundation-icons";
import {
  foundationSystemThemeQuery as systemThemeQuery,
  foundationThemeStorageKey as storageKey,
} from "./foundation-theme-config";
import styles from "./foundation.module.css";

type Theme = "light" | "dark";

const themeEvent = "foundation:theme-change";
let sessionPreference: Theme | null | undefined;

function getTheme(): Theme {
  if (sessionPreference === undefined) {
    sessionPreference = null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      sessionPreference = saved === "light" || saved === "dark" ? saved : null;
    } catch {
      // Fall back to the system when browser storage is unavailable.
    }
  }
  return sessionPreference ?? (window.matchMedia(systemThemeQuery).matches ? "dark" : "light");
}

function getServerTheme() {
  return null;
}

function subscribe(onChange: () => void) {
  const systemTheme = window.matchMedia(systemThemeQuery);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      sessionPreference = undefined;
      onChange();
    }
  };
  systemTheme.addEventListener("change", onChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(themeEvent, onChange);
  return () => {
    systemTheme.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(themeEvent, onChange);
  };
}

function toggleTheme() {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  sessionPreference = next;
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    // The in-memory preference still lets the control work without storage.
  }
  window.dispatchEvent(new Event(themeEvent));
}

export function FoundationTheme({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  return (
    <div
      className={styles.page}
      data-theme={theme ?? "system"}
      data-theme-ready={theme ? "true" : undefined}
    >
      {children}
    </div>
  );
}

export function FoundationThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const label = theme === null
    ? "Chuyển giao diện sáng hoặc tối"
    : `Chuyển sang giao diện ${theme === "dark" ? "sáng" : "tối"}`;

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <FoundationIcon name="sun" className={styles.themeSun} width="20" height="20" />
      <FoundationIcon name="moon" className={styles.themeMoon} width="20" height="20" />
    </button>
  );
}
