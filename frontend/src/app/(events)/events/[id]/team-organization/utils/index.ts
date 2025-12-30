// Canvas helpers
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TABLE_SIZE,
  LOCA_WIDTH,
  LOCA_HEIGHT,
  calculateLassoSelection,
  getLassoRect,
  generateAutoGroupName,
  getNextGroupColor,
  extractTableNumber,
  formatTableNumbers,
  getCanvasCoordinates,
  clampZoom,
  distance,
} from "./canvas-helpers";
export type { Point, Rect } from "./canvas-helpers";

// Validation
export {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateAllSteps,
  isStepComplete,
  getCompletedSteps,
} from "./validation";
export type { ValidationResult } from "./validation";
