/**
 * Single source of truth for BullMQ queue names. Each queue is still owned and
 * registered independently by its own module (finance, forecast, hr, notification)
 * — this just replaces the bare string literal that was previously retyped in
 * 2-4 different files per queue, with no compile-time check that they matched.
 */
export const QUEUE_NAMES = {
  FINANCE_OUTBOX: 'finance-outbox',
  FORECAST_RETRAIN: 'forecast-retrain',
  PAYROLL: 'payroll',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
} as const;
