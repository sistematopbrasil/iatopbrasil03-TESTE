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
      ad_accounts: {
        Row: {
          ad_account_id: string
          created_at: string | null
          currency: string | null
          days_synced: number | null
          id: string
          instagram_user_id: string | null
          instagram_username: string | null
          is_monitored: boolean | null
          last_synced_at: string | null
          meta_status: string | null
          name: string
          organization_id: string
          page_id: string | null
          page_name: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string | null
          currency?: string | null
          days_synced?: number | null
          id?: string
          instagram_user_id?: string | null
          instagram_username?: string | null
          is_monitored?: boolean | null
          last_synced_at?: string | null
          meta_status?: string | null
          name: string
          organization_id: string
          page_id?: string | null
          page_name?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string | null
          currency?: string | null
          days_synced?: number | null
          id?: string
          instagram_user_id?: string | null
          instagram_username?: string | null
          is_monitored?: boolean | null
          last_synced_at?: string | null
          meta_status?: string | null
          name?: string
          organization_id?: string
          page_id?: string | null
          page_name?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics: {
        Row: {
          ad_account_id: string
          clicks: number | null
          conversions: number | null
          cost_per_visit: number | null
          cpc: number | null
          created_at: string | null
          ctr: number | null
          date: string
          frequency: number | null
          id: string
          impressions: number | null
          organization_id: string
          post_engagement: number | null
          profile_visits: number | null
          reach: number | null
          spend: number | null
          updated_at: string | null
        }
        Insert: {
          ad_account_id: string
          clicks?: number | null
          conversions?: number | null
          cost_per_visit?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          organization_id: string
          post_engagement?: number | null
          profile_visits?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string
          clicks?: number | null
          conversions?: number | null
          cost_per_visit?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          organization_id?: string
          post_engagement?: number | null
          profile_visits?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_configs: {
        Row: {
          agent_name: string | null
          analyze_images: boolean | null
          api_key_encrypted: string | null
          api_provider: string
          auto_pipeline: boolean | null
          auto_reply: boolean | null
          created_at: string | null
          description: string | null
          farewell_message: string | null
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          greeting_message: string | null
          id: string
          max_tokens: number | null
          model: string
          objective: string | null
          organization_id: string
          pause_on_human_minutes: number | null
          persona: string | null
          products_info: string | null
          restrictions: string | null
          skills: string | null
          temperature: number | null
          transcribe_audio: boolean | null
          updated_at: string | null
          user_id: string
          working_hours_end: string | null
          working_hours_only: boolean | null
          working_hours_start: string | null
        }
        Insert: {
          agent_name?: string | null
          analyze_images?: boolean | null
          api_key_encrypted?: string | null
          api_provider?: string
          auto_pipeline?: boolean | null
          auto_reply?: boolean | null
          created_at?: string | null
          description?: string | null
          farewell_message?: string | null
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          greeting_message?: string | null
          id?: string
          max_tokens?: number | null
          model?: string
          objective?: string | null
          organization_id: string
          pause_on_human_minutes?: number | null
          persona?: string | null
          products_info?: string | null
          restrictions?: string | null
          skills?: string | null
          temperature?: number | null
          transcribe_audio?: boolean | null
          updated_at?: string | null
          user_id: string
          working_hours_end?: string | null
          working_hours_only?: boolean | null
          working_hours_start?: string | null
        }
        Update: {
          agent_name?: string | null
          analyze_images?: boolean | null
          api_key_encrypted?: string | null
          api_provider?: string
          auto_pipeline?: boolean | null
          auto_reply?: boolean | null
          created_at?: string | null
          description?: string | null
          farewell_message?: string | null
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          greeting_message?: string | null
          id?: string
          max_tokens?: number | null
          model?: string
          objective?: string | null
          organization_id?: string
          pause_on_human_minutes?: number | null
          persona?: string | null
          products_info?: string | null
          restrictions?: string | null
          skills?: string | null
          temperature?: number | null
          transcribe_audio?: boolean | null
          updated_at?: string | null
          user_id?: string
          working_hours_end?: string | null
          working_hours_only?: boolean | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_state: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_ai_message_at: string | null
          last_ai_message_ids: Json | null
          messages_sent: number | null
          paused_by: string | null
          paused_until: string | null
          permanently_disabled: boolean | null
          total_tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_ai_message_at?: string | null
          last_ai_message_ids?: Json | null
          messages_sent?: number | null
          paused_by?: string | null
          paused_until?: string | null
          permanently_disabled?: boolean | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_ai_message_at?: string | null
          last_ai_message_ids?: Json | null
          messages_sent?: number | null
          paused_by?: string | null
          paused_until?: string | null
          permanently_disabled?: boolean | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_state_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
      capture_page_configs: {
        Row: {
          button_color: string | null
          button_text: string | null
          compare_enabled: boolean
          compare_title: string | null
          compare_topbrasil_items: Json | null
          compare_traditional_items: Json | null
          consultant_id: string
          created_at: string | null
          custom_questions: Json | null
          custom_slug: string | null
          email_enabled: boolean
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          gallery_images: Json | null
          gallery_title: string | null
          hero_image: string | null
          hero_image_position: string | null
          hero_image_shape: string | null
          hero_image_size: string | null
          id: string
          is_active: boolean
          logo_image: string | null
          logo_position: string | null
          logo_size: string | null
          organization_id: string
          page_purpose: string
          redirect_type: string | null
          redirect_url: string | null
          subtitle: string | null
          template_type: string
          title: string | null
          updated_at: string | null
          whatsapp_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          button_color?: string | null
          button_text?: string | null
          compare_enabled?: boolean
          compare_title?: string | null
          compare_topbrasil_items?: Json | null
          compare_traditional_items?: Json | null
          consultant_id: string
          created_at?: string | null
          custom_questions?: Json | null
          custom_slug?: string | null
          email_enabled?: boolean
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          gallery_images?: Json | null
          gallery_title?: string | null
          hero_image?: string | null
          hero_image_position?: string | null
          hero_image_shape?: string | null
          hero_image_size?: string | null
          id?: string
          is_active?: boolean
          logo_image?: string | null
          logo_position?: string | null
          logo_size?: string | null
          organization_id: string
          page_purpose?: string
          redirect_type?: string | null
          redirect_url?: string | null
          subtitle?: string | null
          template_type?: string
          title?: string | null
          updated_at?: string | null
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          button_color?: string | null
          button_text?: string | null
          compare_enabled?: boolean
          compare_title?: string | null
          compare_topbrasil_items?: Json | null
          compare_traditional_items?: Json | null
          consultant_id?: string
          created_at?: string | null
          custom_questions?: Json | null
          custom_slug?: string | null
          email_enabled?: boolean
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          gallery_images?: Json | null
          gallery_title?: string | null
          hero_image?: string | null
          hero_image_position?: string | null
          hero_image_shape?: string | null
          hero_image_size?: string | null
          id?: string
          is_active?: boolean
          logo_image?: string | null
          logo_position?: string | null
          logo_size?: string | null
          organization_id?: string
          page_purpose?: string
          redirect_type?: string | null
          redirect_url?: string | null
          subtitle?: string | null
          template_type?: string
          title?: string | null
          updated_at?: string | null
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_page_configs_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          instance_id: string | null
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
          instance_id?: string | null
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
          instance_id?: string | null
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
          order_index: number | null
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
          order_index?: number | null
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
          order_index?: number | null
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
      crm_settings: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          quick_replies_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          quick_replies_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          quick_replies_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      followup_logs: {
        Row: {
          conversation_id: string
          id: string
          message_content: string | null
          organization_id: string
          rule_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          message_content?: string | null
          organization_id: string
          rule_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          message_content?: string | null
          organization_id?: string
          rule_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "followup_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_rules: {
        Row: {
          ai_prompt: string | null
          created_at: string
          delay_minutes: number
          exclude_stages: string[] | null
          fixed_message: string | null
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          id: string
          is_active: boolean
          max_followups: number
          message_type: string
          name: string
          only_open_conversations: boolean
          organization_id: string
          respect_working_hours: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_prompt?: string | null
          created_at?: string
          delay_minutes?: number
          exclude_stages?: string[] | null
          fixed_message?: string | null
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          is_active?: boolean
          max_followups?: number
          message_type?: string
          name?: string
          only_open_conversations?: boolean
          organization_id: string
          respect_working_hours?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_prompt?: string | null
          created_at?: string
          delay_minutes?: number
          exclude_stages?: string[] | null
          fixed_message?: string | null
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          is_active?: boolean
          max_followups?: number
          message_type?: string
          name?: string
          only_open_conversations?: boolean
          organization_id?: string
          respect_working_hours?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      insta_campaign_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          note_type: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          note_type?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          note_type?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insta_campaign_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "insta_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insta_follower_metrics: {
        Row: {
          daily_change: number | null
          follower_count: number
          following_count: number
          growth_rate: number | null
          id: string
          posts_count: number
          profile_id: string
          recorded_at: string
          recorded_date: string
        }
        Insert: {
          daily_change?: number | null
          follower_count?: number
          following_count?: number
          growth_rate?: number | null
          id?: string
          posts_count?: number
          profile_id: string
          recorded_at?: string
          recorded_date: string
        }
        Update: {
          daily_change?: number | null
          follower_count?: number
          following_count?: number
          growth_rate?: number | null
          id?: string
          posts_count?: number
          profile_id?: string
          recorded_at?: string
          recorded_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "insta_follower_metrics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "insta_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insta_profiles: {
        Row: {
          category: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          profile_picture: string | null
          profile_url: string | null
          updated_at: string
          username: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          profile_picture?: string | null
          profile_url?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          profile_picture?: string | null
          profile_url?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "insta_profiles_organization_id_fkey"
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
      pipeline_stage_prompts: {
        Row: {
          created_at: string
          description: string
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          id: string
          organization_id: string
          stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          organization_id: string
          stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          organization_id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_prompts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_prompts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string | null
          funnel_type: Database["public"]["Enums"]["funnel_type"]
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
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
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          has_driver_license: string | null
          has_vehicle: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          last_contact_at: string | null
          lead_score: number | null
          lead_source: string
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
          temperature_override: boolean
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_source?: string
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
          temperature_override?: boolean
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          has_driver_license?: string | null
          has_vehicle?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_source?: string
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
          temperature_override?: boolean
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
          funnel_type: Database["public"]["Enums"]["funnel_type"]
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
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
      traffic_ai_conversations: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          messages: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          messages?: Json
          organization_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_settings: {
        Row: {
          ai_enabled: boolean | null
          ai_model: string
          ai_response_mode: string
          ai_system_prompt: string | null
          ai_temperature: number
          created_at: string | null
          id: string
          meta_token_configured: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          ai_model?: string
          ai_response_mode?: string
          ai_system_prompt?: string | null
          ai_temperature?: number
          created_at?: string | null
          id?: string
          meta_token_configured?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          ai_model?: string
          ai_response_mode?: string
          ai_system_prompt?: string | null
          ai_temperature?: number
          created_at?: string | null
          id?: string
          meta_token_configured?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          ai_enabled: boolean
          auth_user_id: string
          created_at: string
          crm_enabled: boolean
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
          ranking_visible: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
          whatsapp_button_url: string | null
        }
        Insert: {
          ai_enabled?: boolean
          auth_user_id: string
          created_at?: string
          crm_enabled?: boolean
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
          ranking_visible?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
          whatsapp_button_url?: string | null
        }
        Update: {
          ai_enabled?: boolean
          auth_user_id?: string
          created_at?: string
          crm_enabled?: boolean
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
          ranking_visible?: boolean
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
          funnel_type: Database["public"]["Enums"]["funnel_type"]
          id: string
          instance_key: string
          instance_name: string
          last_connected_at: string | null
          last_webhook_at: string | null
          last_webhook_event: string | null
          last_webhook_message_id: string | null
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          instance_key: string
          instance_name: string
          last_connected_at?: string | null
          last_webhook_at?: string | null
          last_webhook_event?: string | null
          last_webhook_message_id?: string | null
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
          funnel_type?: Database["public"]["Enums"]["funnel_type"]
          id?: string
          instance_key?: string
          instance_name?: string
          last_connected_at?: string | null
          last_webhook_at?: string | null
          last_webhook_event?: string | null
          last_webhook_message_id?: string | null
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
      decrypt_api_key: { Args: { encrypted_key: string }; Returns: string }
      encrypt_api_key: { Args: { plain_key: string }; Returns: string }
      generate_quiz_slug: { Args: { full_name: string }; Returns: string }
      generate_unique_instance_name: {
        Args: { base_name: string }
        Returns: string
      }
      generate_unique_username: { Args: { full_name: string }; Returns: string }
      get_consultant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          full_name: string
          id: string
          organization_id: string
          pixel_id: string
          profile_photo: string
          quiz_cover_image: string
          quiz_image_position: string
          quiz_image_shape: string
          quiz_image_size: string
          quiz_slug: string
          whatsapp_button_url: string
        }[]
      }
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
      get_consultants_by_org: {
        Args: { p_org_id: string }
        Returns: {
          full_name: string
          id: string
          organization_id: string
          pixel_id: string
          profile_photo: string
          quiz_cover_image: string
          quiz_image_position: string
          quiz_image_shape: string
          quiz_image_size: string
          quiz_slug: string
          whatsapp_button_url: string
        }[]
      }
      get_current_consultant_id: { Args: never; Returns: string }
      get_default_pipeline_stage_for_funnel: {
        Args: {
          org_id: string
          p_funnel?: Database["public"]["Enums"]["funnel_type"]
        }
        Returns: string
      }
      get_default_pipeline_stage_id: {
        Args: { org_id: string }
        Returns: string
      }
      get_novos_consultores_stage_id: {
        Args: { org_id: string }
        Returns: string
      }
      get_organization_by_id: {
        Args: { p_id: string }
        Returns: {
          id: string
          logo_url: string
          meta_pixel_id: string
          name: string
          slug: string
          whatsapp_number: string
        }[]
      }
      get_organization_public: {
        Args: { p_slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      map_stage_enum_to_uuid: {
        Args: { org_id: string; stage_name: string }
        Returns: string
      }
      normalize_br_phone: { Args: { phone: string }; Returns: string }
      try_acquire_ai_lock: {
        Args: { p_contact_phone: string; p_conversation_id: string }
        Returns: boolean
      }
    }
    Enums: {
      attendee_status: "convidado" | "confirmado" | "presente" | "ausente"
      event_status: "planejado" | "confirmado" | "realizado" | "cancelado"
      funnel_type: "consultor" | "associado"
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
      funnel_type: ["consultor", "associado"],
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
