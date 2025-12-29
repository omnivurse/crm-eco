export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      advisors: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string | null;
          parent_advisor_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          license_number: string | null;
          license_states: string[];
          status: string;
          commission_tier: string | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id?: string | null;
          parent_advisor_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          license_number?: string | null;
          license_states?: string[];
          status?: string;
          commission_tier?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          profile_id?: string | null;
          parent_advisor_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          license_number?: string | null;
          license_states?: string[];
          status?: string;
          commission_tier?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      members: {
        Row: {
          id: string;
          organization_id: string;
          advisor_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          date_of_birth: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          status: string;
          plan_name: string | null;
          plan_type: string | null;
          effective_date: string | null;
          termination_date: string | null;
          monthly_share: number | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          advisor_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          date_of_birth?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          status?: string;
          plan_name?: string | null;
          plan_type?: string | null;
          effective_date?: string | null;
          termination_date?: string | null;
          monthly_share?: number | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          advisor_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          date_of_birth?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          status?: string;
          plan_name?: string | null;
          plan_type?: string | null;
          effective_date?: string | null;
          termination_date?: string | null;
          monthly_share?: number | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          advisor_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          source: string | null;
          status: string;
          notes: string | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          advisor_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          source?: string | null;
          status?: string;
          notes?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          advisor_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          source?: string | null;
          status?: string;
          notes?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          description: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          profile_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          organization_id: string;
          created_by_profile_id: string;
          assigned_to_profile_id: string | null;
          member_id: string | null;
          advisor_id: string | null;
          agency_name: string | null;
          category: string;
          subject: string;
          description: string;
          status: string;
          priority: string;
          sla_target_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by_profile_id: string;
          assigned_to_profile_id?: string | null;
          member_id?: string | null;
          advisor_id?: string | null;
          agency_name?: string | null;
          category: string;
          subject: string;
          description: string;
          status?: string;
          priority?: string;
          sla_target_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by_profile_id?: string;
          assigned_to_profile_id?: string | null;
          member_id?: string | null;
          advisor_id?: string | null;
          agency_name?: string | null;
          category?: string;
          subject?: string;
          description?: string;
          status?: string;
          priority?: string;
          sla_target_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          created_by_profile_id: string;
          is_internal: boolean;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          created_by_profile_id: string;
          is_internal?: boolean;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          created_by_profile_id?: string;
          is_internal?: boolean;
          body?: string;
          created_at?: string;
        };
      };
      needs: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          advisor_id: string | null;
          need_type: string;
          description: string;
          total_amount: number;
          iua_amount: number;
          eligible_amount: number;
          reimbursed_amount: number;
          status: string;
          urgency_light: string;
          sla_target_date: string | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          advisor_id?: string | null;
          need_type: string;
          description: string;
          total_amount?: number;
          iua_amount?: number;
          eligible_amount?: number;
          reimbursed_amount?: number;
          status?: string;
          urgency_light?: string;
          sla_target_date?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          member_id?: string;
          advisor_id?: string | null;
          need_type?: string;
          description?: string;
          total_amount?: number;
          iua_amount?: number;
          eligible_amount?: number;
          reimbursed_amount?: number;
          status?: string;
          urgency_light?: string;
          sla_target_date?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      need_events: {
        Row: {
          id: string;
          need_id: string;
          event_type: string;
          description: string | null;
          metadata: Json;
          created_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          need_id: string;
          event_type: string;
          description?: string | null;
          metadata?: Json;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          need_id?: string;
          event_type?: string;
          description?: string | null;
          metadata?: Json;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
      };
      custom_field_definitions: {
        Row: {
          id: string;
          organization_id: string;
          entity_type: string;
          field_name: string;
          field_type: string;
          field_label: string;
          options: Json;
          is_required: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          entity_type: string;
          field_name: string;
          field_type: string;
          field_label: string;
          options?: Json;
          is_required?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          entity_type?: string;
          field_name?: string;
          field_type?: string;
          field_label?: string;
          options?: Json;
          is_required?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

