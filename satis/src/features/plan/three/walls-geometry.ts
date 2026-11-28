import { PX_PER_METER, roomSize, type Vec3 } from "./metric";

export const WALL_HEIGHT = 7.75;
export const WALL_THICKNESS = 0.42;
export const WALL_MARGIN = 0.6;

export type WallSide = "back" | "left" | "right" | "front";

export type WallSpec = {
  side: WallSide;
  position: Vec3;
  rotationY: number;
  length: number;
  height: number;
};

export function wallLayout(canvasWidth: number, canvasHeight: number): WallSpec[] {
  const room = roomSize({ width: Math.max(canvasWidth, 0), height: Math.max(canvasHeight, 0) });
  const xEdge = room.width / 2 + WALL_MARGIN;
  const zEdge = room.depth / 2 + WALL_MARGIN;
  return [
    { side: "back", position: [0, 0, -zEdge], rotationY: 0, length: room.width + WALL_MARGIN * 2, height: WALL_HEIGHT },
    { side: "left", position: [-xEdge, 0, 0], rotationY: Math.PI / 2, length: room.depth + WALL_MARGIN * 2, height: WALL_HEIGHT },
    { side: "right", position: [xEdge, 0, 0], rotationY: -Math.PI / 2, length: room.depth + WALL_MARGIN * 2, height: WALL_HEIGHT },
    { side: "front", position: [0, 0, zEdge], rotationY: Math.PI, length: room.width + WALL_MARGIN * 2, height: WALL_HEIGHT },
  ];
}

export function wallVisibility(
  room: { width: number; depth: number },
  cameraPosition: Vec3,
  pov: boolean,
): Record<WallSide, boolean> {
  if (pov) return { back: true, left: true, right: true, front: true };
  const [cx, , cz] = cameraPosition;
  const xCut = room.width * 0.3;
  const zBackCut = -room.depth * 0.48;
  const zFrontCut = room.depth * 0.4;
  return {
    back: cz > zBackCut,
    front: cz < zFrontCut,
    left: cx > -xCut,
    right: cx < xCut,
  };
}

export { PX_PER_METER };
