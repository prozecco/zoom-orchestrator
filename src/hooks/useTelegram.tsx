import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  TelegramWebApp,
  TelegramWebAppUser,
  TelegramThemeParams,
  TelegramHapticFeedback,
  TelegramMainButton,
  TelegramBackButton,
} from "../lib/telegram-types";
import { syncTelegramUser } from "../lib/telegram-sync";

// ---------------------------------------------------------------------------
// Mock / fallback data for development outside Telegram
// ---------------------------------------------------------------------------
const MOCK_USER: TelegramWebAppUser = {
  id: 123456789,
  first_name: "Dev",
  last_name: "User",
  username: "dev_user",
  language_code: "th",
  is_bot: false,
  is_premium: false,
  allows_write_to_pm: true,
  photo_url: undefined,
};

const MOCK_THEME: TelegramThemeParams = {
  bg_color: "#1a1a2e",
  text_color: "#e0e0e0",
  hint_color: "#7a7a8e",
  link_color: "#5b8def",
  button_color: "#5b8def",
  button_text_color: "#ffffff",
  secondary_bg_color: "#16213e",
  header_bg_color: "#0f3460",
  accent_text_color: "#5b8def",
  section_bg_color: "#1a1a2e",
  section_header_text_color: "#7a7a8e",
  subtitle_text_color: "#7a7a8e",
  destructive_text_color: "#ef4444",
};

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------
export interface TelegramContextValue {
  /** The raw Telegram WebApp object — null when running outside Telegram. */
  webApp: TelegramWebApp | null;

  /** Whether we are inside Telegram. */
  isTelegram: boolean;

  /**
   * The **full** user object from `initDataUnsafe.user`.
   * Falls back to mock data outside Telegram so the app never crashes.
   */
  user: TelegramWebAppUser;

  /** Raw `initData` string (for server-side signature verification). */
  initData: string;

  /** Theme parameters (real when in Telegram, fallback otherwise). */
  themeParams: TelegramThemeParams;

  /** Current colour scheme. */
  colorScheme: "light" | "dark";

  // Convenience helpers wrapping the native Telegram API
  haptic: TelegramHapticFeedback | null;
  mainButton: TelegramMainButton | null;
  backButton: TelegramBackButton | null;
  openLink: (url: string) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  close: () => void;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // Signal that the Mini App is ready
      tg.ready();
      // Expand to full height
      tg.expand();
      // Disable vertical swipes so the user can scroll freely
      if (typeof tg.disableVerticalSwipes === "function") {
        tg.disableVerticalSwipes();
      }

      setWebApp(tg);
      setColorScheme(tg.colorScheme);

      // Listen for theme changes (user toggles dark/light mode in Telegram)
      const onThemeChanged = () => {
        setColorScheme(tg.colorScheme);
      };
      tg.onEvent("themeChanged", onThemeChanged);

      return () => {
        tg.offEvent("themeChanged", onThemeChanged);
      };
    }
  }, []);

  // Sync Telegram user data to Supabase (runs once)
  const hasSynced = useRef(false);
  useEffect(() => {
    if (webApp && !hasSynced.current) {
      hasSynced.current = true;
      const user = webApp.initDataUnsafe?.user;
      if (user) {
        syncTelegramUser(user);
      }
    }
  }, [webApp]);

  const value = useMemo<TelegramContextValue>(() => {
    const isTelegram = webApp !== null;
    const user: TelegramWebAppUser =
      webApp?.initDataUnsafe?.user ?? MOCK_USER;
    const initData = webApp?.initData ?? "";
    const themeParams: TelegramThemeParams =
      webApp?.themeParams ?? MOCK_THEME;

    return {
      webApp,
      isTelegram,
      user,
      initData,
      themeParams,
      colorScheme,
      haptic: webApp?.HapticFeedback ?? null,
      mainButton: webApp?.MainButton ?? null,
      backButton: webApp?.BackButton ?? null,
      openLink: (url: string) => {
        if (webApp) {
          webApp.openLink(url);
        } else {
          window.open(url, "_blank", "noopener");
        }
      },
      showAlert: (message: string) => {
        if (webApp) {
          webApp.showAlert(message);
        } else {
          alert(message);
        }
      },
      showConfirm: (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
          if (webApp) {
            webApp.showConfirm(message, (confirmed) => resolve(confirmed));
          } else {
            resolve(confirm(message));
          }
        });
      },
      close: () => {
        if (webApp) {
          webApp.close();
        }
      },
    };
  }, [webApp, colorScheme]);

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Access the Telegram WebApp context from anywhere inside the app tree.
 *
 * @example
 * ```tsx
 * const { user, haptic, openLink } = useTelegram();
 * ```
 */
export function useTelegram(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error(
      "useTelegram() must be used within a <TelegramProvider>. " +
        "Wrap your app root with <TelegramProvider>."
    );
  }
  return ctx;
}
