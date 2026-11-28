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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          infinite_handle: string
          model: string
          prices: Json
          render_engine: string
          render_url: string
          sales_enabled: boolean
        }
        Insert: {
          id?: boolean
          infinite_handle?: string
          model?: string
          prices?: Json
          render_engine?: string
          render_url?: string
          sales_enabled?: boolean
        }
        Update: {
          id?: boolean
          infinite_handle?: string
          model?: string
          prices?: Json
          render_engine?: string
          render_url?: string
          sales_enabled?: boolean
        }
        Relationships: []
      }
      customer_projects: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          kind: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          calls: number
          created_at: string
          credits: number
          id: string
          project_id: string
          seconds: number
          status: string
          trial: boolean
          user_id: string
        }
        Insert: {
          calls?: number
          created_at?: string
          credits?: number
          id?: string
          project_id: string
          seconds: number
          status?: string
          trial?: boolean
          user_id: string
        }
        Update: {
          calls?: number
          created_at?: string
          credits?: number
          id?: string
          project_id?: string
          seconds?: number
          status?: string
          trial?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_check_keys: {
        Row: {
          key_hash: string
          order_id: string
        }
        Insert: {
          key_hash: string
          order_id: string
        }
        Update: {
          key_hash?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_check_keys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          check_until: string
          checkout_url: string | null
          created_at: string
          credits: number
          id: string
          paid_at: string | null
          plan: string
          slug: string | null
          status: string
          transaction_nsu: string | null
          user_id: string
        }
        Insert: {
          amount: number
          check_until?: string
          checkout_url?: string | null
          created_at?: string
          credits: number
          id?: string
          paid_at?: string | null
          plan: string
          slug?: string | null
          status?: string
          transaction_nsu?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          check_until?: string
          checkout_url?: string | null
          created_at?: string
          credits?: number
          id?: string
          paid_at?: string | null
          plan?: string
          slug?: string | null
          status?: string
          transaction_nsu?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_settings: {
        Row: {
          id: boolean
          openai_encrypted: string
        }
        Insert: {
          id?: boolean
          openai_encrypted?: string
        }
        Update: {
          id?: boolean
          openai_encrypted?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          whatsapp?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          whatsapp?: string
        }
        Relationships: []
      }
      saas_accounts: {
        Row: {
          credits: number
          plan: string
          trial_seconds: number
          user_id: string
        }
        Insert: {
          credits?: number
          plan?: string
          trial_seconds?: number
          user_id: string
        }
        Update: {
          credits?: number
          plan?: string
          trial_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_claims: {
        Row: {
          code_id: string
          created_at: string
          id: string
          ip_hash: string
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          ip_hash: string
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          ip_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_claims_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "trial_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_codes: {
        Row: {
          code: string
          created_at: string
          enabled: boolean
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
        }
        Relationships: []
      }
      usage_costs: {
        Row: {
          cached_input_tokens: number
          created_at: string
          generation_id: string | null
          id: string
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          project_id: string
          stage: string
          units: number
          user_id: string
        }
        Insert: {
          cached_input_tokens?: number
          created_at?: string
          generation_id?: string | null
          id?: string
          input_tokens?: number
          kind: string
          model: string
          output_tokens?: number
          project_id: string
          stage: string
          units?: number
          user_id: string
        }
        Update: {
          cached_input_tokens?: number
          created_at?: string
          generation_id?: string | null
          id?: string
          input_tokens?: number
          kind?: string
          model?: string
          output_tokens?: number
          project_id?: string
          stage?: string
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_costs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_costs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cost_totals: { Args: never; Returns: Json }
      admin_customer_costs: {
        Args: { p_offset?: number }
        Returns: {
          generations: number
          total_usd: number
          trial_generations: number
          trial_usd: number
          user_id: string
        }[]
      }
      admin_summary: { Args: never; Returns: Json }
      claim_trial: {
        Args: { p_code: string; p_ip: string; p_user: string }
        Returns: undefined
      }
      confirm_order: {
        Args: { p_id: string; p_slug: string; p_transaction: string }
        Returns: boolean
      }
      finish_generation: {
        Args: { p_failed: boolean; p_project: string; p_user: string }
        Returns: undefined
      }
      generation_call: {
        Args: { p_project: string; p_user: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reserve_generation: {
        Args: { p_project: string; p_seconds: number; p_user: string }
        Returns: string
      }
      usage_cost_usd: {
        Args: {
          c: Database["public"]["Tables"]["usage_costs"]["Row"]
          s: Database["public"]["Tables"]["app_settings"]["Row"]
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
