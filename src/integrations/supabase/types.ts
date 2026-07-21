export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string
          at: string
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor: string
          at?: string
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          capacity: number | null
          created_at: string
          duration_min: number | null
          host: string | null
          host_email: string | null
          id: string
          is_active: boolean | null
          join_url: string | null
          passcode: string | null
          raw: Json | null
          start_time: string | null
          status: string | null
          synced_at: string | null
          topic: string
          updated_at: string
          zoom_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          duration_min?: number | null
          host?: string | null
          host_email?: string | null
          id?: string
          is_active?: boolean | null
          join_url?: string | null
          passcode?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          synced_at?: string | null
          topic: string
          updated_at?: string
          zoom_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          duration_min?: number | null
          host?: string | null
          host_email?: string | null
          id?: string
          is_active?: boolean | null
          join_url?: string | null
          passcode?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          synced_at?: string | null
          topic?: string
          updated_at?: string
          zoom_id?: string
        }
        Relationships: []
      }
      registrant_messages: {
        Row: {
          created_at: string
          from_name: string
          from_role: string
          id: string
          meeting_id: string | null
          registrant_id: string | null
          telegram_message_id: number | null
          text: string
        }
        Insert: {
          created_at?: string
          from_name: string
          from_role: string
          id?: string
          meeting_id?: string | null
          registrant_id?: string | null
          telegram_message_id?: number | null
          text: string
        }
        Update: {
          created_at?: string
          from_name?: string
          from_role?: string
          id?: string
          meeting_id?: string | null
          registrant_id?: string | null
          telegram_message_id?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrant_messages_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrant_messages_registrant_id_fkey"
            columns: ["registrant_id"]
            isOneToOne: false
            referencedRelation: "registrants"
            referencedColumns: ["id"]
          },
        ]
      }
      registrant_notes: {
        Row: {
          author_name: string
          author_tg_id: number | null
          body: string
          created_at: string
          id: string
          registrant_id: string
          updated_at: string
        }
        Insert: {
          author_name: string
          author_tg_id?: number | null
          body: string
          created_at?: string
          id?: string
          registrant_id: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_tg_id?: number | null
          body?: string
          created_at?: string
          id?: string
          registrant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrant_notes_registrant_id_fkey"
            columns: ["registrant_id"]
            isOneToOne: false
            referencedRelation: "registrants"
            referencedColumns: ["id"]
          },
        ]
      }
      registrants: {
        Row: {
          cancelled_at: string | null
          email: string
          id: string
          meeting_id: string | null
          name: string
          phone: string | null
          registered_at: string
          status: string
          telegram_id: number | null
          telegram_user: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          email: string
          id?: string
          meeting_id?: string | null
          name: string
          phone?: string | null
          registered_at?: string
          status?: string
          telegram_id?: number | null
          telegram_user?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          email?: string
          id?: string
          meeting_id?: string | null
          name?: string
          phone?: string | null
          registered_at?: string
          status?: string
          telegram_id?: number | null
          telegram_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
