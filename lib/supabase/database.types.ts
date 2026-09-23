export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  finance: {
    Tables: {
      account_balance_snapshots: {
        Row: {
          account_id: string
          account_type: string
          balance: number
          balance_usd: number
          created_at: string
          currency: string
          id: string
          snapshot_date: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_type: string
          balance: number
          balance_usd: number
          created_at?: string
          currency?: string
          id?: string
          snapshot_date: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_type?: string
          balance?: number
          balance_usd?: number
          created_at?: string
          currency?: string
          id?: string
          snapshot_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          asset_class: string | null
          balance: number
          beneficiary_name: string | null
          created_at: string
          credit_limit: number | null
          currency: string | null
          cutoff_date: number | null
          deleted_at: string | null
          due_day: number | null
          expiration_date: string | null
          has_debit_card: boolean | null
          icon: string | null
          id: string
          institution_id: string | null
          interest_rate: number | null
          last_4_digits: string | null
          maturity_date: string | null
          name: string
          original_amount: number | null
          origination_date: string | null
          payment_amount: number | null
          payment_date: number | null
          payment_frequency: string | null
          provider_id: string | null
          term_months: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          asset_class?: string | null
          balance?: number
          beneficiary_name?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string | null
          cutoff_date?: number | null
          deleted_at?: string | null
          due_day?: number | null
          expiration_date?: string | null
          has_debit_card?: boolean | null
          icon?: string | null
          id?: string
          institution_id?: string | null
          interest_rate?: number | null
          last_4_digits?: string | null
          maturity_date?: string | null
          name: string
          original_amount?: number | null
          origination_date?: string | null
          payment_amount?: number | null
          payment_date?: number | null
          payment_frequency?: string | null
          provider_id?: string | null
          term_months?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          asset_class?: string | null
          balance?: number
          beneficiary_name?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string | null
          cutoff_date?: number | null
          deleted_at?: string | null
          due_day?: number | null
          expiration_date?: string | null
          has_debit_card?: boolean | null
          icon?: string | null
          id?: string
          institution_id?: string | null
          interest_rate?: number | null
          last_4_digits?: string | null
          maturity_date?: string | null
          name?: string
          original_amount?: number | null
          origination_date?: string | null
          payment_amount?: number | null
          payment_date?: number | null
          payment_frequency?: string | null
          provider_id?: string | null
          term_months?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "credit_card_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_owners: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          include_in_net_worth: boolean
          name: string
          owner_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          include_in_net_worth?: boolean
          name: string
          owner_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          include_in_net_worth?: boolean
          name?: string
          owner_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_ownerships: {
        Row: {
          asset_account_id: string
          created_at: string
          owner_id: string
          percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_account_id: string
          created_at?: string
          owner_id: string
          percentage: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_account_id?: string
          created_at?: string
          owner_id?: string
          percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_ownerships_asset_account_id_user_id_fkey"
            columns: ["asset_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "asset_ownerships_owner_id_user_id_fkey"
            columns: ["owner_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_owners"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      asset_profiles: {
        Row: {
          account_id: string
          created_at: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_valuations: {
        Row: {
          account_id: string
          created_at: string
          currency: string
          id: string
          included_ownership_percentage: number
          net_worth_value: number
          notes: string | null
          ownership_snapshot: Json
          source: string | null
          total_value: number
          user_id: string
          valued_on: string
        }
        Insert: {
          account_id: string
          created_at?: string
          currency: string
          id?: string
          included_ownership_percentage: number
          net_worth_value: number
          notes?: string | null
          ownership_snapshot?: Json
          source?: string | null
          total_value: number
          user_id: string
          valued_on: string
        }
        Update: {
          account_id?: string
          created_at?: string
          currency?: string
          id?: string
          included_ownership_percentage?: number
          net_worth_value?: number
          notes?: string | null
          ownership_snapshot?: Json
          source?: string | null
          total_value?: number
          user_id?: string
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_valuations_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
      automation_channels: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          paused_at: string | null
          status: string
          telegram_chat_id: number | null
          telegram_link_code: string | null
          telegram_link_code_expires_at: string | null
          telegram_username: string | null
          transactions_logged: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          paused_at?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          telegram_link_code_expires_at?: string | null
          telegram_username?: string | null
          transactions_logged?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          paused_at?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          telegram_link_code_expires_at?: string | null
          telegram_username?: string | null
          transactions_logged?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_monthly_snapshots: {
        Row: {
          budget_id: string
          budgeted_amount: number
          created_at: string
          id: string
          month: string
          user_id: string
        }
        Insert: {
          budget_id: string
          budgeted_amount: number
          created_at?: string
          id?: string
          month: string
          user_id: string
        }
        Update: {
          budget_id?: string
          budgeted_amount?: number
          created_at?: string
          id?: string
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_monthly_snapshots_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          linked_goal_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          linked_goal_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          linked_goal_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_providers: {
        Row: {
          icon: string
          id: string
          name: string
        }
        Insert: {
          icon: string
          id?: string
          name: string
        }
        Update: {
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          id?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category_id: string
          created_at: string
          current_balance: number
          id: string
          linked_account_id: string
          linked_budget_id: string | null
          name: string
          status: string
          target_amount: number
          target_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          current_balance?: number
          id?: string
          linked_account_id: string
          linked_budget_id?: string | null
          name: string
          status?: string
          target_amount: number
          target_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          linked_account_id?: string
          linked_budget_id?: string | null
          name?: string
          status?: string
          target_amount?: number
          target_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_goals_linked_budget"
            columns: ["linked_budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          country: string
          id: string
          logo: string | null
          name: string
        }
        Insert: {
          country?: string
          id?: string
          logo?: string | null
          name: string
        }
        Update: {
          country?: string
          id?: string
          logo?: string | null
          name?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          created_at: string
          default_category_id: string | null
          id: string
          is_global: boolean
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          is_global?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_category_id?: string | null
          id?: string
          is_global?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_telegram_transactions: {
        Row: {
          channel_id: string
          created_at: string
          expires_at: string
          id: string
          missing_fields: string[]
          payload: Json
          status: string
          telegram_chat_id: number
          telegram_message_id: number
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          expires_at?: string
          id?: string
          missing_fields?: string[]
          payload: Json
          status?: string
          telegram_chat_id: number
          telegram_message_id: number
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          missing_fields?: string[]
          payload?: Json
          status?: string
          telegram_chat_id?: number
          telegram_message_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_telegram_transactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "automation_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      private_investment_assets: {
        Row: {
          account_id: string
          company_description: string | null
          company_name: string | null
          cost_basis: number | null
          investment_date: string | null
          investment_name: string | null
          investment_type: string | null
          shares_or_units: number | null
          unit_label: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          account_id: string
          company_description?: string | null
          company_name?: string | null
          cost_basis?: number | null
          investment_date?: string | null
          investment_name?: string | null
          investment_type?: string | null
          shares_or_units?: number | null
          unit_label?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          account_id?: string
          company_description?: string | null
          company_name?: string | null
          cost_basis?: number | null
          investment_date?: string | null
          investment_name?: string | null
          investment_type?: string | null
          shares_or_units?: number | null
          unit_label?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_investment_assets_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
      real_estate_assets: {
        Row: {
          account_id: string
          city: string | null
          country: string | null
          postal_code: string | null
          primary_residence: boolean
          property_type: string | null
          purchase_date: string | null
          purchase_price: number | null
          state_province: string | null
          street: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          city?: string | null
          country?: string | null
          postal_code?: string | null
          primary_residence?: boolean
          property_type?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          state_province?: string | null
          street?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          city?: string | null
          country?: string | null
          postal_code?: string | null
          primary_residence?: boolean
          property_type?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          state_province?: string | null
          street?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_assets_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
      retirement_assets: {
        Row: {
          account_id: string
          account_reference_last4: string | null
          contribution_amount: number | null
          contribution_frequency: string | null
          plan_name: string | null
          plan_type: string | null
          provider_name: string | null
          start_date: string | null
          target_retirement_date: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          account_reference_last4?: string | null
          contribution_amount?: number | null
          contribution_frequency?: string | null
          plan_name?: string | null
          plan_type?: string | null
          provider_name?: string | null
          start_date?: string | null
          target_retirement_date?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          account_reference_last4?: string | null
          contribution_amount?: number | null
          contribution_frequency?: string | null
          plan_name?: string | null
          plan_type?: string | null
          provider_name?: string | null
          start_date?: string | null
          target_retirement_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retirement_assets_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
      telegram_agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          telegram_chat_id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          telegram_chat_id: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          telegram_chat_id?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          asset_activity_kind: string | null
          category_id: string | null
          created_at: string
          currency: string
          date: string
          description: string
          from_account_id: string | null
          goal_id: string | null
          id: string
          merchant_id: string | null
          related_asset_id: string | null
          source: string
          source_app: string
          to_account_id: string | null
          to_amount: number | null
          to_currency: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asset_activity_kind?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string
          from_account_id?: string | null
          goal_id?: string | null
          id?: string
          merchant_id?: string | null
          related_asset_id?: string | null
          source?: string
          source_app?: string
          to_account_id?: string | null
          to_amount?: number | null
          to_currency?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset_activity_kind?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string
          from_account_id?: string | null
          goal_id?: string | null
          id?: string
          merchant_id?: string | null
          related_asset_id?: string | null
          source?: string
          source_app?: string
          to_account_id?: string | null
          to_amount?: number | null
          to_currency?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_asset_id_fkey"
            columns: ["related_asset_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          start_date: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_assets: {
        Row: {
          account_id: string
          current_mileage: number | null
          make: string | null
          mileage_as_of: string | null
          model: string | null
          purchase_date: string | null
          purchase_price: number | null
          user_id: string
          vin: string | null
          year: number | null
        }
        Insert: {
          account_id: string
          current_mileage?: number | null
          make?: string | null
          mileage_as_of?: string | null
          model?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          user_id: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          account_id?: string
          current_mileage?: number | null
          make?: string | null
          mileage_as_of?: string | null
          model?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          user_id?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assets_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "asset_profiles"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_asset: {
        Args: {
          p_category: string
          p_currency: string
          p_current_value: number
          p_details: Json
          p_name: string
          p_notes: string
          p_owners: Json
          p_valuation_source: string
          p_valued_on: string
        }
        Returns: string
      }
      record_asset_valuation: {
        Args: {
          p_account_id: string
          p_notes?: string
          p_source?: string
          p_total_value: number
          p_valued_on: string
        }
        Returns: {
          account_id: string
          created_at: string
          currency: string
          id: string
          included_ownership_percentage: number
          net_worth_value: number
          notes: string | null
          ownership_snapshot: Json
          source: string | null
          total_value: number
          user_id: string
          valued_on: string
        }
        SetofOptions: {
          from: "*"
          to: "asset_valuations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_asset_ownerships: {
        Args: { p_account_id: string; p_owners: Json }
        Returns: undefined
      }
      update_account_balance: {
        Args: { p_account_id: string; p_delta: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      users: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          preferred_language: string
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          preferred_language?: string
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          preferred_language?: string
          subscription_tier?: string
          updated_at?: string
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
  finance: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
