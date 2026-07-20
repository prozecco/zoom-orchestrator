/**
 * Zoom Integration Service & API Helpers
 *
 * Enforces:
 * 1. Payload Mapping: Sends ORIGINAL First Name & Last Name to Zoom API (no overriding last_name with member_id on Zoom).
 * 2. Post-Approval Member ID: Generates Member ID ONLY after registration approval and saves to Supabase DB.
 * 3. Registration Questions Caching & Zoom S2SO API endpoints.
 */

import { generateNextMemberId, MemberIdConfig } from './member-id';

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

/**
 * Builds the exact JSON payload sent to Zoom POST /meetings/{meetingId}/registrants.
 * IMPORTANT: Retains user's actual first_name and last_name so it displays clearly on Zoom Web Portal.
 */
export function buildZoomRegistrantPayload(
  firstName: string,
  lastName: string,
  email: string,
  customAnswers?: Record<string, string>
): ZoomRegistrantPayload {
  const customQuestions = customAnswers
    ? Object.entries(customAnswers).map(([title, value]) => ({ title, value }))
    : undefined;

  return {
    first_name: firstName.trim(),
    last_name: (lastName || '').trim(),
    email: email.trim(),
    custom_questions: customQuestions,
  };
}

/**
 * Assigns a Member ID to a user upon approval (Post-Approval).
 * Updates user profile and advances sequence number.
 */
export function processPostApprovalMemberId(
  currentMemberId: string | null,
  config: MemberIdConfig,
  isManual: boolean = false,
  manualIdInput?: string
): { assignedMemberId: string; updatedConfig?: MemberIdConfig } {
  // If user already has a Member ID, retain it
  if (currentMemberId) {
    return { assignedMemberId: currentMemberId };
  }

  // If Admin chose Manual mode or provided a manual ID
  if (isManual || config.assignment_mode === 'manual') {
    const idToUse = manualIdInput && manualIdInput.trim() ? manualIdInput.trim() : `MBR-MANUAL-${Date.now().toString().slice(-4)}`;
    return { assignedMemberId: idToUse };
  }

  // Auto mode with pattern and reserved range skipping
  const { memberId, nextSequence } = generateNextMemberId(config);
  const updatedConfig: MemberIdConfig = {
    ...config,
    current_sequence: nextSequence,
  };

  return {
    assignedMemberId: memberId,
    updatedConfig,
  };
}

/**
 * Mock Zoom S2SO Client for local dev/testing fallback
 */
export async function mockSubmitZoomRegistrant(
  meetingId: string,
  payload: ZoomRegistrantPayload
): Promise<ZoomRegistrantResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 150));

  return {
    registrant_id: `reg_${Math.random().toString(36).substring(2, 9)}`,
    id: parseInt(meetingId, 10) || 123456789,
    topic: 'Zoom Automated Workshop Room',
    start_time: new Date().toISOString(),
    join_url: `https://zoom.us/w/${meetingId}?tk=mock_token_${Math.random().toString(36).substring(2, 8)}`,
  };
}
