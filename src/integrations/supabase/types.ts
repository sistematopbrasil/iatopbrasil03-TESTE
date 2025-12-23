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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultant_recruits: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          created_at: string
          email: string | null
          id: string
          invited_at: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          recruited_by: string | null
          status: Database["public"]["Enums"]["recruit_status"]
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          recruited_by?: string | null
          status?: Database["public"]["Enums"]["recruit_status"]
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          recruited_by?: string | null
          status?: Database["public"]["Enums"]["recruit_status"]
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_recruits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_recruits_recruited_by_fkey"
            columns: ["recruited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_recruits_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions_new"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversations: {
        Row: {
          contact_avatar: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          id: string
          instance_id: string
          is_pinned: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          organization_id: string
          status: string | null
          unread_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_avatar?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          id?: string
          instance_id: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_avatar?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          id?: string
          instance_id?: string
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id?: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          error_message: string | null
          id: string
          media_filename: string | null
          media_mimetype: string | null
          media_size: number | null
          media_url: string | null
          message_id: string
          metadata: Json | null
          status: string | null
          timestamp: string
          type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          media_filename?: string | null
          media_mimetype?: string | null
          media_size?: number | null
          media_url?: string | null
          message_id: string
          metadata?: Json | null
          status?: string | null
          timestamp: string
          type: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          media_filename?: string | null
          media_mimetype?: string | null
          media_size?: number | null
          media_url?: string | null
          message_id?: string
          metadata?: Json | null
          status?: string | null
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quick_replies: {
        Row: {
          content: string | null
          created_at: string | null
          description: string | null
          id: string
          media_filename: string | null
          media_url: string | null
          organization_id: string
          shortcut: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_filename?: string | null
          media_url?: string | null
          organization_id: string
          shortcut: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_filename?: string | null
          media_url?: string | null
          organization_id?: string
          shortcut?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quick_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendee_status"]
          submission_id: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendee_status"]
          submission_id: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendee_status"]
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions_new"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          consultant_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          location: string | null
          max_attendees: number | null
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          location?: string | null
          max_attendees?: number | null
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          location?: string | null
          max_attendees?: number | null
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          meta_pixel_id: string | null
          name: string
          slug: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_pixel_id?: string | null
          name: string
          slug: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_pixel_id?: string | null
          name?: string
          slug?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_configurations: {
        Row: {
          created_at: string
          custom_colors: Json | null
          custom_logo_url: string | null
          custom_thank_you_message: string | null
          custom_welcome_message: string | null
          id: string
          is_active: boolean
          organization_id: string
          redirect_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_colors?: Json | null
          custom_logo_url?: string | null
          custom_thank_you_message?: string | null
          custom_welcome_message?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          redirect_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_colors?: Json | null
          custom_logo_url?: string | null
          custom_thank_you_message?: string | null
          custom_welcome_message?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          redirect_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          consultant_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          updated_at: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          age: number | null
          completion_percentage: number
          created_at: string
          current_income: string | null
          current_job: string | null
          desired_income: string | null
          employment_status: string | null
          has_driver_license: string | null
          has_vehicle: string | null
          id: string
          ip_address: string | null
          location: string | null
          motivation: string | null
          name: string | null
          phone: string | null
          relationship_status: string | null
          sales_experience: string | null
          updated_at: string
          user_agent: string | null
          vehicle_protection_experience: string | null
        }
        Insert: {
          age?: number | null
          completion_percentage?: number
          created_at?: string
          current_income?: string | null
          current_job?: string | null
          desired_income?: string | null
          employment_status?: string | null
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          motivation?: string | null
          name?: string | null
          phone?: string | null
          relationship_status?: string | null
          sales_experience?: string | null
          updated_at?: string
          user_agent?: string | null
          vehicle_protection_experience?: string | null
        }
        Update: {
          age?: number | null
          completion_percentage?: number
          created_at?: string
          current_income?: string | null
          current_job?: string | null
          desired_income?: string | null
          employment_status?: string | null
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          motivation?: string | null
          name?: string | null
          phone?: string | null
          relationship_status?: string | null
          sales_experience?: string | null
          updated_at?: string
          user_agent?: string | null
          vehicle_protection_experience?: string | null
        }
        Relationships: []
      }
      quiz_submissions_new: {
        Row: {
          age: number | null
          assigned_to: string | null
          browser: string | null
          completion_percentage: number
          consultant_id: string | null
          created_at: string
          current_income: string | null
          current_job: string | null
          desired_income: string | null
          device_type: string | null
          email: string | null
          employment_status: string | null
          extra_answers: Json | null
          has_driver_license: string | null
          has_vehicle: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          last_contact_at: string | null
          lead_score: number | null
          location: string | null
          motivation: string | null
          name: string | null
          notes: string | null
          organization_id: string
          os: string | null
          phone: string | null
          pipeline_stage_id: string | null
          referrer: string | null
          relationship_status: string | null
          sales_experience: string | null
          session_id: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          temperature: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          vehicle_protection_experience: string | null
        }
        Insert: {
          age?: number | null
          assigned_to?: string | null
          browser?: string | null
          completion_percentage?: number
          consultant_id?: string | null
          created_at?: string
          current_income?: string | null
          current_job?: string | null
          desired_income?: string | null
          device_type?: string | null
          email?: string | null
          employment_status?: string | null
          extra_answers?: Json | null
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          location?: string | null
          motivation?: string | null
          name?: string | null
          notes?: string | null
          organization_id: string
          os?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          referrer?: string | null
          relationship_status?: string | null
          sales_experience?: string | null
          session_id?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vehicle_protection_experience?: string | null
        }
        Update: {
          age?: number | null
          assigned_to?: string | null
          browser?: string | null
          completion_percentage?: number
          consultant_id?: string | null
          created_at?: string
          current_income?: string | null
          current_job?: string | null
          desired_income?: string | null
          device_type?: string | null
          email?: string | null
          employment_status?: string | null
          extra_answers?: Json | null
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          location?: string | null
          motivation?: string | null
          name?: string | null
          notes?: string | null
          organization_id?: string
          os?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          referrer?: string | null
          relationship_status?: string | null
          sales_experience?: string | null
          session_id?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          temperature?: Database["public"]["Enums"]["lead_temperature"] | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vehicle_protection_experience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_new_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_new_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_new_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_new_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_scores: {
        Row: {
          consultant_id: string
          consultants_recruited: number
          created_at: string
          events_hosted: number
          id: string
          leads_captured: number
          leads_contacted: number
          leads_converted: number
          leads_qualified: number
          organization_id: string
          period_end: string
          period_start: string
          total_points: number | null
          updated_at: string
        }
        Insert: {
          consultant_id: string
          consultants_recruited?: number
          created_at?: string
          events_hosted?: number
          id?: string
          leads_captured?: number
          leads_contacted?: number
          leads_converted?: number
          leads_qualified?: number
          organization_id: string
          period_end: string
          period_start: string
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          consultants_recruited?: number
          created_at?: string
          events_hosted?: number
          id?: string
          leads_captured?: number
          leads_contacted?: number
          leads_converted?: number
          leads_qualified?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_scores_user_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_sessions: {
        Row: {
          browser: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          last_activity_at: string
          organization_id: string
          os: string | null
          referrer: string | null
          session_id: string
          started_at: string
          submission_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_activity_at?: string
          organization_id: string
          os?: string | null
          referrer?: string | null
          session_id: string
          started_at?: string
          submission_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_activity_at?: string
          organization_id?: string
          os?: string | null
          referrer?: string | null
          session_id?: string
          started_at?: string
          submission_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sessions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions_new"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          pixel_id: string | null
          profile_photo: string | null
          quiz_cover_image: string | null
          quiz_image_position: string | null
          quiz_image_shape: string | null
          quiz_image_size: string | null
          quiz_slug: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
          whatsapp_button_url: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          organization_id: string
          pixel_id?: string | null
          profile_photo?: string | null
          quiz_cover_image?: string | null
          quiz_image_position?: string | null
          quiz_image_shape?: string | null
          quiz_image_size?: string | null
          quiz_slug?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
          whatsapp_button_url?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          pixel_id?: string | null
          profile_photo?: string | null
          quiz_cover_image?: string | null
          quiz_image_position?: string | null
          quiz_image_shape?: string | null
          quiz_image_size?: string | null
          quiz_slug?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
          whatsapp_button_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          connection_state: Json | null
          created_at: string | null
          id: string
          instance_key: string
          instance_name: string
          last_connected_at: string | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          connection_state?: Json | null
          created_at?: string | null
          id?: string
          instance_key: string
          instance_name: string
          last_connected_at?: string | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          connection_state?: Json | null
          created_at?: string | null
          id?: string
          instance_key?: string
          instance_name?: string
          last_connected_at?: string | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_user_id_fkey"
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
      create_admin_user: { Args: never; Returns: undefined }
      create_audit_log: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_organization_id: string
          p_resource_id?: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: string
      }
      generate_quiz_slug: { Args: { full_name: string }; Returns: string }
      generate_unique_instance_name: {
        Args: { base_name: string }
        Returns: string
      }
      generate_unique_username: { Args: { full_name: string }; Returns: string }
      get_consultant_ranking_dynamic: {
        Args: { period_end?: string; period_start?: string }
        Returns: {
          cold_leads: number
          consultant_id: string
          conversion_rate: number
          full_name: string
          hot_leads: number
          last_lead_date: string
          quiz_slug: string
          ranking_position: number
          total_leads: number
          warm_leads: number
        }[]
      }
      get_current_consultant_id: { Args: never; Returns: string }
      get_default_pipeline_stage_id: {
        Args: { org_id: string }
        Returns: string
      }
      get_user_organization_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      map_stage_enum_to_uuid: {
        Args: { org_id: string; stage_name: string }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      attendee_status: "convidado" | "confirmado" | "presente" | "ausente"
      event_status: "planejado" | "confirmado" | "realizado" | "cancelado"
      lead_stage:
        | "novo"
        | "contatado"
        | "qualificado"
        | "convertido"
        | "descartado"
      lead_temperature: "hot" | "warm" | "cold"
      recruit_status:
        | "prospecto"
        | "em_analise"
        | "aprovado"
        | "ativo"
        | "inativo"
      user_role: "super_admin" | "admin" | "consultor" | "viewer"
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
      attendee_status: ["convidado", "confirmado", "presente", "ausente"],
      event_status: ["planejado", "confirmado", "realizado", "cancelado"],
      lead_stage: [
        "novo",
        "contatado",
        "qualificado",
        "convertido",
        "descartado",
      ],
      lead_temperature: ["hot", "warm", "cold"],
      recruit_status: [
        "prospecto",
        "em_analise",
        "aprovado",
        "ativo",
        "inativo",
      ],
      user_role: ["super_admin", "admin", "consultor", "viewer"],
    },
  },
} as const
