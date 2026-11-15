/** The same arithmetic the backend applies to a new booking (src/modules/platform/settings.service.ts). */
export function previewCharges(baseMinorUnits: number, feeBps: number, taxBps: number) {
  const fee = Math.round((baseMinorUnits * feeBps) / 10_000);
  const tax = Math.round(((baseMinorUnits + fee) * taxBps) / 10_000);
  return { fee, tax, total: baseMinorUnits + fee + tax };
}
