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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
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
      billing_active: {
        Row: {
          amount: number
          billing_date: string
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          id: string
          item_type: string
          status: string
          tool_id: string | null
          tool_name: string | null
          updated_at: string | null
          user_id: string
          users_tools_id: string | null
        }
        Insert: {
          amount: number
          billing_date: string
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          id?: string
          item_type: string
          status?: string
          tool_id?: string | null
          tool_name?: string | null
          updated_at?: string | null
          user_id: string
          users_tools_id?: string | null
        }
        Update: {
          amount?: number
          billing_date?: string
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          id?: string
          item_type?: string
          status?: string
          tool_id?: string | null
          tool_name?: string | null
          updated_at?: string | null
          user_id?: string
          users_tools_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_active_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_active_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_active_users_tools_id_fkey"
            columns: ["users_tools_id"]
            isOneToOne: false
            referencedRelation: "users_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          billing_date: string
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id: string
          invoice_id: string | null
          item_type: string
          notes: string | null
          payment_intent_id: string | null
          processed_at: string | null
          status: string
          tool_id: string | null
          tool_name: string | null
          updated_at: string
          user_id: string
          users_tools_id: string | null
        }
        Insert: {
          amount: number
          billing_date: string
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id?: string
          invoice_id?: string | null
          item_type: string
          notes?: string | null
          payment_intent_id?: string | null
          processed_at?: string | null
          status: string
          tool_id?: string | null
          tool_name?: string | null
          updated_at: string
          user_id: string
          users_tools_id?: string | null
        }
        Update: {
          amount?: number
          billing_date?: string
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          item_type?: string
          notes?: string | null
          payment_intent_id?: string | null
          processed_at?: string | null
          status?: string
          tool_id?: string | null
          tool_name?: string | null
          updated_at?: string
          user_id?: string
          users_tools_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_history_users_tools_id_fkey"
            columns: ["users_tools_id"]
            isOneToOne: false
            referencedRelation: "users_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: string | null
          execution_data: Json | null
          id: string
          job_name: string
          message: string | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: string | null
          execution_data?: Json | null
          id?: string
          job_name: string
          message?: string | null
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: string | null
          execution_data?: Json | null
          id?: string
          job_name?: string
          message?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
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
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string
          id: string
          max_uses: number | null
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at: string
          id?: string
          max_uses?: number | null
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string
          id?: string
          max_uses?: number | null
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: []
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
      users: {
        Row: {
          active: string
          billing_date: string | null
          created_at: string
          email: string
          first_name: string
          guest_admin_id: number | null
          id: string
          last_name: string
          password: string
          updated_at: string | null
          user_id: string
          user_status: string
        }
        Insert: {
          active: string
          billing_date?: string | null
          created_at?: string
          email: string
          first_name: string
          guest_admin_id?: number | null
          id?: string
          last_name: string
          password: string
          updated_at?: string | null
          user_id?: string
          user_status: string
        }
        Update: {
          active?: string
          billing_date?: string | null
          created_at?: string
          email?: string
          first_name?: string
          guest_admin_id?: number | null
          id?: string
          last_name?: string
          password?: string
          updated_at?: string | null
          user_id?: string
          user_status?: string
        }
        Relationships: []
      }
      users_tools: {
        Row: {
          cancellation_effective_date: string | null
          created_at: string | null
          has_used_trial: boolean | null
          id: string
          price: number
          promo_code_id: string | null
          promo_expiration_date: string | null
          status: string
          tool_id: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancellation_effective_date?: string | null
          created_at?: string | null
          has_used_trial?: boolean | null
          id?: string
          price: number
          promo_code_id?: string | null
          promo_expiration_date?: string | null
          status?: string
          tool_id: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancellation_effective_date?: string | null
          created_at?: string | null
          has_used_trial?: boolean | null
          id?: string
          price?: number
          promo_code_id?: string | null
          promo_expiration_date?: string | null
          status?: string
          tool_id?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tools_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
