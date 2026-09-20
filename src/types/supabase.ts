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
      calendar_pins: {
        Row: {
          created_at: string
          id: string
          pin_kind: string
          source_id: string
          source_type: string
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_kind?: string
          source_id: string
          source_type: string
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_kind?: string
          source_id?: string
          source_type?: string
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_pins_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_pins_user_id_fkey"
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
      tools_ab_address_attachments: {
        Row: {
          address_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          address_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ab_address_attachments_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "tools_ab_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ab_address_attachments_user_id_fkey"
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
      tools_ce_event_attachments: {
        Row: {
          created_at: string
          event_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ce_event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tools_ce_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ce_event_attachments_user_id_fkey"
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
          date_inactivated: string | null
          icon_key: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_inactivated?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_inactivated?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean
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
      tools_cs_completion_attachments: {
        Row: {
          completion_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          completion_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          completion_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_completion_attachments_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "tools_cs_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_completion_attachments_user_id_fkey"
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
      tools_cs_item_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_cs_item_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tools_cs_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_cs_item_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          reminder_days: number | null
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
          reminder_days?: number | null
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
          reminder_days?: number | null
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
      tools_ebp_event_attachments: {
        Row: {
          created_at: string
          event_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_event_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      tools_ebp_expense_attachments: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_ebp_expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "tools_ebp_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_ebp_expense_attachments_user_id_fkey"
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
      tools_eolp_bank_accounts: {
        Row: {
          account_type: string
          bank_contact: string
          beneficiary: string
          created_at: string
          display_order: number
          id: string
          institution: string
          joint_owner: string
          last_four: string
          login_storage: string
          owners: string
          plan_id: string
          purpose: string
          tool_id: string
          updated_at: string
          user_id: string
          website: string
        }
        Insert: {
          account_type?: string
          bank_contact?: string
          beneficiary?: string
          created_at?: string
          display_order?: number
          id?: string
          institution?: string
          joint_owner?: string
          last_four?: string
          login_storage?: string
          owners?: string
          plan_id: string
          purpose?: string
          tool_id: string
          updated_at?: string
          user_id: string
          website?: string
        }
        Update: {
          account_type?: string
          bank_contact?: string
          beneficiary?: string
          created_at?: string
          display_order?: number
          id?: string
          institution?: string
          joint_owner?: string
          last_four?: string
          login_storage?: string
          owners?: string
          plan_id?: string
          purpose?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_bank_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_bank_accounts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_contacts: {
        Row: {
          address: string
          alternate_phone: string
          company: string
          contact_type: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          plan_id: string
          priority: number
          relationship: string
          section_id: string | null
          tool_id: string
          updated_at: string
          user_id: string
          why_contact: string
        }
        Insert: {
          address?: string
          alternate_phone?: string
          company?: string
          contact_type?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          plan_id: string
          priority?: number
          relationship?: string
          section_id?: string | null
          tool_id: string
          updated_at?: string
          user_id: string
          why_contact?: string
        }
        Update: {
          address?: string
          alternate_phone?: string
          company?: string
          contact_type?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          plan_id?: string
          priority?: number
          relationship?: string
          section_id?: string | null
          tool_id?: string
          updated_at?: string
          user_id?: string
          why_contact?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_contacts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_contacts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_contacts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_credit_cards: {
        Row: {
          authorized_users: string
          automatic_payments: string
          balance_notes: string
          card_type: string
          closing_instructions: string
          created_at: string
          display_order: number
          id: string
          issuer: string
          last_four: string
          plan_id: string
          primary_holder: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorized_users?: string
          automatic_payments?: string
          balance_notes?: string
          card_type?: string
          closing_instructions?: string
          created_at?: string
          display_order?: number
          id?: string
          issuer?: string
          last_four?: string
          plan_id: string
          primary_holder?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorized_users?: string
          automatic_payments?: string
          balance_notes?: string
          card_type?: string
          closing_instructions?: string
          created_at?: string
          display_order?: number
          id?: string
          issuer?: string
          last_four?: string
          plan_id?: string
          primary_holder?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_credit_cards_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_credit_cards_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_credit_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_debts: {
        Row: {
          account_reference: string
          approximate_balance: string
          automatic_payment: string
          collateral: string
          contact: string
          created_at: string
          creditor: string
          debt_type: string
          display_order: number
          id: string
          monthly_payment: string
          plan_id: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_reference?: string
          approximate_balance?: string
          automatic_payment?: string
          collateral?: string
          contact?: string
          created_at?: string
          creditor?: string
          debt_type?: string
          display_order?: number
          id?: string
          monthly_payment?: string
          plan_id: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_reference?: string
          approximate_balance?: string
          automatic_payment?: string
          collateral?: string
          contact?: string
          created_at?: string
          creditor?: string
          debt_type?: string
          display_order?: number
          id?: string
          monthly_payment?: string
          plan_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_debts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_debts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_debts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_default_next_steps: {
        Row: {
          created_at: string
          display_order: number
          id: string
          priority: string
          seed_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          priority: string
          seed_key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          priority?: string
          seed_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tools_eolp_devices: {
        Row: {
          access_instructions: string
          associated_account: string
          created_at: string
          device_type: string
          id: string
          location: string
          manufacturer: string
          model: string
          name: string
          password_secret: string
          pin_secret: string
          plan_id: string
          recovery_key_secret: string
          section_id: string | null
          stored_information: string
          tool_id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          access_instructions?: string
          associated_account?: string
          created_at?: string
          device_type?: string
          id?: string
          location?: string
          manufacturer?: string
          model?: string
          name?: string
          password_secret?: string
          pin_secret?: string
          plan_id: string
          recovery_key_secret?: string
          section_id?: string | null
          stored_information?: string
          tool_id: string
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          access_instructions?: string
          associated_account?: string
          created_at?: string
          device_type?: string
          id?: string
          location?: string
          manufacturer?: string
          model?: string
          name?: string
          password_secret?: string
          pin_secret?: string
          plan_id?: string
          recovery_key_secret?: string
          section_id?: string | null
          stored_information?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_devices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_devices_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_devices_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_document_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_document_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_documents: {
        Row: {
          attorney_contact: string
          created_at: string
          date_created: string | null
          digital_location: string
          document_type: string
          expiration_date: string | null
          id: string
          last_updated: string | null
          name: string
          original_or_copy: string
          physical_location: string
          plan_id: string
          section_id: string | null
          special_instructions: string
          tool_id: string
          updated_at: string
          user_id: string
          who_has_copy: string
        }
        Insert: {
          attorney_contact?: string
          created_at?: string
          date_created?: string | null
          digital_location?: string
          document_type?: string
          expiration_date?: string | null
          id?: string
          last_updated?: string | null
          name?: string
          original_or_copy?: string
          physical_location?: string
          plan_id: string
          section_id?: string | null
          special_instructions?: string
          tool_id: string
          updated_at?: string
          user_id: string
          who_has_copy?: string
        }
        Update: {
          attorney_contact?: string
          created_at?: string
          date_created?: string | null
          digital_location?: string
          document_type?: string
          expiration_date?: string | null
          id?: string
          last_updated?: string | null
          name?: string
          original_or_copy?: string
          physical_location?: string
          plan_id?: string
          section_id?: string | null
          special_instructions?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          who_has_copy?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_documents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_documents_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_documents_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_eol_wishes: {
        Row: {
          ashes_instructions: string
          casket_preference: string
          cemetery: string
          cemetery_plot: string
          clergy: string
          clothing_preference: string
          created_at: string
          disposition_preference: string
          flowers_preference: string
          funeral_contract_location: string
          funeral_home: string
          funeral_home_contact: string
          funeral_service_desired: string
          headstone_wishes: string
          id: string
          memorial_donation: string
          memorial_service_desired: string
          military_honors: string
          obituary_wishes: string
          organ_donation_wishes: string
          organizations_to_notify: string
          pallbearer_preferences: string
          paperwork_location: string
          people_to_notify: string
          plan_id: string
          preferred_location: string
          preferred_music: string
          preferred_readings: string
          preferred_speakers: string
          prepaid_arrangements: string
          religious_service: string
          tool_id: string
          updated_at: string
          user_id: string
          viewing: string
        }
        Insert: {
          ashes_instructions?: string
          casket_preference?: string
          cemetery?: string
          cemetery_plot?: string
          clergy?: string
          clothing_preference?: string
          created_at?: string
          disposition_preference?: string
          flowers_preference?: string
          funeral_contract_location?: string
          funeral_home?: string
          funeral_home_contact?: string
          funeral_service_desired?: string
          headstone_wishes?: string
          id?: string
          memorial_donation?: string
          memorial_service_desired?: string
          military_honors?: string
          obituary_wishes?: string
          organ_donation_wishes?: string
          organizations_to_notify?: string
          pallbearer_preferences?: string
          paperwork_location?: string
          people_to_notify?: string
          plan_id: string
          preferred_location?: string
          preferred_music?: string
          preferred_readings?: string
          preferred_speakers?: string
          prepaid_arrangements?: string
          religious_service?: string
          tool_id: string
          updated_at?: string
          user_id: string
          viewing?: string
        }
        Update: {
          ashes_instructions?: string
          casket_preference?: string
          cemetery?: string
          cemetery_plot?: string
          clergy?: string
          clothing_preference?: string
          created_at?: string
          disposition_preference?: string
          flowers_preference?: string
          funeral_contract_location?: string
          funeral_home?: string
          funeral_home_contact?: string
          funeral_service_desired?: string
          headstone_wishes?: string
          id?: string
          memorial_donation?: string
          memorial_service_desired?: string
          military_honors?: string
          obituary_wishes?: string
          organ_donation_wishes?: string
          organizations_to_notify?: string
          pallbearer_preferences?: string
          paperwork_location?: string
          people_to_notify?: string
          plan_id?: string
          preferred_location?: string
          preferred_music?: string
          preferred_readings?: string
          preferred_speakers?: string
          prepaid_arrangements?: string
          religious_service?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          viewing?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_eol_wishes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_eol_wishes_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_eol_wishes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_family_members: {
        Row: {
          contact_info: string
          created_at: string
          display_order: number
          id: string
          name: string
          personal_block_id: string | null
          plan_id: string
          relationship: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_info?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          personal_block_id?: string | null
          plan_id: string
          relationship?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_info?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          personal_block_id?: string | null
          plan_id?: string
          relationship?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_family_members_personal_block_id_fkey"
            columns: ["personal_block_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_personal_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_family_members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_family_members_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_home: {
        Row: {
          address: string
          alarm_information_secret: string
          camera_information: string
          created_at: string
          deed_location: string
          garage_code_secret: string
          homeowners_insurance: string
          id: string
          mailbox_information: string
          monthly_payment: string
          mortgage_balance: string
          mortgage_company: string
          mortgage_reference: string
          other_owners: string
          ownership_type: string
          plan_id: string
          property_tax: string
          safe_instructions_secret: string
          safe_location: string
          spare_key_location: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          alarm_information_secret?: string
          camera_information?: string
          created_at?: string
          deed_location?: string
          garage_code_secret?: string
          homeowners_insurance?: string
          id?: string
          mailbox_information?: string
          monthly_payment?: string
          mortgage_balance?: string
          mortgage_company?: string
          mortgage_reference?: string
          other_owners?: string
          ownership_type?: string
          plan_id: string
          property_tax?: string
          safe_instructions_secret?: string
          safe_location?: string
          spare_key_location?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          alarm_information_secret?: string
          camera_information?: string
          created_at?: string
          deed_location?: string
          garage_code_secret?: string
          homeowners_insurance?: string
          id?: string
          mailbox_information?: string
          monthly_payment?: string
          mortgage_balance?: string
          mortgage_company?: string
          mortgage_reference?: string
          other_owners?: string
          ownership_type?: string
          plan_id?: string
          property_tax?: string
          safe_instructions_secret?: string
          safe_location?: string
          spare_key_location?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_home_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_home_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_home_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_income_sources: {
        Row: {
          amount_frequency: string
          contact: string
          created_at: string
          deposited_where: string
          display_order: number
          id: string
          income_type: string
          plan_id: string
          survivor_benefits: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_frequency?: string
          contact?: string
          created_at?: string
          deposited_where?: string
          display_order?: number
          id?: string
          income_type?: string
          plan_id: string
          survivor_benefits?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_frequency?: string
          contact?: string
          created_at?: string
          deposited_where?: string
          display_order?: number
          id?: string
          income_type?: string
          plan_id?: string
          survivor_benefits?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_income_sources_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_income_sources_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_income_sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_insurance_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          insurance_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          insurance_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          insurance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_insurance_attachments_insurance_id_fkey"
            columns: ["insurance_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_insurance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_insurance_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_insurance: {
        Row: {
          agent: string
          agent_contact: string
          automatic_payment: string
          beneficiary: string
          claim_contact: string
          company: string
          coverage_amount: string
          created_at: string
          document_location: string
          expiration_renewal: string
          id: string
          instructions: string
          insured_person: string
          payment_account: string
          payment_frequency: string
          plan_id: string
          policy_number: string
          policy_type: string
          policyholder: string
          premium: string
          section_id: string | null
          tool_id: string
          updated_at: string
          user_id: string
          website: string
        }
        Insert: {
          agent?: string
          agent_contact?: string
          automatic_payment?: string
          beneficiary?: string
          claim_contact?: string
          company?: string
          coverage_amount?: string
          created_at?: string
          document_location?: string
          expiration_renewal?: string
          id?: string
          instructions?: string
          insured_person?: string
          payment_account?: string
          payment_frequency?: string
          plan_id: string
          policy_number?: string
          policy_type?: string
          policyholder?: string
          premium?: string
          section_id?: string | null
          tool_id: string
          updated_at?: string
          user_id: string
          website?: string
        }
        Update: {
          agent?: string
          agent_contact?: string
          automatic_payment?: string
          beneficiary?: string
          claim_contact?: string
          company?: string
          coverage_amount?: string
          created_at?: string
          document_location?: string
          expiration_renewal?: string
          id?: string
          instructions?: string
          insured_person?: string
          payment_account?: string
          payment_frequency?: string
          plan_id?: string
          policy_number?: string
          policy_type?: string
          policyholder?: string
          premium?: string
          section_id?: string | null
          tool_id?: string
          updated_at?: string
          user_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_insurance_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_insurance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_insurance_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_insurance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_investments: {
        Row: {
          account_reference: string
          account_type: string
          advisor: string
          beneficiaries: string
          created_at: string
          display_order: number
          id: string
          institution: string
          owner: string
          plan_id: string
          tool_id: string
          updated_at: string
          user_id: string
          website_login: string
        }
        Insert: {
          account_reference?: string
          account_type?: string
          advisor?: string
          beneficiaries?: string
          created_at?: string
          display_order?: number
          id?: string
          institution?: string
          owner?: string
          plan_id: string
          tool_id: string
          updated_at?: string
          user_id: string
          website_login?: string
        }
        Update: {
          account_reference?: string
          account_type?: string
          advisor?: string
          beneficiaries?: string
          created_at?: string
          display_order?: number
          id?: string
          institution?: string
          owner?: string
          plan_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          website_login?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_investments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_investments_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_investments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_letter_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          letter_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          letter_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          letter_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_letter_attachments_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_letter_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_letters: {
        Row: {
          body_secret: string
          created_at: string
          id: string
          instructions: string
          last_updated: string
          letter_type: string
          plan_id: string
          recipient: string
          section_id: string | null
          status: string
          title: string
          tool_id: string
          updated_at: string
          user_id: string
          visibility: string
          when_to_share: string
        }
        Insert: {
          body_secret?: string
          created_at?: string
          id?: string
          instructions?: string
          last_updated?: string
          letter_type?: string
          plan_id: string
          recipient?: string
          section_id?: string | null
          status?: string
          title?: string
          tool_id: string
          updated_at?: string
          user_id: string
          visibility?: string
          when_to_share?: string
        }
        Update: {
          body_secret?: string
          created_at?: string
          id?: string
          instructions?: string
          last_updated?: string
          letter_type?: string
          plan_id?: string
          recipient?: string
          section_id?: string | null
          status?: string
          title?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          visibility?: string
          when_to_share?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_letters_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_letters_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_letters_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_letters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_my_wishes: {
        Row: {
          charitable_wishes: string
          collections: string
          created_at: string
          digital_media: string
          do_not_want: string
          family_to_know: string
          id: string
          important_organizations: string
          most_important: string
          online_presence: string
          personal_files: string
          pets_care: string
          phone_computer: string
          plan_id: string
          social_media: string
          special_belongings: string
          specific_gifts: string
          thanked_remembered: string
          tool_id: string
          traditions: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charitable_wishes?: string
          collections?: string
          created_at?: string
          digital_media?: string
          do_not_want?: string
          family_to_know?: string
          id?: string
          important_organizations?: string
          most_important?: string
          online_presence?: string
          personal_files?: string
          pets_care?: string
          phone_computer?: string
          plan_id: string
          social_media?: string
          special_belongings?: string
          specific_gifts?: string
          thanked_remembered?: string
          tool_id: string
          traditions?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charitable_wishes?: string
          collections?: string
          created_at?: string
          digital_media?: string
          do_not_want?: string
          family_to_know?: string
          id?: string
          important_organizations?: string
          most_important?: string
          online_presence?: string
          personal_files?: string
          pets_care?: string
          phone_computer?: string
          plan_id?: string
          social_media?: string
          special_belongings?: string
          specific_gifts?: string
          thanked_remembered?: string
          tool_id?: string
          traditions?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_my_wishes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_my_wishes_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_my_wishes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_next_steps: {
        Row: {
          created_at: string
          display_order: number
          id: string
          instructions: string
          is_hidden: boolean
          is_predefined: boolean
          person_responsible: string
          plan_id: string
          priority: string
          related_contact_id: string | null
          related_document: string
          seed_key: string | null
          status: string
          title: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          instructions?: string
          is_hidden?: boolean
          is_predefined?: boolean
          person_responsible?: string
          plan_id: string
          priority?: string
          related_contact_id?: string | null
          related_document?: string
          seed_key?: string | null
          status?: string
          title?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          instructions?: string
          is_hidden?: boolean
          is_predefined?: boolean
          person_responsible?: string
          plan_id?: string
          priority?: string
          related_contact_id?: string | null
          related_document?: string
          seed_key?: string | null
          status?: string
          title?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_next_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_next_steps_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_next_steps_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_next_steps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_online_accounts: {
        Row: {
          account_reference: string
          category: string
          created_at: string
          disposition: string
          id: string
          mfa_enabled: string
          mfa_location_secret: string
          mfa_method: string
          password_secret: string
          password_stored_elsewhere: string
          password_stored_elsewhere_detail: string
          plan_id: string
          recovery_email_secret: string
          recovery_phone_secret: string
          section_id: string | null
          service_name: string
          special_instructions: string
          tool_id: string
          updated_at: string
          user_id: string
          username: string
          website: string
        }
        Insert: {
          account_reference?: string
          category?: string
          created_at?: string
          disposition?: string
          id?: string
          mfa_enabled?: string
          mfa_location_secret?: string
          mfa_method?: string
          password_secret?: string
          password_stored_elsewhere?: string
          password_stored_elsewhere_detail?: string
          plan_id: string
          recovery_email_secret?: string
          recovery_phone_secret?: string
          section_id?: string | null
          service_name?: string
          special_instructions?: string
          tool_id: string
          updated_at?: string
          user_id: string
          username?: string
          website?: string
        }
        Update: {
          account_reference?: string
          category?: string
          created_at?: string
          disposition?: string
          id?: string
          mfa_enabled?: string
          mfa_location_secret?: string
          mfa_method?: string
          password_secret?: string
          password_stored_elsewhere?: string
          password_stored_elsewhere_detail?: string
          plan_id?: string
          recovery_email_secret?: string
          recovery_phone_secret?: string
          section_id?: string | null
          service_name?: string
          special_instructions?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          username?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_online_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_online_accounts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_online_accounts_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_online_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_other_custom_fields: {
        Row: {
          created_at: string
          display_order: number
          id: string
          label: string
          record_id: string
          tool_id: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          record_id: string
          tool_id: string
          updated_at?: string
          user_id: string
          value?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          record_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_other_custom_fields_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_other_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_custom_fields_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_custom_fields_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_other_record_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          record_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          record_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          record_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_other_record_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_other_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_record_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_other_records: {
        Row: {
          category: string
          contact: string
          created_at: string
          custom_notes: string
          description: string
          display_order: number
          id: string
          important_date: string | null
          instructions: string
          location: string
          plan_id: string
          section_id: string | null
          title: string
          tool_id: string
          updated_at: string
          user_id: string
          website: string
        }
        Insert: {
          category?: string
          contact?: string
          created_at?: string
          custom_notes?: string
          description?: string
          display_order?: number
          id?: string
          important_date?: string | null
          instructions?: string
          location?: string
          plan_id: string
          section_id?: string | null
          title?: string
          tool_id: string
          updated_at?: string
          user_id: string
          website?: string
        }
        Update: {
          category?: string
          contact?: string
          created_at?: string
          custom_notes?: string
          description?: string
          display_order?: number
          id?: string
          important_date?: string | null
          instructions?: string
          location?: string
          plan_id?: string
          section_id?: string | null
          title?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_other_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_records_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_other_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_personal: {
        Row: {
          created_at: string
          date_of_birth: string | null
          discharge_records_location: string
          drivers_license_number_secret: string
          drivers_license_state: string
          employer: string
          employer_contact: string
          full_legal_name: string
          home_address: string
          hr_contact: string
          id: string
          job_title: string
          marital_status: string
          military_branch: string
          military_id: string
          other_identification: string
          passport_expiration: string | null
          passport_number_secret: string
          personal_email: string
          phone: string
          place_of_birth: string
          plan_id: string
          preferred_name: string
          previous_names: string
          service_dates: string
          spouse_partner: string
          ssn_secret: string
          tool_id: string
          updated_at: string
          user_id: string
          veteran_status: string
          work_email: string
          work_phone: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          discharge_records_location?: string
          drivers_license_number_secret?: string
          drivers_license_state?: string
          employer?: string
          employer_contact?: string
          full_legal_name?: string
          home_address?: string
          hr_contact?: string
          id?: string
          job_title?: string
          marital_status?: string
          military_branch?: string
          military_id?: string
          other_identification?: string
          passport_expiration?: string | null
          passport_number_secret?: string
          personal_email?: string
          phone?: string
          place_of_birth?: string
          plan_id: string
          preferred_name?: string
          previous_names?: string
          service_dates?: string
          spouse_partner?: string
          ssn_secret?: string
          tool_id: string
          updated_at?: string
          user_id: string
          veteran_status?: string
          work_email?: string
          work_phone?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          discharge_records_location?: string
          drivers_license_number_secret?: string
          drivers_license_state?: string
          employer?: string
          employer_contact?: string
          full_legal_name?: string
          home_address?: string
          hr_contact?: string
          id?: string
          job_title?: string
          marital_status?: string
          military_branch?: string
          military_id?: string
          other_identification?: string
          passport_expiration?: string | null
          passport_number_secret?: string
          personal_email?: string
          phone?: string
          place_of_birth?: string
          plan_id?: string
          preferred_name?: string
          previous_names?: string
          service_dates?: string
          spouse_partner?: string
          ssn_secret?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          veteran_status?: string
          work_email?: string
          work_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_personal_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_personal_blocks: {
        Row: {
          created_at: string
          discharge_records_location: string
          display_order: number
          drivers_license_number_secret: string
          drivers_license_state: string
          employer: string
          employer_contact: string
          hr_contact: string
          id: string
          job_title: string
          kind: string
          military_branch: string
          military_id: string
          name: string
          notes: string
          other_identification: string
          passport_expiration: string | null
          passport_number_secret: string
          plan_id: string
          service_dates: string
          tool_id: string
          updated_at: string
          user_id: string
          veteran_status: string
          work_email: string
          work_phone: string
        }
        Insert: {
          created_at?: string
          discharge_records_location?: string
          display_order?: number
          drivers_license_number_secret?: string
          drivers_license_state?: string
          employer?: string
          employer_contact?: string
          hr_contact?: string
          id?: string
          job_title?: string
          kind: string
          military_branch?: string
          military_id?: string
          name: string
          notes?: string
          other_identification?: string
          passport_expiration?: string | null
          passport_number_secret?: string
          plan_id: string
          service_dates?: string
          tool_id: string
          updated_at?: string
          user_id: string
          veteran_status?: string
          work_email?: string
          work_phone?: string
        }
        Update: {
          created_at?: string
          discharge_records_location?: string
          display_order?: number
          drivers_license_number_secret?: string
          drivers_license_state?: string
          employer?: string
          employer_contact?: string
          hr_contact?: string
          id?: string
          job_title?: string
          kind?: string
          military_branch?: string
          military_id?: string
          name?: string
          notes?: string
          other_identification?: string
          passport_expiration?: string | null
          passport_number_secret?: string
          plan_id?: string
          service_dates?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          veteran_status?: string
          work_email?: string
          work_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_personal_blocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_blocks_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_personal_item_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          personal_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          personal_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          personal_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_personal_item_attachments_personal_item_id_fkey"
            columns: ["personal_item_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_personal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_item_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_personal_items: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          item: string
          location: string
          photo_reference: string
          plan_id: string
          reason: string
          recipient: string
          special_instructions: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          item?: string
          location?: string
          photo_reference?: string
          plan_id: string
          reason?: string
          recipient?: string
          special_instructions?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          item?: string
          location?: string
          photo_reference?: string
          plan_id?: string
          reason?: string
          recipient?: string
          special_instructions?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_personal_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_personal_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_plans: {
        Row: {
          card_color: string
          created_at: string
          date_of_birth: string | null
          history_events: Json
          id: string
          is_selected: boolean
          name: string
          person_full_name: string
          relationship: string
          relationship_custom: string
          status: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_color?: string
          created_at?: string
          date_of_birth?: string | null
          history_events?: Json
          id?: string
          is_selected?: boolean
          name: string
          person_full_name?: string
          relationship?: string
          relationship_custom?: string
          status?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_color?: string
          created_at?: string
          date_of_birth?: string | null
          history_events?: Json
          id?: string
          is_selected?: boolean
          name?: string
          person_full_name?: string
          relationship?: string
          relationship_custom?: string
          status?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_plans_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_providers: {
        Row: {
          account_reference: string
          contact: string
          created_at: string
          display_order: number
          id: string
          name: string
          notes: string
          plan_id: string
          provider_type: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_reference?: string
          contact?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          notes?: string
          plan_id: string
          provider_type?: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_reference?: string
          contact?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          notes?: string
          plan_id?: string
          provider_type?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_providers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_providers_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_recurring_bills: {
        Row: {
          amount: string
          automatic_payment: string
          cancel_after_death: string
          company: string
          created_at: string
          description: string
          display_order: number
          due_date: string
          frequency: string
          id: string
          payment_account: string
          plan_id: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: string
          automatic_payment?: string
          cancel_after_death?: string
          company?: string
          created_at?: string
          description?: string
          display_order?: number
          due_date?: string
          frequency?: string
          id?: string
          payment_account?: string
          plan_id: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: string
          automatic_payment?: string
          cancel_after_death?: string
          company?: string
          created_at?: string
          description?: string
          display_order?: number
          due_date?: string
          frequency?: string
          id?: string
          payment_account?: string
          plan_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_recurring_bills_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_recurring_bills_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_recurring_bills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_sections: {
        Row: {
          builtin_key: string | null
          created_at: string
          display_order: number
          id: string
          is_complete: boolean
          is_inactive: boolean
          is_removed: boolean
          kind: string
          modeled_after: string | null
          name: string
          notes: string
          plan_id: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          builtin_key?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_complete?: boolean
          is_inactive?: boolean
          is_removed?: boolean
          kind: string
          modeled_after?: string | null
          name: string
          notes?: string
          plan_id: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          builtin_key?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_complete?: boolean
          is_inactive?: boolean
          is_removed?: boolean
          kind?: string
          modeled_after?: string | null
          name?: string
          notes?: string
          plan_id?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_sections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_sections_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_sections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_subsections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_inactive: boolean
          name: string
          plan_id: string
          section_id: string | null
          subsection_key: string
          tool_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_inactive?: boolean
          name: string
          plan_id: string
          section_id?: string | null
          subsection_key: string
          tool_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_inactive?: boolean
          name?: string
          plan_id?: string
          section_id?: string | null
          subsection_key?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_subsections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_subsections_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_subsections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_utilities: {
        Row: {
          account_reference: string
          automatic_payment: string
          contact: string
          created_at: string
          display_order: number
          id: string
          login_reference: string
          payment_source: string
          plan_id: string
          provider: string
          tool_id: string
          updated_at: string
          user_id: string
          utility_type: string
        }
        Insert: {
          account_reference?: string
          automatic_payment?: string
          contact?: string
          created_at?: string
          display_order?: number
          id?: string
          login_reference?: string
          payment_source?: string
          plan_id: string
          provider?: string
          tool_id: string
          updated_at?: string
          user_id: string
          utility_type?: string
        }
        Update: {
          account_reference?: string
          automatic_payment?: string
          contact?: string
          created_at?: string
          display_order?: number
          id?: string
          login_reference?: string
          payment_source?: string
          plan_id?: string
          provider?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_utilities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_utilities_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_utilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_eolp_vehicles: {
        Row: {
          created_at: string
          display_order: number
          id: string
          insurance: string
          loan_information: string
          make: string
          model: string
          plan_id: string
          spare_key_location: string
          title_location: string
          tool_id: string
          updated_at: string
          user_id: string
          vin: string
          year: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          insurance?: string
          loan_information?: string
          make?: string
          model?: string
          plan_id: string
          spare_key_location?: string
          title_location?: string
          tool_id: string
          updated_at?: string
          user_id: string
          vin?: string
          year?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          insurance?: string
          loan_information?: string
          make?: string
          model?: string
          plan_id?: string
          spare_key_location?: string
          title_location?: string
          tool_id?: string
          updated_at?: string
          user_id?: string
          vin?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_eolp_vehicles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tools_eolp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_vehicles_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_eolp_vehicles_user_id_fkey"
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
      tools_gt_goal_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_goal_attachments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_goal_attachments_user_id_fkey"
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
      tools_gt_update_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_gt_update_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "tools_gt_update_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_gt_update_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tools_hcah_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_hcah_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hcah_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      tools_hms_completion_attachments: {
        Row: {
          completion_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          completion_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          completion_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_completion_attachments_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "tools_hms_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_completion_attachments_user_id_fkey"
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
      tools_hms_item_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hms_item_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tools_hms_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hms_item_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          reminder_days: number | null
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
          reminder_days?: number | null
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
          reminder_days?: number | null
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
      tools_hsa_expense_receipts: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_hsa_expense_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "tools_hsa_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_hsa_expense_receipts_user_id_fkey"
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
      tools_mp_meal_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          meal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          meal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          meal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_mp_meal_attachments_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "tools_mp_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_mp_meal_attachments_user_id_fkey"
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
      tools_note_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "tools_note_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_note_attachments_user_id_fkey"
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
      tools_pcs_pet_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          pet_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          pet_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_pet_attachments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_pet_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_document_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_document_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_veterinary_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
          veterinary_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
          veterinary_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
          veterinary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_veterinary_attachments_veterinary_id_fkey"
            columns: ["veterinary_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_veterinary_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_veterinary_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_vaccination_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
          vaccination_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
          vaccination_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
          vaccination_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_vaccination_attachments_vaccination_id_fkey"
            columns: ["vaccination_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_vaccinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_vaccination_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_pcs_appointment_attachments: {
        Row: {
          appointment_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_pcs_appointment_attachments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "tools_pcs_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_pcs_appointment_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      tools_rh_record_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          record_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          record_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          record_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_rh_record_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "tools_rh_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_rh_record_attachments_user_id_fkey"
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
      tools_sl_list_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_sl_list_attachments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "tools_sl_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_sl_list_attachments_user_id_fkey"
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
          amount: number
          billed_date: string | null
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
          amount: number
          billed_date?: string | null
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
          amount?: number
          billed_date?: string | null
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
      tools_st_subscription_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_st_subscription_attachments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tools_st_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_st_subscription_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tdl_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tdl_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tools_tdl_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tdl_attachments_user_id_fkey"
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
      tools_tl_trip_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tl_trip_attachments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "tools_tl_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tools_tl_trip_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_tl_trips: {
        Row: {
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
          storage_addon_gb: number
          storage_plan: string
          storage_usage_updated_at: string | null
          storage_used_bytes: number
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
          storage_addon_gb?: number
          storage_plan?: string
          storage_usage_updated_at?: string | null
          storage_used_bytes?: number
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
          storage_addon_gb?: number
          storage_plan?: string
          storage_usage_updated_at?: string | null
          storage_used_bytes?: number
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
      apply_tools_eolp_owner_rls: {
        Args: { p_table: string }
        Returns: undefined
      }
      get_user_storage_usage: {
        Args: { p_user_id: string }
        Returns: {
          bucket_id: string
          used_bytes: number
        }[]
      }
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
