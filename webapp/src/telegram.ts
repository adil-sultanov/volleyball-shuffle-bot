/** Minimal typing for the parts of https://telegram.org/js/telegram-web-app.js we use. */
interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  showConfirm(message: string, callback: (ok: boolean) => void): void;
  showAlert(message: string): void;
  HapticFeedback?: { selectionChanged(): void; notificationOccurred(type: "success" | "error" | "warning"): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg = window.Telegram?.WebApp;

export function confirm(message: string): Promise<boolean> {
  if (tg?.initData) return new Promise((resolve) => tg.showConfirm(message, resolve));
  return Promise.resolve(window.confirm(message));
}

export function notify(message: string) {
  if (tg?.initData) tg.showAlert(message);
  else window.alert(message);
}

export function haptic(kind: "select" | "success" | "error") {
  const h = tg?.HapticFeedback;
  if (!h) return;
  if (kind === "select") h.selectionChanged();
  else h.notificationOccurred(kind);
}
