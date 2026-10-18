// Generated from the live Supabase schema (MCP generate_typescript_types). Do not edit by hand;
// regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      collectibles: {
        Row: {
          collectible_id: string;
          landmark_name: string;
          name: string;
          rarity: string;
          theme: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          collectible_id: string;
          landmark_name: string;
          name: string;
          rarity: string;
          theme: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          collectible_id?: string;
          landmark_name?: string;
          name?: string;
          rarity?: string;
          theme?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      completions: {
        Row: {
          collectible_id: string | null;
          completed_at: string;
          day: string;
          difficulty: string;
          id: number;
          landmark_id: string;
          landmark_name: string;
          mode: string;
          party_size: number;
          quest_id: string;
          quest_title: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          collectible_id?: string | null;
          completed_at?: string;
          day: string;
          difficulty: string;
          id?: never;
          landmark_id: string;
          landmark_name: string;
          mode: string;
          party_size: number;
          quest_id: string;
          quest_title: string;
          user_id: string;
          xp: number;
        };
        Update: {
          collectible_id?: string | null;
          completed_at?: string;
          day?: string;
          difficulty?: string;
          id?: never;
          landmark_id?: string;
          landmark_name?: string;
          mode?: string;
          party_size?: number;
          quest_id?: string;
          quest_title?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      daily_xp: {
        Row: { day: string; user_id: string; xp: number };
        Insert: { day: string; user_id: string; xp?: number };
        Update: { day?: string; user_id?: string; xp?: number };
        Relationships: [];
      };
      player_stats: {
        Row: {
          landmarks_visited: number;
          last_active_day: string | null;
          last_completion_at: string | null;
          quests_completed: number;
          streak: number;
          total_xp: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          landmarks_visited?: number;
          last_active_day?: string | null;
          last_completion_at?: string | null;
          quests_completed?: number;
          streak?: number;
          total_xp?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          landmarks_visited?: number;
          last_active_day?: string | null;
          last_completion_at?: string | null;
          quests_completed?: number;
          streak?: number;
          total_xp?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: { avatar_hue: number; created_at: string; display_name: string; id: string; onboarded_at: string | null; updated_at: string };
        Insert: { avatar_hue?: number; created_at?: string; display_name?: string; id: string; onboarded_at?: string | null; updated_at?: string };
        Update: { avatar_hue?: number; created_at?: string; display_name?: string; id?: string; onboarded_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      parties: {
        Row: { closed: boolean; code: string; created_at: string; expires_at: string; host_id: string; id: string; quest_id: string | null; quest_title: string | null };
        Insert: { closed?: boolean; code: string; created_at?: string; expires_at?: string; host_id: string; id?: string; quest_id?: string | null; quest_title?: string | null };
        Update: { closed?: boolean; code?: string; created_at?: string; expires_at?: string; host_id?: string; id?: string; quest_id?: string | null; quest_title?: string | null };
        Relationships: [];
      };
      party_members: {
        Row: { joined_at: string; party_id: string; ready: boolean; user_id: string };
        Insert: { joined_at?: string; party_id: string; ready?: boolean; user_id: string };
        Update: { joined_at?: string; party_id?: string; ready?: boolean; user_id?: string };
        Relationships: [];
      };
      party_messages: {
        Row: { body: string; created_at: string; id: number; party_id: string; user_id: string };
        Insert: { body: string; created_at?: string; id?: never; party_id: string; user_id: string };
        Update: { body?: string; created_at?: string; id?: never; party_id?: string; user_id?: string };
        Relationships: [];
      };
      visited_landmarks: {
        Row: { first_visited_at: string; landmark_id: string; user_id: string };
        Insert: { first_visited_at?: string; landmark_id: string; user_id: string };
        Update: { first_visited_at?: string; landmark_id?: string; user_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    // Client-callable RPCs. complete_quest awards XP after the app's Gemini photo check.
    // complete_quest_verified stays service-role only and is not called by the app.
    Functions: {
      complete_quest: {
        Args: {
          p_collectible_name: string;
          p_collectible_rarity: string;
          p_collectible_theme: string;
          p_difficulty: string;
          p_landmark_id: string;
          p_landmark_name: string;
          p_mode: string;
          p_party_size: number;
          p_quest_id: string;
          p_quest_title: string;
          p_time_zone: string;
        };
        Returns: Json;
      };
      create_party: { Args: never; Returns: Json };
      get_leaderboard: {
        Args: { p_day?: string; p_kind: string; p_limit?: number };
        Returns: { avatar_hue: number; display_name: string; is_self: boolean; rank: number; value: number }[];
      };
      get_my_rank: {
        Args: { p_day?: string; p_kind: string };
        Returns: { players: number; rank: number; value: number }[];
      };
      get_party_state: { Args: never; Returns: Json };
      join_party: { Args: { p_code: string }; Returns: Json };
      leave_party: { Args: never; Returns: undefined };
      send_party_message: { Args: { p_body: string }; Returns: undefined };
      set_party_quest: { Args: { p_quest_id: string | null; p_quest_title: string | null }; Returns: undefined };
      set_party_ready: { Args: { p_ready: boolean }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
