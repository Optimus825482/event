"use client";

import dynamic from "next/dynamic";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { TableInstance } from "@/types";
import { Loader2 } from "lucide-react";

// LAZY LOAD: EventCanvas ve react-konva sadece gerektiğinde yüklenir (~315KB tasarruf)
const EventCanvas = dynamic(
  () => import("./EventCanvas").then((mod) => mod.EventCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-slate-400 text-sm">Canvas yükleniyor...</span>
        </div>
      </div>
    ),
  }
);

interface SafeEventCanvasProps {
  eventId?: string;
  readOnly?: boolean;
  onTableSelect?: (table: TableInstance | null) => void;
  onError?: () => void;
}

/**
 * Error Boundary ile sarılmış EventCanvas
 * Canvas hatalarını yakalar ve kullanıcı dostu hata mesajı gösterir
 */
export default function SafeEventCanvas({
  eventId,
  readOnly = false,
  onTableSelect,
  onError,
}: SafeEventCanvasProps) {
  return (
    <CanvasErrorBoundary onReset={onError}>
      <EventCanvas
        eventId={eventId}
        readOnly={readOnly}
        onTableSelect={onTableSelect}
      />
    </CanvasErrorBoundary>
  );
}
