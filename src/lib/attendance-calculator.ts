/**
 * Attendance Calculator Engine
 *
 * Implements:
 * 1. Feature Toggle Check: Can be enabled/disabled per meeting.
 * 2. Tracked Roster Filter: Calculates attendance ONLY for specified users in target roster.
 * 3. Entry/Exit Sessions Aggregator: Calculates join_count, list of join/leave sessions with timestamps,
 *    and overall attended percentage.
 */

export interface RawParticipantSession {
  join_time: string;
  leave_time: string;
  duration_seconds: number;
}

export interface FormattedSessionDetail {
  join: string;
  leave: string;
  duration_min: number;
}

export interface AttendanceCalculationResult {
  is_tracked: boolean;
  join_count: number;
  sessions_detail: FormattedSessionDetail[];
  total_duration_min: number;
  attended_percentage: number;
  is_qualified: boolean;
}

/**
 * Parses raw Zoom participant join/leave events into structured session logs.
 */
export function calculateParticipantAttendance(
  email: string,
  targetRosterEmails: string[],
  sessions: RawParticipantSession[],
  totalMeetingDurationMinutes: number = 60,
  qualificationThresholdPercent: number = 80
): AttendanceCalculationResult {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRoster = targetRosterEmails.map(e => e.trim().toLowerCase());

  // If user is NOT in the target roster, skip detailed calculation
  if (!normalizedRoster.includes(normalizedEmail)) {
    return {
      is_tracked: false,
      join_count: 0,
      sessions_detail: [],
      total_duration_min: 0,
      attended_percentage: 0,
      is_qualified: false,
    };
  }

  const joinCount = sessions.length;
  let totalSeconds = 0;
  const sessionsDetail: FormattedSessionDetail[] = [];

  for (const s of sessions) {
    const durationMin = Math.round(s.duration_seconds / 60);
    totalSeconds += s.duration_seconds;

    sessionsDetail.push({
      join: new Date(s.join_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      leave: new Date(s.leave_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      duration_min: durationMin,
    });
  }

  const totalDurationMin = Math.round(totalSeconds / 60);
  const attendedPercentage =
    totalMeetingDurationMinutes > 0
      ? Math.min(100, Number(((totalDurationMin / totalMeetingDurationMinutes) * 100).toFixed(2)))
      : 0;

  const isQualified = attendedPercentage >= qualificationThresholdPercent;

  return {
    is_tracked: true,
    join_count: joinCount,
    sessions_detail: sessionsDetail,
    total_duration_min: totalDurationMin,
    attended_percentage: attendedPercentage,
    is_qualified: isQualified,
  };
}
