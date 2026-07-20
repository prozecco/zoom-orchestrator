/**
 * Member ID Generator & Management Utility
 *
 * Supports:
 * 1. Pattern Templates: e.g. MBR-{YYYY}-{SEQ:4} -> MBR-2026-0101, MEM-{SEQ:5} -> MEM-00101
 * 2. Reserved Ranges: Automatically skips sequence numbers falling inside reserved intervals (e.g. 1-100)
 * 3. Manual Assignment & Validation
 */

export interface ReservedRange {
  start: number;
  end: number;
}

export interface MemberIdConfig {
  pattern_template: string;
  current_sequence: number;
  reserved_ranges: ReservedRange[];
  assignment_mode: 'auto' | 'manual';
}

/**
 * Checks if a given sequence number falls within any reserved range.
 */
export function isSequenceReserved(seq: number, reservedRanges: ReservedRange[]): boolean {
  if (!reservedRanges || reservedRanges.length === 0) return false;
  return reservedRanges.some(range => seq >= range.start && seq <= range.end);
}

/**
 * Finds the next valid sequence number that is NOT reserved.
 */
export function getNextValidSequence(currentSeq: number, reservedRanges: ReservedRange[]): number {
  let nextSeq = currentSeq;
  while (isSequenceReserved(nextSeq, reservedRanges)) {
    nextSeq++;
  }
  return nextSeq;
}

/**
 * Formats a sequence number according to a pattern template.
 * Supported Placeholders:
 * - {YYYY} : 4-digit current year
 * - {YY}   : 2-digit current year
 * - {SEQ:N}: Sequence padded with N zeros (e.g. {SEQ:4} -> 0101)
 */
export function formatMemberId(patternTemplate: string, sequence: number): string {
  const now = new Date();
  const year4 = now.getFullYear().toString();
  const year2 = year4.slice(-2);

  let formatted = patternTemplate
    .replace('{YYYY}', year4)
    .replace('{YY}', year2);

  // Match {SEQ:N}
  const seqMatch = formatted.match(/\{SEQ:(\d+)\}/);
  if (seqMatch) {
    const padLength = parseInt(seqMatch[1], 10) || 4;
    const paddedSeq = sequence.toString().padStart(padLength, '0');
    formatted = formatted.replace(seqMatch[0], paddedSeq);
  } else if (formatted.includes('{SEQ}')) {
    formatted = formatted.replace('{SEQ}', sequence.toString().padStart(4, '0'));
  }

  return formatted;
}

/**
 * Generates the next Member ID and calculates the updated sequence number to store in DB.
 */
export function generateNextMemberId(config: MemberIdConfig): { memberId: string; nextSequence: number } {
  const validSeq = getNextValidSequence(config.current_sequence, config.reserved_ranges);
  const memberId = formatMemberId(config.pattern_template, validSeq);
  const nextSeq = getNextValidSequence(validSeq + 1, config.reserved_ranges);

  return {
    memberId,
    nextSequence: nextSeq,
  };
}
