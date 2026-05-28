/**
 * Tiny in-memory channel for handing a scanned VIN back to the Add-Vehicle
 * form without losing whatever the user had already typed (which would
 * happen if we round-tripped via route params).
 *
 * The scan screen calls setPendingVin() right before router.back(). The
 * Add-Vehicle screen calls consumePendingVin() in a useFocusEffect — the
 * one-shot read prevents the value from being applied twice if the form
 * is re-focused later.
 */
let pendingVin: string | null = null;

export function setPendingVin(vin: string) {
  pendingVin = vin;
}

export function consumePendingVin(): string | null {
  const v = pendingVin;
  pendingVin = null;
  return v;
}

/** VIN: 17 chars, no I/O/Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/**
 * VIN barcodes sometimes carry extra payload (QR codes embed JSON, Code 39
 * occasionally has a checksum char). Extract the first 17-char run that
 * matches the VIN alphabet — if any.
 */
export function extractVinFromBarcode(raw: string): string | null {
  const candidates = raw.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/g);
  return candidates?.find((c) => VIN_PATTERN.test(c)) ?? null;
}
