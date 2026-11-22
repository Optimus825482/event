import type { PreviewTableKind, TemplatePreviewModel } from "./template-preview-model";

const TABLE_FILL: Record<PreviewTableKind, string> = {
  standard: "#22c55e",
  vip: "#f59e0b",
  loca: "#a855f7",
};

export const PREVIEW_LEGEND: ReadonlyArray<{ kind: PreviewTableKind; label: string }> = [
  { kind: "standard", label: "Standart" },
  { kind: "vip", label: "VIP" },
  { kind: "loca", label: "Loca" },
];

export function previewColor(kind: PreviewTableKind): string {
  return TABLE_FILL[kind];
}

type Props = {
  model: TemplatePreviewModel;
  /** Masa etiketlerini çizer (büyük önizleme); küçük kartlarda kapalı. */
  showLabels?: boolean;
  className?: string;
  title?: string;
};

/** Şablon yerleşiminin statik SVG çizimi. İstemci durumu yoktur; sunucuda da çizilebilir. */
export function TemplatePreview({ model, showLabels = false, className, title }: Props) {
  const { viewBox } = model;
  return (
    <svg
      role="img"
      aria-label={title ?? "Şablon yerleşim önizlemesi"}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="#1e293b" />
      {model.elements.map((e) => {
        const fill = e.color ?? "#64748b";
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2;
        return (
          <g key={e.key} transform={e.rotation ? `rotate(${e.rotation} ${cx} ${cy})` : undefined}>
            <rect
              x={e.x}
              y={e.y}
              width={e.width}
              height={e.height}
              rx={e.kind === "wall" ? 0 : 6}
              fill={fill}
              fillOpacity={e.kind === "wall" ? 0.9 : 0.25}
              stroke={fill}
              strokeWidth={2}
              strokeOpacity={0.6}
            />
            {showLabels && e.label ? (
              <text x={cx} y={cy} fill="#e2e8f0" fontSize={22} textAnchor="middle" dominantBaseline="middle">
                {e.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {model.lines.map((l) => (
        <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={l.width} strokeLinecap="round" />
      ))}
      {model.tables.map((t) => (
        <g key={t.key}>
          {t.kind === "loca" ? (
            <rect
              x={t.cx - t.rx}
              y={t.cy - t.ry}
              width={t.rx * 2}
              height={t.ry * 2}
              rx={8}
              fill={TABLE_FILL.loca}
              fillOpacity={0.6}
              stroke={TABLE_FILL.loca}
              strokeWidth={2}
            />
          ) : (
            <circle
              cx={t.cx}
              cy={t.cy}
              r={t.rx}
              fill={TABLE_FILL[t.kind]}
              fillOpacity={0.6}
              stroke={TABLE_FILL[t.kind]}
              strokeWidth={2}
            />
          )}
          {showLabels ? (
            <text x={t.cx} y={t.cy} fill="#ffffff" fontSize={18} textAnchor="middle" dominantBaseline="middle">
              {t.label}
            </text>
          ) : null}
        </g>
      ))}
      {model.empty ? (
        <text
          x={viewBox.x + viewBox.width / 2}
          y={viewBox.y + viewBox.height / 2}
          fill="#94a3b8"
          fontSize={Math.max(24, viewBox.width / 20)}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          Boş şablon
        </text>
      ) : null}
    </svg>
  );
}
