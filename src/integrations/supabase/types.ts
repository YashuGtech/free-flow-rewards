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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bans: {
        Row: {
          created_at: string
          handle: string
          id: string
          reason: string
          until: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          reason: string
          until: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          reason?: string
          until?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          action: Database["public"]["Enums"]["task_action"]
          approvers: number
          banned: boolean
          boost_until: string | null
          boosted: boolean
          budget: number
          client_id: string | null
          completions: number
          created_at: string
          created_days_ago: number
          disabled_until: string | null
          id: string
          instructions: string | null
          likes: number
          mode: Database["public"]["Enums"]["ad_mode"]
          platform: Database["public"]["Enums"]["platform"]
          post_id: string | null
          poster: string
          poster_handle: string
          quantity: number
          rating: number | null
          rating_count: number
          reward: number
          spent: number
          status: Database["public"]["Enums"]["campaign_status"]
          success_rate: number | null
          tags: string[]
          target: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          action: Database["public"]["Enums"]["task_action"]
          approvers?: number
          banned?: boolean
          boost_until?: string | null
          boosted?: boolean
          budget?: number
          client_id?: string | null
          completions?: number
          created_at?: string
          created_days_ago?: number
          disabled_until?: string | null
          id?: string
          instructions?: string | null
          likes?: number
          mode?: Database["public"]["Enums"]["ad_mode"]
          platform: Database["public"]["Enums"]["platform"]
          post_id?: string | null
          poster: string
          poster_handle: string
          quantity?: number
          rating?: number | null
          rating_count?: number
          reward?: number
          spent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          success_rate?: number | null
          tags?: string[]
          target: string
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          action?: Database["public"]["Enums"]["task_action"]
          approvers?: number
          banned?: boolean
          boost_until?: string | null
          boosted?: boolean
          budget?: number
          client_id?: string | null
          completions?: number
          created_at?: string
          created_days_ago?: number
          disabled_until?: string | null
          id?: string
          instructions?: string | null
          likes?: number
          mode?: Database["public"]["Enums"]["ad_mode"]
          platform?: Database["public"]["Enums"]["platform"]
          post_id?: string | null
          poster?: string
          poster_handle?: string
          quantity?: number
          rating?: number | null
          rating_count?: number
          reward?: number
          spent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          success_rate?: number | null
          tags?: string[]
          target?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          id: string
          sender: string
          thread_id: string
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          sender: string
          thread_id: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          sender?: string
          thread_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          at: string
          at_label: string | null
          bonus: number
          client_id: string | null
          created_at: string
          id: string
          network: string | null
          owner: string
          payment_url: string
          plan_id: string | null
          purpose: Database["public"]["Enums"]["deposit_purpose"]
          sandbox: boolean
          status: string
          track_id: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          at?: string
          at_label?: string | null
          bonus?: number
          client_id?: string | null
          created_at?: string
          id?: string
          network?: string | null
          owner?: string
          payment_url: string
          plan_id?: string | null
          purpose?: Database["public"]["Enums"]["deposit_purpose"]
          sandbox?: boolean
          status?: string
          track_id: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          at?: string
          at_label?: string | null
          bonus?: number
          client_id?: string | null
          created_at?: string
          id?: string
          network?: string | null
          owner?: string
          payment_url?: string
          plan_id?: string | null
          purpose?: Database["public"]["Enums"]["deposit_purpose"]
          sandbox?: boolean
          status?: string
          track_id?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          at: string
          at_label: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          owner: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          at?: string
          at_label?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner?: string
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          at?: string
          at_label?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          five_star_gives: number
          followers: number
          following: number
          four_star_gives: number
          handle: string
          id: string
          is_premium: boolean
          is_you: boolean
          name: string
          premium_expiry: string | null
          premium_plan_id: string | null
          rating: number
          rating_count: number
          referrals_locked: boolean
          success_rate: number
          tasks_done: number
          tg: string | null
          tier: Database["public"]["Enums"]["tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          five_star_gives?: number
          followers?: number
          following?: number
          four_star_gives?: number
          handle: string
          id?: string
          is_premium?: boolean
          is_you?: boolean
          name: string
          premium_expiry?: string | null
          premium_plan_id?: string | null
          rating?: number
          rating_count?: number
          referrals_locked?: boolean
          success_rate?: number
          tasks_done?: number
          tg?: string | null
          tier?: Database["public"]["Enums"]["tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          five_star_gives?: number
          followers?: number
          following?: number
          four_star_gives?: number
          handle?: string
          id?: string
          is_premium?: boolean
          is_you?: boolean
          name?: string
          premium_expiry?: string | null
          premium_plan_id?: string | null
          rating?: number
          rating_count?: number
          referrals_locked?: boolean
          success_rate?: number
          tasks_done?: number
          tg?: string | null
          tier?: Database["public"]["Enums"]["tier"]
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          at: string
          at_label: string | null
          client_id: string | null
          handle: string
          id: string
          owner: string
        }
        Insert: {
          at?: string
          at_label?: string | null
          client_id?: string | null
          handle: string
          id?: string
          owner?: string
        }
        Update: {
          at?: string
          at_label?: string | null
          client_id?: string | null
          handle?: string
          id?: string
          owner?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          at: string
          by: string
          id: string
          reason: string
          target: string
        }
        Insert: {
          at?: string
          by: string
          id?: string
          reason: string
          target: string
        }
        Update: {
          at?: string
          by?: string
          id?: string
          reason?: string
          target?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          at_label: string | null
          at_ms: number | null
          ban_until: string | null
          client_id: string
          created_at: string
          handle: string
          id: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          at_label?: string | null
          at_ms?: number | null
          ban_until?: string | null
          client_id: string
          created_at?: string
          handle: string
          id?: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          at_label?: string | null
          at_ms?: number | null
          ban_until?: string | null
          client_id?: string
          created_at?: string
          handle?: string
          id?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          action: Database["public"]["Enums"]["task_action"]
          client_id: string | null
          created_at: string
          credited: boolean
          handle: string
          id: string
          link: string | null
          mode: Database["public"]["Enums"]["ad_mode"]
          name: string
          note: string | null
          platform: Database["public"]["Enums"]["platform"]
          poster: string
          poster_handle: string
          proof: string
          rated: boolean
          reason: string | null
          reward: number
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string
          submitted_at_label: string | null
          target: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["task_action"]
          client_id?: string | null
          created_at?: string
          credited?: boolean
          handle: string
          id?: string
          link?: string | null
          mode?: Database["public"]["Enums"]["ad_mode"]
          name: string
          note?: string | null
          platform: Database["public"]["Enums"]["platform"]
          poster: string
          poster_handle: string
          proof: string
          rated?: boolean
          reason?: string | null
          reward?: number
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string
          submitted_at_label?: string | null
          target: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["task_action"]
          client_id?: string | null
          created_at?: string
          credited?: boolean
          handle?: string
          id?: string
          link?: string | null
          mode?: Database["public"]["Enums"]["ad_mode"]
          name?: string
          note?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          poster?: string
          poster_handle?: string
          proof?: string
          rated?: boolean
          reason?: string | null
          reward?: number
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string
          submitted_at_label?: string | null
          target?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          action: Database["public"]["Enums"]["task_action"]
          banned: boolean
          boost_until: string | null
          boosted: boolean
          client_id: string | null
          completions: number
          created_at: string
          id: string
          instructions: string | null
          likes: number
          limit: number
          minutes_ago: number
          mode: Database["public"]["Enums"]["ad_mode"]
          platform: Database["public"]["Enums"]["platform"]
          post_id: string | null
          poster: string
          poster_handle: string
          rating: number | null
          rating_count: number
          reward: number
          success_rate: number | null
          tags: string[]
          target: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          action: Database["public"]["Enums"]["task_action"]
          banned?: boolean
          boost_until?: string | null
          boosted?: boolean
          client_id?: string | null
          completions?: number
          created_at?: string
          id?: string
          instructions?: string | null
          likes?: number
          limit?: number
          minutes_ago?: number
          mode?: Database["public"]["Enums"]["ad_mode"]
          platform: Database["public"]["Enums"]["platform"]
          post_id?: string | null
          poster: string
          poster_handle: string
          rating?: number | null
          rating_count?: number
          reward?: number
          success_rate?: number | null
          tags?: string[]
          target: string
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          action?: Database["public"]["Enums"]["task_action"]
          banned?: boolean
          boost_until?: string | null
          boosted?: boolean
          client_id?: string | null
          completions?: number
          created_at?: string
          id?: string
          instructions?: string | null
          likes?: number
          limit?: number
          minutes_ago?: number
          mode?: Database["public"]["Enums"]["ad_mode"]
          platform?: Database["public"]["Enums"]["platform"]
          post_id?: string | null
          poster?: string
          poster_handle?: string
          rating?: number | null
          rating_count?: number
          reward?: number
          success_rate?: number | null
          tags?: string[]
          target?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          date: string
          date_label: string | null
          id: string
          label: string
          meta: string | null
          owner: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          date?: string
          date_label?: string | null
          id?: string
          label: string
          meta?: string | null
          owner?: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          date_label?: string | null
          id?: string
          label?: string
          meta?: string | null
          owner?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: []
      }
      user_ratings: {
        Row: {
          count: number
          created_at: string
          handle: string
          id: string
          rating: number
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          handle: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          handle?: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          address: string
          amount: number
          at: string
          at_label: string | null
          client_id: string | null
          created_at: string
          demo: boolean
          id: string
          network: string | null
          owner: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          track_id: string | null
        }
        Insert: {
          address: string
          amount: number
          at?: string
          at_label?: string | null
          client_id?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          network?: string | null
          owner?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          track_id?: string | null
        }
        Update: {
          address?: string
          amount?: number
          at?: string
          at_label?: string | null
          client_id?: string | null
          created_at?: string
          demo?: boolean
          id?: string
          network?: string | null
          owner?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          track_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_user: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_own: { Args: { v: string }; Returns: boolean }
    }
    Enums: {
      ad_mode: "paid" | "referral"
      campaign_status: "active" | "paused" | "completed"
      claim_status: "pending" | "approved" | "rejected"
      deposit_purpose: "deposit" | "premium"
      notification_type:
        | "follow"
        | "new_ad"
        | "claim"
        | "report"
        | "referral"
        | "system"
        | "withdraw"
      platform:
        | "Instagram"
        | "Telegram"
        | "YouTube"
        | "Twitter"
        | "TikTok"
        | "Play Store"
        | "App Store"
        | "Browser"
      task_action:
        | "Follow"
        | "Like"
        | "Subscribe"
        | "Retweet"
        | "Join"
        | "View"
        | "Comment"
        | "Referral"
        | "Install"
        | "Download"
        | "Rate"
        | "Visit"
      tier: "Bronze" | "Silver" | "Gold" | "Platinum"
      transaction_type:
        | "earn"
        | "spend"
        | "reject"
        | "referral"
        | "deposit"
        | "withdraw"
        | "premium"
        | "bonus"
      trend: "up" | "down" | "flat"
      withdrawal_status: "pending" | "done"
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
    Enums: {
      ad_mode: ["paid", "referral"],
      campaign_status: ["active", "paused", "completed"],
      claim_status: ["pending", "approved", "rejected"],
      deposit_purpose: ["deposit", "premium"],
      notification_type: [
        "follow",
        "new_ad",
        "claim",
        "report",
        "referral",
        "system",
        "withdraw",
      ],
      platform: [
        "Instagram",
        "Telegram",
        "YouTube",
        "Twitter",
        "TikTok",
        "Play Store",
        "App Store",
        "Browser",
      ],
      task_action: [
        "Follow",
        "Like",
        "Subscribe",
        "Retweet",
        "Join",
        "View",
        "Comment",
        "Referral",
        "Install",
        "Download",
        "Rate",
        "Visit",
      ],
      tier: ["Bronze", "Silver", "Gold", "Platinum"],
      transaction_type: [
        "earn",
        "spend",
        "reject",
        "referral",
        "deposit",
        "withdraw",
        "premium",
        "bonus",
      ],
      trend: ["up", "down", "flat"],
      withdrawal_status: ["pending", "done"],
    },
  },
} as const
