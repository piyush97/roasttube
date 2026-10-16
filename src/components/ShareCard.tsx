"use client";

import { useRef, useState } from "react";

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

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const W = 1080, H = 1080;
    canvas.width = W;
    canvas.height = H;

    c.fillStyle = "#f3efe4";
    c.fillRect(0, 0, W, H);
    // halftone dots
    c.fillStyle = "rgba(26,22,19,0.06)";
    for (let y = 0; y < H; y += 14)
      for (let x = 0; x < W; x += 14) c.fillRect(x, y, 3, 3);

    c.fillStyle = "#1a1613";
    c.fillRect(60, 60, W - 120, 10);
    c.fillRect(60, H - 70, W - 120, 10);

    c.textAlign = "center";
    c.font = "700 64px Anton, sans-serif";
    c.fillText("ROASTTUBE", W / 2, 170);

    c.font = "28px Georgia, serif";
    c.fillStyle = "#57493c";
    c.fillText("OFFICIAL VERDICT OF THE COURT OF ONE", W / 2, 225);

    c.fillStyle = "#1a1613";
    c.font = "700 300px Anton, sans-serif";
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
    c.font = "700 64px Anton, sans-serif";
    c.fillText(tier.toUpperCase(), 0, 22);
    c.restore();

    // share line, wrapped
    c.fillStyle = "#1a1613";
    c.font = "italic 40px Georgia, serif";
    const words = line.split(" ");
    let row = "", y = 860;
    for (const w of words) {
      if (c.measureText(row + " " + w).width > W - 200) {
        c.fillText(row, W / 2, y);
        row = w;
        y += 52;
        if (y > 960) break;
      } else row = row ? row + " " + w : w;
    }
    if (y <= 960 && row) c.fillText(row, W / 2, y);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `roasttube-${id}.png`;
    a.click();
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
          {copied === "ok" ? "Copied. Go ruin friendships." : copied === "fail" ? "Copy failed — select the text manually" : "Copy verdict + link"}
        </button>
        <button
          onClick={download}
          className="border-2 border-[var(--ink)] px-5 py-2.5 font-display text-lg transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
        >
          Download evidence (PNG)
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </div>
  );
}
