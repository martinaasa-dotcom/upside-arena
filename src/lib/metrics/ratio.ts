/**
 * A count expressed as a percentage of a total.
 *
 * Nothing out of nothing is null rather than zero, and every screen that uses
 * this says so in words. Zero percent reads as a verdict on the product;
 * "nothing yet" reads as the truth, and on a day-one dashboard almost
 * everything is nothing yet.
 */
export function percentOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
}
