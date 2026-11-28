"use client";

import { useMemo } from "react";
import type { PlanModel } from "./model";
import { seatPose } from "./three/camera";
import Scene3D from "./three/scene";
import { buildScene } from "./three/scene-data";

export default function TablePerspective({ model, tableId, label, artworkUrl, title, onFail }: {
  model: PlanModel;
  tableId: string;
  label: string;
  artworkUrl: string | null;
  title: string;
  onFail(): void;
}) {
  const scene = useMemo(() => buildScene({ model, activeTableId: null, picks: [] }), [model]);
  const table = scene.tables.find((item) => item.key === tableId);
  if (!table) return null;
  const pose = seatPose(table, table.floorY, scene.stage);
  return (
    <Scene3D scene={scene} canvas={model.canvas} activeTableId={null} title={title}
      artworkUrl={artworkUrl} stillView={{ pose, label }} onContextLost={onFail} />
  );
}
