/**
 * TypeScript type definitions for the Telegram WebApp API.
 * @see https://core.telegram.org/bots/webapps#webappuser
 */

export interface TelegramWebAppUser {
  /** Unique identifier for this user or bot. */
  id: number;
  /** True, if this user is a bot. */
  is_bot?: boolean;
  /** User's or bot's first name. */
  first_name: string;
  /** User's or bot's last name. */
  last_name?: string;
  /** User's or bot's username. */
  username?: string;
  /** IETF language tag of the user's language. */
  language_code?: string;
  /** True, if this user is a Telegram Premium user. */
  is_premium?: boolean;
  /** True, if this user added the bot to the attachment menu. */
  added_to_attachment_menu?: boolean;
  /** True, if this user allowed the bot to message them. */
  allows_write_to_pm?: boolean;
  /** URL of the user's profile photo (only in Mini Apps opened from attachment menu). */
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  /** A unique identifier for the Mini App session. */
  query_id?: string;
  /** An object containing data about the current user. */
  user?: TelegramWebAppUser;
  /** An object containing data about the chat partner in 1-on-1 chat. */
  receiver?: TelegramWebAppUser;
  /** An object containing data about the chat. */
  chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    photo_url?: string;
  };
  /** Type of the chat. */
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  /** Global identifier for the chat instance. */
  chat_instance?: string;
  /** The value of the startattach or startapp parameter. */
  start_param?: string;
  /** Time in seconds when the form was opened. */
  auth_date: number;
  /** Hash for data authentication. */
  hash: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  section_separator_color?: string;
  bottom_bar_bg_color?: string;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
  setParams: (params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => TelegramMainButton;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => TelegramBackButton;
  offClick: (callback: () => void) => TelegramBackButton;
  show: () => TelegramBackButton;
  hide: () => TelegramBackButton;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => TelegramHapticFeedback;
  notificationOccurred: (type: "error" | "success" | "warning") => TelegramHapticFeedback;
  selectionChanged: () => TelegramHapticFeedback;
}

export interface TelegramWebApp {
  /** Raw init data string (for server-side verification). */
  initData: string;
  /** Parsed init data (NOT verified — use server-side validation for production). */
  initDataUnsafe: TelegramWebAppInitData;
  /** Version of the Bot API available in the user's Telegram app. */
  version: string;
  /** The name of the platform of the user's Telegram app. */
  platform: string;
  /** The color scheme currently used in the Telegram app. */
  colorScheme: "light" | "dark";
  /** Theme parameters. */
  themeParams: TelegramThemeParams;
  /** True if expanded to maximum height. */
  isExpanded: boolean;
  /** Current height of the visible area. */
  viewportHeight: number;
  /** Stable height of the visible area. */
  viewportStableHeight: number;
  /** Current header color. */
  headerColor: string;
  /** Current background color. */
  backgroundColor: string;
  /** Whether closing confirmation is enabled. */
  isClosingConfirmationEnabled: boolean;
  /** Whether vertical swipes are enabled. */
  isVerticalSwipesEnabled: boolean;

  // Objects
  MainButton: TelegramMainButton;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;

  // Methods
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{
        id?: string;
        type?: "default" | "ok" | "close" | "cancel" | "destructive";
        text?: string;
      }>;
    },
    callback?: (buttonId: string) => void
  ) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  enableVerticalSwipes: () => void;
  disableVerticalSwipes: () => void;
  setHeaderColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
  setBackgroundColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
  setBottomBarColor: (color: "bg_color" | "secondary_bg_color" | "bottom_bar_bg_color" | string) => void;
  requestContact: (callback?: (shared: boolean) => void) => void;
  onEvent: (eventType: string, callback: (...args: unknown[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
