"use client";

import { useRef, useState } from "react";

/** Pull a real font stack out of a next/font CSS variable, generics included. */
function cssFontStack(variable: string, fallbacks: string[]): string[] {
  const raw =
    typeof window === "undefined"
      ? ""
      : getComputedStyle(document.body).getPropertyValue(variable).trim();
  const stack = raw
    .split(",")
    .map((family) => family.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  if (stack.length === 0) return fallbacks;
  return [...stack, ...fallbacks];
}

function quoteFamily(family: string): string {
  return /^[a-z-]+$/i.test(family) && /^(sans-serif|serif|monospace|system-ui|ui-\w+)$/i.test(family)
    ? family
    : `"${family}"`;
}

function canvasFont(families: string[], size: number, italic = false): string {
  return `${italic ? "italic " : ""}400 ${size}px ${families.map(quoteFamily).join(", ")}`;
}

function wrapText(
  c: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let row = "";
  for (const word of words) {
    const candidate = row ? `${row} ${word}` : word;
    if (row && c.measureText(candidate).width > maxWidth) {
      lines.push(row);
      row = word;
    } else {
      row = candidate;
    }
  }
  if (row) lines.push(row);
  return lines;
}

export function ShareCard({
  id,
  line,
  score,
  tier,
}: {
  id: string;
  line: string;
  score: number;
  tier: string;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [downloadState, setDownloadState] = useState<
    "idle" | "busy" | "done" | "fail"
  >("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/report/${id}`
    : `/report/${id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${line}\n${url}`);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  async function download() {
    if (downloadState === "busy") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloadState("busy");

    // Wait for the display face before painting so the PNG never silently
    // falls back to a system font mid-word.
    const display = cssFontStack("--font-anton", ["Anton", "Impact", "sans-serif"]);
    const mono = cssFontStack("--font-geist-mono", ["ui-monospace", "monospace"]);
    try {
      await Promise.all(
        display
          .slice(0, 2)
          .map((family) =>
            document.fonts.load(canvasFont([family], 300)).catch(() => [])
          )
      );
    } catch {
      // A missing face is not fatal: getContext below still paints.
    }

    const c = canvas.getContext("2d");
    if (!c) {
      setDownloadState("fail");
      return;
    }

    const W = 1080, H = 1080;
    canvas.width = W;
    canvas.height = H;

    c.fillStyle = "#f3efe4";
    c.fillRect(0, 0, W, H);
    // halftone dots
    c.fillStyle = "rgba(26,22,19,0.06)";
    for (let y = 0; y < H; y += 14)
      for (let x = 0; x < W; x += 14) c.fillRect(x, y, 3, 3);

    c.textAlign = "center";
    c.fillStyle = "#1a1613";
    c.fillRect(60, 60, W - 120, 10);
    c.fillRect(60, H - 70, W - 120, 10);

    c.font = canvasFont(display, 64);
    c.fillText("ROASTTUBE", W / 2, 170);

    c.font = "28px Georgia, serif";
    c.fillStyle = "#57493c";
    c.fillText("OFFICIAL VERDICT OF THE COURT OF ONE", W / 2, 225);

    c.fillStyle = "#1a1613";
    c.font = canvasFont(display, 300);
    c.fillText(String(score), W / 2, 560);
    c.font = "30px Georgia, serif";
    c.fillStyle = "#57493c";
    c.fillText("BRAIN ROT SCORE / 100", W / 2, 615);

    // red stamp
    c.save();
    c.translate(W / 2, 730);
    c.rotate(-0.08);
    c.strokeStyle = "#b3221f";
    c.lineWidth = 8;
    c.strokeRect(-330, -55, 660, 110);
    c.fillStyle = "#b3221f";
    c.font = canvasFont(display, 64);
    c.fillText(tier.toUpperCase(), 0, 22);
    c.restore();

    // share line: shrink the type until every word fits; never drop a line
    const maxWidth = W - 200;
    const regionTop = 820;
    const regionBottom = 970;
    const region = regionBottom - regionTop;
    let fontSize = 44;
    let lines: string[] = [];
    for (; fontSize >= 20; fontSize -= 2) {
      c.font = canvasFont(["Georgia", "Times New Roman", "serif"], fontSize, true);
      lines = wrapText(c, line, maxWidth);
      if (lines.length * Math.round(fontSize * 1.3) <= region) break;
    }
    const lineHeight = Math.round(fontSize * 1.3);
    c.fillStyle = "#1a1613";
    c.font = canvasFont(["Georgia", "Times New Roman", "serif"], fontSize, true);
    let y = regionTop + Math.round((region - lines.length * lineHeight) / 2) + fontSize;
    for (const row of lines) {
      c.fillText(row, W / 2, y);
      y += lineHeight;
    }

    // the report URL, so a saved PNG always points back
    const shortUrl = `${window.location.host}/report/${id}`;
    c.font = canvasFont(mono, 26);
    c.fillStyle = "#57493c";
    c.fillText(shortUrl, W / 2, 1002);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `roasttube-${id}.png`;
    a.click();

    setDownloadState("done");
    setTimeout(() => setDownloadState("idle"), 2500);
  }

  return (
    <div className="clipping p-6">
      <h2 className="font-display text-2xl">Take it public</h2>
      <p className="mt-2 text-[1.02rem] leading-6 italic">{line}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={copy}
          className="bg-[var(--ink)] px-5 py-2.5 font-display text-lg text-[var(--paper)] transition-colors hover:bg-[var(--red)] disabled:bg-[var(--ink-soft)]"
          disabled={copied === "ok"}
        >
          {copied === "ok" ? "Copied. Go ruin friendships." : copied === "fail" ? "Copy failed. Select the text manually" : "Copy verdict + link"}
        </button>
        <button
          onClick={download}
          disabled={downloadState === "busy"}
          className="border-2 border-[var(--ink)] px-5 py-2.5 font-display text-lg transition-colors hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-60"
        >
          {downloadState === "busy"
            ? "Filing the exhibit…"
            : downloadState === "done"
              ? "Downloaded. Exhibit filed."
              : downloadState === "fail"
                ? "Download failed. Try again."
                : "Download evidence (PNG)"}
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
