/** Measured tab frames, in route order. `x` is from the left of the bar. */
export interface TabFrame {
  x: number;
  width: number;
}

/** How far outside the bar a finger may travel and still count. */
export const TAB_SLOP = 12;

/** Pixels into the next tab required before the candidate changes. */
export const TAB_HYSTERESIS = 8;

/**
 * Build visual frames from logical tab widths.
 * In RTL the first route sits at the trailing (right) edge.
 * Runtime hit-testing uses `onLayout` frames, which are already visual.
 */
export function framesFromWidths(widths: number[], rtl: boolean): TabFrame[] {
  if (!rtl) {
    let x = 0;
    return widths.map((width) => {
      const frame = { x, width };
      x += width;
      return frame;
    });
  }
  let x = widths.reduce((sum, width) => sum + width, 0);
  return widths.map((width) => {
    x -= width;
    return { x, width };
  });
}

/** Route index under a point, or null when the point is outside the acceptance band. */
export function indexForPoint(x: number, y: number, barHeight: number, frames: TabFrame[], slop = TAB_SLOP): number | null {
  if (frames.length === 0 || y < -slop || y > barHeight + slop) return null;
  let leftMost = 0;
  let rightMost = 0;
  frames.forEach((frame, i) => {
    if (!frame) return;
    if (frame.x < (frames[leftMost]?.x ?? frame.x)) leftMost = i;
    if (frame.x > (frames[rightMost]?.x ?? frame.x)) rightMost = i;
  });
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame || frame.width <= 0) continue;
    const left = i === leftMost ? frame.x - slop : frame.x;
    const right = i === rightMost ? frame.x + frame.width + slop : frame.x + frame.width;
    if (x >= left && x < right) return i;
  }
  return null;
}

/**
 * Same as `indexForPoint`, but a candidate sticks until the finger is
 * `hysteresis` pixels inside the next frame. Leaving the bar still returns null.
 */
export function stabilizedIndex(
  x: number,
  y: number,
  barHeight: number,
  frames: TabFrame[],
  previous: number | null,
  slop = TAB_SLOP,
  hysteresis = TAB_HYSTERESIS,
): number | null {
  const raw = indexForPoint(x, y, barHeight, frames, slop);
  if (raw == null || previous == null || raw === previous) return raw;
  const frame = frames[raw];
  const from = frames[previous];
  if (!frame || !from) return raw;
  const movingRight = x >= from.x + from.width / 2;
  if (movingRight && x < frame.x + hysteresis) return previous;
  if (!movingRight && x > frame.x + frame.width - hysteresis) return previous;
  return raw;
}

/** Where the indicator should rest, and whether the route should change. */
export function releaseDecision(candidate: number | null, activeIndex: number): { index: number; navigate: boolean } {
  if (candidate == null || candidate === activeIndex) return { index: activeIndex, navigate: false };
  return { index: candidate, navigate: true };
}

/** True only when the finger enters a tab that is not the one it just occupied. */
export function shouldHapticOnEnter(previous: number | null, next: number | null, activeIndex: number): boolean {
  if (next == null || next === previous) return false;
  return next !== (previous ?? activeIndex);
}
