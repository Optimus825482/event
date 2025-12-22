"use client";

import { EventCanvas } from "./EventCanvas";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { TableInstance } from "@/types";

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
