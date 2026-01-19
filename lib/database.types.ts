export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number | null
          color: string | null
          created_at: string | null
          currency: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          color?: string | null
          created_at?: string | null
          currency?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          color?: string | null
          created_at?: string | null
          currency?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          name_es: string
          type: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          name_es: string
          type: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          name_es?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          preferred_language: string | null
          subscription_tier: string | null
          surfing_level: string | null
          updated_at: string | null
          whatsapp_number: string | null
          xp_points: number | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          preferred_language?: string | null
          subscription_tier?: string | null
          surfing_level?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          xp_points?: number | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          preferred_language?: string | null
          subscription_tier?: string | null
          surfing_level?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          xp_points?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          ai_confidence: number | null
          amount: number
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          is_verified: boolean | null
          merchant_name: string | null
          needs_review: boolean | null
          raw_message: string | null
          source: string | null
          transaction_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          ai_confidence?: number | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          merchant_name?: string | null
          needs_review?: boolean | null
          raw_message?: string | null
          source?: string | null
          transaction_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          ai_confidence?: number | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_verified?: boolean | null
          merchant_name?: string | null
          needs_review?: boolean | null
          raw_message?: string | null
          source?: string | null
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          referral_source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          referral_source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          referral_source?: string | null
        }
        Relationships: []
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

// Helper types for easier usage
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

// Convenience types
export type Profile = Tables<"profiles">
export type Account = Tables<"accounts">
export type Category = Tables<"categories">
export type Transaction = Tables<"transactions">
export type WaitlistEntry = Tables<"waitlist">

// Transaction with relations
export type TransactionWithRelations = Transaction & {
  category: Category | null
  account: Account
}

// Surfing levels for gamification
export type SurfingLevel = "kook" | "intermediate" | "performance" | "pro"
export type SubscriptionTier = "free" | "premium"
export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment"
export type TransactionSource = "manual" | "whatsapp" | "email" | "dtes"
export type CategoryType = "income" | "expense"
