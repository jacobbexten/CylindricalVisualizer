// volume math for the segment, in feet / cubic feet; kept free of three.js
// and the DOM so the numbers match what main.js draws

export const maxFlawDepth = 4; // feet

// tapered cylinder: π·h/3 · (R² + R·r + r²); a straight one gives πR²h
export function frustumVolume(radiusBottom, radiusTop, height) {
  return (
    ((Math.PI * height) / 3) *
    (radiusBottom ** 2 + radiusBottom * radiusTop + radiusTop ** 2)
  );
}

// how deep a flaw reaches from its end face: under 4 ft, and under half the
// length so the two flaws never overlap
export function flawDepth(flaw, height) {
  return flaw.depth * Math.min(maxFlawDepth, height / 2);
}

// area of a flaw's base: the profile's points sit on evenly spaced spokes, so
// it is a fan of triangles, each ½·rᵢ·rᵢ₊₁·sin(spoke angle)
export function flawBaseArea(flaw, radius) {
  const n = flaw.profile.length;
  const sinSpoke = Math.sin((Math.PI * 2) / n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += flaw.profile[i] * flaw.profile[(i + 1) % n];
  }
  return 0.5 * sinSpoke * sum * radius ** 2;
}

// pyramid: base area · depth / 3
export function flawVolume(flaw, radius, height) {
  return (flawBaseArea(flaw, radius) * flawDepth(flaw, height)) / 3;
}
