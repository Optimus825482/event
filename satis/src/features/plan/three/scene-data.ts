import { COLORS } from "@/lib/theme";
import { decorCenter, type PlanDecor } from "../decor";
import type { PlanModel, PlanTableModel } from "../model";
import type { TablePick } from "../picks";
import { PX_PER_METER, roomSize, tableBody, toMeters } from "./metric";
import { chairSpots, chairState, type ChairState } from "./seating";
import { stageInfo, towardStage, type StageInfo } from "./stage";

export const LOCA_FLOOR_Y = 0.12;

export type SceneState = "free" | "partial" | "full" | "closed";

export type SceneTable = {
  key: string;
  label: string;
  x: number;
  z: number;
  floorY: number;
  width: number;
  depth: number;
  rotationY: number;
  shape: PlanTableModel["shape"];
  isLoca: boolean;
  state: SceneState;
  picked: boolean;
  active: boolean;
  dimmed: boolean;
  selectable: boolean;
  color: string;
};

export type SceneChair = {
  tableId: string;
  seatNo: number | null;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  state: ChairState;
  color: string;
};

export type SceneDecor = {
  id: string;
  kind: PlanDecor["kind"];
  x: number;
  z: number;
  width: number;
  depth: number;
  angle: number;
};

export type SceneLine = {
  id: string;
  cx: number;
  cz: number;
  length: number;
  angle: number;
  width: number;
};

export type SceneInput = {
  model: PlanModel;
  picks: readonly TablePick[];
  activeTableId: string | null;
  dimmedIds?: ReadonlySet<string>;
};

export type SceneData = {
  room: { width: number; depth: number };
  stage: StageInfo;
  tables: SceneTable[];
  chairs: SceneChair[];
  decor: SceneDecor[];
  lines: SceneLine[];
};

function tableSceneState(table: PlanTableModel): SceneState {
  if (table.status === "not_sellable") return "closed";
  if (table.status === "sold_out") return "full";
  return table.free !== null && table.seats !== null && table.free < table.seats ? "partial" : "free";
}

function tableColor(table: PlanTableModel, state: SceneState, picked: boolean, active: boolean): string {
  if (active) return COLORS.goldBright;
  if (picked) return COLORS.gold;
  if (state === "closed") return COLORS.surface;
  if (state === "full") return COLORS.disabledBg;
  if (state === "partial") return COLORS.muted;
  return table.category === "premium" || table.category === "vip" ? COLORS.gold : COLORS.ivory;
}

function chairColor(state: ChairState): string {
  if (state === "selected") return COLORS.goldBright;
  if (state === "free") return COLORS.ivory;
  return COLORS.disabledBg;
}

export function buildScene({ model, picks, activeTableId, dimmedIds }: SceneInput): SceneData {
  const room = roomSize(model.canvas);
  const stage = stageInfo(model);
  const pickByTable = new Map(picks.map((p) => [p.tableId, p]));

  const tables: SceneTable[] = [];
  const chairs: SceneChair[] = [];

  for (const table of model.tables) {
    const pos = toMeters(model.canvas, table.x, table.y);
    const body = tableBody(table);
    const floorY = table.isLoca ? LOCA_FLOOR_Y : 0;
    const state = tableSceneState(table);
    const selectable = table.status === "available";
    const pick = pickByTable.get(table.id);
    const picked = pick !== undefined;
    const active = table.id === activeTableId;
    const dimmed = dimmedIds?.has(table.id) ?? false;

    tables.push({
      key: table.id,
      label: table.label,
      x: pos.x,
      z: pos.z,
      floorY,
      width: body.width,
      depth: body.depth,
      rotationY: (-table.rotation * Math.PI) / 180,
      shape: table.shape,
      isLoca: table.isLoca,
      state,
      picked,
      active,
      dimmed,
      selectable,
      color: tableColor(table, state, picked, active),
    });

    const selectedSeats = pick && !pick.whole ? pick.seatNos : [];
    const toStage = towardStage(stage, pos);
    const spots = chairSpots(
      {
        center: pos,
        width: body.width,
        depth: body.depth,
        rotationDeg: table.rotation,
        shape: table.shape,
        isLoca: table.isLoca,
        capacity: table.capacity,
        seatNos: table.seatNos,
      },
      toStage,
    );

    for (const spot of spots) {
      let cState: ChairState;
      if (table.status === "not_sellable" || spot.seatNo === null) {
        cState = "closed";
      } else if (table.status === "sold_out") {
        cState = "taken";
      } else {
        cState = chairState(spot.seatNo, table.freeSeats, selectedSeats);
      }

      chairs.push({
        tableId: table.id,
        seatNo: spot.seatNo,
        x: spot.x,
        y: floorY,
        z: spot.z,
        rotationY: spot.rotationY,
        state: cState,
        color: chairColor(cState),
      });
    }
  }

  const decor: SceneDecor[] = model.decor.map((d) => {
    const c = decorCenter(d);
    const m = toMeters(model.canvas, c.x, c.y);
    return {
      id: d.id,
      kind: d.kind,
      x: m.x,
      z: m.z,
      width: d.width / PX_PER_METER,
      depth: d.height / PX_PER_METER,
      angle: (-d.rotation * Math.PI) / 180,
    };
  });

  const lines: SceneLine[] = model.lines.map((l) => {
    const m = toMeters(model.canvas, (l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2);
    return {
      id: l.id,
      cx: m.x,
      cz: m.z,
      length: Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / PX_PER_METER,
      angle: -Math.atan2(l.y2 - l.y1, l.x2 - l.x1),
      width: l.width / PX_PER_METER,
    };
  });

  return { room, stage, tables, chairs, decor, lines };
}

export function chairHit(scene: SceneData, instanceId: number): { tableId: string; seatNo: number | null } | null {
  if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId >= scene.chairs.length) return null;
  const chair = scene.chairs[instanceId]!;
  return { tableId: chair.tableId, seatNo: chair.seatNo };
}
