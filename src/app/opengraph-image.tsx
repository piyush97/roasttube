import { ImageResponse } from "next/og";

export const alt = "RoastTube: your YouTube taste, on the record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f3efe4";
const INK = "#1a1613";
const INK_SOFT = "#57493c";
const RED = "#b3221f";

// Site-wide share card: the masthead without a defendant, so the home page,
// the policy pages and every 404 get a real card instead of no preview at all.
// Reports keep their own card (see report/[id]/opengraph-image.tsx) with the
// score, the tier stamp and the headline.
//
// Every style below is drawn from the subset that card already proves workerd
// accepts, including the reason the double rule is built by hand.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          padding: "40px 60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ height: 8, background: INK, width: "100%" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "22px 0 10px",
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "0.02em" }}>
            ROASTTUBE
          </div>
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.24em",
              color: INK_SOFT,
              textTransform: "uppercase",
            }}
          >
            We read your likes. We did the math.
          </div>
        </div>
        {/* workerd's CSS parser rejects the `double` border keyword in
            ImageResponse (throws, blank card), so the classic double rule is
            drawn as two solid bars. */}
        <div style={{ display: "flex", flexDirection: "column", height: 6 }}>
          <div style={{ height: 4, background: INK }} />
          <div style={{ height: 1, background: INK, marginTop: 1 }} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 48,
            paddingTop: 30,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.08,
                textTransform: "uppercase",
              }}
            >
              Your YouTube taste,
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.08,
                textTransform: "uppercase",
              }}
            >
              on the record
            </div>
            <div
              style={{ marginTop: 28, height: 4, background: INK, width: "100%" }}
            />
            <div
              style={{
                marginTop: 20,
                fontSize: 26,
                color: INK_SOFT,
                letterSpacing: "0.04em",
              }}
            >
              Share your verdict. Run a demo with no account.
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
              <div
                style={{
                  border: `2px solid ${INK_SOFT}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontSize: 17,
                  letterSpacing: "0.08em",
                  color: INK_SOFT,
                  textTransform: "uppercase",
                }}
              >
                Read-only Google
              </div>
              <div
                style={{
                  border: `2px solid ${INK_SOFT}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontSize: 17,
                  letterSpacing: "0.08em",
                  color: INK_SOFT,
                  textTransform: "uppercase",
                }}
              >
                Scored in code
              </div>
              <div
                style={{
                  border: `2px solid ${INK_SOFT}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontSize: 17,
                  letterSpacing: "0.08em",
                  color: INK_SOFT,
                  textTransform: "uppercase",
                }}
              >
                Gemini writes the roast
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 296,
            }}
          >
            <div
              style={{
                border: `6px solid ${RED}`,
                borderRadius: 8,
                color: RED,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "0.04em",
                padding: "12px 24px",
                transform: "rotate(-4deg)",
                textTransform: "uppercase",
              }}
            >
              Court of one
            </div>
            <div
              style={{
                marginTop: 28,
                fontSize: 19,
                letterSpacing: "0.16em",
                color: INK_SOFT,
                textTransform: "uppercase",
              }}
            >
              roasttube.piyushmehta.com
            </div>
          </div>
        </div>

        <div style={{ height: 6, background: INK, width: "100%" }} />
      </div>
    ),
    { ...size }
  );
}
