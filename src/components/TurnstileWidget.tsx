"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type TurnstileHandle = { execute(): Promise<string | null> };

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "invisible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
    }
  ): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const EXECUTE_TIMEOUT_MS = 8000;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
}

// Invisible Turnstile widget. execute() resolves a fresh single-use token, or
// null on error/timeout — the request still goes out and the server decides.
export function TurnstileWidget({
  siteKey,
  ref,
}: {
  siteKey?: string;
  ref?: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      execute: () => {
        const api = window.turnstile;
        if (!widgetId.current || !api) return Promise.resolve(null);
        const id = widgetId.current;
        return new Promise<string | null>((resolve) => {
          pending.current = resolve;
          api.reset(id);
          api.execute(id);
          window.setTimeout(() => {
            if (pending.current === resolve) {
              pending.current = null;
              resolve(null);
            }
          }, EXECUTE_TIMEOUT_MS);
        });
      },
    }),
    []
  );

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    const el = container.current;
    loadScript()
      .then(() => {
        if (cancelled || widgetId.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(el, {
          sitekey: siteKey,
          size: "invisible",
          callback: (token) => {
            pending.current?.(token);
            pending.current = null;
          },
          "error-callback": () => {
            pending.current?.(null);
            pending.current = null;
          },
          "timeout-callback": () => {
            pending.current?.(null);
            pending.current = null;
          },
        });
      })
      .catch(() => {
        // Widget unavailable (offline, blocked): requests go out without a
        // token and the server decides whether that is acceptable.
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={container} aria-hidden="true" />;
}
