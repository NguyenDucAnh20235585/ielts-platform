export type ClientClockAnchor = {
  expires: number | null;
  server: number;
  monotonic: number;
};

export function clientRemainingSeconds(
  anchor: ClientClockAnchor,
  nowMonotonic: number,
): number | null {
  if (anchor.expires === null) return null;

  return Math.max(
    0,
    Math.ceil(
      (anchor.expires - (anchor.server + nowMonotonic - anchor.monotonic)) /
        1000,
    ),
  );
}
