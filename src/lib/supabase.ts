import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  (typeof process !== "undefined" && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  "https://xeipxyibruroppnqzxbo.supabase.co";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
  (typeof process !== "undefined" && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlaXB4eWlicnVyb3BwbnF6eGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDQ1NDMsImV4cCI6MjA5OTI4MDU0M30.yc5wLBfISB-n2cYM3_vO46EwGqpSvX3D1TDvE-aBJ7k";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
