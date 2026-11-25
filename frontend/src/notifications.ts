export type NotificationAction = "toggle" | "reset";

export function nextNotificationState(enabled: boolean, action: NotificationAction): boolean {
  return action === "toggle" && !enabled;
}
