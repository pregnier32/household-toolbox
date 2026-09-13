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
      dashboard_items: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          priority: string | null
          scheduled_date: string | null
          status: string
          title: string
          tool_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          scheduled_date?: string | null
          status?: string
          title: string
          tool_id: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string
          tool_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      tool_icons: {
        Row: {
          created_at: string | null
          icon_data: string | null
          icon_type: string
          icon_url: string | null
          id: string
          tool_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon_data?: string | null
          icon_type: string
          icon_url?: string | null
          id?: string
          tool_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon_data?: string | null
          icon_type?: string
          icon_url?: string | null
          id?: string
          tool_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_icons_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          short_name: string | null
          status: string
          tool_tip: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
          short_name?: string | null
          status?: string
          tool_tip?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          short_name?: string | null
          status?: string
          tool_tip?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_ab_address_tags: {
        Row: {
          address_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          address_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ab_address_tags_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "tools_ab_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ab_address_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tools_ab_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ab_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          date_added: string
          date_inactivated: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          mailing_name: string
          phone: string
          state: string
          street_address: string
          tool_id: string
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          mailing_name: string
          phone?: string
          state?: string
          street_address?: string
          tool_id: string
          updated_at?: string
          user_id: string
          zip?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          mailing_name?: string
          phone?: string
          state?: string
          street_address?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ab_addresses_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ab_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ab_tags: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ab_tags_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ab_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ce_categories: {
        Row: {
          card_color: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ce_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ce_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ce_events: {
        Row: {
          add_to_dashboard: boolean | null
          category_id: string
          created_at: string | null
          date: string
          date_inactivated: string | null
          day_of_month: number | null
          days_of_week: Json | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          notes: string | null
          time: string | null
          title: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          add_to_dashboard?: boolean | null
          category_id: string
          created_at?: string | null
          date: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          time?: string | null
          title: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          add_to_dashboard?: boolean | null
          category_id?: string
          created_at?: string | null
          date?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          time?: string | null
          title?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ce_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_ce_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ce_events_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ce_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_cs_categories: {
        Row: {
          created_at: string
          icon_key: string | null
          id: string
          is_default: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon_key?: string | null
          id?: string
          is_default?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon_key?: string | null
          id?: string
          is_default?: boolean
          name?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_cs_completions: {
        Row: {
          completed_date: string
          created_at: string
          id: string
          lateness: string
          scheduled_date: string
          task_id: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          id?: string
          lateness: string
          scheduled_date: string
          task_id: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          id?: string
          lateness?: string
          scheduled_date?: string
          task_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tools_cs_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_completions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_cs_default_categories: {
        Row: {
          created_at: string
          display_order: number
          icon_key: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon_key?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon_key?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_cs_default_items: {
        Row: {
          category_name: string
          created_at: string
          description: string
          display_order: number
          id: string
          name: string
          source_key: string
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          name: string
          source_key: string
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          name?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_cs_items: {
        Row: {
          category_id: string
          created_at: string
          description: string
          id: string
          is_default: boolean
          is_hidden: boolean
          name: string
          notes: string
          source_key: string | null
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name: string
          notes?: string
          source_key?: string | null
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name?: string
          notes?: string
          source_key?: string | null
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_cs_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_cs_tasks: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          day_of_month: number | null
          days_of_week: Json | null
          frequency: string
          id: string
          interval_count: number | null
          interval_unit: string | null
          is_active: boolean
          item_id: string
          last_completed_date: string | null
          next_due_date: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          frequency: string
          id?: string
          interval_count?: number | null
          interval_unit?: string | null
          is_active?: boolean
          item_id: string
          last_completed_date?: string | null
          next_due_date: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          frequency?: string
          id?: string
          interval_count?: number | null
          interval_unit?: string | null
          is_active?: boolean
          item_id?: string
          last_completed_date?: string | null
          next_due_date?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "tools_cs_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_tasks_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_categories: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_default_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_ebp_default_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_ebp_event_category_budgets: {
        Row: {
          budget_amount: number
          category_id: string
          created_at: string
          event_id: string
          id: string
          updated_at: string
        }
        Insert: {
          budget_amount: number
          category_id: string
          created_at?: string
          event_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number
          category_id?: string
          created_at?: string
          event_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_event_category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_event_category_budgets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_events"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_events: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          event_date: string
          id: string
          is_active: boolean
          name: string
          notes: string
          tool_id: string
          type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          event_date: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          tool_id: string
          type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          event_date?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          tool_id?: string
          type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_events_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_events_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_expense_splits: {
        Row: {
          amount: number
          created_at: string
          display_order: number
          expense_id: string
          id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          display_order?: number
          expense_id: string
          id?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          display_order?: number
          expense_id?: string
          id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_expense_splits_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          event_id: string
          expense_date: string
          id: string
          note: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          event_id: string
          expense_date: string
          id?: string
          note?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          event_id?: string
          expense_date?: string
          id?: string
          note?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_types: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_types_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_ebp_vendors: {
        Row: {
          contact_person: string
          created_at: string
          date_added: string
          date_inactivated: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          notes: string
          phone: string
          service_provided: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_person?: string
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          phone?: string
          service_provided?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_person?: string
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          phone?: string
          service_provided?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_vendors_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gt_categories: {
        Row: {
          card_color: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gt_default_categories: {
        Row: {
          card_color: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_gt_goals: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          last_update_date: string | null
          percent_complete: number
          priority: string
          reminder_days: number | null
          show_on_dashboard: boolean
          status: string
          target_date: string | null
          title: string
          tool_id: string
          updated_at: string | null
          use_task_progress_for_percent: boolean
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_update_date?: string | null
          percent_complete?: number
          priority?: string
          reminder_days?: number | null
          show_on_dashboard?: boolean
          status?: string
          target_date?: string | null
          title: string
          tool_id: string
          updated_at?: string | null
          use_task_progress_for_percent?: boolean
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_update_date?: string | null
          percent_complete?: number
          priority?: string
          reminder_days?: number | null
          show_on_dashboard?: boolean
          status?: string
          target_date?: string | null
          title?: string
          tool_id?: string
          updated_at?: string | null
          use_task_progress_for_percent?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_goals_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gt_phases: {
        Row: {
          created_at: string | null
          display_order: number
          goal_id: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          goal_id: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          goal_id?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_phases_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gt_tasks: {
        Row: {
          completed: boolean
          created_at: string | null
          goal_id: string
          id: string
          phase_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string | null
          goal_id: string
          id?: string
          phase_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string | null
          goal_id?: string
          id?: string
          phase_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_gt_update_notes: {
        Row: {
          created_at: string | null
          goal_id: string
          id: string
          note: string
          note_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          goal_id: string
          id?: string
          note?: string
          note_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          goal_id?: string
          id?: string
          note?: string
          note_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_update_notes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hcah_default_headers: {
        Row: {
          card_color: string | null
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          card_color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          card_color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_hcah_documents: {
        Row: {
          created_at: string | null
          display_order: number | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          record_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          record_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hcah_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_hcah_records"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hcah_headers: {
        Row: {
          card_color: string | null
          created_at: string | null
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hcah_headers_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hcah_headers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hcah_records: {
        Row: {
          appointment_date: string
          care_facility: string | null
          created_at: string | null
          current_amount_due: string | null
          header_id: string
          id: string
          insurance_paid: string | null
          is_upcoming: boolean
          post_visit_notes: string | null
          pre_visit_notes: string | null
          provider_info: string | null
          reason_for_visit: string | null
          show_on_dashboard_calendar: boolean | null
          tool_id: string
          total_billed: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_date: string
          care_facility?: string | null
          created_at?: string | null
          current_amount_due?: string | null
          header_id: string
          id?: string
          insurance_paid?: string | null
          is_upcoming?: boolean
          post_visit_notes?: string | null
          pre_visit_notes?: string | null
          provider_info?: string | null
          reason_for_visit?: string | null
          show_on_dashboard_calendar?: boolean | null
          tool_id: string
          total_billed?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_date?: string
          care_facility?: string | null
          created_at?: string | null
          current_amount_due?: string | null
          header_id?: string
          id?: string
          insurance_paid?: string | null
          is_upcoming?: boolean
          post_visit_notes?: string | null
          pre_visit_notes?: string | null
          provider_info?: string | null
          reason_for_visit?: string | null
          show_on_dashboard_calendar?: boolean | null
          tool_id?: string
          total_billed?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hcah_records_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "tools_hcah_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hcah_records_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hcah_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hms_categories: {
        Row: {
          created_at: string
          icon_key: string | null
          id: string
          is_default: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon_key?: string | null
          id?: string
          is_default?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon_key?: string | null
          id?: string
          is_default?: boolean
          name?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hms_completions: {
        Row: {
          completed_date: string
          cost: number | null
          created_at: string
          id: string
          lateness: string
          notes: string
          scheduled_date: string
          task_id: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_date: string
          cost?: number | null
          created_at?: string
          id?: string
          lateness: string
          notes?: string
          scheduled_date: string
          task_id: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_date?: string
          cost?: number | null
          created_at?: string
          id?: string
          lateness?: string
          notes?: string
          scheduled_date?: string
          task_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tools_hms_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_completions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hms_default_categories: {
        Row: {
          created_at: string
          display_order: number
          icon_key: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon_key?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon_key?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_hms_default_items: {
        Row: {
          category_name: string
          created_at: string
          default_location: string
          description: string
          display_order: number
          id: string
          name: string
          source_key: string
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          default_location?: string
          description?: string
          display_order?: number
          id?: string
          name: string
          source_key: string
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          default_location?: string
          description?: string
          display_order?: number
          id?: string
          name?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_hms_items: {
        Row: {
          category_id: string
          created_at: string
          default_location: string
          description: string
          id: string
          is_default: boolean
          is_hidden: boolean
          name: string
          notes: string
          source_key: string | null
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          default_location?: string
          description?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name: string
          notes?: string
          source_key?: string | null
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          default_location?: string
          description?: string
          id?: string
          is_default?: boolean
          is_hidden?: boolean
          name?: string
          notes?: string
          source_key?: string | null
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_hms_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hms_tasks: {
        Row: {
          created_at: string
          date_added: string
          date_inactivated: string | null
          day_of_month: number | null
          days_of_week: Json | null
          description_override: string
          frequency: string
          id: string
          interval_count: number | null
          interval_unit: string | null
          interval_years: number | null
          is_active: boolean
          item_id: string
          last_completed_date: string | null
          location: string
          months: Json | null
          next_due_date: string
          notes: string
          provider_name: string
          provider_notes: string
          provider_phone: string
          provider_website: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          description_override?: string
          frequency: string
          id?: string
          interval_count?: number | null
          interval_unit?: string | null
          interval_years?: number | null
          is_active?: boolean
          item_id: string
          last_completed_date?: string | null
          location?: string
          months?: Json | null
          next_due_date: string
          notes?: string
          provider_name?: string
          provider_notes?: string
          provider_phone?: string
          provider_website?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          days_of_week?: Json | null
          description_override?: string
          frequency?: string
          id?: string
          interval_count?: number | null
          interval_unit?: string | null
          interval_years?: number | null
          is_active?: boolean
          item_id?: string
          last_completed_date?: string | null
          location?: string
          months?: Json | null
          next_due_date?: string
          notes?: string
          provider_name?: string
          provider_notes?: string
          provider_phone?: string
          provider_website?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "tools_hms_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_tasks_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hsa_accounts: {
        Row: {
          card_color: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hsa_accounts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hsa_default_accounts: {
        Row: {
          card_color: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          card_color?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_hsa_deposits: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          date: string
          id: string
          is_repeatable: boolean
          name: string
          note: string
          recurrence_end: string | null
          recurrence_frequency: string | null
          recurrence_start: string | null
          source: string
          tax_year: number
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          date: string
          id?: string
          is_repeatable?: boolean
          name: string
          note?: string
          recurrence_end?: string | null
          recurrence_frequency?: string | null
          recurrence_start?: string | null
          source: string
          tax_year: number
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          is_repeatable?: boolean
          name?: string
          note?: string
          recurrence_end?: string | null
          recurrence_frequency?: string | null
          recurrence_start?: string | null
          source?: string
          tax_year?: number
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hsa_deposits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tools_hsa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_deposits_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_hsa_expenses: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string | null
          date: string
          id: string
          name: string
          notes: string
          payment_method: string
          provider_or_store: string
          reimbursed: boolean
          reimbursement_date: string | null
          tool_id: string
          updated_at: string | null
          user_id: string
          warn_until_receipt: boolean
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          created_at?: string | null
          date: string
          id?: string
          name: string
          notes?: string
          payment_method: string
          provider_or_store?: string
          reimbursed?: boolean
          reimbursement_date?: string | null
          tool_id: string
          updated_at?: string | null
          user_id: string
          warn_until_receipt?: boolean
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          notes?: string
          payment_method?: string
          provider_or_store?: string
          reimbursed?: boolean
          reimbursement_date?: string | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
          warn_until_receipt?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tools_hsa_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tools_hsa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_expenses_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_id_document_tags: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_id_document_tags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tools_id_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_id_document_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tools_id_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_id_documents: {
        Row: {
          created_at: string | null
          date_added: string
          date_inactivated: string | null
          document_name: string
          download_password_hash: string | null
          effective_date: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          note: string | null
          requires_password_for_download: boolean | null
          tool_id: string
          updated_at: string | null
          uploaded_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          document_name: string
          download_password_hash?: string | null
          effective_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          note?: string | null
          requires_password_for_download?: boolean | null
          tool_id: string
          updated_at?: string | null
          uploaded_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          document_name?: string
          download_password_hash?: string | null
          effective_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          note?: string | null
          requires_password_for_download?: boolean | null
          tool_id?: string
          updated_at?: string | null
          uploaded_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_id_documents_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_id_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_id_security_questions: {
        Row: {
          answer_hash: string
          created_at: string | null
          document_id: string
          id: string
          question_id: string
          updated_at: string | null
        }
        Insert: {
          answer_hash: string
          created_at?: string | null
          document_id: string
          id?: string
          question_id: string
          updated_at?: string | null
        }
        Update: {
          answer_hash?: string
          created_at?: string | null
          document_id?: string
          id?: string
          question_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_id_security_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tools_id_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_id_tags: {
        Row: {
          created_at: string | null
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean | null
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_id_tags_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_id_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_items: {
        Row: {
          category: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_meal_ingredients: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          item_id: string
          meal_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          item_id: string
          meal_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          item_id?: string
          meal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_meal_ingredients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_meal_types: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_meal_types_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_meal_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_meals: {
        Row: {
          created_at: string | null
          description: string
          difficulty: string | null
          id: string
          instructions: string
          is_active: boolean
          meal_type_id: string | null
          name: string
          prep_time_minutes: number | null
          rating: number
          scale: number
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string
          difficulty?: string | null
          id?: string
          instructions?: string
          is_active?: boolean
          meal_type_id?: string | null
          name: string
          prep_time_minutes?: number | null
          rating?: number
          scale?: number
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          difficulty?: string | null
          id?: string
          instructions?: string
          is_active?: boolean
          meal_type_id?: string | null
          name?: string
          prep_time_minutes?: number | null
          rating?: number
          scale?: number
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_meals_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_meal_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_meals_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_plan_assignments: {
        Row: {
          created_at: string | null
          day_key: string
          display_order: number
          id: string
          is_leftover: boolean
          meal_id: string
          plan_id: string
          slot_key: string | null
        }
        Insert: {
          created_at?: string | null
          day_key: string
          display_order?: number
          id?: string
          is_leftover?: boolean
          meal_id: string
          plan_id: string
          slot_key?: string | null
        }
        Update: {
          created_at?: string | null
          day_key?: string
          display_order?: number
          id?: string
          is_leftover?: boolean
          meal_id?: string
          plan_id?: string
          slot_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_plan_assignments_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_mp_plans: {
        Row: {
          created_at: string | null
          grocery_checked_item_ids: string[]
          id: string
          is_active: boolean
          name: string
          start_date: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          grocery_checked_item_ids?: string[]
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          grocery_checked_item_ids?: string[]
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_plans_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_note_note_tags: {
        Row: {
          created_at: string | null
          id: string
          note_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_note_note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "tools_note_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_note_note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tools_note_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_note_notes: {
        Row: {
          created_at: string | null
          created_date: string
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean | null
          note: string
          note_name: string
          requires_password_for_view: boolean | null
          tool_id: string
          updated_at: string | null
          user_id: string
          view_password_hash: string | null
        }
        Insert: {
          created_at?: string | null
          created_date: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          note: string
          note_name: string
          requires_password_for_view?: boolean | null
          tool_id: string
          updated_at?: string | null
          user_id: string
          view_password_hash?: string | null
        }
        Update: {
          created_at?: string | null
          created_date?: string
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          note?: string
          note_name?: string
          requires_password_for_view?: boolean | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
          view_password_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_note_notes_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_note_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_note_security_questions: {
        Row: {
          answer_hash: string
          created_at: string | null
          id: string
          note_id: string
          question_id: string
          updated_at: string | null
        }
        Insert: {
          answer_hash: string
          created_at?: string | null
          id?: string
          note_id: string
          question_id: string
          updated_at?: string | null
        }
        Update: {
          answer_hash?: string
          created_at?: string | null
          id?: string
          note_id?: string
          question_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_note_security_questions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "tools_note_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_note_tags: {
        Row: {
          created_at: string | null
          date_added: string
          date_inactivated: string | null
          id: string
          is_active: boolean | null
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_note_tags_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_note_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_appointments: {
        Row: {
          add_to_dashboard: boolean | null
          created_at: string | null
          date: string
          id: string
          is_upcoming: boolean | null
          notes: string | null
          pet_id: string
          time: string | null
          type: string
          updated_at: string | null
          veterinarian: string | null
        }
        Insert: {
          add_to_dashboard?: boolean | null
          created_at?: string | null
          date: string
          id?: string
          is_upcoming?: boolean | null
          notes?: string | null
          pet_id: string
          time?: string | null
          type: string
          updated_at?: string | null
          veterinarian?: string | null
        }
        Update: {
          add_to_dashboard?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          is_upcoming?: boolean | null
          notes?: string | null
          pet_id?: string
          time?: string | null
          type?: string
          updated_at?: string | null
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_care_plan_items: {
        Row: {
          add_to_dashboard: boolean | null
          created_at: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          pet_id: string
          priority: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          add_to_dashboard?: boolean | null
          created_at?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          pet_id: string
          priority?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          add_to_dashboard?: boolean | null
          created_at?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          pet_id?: string
          priority?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_care_plan_items_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_documents: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          name: string
          pet_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name: string
          pet_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name?: string
          pet_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_food_entries: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          name: string
          notes: string | null
          pet_id: string
          rating: number | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          name: string
          notes?: string | null
          pet_id: string
          rating?: number | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          name?: string
          notes?: string | null
          pet_id?: string
          rating?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_food_entries_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_notes: {
        Row: {
          content: string
          created_at: string | null
          date: string
          id: string
          is_current: boolean | null
          pet_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          date?: string
          id?: string
          is_current?: boolean | null
          pet_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          date?: string
          id?: string
          is_current?: boolean | null
          pet_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_notes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_pets: {
        Row: {
          birthdate: string | null
          breed: string | null
          card_color: string | null
          color: string | null
          created_at: string | null
          custom_pet_type: string | null
          id: string
          microchip_number: string | null
          name: string
          pet_type: string | null
          tool_id: string
          updated_at: string | null
          user_id: string
          weight: string | null
          where_got_pet: string | null
        }
        Insert: {
          birthdate?: string | null
          breed?: string | null
          card_color?: string | null
          color?: string | null
          created_at?: string | null
          custom_pet_type?: string | null
          id?: string
          microchip_number?: string | null
          name: string
          pet_type?: string | null
          tool_id: string
          updated_at?: string | null
          user_id: string
          weight?: string | null
          where_got_pet?: string | null
        }
        Update: {
          birthdate?: string | null
          breed?: string | null
          card_color?: string | null
          color?: string | null
          created_at?: string | null
          custom_pet_type?: string | null
          id?: string
          microchip_number?: string | null
          name?: string
          pet_type?: string | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
          weight?: string | null
          where_got_pet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_pets_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_pets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_vaccinations: {
        Row: {
          created_at: string | null
          date: string
          id: string
          name: string
          notes: string | null
          pet_id: string
          updated_at: string | null
          veterinarian: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          name: string
          notes?: string | null
          pet_id: string
          updated_at?: string | null
          veterinarian?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          notes?: string | null
          pet_id?: string
          updated_at?: string | null
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_veterinary_records: {
        Row: {
          address: string | null
          clinic_name: string | null
          created_at: string | null
          date_added: string
          email: string | null
          id: string
          notes: string | null
          pet_id: string
          phone: string | null
          status: string
          updated_at: string | null
          veterinarian_name: string | null
        }
        Insert: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string | null
          date_added?: string
          email?: string | null
          id?: string
          notes?: string | null
          pet_id: string
          phone?: string | null
          status?: string
          updated_at?: string | null
          veterinarian_name?: string | null
        }
        Update: {
          address?: string | null
          clinic_name?: string | null
          created_at?: string | null
          date_added?: string
          email?: string | null
          id?: string
          notes?: string | null
          pet_id?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
          veterinarian_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_veterinary_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_rh_default_headers: {
        Row: {
          card_color: string | null
          category_type: string
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          card_color?: string | null
          category_type: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          card_color?: string | null
          category_type?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_rh_default_items: {
        Row: {
          area: string
          category_type: string
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          area: string
          category_type: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          area?: string
          category_type?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_rh_headers: {
        Row: {
          card_color: string | null
          category_type: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string | null
          category_type: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string | null
          category_type?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_rh_headers_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_headers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_rh_items: {
        Row: {
          area: string
          category_type: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area: string
          category_type: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area?: string
          category_type?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_rh_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_rh_records: {
        Row: {
          agent_contact_info: string | null
          amount_insurance_paid: string | null
          claim_notes: string | null
          claim_number: string | null
          cost: string | null
          created_at: string | null
          date: string
          description: string | null
          header_id: string
          id: string
          insurance_carrier: string | null
          item_name: string
          manual_link: string | null
          notes: string | null
          odometer_reading: string | null
          receipt_file_name: string | null
          receipt_file_url: string | null
          service_provider: string | null
          submitted_to_insurance: boolean | null
          tool_id: string
          type: string
          updated_at: string | null
          user_id: string
          warranty_dashboard_item_id: string | null
          warranty_end_date: string | null
          warranty_file_name: string | null
          warranty_file_url: string | null
        }
        Insert: {
          agent_contact_info?: string | null
          amount_insurance_paid?: string | null
          claim_notes?: string | null
          claim_number?: string | null
          cost?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          header_id: string
          id?: string
          insurance_carrier?: string | null
          item_name: string
          manual_link?: string | null
          notes?: string | null
          odometer_reading?: string | null
          receipt_file_name?: string | null
          receipt_file_url?: string | null
          service_provider?: string | null
          submitted_to_insurance?: boolean | null
          tool_id: string
          type: string
          updated_at?: string | null
          user_id: string
          warranty_dashboard_item_id?: string | null
          warranty_end_date?: string | null
          warranty_file_name?: string | null
          warranty_file_url?: string | null
        }
        Update: {
          agent_contact_info?: string | null
          amount_insurance_paid?: string | null
          claim_notes?: string | null
          claim_number?: string | null
          cost?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          header_id?: string
          id?: string
          insurance_carrier?: string | null
          item_name?: string
          manual_link?: string | null
          notes?: string | null
          odometer_reading?: string | null
          receipt_file_name?: string | null
          receipt_file_url?: string | null
          service_provider?: string | null
          submitted_to_insurance?: boolean | null
          tool_id?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          warranty_dashboard_item_id?: string | null
          warranty_end_date?: string | null
          warranty_file_name?: string | null
          warranty_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_rh_records_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "tools_rh_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_records_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_records_warranty_dashboard_item_id_fkey"
            columns: ["warranty_dashboard_item_id"]
            isOneToOne: false
            referencedRelation: "dashboard_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_rh_repair_pictures: {
        Row: {
          created_at: string | null
          display_order: number | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          record_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          record_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_rh_repair_pictures_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_rh_records"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sl_default_items: {
        Row: {
          category: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_sl_items: {
        Row: {
          category: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_sl_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_sl_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sl_list_items: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_checked: boolean
          item_id: string
          list_id: string
          quantity: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_checked?: boolean
          item_id: string
          list_id: string
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_checked?: boolean
          item_id?: string
          list_id?: string
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_sl_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tools_sl_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_sl_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "tools_sl_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_sl_lists: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          list_date: string
          name: string
          show_on_dashboard: boolean
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          list_date: string
          name: string
          show_on_dashboard?: boolean
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          list_date?: string
          name?: string
          show_on_dashboard?: boolean
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_sl_lists_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_sl_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_st_subscriptions: {
        Row: {
          add_reminder_to_calendar: boolean | null
          amount: number
          billed_date: string | null
          calendar_reminder_id: string | null
          category: string
          created_at: string | null
          date_added: string
          date_inactivated: string | null
          day_of_month: number | null
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          renewal_date: string | null
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          add_reminder_to_calendar?: boolean | null
          amount: number
          billed_date?: string | null
          calendar_reminder_id?: string | null
          category: string
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          frequency: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          renewal_date?: string | null
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          add_reminder_to_calendar?: boolean | null
          amount?: number
          billed_date?: string | null
          calendar_reminder_id?: string | null
          category?: string
          created_at?: string | null
          date_added?: string
          date_inactivated?: string | null
          day_of_month?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          renewal_date?: string | null
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_st_subscriptions_calendar_reminder_id_fkey"
            columns: ["calendar_reminder_id"]
            isOneToOne: false
            referencedRelation: "dashboard_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_st_subscriptions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_st_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tdl_categories: {
        Row: {
          card_color: string | null
          created_at: string | null
          id: string
          name: string
          show_on_dashboard: boolean
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          name: string
          show_on_dashboard?: boolean
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          show_on_dashboard?: boolean
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tdl_categories_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tdl_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tdl_default_categories: {
        Row: {
          card_color: string | null
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          card_color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          card_color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tools_tdl_tasks: {
        Row: {
          category_id: string
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          status: string
          task_name: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          task_name: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          task_name?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tdl_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tools_tdl_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tdl_tasks_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tdl_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tl_journal_notes: {
        Row: {
          created_at: string
          id: string
          name: string
          note_date: string
          note_text: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note_date: string
          note_text: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note_date?: string
          note_text?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tl_journal_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "tools_tl_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tl_lodging: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          created_at: string
          id: string
          lodging_type: string | null
          name: string
          notes: string
          rating: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          lodging_type?: string | null
          name: string
          notes?: string
          rating?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          lodging_type?: string | null
          name?: string
          notes?: string
          rating?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tl_lodging_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "tools_tl_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tl_trips: {
        Row: {
          add_to_dashboard: boolean
          best_memory: string
          biggest_surprise: string
          budget_notes: string
          created_at: string
          departure_location: string
          destination: string
          end_date: string
          highlight_of_trip: string
          id: string
          include_in_travel_counts: boolean | null
          number_of_days: number | null
          planned_budget: number | null
          primary_destination: string
          start_date: string
          tool_id: string
          total_trip_cost: number | null
          transportation_methods: string[]
          travel_companions: string
          trip_goal: string | null
          trip_goal_other: string
          trip_name: string
          trip_rating: number
          trip_type: string | null
          updated_at: string
          user_id: string
          would_recommend: string | null
          would_return: string | null
        }
        Insert: {
          add_to_dashboard?: boolean
          best_memory?: string
          biggest_surprise?: string
          budget_notes?: string
          created_at?: string
          departure_location?: string
          destination?: string
          end_date: string
          highlight_of_trip?: string
          id?: string
          include_in_travel_counts?: boolean | null
          number_of_days?: number | null
          planned_budget?: number | null
          primary_destination?: string
          start_date: string
          tool_id: string
          total_trip_cost?: number | null
          transportation_methods?: string[]
          travel_companions?: string
          trip_goal?: string | null
          trip_goal_other?: string
          trip_name: string
          trip_rating?: number
          trip_type?: string | null
          updated_at?: string
          user_id: string
          would_recommend?: string | null
          would_return?: string | null
        }
        Update: {
          add_to_dashboard?: boolean
          best_memory?: string
          biggest_surprise?: string
          budget_notes?: string
          created_at?: string
          departure_location?: string
          destination?: string
          end_date?: string
          highlight_of_trip?: string
          id?: string
          include_in_travel_counts?: boolean | null
          number_of_days?: number | null
          planned_budget?: number | null
          primary_destination?: string
          start_date?: string
          tool_id?: string
          total_trip_cost?: number | null
          transportation_methods?: string[]
          travel_companions?: string
          trip_goal?: string | null
          trip_goal_other?: string
          trip_name?: string
          trip_rating?: number
          trip_type?: string | null
          updated_at?: string
          user_id?: string
          would_recommend?: string | null
          would_return?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_tl_trips_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tl_trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: string
          created_at: string
          email: string
          first_name: string
          guest_admin_id: number | null
          id: string
          last_name: string
          password: string
          theme_preference: string | null
          updated_at: string | null
          user_id: string
          user_status: string
        }
        Insert: {
          active: string
          created_at?: string
          email: string
          first_name: string
          guest_admin_id?: number | null
          id?: string
          last_name: string
          password: string
          theme_preference?: string | null
          updated_at?: string | null
          user_id?: string
          user_status: string
        }
        Update: {
          active?: string
          created_at?: string
          email?: string
          first_name?: string
          guest_admin_id?: number | null
          id?: string
          last_name?: string
          password?: string
          theme_preference?: string | null
          updated_at?: string | null
          user_id?: string
          user_status?: string
        }
        Relationships: []
      }
      users_tools: {
        Row: {
          created_at: string | null
          id: string
          price: number
          status: string
          tool_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          status?: string
          tool_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          status?: string
          tool_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tools_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
    Enums: {},
  },
} as const
