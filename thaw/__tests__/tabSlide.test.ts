import { framesFromWidths, indexForPoint, releaseDecision, shouldHapticOnEnter, stabilizedIndex } from '../src/navigation/tabSlide';

const widths = [100, 100, 100, 100];

describe('tab slide targets', () => {
  it('places the first route on the left in LTR and on the right in RTL', () => {
    expect(framesFromWidths(widths, false)[0]).toEqual({ x: 0, width: 100 });
    expect(framesFromWidths(widths, true)[0]).toEqual({ x: 300, width: 100 });
    expect(framesFromWidths(widths, true)[3]).toEqual({ x: 0, width: 100 });
  });

  it('hit-tests measured frames and rejects points outside the bar', () => {
    const frames = framesFromWidths(widths, false);
    expect(indexForPoint(150, 20, 56, frames)).toBe(1);
    expect(indexForPoint(20, 20, 56, framesFromWidths(widths, true))).toBe(3);
    expect(indexForPoint(350, 20, 56, framesFromWidths(widths, true))).toBe(0);
    expect(indexForPoint(150, -20, 56, frames)).toBeNull();
    expect(indexForPoint(150, 80, 56, frames)).toBeNull();
    expect(indexForPoint(500, 20, 56, frames)).toBeNull();
    expect(indexForPoint(-4, 20, 56, frames)).toBe(0);
    const rtl = framesFromWidths(widths, true);
    expect(indexForPoint(-4, 20, 56, rtl)).toBe(3);
    expect(indexForPoint(408, 20, 56, rtl)).toBe(0);
  });

  it('keeps the current candidate until the finger is inside the next tab', () => {
    const frames = framesFromWidths(widths, false);
    expect(stabilizedIndex(104, 20, 56, frames, 0)).toBe(0);
    expect(stabilizedIndex(110, 20, 56, frames, 0)).toBe(1);
    expect(stabilizedIndex(196, 20, 56, frames, 1)).toBe(1);
    expect(stabilizedIndex(96, 20, 56, frames, 1)).toBe(1);
    expect(stabilizedIndex(90, 20, 56, frames, 1)).toBe(0);
  });

  it('cancels when the finger leaves, including after a reversal along the boundary', () => {
    const frames = framesFromWidths(widths, false);
    let previous: number | null = 0;
    const seen: Array<number | null> = [];
    for (const x of [50, 104, 96, 150, 80]) {
      previous = stabilizedIndex(x, x === 80 ? 90 : 20, 56, frames, previous);
      seen.push(previous);
    }
    expect(seen).toEqual([0, 0, 0, 1, null]);
    expect(releaseDecision(null, 0)).toEqual({ index: 0, navigate: false });
    expect(releaseDecision(1, 0)).toEqual({ index: 1, navigate: true });
    expect(releaseDecision(2, 2)).toEqual({ index: 2, navigate: false });
  });

  it('haptics once per newly entered tab and not while jittering on the same one', () => {
    expect(shouldHapticOnEnter(null, 0, 0)).toBe(false);
    expect(shouldHapticOnEnter(null, 1, 0)).toBe(true);
    expect(shouldHapticOnEnter(1, 1, 0)).toBe(false);
    expect(shouldHapticOnEnter(1, 2, 0)).toBe(true);
    expect(shouldHapticOnEnter(2, null, 0)).toBe(false);
    expect(shouldHapticOnEnter(null, 0, 0)).toBe(false);
  });
});
