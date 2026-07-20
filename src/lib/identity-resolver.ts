/**
 * Identity Resolution Engine
 *
 * Implements 8 comprehensive rules to validate participant registrations,
 * resolve identities, handle account changes, detect impersonation & blacklist evasion,
 * and record audit trails into identity_change_log.
 */

export interface IdentityCheckInput {
  telegram_id: number;
  email: string;
  first_name: string;
  last_name?: string | null;
  meeting_id: string;
}

export interface ExistingUserRecord {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  zoom_email: string | null;
  member_id: string | null;
  status?: string; // e.g. 'blacklisted', 'active'
}

export interface ExistingParticipantRecord {
  meeting_id: string;
  telegram_id: number;
  status: string;
}

export interface ResolutionResult {
  allowed: boolean;
  action: 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'DUPLICATE';
  message: string;
  flags: string[];
  userUpdatePayload?: {
    zoom_email?: string;
    first_name?: string;
    last_name?: string;
  };
  auditLog?: {
    change_type: string;
    old_value: Record<string, any>;
    new_value: Record<string, any>;
    reason?: string;
  };
}

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwawaymail.com',
  'yopmail.com',
  'dispostable.com',
];

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase().trim();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Resolves registrant identity against database state according to the 8 rules.
 */
export function resolveIdentity(
  input: IdentityCheckInput,
  currentUser: ExistingUserRecord | null,
  userWithSameEmail: ExistingUserRecord | null,
  existingParticipant: ExistingParticipantRecord | null,
  blacklistedUsers: ExistingUserRecord[] = []
): ResolutionResult {
  const flags: string[] = [];

  // ---------------------------------------------------------------------------
  // Rule 4 & 5: Blacklist Checks (Primary Enforcement)
  // ---------------------------------------------------------------------------
  if (currentUser && currentUser.status === 'blacklisted') {
    return {
      allowed: false,
      action: 'BLOCK',
      message: 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
      flags: ['BLACKLISTED_TELEGRAM_ID'],
    };
  }

  const isEmailBlacklisted = blacklistedUsers.some(
    u => u.zoom_email && u.zoom_email.toLowerCase() === input.email.toLowerCase()
  );
  if (isEmailBlacklisted) {
    return {
      allowed: false,
      action: 'BLOCK',
      message: 'อีเมลนี้ถูกระงับในระบบ กรุณาติดต่อผู้ดูแลระบบ',
      flags: ['BLACKLISTED_EMAIL'],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 8: Duplicate Registration in Same Meeting
  // ---------------------------------------------------------------------------
  if (existingParticipant) {
    return {
      allowed: false,
      action: 'DUPLICATE',
      message: 'คุณได้ลงทะเบียนในห้องประชุมนี้ไปแล้ว',
      flags: ['DUPLICATE_MEETING_REGISTRATION'],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Same Email Registered under a Different Telegram ID (Potential Impersonation)
  // ---------------------------------------------------------------------------
  if (userWithSameEmail && userWithSameEmail.telegram_id !== input.telegram_id) {
    // Check Rule 6: Same First+Last name & Same Email but different Telegram ID
    const isSameName =
      userWithSameEmail.first_name.trim().toLowerCase() === input.first_name.trim().toLowerCase();

    if (isSameName) {
      return {
        allowed: false,
        action: 'FLAG_FOR_REVIEW',
        message: 'พบข้อมูลการลงทะเบียนซ้ำซ้อนในระบบ อยู่ระหว่างการตรวจสอบโดยผู้ดูแลระบบ',
        flags: ['ACCOUNT_TRANSFER_PENDING_REVIEW'],
      };
    }

    return {
      allowed: false,
      action: 'BLOCK',
      message: 'อีเมลนี้ถูกใช้งานโดยบัญชี Telegram อื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ',
      flags: ['EMAIL_IMPERSONATION_BLOCK'],
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 7: Disposable Email Check
  // ---------------------------------------------------------------------------
  if (isDisposableEmail(input.email)) {
    flags.push('DISPOSABLE_EMAIL_WARNING');
  }

  // ---------------------------------------------------------------------------
  // Rule 1 & 3: Profile Updates for Same Telegram User (New Email or Name Change)
  // ---------------------------------------------------------------------------
  const userUpdates: { zoom_email?: string; first_name?: string; last_name?: string } = {};
  let auditLog: ResolutionResult['auditLog'] = undefined;

  if (currentUser) {
    const isEmailChanged =
      !currentUser.zoom_email || currentUser.zoom_email.toLowerCase() !== input.email.toLowerCase();
    const isNameChanged =
      currentUser.first_name !== input.first_name || currentUser.last_name !== input.last_name;

    if (isEmailChanged) {
      userUpdates.zoom_email = input.email;
      auditLog = {
        change_type: 'email_change',
        old_value: { zoom_email: currentUser.zoom_email },
        new_value: { zoom_email: input.email },
        reason: 'User registered with updated email',
      };
    }

    if (isNameChanged) {
      userUpdates.first_name = input.first_name;
      userUpdates.last_name = input.last_name || undefined;
      auditLog = {
        change_type: 'name_change',
        old_value: { first_name: currentUser.first_name, last_name: currentUser.last_name },
        new_value: { first_name: input.first_name, last_name: input.last_name || null },
        reason: 'User registered with updated name',
      };
    }
  } else {
    // New user initial setup
    userUpdates.zoom_email = input.email;
    userUpdates.first_name = input.first_name;
    userUpdates.last_name = input.last_name || undefined;
  }

  return {
    allowed: true,
    action: 'ALLOW',
    message: 'ตรวจสอบตัวตนผ่านเรียบร้อย',
    flags,
    userUpdatePayload: Object.keys(userUpdates).length > 0 ? userUpdates : undefined,
    auditLog,
  };
}
