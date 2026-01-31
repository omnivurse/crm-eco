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
      agent_chat_preferences: {
        Row: {
          agent_id: string
          auto_accept_chats: boolean | null
          availability_status: string | null
          desktop_notifications: boolean | null
          favorite_responses: Json | null
          id: string
          max_concurrent_chats: number | null
          notification_sound: boolean | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          auto_accept_chats?: boolean | null
          availability_status?: string | null
          desktop_notifications?: boolean | null
          favorite_responses?: Json | null
          id?: string
          max_concurrent_chats?: number | null
          notification_sound?: boolean | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          auto_accept_chats?: boolean | null
          availability_status?: string | null
          desktop_notifications?: boolean | null
          favorite_responses?: Json | null
          id?: string
          max_concurrent_chats?: number | null
          notification_sound?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_chat_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_chat_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          author: string
          content: string
          created_at: string | null
          id: string
          result: Json | null
          role: string
          ticket_id: string | null
          tool_args: Json | null
          tool_name: string | null
          user_id: string
        }
        Insert: {
          author: string
          content: string
          created_at?: string | null
          id?: string
          result?: Json | null
          role: string
          ticket_id?: string | null
          tool_args?: Json | null
          tool_name?: string | null
          user_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string | null
          id?: string
          result?: Json | null
          role?: string
          ticket_id?: string | null
          tool_args?: Json | null
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "team_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          id: string
          notes: string | null
          returned_at: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_tag: string | null
          attrs: Json | null
          ci_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          purchase_date: string | null
          serial_number: string | null
          status: string | null
          type: string
          updated_at: string | null
          warranty_end_date: string | null
        }
        Insert: {
          asset_tag?: string | null
          attrs?: Json | null
          ci_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          warranty_end_date?: string | null
        }
        Update: {
          asset_tag?: string | null
          attrs?: Json | null
          ci_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_ci_id_fkey"
            columns: ["ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_attachments: {
        Row: {
          added_at: string
          assignment_id: string
          file_id: string
          id: string
        }
        Insert: {
          added_at?: string
          assignment_id: string
          file_id: string
          id?: string
        }
        Update: {
          added_at?: string
          assignment_id?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          accepted_at: string | null
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string
          decline_reason: string | null
          details: string | null
          due_at: string | null
          id: string
          priority: string
          progress_percent: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          details?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          progress_percent?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          decline_reason?: string | null
          details?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          progress_percent?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_working_day: boolean | null
          start_time: string
          timezone: string | null
        }
        Insert: {
          day_of_week: number
          end_time?: string
          id?: string
          is_working_day?: boolean | null
          start_time?: string
          timezone?: string | null
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_working_day?: boolean | null
          start_time?: string
          timezone?: string | null
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "canned_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          approval_required: boolean | null
          category_id: string | null
          created_at: string | null
          description: string | null
          estimated_delivery_days: number | null
          form_schema: Json
          fulfillment_flow_id: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          visibility_roles: string[] | null
        }
        Insert: {
          approval_required?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_delivery_days?: number | null
          form_schema?: Json
          fulfillment_flow_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          visibility_roles?: string[] | null
        }
        Update: {
          approval_required?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_delivery_days?: number | null
          form_schema?: Json
          fulfillment_flow_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          visibility_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      change_approvals: {
        Row: {
          approver_id: string | null
          change_id: string | null
          comments: string | null
          created_at: string | null
          id: string
          status: Database["public"]["Enums"]["approval_status"] | null
          vote: string | null
          voted_at: string | null
        }
        Insert: {
          approver_id?: string | null
          change_id?: string | null
          comments?: string | null
          created_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          vote?: string | null
          voted_at?: string | null
        }
        Update: {
          approver_id?: string | null
          change_id?: string | null
          comments?: string | null
          created_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          vote?: string | null
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "change_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_approvals_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "changes"
            referencedColumns: ["id"]
          },
        ]
      }
      change_tasks: {
        Row: {
          assigned_to: string | null
          change_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          sort_order: number | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          change_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          change_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "change_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_tasks_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "changes"
            referencedColumns: ["id"]
          },
        ]
      }
      changes: {
        Row: {
          affected_service_id: string | null
          approval_state: Json | null
          backout_plan_md: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          implementation_plan_md: string | null
          implementer_id: string | null
          linked_ci_ids: string[] | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id: string | null
          risk: Database["public"]["Enums"]["change_risk"] | null
          status: string | null
          test_plan_md: string | null
          title: string
          type: Database["public"]["Enums"]["change_type"] | null
          updated_at: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          affected_service_id?: string | null
          approval_state?: Json | null
          backout_plan_md?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_plan_md?: string | null
          implementer_id?: string | null
          linked_ci_ids?: string[] | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id?: string | null
          risk?: Database["public"]["Enums"]["change_risk"] | null
          status?: string | null
          test_plan_md?: string | null
          title: string
          type?: Database["public"]["Enums"]["change_type"] | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          affected_service_id?: string | null
          approval_state?: Json | null
          backout_plan_md?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_plan_md?: string | null
          implementer_id?: string | null
          linked_ci_ids?: string[] | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id?: string | null
          risk?: Database["public"]["Enums"]["change_risk"] | null
          status?: string | null
          test_plan_md?: string | null
          title?: string
          type?: Database["public"]["Enums"]["change_type"] | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "changes_affected_service_id_fkey"
            columns: ["affected_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changes_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "changes_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changes_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "changes_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          attachments: Json | null
          channel_id: string | null
          created_at: string | null
          id: string
          is_internal: boolean | null
          message_body: string
          message_html: string | null
          metadata: Json | null
          sender_email: string | null
          sender_id: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          thread_id: string | null
          ticket_id: string | null
        }
        Insert: {
          attachments?: Json | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message_body: string
          message_html?: string | null
          metadata?: Json | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          thread_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          attachments?: Json | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message_body?: string
          message_html?: string | null
          metadata?: Json | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          thread_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_activity_summary"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_routing_rules: {
        Row: {
          actions: Json
          channel_id: string
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
        }
        Insert: {
          actions: Json
          channel_id: string
          conditions: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
        }
        Update: {
          actions?: Json
          channel_id?: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_routing_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel_activity_summary"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "channel_routing_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "support_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string | null
          channel_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_quick_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          kb_article_id: string | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kb_article_id?: string | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kb_article_id?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_quick_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_quick_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_quick_responses_kb_article_id_fkey"
            columns: ["kb_article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_session_notes: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          note: string
          session_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          note: string
          session_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_session_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_session_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_response_time_analytics"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "chat_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          assigned_agent_id: string | null
          customer_email: string | null
          customer_name: string | null
          ended_at: string | null
          id: string
          metadata: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["chat_status"] | null
          ticket_id: string | null
          visitor_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["chat_status"] | null
          ticket_id?: string | null
          visitor_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          customer_email?: string | null
          customer_name?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["chat_status"] | null
          ticket_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_relationships: {
        Row: {
          child_ci_id: string | null
          created_at: string | null
          id: string
          parent_ci_id: string | null
          relationship_type: string
        }
        Insert: {
          child_ci_id?: string | null
          created_at?: string | null
          id?: string
          parent_ci_id?: string | null
          relationship_type: string
        }
        Update: {
          child_ci_id?: string | null
          created_at?: string | null
          id?: string
          parent_ci_id?: string | null
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_relationships_child_ci_id_fkey"
            columns: ["child_ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_relationships_parent_ci_id_fkey"
            columns: ["parent_ci_id"]
            isOneToOne: false
            referencedRelation: "cmdb_ci"
            referencedColumns: ["id"]
          },
        ]
      }
      cmdb_ci: {
        Row: {
          attrs: Json | null
          class: Database["public"]["Enums"]["ci_class"] | null
          created_at: string | null
          description: string | null
          environment: Database["public"]["Enums"]["environment"] | null
          hostname: string | null
          id: string
          ip_address: string | null
          location: string | null
          name: string
          owner_team_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attrs?: Json | null
          class?: Database["public"]["Enums"]["ci_class"] | null
          created_at?: string | null
          description?: string | null
          environment?: Database["public"]["Enums"]["environment"] | null
          hostname?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          name: string
          owner_team_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attrs?: Json | null
          class?: Database["public"]["Enums"]["ci_class"] | null
          created_at?: string | null
          description?: string | null
          environment?: Database["public"]["Enums"]["environment"] | null
          hostname?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          name?: string
          owner_team_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmdb_ci_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          blockers: string | null
          created_at: string
          ended_at: string | null
          highlights: string | null
          id: string
          started_at: string | null
          summary: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          ended_at?: string | null
          highlights?: string | null
          id?: string
          started_at?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          ended_at?: string | null
          highlights?: string | null
          id?: string
          started_at?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          config: Json | null
          created_at: string | null
          display_name: string | null
          email_address: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          provider: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          display_name?: string | null
          email_address: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider?: string | null
        }
        Relationships: []
      }
      files: {
        Row: {
          byte_size: number | null
          created_at: string
          filename: string
          id: string
          linked_project_id: string | null
          linked_task_id: string | null
          linked_ticket_id: string | null
          mime_type: string | null
          owner_id: string
          parent_file_id: string | null
          sha256: string | null
          storage_path: string
          updated_at: string
          version: number
          virus_scan_result: Json | null
          virus_scan_status: string
          visibility: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          filename: string
          id?: string
          linked_project_id?: string | null
          linked_task_id?: string | null
          linked_ticket_id?: string | null
          mime_type?: string | null
          owner_id: string
          parent_file_id?: string | null
          sha256?: string | null
          storage_path: string
          updated_at?: string
          version?: number
          virus_scan_result?: Json | null
          virus_scan_status?: string
          visibility?: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          filename?: string
          id?: string
          linked_project_id?: string | null
          linked_task_id?: string | null
          linked_ticket_id?: string | null
          mime_type?: string | null
          owner_id?: string
          parent_file_id?: string | null
          sha256?: string | null
          storage_path?: string
          updated_at?: string
          version?: number
          virus_scan_result?: Json | null
          virus_scan_status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_parent_file_id_fkey"
            columns: ["parent_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          date: string
          id: string
          is_recurring: boolean | null
          name: string
          year: number | null
        }
        Insert: {
          date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          year?: number | null
        }
        Update: {
          date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          year?: number | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          metadata: Json | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          is_published: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "kb_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_docs: {
        Row: {
          chunk: string
          created_at: string | null
          id: string
          source: string
          title: string
        }
        Insert: {
          chunk: string
          created_at?: string | null
          id?: string
          source: string
          title: string
        }
        Update: {
          chunk?: string
          created_at?: string | null
          id?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content_md: string
          created_at: string | null
          id: string
          is_published: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content_md?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content_md?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "knowledge_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_versions: {
        Row: {
          article_id: string
          content_md: string
          created_at: string | null
          created_by: string | null
          id: string
          title: string
          version: number
        }
        Insert: {
          article_id: string
          content_md: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          title: string
          version: number
        }
        Update: {
          article_id?: string
          content_md?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "knowledge_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          attended: boolean | null
          created_at: string | null
          id: string
          meeting_id: string
          status: string
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          meeting_id: string
          status?: string
          user_id: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string | null
          id?: string
          meeting_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "team_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_daily: {
        Row: {
          created_at: string | null
          date: string
          dimensions: Json
          kpi: string
          value: number
        }
        Insert: {
          created_at?: string | null
          date: string
          dimensions?: Json
          kpi: string
          value: number
        }
        Update: {
          created_at?: string | null
          date?: string
          dimensions?: Json
          kpi?: string
          value?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          content_rich: string | null
          created_at: string
          id: string
          is_private: boolean
          owner_id: string
          shared_with_roles: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          content_rich?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          owner_id: string
          shared_with_roles?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          content_rich?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          owner_id?: string
          shared_with_roles?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          do_not_disturb_end: string | null
          do_not_disturb_start: string | null
          email_notifications: boolean | null
          id: string
          in_app_notifications: boolean | null
          notification_frequency: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          do_not_disturb_end?: string | null
          do_not_disturb_start?: string | null
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          notification_frequency?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          do_not_disturb_end?: string | null
          do_not_disturb_start?: string | null
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          notification_frequency?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token_encrypted: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_refs: {
        Row: {
          created_at: string
          id: string
          item_ref: string
          label: string
          metadata: Json | null
          provider: string
          updated_at: string
          user_id: string
          vault_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_ref: string
          label: string
          metadata?: Json | null
          provider: string
          updated_at?: string
          user_id: string
          vault_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_ref?: string
          label?: string
          metadata?: Json | null
          provider?: string
          updated_at?: string
          user_id?: string
          vault_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_refs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "password_refs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_tickets: {
        Row: {
          created_at: string | null
          id: string
          problem_id: string | null
          relationship_type: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          problem_id?: string | null
          relationship_type?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          problem_id?: string | null
          relationship_type?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_tickets_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          assigned_team_id: string | null
          closed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_md: string | null
          resolved_at: string | null
          root_cause: string | null
          status: string | null
          title: string
          updated_at: string | null
          workaround_md: string | null
        }
        Insert: {
          assigned_team_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_md?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          workaround_md?: string | null
        }
        Update: {
          assigned_team_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_md?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          workaround_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problems_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "problems_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string | null
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          role?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string | null
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          added_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          start_date: string | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["reminder_status"] | null
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json
          run_at: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_approvals: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          comments: string | null
          created_at: string | null
          id: string
          request_id: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          step_order: number | null
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          created_at?: string | null
          id?: string
          request_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          step_order?: number | null
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          created_at?: string | null
          id?: string
          request_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          step_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "request_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "request_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          request_id: string | null
          sort_order: number | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          request_id?: string | null
          sort_order?: number | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          request_id?: string | null
          sort_order?: number | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "request_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          answers: Json | null
          approval_state: Json | null
          assigned_to: string | null
          catalog_item_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          requester_id: string | null
          sla_snapshot: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          answers?: Json | null
          approval_state?: Json | null
          assigned_to?: string | null
          catalog_item_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          requester_id?: string | null
          sla_snapshot?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          answers?: Json | null
          approval_state?: Json | null
          assigned_to?: string | null
          catalog_item_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          requester_id?: string | null
          sla_snapshot?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      response_templates: {
        Row: {
          audience: string | null
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          audience?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          audience?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_team_id: string | null
          sla_policy_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_team_id?: string | null
          sla_policy_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_team_id?: string | null
          sla_policy_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_escalations: {
        Row: {
          actions: Json | null
          escalation_level: number
          id: string
          is_active: boolean | null
          notify_roles: string[] | null
          notify_users: string[] | null
          sla_policy_id: string
          threshold_percentage: number
        }
        Insert: {
          actions?: Json | null
          escalation_level: number
          id?: string
          is_active?: boolean | null
          notify_roles?: string[] | null
          notify_users?: string[] | null
          sla_policy_id: string
          threshold_percentage: number
        }
        Update: {
          actions?: Json | null
          escalation_level?: number
          id?: string
          is_active?: boolean | null
          notify_roles?: string[] | null
          notify_users?: string[] | null
          sla_policy_id?: string
          threshold_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_escalations_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_events: {
        Row: {
          created_at: string | null
          due_at: string | null
          escalation_level: number | null
          event_type: Database["public"]["Enums"]["sla_event_type"]
          id: string
          metadata: Json | null
          sla_policy_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          due_at?: string | null
          escalation_level?: number | null
          event_type: Database["public"]["Enums"]["sla_event_type"]
          id?: string
          metadata?: Json | null
          sla_policy_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          due_at?: string | null
          escalation_level?: number | null
          event_type?: Database["public"]["Enums"]["sla_event_type"]
          id?: string
          metadata?: Json | null
          sla_policy_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_events_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_metrics: {
        Row: {
          assigned_agent_id: string | null
          created_at: string
          first_response_at: string | null
          first_response_breach_minutes: number | null
          first_response_by: string | null
          first_response_duration_minutes: number | null
          first_response_met: boolean | null
          first_response_target_minutes: number | null
          id: string
          last_calculated_at: string | null
          overall_breach: boolean | null
          resolution_breach_minutes: number | null
          resolution_duration_minutes: number | null
          resolution_met: boolean | null
          resolution_target_minutes: number | null
          resolved_at: string | null
          resolved_by: string | null
          sla_status: string | null
          ticket_category: string | null
          ticket_created_at: string
          ticket_id: string
          ticket_priority: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          created_at?: string
          first_response_at?: string | null
          first_response_breach_minutes?: number | null
          first_response_by?: string | null
          first_response_duration_minutes?: number | null
          first_response_met?: boolean | null
          first_response_target_minutes?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_breach?: boolean | null
          resolution_breach_minutes?: number | null
          resolution_duration_minutes?: number | null
          resolution_met?: boolean | null
          resolution_target_minutes?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sla_status?: string | null
          ticket_category?: string | null
          ticket_created_at: string
          ticket_id: string
          ticket_priority?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          created_at?: string
          first_response_at?: string | null
          first_response_breach_minutes?: number | null
          first_response_by?: string | null
          first_response_duration_minutes?: number | null
          first_response_met?: boolean | null
          first_response_target_minutes?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_breach?: boolean | null
          resolution_breach_minutes?: number | null
          resolution_duration_minutes?: number | null
          resolution_met?: boolean | null
          resolution_target_minutes?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          sla_status?: string | null
          ticket_category?: string | null
          ticket_created_at?: string
          ticket_id?: string
          ticket_priority?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_metrics_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "sla_metrics_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_metrics_first_response_by_fkey"
            columns: ["first_response_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "sla_metrics_first_response_by_fkey"
            columns: ["first_response_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_metrics_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "sla_metrics_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_metrics_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_metrics_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_metrics_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          business_hours_only: boolean | null
          conditions: Json
          created_at: string | null
          description: string | null
          first_response_minutes: number
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          resolution_hours: number
        }
        Insert: {
          business_hours_only?: boolean | null
          conditions?: Json
          created_at?: string | null
          description?: string | null
          first_response_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          resolution_hours?: number
        }
        Update: {
          business_hours_only?: boolean | null
          conditions?: Json
          created_at?: string | null
          description?: string | null
          first_response_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          resolution_hours?: number
        }
        Relationships: []
      }
      sla_timers: {
        Row: {
          created_at: string | null
          id: string
          pause_duration_seconds: number | null
          paused_at: string | null
          resolve_breached: boolean | null
          resolve_due_at: string | null
          response_breached: boolean | null
          response_due_at: string | null
          ticket_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pause_duration_seconds?: number | null
          paused_at?: string | null
          resolve_breached?: boolean | null
          resolve_due_at?: string | null
          response_breached?: boolean | null
          response_due_at?: string | null
          ticket_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pause_duration_seconds?: number | null
          paused_at?: string | null
          resolve_breached?: boolean | null
          resolve_due_at?: string | null
          response_breached?: boolean | null
          response_due_at?: string | null
          ticket_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_timers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_timers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_timers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_group_roles: {
        Row: {
          group_name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          group_name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          group_name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      staff_log_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          id: string
          log_id: string
          notes: string | null
          role: Database["public"]["Enums"]["assignment_role"]
          staff_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          id?: string
          log_id: string
          notes?: string | null
          role?: Database["public"]["Enums"]["assignment_role"]
          staff_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          id?: string
          log_id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["assignment_role"]
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_assignments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_attachments: {
        Row: {
          comment_id: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          log_id: string | null
          metadata: Json | null
          previous_version_id: string | null
          storage_bucket: string | null
          storage_path: string
          thumbnail_path: string | null
          uploaded_at: string
          uploaded_by: string
          version: number | null
        }
        Insert: {
          comment_id?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          log_id?: string | null
          metadata?: Json | null
          previous_version_id?: string | null
          storage_bucket?: string | null
          storage_path: string
          thumbnail_path?: string | null
          uploaded_at?: string
          uploaded_by: string
          version?: number | null
        }
        Update: {
          comment_id?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          log_id?: string | null
          metadata?: Json | null
          previous_version_id?: string | null
          storage_bucket?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          uploaded_at?: string
          uploaded_by?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "staff_log_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_attachments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_attachments_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "staff_log_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          has_attachments: boolean | null
          id: string
          is_internal: boolean | null
          log_id: string
          mentions: string[] | null
          parent_comment_id: string | null
          reactions: Json | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_internal?: boolean | null
          log_id: string
          mentions?: string[] | null
          parent_comment_id?: string | null
          reactions?: Json | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_internal?: boolean | null
          log_id?: string
          mentions?: string[] | null
          parent_comment_id?: string | null
          reactions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_comments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "staff_log_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_notifications: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          link: string | null
          log_id: string
          message: string | null
          metadata: Json | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          link?: string | null
          log_id: string
          message?: string | null
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          link?: string | null
          log_id?: string
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_notifications_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_related: {
        Row: {
          created_at: string
          created_by: string | null
          log_id: string
          related_log_id: string
          relationship_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          log_id: string
          related_log_id: string
          relationship_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          log_id?: string
          related_log_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_related_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_related_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_related_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_related_related_log_id_fkey"
            columns: ["related_log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      staff_log_templates: {
        Row: {
          category: Database["public"]["Enums"]["log_category"] | null
          created_at: string
          created_by: string
          default_priority: Database["public"]["Enums"]["log_priority"] | null
          default_tags: string[] | null
          description: string | null
          description_template: string | null
          id: string
          is_shared: boolean | null
          log_type: Database["public"]["Enums"]["log_type"]
          name: string
          required_fields: string[] | null
          team_only: boolean | null
          technical_details: Json | null
          title_template: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["log_category"] | null
          created_at?: string
          created_by: string
          default_priority?: Database["public"]["Enums"]["log_priority"] | null
          default_tags?: string[] | null
          description?: string | null
          description_template?: string | null
          id?: string
          is_shared?: boolean | null
          log_type: Database["public"]["Enums"]["log_type"]
          name: string
          required_fields?: string[] | null
          team_only?: boolean | null
          technical_details?: Json | null
          title_template?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["log_category"] | null
          created_at?: string
          created_by?: string
          default_priority?: Database["public"]["Enums"]["log_priority"] | null
          default_tags?: string[] | null
          description?: string | null
          description_template?: string | null
          id?: string
          is_shared?: boolean | null
          log_type?: Database["public"]["Enums"]["log_type"]
          name?: string
          required_fields?: string[] | null
          team_only?: boolean | null
          technical_details?: Json | null
          title_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_time_tracking: {
        Row: {
          created_at: string
          description: string | null
          duration: unknown
          ended_at: string | null
          id: string
          is_billable: boolean | null
          log_id: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: unknown
          ended_at?: string | null
          id?: string
          is_billable?: boolean | null
          log_id: string
          started_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: unknown
          ended_at?: string | null
          id?: string
          is_billable?: boolean | null
          log_id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_time_tracking_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_time_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_time_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_log_watchers: {
        Row: {
          added_at: string
          added_by: string | null
          log_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          log_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_log_watchers_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_watchers_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_watchers_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_log_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_log_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_logs: {
        Row: {
          affected_systems: string[] | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["log_category"]
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          environment: Database["public"]["Enums"]["log_environment"] | null
          first_response_at: string | null
          first_response_by: string | null
          id: string
          log_number: number
          log_type: Database["public"]["Enums"]["log_type"]
          metadata: Json | null
          parent_log_id: string | null
          priority: Database["public"]["Enums"]["log_priority"]
          project_name: string | null
          related_ticket_ids: string[] | null
          resolution_steps: string | null
          resolution_time: unknown
          resolved_at: string | null
          resolved_by: string | null
          search_vector: unknown
          severity_level: number | null
          sla_breach: boolean | null
          software_component: string | null
          status: Database["public"]["Enums"]["log_status"]
          tags: string[] | null
          technical_details: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_systems?: string[] | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["log_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          environment?: Database["public"]["Enums"]["log_environment"] | null
          first_response_at?: string | null
          first_response_by?: string | null
          id?: string
          log_number?: number
          log_type?: Database["public"]["Enums"]["log_type"]
          metadata?: Json | null
          parent_log_id?: string | null
          priority?: Database["public"]["Enums"]["log_priority"]
          project_name?: string | null
          related_ticket_ids?: string[] | null
          resolution_steps?: string | null
          resolution_time?: unknown
          resolved_at?: string | null
          resolved_by?: string | null
          search_vector?: unknown
          severity_level?: number | null
          sla_breach?: boolean | null
          software_component?: string | null
          status?: Database["public"]["Enums"]["log_status"]
          tags?: string[] | null
          technical_details?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_systems?: string[] | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["log_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          environment?: Database["public"]["Enums"]["log_environment"] | null
          first_response_at?: string | null
          first_response_by?: string | null
          id?: string
          log_number?: number
          log_type?: Database["public"]["Enums"]["log_type"]
          metadata?: Json | null
          parent_log_id?: string | null
          priority?: Database["public"]["Enums"]["log_priority"]
          project_name?: string | null
          related_ticket_ids?: string[] | null
          resolution_steps?: string | null
          resolution_time?: unknown
          resolved_at?: string | null
          resolved_by?: string | null
          search_vector?: unknown
          severity_level?: number | null
          sla_breach?: boolean | null
          software_component?: string | null
          status?: Database["public"]["Enums"]["log_status"]
          tags?: string[] | null
          technical_details?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_logs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_logs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_logs_first_response_by_fkey"
            columns: ["first_response_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_logs_first_response_by_fkey"
            columns: ["first_response_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_logs_parent_log_id_fkey"
            columns: ["parent_log_id"]
            isOneToOne: false
            referencedRelation: "staff_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "staff_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_channels: {
        Row: {
          auto_create_ticket: boolean | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          auto_create_ticket?: boolean | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          auto_create_ticket?: boolean | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          comparison_operator: string | null
          component_name: string
          created_at: string | null
          created_by: string | null
          error_threshold: number | null
          id: string
          is_enabled: boolean | null
          metric_name: string
          notification_channels: Json | null
          updated_at: string | null
          warning_threshold: number | null
        }
        Insert: {
          alert_type: string
          comparison_operator?: string | null
          component_name: string
          created_at?: string | null
          created_by?: string | null
          error_threshold?: number | null
          id?: string
          is_enabled?: boolean | null
          metric_name: string
          notification_channels?: Json | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Update: {
          alert_type?: string
          comparison_operator?: string | null
          component_name?: string
          created_at?: string | null
          created_by?: string | null
          error_threshold?: number | null
          id?: string
          is_enabled?: boolean | null
          metric_name?: string
          notification_channels?: Json | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "system_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_logs: {
        Row: {
          check_type: string
          checked_at: string
          component_name: string
          created_at: string | null
          error_details: Json | null
          id: string
          latency_ms: number | null
          message: string
          metrics: Json | null
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          component_name: string
          created_at?: string | null
          error_details?: Json | null
          id?: string
          latency_ms?: number | null
          message: string
          metrics?: Json | null
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          component_name?: string
          created_at?: string | null
          error_details?: Json | null
          id?: string
          latency_ms?: number | null
          message?: string
          metrics?: Json | null
          status?: string
        }
        Relationships: []
      }
      system_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          affected_users: number | null
          component_name: string
          created_at: string | null
          description: string | null
          detected_at: string
          id: string
          related_logs: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_users?: number | null
          component_name: string
          created_at?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          related_logs?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_users?: number | null
          component_name?: string
          created_at?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          related_logs?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "system_incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "system_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          created_at: string | null
          dimensions: Json | null
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          unit?: string | null
        }
        Relationships: []
      }
      task_watchers: {
        Row: {
          added_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_watchers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "task_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by_id: string
          description: string | null
          due_at: string | null
          estimate_hours: number | null
          id: string
          parent_task_id: string | null
          priority: string
          project_id: string | null
          status: string
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by_id: string
          description?: string | null
          due_at?: string | null
          estimate_hours?: number | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by_id?: string
          description?: string | null
          due_at?: string | null
          estimate_hours?: number | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tasks_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_activities: {
        Row: {
          action_type: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      team_announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_pinned: boolean | null
          priority: string
          target_roles: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean | null
          priority?: string
          target_roles?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean | null
          priority?: string
          target_roles?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_meetings: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_link: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_presence: {
        Row: {
          id: string
          last_seen_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_actions: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          payload: Json | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          size_bytes: number | null
          ticket_id: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          size_bytes?: number | null
          ticket_id?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          size_bytes?: number | null
          ticket_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          ticket_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          ticket_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_files: {
        Row: {
          created_at: string | null
          file_size: number | null
          filename: string
          id: string
          mime_type: string | null
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          filename: string
          id?: string
          mime_type?: string | null
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_files_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_files_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_files_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string
          ticket_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          ticket_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          ticket_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_read_status: {
        Row: {
          created_at: string | null
          id: string
          last_read_at: string | null
          ticket_id: string
          unread_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          ticket_id: string
          unread_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          ticket_id?: string
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_read_status_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_read_status_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_read_status_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          comment: string | null
          created_at: string | null
          id: string
          new_status: Database["public"]["Enums"]["ticket_status"]
          old_status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Insert: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["ticket_status"]
          old_status?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Update: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["ticket_status"]
          old_status?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          created_at: string | null
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          advisor_id: string | null
          advisor_id_optional: string | null
          agent_id: string | null
          agent_name: string | null
          app_version: string | null
          assigned_group: string | null
          assignee_id: string | null
          attachments: string[] | null
          browser: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          impact: string | null
          last_message_at: string | null
          member_id: string | null
          member_id_optional: string | null
          metadata: Json | null
          origin: string
          platform: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          queue: string | null
          related_urls: string[] | null
          requester_id: string | null
          response_count: number | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          service_id: string | null
          sla_due_at: string | null
          sla_minutes: number | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory: string | null
          subject: string
          submitted_by_concierge: string | null
          submitter_email: string | null
          submitter_name: string | null
          submitter_phone: string | null
          type: Database["public"]["Enums"]["ticket_type"] | null
          updated_at: string | null
          urgency: string | null
          urls: string[] | null
        }
        Insert: {
          advisor_id?: string | null
          advisor_id_optional?: string | null
          agent_id?: string | null
          agent_name?: string | null
          app_version?: string | null
          assigned_group?: string | null
          assignee_id?: string | null
          attachments?: string[] | null
          browser?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          last_message_at?: string | null
          member_id?: string | null
          member_id_optional?: string | null
          metadata?: Json | null
          origin?: string
          platform?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          queue?: string | null
          related_urls?: string[] | null
          requester_id?: string | null
          response_count?: number | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          service_id?: string | null
          sla_due_at?: string | null
          sla_minutes?: number | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory?: string | null
          subject: string
          submitted_by_concierge?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          type?: Database["public"]["Enums"]["ticket_type"] | null
          updated_at?: string | null
          urgency?: string | null
          urls?: string[] | null
        }
        Update: {
          advisor_id?: string | null
          advisor_id_optional?: string | null
          agent_id?: string | null
          agent_name?: string | null
          app_version?: string | null
          assigned_group?: string | null
          assignee_id?: string | null
          attachments?: string[] | null
          browser?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          last_message_at?: string | null
          member_id?: string | null
          member_id_optional?: string | null
          metadata?: Json | null
          origin?: string
          platform?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          queue?: string | null
          related_urls?: string[] | null
          requester_id?: string | null
          response_count?: number | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          service_id?: string | null
          sla_due_at?: string | null
          sla_minutes?: number | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory?: string | null
          subject?: string
          submitted_by_concierge?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          type?: Database["public"]["Enums"]["ticket_type"] | null
          updated_at?: string | null
          urgency?: string | null
          urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          language_pref: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          language_pref?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          language_pref?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          logs: Json | null
          started_at: string | null
          status: string | null
          steps_completed: Json | null
          trigger_data: Json | null
          triggered_by: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          logs?: Json | null
          started_at?: string | null
          status?: string | null
          steps_completed?: Json | null
          trigger_data?: Json | null
          triggered_by?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          logs?: Json | null
          started_at?: string | null
          status?: string | null
          steps_completed?: Json | null
          trigger_data?: Json | null
          triggered_by?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_execution_stats"
            referencedColumns: ["workflow_id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          max_retries: number | null
          processed_at: string | null
          retry_count: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type: string
          id?: string
          max_retries?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          max_retries?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          created_at: string | null
          id: string
          sort_order: number | null
          step_config: Json
          step_type: string
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          sort_order?: number | null
          step_config?: Json
          step_type: string
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          sort_order?: number | null
          step_config?: Json
          step_type?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_execution_stats"
            referencedColumns: ["workflow_id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_chat_sessions: {
        Row: {
          agent_email: string | null
          agent_name: string | null
          assigned_agent_id: string | null
          customer_email: string | null
          customer_name: string | null
          ended_at: string | null
          id: string | null
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["chat_status"] | null
          ticket_id: string | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "my_accessible_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_unread"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_activity_summary: {
        Row: {
          channel_id: string | null
          channel_type: Database["public"]["Enums"]["channel_type"] | null
          last_activity: string | null
          messages_24h: number | null
          name: string | null
          tickets_created: number | null
          total_messages: number | null
        }
        Relationships: []
      }
      chat_analytics_by_agent: {
        Row: {
          active_sessions: number | null
          agent_email: string | null
          agent_id: string | null
          agent_name: string | null
          avg_messages_per_session: number | null
          avg_satisfaction_rating: number | null
          avg_session_duration_minutes: number | null
          completed_sessions: number | null
          total_messages_sent: number | null
          total_sessions: number | null
        }
        Relationships: []
      }
      chat_response_time_analytics: {
        Row: {
          agent_messages: number | null
          assigned_agent_id: string | null
          customer_messages: number | null
          first_agent_response: string | null
          first_response_minutes: number | null
          session_id: string | null
          started_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "chat_sessions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      my_accessible_tickets: {
        Row: {
          advisor_id: string | null
          advisor_id_optional: string | null
          agent_id: string | null
          agent_name: string | null
          app_version: string | null
          assigned_group: string | null
          assignee_email: string | null
          assignee_id: string | null
          assignee_name: string | null
          attachments: string[] | null
          browser: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          impact: string | null
          last_message_at: string | null
          member_id: string | null
          member_id_optional: string | null
          metadata: Json | null
          origin: string | null
          platform: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          queue: string | null
          related_urls: string[] | null
          requester_email: string | null
          requester_id: string | null
          requester_name: string | null
          response_count: number | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          service_id: string | null
          sla_due_at: string | null
          sla_minutes: number | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory: string | null
          subject: string | null
          submitted_by_concierge: string | null
          submitter_email: string | null
          submitter_name: string | null
          submitter_phone: string | null
          type: Database["public"]["Enums"]["ticket_type"] | null
          unread_count: number | null
          updated_at: string | null
          urgency: string | null
          urls: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_compliance_dashboard: {
        Row: {
          breached_count: number | null
          compliance_rate: number | null
          met_count: number | null
          policy_name: string | null
          total_tickets: number | null
        }
        Relationships: []
      }
      tickets_with_unread: {
        Row: {
          advisor_id: string | null
          advisor_id_optional: string | null
          agent_id: string | null
          agent_name: string | null
          app_version: string | null
          assigned_group: string | null
          assignee_id: string | null
          attachments: string[] | null
          browser: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          impact: string | null
          last_message_at: string | null
          last_read_at: string | null
          member_id: string | null
          member_id_optional: string | null
          metadata: Json | null
          origin: string | null
          platform: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          queue: string | null
          related_urls: string[] | null
          requester_id: string | null
          response_count: number | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          service_id: string | null
          sla_due_at: string | null
          sla_minutes: number | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory: string | null
          subject: string | null
          submitted_by_concierge: string | null
          submitter_email: string | null
          submitter_name: string | null
          submitter_phone: string | null
          type: Database["public"]["Enums"]["ticket_type"] | null
          unread_count: number | null
          updated_at: string | null
          urgency: string | null
          urls: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "chat_analytics_by_agent"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tickets_submitted_by_concierge_fkey"
            columns: ["submitted_by_concierge"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_execution_stats: {
        Row: {
          failed_executions: number | null
          last_execution: string | null
          successful_executions: number | null
          total_executions: number | null
          workflow_id: string | null
          workflow_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_role_from_groups: {
        Args: { groups: string[]; u: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      calculate_sla_metrics: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      calculate_system_uptime: {
        Args: {
          p_component_name: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          error_checks: number
          healthy_checks: number
          total_checks: number
          uptime_percentage: number
          warning_checks: number
        }[]
      }
      cleanup_old_health_logs: { Args: never; Returns: number }
      cleanup_stale_presence: { Args: never; Returns: undefined }
      create_staff_log_notification: {
        Args: {
          p_log_id: string
          p_message?: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      decrypt_token: {
        Args: { encrypted_token: string; secret: string }
        Returns: string
      }
      encrypt_token: {
        Args: { secret: string; token: string }
        Returns: string
      }
      get_agent_sla_performance: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          agent_email: string
          agent_id: string
          agent_name: string
          avg_first_response_minutes: number
          avg_resolution_minutes: number
          first_response_met: number
          first_response_percentage: number
          resolution_met: number
          resolution_percentage: number
          total_tickets: number
        }[]
      }
      get_agent_workload: { Args: { agent_id: string }; Returns: number }
      get_component_status_summary: {
        Args: never
        Returns: {
          avg_latency_24h: number
          component_name: string
          current_status: string
          incident_count_24h: number
          last_check: string
          uptime_24h: number
        }[]
      }
      get_least_busy_agent: {
        Args: { ticket_category?: string }
        Returns: string
      }
      get_sla_compliance_percentage: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          first_response_met: number
          first_response_percentage: number
          overall_met: number
          overall_percentage: number
          resolution_met: number
          resolution_percentage: number
          total_tickets: number
        }[]
      }
      get_system_health_trends: {
        Args: { p_hours?: number }
        Returns: {
          avg_latency_ms: number
          component_name: string
          hour_bucket: string
          status_counts: Json
        }[]
      }
      has_role:
        | { Args: { role_in: string }; Returns: boolean }
        | { Args: { r: string; u: string }; Returns: boolean }
        | {
            Args: { r: Database["public"]["Enums"]["user_role"]; u: string }
            Returns: boolean
          }
      insert_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_details?: Json
          p_ip?: string
          p_target_user_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      is_super_admin: { Args: never; Returns: boolean }
      map_role_from_groups: {
        Args: { groups: string[] }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      match_kb_docs: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_knowledge_articles: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          category_id: string
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_sla_policy: { Args: { ticket_data: Json }; Returns: string }
      role_at_least:
        | { Args: { min_role: string; u: string }; Returns: boolean }
        | {
            Args: {
              min_role: Database["public"]["Enums"]["user_role"]
              u: string
            }
            Returns: boolean
          }
      role_rank:
        | {
            Args: { r: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.role_rank(r => text), public.role_rank(r => user_role). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { r: Database["public"]["Enums"]["user_role"] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.role_rank(r => text), public.role_rank(r => user_role). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      trigger_workflows_for_event: {
        Args: { p_event_data: Json; p_event_type: string }
        Returns: undefined
      }
      validate_free_text: { Args: { txt: string }; Returns: boolean }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      assignment_role: "owner" | "contributor" | "reviewer" | "watcher"
      change_risk: "low" | "medium" | "high" | "critical"
      change_type: "standard" | "normal" | "emergency"
      channel_type: "email" | "chat" | "sms" | "phone" | "social" | "web"
      chat_status: "waiting" | "active" | "ended"
      ci_class:
        | "server"
        | "application"
        | "database"
        | "network"
        | "storage"
        | "service"
        | "other"
      environment: "production" | "staging" | "development" | "test"
      log_category:
        | "bug"
        | "feature"
        | "maintenance"
        | "security"
        | "deployment"
        | "documentation"
        | "infrastructure"
        | "performance"
        | "other"
      log_environment: "production" | "staging" | "development" | "testing"
      log_priority: "low" | "normal" | "high" | "urgent" | "critical"
      log_status:
        | "new"
        | "in_progress"
        | "blocked"
        | "review"
        | "resolved"
        | "closed"
        | "archived"
      log_type:
        | "ticket"
        | "note"
        | "fix"
        | "update"
        | "project"
        | "issue"
        | "documentation"
        | "deployment"
        | "security"
        | "maintenance"
      reminder_status: "scheduled" | "completed" | "failed"
      sender_type: "customer" | "agent" | "system"
      sla_event_type:
        | "started"
        | "paused"
        | "resumed"
        | "breached"
        | "escalated"
        | "met"
      ticket_origin: "member" | "advisor" | "staff" | "concierge"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "new" | "open" | "pending" | "resolved" | "closed"
      ticket_type: "incident" | "request" | "problem" | "change"
      trigger_type:
        | "ticket.created"
        | "ticket.updated"
        | "request.submitted"
        | "change.scheduled"
        | "schedule.cron"
      user_role:
        | "member"
        | "advisor"
        | "staff"
        | "agent"
        | "admin"
        | "super_admin"
        | "concierge"
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
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      assignment_role: ["owner", "contributor", "reviewer", "watcher"],
      change_risk: ["low", "medium", "high", "critical"],
      change_type: ["standard", "normal", "emergency"],
      channel_type: ["email", "chat", "sms", "phone", "social", "web"],
      chat_status: ["waiting", "active", "ended"],
      ci_class: [
        "server",
        "application",
        "database",
        "network",
        "storage",
        "service",
        "other",
      ],
      environment: ["production", "staging", "development", "test"],
      log_category: [
        "bug",
        "feature",
        "maintenance",
        "security",
        "deployment",
        "documentation",
        "infrastructure",
        "performance",
        "other",
      ],
      log_environment: ["production", "staging", "development", "testing"],
      log_priority: ["low", "normal", "high", "urgent", "critical"],
      log_status: [
        "new",
        "in_progress",
        "blocked",
        "review",
        "resolved",
        "closed",
        "archived",
      ],
      log_type: [
        "ticket",
        "note",
        "fix",
        "update",
        "project",
        "issue",
        "documentation",
        "deployment",
        "security",
        "maintenance",
      ],
      reminder_status: ["scheduled", "completed", "failed"],
      sender_type: ["customer", "agent", "system"],
      sla_event_type: [
        "started",
        "paused",
        "resumed",
        "breached",
        "escalated",
        "met",
      ],
      ticket_origin: ["member", "advisor", "staff", "concierge"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["new", "open", "pending", "resolved", "closed"],
      ticket_type: ["incident", "request", "problem", "change"],
      trigger_type: [
        "ticket.created",
        "ticket.updated",
        "request.submitted",
        "change.scheduled",
        "schedule.cron",
      ],
      user_role: [
        "member",
        "advisor",
        "staff",
        "agent",
        "admin",
        "super_admin",
        "concierge",
      ],
    },
  },
} as const
