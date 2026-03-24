import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type ChurchOgProps = {
  headline: string;
  subheadline: string;
  foot?: string;
};

/**
 * Elegant church/ministry OG canvas — limited CSS subset for @vercel/og.
 */
export function ChurchOgCanvas({ headline, subheadline, foot }: ChurchOgProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        backgroundImage:
          "linear-gradient(165deg, #0c1222 0%, #1e293b 42%, #14101a 100%)",
        padding: 56,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: "linear-gradient(90deg, #b8860b 0%, #f5e6b8 45%, #b8860b 100%)",
        }}
      />
      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.32em",
          color: "#e8d5a3",
          textTransform: "uppercase",
          marginBottom: 28,
          fontWeight: 600,
        }}
      >
        SearchTheWord
      </div>
      <div
        style={{
          fontSize: headline.length > 52 ? 44 : 56,
          fontWeight: 600,
          color: "#f8fafc",
          textAlign: "center",
          lineHeight: 1.12,
          fontFamily: "Georgia, 'Times New Roman', serif",
          maxWidth: 1040,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          fontSize: 26,
          color: "#94a3b8",
          marginTop: 28,
          textAlign: "center",
          maxWidth: 920,
          lineHeight: 1.45,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {subheadline}
      </div>
      {foot ? (
        <div
          style={{
            fontSize: 22,
            color: "#a8b8d0",
            marginTop: 24,
            textAlign: "center",
            maxWidth: 920,
            lineHeight: 1.4,
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          {foot}
        </div>
      ) : null}
    </div>
  );
}

export function churchOgImageResponse(props: ChurchOgProps) {
  return new ImageResponse(<ChurchOgCanvas {...props} />, {
    ...OG_SIZE,
  });
}
