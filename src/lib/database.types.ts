/**
 * Auto-generated–style Supabase Database type definitions.
 * These mirror the tables created via SQL migrations 001 and 002.
 */

export interface Database {
  public: {
    Tables: {
      telegram_users: {
        Row: {
          id: string;
          telegram_id: number;
          first_name: string;
          last_name: string | null;
          username: string | null;
          language_code: string | null;
          is_bot: boolean;
          is_premium: boolean;
          added_to_attachment_menu: boolean;
          allows_write_to_pm: boolean;
          photo_url: string | null;
          zoom_user_id: string | null;
          zoom_email: string | null;
          member_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          telegram_id: number;
          first_name: string;
          last_name?: string | null;
          username?: string | null;
          language_code?: string | null;
          is_bot?: boolean;
          is_premium?: boolean;
          added_to_attachment_menu?: boolean;
          allows_write_to_pm?: boolean;
          photo_url?: string | null;
          zoom_user_id?: string | null;
          zoom_email?: string | null;
          member_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          telegram_id?: number;
          first_name?: string;
          last_name?: string | null;
          username?: string | null;
          language_code?: string | null;
          is_bot?: boolean;
          is_premium?: boolean;
          added_to_attachment_menu?: boolean;
          allows_write_to_pm?: boolean;
          photo_url?: string | null;
          zoom_user_id?: string | null;
          zoom_email?: string | null;
          member_id?: string | null;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          user_telegram_id: number;
          contact_telegram_id: number;
          nickname: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_telegram_id: number;
          contact_telegram_id: number;
          nickname?: string | null;
          created_at?: string;
        };
        Update: {
          nickname?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          type: "direct" | "meeting_central" | "meeting_private";
          meeting_id: string | null;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: "direct" | "meeting_central" | "meeting_private";
          meeting_id?: string | null;
          title?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string | null;
        };
      };
      conversation_members: {
        Row: {
          id: string;
          conversation_id: string;
          telegram_id: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          telegram_id: number;
          joined_at?: string;
        };
        Update: Record<string, never>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_telegram_id: number;
          content: string;
          media_url: string | null;
          media_type: string | null;
          is_view_once: boolean;
          view_once_seen: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_telegram_id: number;
          content: string;
          media_url?: string | null;
          media_type?: string | null;
          is_view_once?: boolean;
          view_once_seen?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          media_url?: string | null;
          media_type?: string | null;
          is_view_once?: boolean;
          view_once_seen?: boolean;
          expires_at?: string | null;
        };
      };
      meeting_participants: {
        Row: {
          id: string;
          meeting_id: string;
          telegram_id: number;
          status: "registered" | "approved" | "rejected" | "joined" | "left";
          joined_at: string | null;
          left_at: string | null;
          registration_responses: Record<string, any> | null;
          zoom_join_url: string | null;
          flags: string[] | null;
          is_attendance_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          telegram_id: number;
          status?: "registered" | "approved" | "rejected" | "joined" | "left";
          joined_at?: string | null;
          left_at?: string | null;
          registration_responses?: Record<string, any> | null;
          zoom_join_url?: string | null;
          flags?: string[] | null;
          is_attendance_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "registered" | "approved" | "rejected" | "joined" | "left";
          joined_at?: string | null;
          left_at?: string | null;
          registration_responses?: Record<string, any> | null;
          zoom_join_url?: string | null;
          flags?: string[] | null;
          is_attendance_enabled?: boolean;
          updated_at?: string;
        };
      };
      zoom_registration_questions: {
        Row: {
          meeting_id: string;
          questions_json: Record<string, any>;
          updated_at: string;
        };
        Insert: {
          meeting_id: string;
          questions_json: Record<string, any>;
          updated_at?: string;
        };
        Update: {
          questions_json?: Record<string, any>;
          updated_at?: string;
        };
      };
      member_id_configs: {
        Row: {
          id: number;
          pattern_template: string;
          current_sequence: number;
          reserved_ranges: Array<{ start: number; end: number }> | null;
          assignment_mode: "auto" | "manual";
          updated_at: string;
        };
        Insert: {
          id?: number;
          pattern_template?: string;
          current_sequence?: number;
          reserved_ranges?: Array<{ start: number; end: number }> | null;
          assignment_mode?: "auto" | "manual";
          updated_at?: string;
        };
        Update: {
          pattern_template?: string;
          current_sequence?: number;
          reserved_ranges?: Array<{ start: number; end: number }> | null;
          assignment_mode?: "auto" | "manual";
          updated_at?: string;
        };
      };
      identity_change_log: {
        Row: {
          id: number;
          telegram_id: number;
          change_type: string;
          old_value: Record<string, any> | null;
          new_value: Record<string, any> | null;
          reason: string | null;
          changed_by: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          telegram_id: number;
          change_type: string;
          old_value?: Record<string, any> | null;
          new_value?: Record<string, any> | null;
          reason?: string | null;
          changed_by?: string;
          created_at?: string;
        };
        Update: {
          change_type?: string;
          old_value?: Record<string, any> | null;
          new_value?: Record<string, any> | null;
          reason?: string | null;
          changed_by?: string;
        };
      };
      attendance_target_roster: {
        Row: {
          id: number;
          meeting_id: string;
          telegram_id: number;
          zoom_email: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          meeting_id: string;
          telegram_id: number;
          zoom_email: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          zoom_email?: string;
          note?: string | null;
        };
      };
      meeting_attendance_logs: {
        Row: {
          id: number;
          meeting_id: string;
          telegram_id: number;
          zoom_email: string;
          join_count: number;
          sessions_detail: Array<{ join: string; leave: string; duration_min: number }> | null;
          total_duration_min: number;
          attended_percentage: number;
          is_qualified: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          meeting_id: string;
          telegram_id: number;
          zoom_email: string;
          join_count?: number;
          sessions_detail?: Array<{ join: string; leave: string; duration_min: number }> | null;
          total_duration_min?: number;
          attended_percentage?: number;
          is_qualified?: boolean;
          updated_at?: string;
        };
        Update: {
          join_count?: number;
          sessions_detail?: Array<{ join: string; leave: string; duration_min: number }> | null;
          total_duration_min?: number;
          attended_percentage?: number;
          is_qualified?: boolean;
          updated_at?: string;
        };
      };
      chat_media_attachments: {
        Row: {
          id: string;
          message_id: string;
          telegram_id: number;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          zoom_file_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          telegram_id: number;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          zoom_file_id?: string | null;
          created_at?: string;
        };
        Update: {
          file_name?: string;
          file_type?: string;
          file_size?: number;
          storage_path?: string;
          zoom_file_id?: string | null;
        };
      };
      chat_message_reactions: {
        Row: {
          id: number;
          message_id: string;
          telegram_id: number;
          emoji_code: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          message_id: string;
          telegram_id: number;
          emoji_code: string;
          created_at?: string;
        };
        Update: {
          emoji_code?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      conversation_type: "direct" | "meeting_central" | "meeting_private";
      participant_status: "registered" | "approved" | "rejected" | "joined" | "left";
    };
  };
}
