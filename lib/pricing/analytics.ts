export type PricingEvent =
  | "started"
  | "step_completed"
  | "result_viewed"
  | "tier_selected"
  | "inspection_requested";

export function track(_event: PricingEvent): void {
  // Deliberately no-op until a privacy-reviewed analytics provider is configured.
}
