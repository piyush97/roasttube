import { ImageResponse } from "next/og";
import { getReport } from "@/lib/store";

export const alt = "RoastTube verdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f3efe4";
const INK = "#1a1613";
const INK_SOFT = "#57493c";
const RED = "#b3221f";

// Per-report OG card in the share-card visual language: masthead rules, the
// Brain Rot Score, the tier stamp, the headline and the report URL.
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stored = await getReport(id);
  const report = stored?.report;

  const score = report ? String(report.brainrotScore) : "?";
  const tier = report ? report.brainrotTier.toUpperCase() : "ON THE RECORD";
  const headline = report?.headline ?? "Your YouTube taste, on the record";
  const url = `roasttube.piyushmehta.com/report/${id}`;

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
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
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
            Official verdict of the court of one
          </div>
        </div>
        <div style={{ height: 5, borderTop: `4px double ${INK}` }} />

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 48,
            paddingTop: 30,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 340,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 210, fontWeight: 700, lineHeight: 1 }}>
              {score}
            </div>
            <div
              style={{
                fontSize: 20,
                letterSpacing: "0.18em",
                color: INK_SOFT,
                textTransform: "uppercase",
              }}
            >
              Brain rot score / 100
            </div>
            <div
              style={{
                marginTop: 22,
                border: `6px solid ${RED}`,
                borderRadius: 8,
                color: RED,
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: "0.04em",
                padding: "10px 22px",
                transform: "rotate(-4deg)",
                textTransform: "uppercase",
              }}
            >
              {tier}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: headline.length > 90 ? 38 : 50,
                fontWeight: 700,
                lineHeight: 1.06,
                textTransform: "uppercase",
              }}
            >
              {headline}
            </div>
            <div
              style={{
                marginTop: 26,
                height: 4,
                background: INK,
                width: "100%",
              }}
            />
            <div
              style={{
                marginTop: 18,
                fontSize: 22,
                color: INK_SOFT,
                letterSpacing: "0.06em",
              }}
            >
              {url}
            </div>
          </div>
        </div>

        <div style={{ height: 6, background: INK, width: "100%" }} />
      </div>
    ),
    { ...size }
  );
}
