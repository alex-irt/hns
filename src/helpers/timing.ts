
export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function clamp(min: number, max: number, value: number) {
    return Math.min(max, Math.max(min, value));
}

export function easeInOutQuad(t: number) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
