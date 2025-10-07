export interface Subscription {
  plan_code: string;
  seat_count: number;
  stripe_subscription_status:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "past_due"
    | "trialing"
    | "unpaid";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface Entitlement {
  seat_count: number;
  max_custom_mcp_servers: number;
  log_retention_days: number;
}

export interface SubscriptionStatus {
  subscription: Subscription | null;
  entitlement: Entitlement;
}
