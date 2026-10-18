"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";

export type TurnstileHandle = { execute(): Promise<string | null> };

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      execution: "execute";
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
      "unsupported-callback": () => void;
      "before-interactive-callback": () => void;
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
const SCRIPT_TIMEOUT_MS = 10000;
// Turnstile retries failed challenges on its own (default interval 8s), so the
// token deadline leaves room for one retry. Once a challenge turns interactive,
// the deadline re-arms so the visitor gets a minute to click.
const TOKEN_TIMEOUT_MS = 15000;
const INTERACTIVE_TIMEOUT_MS = 60000;

// Shown when no token was obtained. The persona buttons re-enable right after,
// so the visitor can retry with one more click instead of hitting a dead end.
const RETRY_NOTICE =
  "The bot check did not issue a token. Send the defendant to trial again; the court will retry.";

// The widget is interaction-only: when Turnstile decides it wants a click it
// appears with no announcement, so say so and bring it into view.
const INTERACTIVE_NOTICE =
  "The court requires proof you're human. Confirm the check below to continue.";

let scriptPromise: Promise<void> | null = null;

// Loads the Turnstile script lazily on the first token request. A failed load
// removes its script tag and clears the shared promise so the next click can
// try again with a fresh element.
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const timer = window.setTimeout(onError, SCRIPT_TIMEOUT_MS);
    function onLoad() {
      window.clearTimeout(timer);
      resolve();
    }
    function onError() {
      window.clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error("turnstile script failed"));
    }
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

// Turnstile widget, explicitly rendered, interaction-only: it stays unseen and
// only shows a challenge when Turnstile asks for one. execute() resolves one
// single-use token per call, or null when no token could be obtained. A null
// token still lets the request go out (the server decides) and the notice
// invites a retry.
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
  const deadline = useRef<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const settle = useCallback((token: string | null) => {
    if (deadline.current !== null) {
      window.clearTimeout(deadline.current);
      deadline.current = null;
    }
    const resolve = pending.current;
    pending.current = null;
    resolve?.(token);
  }, []);

  const armDeadline = useCallback(
    (ms: number) => {
      if (deadline.current !== null) window.clearTimeout(deadline.current);
      deadline.current = window.setTimeout(() => {
        deadline.current = null;
        if (pending.current) {
          setNotice(RETRY_NOTICE);
          settle(null);
        }
      }, ms);
    },
    [settle]
  );

  useImperativeHandle(
    ref,
    () => ({
      execute: async () => {
        const el = container.current;
        if (!siteKey || !el) return null;
        setNotice(null);
        settle(null); // defensive: drop a stale attempt, if any
        let id = widgetId.current;
        try {
          if (!id || !window.turnstile) {
            await loadScript();
            const api = window.turnstile;
            if (!api) throw new Error("turnstile unavailable");
            id = api.render(el, {
              sitekey: siteKey,
              appearance: "interaction-only",
              execution: "execute",
              callback: (token) => {
                setNotice(null);
                settle(token);
              },
              "error-callback": () => {
                // Turnstile retries by itself; keep waiting until the deadline.
                setNotice(RETRY_NOTICE);
              },
              "timeout-callback": () => {
                setNotice(RETRY_NOTICE);
              },
              "unsupported-callback": () => {
                setNotice(RETRY_NOTICE);
                settle(null);
              },
              "before-interactive-callback": () => {
                setNotice(INTERACTIVE_NOTICE);
                armDeadline(INTERACTIVE_TIMEOUT_MS);
              },
            });
            widgetId.current = id;
          }
        } catch {
          setNotice(RETRY_NOTICE);
          return null;
        }
        const api = window.turnstile;
        if (!api || !id) {
          setNotice(RETRY_NOTICE);
          return null;
        }
        const currentId = id;
        return await new Promise<string | null>((resolve) => {
          pending.current = resolve;
          armDeadline(TOKEN_TIMEOUT_MS);
          api.reset(currentId);
          api.execute(currentId);
        });
      },
    }),
    [siteKey, settle, armDeadline]
  );

  useEffect(() => {
    return () => {
      settle(null);
      const api = window.turnstile;
      if (widgetId.current && api) {
        try {
          api.remove(widgetId.current);
        } catch {
          // The widget is already gone; nothing left to clean up.
        }
      }
      widgetId.current = null;
    };
  }, [settle]);

  // Pull the bot check into view when it turns interactive; the other notice
  // types (retry, timeout) can stay where they are.
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice === INTERACTIVE_NOTICE) {
      noticeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [notice]);

  if (!siteKey) return null;
  return (
    <>
      <div ref={container} />
      {notice && (
        <p
          ref={noticeRef}
          role="status"
          className="clipping mt-6 border-2 border-[var(--red)] p-4 text-[0.95rem]"
        >
          {notice}
        </p>
      )}
    </>
  );
}
