import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  clampOffset,
  clampScale,
  initialZoom,
  panBy,
  zoomAt,
} from "./zoom-math";

const viewport = { width: 1000, height: 400 };
const content = { width: 1000, height: 400 };

describe("clampScale", () => {
  it("stays within the allowed range", () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(2.5)).toBe(2.5);
  });
});

describe("clampOffset", () => {
  it("does not move content that fits the viewport", () => {
    expect(clampOffset({ x: 300, y: -50 }, content, viewport, 1)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("centres content smaller than the viewport", () => {
    expect(
      clampOffset({ x: 0, y: 0 }, { width: 800, height: 400 }, viewport, 1),
    ).toEqual({ x: 100, y: 0 });
  });

  it("never lets a zoomed picture leave the frame", () => {
    // 2x: content is 2000x800 in a 1000x400 viewport.
    expect(clampOffset({ x: 50, y: 50 }, content, viewport, 2)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampOffset({ x: -5000, y: -5000 }, content, viewport, 2)).toEqual({
      x: -1000,
      y: -400,
    });
    expect(clampOffset({ x: -300, y: -120 }, content, viewport, 2)).toEqual({
      x: -300,
      y: -120,
    });
  });
});

describe("zoomAt", () => {
  it("keeps the point under the anchor fixed", () => {
    const anchor = { x: 400, y: 100 };
    const next = zoomAt(initialZoom, 2, anchor, content, viewport);
    expect(next.scale).toBe(2);
    // The content point that was under the anchor stays under it.
    expect((anchor.x - next.offset.x) / next.scale).toBeCloseTo(400);
    expect((anchor.y - next.offset.y) / next.scale).toBeCloseTo(100);
  });

  it("zooming from the top-left keeps the top-left of the picture visible", () => {
    const next = zoomAt(initialZoom, 2, { x: 0, y: 0 }, content, viewport);
    expect(next.offset).toEqual({ x: 0, y: 0 });
  });

  it("clamps the scale and returns to the fitted position at 100%", () => {
    const zoomed = zoomAt(
      initialZoom,
      99,
      { x: 900, y: 300 },
      content,
      viewport,
    );
    expect(zoomed.scale).toBe(MAX_SCALE);
    expect(zoomed.offset.x).toBeGreaterThanOrEqual(viewport.width - 5000);
    const back = zoomAt(zoomed, 1, { x: 500, y: 200 }, content, viewport);
    expect(back).toEqual({ scale: 1, offset: { x: 0, y: 0 } });
  });

  it("zooms in then out around the same point back to the start", () => {
    const anchor = { x: 250, y: 80 };
    const zoomed = zoomAt(initialZoom, 3, anchor, content, viewport);
    expect(zoomAt(zoomed, 1, anchor, content, viewport)).toEqual(initialZoom);
  });
});

describe("panBy", () => {
  it("moves a zoomed picture but clamps at the edges", () => {
    const zoomed = zoomAt(initialZoom, 2, { x: 0, y: 0 }, content, viewport);
    expect(
      panBy(zoomed, { x: -400, y: -100 }, content, viewport).offset,
    ).toEqual({ x: -400, y: -100 });
    expect(panBy(zoomed, { x: 400, y: 100 }, content, viewport).offset).toEqual(
      {
        x: 0,
        y: 0,
      },
    );
    expect(
      panBy(zoomed, { x: -99999, y: -99999 }, content, viewport).offset,
    ).toEqual({ x: -1000, y: -400 });
  });

  it("cannot pan at 100%", () => {
    expect(
      panBy(initialZoom, { x: -200, y: -50 }, content, viewport).offset,
    ).toEqual({ x: 0, y: 0 });
  });
});
