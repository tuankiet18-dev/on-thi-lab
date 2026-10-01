import { describe, expect, it } from "vitest";

describe("ImageViewerModal Zoom Calculations", () => {
  const minScale = 1;
  const maxScale = 5;
  const step = 0.5;

  function calculateZoomIn(currentScale: number): number {
    return Math.min(maxScale, +(currentScale + step).toFixed(2));
  }

  function calculateZoomOut(currentScale: number): number {
    return Math.max(minScale, +(currentScale - step).toFixed(2));
  }

  function calculateWheelZoom(currentScale: number, deltaY: number): number {
    const delta = -deltaY;
    const zoomFactor = delta > 0 ? 1.15 : 0.87;
    let nextScale = currentScale * zoomFactor;
    if (nextScale > maxScale) nextScale = maxScale;
    if (nextScale < minScale) nextScale = minScale;
    return +nextScale.toFixed(2);
  }

  it("increases scale in steps up to maxScale", () => {
    let scale = 1;
    scale = calculateZoomIn(scale);
    expect(scale).toBe(1.5);
    scale = calculateZoomIn(scale);
    expect(scale).toBe(2);

    // Zooming beyond max
    scale = 4.8;
    scale = calculateZoomIn(scale);
    expect(scale).toBe(5);
    scale = calculateZoomIn(scale);
    expect(scale).toBe(5);
  });

  it("decreases scale in steps down to minScale", () => {
    let scale = 2;
    scale = calculateZoomOut(scale);
    expect(scale).toBe(1.5);
    scale = calculateZoomOut(scale);
    expect(scale).toBe(1);
    scale = calculateZoomOut(scale);
    expect(scale).toBe(1);
  });

  it("calculates wheel zoom smoothly and stays within bounds", () => {
    // Zooming in with wheel (deltaY < 0)
    let scale = 1;
    scale = calculateWheelZoom(scale, -100);
    expect(scale).toBe(1.15);

    // Zooming out with wheel (deltaY > 0)
    scale = calculateWheelZoom(scale, 100);
    expect(scale).toBe(1);

    // Clamping to minScale
    scale = calculateWheelZoom(1, 100);
    expect(scale).toBe(1);

    // Clamping to maxScale
    scale = calculateWheelZoom(5, -100);
    expect(scale).toBe(5);
  });
});
