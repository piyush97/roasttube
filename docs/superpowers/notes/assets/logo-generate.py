#!/usr/bin/env python3
"""Generate the six RoastTube IP-logo candidates on Cloudflare Workers AI (free tier)."""
import base64, json, os, tomllib, urllib.request
import concurrent.futures as cf

TOKEN = tomllib.load(open("/home/piyush/.config/.wrangler/config/default.toml", "rb"))["oauth_token"]
ACC = "038769a528a64af1b4207aa46960c248"
MODEL = "@cf/black-forest-labs/flux-1-schnell"
OUT = "/tmp/opencode/logo-batch"
os.makedirs(OUT, exist_ok=True)

BASE = (
    " Complexity: only 4 to 7 large basic shapes, no extra lines, no outline, no texture, "
    "no wood grain, no decorative marks; at most one tiny mouth. "
    "Style: large soft rounded forms, thick blunt rounded contours, no sharp tips, "
    "compact baby-like proportions, an endearing calm expression, ultra-clean flat graphic "
    "treatment with an extremely subtle, almost imperceptible soft dimensional shading. "
    "The character must stay clearly readable at 32 by 32 pixels. "
    "Constraints: no text, no watermark, no border, no frame, no card, one character only, "
    "no extra subjects, no scenery, solid uniform background with no texture or lighting "
    "variation, no dramatic shadow."
)

def corner(direction):
    side = direction.split("-")[1]
    return (
        f" Composition: the character is upright, emerging from the {direction} corner, "
        f"filling about 85 to 95 percent of the square, cropped slightly by the bottom and "
        f"the {side} edge."
    )

P = {}
P["A1"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing judge's gavel character with a large round mallet head on a short thick blunt "
    "rounded handle, standing upright and slightly tilted as if gently about to pass a "
    "friendly verdict. Colors: the round mallet head is brick red, the thick handle is warm "
    "ink-charcoal black, and the two simple small eyes sit on the red head and are "
    "ink-charcoal black. Background: solid warm cream paper filling every open area and all "
    "unoccupied corners."
) + corner("lower-left") + BASE
P["A2"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing judge's gavel character with a large round mallet head on a short thick blunt "
    "rounded handle, standing upright and slightly tilted as if gently about to pass a "
    "friendly verdict. Colors: the round mallet head is warm cream paper color, the thick "
    "handle is ink-charcoal black, and the two simple small eyes sit on the cream head and "
    "are ink-charcoal black. Background: solid deep muted brick red filling every open area "
    "and all unoccupied corners."
) + corner("lower-right") + BASE
P["B1"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing thumbs-up hand character, a soft chunky mitten-like fist with one big rounded "
    "thumb pointing up. Colors: the mitten hand is brick red, one broad ink-charcoal black "
    "rounded cuff band sits at its base, and the two simple small eyes sit on the red hand "
    "and are ink-charcoal black. Background: solid warm cream paper filling every open area "
    "and all unoccupied corners."
) + corner("lower-left") + BASE
P["B2"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing thumbs-up hand character, a soft chunky mitten-like fist with one big rounded "
    "thumb pointing up. Colors: the mitten hand is brick red, one broad warm cream rounded "
    "cuff band sits at its base, and the two simple small eyes sit on the red hand and are "
    "warm cream. Background: solid warm ink-charcoal black filling every open area and all "
    "unoccupied corners."
) + corner("lower-right") + BASE
P["C1"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing folded newspaper character, a chunky folded broadsheet block standing upright "
    "with two simple small eyes peeking over its top fold, and one broad brick-red banner "
    "band across the fold. Colors: the newspaper block is warm cream paper color, the single "
    "banner band across the fold is brick red, and the two eyes on the block are brick red. "
    "Background: solid deep muted brick red filling every open area and all unoccupied "
    "corners."
) + corner("lower-left") + BASE
P["C2"] = (
    "Create one complete full-bleed square image. Subject: one extremely simplified, cute, "
    "endearing folded newspaper character, a chunky folded broadsheet block standing upright "
    "with two simple small eyes peeking over its top fold, and one broad brick-red banner "
    "band across the fold. Colors: the newspaper block is warm ink-charcoal black, the single "
    "banner band across the fold is brick red, and the two eyes on the block are warm cream. "
    "Background: solid warm cream paper filling every open area and all unoccupied corners."
) + corner("lower-right") + BASE

def gen(item):
    name, prompt = item
    body = json.dumps({"prompt": prompt, "steps": 4}).encode()
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACC}/ai/run/{MODEL}",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.loads(r.read())
        img = (d.get("result") or {}).get("image")
        if not img:
            return name, f"ERROR {str(d)[:200]}"
        path = os.path.join(OUT, name + ".jpg")
        open(path, "wb").write(base64.b64decode(img))
        return name, f"ok {os.path.getsize(path)} bytes"
    except Exception as e:  # noqa: BLE001
        return name, f"EXC {e}"

with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for name, status in ex.map(gen, P.items()):
        print(f"{name}: {status}")
