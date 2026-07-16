import { useEffect, useState } from "react";

// Reads the Telegram Mini App initData available on window.Telegram.WebApp.
// Falls back to null when opened outside Telegram.

type TelegramUser = { id: number; username?: string; first_name?: string; last_name?: string };

export function useTelegramViewer(): { telegramId: number | null; user: TelegramUser | null; ready: boolean } {
  const [state, setState] = useState<{ telegramId: number | null; user: TelegramUser | null; ready: boolean }>({
    telegramId: null, user: null, ready: false,
  });

  useEffect(() => {
    try {
      const wa = (window as any)?.Telegram?.WebApp;
      wa?.ready?.();
      const u = wa?.initDataUnsafe?.user as TelegramUser | undefined;
      // Dev override: ?tg_id=123 in the URL simulates a Telegram user.
      const url = new URL(window.location.href);
      const overrideId = Number(url.searchParams.get("tg_id"));
      const id = u?.id ?? (Number.isFinite(overrideId) && overrideId > 0 ? overrideId : null);
      setState({ telegramId: id, user: u ?? null, ready: true });
    } catch {
      setState({ telegramId: null, user: null, ready: true });
    }
  }, []);

  return state;
}
