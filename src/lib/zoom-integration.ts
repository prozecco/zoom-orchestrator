// src/lib/zoom-integration.ts
import { generateNextMemberId, MemberIdConfig } from './member-id';

// ─── Error Types ─────────────────────────────────────────────────────────────

export class ZoomValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ZoomValidationError';
  }
}

export class ZoomApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'ZoomApiError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZoomRegistrantPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  city?: string;
  country?: string;
  custom_questions?: Array<{
    title: string;
    value: string;
  }>;
}

export interface ZoomRegistrantResponse {
  registrant_id: string;
  id: number;
  topic: string;
  start_time: string;
  join_url: string;
}

export type AssignmentMode = 'auto' | 'manual';

export interface BuildPayloadOptions {
  firstName: string;
  lastName?: string; // Optional to support single-name registrants
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  customAnswers?: Record<string, string>;
}

export interface PostApprovalResult {
  assignedMemberId: string;
  updatedConfig?: MemberIdConfig;
  modeUsed: AssignmentMode;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Payload Builder ─────────────────────────────────────────────────────────

/**
 * Builds the exact JSON payload sent to Zoom POST /meetings/{meetingId}/registrants.
 * Retains the user's actual first_name and last_name for display in the Zoom Web Portal.
 * Supports single-name registrants by allowing optional lastName.
 */
export function buildZoomRegistrantPayload(
  options: BuildPayloadOptions
): ZoomRegistrantPayload {
  const { firstName, lastName, email, phone, city, country, customAnswers } =
    options;

  const trimmedFirst = firstName?.trim();
  const trimmedLast = (lastName ?? '').trim();
  const trimmedEmail = email?.trim();

  if (!trimmedFirst) {
    throw new ZoomValidationError('First name is required', 'firstName');
  }
  if (!trimmedEmail) {
    throw new ZoomValidationError('Email is required', 'email');
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    throw new ZoomValidationError(
      `Invalid email format: "${trimmedEmail}"`,
      'email'
    );
  }

  const customQuestions = customAnswers
    ? Object.entries(customAnswers)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([title, value]) => ({ title, value: String(value).trim() }))
    : undefined;

  return {
    first_name: trimmedFirst,
    last_name: trimmedLast,
    email: trimmedEmail,
    ...(phone && { phone: phone.trim() }),
    ...(city && { city: city.trim() }),
    ...(country && { country: country.trim() }),
    ...(customQuestions?.length && { custom_questions: customQuestions }),
  };
}

// ─── Post-Approval Member ID ─────────────────────────────────────────────────

/**
 * Assigns a Member ID to a user upon approval.
 *
 * Rules:
 * 1. If user already has a Member ID, retain it (idempotent).
 * 2. If manual mode (or override), use provided manual ID or generate a fallback.
 * 3. If auto mode, generate next sequential ID and advance config.
 */
export function processPostApprovalMemberId(
  currentMemberId: string | null | undefined,
  config: MemberIdConfig,
  options: {
    isManualOverride?: boolean;
    manualIdInput?: string;
    allowEmptyManualFallback?: boolean;
  } = {}
): PostApprovalResult {
  const { isManualOverride = false, manualIdInput, allowEmptyManualFallback = false } = options;

  // Idempotent: already assigned
  if (currentMemberId?.trim()) {
    return { assignedMemberId: currentMemberId.trim(), modeUsed: 'auto' };
  }

  const isManual = isManualOverride || config.assignment_mode === 'manual';

  if (isManual) {
    const trimmedManual = manualIdInput?.trim();

    if (trimmedManual) {
      return {
        assignedMemberId: trimmedManual,
        modeUsed: 'manual',
      };
    }

    if (!allowEmptyManualFallback) {
      throw new ZoomValidationError(
        'Manual Member ID required but no input provided. ' +
          'Pass manualIdInput or set allowEmptyManualFallback=true.',
        'manualIdInput'
      );
    }

    // Fallback for tests/dev
    const fallback = `MBR-MANUAL-${Date.now().toString().slice(-4)}`;
    return { assignedMemberId: fallback, modeUsed: 'manual' };
  }

  // Auto mode
  if (!config || typeof config.current_sequence !== 'number') {
    throw new ZoomValidationError(
      'Invalid MemberIdConfig: missing current_sequence',
      'config'
    );
  }

  const { memberId, nextSequence } = generateNextMemberId(config);

  const updatedConfig: MemberIdConfig = {
    ...config,
    current_sequence: nextSequence,
  };

  return {
    assignedMemberId: memberId,
    updatedConfig,
    modeUsed: 'auto',
  };
}

// ─── Mock Zoom Client ────────────────────────────────────────────────────────

export interface MockRegistrantOptions {
  shouldFail?: boolean;
  failureStatusCode?: number;
  failureMessage?: string;
  delayMs?: number;
}

/**
 * Mock Zoom S2SO Client for local dev/testing.
 * Simulates network latency and can optionally throw errors.
 */
export async function mockSubmitZoomRegistrant(
  meetingId: string,
  payload: ZoomRegistrantPayload,
  options: MockRegistrantOptions = {}
): Promise<ZoomRegistrantResponse> {
  const {
    shouldFail = false,
    failureStatusCode = 400,
    failureMessage = 'Mock Zoom API failure',
    delayMs = 150,
  } = options;

  // Validate payload even in mock mode
  if (!payload.email?.trim()) {
    throw new ZoomValidationError('Mock reject: email is required', 'email');
  }
  if (!payload.first_name?.trim()) {
    throw new ZoomValidationError(
      'Mock reject: first_name is required',
      'first_name'
    );
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (shouldFail) {
    throw new ZoomApiError(
      `Mock Zoom Error [HTTP ${failureStatusCode}]: ${failureMessage}`,
      failureStatusCode,
      JSON.stringify({ message: failureMessage })
    );
  }

  // Sanitize meetingId for mock URL
  const numericId = Number(meetingId);
  const safeMeetingId = Number.isFinite(numericId) && numericId > 0
    ? numericId
    : 123456789;

  return {
    registrant_id: `reg_${Math.random().toString(36).substring(2, 11)}`,
    id: safeMeetingId,
    topic: 'Zoom Automated Workshop Room',
    start_time: new Date().toISOString(),
    join_url: `https://zoom.us/w/${safeMeetingId}?tk=mock_token_${Math.random()
      .toString(36)
      .substring(2, 8)}`,
  };
}
