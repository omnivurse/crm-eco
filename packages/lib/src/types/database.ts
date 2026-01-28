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
      _import_contacts_staging: {
        Row: {
          account_number: string | null
          account_type: string | null
          add_on_product: string | null
          admin123: string | null
          affiliate: string | null
          affiliate_referral: string | null
          affiliate_rep_monthly: string | null
          amount_received: string | null
          atap: string | null
          average_time_spent_minutes: string | null
          birth_month: string | null
          business_or_practice_name: string | null
          cancellation_date: string | null
          carrier: string | null
          change_log_time: string | null
          charge_waived: string | null
          child_1: string | null
          child_1_address: string | null
          child_1_dob: string | null
          child_1_email: string | null
          child_1_phone_number: string | null
          child_1_ss_number: string | null
          child_2: string | null
          child_2_address: string | null
          child_2_dob: string | null
          child_2_email: string | null
          child_2_phone_number: string | null
          child_2_ss_number: string | null
          child_3: string | null
          child_3_address: string | null
          child_3_dob: string | null
          child_3_email: string | null
          child_3_phone_number: string | null
          child_3_ss_number: string | null
          child_4: string | null
          child_4_address: string | null
          child_4_dob: string | null
          child_4_email: string | null
          child_4_phone_number: string | null
          child_4_ss_number: string | null
          child_5: string | null
          child_5_address: string | null
          child_5_dob: string | null
          child_5_email: string | null
          child_5_phone_number: string | null
          child_5_ss_number: string | null
          cirrus_registration_date: string | null
          commission_percentage: string | null
          company_association: string | null
          complete_date: string | null
          connected_to_id: string | null
          connected_to_module: string | null
          contact_name: string | null
          contact_owner: string | null
          contact_owner_id: string | null
          contact_status: string | null
          coverage_option: string | null
          created_by: string | null
          created_by_id: string | null
          created_time: string | null
          currency: string | null
          data_processing_basis: string | null
          data_processing_basis_id: string | null
          data_source: string | null
          date_of_birth: string | null
          date_referral_paid: string | null
          days_visited: string | null
          declined: string | null
          dental: string | null
          director: string | null
          director_monthly: string | null
          director_referral: string | null
          dpc_name: string | null
          e123_member_id: string | null
          email: string | null
          email_opt_out: string | null
          enrich_status: string | null
          exchange_rate: string | null
          fax: string | null
          first_name: string | null
          first_page_visited: string | null
          first_visit: string | null
          fulfillment_email_sent: string | null
          fulfillment_letter_mailed: string | null
          household_annual_adj_gross: string | null
          iua_amount: string | null
          last_activity_time: string | null
          last_enriched_time: string | null
          last_name: string | null
          lead_source: string | null
          life_code_2nd: string | null
          life_code_3rd: string | null
          life_code_4th: string | null
          life_code_5th: string | null
          locked: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_street: string | null
          mailing_zip: string | null
          marital_status: string | null
          mec_decision_confirmed: string | null
          mec_submitted: string | null
          medical_release_form_on_file: string | null
          middle_initial: string | null
          mobile: string | null
          modified_by: string | null
          modified_by_id: string | null
          modified_time: string | null
          monthly_premium: string | null
          most_recent_visit: string | null
          mpb_app_downloaded: string | null
          mpb_portal_password: string | null
          mpb_portal_username: string | null
          mpb_referral_fee: string | null
          mpower_life_code: string | null
          notes_history: string | null
          number_of_chats: string | null
          payment_method: string | null
          permission_to_discuss_plan: string | null
          phone: string | null
          preferred_method_of_communication: string | null
          previous_product: string | null
          primary_member_gender: string | null
          primary_ss_number: string | null
          producer_commission: string | null
          producer_name: string | null
          producer_name_id: string | null
          product: string | null
          record_id: string | null
          referral_requirement_satisfied: string | null
          referral_source: string | null
          referrer: string | null
          referring_member: string | null
          risk_assessment_paid: string | null
          routing_number: string | null
          row_num: number
          salutation: string | null
          secondary_email: string | null
          select_conversion_completed: string | null
          spouse: string | null
          spouse_address: string | null
          spouse_dob: string | null
          spouse_email: string | null
          spouse_phone_number: string | null
          spouse_ss_number: string | null
          start_date: string | null
          tag: string | null
          team_leader: string | null
          team_leader_monthly: string | null
          team_leader_referral: string | null
          territories: string | null
          third_party_payor: string | null
          title: string | null
          unsubscribed_mode: string | null
          unsubscribed_time: string | null
          vision: string | null
          visitor_score: string | null
          wc_outreach_date: string | null
          welcome_call_performed_by: string | null
          welcome_call_status: string | null
          work_phone: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          add_on_product?: string | null
          admin123?: string | null
          affiliate?: string | null
          affiliate_referral?: string | null
          affiliate_rep_monthly?: string | null
          amount_received?: string | null
          atap?: string | null
          average_time_spent_minutes?: string | null
          birth_month?: string | null
          business_or_practice_name?: string | null
          cancellation_date?: string | null
          carrier?: string | null
          change_log_time?: string | null
          charge_waived?: string | null
          child_1?: string | null
          child_1_address?: string | null
          child_1_dob?: string | null
          child_1_email?: string | null
          child_1_phone_number?: string | null
          child_1_ss_number?: string | null
          child_2?: string | null
          child_2_address?: string | null
          child_2_dob?: string | null
          child_2_email?: string | null
          child_2_phone_number?: string | null
          child_2_ss_number?: string | null
          child_3?: string | null
          child_3_address?: string | null
          child_3_dob?: string | null
          child_3_email?: string | null
          child_3_phone_number?: string | null
          child_3_ss_number?: string | null
          child_4?: string | null
          child_4_address?: string | null
          child_4_dob?: string | null
          child_4_email?: string | null
          child_4_phone_number?: string | null
          child_4_ss_number?: string | null
          child_5?: string | null
          child_5_address?: string | null
          child_5_dob?: string | null
          child_5_email?: string | null
          child_5_phone_number?: string | null
          child_5_ss_number?: string | null
          cirrus_registration_date?: string | null
          commission_percentage?: string | null
          company_association?: string | null
          complete_date?: string | null
          connected_to_id?: string | null
          connected_to_module?: string | null
          contact_name?: string | null
          contact_owner?: string | null
          contact_owner_id?: string | null
          contact_status?: string | null
          coverage_option?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_time?: string | null
          currency?: string | null
          data_processing_basis?: string | null
          data_processing_basis_id?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          date_referral_paid?: string | null
          days_visited?: string | null
          declined?: string | null
          dental?: string | null
          director?: string | null
          director_monthly?: string | null
          director_referral?: string | null
          dpc_name?: string | null
          e123_member_id?: string | null
          email?: string | null
          email_opt_out?: string | null
          enrich_status?: string | null
          exchange_rate?: string | null
          fax?: string | null
          first_name?: string | null
          first_page_visited?: string | null
          first_visit?: string | null
          fulfillment_email_sent?: string | null
          fulfillment_letter_mailed?: string | null
          household_annual_adj_gross?: string | null
          iua_amount?: string | null
          last_activity_time?: string | null
          last_enriched_time?: string | null
          last_name?: string | null
          lead_source?: string | null
          life_code_2nd?: string | null
          life_code_3rd?: string | null
          life_code_4th?: string | null
          life_code_5th?: string | null
          locked?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_street?: string | null
          mailing_zip?: string | null
          marital_status?: string | null
          mec_decision_confirmed?: string | null
          mec_submitted?: string | null
          medical_release_form_on_file?: string | null
          middle_initial?: string | null
          mobile?: string | null
          modified_by?: string | null
          modified_by_id?: string | null
          modified_time?: string | null
          monthly_premium?: string | null
          most_recent_visit?: string | null
          mpb_app_downloaded?: string | null
          mpb_portal_password?: string | null
          mpb_portal_username?: string | null
          mpb_referral_fee?: string | null
          mpower_life_code?: string | null
          notes_history?: string | null
          number_of_chats?: string | null
          payment_method?: string | null
          permission_to_discuss_plan?: string | null
          phone?: string | null
          preferred_method_of_communication?: string | null
          previous_product?: string | null
          primary_member_gender?: string | null
          primary_ss_number?: string | null
          producer_commission?: string | null
          producer_name?: string | null
          producer_name_id?: string | null
          product?: string | null
          record_id?: string | null
          referral_requirement_satisfied?: string | null
          referral_source?: string | null
          referrer?: string | null
          referring_member?: string | null
          risk_assessment_paid?: string | null
          routing_number?: string | null
          row_num?: number
          salutation?: string | null
          secondary_email?: string | null
          select_conversion_completed?: string | null
          spouse?: string | null
          spouse_address?: string | null
          spouse_dob?: string | null
          spouse_email?: string | null
          spouse_phone_number?: string | null
          spouse_ss_number?: string | null
          start_date?: string | null
          tag?: string | null
          team_leader?: string | null
          team_leader_monthly?: string | null
          team_leader_referral?: string | null
          territories?: string | null
          third_party_payor?: string | null
          title?: string | null
          unsubscribed_mode?: string | null
          unsubscribed_time?: string | null
          vision?: string | null
          visitor_score?: string | null
          wc_outreach_date?: string | null
          welcome_call_performed_by?: string | null
          welcome_call_status?: string | null
          work_phone?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          add_on_product?: string | null
          admin123?: string | null
          affiliate?: string | null
          affiliate_referral?: string | null
          affiliate_rep_monthly?: string | null
          amount_received?: string | null
          atap?: string | null
          average_time_spent_minutes?: string | null
          birth_month?: string | null
          business_or_practice_name?: string | null
          cancellation_date?: string | null
          carrier?: string | null
          change_log_time?: string | null
          charge_waived?: string | null
          child_1?: string | null
          child_1_address?: string | null
          child_1_dob?: string | null
          child_1_email?: string | null
          child_1_phone_number?: string | null
          child_1_ss_number?: string | null
          child_2?: string | null
          child_2_address?: string | null
          child_2_dob?: string | null
          child_2_email?: string | null
          child_2_phone_number?: string | null
          child_2_ss_number?: string | null
          child_3?: string | null
          child_3_address?: string | null
          child_3_dob?: string | null
          child_3_email?: string | null
          child_3_phone_number?: string | null
          child_3_ss_number?: string | null
          child_4?: string | null
          child_4_address?: string | null
          child_4_dob?: string | null
          child_4_email?: string | null
          child_4_phone_number?: string | null
          child_4_ss_number?: string | null
          child_5?: string | null
          child_5_address?: string | null
          child_5_dob?: string | null
          child_5_email?: string | null
          child_5_phone_number?: string | null
          child_5_ss_number?: string | null
          cirrus_registration_date?: string | null
          commission_percentage?: string | null
          company_association?: string | null
          complete_date?: string | null
          connected_to_id?: string | null
          connected_to_module?: string | null
          contact_name?: string | null
          contact_owner?: string | null
          contact_owner_id?: string | null
          contact_status?: string | null
          coverage_option?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_time?: string | null
          currency?: string | null
          data_processing_basis?: string | null
          data_processing_basis_id?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          date_referral_paid?: string | null
          days_visited?: string | null
          declined?: string | null
          dental?: string | null
          director?: string | null
          director_monthly?: string | null
          director_referral?: string | null
          dpc_name?: string | null
          e123_member_id?: string | null
          email?: string | null
          email_opt_out?: string | null
          enrich_status?: string | null
          exchange_rate?: string | null
          fax?: string | null
          first_name?: string | null
          first_page_visited?: string | null
          first_visit?: string | null
          fulfillment_email_sent?: string | null
          fulfillment_letter_mailed?: string | null
          household_annual_adj_gross?: string | null
          iua_amount?: string | null
          last_activity_time?: string | null
          last_enriched_time?: string | null
          last_name?: string | null
          lead_source?: string | null
          life_code_2nd?: string | null
          life_code_3rd?: string | null
          life_code_4th?: string | null
          life_code_5th?: string | null
          locked?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_street?: string | null
          mailing_zip?: string | null
          marital_status?: string | null
          mec_decision_confirmed?: string | null
          mec_submitted?: string | null
          medical_release_form_on_file?: string | null
          middle_initial?: string | null
          mobile?: string | null
          modified_by?: string | null
          modified_by_id?: string | null
          modified_time?: string | null
          monthly_premium?: string | null
          most_recent_visit?: string | null
          mpb_app_downloaded?: string | null
          mpb_portal_password?: string | null
          mpb_portal_username?: string | null
          mpb_referral_fee?: string | null
          mpower_life_code?: string | null
          notes_history?: string | null
          number_of_chats?: string | null
          payment_method?: string | null
          permission_to_discuss_plan?: string | null
          phone?: string | null
          preferred_method_of_communication?: string | null
          previous_product?: string | null
          primary_member_gender?: string | null
          primary_ss_number?: string | null
          producer_commission?: string | null
          producer_name?: string | null
          producer_name_id?: string | null
          product?: string | null
          record_id?: string | null
          referral_requirement_satisfied?: string | null
          referral_source?: string | null
          referrer?: string | null
          referring_member?: string | null
          risk_assessment_paid?: string | null
          routing_number?: string | null
          row_num?: number
          salutation?: string | null
          secondary_email?: string | null
          select_conversion_completed?: string | null
          spouse?: string | null
          spouse_address?: string | null
          spouse_dob?: string | null
          spouse_email?: string | null
          spouse_phone_number?: string | null
          spouse_ss_number?: string | null
          start_date?: string | null
          tag?: string | null
          team_leader?: string | null
          team_leader_monthly?: string | null
          team_leader_referral?: string | null
          territories?: string | null
          third_party_payor?: string | null
          title?: string | null
          unsubscribed_mode?: string | null
          unsubscribed_time?: string | null
          vision?: string | null
          visitor_score?: string | null
          wc_outreach_date?: string | null
          welcome_call_performed_by?: string | null
          welcome_call_status?: string | null
          work_phone?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          action: string
          advisor_id: string | null
          created_at: string | null
          created_by_profile_id: string | null
          custom_fields: Json | null
          description: string | null
          direction: string | null
          entity_id: string
          entity_type: string
          id: string
          lead_id: string | null
          member_id: string | null
          metadata: Json | null
          need_id: string | null
          occurred_at: string | null
          organization_id: string
          profile_id: string | null
          subject: string | null
          ticket_id: string | null
          type: string | null
          via: string | null
        }
        Insert: {
          action: string
          advisor_id?: string | null
          created_at?: string | null
          created_by_profile_id?: string | null
          custom_fields?: Json | null
          description?: string | null
          direction?: string | null
          entity_id: string
          entity_type: string
          id?: string
          lead_id?: string | null
          member_id?: string | null
          metadata?: Json | null
          need_id?: string | null
          occurred_at?: string | null
          organization_id: string
          profile_id?: string | null
          subject?: string | null
          ticket_id?: string | null
          type?: string | null
          via?: string | null
        }
        Update: {
          action?: string
          advisor_id?: string | null
          created_at?: string | null
          created_by_profile_id?: string | null
          custom_fields?: Json | null
          description?: string | null
          direction?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          lead_id?: string | null
          member_id?: string | null
          metadata?: Json | null
          need_id?: string | null
          occurred_at?: string | null
          organization_id?: string
          profile_id?: string | null
          subject?: string | null
          ticket_id?: string | null
          type?: string | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string | null
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          href: string | null
          icon: string | null
          id: string
          is_read: boolean | null
          meta: Json | null
          organization_id: string
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          meta?: Json | null
          organization_id: string
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          meta?: Json | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_settings: {
        Row: {
          admin_notification_email: string | null
          billing_notification_email: string | null
          company_name: string | null
          created_at: string | null
          current_rate_version: string | null
          default_logo_url: string | null
          default_primary_color: string | null
          default_secondary_color: string | null
          enable_agent_enrollment: boolean | null
          enable_dependent_management: boolean | null
          enable_self_enrollment: boolean | null
          enrollment_auto_approve: boolean | null
          id: string
          organization_id: string
          rate_effective_date: string | null
          require_payment_before_activation: boolean | null
          send_renewal_reminders: boolean | null
          send_welcome_emails: boolean | null
          updated_at: string | null
        }
        Insert: {
          admin_notification_email?: string | null
          billing_notification_email?: string | null
          company_name?: string | null
          created_at?: string | null
          current_rate_version?: string | null
          default_logo_url?: string | null
          default_primary_color?: string | null
          default_secondary_color?: string | null
          enable_agent_enrollment?: boolean | null
          enable_dependent_management?: boolean | null
          enable_self_enrollment?: boolean | null
          enrollment_auto_approve?: boolean | null
          id?: string
          organization_id: string
          rate_effective_date?: string | null
          require_payment_before_activation?: boolean | null
          send_renewal_reminders?: boolean | null
          send_welcome_emails?: boolean | null
          updated_at?: string | null
        }
        Update: {
          admin_notification_email?: string | null
          billing_notification_email?: string | null
          company_name?: string | null
          created_at?: string | null
          current_rate_version?: string | null
          default_logo_url?: string | null
          default_primary_color?: string | null
          default_secondary_color?: string | null
          enable_agent_enrollment?: boolean | null
          enable_dependent_management?: boolean | null
          enable_self_enrollment?: boolean | null
          enrollment_auto_approve?: boolean | null
          id?: string
          organization_id?: string
          rate_effective_date?: string | null
          require_payment_before_activation?: boolean | null
          send_renewal_reminders?: boolean | null
          send_welcome_emails?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_commission_summary: {
        Row: {
          active_members: number | null
          adjustments: number | null
          advisor_id: string
          amount_paid: number | null
          amount_pending: number | null
          bonus_commissions: number | null
          calculated_at: string | null
          clawbacks: number | null
          created_at: string | null
          gross_commissions: number | null
          id: string
          monthly_commissions: number | null
          net_commissions: number | null
          organization_id: string
          override_commissions: number | null
          period_month: string
          signup_commissions: number | null
          total_enrollments: number | null
          updated_at: string | null
        }
        Insert: {
          active_members?: number | null
          adjustments?: number | null
          advisor_id: string
          amount_paid?: number | null
          amount_pending?: number | null
          bonus_commissions?: number | null
          calculated_at?: string | null
          clawbacks?: number | null
          created_at?: string | null
          gross_commissions?: number | null
          id?: string
          monthly_commissions?: number | null
          net_commissions?: number | null
          organization_id: string
          override_commissions?: number | null
          period_month: string
          signup_commissions?: number | null
          total_enrollments?: number | null
          updated_at?: string | null
        }
        Update: {
          active_members?: number | null
          adjustments?: number | null
          advisor_id?: string
          amount_paid?: number | null
          amount_pending?: number | null
          bonus_commissions?: number | null
          calculated_at?: string | null
          clawbacks?: number | null
          created_at?: string | null
          gross_commissions?: number | null
          id?: string
          monthly_commissions?: number | null
          net_commissions?: number | null
          organization_id?: string
          override_commissions?: number | null
          period_month?: string
          signup_commissions?: number | null
          total_enrollments?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_commission_summary_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_commission_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_milestone_progress: {
        Row: {
          active_members_count: number | null
          advisor_id: string
          calculated_at: string | null
          current_level_id: string | null
          id: string
          metrics_snapshot: Json | null
          monthly_enrollments_count: number | null
          next_level_id: string | null
          org_id: string
          progress_percent: number | null
        }
        Insert: {
          active_members_count?: number | null
          advisor_id: string
          calculated_at?: string | null
          current_level_id?: string | null
          id?: string
          metrics_snapshot?: Json | null
          monthly_enrollments_count?: number | null
          next_level_id?: string | null
          org_id: string
          progress_percent?: number | null
        }
        Update: {
          active_members_count?: number | null
          advisor_id?: string
          calculated_at?: string | null
          current_level_id?: string | null
          id?: string
          metrics_snapshot?: Json | null
          monthly_enrollments_count?: number | null
          next_level_id?: string | null
          org_id?: string
          progress_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_milestone_progress_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: true
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_milestone_progress_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "agent_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_milestone_progress_next_level_id_fkey"
            columns: ["next_level_id"]
            isOneToOne: false
            referencedRelation: "agent_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_milestone_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_product_access: {
        Row: {
          advisor_id: string
          can_sell: boolean | null
          can_view: boolean | null
          created_at: string | null
          custom_commission_rate: number | null
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          plan_id: string | null
          product_id: string | null
        }
        Insert: {
          advisor_id: string
          can_sell?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_commission_rate?: number | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          plan_id?: string | null
          product_id?: string | null
        }
        Update: {
          advisor_id?: string
          can_sell?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          custom_commission_rate?: number | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          plan_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_product_access_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_product_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_scorecards: {
        Row: {
          advisor_id: string
          avg_days_to_close: number | null
          bonuses_earned: number | null
          calls_made: number | null
          commissions_earned: number | null
          conversion_rate: number | null
          created_at: string | null
          emails_sent: number | null
          id: string
          leads_contacted: number | null
          leads_converted: number | null
          leads_generated: number | null
          member_retention_rate: number | null
          members_churned: number | null
          members_retained: number | null
          meta: Json | null
          new_enrollments: number | null
          org_rank: number | null
          organization_id: string
          overall_score: number | null
          overrides_earned: number | null
          period_end: string
          period_start: string
          period_type: string
          personal_production: number | null
          score_breakdown: Json | null
          tasks_completed: number | null
          team_production: number | null
          tier_rank: number | null
          total_premium: number | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          avg_days_to_close?: number | null
          bonuses_earned?: number | null
          calls_made?: number | null
          commissions_earned?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          emails_sent?: number | null
          id?: string
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_generated?: number | null
          member_retention_rate?: number | null
          members_churned?: number | null
          members_retained?: number | null
          meta?: Json | null
          new_enrollments?: number | null
          org_rank?: number | null
          organization_id: string
          overall_score?: number | null
          overrides_earned?: number | null
          period_end: string
          period_start: string
          period_type?: string
          personal_production?: number | null
          score_breakdown?: Json | null
          tasks_completed?: number | null
          team_production?: number | null
          tier_rank?: number | null
          total_premium?: number | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          avg_days_to_close?: number | null
          bonuses_earned?: number | null
          calls_made?: number | null
          commissions_earned?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          emails_sent?: number | null
          id?: string
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_generated?: number | null
          member_retention_rate?: number | null
          members_churned?: number | null
          members_retained?: number | null
          meta?: Json | null
          new_enrollments?: number | null
          org_rank?: number | null
          organization_id?: string
          overall_score?: number | null
          overrides_earned?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          personal_production?: number | null
          score_breakdown?: Json | null
          tasks_completed?: number | null
          team_production?: number | null
          tier_rank?: number | null
          total_premium?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_scorecards_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_scorecards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      advisors: {
        Row: {
          advisor_code: string | null
          agency_name: string | null
          agent_level_id: string | null
          agent_role: string | null
          apartment: string | null
          city: string | null
          commission_eligible: boolean | null
          commission_hold: boolean | null
          commission_hold_reason: string | null
          commission_tier: string | null
          commission_tier_id: string | null
          comp_level: string | null
          company_name: string | null
          contract_date: string | null
          country: string | null
          created_at: string | null
          current_month_commissions: number | null
          custom_fields: Json | null
          email: string
          enrollment_code: string | null
          first_name: string
          header_bg_color: string | null
          header_text_color: string | null
          id: string
          last_name: string
          license_number: string | null
          license_states: string[] | null
          lifetime_production: number | null
          logo_size: string | null
          logo_url: string | null
          npn: string | null
          organization_id: string
          override_rate_pct: number | null
          parent_advisor_id: string | null
          pending_commissions: number | null
          personal_production: number | null
          phone: string | null
          primary_channel: string | null
          primary_color: string | null
          profile_id: string | null
          secondary_color: string | null
          state: string | null
          status: string
          street_address: string | null
          team_production: number | null
          termination_date: string | null
          total_lifetime_commissions: number | null
          updated_at: string | null
          website_url: string | null
          zip_code: string | null
        }
        Insert: {
          advisor_code?: string | null
          agency_name?: string | null
          agent_level_id?: string | null
          agent_role?: string | null
          apartment?: string | null
          city?: string | null
          commission_eligible?: boolean | null
          commission_hold?: boolean | null
          commission_hold_reason?: string | null
          commission_tier?: string | null
          commission_tier_id?: string | null
          comp_level?: string | null
          company_name?: string | null
          contract_date?: string | null
          country?: string | null
          created_at?: string | null
          current_month_commissions?: number | null
          custom_fields?: Json | null
          email: string
          enrollment_code?: string | null
          first_name: string
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string
          last_name: string
          license_number?: string | null
          license_states?: string[] | null
          lifetime_production?: number | null
          logo_size?: string | null
          logo_url?: string | null
          npn?: string | null
          organization_id: string
          override_rate_pct?: number | null
          parent_advisor_id?: string | null
          pending_commissions?: number | null
          personal_production?: number | null
          phone?: string | null
          primary_channel?: string | null
          primary_color?: string | null
          profile_id?: string | null
          secondary_color?: string | null
          state?: string | null
          status?: string
          street_address?: string | null
          team_production?: number | null
          termination_date?: string | null
          total_lifetime_commissions?: number | null
          updated_at?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Update: {
          advisor_code?: string | null
          agency_name?: string | null
          agent_level_id?: string | null
          agent_role?: string | null
          apartment?: string | null
          city?: string | null
          commission_eligible?: boolean | null
          commission_hold?: boolean | null
          commission_hold_reason?: string | null
          commission_tier?: string | null
          commission_tier_id?: string | null
          comp_level?: string | null
          company_name?: string | null
          contract_date?: string | null
          country?: string | null
          created_at?: string | null
          current_month_commissions?: number | null
          custom_fields?: Json | null
          email?: string
          enrollment_code?: string | null
          first_name?: string
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string
          last_name?: string
          license_number?: string | null
          license_states?: string[] | null
          lifetime_production?: number | null
          logo_size?: string | null
          logo_url?: string | null
          npn?: string | null
          organization_id?: string
          override_rate_pct?: number | null
          parent_advisor_id?: string | null
          pending_commissions?: number | null
          personal_production?: number | null
          phone?: string | null
          primary_channel?: string | null
          primary_color?: string | null
          profile_id?: string | null
          secondary_color?: string | null
          state?: string | null
          status?: string
          street_address?: string | null
          team_production?: number | null
          termination_date?: string | null
          total_lifetime_commissions?: number | null
          updated_at?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisors_agent_level_id_fkey"
            columns: ["agent_level_id"]
            isOneToOne: false
            referencedRelation: "agent_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisors_commission_tier_id_fkey"
            columns: ["commission_tier_id"]
            isOneToOne: false
            referencedRelation: "commission_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisors_parent_advisor_id_fkey"
            columns: ["parent_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      age_up_out_results: {
        Row: {
          action_by: string | null
          action_date: string | null
          action_required: boolean
          action_taken: string | null
          created_at: string
          current_age: number
          current_tier: string | null
          days_until_event: number | null
          event_date: string
          event_type: string
          id: string
          member_dob: string
          member_email: string | null
          member_id: string | null
          member_name: string
          membership_id: string | null
          new_tier: string | null
          notes: string | null
          organization_id: string
          plan_name: string | null
          run_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_by?: string | null
          action_date?: string | null
          action_required?: boolean
          action_taken?: string | null
          created_at?: string
          current_age: number
          current_tier?: string | null
          days_until_event?: number | null
          event_date: string
          event_type: string
          id?: string
          member_dob: string
          member_email?: string | null
          member_id?: string | null
          member_name: string
          membership_id?: string | null
          new_tier?: string | null
          notes?: string | null
          organization_id: string
          plan_name?: string | null
          run_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          action_by?: string | null
          action_date?: string | null
          action_required?: boolean
          action_taken?: string | null
          created_at?: string
          current_age?: number
          current_tier?: string | null
          days_until_event?: number | null
          event_date?: string
          event_type?: string
          id?: string
          member_dob?: string
          member_email?: string | null
          member_id?: string | null
          member_name?: string
          membership_id?: string | null
          new_tier?: string | null
          notes?: string | null
          organization_id?: string
          plan_name?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_up_out_results_action_by_fkey"
            columns: ["action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "age_up_out_results_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "age_up_out_results_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "age_up_out_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "age_up_out_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vendor_eligibility_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_appointments: {
        Row: {
          advisor_id: string
          appointment_number: string | null
          appointment_type: string | null
          carrier_code: string | null
          carrier_name: string
          commission_level: string | null
          created_at: string | null
          effective_date: string | null
          hierarchy_code: string | null
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          products: string[] | null
          states: string[] | null
          status: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          appointment_number?: string | null
          appointment_type?: string | null
          carrier_code?: string | null
          carrier_name: string
          commission_level?: string | null
          created_at?: string | null
          effective_date?: string | null
          hierarchy_code?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          products?: string[] | null
          states?: string[] | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          appointment_number?: string | null
          appointment_type?: string | null
          carrier_code?: string | null
          carrier_name?: string
          commission_level?: string | null
          created_at?: string | null
          effective_date?: string | null
          hierarchy_code?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          products?: string[] | null
          states?: string[] | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_appointments_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_bill_group_members: {
        Row: {
          advisor_id: string
          bill_group_id: string
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          organization_id: string
          role: string | null
        }
        Insert: {
          advisor_id: string
          bill_group_id: string
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          organization_id: string
          role?: string | null
        }
        Update: {
          advisor_id?: string
          bill_group_id?: string
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bill_group_members_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_bill_group_members_bill_group_id_fkey"
            columns: ["bill_group_id"]
            isOneToOne: false
            referencedRelation: "agent_bill_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_bill_group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_bill_groups: {
        Row: {
          code: string | null
          config: Json | null
          created_at: string | null
          description: string | null
          group_type: string | null
          id: string
          is_active: boolean | null
          manager_advisor_id: string | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean | null
          manager_advisor_id?: string | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean | null
          manager_advisor_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bill_groups_manager_advisor_id_fkey"
            columns: ["manager_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_bill_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_levels: {
        Row: {
          base_commission_multiplier: number | null
          code: string
          color: string | null
          commission_rate: number | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          level_rank: number
          max_active_members: number | null
          min_active_members: number | null
          min_downline_agents: number | null
          min_monthly_enrollments: number | null
          name: string
          org_id: string | null
          organization_id: string
          rank: number
          updated_at: string | null
        }
        Insert: {
          base_commission_multiplier?: number | null
          code: string
          color?: string | null
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level_rank: number
          max_active_members?: number | null
          min_active_members?: number | null
          min_downline_agents?: number | null
          min_monthly_enrollments?: number | null
          name: string
          org_id?: string | null
          organization_id: string
          rank?: number
          updated_at?: string | null
        }
        Update: {
          base_commission_multiplier?: number | null
          code?: string
          color?: string | null
          commission_rate?: number | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level_rank?: number
          max_active_members?: number | null
          min_active_members?: number | null
          min_downline_agents?: number | null
          min_monthly_enrollments?: number | null
          name?: string
          org_id?: string | null
          organization_id?: string
          rank?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_levels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_levels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_licenses: {
        Row: {
          advisor_id: string
          ce_due_date: string | null
          ce_hours_completed: number | null
          ce_hours_required: number | null
          created_at: string | null
          expiration_date: string | null
          id: string
          issue_date: string | null
          license_number: string
          license_type: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          state_code: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          ce_due_date?: string | null
          ce_hours_completed?: number | null
          ce_hours_required?: number | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          license_number: string
          license_type?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          state_code: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          ce_due_date?: string | null
          ce_hours_completed?: number | null
          ce_hours_required?: number | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          license_number?: string
          license_type?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          state_code?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_licenses_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          active_advisors: number | null
          active_members: number | null
          approved_enrollments: number | null
          churned_members: number | null
          churned_mrr: number | null
          commissions_earned: number | null
          commissions_paid: number | null
          converted_leads: number | null
          created_at: string | null
          id: string
          metric_type: string
          metrics_data: Json | null
          needs_amount_approved: number | null
          needs_amount_paid: number | null
          needs_amount_submitted: number | null
          net_mrr_change: number | null
          new_leads: number | null
          new_members: number | null
          new_mrr: number | null
          open_needs: number | null
          organization_id: string
          pending_enrollments: number | null
          snapshot_date: string
          total_advisors: number | null
          total_enrollments: number | null
          total_leads: number | null
          total_members: number | null
          total_mrr: number | null
          total_needs: number | null
        }
        Insert: {
          active_advisors?: number | null
          active_members?: number | null
          approved_enrollments?: number | null
          churned_members?: number | null
          churned_mrr?: number | null
          commissions_earned?: number | null
          commissions_paid?: number | null
          converted_leads?: number | null
          created_at?: string | null
          id?: string
          metric_type: string
          metrics_data?: Json | null
          needs_amount_approved?: number | null
          needs_amount_paid?: number | null
          needs_amount_submitted?: number | null
          net_mrr_change?: number | null
          new_leads?: number | null
          new_members?: number | null
          new_mrr?: number | null
          open_needs?: number | null
          organization_id: string
          pending_enrollments?: number | null
          snapshot_date: string
          total_advisors?: number | null
          total_enrollments?: number | null
          total_leads?: number | null
          total_members?: number | null
          total_mrr?: number | null
          total_needs?: number | null
        }
        Update: {
          active_advisors?: number | null
          active_members?: number | null
          approved_enrollments?: number | null
          churned_members?: number | null
          churned_mrr?: number | null
          commissions_earned?: number | null
          commissions_paid?: number | null
          converted_leads?: number | null
          created_at?: string | null
          id?: string
          metric_type?: string
          metrics_data?: Json | null
          needs_amount_approved?: number | null
          needs_amount_paid?: number | null
          needs_amount_submitted?: number | null
          net_mrr_change?: number | null
          new_leads?: number | null
          new_members?: number | null
          new_mrr?: number | null
          open_needs?: number | null
          organization_id?: string
          pending_enrollments?: number | null
          snapshot_date?: string
          total_advisors?: number | null
          total_enrollments?: number | null
          total_leads?: number | null
          total_members?: number | null
          total_mrr?: number | null
          total_needs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_log: {
        Row: {
          action: string
          amount: number | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          member_id: string | null
          organization_id: string
          transaction_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          member_id?: string | null
          organization_id: string
          transaction_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          member_id?: string | null
          organization_id?: string
          transaction_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_failures: {
        Row: {
          admin_notified_at: string | null
          amount: number
          billing_schedule_id: string
          billing_transaction_id: string
          created_at: string | null
          enrollment_id: string | null
          failure_code: string | null
          failure_reason: string
          id: string
          last_notification_at: string | null
          member_id: string
          member_notified: boolean | null
          member_notified_at: string | null
          next_retry_date: string | null
          notification_count: number | null
          organization_id: string
          resolution_notes: string | null
          resolution_type: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          retry_attempt: number
          retry_scheduled: boolean | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notified_at?: string | null
          amount: number
          billing_schedule_id: string
          billing_transaction_id: string
          created_at?: string | null
          enrollment_id?: string | null
          failure_code?: string | null
          failure_reason: string
          id?: string
          last_notification_at?: string | null
          member_id: string
          member_notified?: boolean | null
          member_notified_at?: string | null
          next_retry_date?: string | null
          notification_count?: number | null
          organization_id: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_attempt?: number
          retry_scheduled?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notified_at?: string | null
          amount?: number
          billing_schedule_id?: string
          billing_transaction_id?: string
          created_at?: string | null
          enrollment_id?: string | null
          failure_code?: string | null
          failure_reason?: string
          id?: string
          last_notification_at?: string | null
          member_id?: string
          member_notified?: boolean | null
          member_notified_at?: string | null
          next_retry_date?: string | null
          notification_count?: number | null
          organization_id?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_attempt?: number
          retry_scheduled?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_failures_billing_schedule_id_fkey"
            columns: ["billing_schedule_id"]
            isOneToOne: false
            referencedRelation: "billing_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_failures_billing_transaction_id_fkey"
            columns: ["billing_transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_failures_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_failures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_failures_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billing_failures_enrollment"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_schedules: {
        Row: {
          amount: number
          billing_day: number
          billing_type: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          consecutive_failures: number | null
          created_at: string | null
          day_of_month: number | null
          end_date: string | null
          enrollment_id: string
          frequency: string
          id: string
          last_billed_date: string | null
          last_billing_status: string | null
          max_retries: number | null
          member_id: string
          next_billing_date: string
          notes: string | null
          organization_id: string
          pause_reason: string | null
          paused_at: string | null
          payment_profile_id: string | null
          retry_count: number | null
          start_date: string
          status: string
          subscription_id: string | null
          total_billed: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          billing_day: number
          billing_type?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          day_of_month?: number | null
          end_date?: string | null
          enrollment_id: string
          frequency?: string
          id?: string
          last_billed_date?: string | null
          last_billing_status?: string | null
          max_retries?: number | null
          member_id: string
          next_billing_date: string
          notes?: string | null
          organization_id: string
          pause_reason?: string | null
          paused_at?: string | null
          payment_profile_id?: string | null
          retry_count?: number | null
          start_date: string
          status?: string
          subscription_id?: string | null
          total_billed?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          billing_day?: number
          billing_type?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          day_of_month?: number | null
          end_date?: string | null
          enrollment_id?: string
          frequency?: string
          id?: string
          last_billed_date?: string | null
          last_billing_status?: string | null
          max_retries?: number | null
          member_id?: string
          next_billing_date?: string
          notes?: string | null
          organization_id?: string
          pause_reason?: string | null
          paused_at?: string | null
          payment_profile_id?: string | null
          retry_count?: number | null
          start_date?: string
          status?: string
          subscription_id?: string | null
          total_billed?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_schedules_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_payment_profile_id_fkey"
            columns: ["payment_profile_id"]
            isOneToOne: false
            referencedRelation: "payment_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billing_schedules_enrollment"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_transactions: {
        Row: {
          amount: number
          authorize_auth_code: string | null
          authorize_response_code: string | null
          authorize_response_reason: string | null
          authorize_transaction_id: string | null
          avs_response: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          billing_schedule_id: string | null
          created_at: string | null
          cvv_response: string | null
          decline_category: string | null
          decline_code: string | null
          description: string | null
          enrollment_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          invoice_number: string | null
          member_id: string
          metadata: Json | null
          net_amount: number | null
          organization_id: string
          original_transaction_id: string | null
          payment_profile_id: string | null
          processed_at: string | null
          processing_fee: number | null
          processor_id: string | null
          retry_count: number | null
          settled_at: string | null
          status: string
          submitted_at: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          authorize_auth_code?: string | null
          authorize_response_code?: string | null
          authorize_response_reason?: string | null
          authorize_transaction_id?: string | null
          avs_response?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          billing_schedule_id?: string | null
          created_at?: string | null
          cvv_response?: string | null
          decline_category?: string | null
          decline_code?: string | null
          description?: string | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          invoice_number?: string | null
          member_id: string
          metadata?: Json | null
          net_amount?: number | null
          organization_id: string
          original_transaction_id?: string | null
          payment_profile_id?: string | null
          processed_at?: string | null
          processing_fee?: number | null
          processor_id?: string | null
          retry_count?: number | null
          settled_at?: string | null
          status?: string
          submitted_at?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          authorize_auth_code?: string | null
          authorize_response_code?: string | null
          authorize_response_reason?: string | null
          authorize_transaction_id?: string | null
          avs_response?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          billing_schedule_id?: string | null
          created_at?: string | null
          cvv_response?: string | null
          decline_category?: string | null
          decline_code?: string | null
          description?: string | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          invoice_number?: string | null
          member_id?: string
          metadata?: Json | null
          net_amount?: number | null
          organization_id?: string
          original_transaction_id?: string | null
          payment_profile_id?: string | null
          processed_at?: string | null
          processing_fee?: number | null
          processor_id?: string | null
          retry_count?: number | null
          settled_at?: string | null
          status?: string
          submitted_at?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_billing_schedule_id_fkey"
            columns: ["billing_schedule_id"]
            isOneToOne: false
            referencedRelation: "billing_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_payment_profile_id_fkey"
            columns: ["payment_profile_id"]
            isOneToOne: false
            referencedRelation: "payment_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_processor_id_fkey"
            columns: ["processor_id"]
            isOneToOne: false
            referencedRelation: "payment_processors"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attendees: Json | null
          connection_id: string
          created_at: string
          description: string | null
          end_time: string
          etag: string | null
          external_calendar_id: string
          external_id: string
          id: string
          is_all_day: boolean
          is_recurring: boolean
          last_synced_at: string
          linked_contact_id: string | null
          linked_deal_id: string | null
          linked_task_id: string | null
          location: string | null
          meeting_provider: string | null
          meeting_url: string | null
          org_id: string
          organizer_email: string | null
          organizer_name: string | null
          owner_id: string
          provider: string
          raw_data: Json | null
          recurrence_rule: string | null
          recurring_event_id: string | null
          start_time: string
          status: string
          timezone: string | null
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          attendees?: Json | null
          connection_id: string
          created_at?: string
          description?: string | null
          end_time: string
          etag?: string | null
          external_calendar_id: string
          external_id: string
          id?: string
          is_all_day?: boolean
          is_recurring?: boolean
          last_synced_at?: string
          linked_contact_id?: string | null
          linked_deal_id?: string | null
          linked_task_id?: string | null
          location?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          org_id: string
          organizer_email?: string | null
          organizer_name?: string | null
          owner_id: string
          provider: string
          raw_data?: Json | null
          recurrence_rule?: string | null
          recurring_event_id?: string | null
          start_time: string
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          attendees?: Json | null
          connection_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          etag?: string | null
          external_calendar_id?: string
          external_id?: string
          id?: string
          is_all_day?: boolean
          is_recurring?: boolean
          last_synced_at?: string
          linked_contact_id?: string | null
          linked_deal_id?: string | null
          linked_task_id?: string | null
          location?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          org_id?: string
          organizer_email?: string | null
          organizer_name?: string | null
          owner_id?: string
          provider?: string
          raw_data?: Json | null
          recurrence_rule?: string | null
          recurring_event_id?: string | null
          start_time?: string
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_list: {
        Row: {
          access_role: string | null
          color: string | null
          connection_id: string
          created_at: string
          description: string | null
          external_id: string
          id: string
          is_primary: boolean | null
          is_selected: boolean | null
          name: string
          provider: string
          sync_enabled: boolean | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          access_role?: string | null
          color?: string | null
          connection_id: string
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          is_primary?: boolean | null
          is_selected?: boolean | null
          name: string
          provider: string
          sync_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          access_role?: string | null
          color?: string | null
          connection_id?: string
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          is_primary?: boolean | null
          is_selected?: boolean | null
          name?: string
          provider?: string
          sync_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_list_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_state: {
        Row: {
          calendars_synced: number | null
          connection_id: string
          created_at: string
          events_synced: number | null
          id: string
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          next_sync_token: string | null
          page_token: string | null
          sync_error: string | null
          sync_from: string | null
          sync_status: string | null
          sync_to: string | null
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          calendars_synced?: number | null
          connection_id: string
          created_at?: string
          events_synced?: number | null
          id?: string
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          next_sync_token?: string | null
          page_token?: string | null
          sync_error?: string | null
          sync_from?: string | null
          sync_status?: string | null
          sync_to?: string | null
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          calendars_synced?: number | null
          connection_id?: string
          created_at?: string
          events_synced?: number | null
          id?: string
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          next_sync_token?: string | null
          page_token?: string | null
          sync_error?: string | null
          sync_from?: string | null
          sync_status?: string | null
          sync_to?: string | null
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_state_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tracking_events: {
        Row: {
          campaign_id: string
          clicked_url: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          org_id: string
          recipient_id: string
          tracking_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          clicked_url?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          org_id: string
          recipient_id: string
          tracking_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_url?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          recipient_id?: string
          tracking_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tracking_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tracking_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tracking_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      change_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_type: string | null
          change_type: string
          content_hash: string | null
          created_at: string | null
          description: string | null
          detected_at: string | null
          diff: Json | null
          entity_id: string
          entity_title: string | null
          entity_type: string
          id: string
          org_id: string
          payload: Json | null
          previous_hash: string | null
          reconciliation_status: string | null
          requires_review: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source_id: string | null
          source_name: string | null
          source_type: string
          sync_status: string | null
          synced_at: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string | null
          change_type: string
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          detected_at?: string | null
          diff?: Json | null
          entity_id: string
          entity_title?: string | null
          entity_type: string
          id?: string
          org_id: string
          payload?: Json | null
          previous_hash?: string | null
          reconciliation_status?: string | null
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          source_name?: string | null
          source_type: string
          sync_status?: string | null
          synced_at?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string | null
          change_type?: string
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          detected_at?: string | null
          diff?: Json | null
          entity_id?: string
          entity_title?: string | null
          entity_type?: string
          id?: string
          org_id?: string
          payload?: Json | null
          previous_hash?: string | null
          reconciliation_status?: string | null
          requires_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          source_name?: string | null
          source_type?: string
          sync_status?: string | null
          synced_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_subscriptions: {
        Row: {
          created_at: string | null
          email_digest: string | null
          entity_types: string[] | null
          id: string
          min_severity: string | null
          org_id: string
          send_email: boolean | null
          send_push: boolean | null
          show_in_ticker: boolean | null
          sound_critical_only: boolean | null
          sound_enabled: boolean | null
          source_types: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_digest?: string | null
          entity_types?: string[] | null
          id?: string
          min_severity?: string | null
          org_id: string
          send_email?: boolean | null
          send_push?: boolean | null
          show_in_ticker?: boolean | null
          sound_critical_only?: boolean | null
          sound_enabled?: boolean | null
          source_types?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_digest?: string | null
          entity_types?: string[] | null
          id?: string
          min_severity?: string | null
          org_id?: string
          send_email?: boolean | null
          send_push?: boolean | null
          show_in_ticker?: boolean | null
          sound_critical_only?: boolean | null
          sound_enabled?: boolean | null
          source_types?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_adjustments: {
        Row: {
          adjustment_type: string
          advisor_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          commission_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          effective_period: string
          enrollment_id: string | null
          id: string
          organization_id: string
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_type: string
          advisor_id: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          commission_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          effective_period: string
          enrollment_id?: string | null
          id?: string
          organization_id: string
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string
          advisor_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          commission_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          effective_period?: string
          enrollment_id?: string | null
          id?: string
          organization_id?: string
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_adjustments_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_bonus_types: {
        Row: {
          calculation_type: string | null
          created_at: string | null
          default_amount: number | null
          default_percentage: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          calculation_type?: string | null
          created_at?: string | null
          default_amount?: number | null
          default_percentage?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          calculation_type?: string | null
          created_at?: string | null
          default_amount?: number | null
          default_percentage?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_bonus_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_copy_history: {
        Row: {
          copy_type: string
          created_at: string | null
          created_by: string | null
          details: Json | null
          id: string
          items_copied: number | null
          organization_id: string | null
          period_end: string | null
          period_start: string | null
          source_agent_id: string
          target_agent_id: string
        }
        Insert: {
          copy_type: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          id?: string
          items_copied?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          source_agent_id: string
          target_agent_id: string
        }
        Update: {
          copy_type?: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          id?: string
          items_copied?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          source_agent_id?: string
          target_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_copy_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_copy_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payment_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_number: string
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_date: string
          period_end: string
          period_start: string
          processed_at: string | null
          processed_by: string | null
          status: string | null
          total_advisors: number | null
          total_amount: number | null
          total_commissions: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number: string
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_date: string
          period_end: string
          period_start: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          total_advisors?: number | null
          total_amount?: number | null
          total_commissions?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number?: string
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          period_end?: string
          period_start?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          total_advisors?: number | null
          total_amount?: number | null
          total_commissions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payment_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payment_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payment_batches_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          advisor_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          meta: Json | null
          net_payout: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          status: string
          total_bonuses: number | null
          total_chargebacks: number | null
          total_commissions: number
          total_overrides: number | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          net_payout?: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          total_bonuses?: number | null
          total_chargebacks?: number | null
          total_commissions?: number
          total_overrides?: number | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          net_payout?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_bonuses?: number | null
          total_chargebacks?: number | null
          total_commissions?: number
          total_overrides?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rates: {
        Row: {
          agent_level_id: string | null
          annual_commission: number | null
          benefit_type_id: string | null
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          monthly_commission: number | null
          monthly_commission_percent: number | null
          notes: string | null
          organization_id: string
          override_commission: number | null
          override_commission_percent: number | null
          override_levels_deep: number | null
          product_id: string | null
          signup_commission: number | null
          signup_commission_percent: number | null
          updated_at: string | null
        }
        Insert: {
          agent_level_id?: string | null
          annual_commission?: number | null
          benefit_type_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          monthly_commission?: number | null
          monthly_commission_percent?: number | null
          notes?: string | null
          organization_id: string
          override_commission?: number | null
          override_commission_percent?: number | null
          override_levels_deep?: number | null
          product_id?: string | null
          signup_commission?: number | null
          signup_commission_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_level_id?: string | null
          annual_commission?: number | null
          benefit_type_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          monthly_commission?: number | null
          monthly_commission_percent?: number | null
          notes?: string | null
          organization_id?: string
          override_commission?: number | null
          override_commission_percent?: number | null
          override_levels_deep?: number | null
          product_id?: string | null
          signup_commission?: number | null
          signup_commission_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_agent_level_id_fkey"
            columns: ["agent_level_id"]
            isOneToOne: false
            referencedRelation: "agent_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          base_rate_pct: number
          bonus_rate_pct: number | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          level: number
          min_active_members: number | null
          min_personal_production: number | null
          min_team_production: number | null
          name: string
          organization_id: string
          override_rate_pct: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          base_rate_pct?: number
          bonus_rate_pct?: number | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          min_active_members?: number | null
          min_personal_production?: number | null
          min_team_production?: number | null
          name: string
          organization_id: string
          override_rate_pct?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          base_rate_pct?: number
          bonus_rate_pct?: number | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          min_active_members?: number | null
          min_personal_production?: number | null
          min_team_production?: number | null
          name?: string
          organization_id?: string
          override_rate_pct?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          advisor_id: string
          commission_amount: number
          created_at: string | null
          enrollment_id: string | null
          gross_amount: number
          id: string
          member_id: string | null
          meta: Json | null
          notes: string | null
          organization_id: string
          override_level: number | null
          paid_at: string | null
          payout_id: string | null
          period_end: string
          period_start: string
          rate_pct: number
          source_advisor_id: string | null
          status: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          commission_amount?: number
          created_at?: string | null
          enrollment_id?: string | null
          gross_amount?: number
          id?: string
          member_id?: string | null
          meta?: Json | null
          notes?: string | null
          organization_id: string
          override_level?: number | null
          paid_at?: string | null
          payout_id?: string | null
          period_end: string
          period_start: string
          rate_pct?: number
          source_advisor_id?: string | null
          status?: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          commission_amount?: number
          created_at?: string | null
          enrollment_id?: string | null
          gross_amount?: number
          id?: string
          member_id?: string | null
          meta?: Json | null
          notes?: string | null
          organization_id?: string
          override_level?: number | null
          paid_at?: string | null
          payout_id?: string | null
          period_end?: string
          period_start?: string
          rate_pct?: number
          source_advisor_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_transactions_source_advisor_id_fkey"
            columns: ["source_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          advisor_id: string
          base_amount: number
          billing_id: string | null
          bonus_reason: string | null
          bonus_type_id: string | null
          commission_amount: number
          commission_period: string
          commission_rate: number | null
          commission_rate_type: string | null
          commission_type: string
          created_at: string | null
          enrollment_id: string | null
          id: string
          is_bonus: boolean | null
          member_id: string | null
          metadata: Json | null
          net_amount: number | null
          notes: string | null
          organization_id: string
          override_level: number | null
          paid_at: string | null
          payment_batch_id: string | null
          payment_method: string | null
          payment_reference: string | null
          source_advisor_id: string | null
          status: string | null
          status_reason: string | null
          updated_at: string | null
          vendor_cost: number | null
        }
        Insert: {
          advisor_id: string
          base_amount: number
          billing_id?: string | null
          bonus_reason?: string | null
          bonus_type_id?: string | null
          commission_amount: number
          commission_period: string
          commission_rate?: number | null
          commission_rate_type?: string | null
          commission_type: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_bonus?: boolean | null
          member_id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          notes?: string | null
          organization_id: string
          override_level?: number | null
          paid_at?: string | null
          payment_batch_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          source_advisor_id?: string | null
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
          vendor_cost?: number | null
        }
        Update: {
          advisor_id?: string
          base_amount?: number
          billing_id?: string | null
          bonus_reason?: string | null
          bonus_type_id?: string | null
          commission_amount?: number
          commission_period?: string
          commission_rate?: number | null
          commission_rate_type?: string | null
          commission_type?: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_bonus?: boolean | null
          member_id?: string | null
          metadata?: Json | null
          net_amount?: number | null
          notes?: string | null
          organization_id?: string
          override_level?: number | null
          paid_at?: string | null
          payment_batch_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          source_advisor_id?: string | null
          status?: string | null
          status_reason?: string | null
          updated_at?: string | null
          vendor_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_bonus_type_id_fkey"
            columns: ["bonus_type_id"]
            isOneToOne: false
            referencedRelation: "commission_bonus_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_source_advisor_id_fkey"
            columns: ["source_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          all_day: boolean | null
          assigned_to: string | null
          color: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          location: string | null
          meeting_link: string | null
          metadata: Json | null
          module_id: string | null
          org_id: string
          priority: string | null
          record_id: string | null
          recurrence_end_date: string | null
          recurrence_rule: string | null
          reminder_minutes: number | null
          start_time: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          all_day?: boolean | null
          assigned_to?: string | null
          color?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          module_id?: string | null
          org_id: string
          priority?: string | null
          record_id?: string | null
          recurrence_end_date?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          all_day?: boolean | null
          assigned_to?: string | null
          color?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          module_id?: string | null
          org_id?: string
          priority?: string | null
          record_id?: string | null
          recurrence_end_date?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_actions: {
        Row: {
          action: string
          actor_id: string | null
          approval_id: string
          comment: string | null
          created_at: string | null
          delegate_to: string | null
          id: string
          meta: Json | null
          org_id: string
          step_index: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          approval_id: string
          comment?: string | null
          created_at?: string | null
          delegate_to?: string | null
          id?: string
          meta?: Json | null
          org_id: string
          step_index: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          approval_id?: string
          comment?: string | null
          created_at?: string | null
          delegate_to?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_actions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "crm_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_actions_delegate_to_fkey"
            columns: ["delegate_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_decisions: {
        Row: {
          approval_id: string
          comment: string | null
          created_at: string | null
          decided_at: string | null
          decided_by: string
          decision: string
          decision_context: Json | null
          delegated_to: string | null
          id: string
          org_id: string
          step_index: number
          time_to_decision_seconds: number | null
        }
        Insert: {
          approval_id: string
          comment?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by: string
          decision: string
          decision_context?: Json | null
          delegated_to?: string | null
          id?: string
          org_id: string
          step_index: number
          time_to_decision_seconds?: number | null
        }
        Update: {
          approval_id?: string
          comment?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string
          decision?: string
          decision_context?: Json | null
          delegated_to?: string | null
          id?: string
          org_id?: string
          step_index?: number
          time_to_decision_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_decisions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "crm_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_decisions_delegated_to_fkey"
            columns: ["delegated_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_processes: {
        Row: {
          auto_approve_after_hours: number | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          on_approve_actions: Json | null
          on_reject_actions: Json | null
          org_id: string
          steps: Json
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          auto_approve_after_hours?: number | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          on_approve_actions?: Json | null
          on_reject_actions?: Json | null
          org_id: string
          steps?: Json
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          auto_approve_after_hours?: number | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          on_approve_actions?: Json | null
          on_reject_actions?: Json | null
          org_id?: string
          steps?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_processes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_processes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_processes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_rules: {
        Row: {
          conditions: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          process_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          priority?: number | null
          process_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          priority?: number | null
          process_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approval_rules_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "crm_approval_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approvals: {
        Row: {
          action_payload: Json | null
          applied_at: string | null
          context: Json | null
          created_at: string | null
          current_step: number | null
          entity_snapshot: Json | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          org_id: string
          process_id: string
          record_id: string
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          action_payload?: Json | null
          applied_at?: string | null
          context?: Json | null
          created_at?: string | null
          current_step?: number | null
          entity_snapshot?: Json | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          org_id: string
          process_id: string
          record_id: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          action_payload?: Json | null
          applied_at?: string | null
          context?: Json | null
          created_at?: string | null
          current_step?: number | null
          entity_snapshot?: Json | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          org_id?: string
          process_id?: string
          record_id?: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approvals_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "crm_approval_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approvals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approvals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_approval_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_assignment_rules: {
        Row: {
          conditions: Json | null
          config: Json
          created_at: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          strategy: string
          updated_at: string | null
        }
        Insert: {
          conditions?: Json | null
          config?: Json
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          priority?: number | null
          strategy: string
          updated_at?: string | null
        }
        Update: {
          conditions?: Json | null
          config?: Json
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          priority?: number | null
          strategy?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_assignment_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_assignment_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_attachments: {
        Row: {
          bucket_path: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_public: boolean | null
          meta: Json | null
          mime_type: string | null
          org_id: string
          record_id: string
          storage_bucket: string | null
        }
        Insert: {
          bucket_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          meta?: Json | null
          mime_type?: string | null
          org_id: string
          record_id: string
          storage_bucket?: string | null
        }
        Update: {
          bucket_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          meta?: Json | null
          mime_type?: string | null
          org_id?: string
          record_id?: string
          storage_bucket?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          diff: Json | null
          entity: string
          entity_id: string
          id: string
          meta: Json | null
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          diff?: Json | null
          entity: string
          entity_id: string
          id?: string
          meta?: Json | null
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          diff?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          meta?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automation_runs: {
        Row: {
          actions_executed: Json | null
          completed_at: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          input: Json | null
          is_dry_run: boolean | null
          module_id: string | null
          org_id: string
          output: Json | null
          record_id: string | null
          source: string
          started_at: string | null
          status: string
          trigger: string
          workflow_id: string | null
        }
        Insert: {
          actions_executed?: Json | null
          completed_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          is_dry_run?: boolean | null
          module_id?: string | null
          org_id: string
          output?: Json | null
          record_id?: string | null
          source: string
          started_at?: string | null
          status?: string
          trigger: string
          workflow_id?: string | null
        }
        Update: {
          actions_executed?: Json | null
          completed_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          is_dry_run?: boolean | null
          module_id?: string | null
          org_id?: string
          output?: Json | null
          record_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          trigger?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_runs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "crm_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_blueprints: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          stages: Json
          transitions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          stages?: Json
          transitions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          stages?: Json
          transitions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_blueprints_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_blueprints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadence_enrollments: {
        Row: {
          cadence_id: string
          created_at: string | null
          current_step: number | null
          enrolled_by: string | null
          id: string
          next_step_at: string | null
          org_id: string
          record_id: string
          state: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cadence_id: string
          created_at?: string | null
          current_step?: number | null
          enrolled_by?: string | null
          id?: string
          next_step_at?: string | null
          org_id: string
          record_id: string
          state?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cadence_id?: string
          created_at?: string | null
          current_step?: number | null
          enrolled_by?: string | null
          id?: string
          next_step_at?: string | null
          org_id?: string
          record_id?: string
          state?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "crm_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadence_enrollments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadences: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          steps: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          steps?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          steps?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadences_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_preferences: {
        Row: {
          created_at: string | null
          do_not_call: boolean | null
          do_not_email: boolean | null
          do_not_sms: boolean | null
          email_frequency: string | null
          id: string
          org_id: string
          preferred_channel: string | null
          record_id: string
          unsubscribe_reason: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          do_not_call?: boolean | null
          do_not_email?: boolean | null
          do_not_sms?: boolean | null
          email_frequency?: string | null
          id?: string
          org_id: string
          preferred_channel?: string | null
          record_id: string
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          do_not_call?: boolean | null
          do_not_email?: boolean | null
          do_not_sms?: boolean | null
          email_frequency?: string | null
          id?: string
          org_id?: string
          preferred_channel?: string | null
          record_id?: string
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_preferences_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          duration_seconds: number | null
          from_stage: string | null
          from_stage_id: string | null
          id: string
          meta: Json | null
          org_id: string
          reason: string | null
          record_id: string
          to_stage: string
          to_stage_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_stage?: string | null
          from_stage_id?: string | null
          id?: string
          meta?: Json | null
          org_id: string
          reason?: string | null
          record_id: string
          to_stage: string
          to_stage_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_stage?: string | null
          from_stage_id?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          reason?: string | null
          record_id?: string
          to_stage?: string
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stages: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_lost: boolean | null
          is_won: boolean | null
          key: string
          name: string
          org_id: string
          probability: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_lost?: boolean | null
          is_won?: boolean | null
          key: string
          name: string
          org_id: string
          probability?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_lost?: boolean | null
          is_won?: boolean | null
          key?: string
          name?: string
          org_id?: string
          probability?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_fields: {
        Row: {
          created_at: string | null
          default_value: string | null
          display_order: number | null
          id: string
          is_indexed: boolean | null
          is_system: boolean | null
          is_title_field: boolean | null
          key: string
          label: string
          module_id: string
          options: Json | null
          org_id: string
          required: boolean | null
          section: string | null
          tooltip: string | null
          type: string
          updated_at: string | null
          validation: Json | null
          width: string | null
        }
        Insert: {
          created_at?: string | null
          default_value?: string | null
          display_order?: number | null
          id?: string
          is_indexed?: boolean | null
          is_system?: boolean | null
          is_title_field?: boolean | null
          key: string
          label: string
          module_id: string
          options?: Json | null
          org_id: string
          required?: boolean | null
          section?: string | null
          tooltip?: string | null
          type: string
          updated_at?: string | null
          validation?: Json | null
          width?: string | null
        }
        Update: {
          created_at?: string | null
          default_value?: string | null
          display_order?: number | null
          id?: string
          is_indexed?: boolean | null
          is_system?: boolean | null
          is_title_field?: boolean | null
          key?: string
          label?: string
          module_id?: string
          options?: Json | null
          org_id?: string
          required?: boolean | null
          section?: string | null
          tooltip?: string | null
          type?: string
          updated_at?: string | null
          validation?: Json | null
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_fields_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_fields_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_count: number | null
          error_message: string | null
          file_name: string | null
          id: string
          inserted_count: number | null
          mapping_id: string | null
          module_id: string
          org_id: string
          processed_rows: number | null
          skipped_count: number | null
          source_type: string
          started_at: string | null
          stats: Json | null
          status: string | null
          total_rows: number | null
          updated_count: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          inserted_count?: number | null
          mapping_id?: string | null
          module_id: string
          org_id: string
          processed_rows?: number | null
          skipped_count?: number | null
          source_type: string
          started_at?: string | null
          stats?: Json | null
          status?: string | null
          total_rows?: number | null
          updated_count?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          inserted_count?: number | null
          mapping_id?: string | null
          module_id?: string
          org_id?: string
          processed_rows?: number | null
          skipped_count?: number | null
          source_type?: string
          started_at?: string | null
          stats?: Json | null
          status?: string | null
          total_rows?: number | null
          updated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_jobs_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "crm_import_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_jobs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_import_mappings: {
        Row: {
          created_at: string | null
          created_by: string | null
          dedupe_fields: string[] | null
          id: string
          is_default: boolean | null
          mapping: Json
          module_id: string
          name: string
          org_id: string
          source_id: string | null
          transforms: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dedupe_fields?: string[] | null
          id?: string
          is_default?: boolean | null
          mapping?: Json
          module_id: string
          name: string
          org_id: string
          source_id?: string | null
          transforms?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dedupe_fields?: string[] | null
          id?: string
          is_default?: boolean | null
          mapping?: Json
          module_id?: string
          name?: string
          org_id?: string
          source_id?: string | null
          transforms?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_mappings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_import_rows: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          job_id: string
          match_type: string | null
          normalized: Json | null
          raw: Json
          record_id: string | null
          row_index: number
          status: string | null
          warnings: Json | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          job_id: string
          match_type?: string | null
          normalized?: Json | null
          raw: Json
          record_id?: string | null
          row_index: number
          status?: string | null
          warnings?: Json | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          job_id?: string
          match_type?: string | null
          normalized?: Json | null
          raw?: Json
          record_id?: string | null
          row_index?: number
          status?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crm_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_import_rows_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_import_sources: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          org_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          org_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          org_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_import_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_layouts: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          is_default: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_layouts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_layouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_macro_runs: {
        Row: {
          actions_executed: Json | null
          completed_at: string | null
          error: string | null
          executed_by: string | null
          id: string
          macro_id: string
          org_id: string
          record_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          actions_executed?: Json | null
          completed_at?: string | null
          error?: string | null
          executed_by?: string | null
          id?: string
          macro_id: string
          org_id: string
          record_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          actions_executed?: Json | null
          completed_at?: string | null
          error?: string | null
          executed_by?: string | null
          id?: string
          macro_id?: string
          org_id?: string
          record_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_macro_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_macro_runs_macro_id_fkey"
            columns: ["macro_id"]
            isOneToOne: false
            referencedRelation: "crm_macros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_macro_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_macro_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_macros: {
        Row: {
          actions: Json
          allowed_roles: string[] | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          allowed_roles?: string[] | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          allowed_roles?: string[] | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_macros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_macros_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_macros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_events: {
        Row: {
          created_at: string | null
          event: string
          id: string
          message_id: string
          org_id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event: string
          id?: string
          message_id: string
          org_id: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event?: string
          id?: string
          message_id?: string
          org_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "crm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_providers: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          is_default: boolean | null
          is_enabled: boolean | null
          name: string
          org_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          name: string
          org_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          name?: string
          org_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_providers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_templates: {
        Row: {
          body: string
          category: string | null
          channel: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          meta: Json | null
          module_id: string | null
          name: string
          org_id: string
          subject: string | null
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          body: string
          category?: string | null
          channel: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          meta?: Json | null
          module_id?: string | null
          name: string
          org_id: string
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          body?: string
          category?: string | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          meta?: Json | null
          module_id?: string | null
          name?: string
          org_id?: string
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_templates_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_threads: {
        Row: {
          channel: string
          created_at: string | null
          external_thread_id: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          org_id: string
          participant_address: string
          record_id: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          org_id: string
          participant_address: string
          record_id: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          org_id?: string
          participant_address?: string
          record_id?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_threads_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_messages: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          created_by: string | null
          direction: string
          error: string | null
          from_address: string | null
          id: string
          meta: Json | null
          next_retry_at: string | null
          org_id: string
          provider: string | null
          provider_message_id: string | null
          record_id: string
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          thread_id: string | null
          to_address: string
          updated_at: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          created_by?: string | null
          direction: string
          error?: string | null
          from_address?: string | null
          id?: string
          meta?: Json | null
          next_retry_at?: string | null
          org_id: string
          provider?: string | null
          provider_message_id?: string | null
          record_id: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          thread_id?: string | null
          to_address: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          created_by?: string | null
          direction?: string
          error?: string | null
          from_address?: string | null
          id?: string
          meta?: Json | null
          next_retry_at?: string | null
          org_id?: string
          provider?: string | null
          provider_message_id?: string | null
          record_id?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          thread_id?: string | null
          to_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "crm_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_modules: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          is_system: boolean | null
          key: string
          name: string
          name_plural: string | null
          org_id: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          is_system?: boolean | null
          key: string
          name: string
          name_plural?: string | null
          org_id: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          is_system?: boolean | null
          key?: string
          name?: string
          name_plural?: string | null
          org_id?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_modules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          is_pinned: boolean | null
          org_id: string
          record_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          org_id: string
          record_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          org_id?: string
          record_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          href: string | null
          icon: string | null
          id: string
          is_read: boolean | null
          meta: Json | null
          org_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          meta?: Json | null
          org_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_read?: boolean | null
          meta?: Json | null
          org_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_recent_views: {
        Row: {
          id: string
          module_id: string
          org_id: string
          record_id: string
          user_id: string
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          module_id: string
          org_id: string
          record_id: string
          user_id: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          module_id?: string
          org_id?: string
          record_id?: string
          user_id?: string
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_recent_views_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_recent_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_recent_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_record_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_primary: boolean | null
          link_type: string
          meta: Json | null
          org_id: string
          source_record_id: string
          target_record_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          link_type: string
          meta?: Json | null
          org_id: string
          source_record_id: string
          target_record_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          link_type?: string
          meta?: Json | null
          org_id?: string
          source_record_id?: string
          target_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_record_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_record_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_record_links_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_record_links_target_record_id_fkey"
            columns: ["target_record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_records: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json | null
          email: string | null
          id: string
          module_id: string
          org_id: string
          owner_id: string | null
          phone: string | null
          search: unknown
          stage: string | null
          status: string | null
          system: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          email?: string | null
          id?: string
          module_id: string
          org_id: string
          owner_id?: string | null
          phone?: string | null
          search?: unknown
          stage?: string | null
          status?: string | null
          system?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          email?: string | null
          id?: string
          module_id?: string
          org_id?: string
          owner_id?: string | null
          phone?: string | null
          search?: unknown
          stage?: string | null
          status?: string | null
          system?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_records_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_records_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_relations: {
        Row: {
          created_at: string | null
          created_by: string | null
          from_record_id: string
          id: string
          meta: Json | null
          org_id: string
          relation_type: string
          to_record_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          from_record_id: string
          id?: string
          meta?: Json | null
          org_id: string
          relation_type: string
          to_record_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          from_record_id?: string
          id?: string
          meta?: Json | null
          org_id?: string
          relation_type?: string
          to_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_relations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_relations_from_record_id_fkey"
            columns: ["from_record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_relations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_relations_to_record_id_fkey"
            columns: ["to_record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_reports: {
        Row: {
          aggregations: Json | null
          chart_config: Json | null
          chart_type: string | null
          columns: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          filters: Json | null
          grouping: Json | null
          id: string
          is_favorite: boolean | null
          is_shared: boolean | null
          last_run_at: string | null
          module_id: string | null
          name: string
          org_id: string
          report_type: string | null
          run_count: number | null
          shared_with: Json | null
          sorting: Json | null
          updated_at: string | null
        }
        Insert: {
          aggregations?: Json | null
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_favorite?: boolean | null
          is_shared?: boolean | null
          last_run_at?: string | null
          module_id?: string | null
          name: string
          org_id: string
          report_type?: string | null
          run_count?: number | null
          shared_with?: Json | null
          sorting?: Json | null
          updated_at?: string | null
        }
        Update: {
          aggregations?: Json | null
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_favorite?: boolean | null
          is_shared?: boolean | null
          last_run_at?: string | null
          module_id?: string | null
          name?: string
          org_id?: string
          report_type?: string | null
          run_count?: number | null
          shared_with?: Json | null
          sorting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reports_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      crm_scheduled_reports: {
        Row: {
          created_at: string | null
          day_of_month: number | null
          day_of_week: number | null
          format: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          next_send_at: string | null
          recipients: Json
          report_id: string
          time_of_day: string | null
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          format?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          next_send_at?: string | null
          recipients?: Json
          report_id: string
          time_of_day?: string | null
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          format?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          next_send_at?: string | null
          recipients?: Json
          report_id?: string
          time_of_day?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_scheduled_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_scheduler_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          idempotency_key: string | null
          job_type: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number | null
          org_id: string
          payload: Json
          record_id: string | null
          result: Json | null
          run_at: string
          status: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          idempotency_key?: string | null
          job_type: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number | null
          org_id: string
          payload?: Json
          record_id?: string | null
          result?: Json | null
          run_at: string
          status?: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          idempotency_key?: string | null
          job_type?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number | null
          org_id?: string
          payload?: Json
          record_id?: string | null
          result?: Json | null
          run_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_scheduler_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_scheduler_jobs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_scoring_rules: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          rules: Json
          score_field_key: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          rules?: Json
          score_field_key?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          rules?: Json
          score_field_key?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_scoring_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_scoring_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sla_policies: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sla_policies_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sla_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_history: {
        Row: {
          approval_id: string | null
          blueprint_id: string | null
          changed_by: string | null
          created_at: string | null
          from_stage: string | null
          id: string
          meta: Json | null
          org_id: string
          reason: string | null
          record_id: string
          to_stage: string
          transition_data: Json | null
        }
        Insert: {
          approval_id?: string | null
          blueprint_id?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_stage?: string | null
          id?: string
          meta?: Json | null
          org_id: string
          reason?: string | null
          record_id: string
          to_stage: string
          transition_data?: Json | null
        }
        Update: {
          approval_id?: string | null
          blueprint_id?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_stage?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          reason?: string | null
          record_id?: string
          to_stage?: string
          transition_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_history_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "crm_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stage_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          activity_type: string | null
          assigned_to: string | null
          attendees: string[] | null
          call_duration: number | null
          call_result: string | null
          call_type: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          meeting_location: string | null
          meeting_type: string | null
          org_id: string
          outcome: string | null
          priority: string | null
          record_id: string | null
          reminder_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          assigned_to?: string | null
          attendees?: string[] | null
          call_duration?: number | null
          call_result?: string | null
          call_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          meeting_location?: string | null
          meeting_type?: string | null
          org_id: string
          outcome?: string | null
          priority?: string | null
          record_id?: string | null
          reminder_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          assigned_to?: string | null
          attendees?: string[] | null
          call_duration?: number | null
          call_result?: string | null
          call_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          meeting_location?: string | null
          meeting_type?: string | null
          org_id?: string
          outcome?: string | null
          priority?: string | null
          record_id?: string | null
          reminder_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_user_roles: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "crm_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_validation_rule_runs: {
        Row: {
          context: Json | null
          created_at: string | null
          errors: Json | null
          field_value: Json | null
          id: string
          org_id: string
          record_id: string | null
          result: string
          rule_id: string | null
          trigger: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          errors?: Json | null
          field_value?: Json | null
          id?: string
          org_id: string
          record_id?: string | null
          result: string
          rule_id?: string | null
          trigger: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          errors?: Json | null
          field_value?: Json | null
          id?: string
          org_id?: string
          record_id?: string | null
          result?: string
          rule_id?: string | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_validation_rule_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_validation_rule_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_validation_rule_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_validation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_validation_rules: {
        Row: {
          applies_on: string[]
          conditions: Json
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          error_message: string
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          rule_type: string
          stage_triggers: Json | null
          target_field: string
          updated_at: string | null
        }
        Insert: {
          applies_on?: string[]
          conditions?: Json
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_message?: string
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          priority?: number | null
          rule_type: string
          stage_triggers?: Json | null
          target_field: string
          updated_at?: string | null
        }
        Update: {
          applies_on?: string[]
          conditions?: Json
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_message?: string
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          priority?: number | null
          rule_type?: string
          stage_triggers?: Json | null
          target_field?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_validation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_validation_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_validation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_views: {
        Row: {
          columns: Json
          created_at: string | null
          created_by: string | null
          filters: Json | null
          id: string
          is_default: boolean | null
          is_shared: boolean | null
          module_id: string
          name: string
          org_id: string
          sort: Json | null
          updated_at: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          module_id: string
          name: string
          org_id: string
          sort?: Json | null
          updated_at?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          sort?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_views_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_views_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_webforms: {
        Row: {
          created_at: string | null
          dedupe_config: Json | null
          description: string | null
          hidden_fields: Json | null
          id: string
          is_enabled: boolean | null
          layout: Json
          module_id: string
          name: string
          org_id: string
          redirect_url: string | null
          slug: string
          submit_count: number | null
          success_message: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dedupe_config?: Json | null
          description?: string | null
          hidden_fields?: Json | null
          id?: string
          is_enabled?: boolean | null
          layout?: Json
          module_id: string
          name: string
          org_id: string
          redirect_url?: string | null
          slug: string
          submit_count?: number | null
          success_message?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dedupe_config?: Json | null
          description?: string | null
          hidden_fields?: Json | null
          id?: string
          is_enabled?: boolean | null
          layout?: Json
          module_id?: string
          name?: string
          org_id?: string
          redirect_url?: string | null
          slug?: string
          submit_count?: number | null
          success_message?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_webforms_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webforms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflow_run_logs: {
        Row: {
          action_type: string
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          retry_count: number | null
          run_id: string
          scheduled_for: string | null
          started_at: string | null
          status: string
          step_id: string | null
          step_order: number
        }
        Insert: {
          action_type: string
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          retry_count?: number | null
          run_id: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          step_id?: string | null
          step_order?: number
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          retry_count?: number | null
          run_id?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          step_id?: string | null
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflow_run_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "crm_automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_workflow_run_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "crm_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflow_steps: {
        Row: {
          action_config: Json
          action_type: string
          conditions: Json | null
          created_at: string | null
          delay_field: string | null
          delay_seconds: number | null
          delay_type: string | null
          id: string
          is_enabled: boolean | null
          name: string | null
          step_order: number
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          conditions?: Json | null
          created_at?: string | null
          delay_field?: string | null
          delay_seconds?: number | null
          delay_type?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string | null
          step_order?: number
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          conditions?: Json | null
          created_at?: string | null
          delay_field?: string | null
          delay_seconds?: number | null
          delay_type?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string | null
          step_order?: number
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "crm_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflows: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          name: string
          org_id: string
          priority?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          name?: string
          org_id?: string
          priority?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_workflows_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "crm_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          entity_type: string
          field_key: string | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_filterable: boolean | null
          is_required: boolean | null
          is_visible: boolean | null
          options: Json | null
          order_index: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          entity_type: string
          field_key?: string | null
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_visible?: boolean | null
          options?: Json | null
          order_index?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          entity_type?: string
          field_key?: string | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_filterable?: boolean | null
          is_required?: boolean | null
          is_visible?: boolean | null
          options?: Json | null
          order_index?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          chart_config: Json | null
          chart_type: string | null
          columns: Json | null
          created_at: string | null
          created_by: string | null
          data_source: string
          description: string | null
          filters: Json | null
          grouping: Json | null
          id: string
          is_public: boolean | null
          last_run_at: string | null
          meta: Json | null
          name: string
          organization_id: string
          report_type: string
          schedule_cron: string | null
          schedule_enabled: boolean | null
          schedule_recipients: string[] | null
          shared_with: string[] | null
          sorting: Json | null
          updated_at: string | null
        }
        Insert: {
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_source: string
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_public?: boolean | null
          last_run_at?: string | null
          meta?: Json | null
          name: string
          organization_id: string
          report_type: string
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          schedule_recipients?: string[] | null
          shared_with?: string[] | null
          sorting?: Json | null
          updated_at?: string | null
        }
        Update: {
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_public?: boolean | null
          last_run_at?: string | null
          meta?: Json | null
          name?: string
          organization_id?: string
          report_type?: string
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          schedule_recipients?: string[] | null
          shared_with?: string[] | null
          sorting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          apartment: string | null
          city: string | null
          country: string | null
          coverage_role: string | null
          created_at: string | null
          date_of_birth: string
          email: string | null
          existing_condition: boolean | null
          existing_condition_description: string | null
          external_ref: string | null
          first_name: string
          gender: string | null
          has_existing_condition: boolean | null
          id: string
          included_in_enrollment: boolean | null
          is_primary: boolean | null
          is_smoker: boolean | null
          last_name: string
          member_id: string
          organization_id: string
          phone: string | null
          relationship: string
          same_address_as_member: boolean | null
          ssn_last4: string | null
          state: string | null
          status: string | null
          street_address: string | null
          tobacco_use_date: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          apartment?: string | null
          city?: string | null
          country?: string | null
          coverage_role?: string | null
          created_at?: string | null
          date_of_birth: string
          email?: string | null
          existing_condition?: boolean | null
          existing_condition_description?: string | null
          external_ref?: string | null
          first_name: string
          gender?: string | null
          has_existing_condition?: boolean | null
          id?: string
          included_in_enrollment?: boolean | null
          is_primary?: boolean | null
          is_smoker?: boolean | null
          last_name: string
          member_id: string
          organization_id: string
          phone?: string | null
          relationship: string
          same_address_as_member?: boolean | null
          ssn_last4?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          tobacco_use_date?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          apartment?: string | null
          city?: string | null
          country?: string | null
          coverage_role?: string | null
          created_at?: string | null
          date_of_birth?: string
          email?: string | null
          existing_condition?: boolean | null
          existing_condition_description?: string | null
          external_ref?: string | null
          first_name?: string
          gender?: string | null
          has_existing_condition?: boolean | null
          id?: string
          included_in_enrollment?: boolean | null
          is_primary?: boolean | null
          is_smoker?: boolean | null
          last_name?: string
          member_id?: string
          organization_id?: string
          phone?: string | null
          relationship?: string
          same_address_as_member?: boolean | null
          ssn_last4?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          tobacco_use_date?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dependents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_assets: {
        Row: {
          alt_text: string | null
          bucket_path: string
          created_at: string | null
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number
          folder: string | null
          height: number | null
          id: string
          is_public: boolean | null
          mime_type: string
          name: string
          org_id: string
          public_url: string | null
          tags: string[] | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket_path: string
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_path: string
          file_size: number
          folder?: string | null
          height?: number | null
          id?: string
          is_public?: boolean | null
          mime_type: string
          name: string
          org_id: string
          public_url?: string | null
          tags?: string[] | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket_path?: string
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          folder?: string | null
          height?: number | null
          id?: string
          is_public?: boolean | null
          mime_type?: string
          name?: string
          org_id?: string
          public_url?: string | null
          tags?: string[] | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          bucket_path: string
          campaign_id: string | null
          content_id: string | null
          created_at: string | null
          created_by: string | null
          email_id: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_inline: boolean | null
          mime_type: string
          org_id: string
          sequence_step_id: string | null
          template_id: string | null
        }
        Insert: {
          bucket_path: string
          campaign_id?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          is_inline?: boolean | null
          mime_type: string
          org_id: string
          sequence_step_id?: string | null
          template_id?: string | null
        }
        Update: {
          bucket_path?: string
          campaign_id?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_inline?: boolean | null
          mime_type?: string
          org_id?: string
          sequence_step_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          campaign_id: string
          click_count: number | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          email: string
          error_message: string | null
          failed_at: string | null
          first_name: string | null
          id: string
          last_clicked_at: string | null
          last_name: string | null
          last_opened_at: string | null
          merge_data: Json | null
          module_key: string
          open_count: number | null
          opened_at: string | null
          provider_message_id: string | null
          record_id: string
          sent_at: string | null
          skip_reason: string | null
          status: string
          tracking_id: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id: string
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          failed_at?: string | null
          first_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_name?: string | null
          last_opened_at?: string | null
          merge_data?: Json | null
          module_key: string
          open_count?: number | null
          opened_at?: string | null
          provider_message_id?: string | null
          record_id: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          tracking_id?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          failed_at?: string | null
          first_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_name?: string | null
          last_opened_at?: string | null
          merge_data?: Json | null
          module_key?: string
          open_count?: number | null
          opened_at?: string | null
          provider_message_id?: string | null
          record_id?: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          tracking_id?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          attachment_count: number | null
          body_html: string
          body_text: string | null
          bounced_count: number | null
          clicked_count: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          filter_config: Json | null
          from_email: string | null
          from_name: string | null
          id: string
          module_key: string | null
          name: string
          opened_count: number | null
          org_id: string
          reply_to: string | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          subject: string
          total_recipients: number | null
          unsubscribed_count: number | null
          updated_at: string | null
          view_id: string | null
        }
        Insert: {
          attachment_count?: number | null
          body_html: string
          body_text?: string | null
          bounced_count?: number | null
          clicked_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          filter_config?: Json | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          module_key?: string | null
          name: string
          opened_count?: number | null
          org_id: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject: string
          total_recipients?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          view_id?: string | null
        }
        Update: {
          attachment_count?: number | null
          body_html?: string
          body_text?: string | null
          bounced_count?: number | null
          clicked_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          filter_config?: Json | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          module_key?: string | null
          name?: string
          opened_count?: number | null
          org_id?: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject?: string
          total_recipients?: number | null
          unsubscribed_count?: number | null
          updated_at?: string | null
          view_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domains: {
        Row: {
          created_at: string | null
          created_by: string | null
          dkim_selector: string | null
          dkim_value: string | null
          dkim_verified: boolean | null
          dkim_verified_at: string | null
          dmarc_value: string | null
          dmarc_verified: boolean | null
          dmarc_verified_at: string | null
          domain: string
          error_message: string | null
          id: string
          last_verification_at: string | null
          org_id: string
          sendgrid_domain_id: string | null
          spf_value: string | null
          spf_verified: boolean | null
          spf_verified_at: string | null
          status: string
          updated_at: string | null
          verification_attempts: number | null
          verification_token: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dkim_selector?: string | null
          dkim_value?: string | null
          dkim_verified?: boolean | null
          dkim_verified_at?: string | null
          dmarc_value?: string | null
          dmarc_verified?: boolean | null
          dmarc_verified_at?: string | null
          domain: string
          error_message?: string | null
          id?: string
          last_verification_at?: string | null
          org_id: string
          sendgrid_domain_id?: string | null
          spf_value?: string | null
          spf_verified?: boolean | null
          spf_verified_at?: string | null
          status?: string
          updated_at?: string | null
          verification_attempts?: number | null
          verification_token?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dkim_selector?: string | null
          dkim_value?: string | null
          dkim_verified?: boolean | null
          dkim_verified_at?: string | null
          dmarc_value?: string | null
          dmarc_verified?: boolean | null
          dmarc_verified_at?: string | null
          domain?: string
          error_message?: string | null
          id?: string
          last_verification_at?: string | null
          org_id?: string
          sendgrid_domain_id?: string | null
          spf_value?: string | null
          spf_verified?: boolean | null
          spf_verified_at?: string | null
          status?: string
          updated_at?: string | null
          verification_attempts?: number | null
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_domains_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          occurred_at: string | null
          provider_message_id: string | null
          sent_email_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string | null
          provider_message_id?: string | null
          sent_email_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string | null
          provider_message_id?: string | null
          sent_email_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number | null
          body_html: string
          body_text: string | null
          created_at: string | null
          error_message: string | null
          from_email: string
          from_name: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          organization_id: string
          priority: number | null
          recipient_id: string | null
          recipient_type: string | null
          reply_to: string | null
          scheduled_for: string | null
          sent_email_id: string | null
          status: string
          subject: string
          template_data: Json | null
          template_id: string | null
          to_email: string
          to_name: string | null
          triggered_by: string | null
          triggered_by_profile_id: string | null
        }
        Insert: {
          attempts?: number | null
          body_html: string
          body_text?: string | null
          created_at?: string | null
          error_message?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          organization_id: string
          priority?: number | null
          recipient_id?: string | null
          recipient_type?: string | null
          reply_to?: string | null
          scheduled_for?: string | null
          sent_email_id?: string | null
          status?: string
          subject: string
          template_data?: Json | null
          template_id?: string | null
          to_email: string
          to_name?: string | null
          triggered_by?: string | null
          triggered_by_profile_id?: string | null
        }
        Update: {
          attempts?: number | null
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          error_message?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          organization_id?: string
          priority?: number | null
          recipient_id?: string | null
          recipient_type?: string | null
          reply_to?: string | null
          scheduled_for?: string | null
          sent_email_id?: string | null
          status?: string
          subject?: string
          template_data?: Json | null
          template_id?: string | null
          to_email?: string
          to_name?: string | null
          triggered_by?: string | null
          triggered_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_triggered_by_profile_id_fkey"
            columns: ["triggered_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sender_addresses: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_signature_id: string | null
          domain_id: string | null
          email: string
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          name: string | null
          org_id: string
          reply_to: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_signature_id?: string | null
          domain_id?: string | null
          email: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          org_id: string
          reply_to?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_signature_id?: string | null
          domain_id?: string | null
          email?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          org_id?: string
          reply_to?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sender_addresses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sender_addresses_default_signature_id_fkey"
            columns: ["default_signature_id"]
            isOneToOne: false
            referencedRelation: "email_signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sender_addresses_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sender_addresses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_enrollments: {
        Row: {
          completed_at: string | null
          current_step_id: string | null
          current_step_order: number | null
          email: string
          enrolled_at: string | null
          enrolled_by: string | null
          exit_reason: string | null
          exited_at: string | null
          id: string
          last_step_at: string | null
          metadata: Json | null
          module_key: string
          next_step_at: string | null
          record_id: string
          sequence_id: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          current_step_id?: string | null
          current_step_order?: number | null
          email: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          last_step_at?: string | null
          metadata?: Json | null
          module_key: string
          next_step_at?: string | null
          record_id: string
          sequence_id: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          current_step_id?: string | null
          current_step_order?: number | null
          email?: string
          enrolled_at?: string | null
          enrolled_by?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          last_step_at?: string | null
          metadata?: Json | null
          module_key?: string
          next_step_at?: string | null
          record_id?: string
          sequence_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_step_executions: {
        Row: {
          enrollment_id: string
          error_message: string | null
          executed_at: string | null
          id: string
          metadata: Json | null
          provider_message_id: string | null
          status: string
          step_id: string
        }
        Insert: {
          enrollment_id: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          status: string
          step_id: string
        }
        Update: {
          enrollment_id?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_step_executions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_steps: {
        Row: {
          ab_variants: Json | null
          action_config: Json | null
          attachment_ids: string[] | null
          body_html: string | null
          body_text: string | null
          bounce_count: number | null
          click_count: number | null
          condition_config: Json | null
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          delay_minutes: number | null
          from_email: string | null
          from_name: string | null
          id: string
          is_ab_test: boolean | null
          name: string | null
          open_count: number | null
          reply_count: number | null
          send_days: Json | null
          send_time: string | null
          sent_count: number | null
          sequence_id: string
          step_order: number
          step_type: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          ab_variants?: Json | null
          action_config?: Json | null
          attachment_ids?: string[] | null
          body_html?: string | null
          body_text?: string | null
          bounce_count?: number | null
          click_count?: number | null
          condition_config?: Json | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_ab_test?: boolean | null
          name?: string | null
          open_count?: number | null
          reply_count?: number | null
          send_days?: Json | null
          send_time?: string | null
          sent_count?: number | null
          sequence_id: string
          step_order: number
          step_type: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          ab_variants?: Json | null
          action_config?: Json | null
          attachment_ids?: string[] | null
          body_html?: string | null
          body_text?: string | null
          bounce_count?: number | null
          click_count?: number | null
          condition_config?: Json | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_ab_test?: boolean | null
          name?: string | null
          open_count?: number | null
          reply_count?: number | null
          send_days?: Json | null
          send_time?: string | null
          sent_count?: number | null
          sequence_id?: string
          step_order?: number
          step_type?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          exit_conditions: Json | null
          id: string
          name: string
          org_id: string
          settings: Json | null
          status: string | null
          total_completed: number | null
          total_enrolled: number | null
          total_exited: number | null
          trigger_config: Json | null
          trigger_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exit_conditions?: Json | null
          id?: string
          name: string
          org_id: string
          settings?: Json | null
          status?: string | null
          total_completed?: number | null
          total_enrolled?: number | null
          total_exited?: number | null
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exit_conditions?: Json | null
          id?: string
          name?: string
          org_id?: string
          settings?: Json | null
          status?: string | null
          total_completed?: number | null
          total_enrolled?: number | null
          total_exited?: number | null
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signatures: {
        Row: {
          content_html: string
          content_text: string | null
          created_at: string | null
          id: string
          include_in_new: boolean | null
          include_in_replies: boolean | null
          is_default: boolean | null
          logo_url: string | null
          name: string
          org_id: string
          photo_url: string | null
          profile_id: string
          social_links: Json
          updated_at: string | null
        }
        Insert: {
          content_html: string
          content_text?: string | null
          created_at?: string | null
          id?: string
          include_in_new?: boolean | null
          include_in_replies?: boolean | null
          is_default?: boolean | null
          logo_url?: string | null
          name?: string
          org_id: string
          photo_url?: string | null
          profile_id: string
          social_links?: Json
          updated_at?: string | null
        }
        Update: {
          content_html?: string
          content_text?: string | null
          created_at?: string | null
          id?: string
          include_in_new?: boolean | null
          include_in_replies?: boolean | null
          is_default?: boolean | null
          logo_url?: string | null
          name?: string
          org_id?: string
          photo_url?: string | null
          profile_id?: string
          social_links?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_signatures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_signatures_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          from_email: string | null
          from_name: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          organization_id: string
          reply_to: string | null
          slug: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          organization_id: string
          reply_to?: string | null
          slug: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          organization_id?: string
          reply_to?: string | null
          slug?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          created_at: string | null
          email: string
          id: string
          org_id: string
          reason: string | null
          source: string | null
          source_campaign_id: string | null
          unsubscribed_by: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          org_id: string
          reason?: string | null
          source?: string | null
          source_campaign_id?: string | null
          unsubscribed_by?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          org_id?: string
          reason?: string | null
          source?: string | null
          source_campaign_id?: string | null
          unsubscribed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribes_unsubscribed_by_fkey"
            columns: ["unsubscribed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_audit_log: {
        Row: {
          actor_profile_id: string | null
          created_at: string | null
          data_after: Json | null
          data_before: Json | null
          enrollment_id: string
          event_type: string
          id: string
          message: string | null
          new_status: string | null
          old_status: string | null
          organization_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string | null
          data_after?: Json | null
          data_before?: Json | null
          enrollment_id: string
          event_type: string
          id?: string
          message?: string | null
          new_status?: string | null
          old_status?: string | null
          organization_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string | null
          data_after?: Json | null
          data_before?: Json | null
          enrollment_id?: string
          event_type?: string
          id?: string
          message?: string | null
          new_status?: string | null
          old_status?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_audit_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_contracts: {
        Row: {
          contract_number: string | null
          contract_type: string
          created_at: string | null
          enrollment_id: string
          executed_at: string | null
          expires_at: string | null
          file_path: string | null
          file_size: number | null
          file_url: string | null
          generated_at: string | null
          id: string
          member_id: string
          organization_id: string
          signature_data: string | null
          signature_ip: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          status: string | null
          template_version: string | null
          updated_at: string | null
        }
        Insert: {
          contract_number?: string | null
          contract_type: string
          created_at?: string | null
          enrollment_id: string
          executed_at?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          member_id: string
          organization_id: string
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string | null
          template_version?: string | null
          updated_at?: string | null
        }
        Update: {
          contract_number?: string | null
          contract_type?: string
          created_at?: string | null
          enrollment_id?: string
          executed_at?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          generated_at?: string | null
          id?: string
          member_id?: string
          organization_id?: string
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string | null
          template_version?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_contracts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_contracts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_dependents: {
        Row: {
          additional_cost: number | null
          coverage_end_date: string | null
          coverage_start_date: string | null
          created_at: string | null
          dependent_id: string
          enrollment_id: string
          has_pre_existing_conditions: boolean | null
          id: string
          is_primary: boolean | null
          is_smoker: boolean | null
          relationship: string
          removal_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          additional_cost?: number | null
          coverage_end_date?: string | null
          coverage_start_date?: string | null
          created_at?: string | null
          dependent_id: string
          enrollment_id: string
          has_pre_existing_conditions?: boolean | null
          id?: string
          is_primary?: boolean | null
          is_smoker?: boolean | null
          relationship: string
          removal_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_cost?: number | null
          coverage_end_date?: string | null
          coverage_start_date?: string | null
          created_at?: string | null
          dependent_id?: string
          enrollment_id?: string
          has_pre_existing_conditions?: boolean | null
          id?: string
          is_primary?: boolean | null
          is_smoker?: boolean | null
          relationship?: string
          removal_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_dependents_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_dependents_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_link_analytics: {
        Row: {
          advisor_id: string | null
          avg_duration_seconds: number | null
          avg_page_views: number | null
          avg_time_to_convert_seconds: number | null
          bounce_rate: number | null
          calculated_at: string | null
          conversion_rate: number | null
          conversion_value: number | null
          created_at: string | null
          desktop_visits: number | null
          id: string
          link_id: string
          mobile_visits: number | null
          new_visitors: number | null
          organization_id: string
          period_date: string
          period_type: string
          returning_visitors: number | null
          tablet_visits: number | null
          top_countries: Json | null
          top_devices: Json | null
          top_referrers: Json | null
          total_conversions: number | null
          total_visits: number | null
          unique_visitors: number | null
        }
        Insert: {
          advisor_id?: string | null
          avg_duration_seconds?: number | null
          avg_page_views?: number | null
          avg_time_to_convert_seconds?: number | null
          bounce_rate?: number | null
          calculated_at?: string | null
          conversion_rate?: number | null
          conversion_value?: number | null
          created_at?: string | null
          desktop_visits?: number | null
          id?: string
          link_id: string
          mobile_visits?: number | null
          new_visitors?: number | null
          organization_id: string
          period_date: string
          period_type: string
          returning_visitors?: number | null
          tablet_visits?: number | null
          top_countries?: Json | null
          top_devices?: Json | null
          top_referrers?: Json | null
          total_conversions?: number | null
          total_visits?: number | null
          unique_visitors?: number | null
        }
        Update: {
          advisor_id?: string | null
          avg_duration_seconds?: number | null
          avg_page_views?: number | null
          avg_time_to_convert_seconds?: number | null
          bounce_rate?: number | null
          calculated_at?: string | null
          conversion_rate?: number | null
          conversion_value?: number | null
          created_at?: string | null
          desktop_visits?: number | null
          id?: string
          link_id?: string
          mobile_visits?: number | null
          new_visitors?: number | null
          organization_id?: string
          period_date?: string
          period_type?: string
          returning_visitors?: number | null
          tablet_visits?: number | null
          top_countries?: Json | null
          top_devices?: Json | null
          top_referrers?: Json | null
          total_conversions?: number | null
          total_visits?: number | null
          unique_visitors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_link_analytics_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_analytics_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "enrollment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_link_conversions: {
        Row: {
          advisor_id: string | null
          attribution_model: string | null
          conversion_value: number | null
          converted_at: string | null
          created_at: string | null
          enrollment_id: string | null
          first_touch_at: string | null
          id: string
          last_touch_at: string | null
          lifetime_value: number | null
          link_id: string
          member_id: string | null
          organization_id: string
          time_to_convert_seconds: number | null
          visit_id: string | null
          visits_before_conversion: number | null
        }
        Insert: {
          advisor_id?: string | null
          attribution_model?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          first_touch_at?: string | null
          id?: string
          last_touch_at?: string | null
          lifetime_value?: number | null
          link_id: string
          member_id?: string | null
          organization_id: string
          time_to_convert_seconds?: number | null
          visit_id?: string | null
          visits_before_conversion?: number | null
        }
        Update: {
          advisor_id?: string | null
          attribution_model?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          first_touch_at?: string | null
          id?: string
          last_touch_at?: string | null
          lifetime_value?: number | null
          link_id?: string
          member_id?: string | null
          organization_id?: string
          time_to_convert_seconds?: number | null
          visit_id?: string | null
          visits_before_conversion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_link_conversions_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_conversions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_conversions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "enrollment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_conversions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_conversions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "enrollment_link_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_link_visits: {
        Row: {
          advisor_id: string | null
          browser: string | null
          browser_version: string | null
          city: string | null
          conversion_id: string | null
          converted: boolean | null
          converted_at: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          device_type: string | null
          duration_seconds: number | null
          id: string
          interactions: Json | null
          ip_address: string | null
          landing_page: string | null
          latitude: number | null
          link_id: string
          longitude: number | null
          organization_id: string
          os: string | null
          os_version: string | null
          page_views: number | null
          postal_code: string | null
          referrer_domain: string | null
          referrer_url: string | null
          region: string | null
          scroll_depth_percent: number | null
          session_id: string
          timezone: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visited_at: string | null
          visitor_id: string | null
        }
        Insert: {
          advisor_id?: string | null
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          conversion_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          interactions?: Json | null
          ip_address?: string | null
          landing_page?: string | null
          latitude?: number | null
          link_id: string
          longitude?: number | null
          organization_id: string
          os?: string | null
          os_version?: string | null
          page_views?: number | null
          postal_code?: string | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          scroll_depth_percent?: number | null
          session_id: string
          timezone?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          advisor_id?: string | null
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          conversion_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          interactions?: Json | null
          ip_address?: string | null
          landing_page?: string | null
          latitude?: number | null
          link_id?: string
          longitude?: number | null
          organization_id?: string
          os?: string | null
          os_version?: string | null
          page_views?: number | null
          postal_code?: string | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          scroll_depth_percent?: number | null
          session_id?: string
          timezone?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_link_visits_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_visits_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "enrollment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_link_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_links: {
        Row: {
          advisor_id: string
          conversion_rate: number | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          name: string
          organization_id: string
          password_hash: string | null
          product_id: string | null
          requires_password: boolean | null
          slug: string
          target_url: string | null
          total_conversions: number | null
          total_visits: number | null
          unique_visits: number | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          advisor_id: string
          conversion_rate?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          name: string
          organization_id: string
          password_hash?: string | null
          product_id?: string | null
          requires_password?: boolean | null
          slug: string
          target_url?: string | null
          total_conversions?: number | null
          total_visits?: number | null
          unique_visits?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          advisor_id?: string
          conversion_rate?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          name?: string
          organization_id?: string
          password_hash?: string | null
          product_id?: string | null
          requires_password?: boolean | null
          slug?: string
          target_url?: string | null
          total_conversions?: number | null
          total_visits?: number | null
          unique_visits?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_links_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_logs: {
        Row: {
          action: string
          action_category: string | null
          advisor_id: string | null
          created_at: string | null
          description: string | null
          details: Json | null
          enrollment_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          is_error: boolean | null
          member_id: string | null
          organization_id: string
          profile_id: string | null
          status_after: string | null
          status_before: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category?: string | null
          advisor_id?: string | null
          created_at?: string | null
          description?: string | null
          details?: Json | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          is_error?: boolean | null
          member_id?: string | null
          organization_id: string
          profile_id?: string | null
          status_after?: string | null
          status_before?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string | null
          advisor_id?: string | null
          created_at?: string | null
          description?: string | null
          details?: Json | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          is_error?: boolean | null
          member_id?: string | null
          organization_id?: string
          profile_id?: string | null
          status_after?: string | null
          status_before?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_logs_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrollment_id: string
          id: string
          is_completed: boolean | null
          organization_id: string
          payload: Json | null
          step_key: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id: string
          id?: string
          is_completed?: boolean | null
          organization_id: string
          payload?: Json | null
          step_key: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string
          id?: string
          is_completed?: boolean | null
          organization_id?: string
          payload?: Json | null
          step_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_steps_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_wizard_state: {
        Row: {
          advisor_id: string | null
          completed_at: string | null
          completed_steps: number[] | null
          created_at: string | null
          current_step: number | null
          enrollment_id: string | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          member_id: string | null
          organization_id: string
          session_id: string
          source_url: string | null
          started_at: string | null
          status: string | null
          step1_data: Json | null
          step2_data: Json | null
          step3_data: Json | null
          step4_data: Json | null
          updated_at: string | null
          utm_params: Json | null
        }
        Insert: {
          advisor_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          created_at?: string | null
          current_step?: number | null
          enrollment_id?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          member_id?: string | null
          organization_id: string
          session_id: string
          source_url?: string | null
          started_at?: string | null
          status?: string | null
          step1_data?: Json | null
          step2_data?: Json | null
          step3_data?: Json | null
          step4_data?: Json | null
          updated_at?: string | null
          utm_params?: Json | null
        }
        Update: {
          advisor_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          created_at?: string | null
          current_step?: number | null
          enrollment_id?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          member_id?: string | null
          organization_id?: string
          session_id?: string
          source_url?: string | null
          started_at?: string | null
          status?: string | null
          step1_data?: Json | null
          step2_data?: Json | null
          step3_data?: Json | null
          step4_data?: Json | null
          updated_at?: string | null
          utm_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_wizard_state_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_state_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_state_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          advisor_email: string | null
          advisor_first_name: string | null
          advisor_id: string | null
          advisor_last_name: string | null
          advisor_level: string | null
          agreed_to_guidelines: boolean | null
          agreed_to_privacy: boolean | null
          agreed_to_terms: boolean | null
          annual_fee: number | null
          approved_at: string | null
          approved_by: string | null
          base_monthly_cost: number | null
          benefit_type_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          channel: string | null
          created_at: string | null
          custom_fields: Json | null
          effective_date: string | null
          end_date: string | null
          enrollment_date: string | null
          enrollment_mode: string
          enrollment_number: string | null
          enrollment_source: string | null
          external_vendor_enrollment_id: string | null
          guidelines_agreed_at: string | null
          has_age65_warning: boolean | null
          has_mandate_warning: boolean | null
          has_pre_existing_conditions: boolean | null
          household_size: number | null
          id: string
          initial_payment_amount: number | null
          initial_payment_date: string | null
          initial_payment_paid: boolean | null
          initial_transaction_id: string | null
          iua_id: string | null
          last_status_change_at: string | null
          lead_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          plan_type: string | null
          pre_existing_conditions_details: string | null
          pricing_matrix_id: string | null
          primary_is_smoker: boolean | null
          primary_member_id: string
          primary_tobacco_date: string | null
          privacy_agreed_at: string | null
          product_id: string | null
          referrer_url: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_effective_date: string | null
          rx_medications: Json | null
          rx_pricing_result: Json | null
          selected_plan_id: string | null
          setup_fee: number | null
          signature_data: string | null
          signature_ip_address: string | null
          signature_timestamp: string | null
          signature_user_agent: string | null
          snapshot: Json | null
          source: string | null
          source_url: string | null
          start_date: string | null
          status: string
          status_reason: string | null
          submitted_at: string | null
          termination_date: string | null
          terms_agreed_at: string | null
          tobacco_surcharge: number | null
          total_monthly_cost: number | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          advisor_email?: string | null
          advisor_first_name?: string | null
          advisor_id?: string | null
          advisor_last_name?: string | null
          advisor_level?: string | null
          agreed_to_guidelines?: boolean | null
          agreed_to_privacy?: boolean | null
          agreed_to_terms?: boolean | null
          annual_fee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_monthly_cost?: number | null
          benefit_type_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          channel?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          effective_date?: string | null
          end_date?: string | null
          enrollment_date?: string | null
          enrollment_mode?: string
          enrollment_number?: string | null
          enrollment_source?: string | null
          external_vendor_enrollment_id?: string | null
          guidelines_agreed_at?: string | null
          has_age65_warning?: boolean | null
          has_mandate_warning?: boolean | null
          has_pre_existing_conditions?: boolean | null
          household_size?: number | null
          id?: string
          initial_payment_amount?: number | null
          initial_payment_date?: string | null
          initial_payment_paid?: boolean | null
          initial_transaction_id?: string | null
          iua_id?: string | null
          last_status_change_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          plan_type?: string | null
          pre_existing_conditions_details?: string | null
          pricing_matrix_id?: string | null
          primary_is_smoker?: boolean | null
          primary_member_id: string
          primary_tobacco_date?: string | null
          privacy_agreed_at?: string | null
          product_id?: string | null
          referrer_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_effective_date?: string | null
          rx_medications?: Json | null
          rx_pricing_result?: Json | null
          selected_plan_id?: string | null
          setup_fee?: number | null
          signature_data?: string | null
          signature_ip_address?: string | null
          signature_timestamp?: string | null
          signature_user_agent?: string | null
          snapshot?: Json | null
          source?: string | null
          source_url?: string | null
          start_date?: string | null
          status?: string
          status_reason?: string | null
          submitted_at?: string | null
          termination_date?: string | null
          terms_agreed_at?: string | null
          tobacco_surcharge?: number | null
          total_monthly_cost?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          advisor_email?: string | null
          advisor_first_name?: string | null
          advisor_id?: string | null
          advisor_last_name?: string | null
          advisor_level?: string | null
          agreed_to_guidelines?: boolean | null
          agreed_to_privacy?: boolean | null
          agreed_to_terms?: boolean | null
          annual_fee?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_monthly_cost?: number | null
          benefit_type_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          channel?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          effective_date?: string | null
          end_date?: string | null
          enrollment_date?: string | null
          enrollment_mode?: string
          enrollment_number?: string | null
          enrollment_source?: string | null
          external_vendor_enrollment_id?: string | null
          guidelines_agreed_at?: string | null
          has_age65_warning?: boolean | null
          has_mandate_warning?: boolean | null
          has_pre_existing_conditions?: boolean | null
          household_size?: number | null
          id?: string
          initial_payment_amount?: number | null
          initial_payment_date?: string | null
          initial_payment_paid?: boolean | null
          initial_transaction_id?: string | null
          iua_id?: string | null
          last_status_change_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          plan_type?: string | null
          pre_existing_conditions_details?: string | null
          pricing_matrix_id?: string | null
          primary_is_smoker?: boolean | null
          primary_member_id?: string
          primary_tobacco_date?: string | null
          privacy_agreed_at?: string | null
          product_id?: string | null
          referrer_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_effective_date?: string | null
          rx_medications?: Json | null
          rx_pricing_result?: Json | null
          selected_plan_id?: string | null
          setup_fee?: number | null
          signature_data?: string | null
          signature_ip_address?: string | null
          signature_timestamp?: string | null
          signature_user_agent?: string | null
          snapshot?: Json | null
          source?: string | null
          source_url?: string | null
          start_date?: string | null
          status?: string
          status_reason?: string | null
          submitted_at?: string | null
          termination_date?: string | null
          terms_agreed_at?: string | null
          tobacco_surcharge?: number | null
          total_monthly_cost?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_primary_member_id_fkey"
            columns: ["primary_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_selected_plan_id_fkey"
            columns: ["selected_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      field_mappings: {
        Row: {
          created_at: string | null
          entity_type: string
          id: string
          is_default: boolean | null
          mapping: Json
          name: string
          organization_id: string
          source_columns: Json | null
          source_name: string
          target_columns: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          id?: string
          is_default?: boolean | null
          mapping?: Json
          name: string
          organization_id: string
          source_columns?: Json | null
          source_name: string
          target_columns?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean | null
          mapping?: Json
          name?: string
          organization_id?: string
          source_columns?: Json | null
          source_name?: string
          target_columns?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          performed_at: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          created_at: string | null
          entity_id: string | null
          error_message: string | null
          id: string
          import_job_id: string
          linked_entity_ids: Json | null
          match_type: string | null
          normalized_data: Json | null
          processed_at: string | null
          raw_data: Json
          row_index: number
          status: string
          validation_errors: Json | null
          warnings: Json | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          import_job_id: string
          linked_entity_ids?: Json | null
          match_type?: string | null
          normalized_data?: Json | null
          processed_at?: string | null
          raw_data: Json
          row_index: number
          status?: string
          validation_errors?: Json | null
          warnings?: Json | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          import_job_id?: string
          linked_entity_ids?: Json | null
          match_type?: string | null
          normalized_data?: Json | null
          processed_at?: string | null
          raw_data?: Json
          row_index?: number
          status?: string
          validation_errors?: Json | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          can_rollback: boolean | null
          completed_at: string | null
          created_at: string | null
          created_by_profile_id: string
          duplicate_strategy: string | null
          entity_type: string
          error_count: number | null
          error_message: string | null
          field_mapping_id: string | null
          file_name: string | null
          id: string
          inserted_count: number | null
          is_incremental: boolean | null
          is_preview: boolean | null
          organization_id: string
          processed_rows: number | null
          rollback_at: string | null
          rollback_status: string | null
          skipped_count: number | null
          source_name: string | null
          started_at: string | null
          status: string
          total_rows: number | null
          updated_count: number | null
          validation_errors: Json | null
          warnings_count: number | null
        }
        Insert: {
          can_rollback?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by_profile_id: string
          duplicate_strategy?: string | null
          entity_type: string
          error_count?: number | null
          error_message?: string | null
          field_mapping_id?: string | null
          file_name?: string | null
          id?: string
          inserted_count?: number | null
          is_incremental?: boolean | null
          is_preview?: boolean | null
          organization_id: string
          processed_rows?: number | null
          rollback_at?: string | null
          rollback_status?: string | null
          skipped_count?: number | null
          source_name?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_count?: number | null
          validation_errors?: Json | null
          warnings_count?: number | null
        }
        Update: {
          can_rollback?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by_profile_id?: string
          duplicate_strategy?: string | null
          entity_type?: string
          error_count?: number | null
          error_message?: string | null
          field_mapping_id?: string | null
          file_name?: string | null
          id?: string
          inserted_count?: number | null
          is_incremental?: boolean | null
          is_preview?: boolean | null
          organization_id?: string
          processed_rows?: number | null
          rollback_at?: string | null
          rollback_status?: string | null
          skipped_count?: number | null
          source_name?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_count?: number | null
          validation_errors?: Json | null
          warnings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_field_mapping_id_fkey"
            columns: ["field_mapping_id"]
            isOneToOne: false
            referencedRelation: "field_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_snapshots: {
        Row: {
          action: string
          created_at: string | null
          data_after: Json
          data_before: Json | null
          entity_id: string
          entity_type: string
          id: string
          import_job_id: string
          import_job_row_id: string | null
          is_rolled_back: boolean | null
          organization_id: string
          rolled_back_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          data_after: Json
          data_before?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          import_job_id: string
          import_job_row_id?: string | null
          is_rolled_back?: boolean | null
          organization_id: string
          rolled_back_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          data_after?: Json
          data_before?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          import_job_id?: string
          import_job_row_id?: string | null
          is_rolled_back?: boolean | null
          organization_id?: string
          rolled_back_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_snapshots_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_snapshots_import_job_row_id_fkey"
            columns: ["import_job_row_id"]
            isOneToOne: false
            referencedRelation: "import_job_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_conversations: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          channel: string
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          first_message_at: string
          id: string
          labels: Json
          last_message_at: string
          last_read_at: string | null
          last_read_by: string | null
          linked_account_id: string | null
          linked_deal_id: string | null
          linked_lead_id: string | null
          message_count: number
          metadata: Json
          org_id: string
          preview: string | null
          priority: string
          resolved_at: string | null
          snoozed_until: string | null
          status: string
          subject: string | null
          tags: string[]
          thread_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          channel: string
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          first_message_at?: string
          id?: string
          labels?: Json
          last_message_at?: string
          last_read_at?: string | null
          last_read_by?: string | null
          linked_account_id?: string | null
          linked_deal_id?: string | null
          linked_lead_id?: string | null
          message_count?: number
          metadata?: Json
          org_id: string
          preview?: string | null
          priority?: string
          resolved_at?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          thread_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          channel?: string
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          first_message_at?: string
          id?: string
          labels?: Json
          last_message_at?: string
          last_read_at?: string | null
          last_read_by?: string | null
          linked_account_id?: string | null
          linked_deal_id?: string | null
          linked_lead_id?: string | null
          message_count?: number
          metadata?: Json
          org_id?: string
          preview?: string | null
          priority?: string
          resolved_at?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          thread_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_last_read_by_fkey"
            columns: ["last_read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          channel: string
          clicked_at: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          external_provider: string | null
          from_address: string | null
          from_name: string | null
          id: string
          metadata: Json
          opened_at: string | null
          org_id: string
          replied_at: string | null
          sent_at: string
          status: string
          subject: string | null
          to_address: string | null
          to_name: string | null
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          channel: string
          clicked_at?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          external_provider?: string | null
          from_address?: string | null
          from_name?: string | null
          id?: string
          metadata?: Json
          opened_at?: string | null
          org_id: string
          replied_at?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          to_address?: string | null
          to_name?: string | null
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          channel?: string
          clicked_at?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          external_provider?: string | null
          from_address?: string | null
          from_name?: string | null
          id?: string
          metadata?: Json
          opened_at?: string | null
          org_id?: string
          replied_at?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          to_address?: string | null
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          access_token_enc: string | null
          api_key_enc: string | null
          api_secret_enc: string | null
          connection_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          error_count: number | null
          external_account_email: string | null
          external_account_id: string | null
          external_account_name: string | null
          health_status: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_webhook_at: string | null
          name: string
          org_id: string
          provider: string
          refresh_token_enc: string | null
          refresh_token_expires_at: string | null
          scopes: string[] | null
          settings: Json | null
          status: string
          sync_cursor: string | null
          token_expires_at: string | null
          updated_at: string | null
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token_enc?: string | null
          api_key_enc?: string | null
          api_secret_enc?: string | null
          connection_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_count?: number | null
          external_account_email?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          health_status?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_webhook_at?: string | null
          name: string
          org_id: string
          provider: string
          refresh_token_enc?: string | null
          refresh_token_expires_at?: string | null
          scopes?: string[] | null
          settings?: Json | null
          status?: string
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token_enc?: string | null
          api_key_enc?: string | null
          api_secret_enc?: string | null
          connection_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_count?: number | null
          external_account_email?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          health_status?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_webhook_at?: string | null
          name?: string
          org_id?: string
          provider?: string
          refresh_token_enc?: string | null
          refresh_token_expires_at?: string | null
          scopes?: string[] | null
          settings?: Json | null
          status?: string
          sync_cursor?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          connection_id: string | null
          created_at: string | null
          direction: string
          duration_ms: number | null
          endpoint: string | null
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          method: string | null
          org_id: string
          provider: string
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
          status: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string | null
          direction?: string
          duration_ms?: number | null
          endpoint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          method?: string | null
          org_id: string
          provider: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string | null
          direction?: string
          duration_ms?: number | null
          endpoint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          method?: string | null
          org_id?: string
          provider?: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_jobs: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          items_created: number | null
          items_failed: number | null
          items_processed: number | null
          items_total: number | null
          items_updated: number | null
          job_type: string
          max_retries: number | null
          metadata: Json | null
          next_retry_at: string | null
          org_id: string
          progress_pct: number | null
          retry_count: number | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_total?: number | null
          items_updated?: number | null
          job_type: string
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          org_id: string
          progress_pct?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_total?: number | null
          items_updated?: number | null
          job_type?: string
          max_retries?: number | null
          metadata?: Json | null
          next_retry_at?: string | null
          org_id?: string
          progress_pct?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhooks: {
        Row: {
          connection_id: string | null
          created_at: string | null
          endpoint_path: string
          error_count: number | null
          event_types: string[]
          id: string
          is_active: boolean | null
          last_received_at: string | null
          org_id: string
          provider: string
          received_count: number | null
          secret_key: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string | null
          endpoint_path: string
          error_count?: number | null
          event_types?: string[]
          id?: string
          is_active?: boolean | null
          last_received_at?: string | null
          org_id: string
          provider: string
          received_count?: number | null
          secret_key?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string | null
          endpoint_path?: string
          error_count?: number | null
          event_types?: string[]
          id?: string
          is_active?: boolean | null
          last_received_at?: string | null
          org_id?: string
          provider?: string
          received_count?: number | null
          secret_key?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhooks_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_generation_jobs: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          error_message: string | null
          failed_invoices: number | null
          id: string
          invoice_group_id: string | null
          is_retro: boolean | null
          job_name: string | null
          job_type: string
          member_ids: string[] | null
          organization_id: string | null
          original_period_end: string | null
          original_period_start: string | null
          result_details: Json | null
          retro_reason: string | null
          started_at: string | null
          status: string | null
          successful_invoices: number | null
          total_amount: number | null
          total_invoices: number | null
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          error_message?: string | null
          failed_invoices?: number | null
          id?: string
          invoice_group_id?: string | null
          is_retro?: boolean | null
          job_name?: string | null
          job_type: string
          member_ids?: string[] | null
          organization_id?: string | null
          original_period_end?: string | null
          original_period_start?: string | null
          result_details?: Json | null
          retro_reason?: string | null
          started_at?: string | null
          status?: string | null
          successful_invoices?: number | null
          total_amount?: number | null
          total_invoices?: number | null
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          error_message?: string | null
          failed_invoices?: number | null
          id?: string
          invoice_group_id?: string | null
          is_retro?: boolean | null
          job_name?: string | null
          job_type?: string
          member_ids?: string[] | null
          organization_id?: string | null
          original_period_end?: string | null
          original_period_start?: string | null
          result_details?: Json | null
          retro_reason?: string | null
          started_at?: string | null
          status?: string | null
          successful_invoices?: number | null
          total_amount?: number | null
          total_invoices?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_generation_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_generation_jobs_invoice_group_id_fkey"
            columns: ["invoice_group_id"]
            isOneToOne: false
            referencedRelation: "invoice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_generation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_group_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          invoice_group_id: string | null
          member_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          invoice_group_id?: string | null
          member_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          invoice_group_id?: string | null
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_group_members_invoice_group_id_fkey"
            columns: ["invoice_group_id"]
            isOneToOne: false
            referencedRelation: "invoice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_groups: {
        Row: {
          auto_generate: boolean | null
          auto_send: boolean | null
          billing_day: number | null
          billing_frequency: string | null
          created_at: string | null
          created_by: string | null
          criteria: Json | null
          default_due_days: number | null
          description: string | null
          group_type: string
          id: string
          invoice_prefix: string | null
          is_active: boolean | null
          last_generated_at: string | null
          last_generated_by: string | null
          member_count: number | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_generate?: boolean | null
          auto_send?: boolean | null
          billing_day?: number | null
          billing_frequency?: string | null
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          default_due_days?: number | null
          description?: string | null
          group_type: string
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean | null
          last_generated_at?: string | null
          last_generated_by?: string | null
          member_count?: number | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_generate?: boolean | null
          auto_send?: boolean | null
          billing_day?: number | null
          billing_frequency?: string | null
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          default_due_days?: number | null
          description?: string | null
          group_type?: string
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean | null
          last_generated_at?: string | null
          last_generated_by?: string | null
          member_count?: number | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_groups_last_generated_by_fkey"
            columns: ["last_generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustments: number | null
          amount_paid: number | null
          balance_due: number | null
          created_at: string | null
          due_date: string
          enrollment_id: string | null
          generation_job_id: string | null
          id: string
          invoice_number: string
          is_retro: boolean | null
          line_items: Json | null
          member_id: string
          notes: string | null
          organization_id: string
          original_invoice_id: string | null
          paid_at: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          processing_fee: number | null
          retro_reason: string | null
          sent_at: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string | null
        }
        Insert: {
          adjustments?: number | null
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          due_date: string
          enrollment_id?: string | null
          generation_job_id?: string | null
          id?: string
          invoice_number: string
          is_retro?: boolean | null
          line_items?: Json | null
          member_id: string
          notes?: string | null
          organization_id: string
          original_invoice_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          processing_fee?: number | null
          retro_reason?: string | null
          sent_at?: string | null
          status?: string
          subtotal: number
          total: number
          updated_at?: string | null
        }
        Update: {
          adjustments?: number | null
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string | null
          due_date?: string
          enrollment_id?: string | null
          generation_job_id?: string | null
          id?: string
          invoice_number?: string
          is_retro?: boolean | null
          line_items?: Json | null
          member_id?: string
          notes?: string | null
          organization_id?: string
          original_invoice_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          processing_fee?: number | null
          retro_reason?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "invoice_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      job_definitions: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          job_type: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          schedule_cron: string | null
          schedule_timezone: string | null
          updated_at: string
          vendor_code: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          job_type: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          schedule_cron?: string | null
          schedule_timezone?: string | null
          updated_at?: string
          vendor_code?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          job_type?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          schedule_cron?: string | null
          schedule_timezone?: string | null
          updated_at?: string
          vendor_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          job_definition_id: string | null
          job_name: string
          job_type: string
          logs: Json | null
          organization_id: string
          records_failed: number | null
          records_processed: number | null
          records_succeeded: number | null
          result: Json | null
          retried_from_id: string | null
          retry_count: number | null
          started_at: string | null
          status: string
          trigger_type: string
          triggered_by: string | null
          vendor_code: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_definition_id?: string | null
          job_name: string
          job_type: string
          logs?: Json | null
          organization_id: string
          records_failed?: number | null
          records_processed?: number | null
          records_succeeded?: number | null
          result?: Json | null
          retried_from_id?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          trigger_type?: string
          triggered_by?: string | null
          vendor_code?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_definition_id?: string | null
          job_name?: string
          job_type?: string
          logs?: Json | null
          organization_id?: string
          records_failed?: number | null
          records_processed?: number | null
          records_succeeded?: number | null
          result?: Json | null
          retried_from_id?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          trigger_type?: string
          triggered_by?: string | null
          vendor_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_job_definition_id_fkey"
            columns: ["job_definition_id"]
            isOneToOne: false
            referencedRelation: "job_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_retried_from_id_fkey"
            columns: ["retried_from_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_events: {
        Row: {
          created_at: string | null
          enrollment_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          landing_page_id: string
          lead_id: string | null
          meta: Json | null
          organization_id: string
          referrer: string | null
          session_id: string | null
          step_name: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrollment_id?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          landing_page_id: string
          lead_id?: string | null
          meta?: Json | null
          organization_id: string
          referrer?: string | null
          session_id?: string | null
          step_name?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          landing_page_id?: string
          lead_id?: string | null
          meta?: Json | null
          organization_id?: string
          referrer?: string | null
          session_id?: string | null
          step_name?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          advisor_selection_enabled: boolean | null
          background_style: string | null
          conversion_rate: number | null
          created_at: string | null
          created_by: string | null
          default_advisor_id: string | null
          default_plan_id: string | null
          form_fields: Json | null
          headline: string | null
          hero_image_url: string | null
          id: string
          is_published: boolean | null
          logo_url: string | null
          meta: Json | null
          name: string
          organization_id: string
          page_type: string
          plan_ids: string[] | null
          primary_color: string | null
          published_at: string | null
          required_fields: string[] | null
          secondary_color: string | null
          slug: string
          subheadline: string | null
          submissions_count: number | null
          updated_at: string | null
          utm_campaign: string | null
          utm_source: string | null
          views_count: number | null
        }
        Insert: {
          advisor_selection_enabled?: boolean | null
          background_style?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          default_advisor_id?: string | null
          default_plan_id?: string | null
          form_fields?: Json | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          meta?: Json | null
          name: string
          organization_id: string
          page_type?: string
          plan_ids?: string[] | null
          primary_color?: string | null
          published_at?: string | null
          required_fields?: string[] | null
          secondary_color?: string | null
          slug: string
          subheadline?: string | null
          submissions_count?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
          views_count?: number | null
        }
        Update: {
          advisor_selection_enabled?: boolean | null
          background_style?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          default_advisor_id?: string | null
          default_plan_id?: string | null
          form_fields?: Json | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          meta?: Json | null
          name?: string
          organization_id?: string
          page_type?: string
          plan_ids?: string[] | null
          primary_color?: string | null
          published_at?: string | null
          required_fields?: string[] | null
          secondary_color?: string | null
          slug?: string
          subheadline?: string | null
          submissions_count?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_default_advisor_id_fkey"
            columns: ["default_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_default_plan_id_fkey"
            columns: ["default_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          advisor_id: string | null
          campaign: string | null
          created_at: string | null
          current_coverage: string | null
          custom_fields: Json | null
          desired_start_date: string | null
          email: string
          first_name: string
          household_size: number | null
          id: string
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          source: string | null
          state: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advisor_id?: string | null
          campaign?: string | null
          created_at?: string | null
          current_coverage?: string | null
          custom_fields?: Json | null
          desired_start_date?: string | null
          email: string
          first_name: string
          household_size?: number | null
          id?: string
          last_name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string | null
          campaign?: string | null
          created_at?: string | null
          current_coverage?: string | null
          custom_fields?: Json | null
          desired_start_date?: string | null
          email?: string
          first_name?: string
          household_size?: number | null
          id?: string
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          additional_info: string | null
          address_line1: string | null
          address_line2: string | null
          advisor_id: string | null
          city: string | null
          communication_preferences: Json | null
          country: string | null
          coverage_type: string | null
          created_at: string | null
          custom_fields: Json | null
          customer_profile_id: string | null
          date_of_birth: string | null
          default_payment_profile_id: string | null
          effective_date: string | null
          email: string
          existing_condition: boolean | null
          existing_condition_description: string | null
          first_name: string
          gender: string | null
          has_existing_condition: boolean | null
          household_id: string | null
          household_role: string | null
          id: string
          is_smoker: boolean | null
          last_name: string
          marital_status: string | null
          member_number: string | null
          monthly_share: number | null
          organization_id: string
          payment_profile_id: string | null
          phone: string | null
          plan_name: string | null
          plan_type: string | null
          postal_code: string | null
          preferred_language: string | null
          primary_enrollment_id: string | null
          program_type: string | null
          receive_emails: boolean | null
          receive_sms: boolean | null
          renewal_month: number | null
          ssn_last4: string | null
          state: string | null
          status: string
          termination_date: string | null
          termination_reason: string | null
          tobacco_use_date: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          address_line1?: string | null
          address_line2?: string | null
          advisor_id?: string | null
          city?: string | null
          communication_preferences?: Json | null
          country?: string | null
          coverage_type?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          customer_profile_id?: string | null
          date_of_birth?: string | null
          default_payment_profile_id?: string | null
          effective_date?: string | null
          email: string
          existing_condition?: boolean | null
          existing_condition_description?: string | null
          first_name: string
          gender?: string | null
          has_existing_condition?: boolean | null
          household_id?: string | null
          household_role?: string | null
          id?: string
          is_smoker?: boolean | null
          last_name: string
          marital_status?: string | null
          member_number?: string | null
          monthly_share?: number | null
          organization_id: string
          payment_profile_id?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_type?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          primary_enrollment_id?: string | null
          program_type?: string | null
          receive_emails?: boolean | null
          receive_sms?: boolean | null
          renewal_month?: number | null
          ssn_last4?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          termination_reason?: string | null
          tobacco_use_date?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          address_line1?: string | null
          address_line2?: string | null
          advisor_id?: string | null
          city?: string | null
          communication_preferences?: Json | null
          country?: string | null
          coverage_type?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          customer_profile_id?: string | null
          date_of_birth?: string | null
          default_payment_profile_id?: string | null
          effective_date?: string | null
          email?: string
          existing_condition?: boolean | null
          existing_condition_description?: string | null
          first_name?: string
          gender?: string | null
          has_existing_condition?: boolean | null
          household_id?: string | null
          household_role?: string | null
          id?: string
          is_smoker?: boolean | null
          last_name?: string
          marital_status?: string | null
          member_number?: string | null
          monthly_share?: number | null
          organization_id?: string
          payment_profile_id?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_type?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          primary_enrollment_id?: string | null
          program_type?: string | null
          receive_emails?: boolean | null
          receive_sms?: boolean | null
          renewal_month?: number | null
          ssn_last4?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          termination_reason?: string | null
          tobacco_use_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          advisor_id: string | null
          billing_amount: number | null
          billing_currency: string | null
          billing_frequency: string | null
          billing_status: string | null
          cancellation_reason: string | null
          created_at: string | null
          custom_fields: Json | null
          effective_date: string
          end_date: string | null
          external_vendor_membership_id: string | null
          funding_type: string | null
          id: string
          member_id: string
          membership_number: string | null
          organization_id: string
          plan_id: string
          primary_reason_for_joining: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advisor_id?: string | null
          billing_amount?: number | null
          billing_currency?: string | null
          billing_frequency?: string | null
          billing_status?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          effective_date: string
          end_date?: string | null
          external_vendor_membership_id?: string | null
          funding_type?: string | null
          id?: string
          member_id: string
          membership_number?: string | null
          organization_id: string
          plan_id: string
          primary_reason_for_joining?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string | null
          billing_amount?: number | null
          billing_currency?: string | null
          billing_frequency?: string | null
          billing_status?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          effective_date?: string
          end_date?: string | null
          external_vendor_membership_id?: string | null
          funding_type?: string | null
          id?: string
          member_id?: string
          membership_number?: string | null
          organization_id?: string
          plan_id?: string
          primary_reason_for_joining?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nacha_file_transactions: {
        Row: {
          addenda_info: string | null
          created_at: string | null
          entry_status: string | null
          id: string
          nacha_file_id: string
          return_code: string | null
          return_reason: string | null
          trace_number: string | null
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          addenda_info?: string | null
          created_at?: string | null
          entry_status?: string | null
          id?: string
          nacha_file_id: string
          return_code?: string | null
          return_reason?: string | null
          trace_number?: string | null
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          addenda_info?: string | null
          created_at?: string | null
          entry_status?: string | null
          id?: string
          nacha_file_id?: string
          return_code?: string | null
          return_reason?: string | null
          trace_number?: string | null
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nacha_file_transactions_nacha_file_id_fkey"
            columns: ["nacha_file_id"]
            isOneToOne: false
            referencedRelation: "nacha_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nacha_file_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      nacha_files: {
        Row: {
          batch_count: number | null
          company_id: string | null
          company_name: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          effective_date: string
          error_message: string | null
          failed_count: number | null
          file_content: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string | null
          id: string
          odfi_id: string | null
          organization_id: string
          processed_count: number | null
          processing_notes: Json | null
          return_count: number | null
          status: string | null
          success_count: number | null
          total_credit_amount: number | null
          total_debit_amount: number | null
          transaction_count: number | null
        }
        Insert: {
          batch_count?: number | null
          company_id?: string | null
          company_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          error_message?: string | null
          failed_count?: number | null
          file_content?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          odfi_id?: string | null
          organization_id: string
          processed_count?: number | null
          processing_notes?: Json | null
          return_count?: number | null
          status?: string | null
          success_count?: number | null
          total_credit_amount?: number | null
          total_debit_amount?: number | null
          transaction_count?: number | null
        }
        Update: {
          batch_count?: number | null
          company_id?: string | null
          company_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          error_message?: string | null
          failed_count?: number | null
          file_content?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          odfi_id?: string | null
          organization_id?: string
          processed_count?: number | null
          processing_notes?: Json | null
          return_count?: number | null
          status?: string | null
          success_count?: number | null
          total_credit_amount?: number | null
          total_debit_amount?: number | null
          transaction_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nacha_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nacha_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      need_events: {
        Row: {
          created_at: string | null
          created_by_profile_id: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          need_id: string
          new_status: string | null
          note: string | null
          occurred_at: string | null
          old_status: string | null
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_profile_id?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          need_id: string
          new_status?: string | null
          note?: string | null
          occurred_at?: string | null
          old_status?: string | null
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_profile_id?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          need_id?: string
          new_status?: string | null
          note?: string | null
          occurred_at?: string | null
          old_status?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "need_events_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_events_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      need_pricing_estimates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence_score: number | null
          created_at: string | null
          estimated_avg: number | null
          estimated_eligible_amount: number | null
          estimated_high: number | null
          estimated_low: number | null
          estimated_member_share: number | null
          facility_type: string | null
          id: string
          in_network: boolean | null
          is_approved: boolean | null
          member_state: string | null
          need_id: string
          organization_id: string
          pricing_method: string | null
          procedure_codes: string[] | null
          reasoning: Json | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_avg?: number | null
          estimated_eligible_amount?: number | null
          estimated_high?: number | null
          estimated_low?: number | null
          estimated_member_share?: number | null
          facility_type?: string | null
          id?: string
          in_network?: boolean | null
          is_approved?: boolean | null
          member_state?: string | null
          need_id: string
          organization_id: string
          pricing_method?: string | null
          procedure_codes?: string[] | null
          reasoning?: Json | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_avg?: number | null
          estimated_eligible_amount?: number | null
          estimated_high?: number | null
          estimated_low?: number | null
          estimated_member_share?: number | null
          facility_type?: string | null
          id?: string
          in_network?: boolean | null
          is_approved?: boolean | null
          member_state?: string | null
          need_id?: string
          organization_id?: string
          pricing_method?: string | null
          procedure_codes?: string[] | null
          reasoning?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "need_pricing_estimates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_pricing_estimates_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_pricing_estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      needs: {
        Row: {
          advisor_id: string | null
          amount_paid: number | null
          approved_amount: number | null
          assigned_to_profile_id: string | null
          billed_amount: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string
          eligible_amount: number | null
          facility_name: string | null
          has_member_consent: boolean | null
          id: string
          incident_date: string | null
          iua_amount: number | null
          iua_met: boolean | null
          iua_remaining: number | null
          last_status_change_at: string | null
          member_id: string
          member_responsibility_amount: number | null
          need_type: string
          organization_id: string
          payment_date: string | null
          payment_method: string | null
          payment_status: string | null
          reimbursed_amount: number | null
          reimbursement_account_last4: string | null
          reimbursement_method: string | null
          reimbursement_status: string | null
          sla_target_date: string | null
          status: string
          target_completion_date: string | null
          target_initial_review_date: string | null
          target_member_response_date: string | null
          total_amount: number | null
          updated_at: string | null
          urgency_light: string
        }
        Insert: {
          advisor_id?: string | null
          amount_paid?: number | null
          approved_amount?: number | null
          assigned_to_profile_id?: string | null
          billed_amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description: string
          eligible_amount?: number | null
          facility_name?: string | null
          has_member_consent?: boolean | null
          id?: string
          incident_date?: string | null
          iua_amount?: number | null
          iua_met?: boolean | null
          iua_remaining?: number | null
          last_status_change_at?: string | null
          member_id: string
          member_responsibility_amount?: number | null
          need_type: string
          organization_id: string
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          reimbursed_amount?: number | null
          reimbursement_account_last4?: string | null
          reimbursement_method?: string | null
          reimbursement_status?: string | null
          sla_target_date?: string | null
          status?: string
          target_completion_date?: string | null
          target_initial_review_date?: string | null
          target_member_response_date?: string | null
          total_amount?: number | null
          updated_at?: string | null
          urgency_light?: string
        }
        Update: {
          advisor_id?: string | null
          amount_paid?: number | null
          approved_amount?: number | null
          assigned_to_profile_id?: string | null
          billed_amount?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string
          eligible_amount?: number | null
          facility_name?: string | null
          has_member_consent?: boolean | null
          id?: string
          incident_date?: string | null
          iua_amount?: number | null
          iua_met?: boolean | null
          iua_remaining?: number | null
          last_status_change_at?: string | null
          member_id?: string
          member_responsibility_amount?: number | null
          need_type?: string
          organization_id?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          reimbursed_amount?: number | null
          reimbursement_account_last4?: string | null
          reimbursement_method?: string | null
          reimbursement_status?: string | null
          sla_target_date?: string | null
          status?: string
          target_completion_date?: string | null
          target_initial_review_date?: string | null
          target_member_response_date?: string | null
          total_amount?: number | null
          updated_at?: string | null
          urgency_light?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_assigned_to_profile_id_fkey"
            columns: ["assigned_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          folder: string | null
          id: string
          is_pinned: boolean | null
          metadata: Json | null
          organization_id: string | null
          record_id: string | null
          record_type: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          folder?: string | null
          id?: string
          is_pinned?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          record_id?: string | null
          record_type?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          folder?: string | null
          id?: string
          is_pinned?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          record_id?: string | null
          record_type?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          member_id: string | null
          notification_type: string
          organization_id: string
          profile_id: string | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          member_id?: string | null
          notification_type: string
          organization_id: string
          profile_id?: string | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          member_id?: string | null
          notification_type?: string
          organization_id?: string
          profile_id?: string | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          advisor_id: string | null
          attempts: number | null
          body: string
          body_html: string | null
          channel: string
          created_at: string | null
          email_address: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          member_id: string | null
          metadata: Json | null
          next_attempt_at: string | null
          notification_type: string
          organization_id: string
          priority: string | null
          profile_id: string | null
          recipient_type: string
          scheduled_for: string | null
          sent_at: string | null
          sent_email_id: string | null
          status: string | null
          subject: string | null
          template_data: Json | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          advisor_id?: string | null
          attempts?: number | null
          body: string
          body_html?: string | null
          channel: string
          created_at?: string | null
          email_address?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          member_id?: string | null
          metadata?: Json | null
          next_attempt_at?: string | null
          notification_type: string
          organization_id: string
          priority?: string | null
          profile_id?: string | null
          recipient_type: string
          scheduled_for?: string | null
          sent_at?: string | null
          sent_email_id?: string | null
          status?: string | null
          subject?: string | null
          template_data?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string | null
          attempts?: number | null
          body?: string
          body_html?: string | null
          channel?: string
          created_at?: string | null
          email_address?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          member_id?: string | null
          metadata?: Json | null
          next_attempt_at?: string | null
          notification_type?: string
          organization_id?: string
          priority?: string | null
          profile_id?: string | null
          recipient_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          sent_email_id?: string | null
          status?: string | null
          subject?: string | null
          template_data?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_sent_email_id_fkey"
            columns: ["sent_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          connection_type: string
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          org_id: string
          provider: string
          redirect_uri: string | null
          state: string
        }
        Insert: {
          code_verifier?: string | null
          connection_type?: string
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          org_id: string
          provider: string
          redirect_uri?: string | null
          state: string
        }
        Update: {
          code_verifier?: string | null
          connection_type?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          provider?: string
          redirect_uri?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string
          user_agent: string | null
          vendor_code: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id: string
          user_agent?: string | null
          vendor_code?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string
          user_agent?: string | null
          vendor_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payable_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_line_items: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          payable_id: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          payable_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          payable_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "payable_line_items_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_payments: {
        Row: {
          amount: number
          check_number: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payable_id: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
        }
        Insert: {
          amount: number
          check_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          check_number?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          check_number: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string | null
          paid_date: string | null
          payee_email: string | null
          payee_id: string | null
          payee_name: string
          payee_type: string
          payment_method: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          reference_number: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          payee_email?: string | null
          payee_id?: string | null
          payee_name: string
          payee_type: string
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          payee_email?: string | null
          payee_id?: string | null
          payee_name?: string
          payee_type?: string
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payables_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payable_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_processors: {
        Row: {
          ach_fee_fixed: number | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          credentials: Json
          daily_limit: number | null
          environment: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_tested_at: string | null
          max_transaction_amount: number | null
          min_transaction_amount: number | null
          monthly_limit: number | null
          name: string
          organization_id: string
          processing_fee_fixed: number | null
          processing_fee_percent: number | null
          processor_type: string
          supports_ach: boolean | null
          supports_apple_pay: boolean | null
          supports_credit_card: boolean | null
          supports_google_pay: boolean | null
          test_result: string | null
          updated_at: string | null
        }
        Insert: {
          ach_fee_fixed?: number | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          credentials?: Json
          daily_limit?: number | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_tested_at?: string | null
          max_transaction_amount?: number | null
          min_transaction_amount?: number | null
          monthly_limit?: number | null
          name: string
          organization_id: string
          processing_fee_fixed?: number | null
          processing_fee_percent?: number | null
          processor_type: string
          supports_ach?: boolean | null
          supports_apple_pay?: boolean | null
          supports_credit_card?: boolean | null
          supports_google_pay?: boolean | null
          test_result?: string | null
          updated_at?: string | null
        }
        Update: {
          ach_fee_fixed?: number | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          credentials?: Json
          daily_limit?: number | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_tested_at?: string | null
          max_transaction_amount?: number | null
          min_transaction_amount?: number | null
          monthly_limit?: number | null
          name?: string
          organization_id?: string
          processing_fee_fixed?: number | null
          processing_fee_percent?: number | null
          processor_type?: string
          supports_ach?: boolean | null
          supports_apple_pay?: boolean | null
          supports_credit_card?: boolean | null
          supports_google_pay?: boolean | null
          test_result?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_processors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_processors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_profiles: {
        Row: {
          account_last4: string | null
          account_type: string | null
          authorize_customer_profile_id: string
          authorize_payment_profile_id: string
          bank_name: string | null
          billing_address: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_first_name: string | null
          billing_last_name: string | null
          billing_state: string | null
          billing_zip: string | null
          card_last4: string | null
          card_type: string | null
          created_at: string | null
          customer_profile_id: string | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_four: string
          member_id: string
          nickname: string | null
          organization_id: string
          payment_profile_id: string | null
          payment_type: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_last4?: string | null
          account_type?: string | null
          authorize_customer_profile_id: string
          authorize_payment_profile_id: string
          bank_name?: string | null
          billing_address?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_first_name?: string | null
          billing_last_name?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          card_last4?: string | null
          card_type?: string | null
          created_at?: string | null
          customer_profile_id?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_four: string
          member_id: string
          nickname?: string | null
          organization_id: string
          payment_profile_id?: string | null
          payment_type: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_last4?: string | null
          account_type?: string | null
          authorize_customer_profile_id?: string
          authorize_payment_profile_id?: string
          bank_name?: string | null
          billing_address?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_first_name?: string | null
          billing_last_name?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          card_last4?: string | null
          card_type?: string | null
          created_at?: string | null
          customer_profile_id?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_four?: string
          member_id?: string
          nickname?: string | null
          organization_id?: string
          payment_profile_id?: string | null
          payment_type?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          auth_code: string | null
          avs_result_code: string | null
          billing_transaction_id: string | null
          cavv_result_code: string | null
          created_at: string | null
          cvv_result_code: string | null
          id: string
          ip_address: string | null
          member_id: string | null
          organization_id: string
          payment_profile_id: string | null
          raw_request: Json | null
          raw_response: Json | null
          ref_transaction_id: string | null
          response_code: string | null
          response_reason_code: string | null
          response_reason_text: string | null
          status: string
          transaction_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          auth_code?: string | null
          avs_result_code?: string | null
          billing_transaction_id?: string | null
          cavv_result_code?: string | null
          created_at?: string | null
          cvv_result_code?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          organization_id: string
          payment_profile_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          ref_transaction_id?: string | null
          response_code?: string | null
          response_reason_code?: string | null
          response_reason_text?: string | null
          status: string
          transaction_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          auth_code?: string | null
          avs_result_code?: string | null
          billing_transaction_id?: string | null
          cavv_result_code?: string | null
          created_at?: string | null
          cvv_result_code?: string | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          organization_id?: string
          payment_profile_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          ref_transaction_id?: string | null
          response_code?: string | null
          response_reason_code?: string | null
          response_reason_text?: string | null
          status?: string
          transaction_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_profile_id_fkey"
            columns: ["payment_profile_id"]
            isOneToOne: false
            referencedRelation: "payment_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          expected_conversion_rate: number | null
          expected_days_in_stage: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          stage_order: number
          stage_type: string
          updated_at: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          expected_conversion_rate?: number | null
          expected_days_in_stage?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          stage_order: number
          stage_type?: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          expected_conversion_rate?: number | null
          expected_days_in_stage?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          stage_order?: number
          stage_type?: string
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
      plans: {
        Row: {
          category: string | null
          code: string
          coverage_category: string | null
          created_at: string | null
          custom_fields: Json | null
          default_iua: number | null
          description: string | null
          effective_end_date: string | null
          effective_start_date: string | null
          enrollment_fee: number | null
          external_vendor_code: string | null
          hide_from_public: boolean | null
          id: string
          is_active: boolean | null
          iua_amount: number | null
          label: string | null
          max_annual_share: number | null
          metadata: Json | null
          monthly_share: number | null
          name: string
          network_type: string | null
          organization_id: string
          product_line: string | null
          provider: string | null
          rating_area_state: string | null
          require_dependent_address_match: boolean | null
          require_dependent_info: boolean | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          coverage_category?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          default_iua?: number | null
          description?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          enrollment_fee?: number | null
          external_vendor_code?: string | null
          hide_from_public?: boolean | null
          id?: string
          is_active?: boolean | null
          iua_amount?: number | null
          label?: string | null
          max_annual_share?: number | null
          metadata?: Json | null
          monthly_share?: number | null
          name: string
          network_type?: string | null
          organization_id: string
          product_line?: string | null
          provider?: string | null
          rating_area_state?: string | null
          require_dependent_address_match?: boolean | null
          require_dependent_info?: boolean | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          coverage_category?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          default_iua?: number | null
          description?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          enrollment_fee?: number | null
          external_vendor_code?: string | null
          hide_from_public?: boolean | null
          id?: string
          is_active?: boolean | null
          iua_amount?: number | null
          label?: string | null
          max_annual_share?: number | null
          metadata?: Json | null
          monthly_share?: number | null
          name?: string
          network_type?: string | null
          organization_id?: string
          product_line?: string | null
          provider?: string | null
          rating_area_state?: string | null
          require_dependent_address_match?: boolean | null
          require_dependent_info?: boolean | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_pricing: {
        Row: {
          avg_estimate: number
          category: string | null
          cpt_code: string
          created_at: string | null
          high_estimate: number
          id: string
          is_active: boolean | null
          low_estimate: number
          max_eligible_amount: number | null
          notes: string | null
          organization_id: string | null
          procedure_name: string
          region: string | null
          state: string | null
          typical_member_share_pct: number | null
          updated_at: string | null
        }
        Insert: {
          avg_estimate?: number
          category?: string | null
          cpt_code: string
          created_at?: string | null
          high_estimate?: number
          id?: string
          is_active?: boolean | null
          low_estimate?: number
          max_eligible_amount?: number | null
          notes?: string | null
          organization_id?: string | null
          procedure_name: string
          region?: string | null
          state?: string | null
          typical_member_share_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_estimate?: number
          category?: string | null
          cpt_code?: string
          created_at?: string | null
          high_estimate?: number
          id?: string
          is_active?: boolean | null
          low_estimate?: number
          max_eligible_amount?: number | null
          notes?: string | null
          organization_id?: string | null
          procedure_name?: string
          region?: string | null
          state?: string | null
          typical_member_share_pct?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_pricing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_age_brackets: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          max_age: number
          min_age: number
          organization_id: string
          plan_id: string
          product_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_age: number
          min_age: number
          organization_id: string
          plan_id: string
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_age?: number
          min_age?: number
          organization_id?: string
          plan_id?: string
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_age_brackets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_age_brackets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_age_brackets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          organization_id: string
          plan_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          organization_id: string
          plan_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          plan_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_audit_log_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_benefit_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          includes_children: boolean | null
          includes_spouse: boolean | null
          is_active: boolean | null
          label: string | null
          max_dependents: number | null
          name: string
          organization_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          includes_children?: boolean | null
          includes_spouse?: boolean | null
          is_active?: boolean | null
          label?: string | null
          max_dependents?: number | null
          name: string
          organization_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          includes_children?: boolean | null
          includes_spouse?: boolean | null
          is_active?: boolean | null
          label?: string | null
          max_dependents?: number | null
          name?: string
          organization_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_benefit_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_benefits: {
        Row: {
          benefit_name: string
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_highlighted: boolean | null
          organization_id: string
          plan_id: string
          product_id: string | null
          sort_order: number | null
        }
        Insert: {
          benefit_name: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlighted?: boolean | null
          organization_id: string
          plan_id: string
          product_id?: string | null
          sort_order?: number | null
        }
        Update: {
          benefit_name?: string
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlighted?: boolean | null
          organization_id?: string
          plan_id?: string
          product_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_benefits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_benefits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          is_required_reading: boolean | null
          is_signature_required: boolean | null
          mime_type: string | null
          name: string
          organization_id: string | null
          plan_id: string | null
          product_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          is_required_reading?: boolean | null
          is_signature_required?: boolean | null
          mime_type?: string | null
          name: string
          organization_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_required_reading?: boolean | null
          is_signature_required?: boolean | null
          mime_type?: string | null
          name?: string
          organization_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_eligibility_rules: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          error_message: string | null
          id: string
          is_active: boolean | null
          is_blocking: boolean | null
          plan_id: string
          rule_name: string
          rule_type: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          plan_id: string
          rule_name: string
          rule_type: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          is_blocking?: boolean | null
          plan_id?: string
          rule_name?: string
          rule_type?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_eligibility_rules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extra_costs: {
        Row: {
          amount: number
          apply_on: string | null
          condition: string | null
          condition_type: string | null
          condition_value: string | null
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          is_commissionable: boolean | null
          is_commissional: boolean | null
          name: string
          organization_id: string
          plan_id: string
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          apply_on?: string | null
          condition?: string | null
          condition_type?: string | null
          condition_value?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          is_commissionable?: boolean | null
          is_commissional?: boolean | null
          name: string
          organization_id: string
          plan_id: string
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          apply_on?: string | null
          condition?: string | null
          condition_type?: string | null
          condition_value?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          is_commissionable?: boolean | null
          is_commissional?: boolean | null
          name?: string
          organization_id?: string
          plan_id?: string
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extra_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_costs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feature_mappings: {
        Row: {
          created_at: string | null
          custom_description: string | null
          custom_value: string | null
          feature_id: string
          id: string
          is_included: boolean | null
          plan_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_description?: string | null
          custom_value?: string | null
          feature_id: string
          id?: string
          is_included?: boolean | null
          plan_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_description?: string | null
          custom_value?: string | null
          feature_id?: string
          id?: string
          is_included?: boolean | null
          plan_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_feature_mappings_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "product_features_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_feature_mappings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_features_library: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_highlighted: boolean | null
          is_system: boolean | null
          name: string
          organization_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlighted?: boolean | null
          is_system?: boolean | null
          name: string
          organization_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_highlighted?: boolean | null
          is_system?: boolean | null
          name?: string
          organization_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_features_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_iua: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label: string | null
          organization_id: string
          plan_id: string
          product_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          organization_id: string
          plan_id: string
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          organization_id?: string
          plan_id?: string
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_iua_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_iua_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_iua_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_matrix: {
        Row: {
          age_bracket_id: string | null
          benefit_type_id: string | null
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          household_tier: string | null
          id: string
          iua_id: string | null
          notes: string | null
          organization_id: string
          plan_id: string
          price: number
          product_id: string | null
          tobacco_surcharge: number | null
          tobacco_surcharge_percent: number | null
          updated_at: string | null
        }
        Insert: {
          age_bracket_id?: string | null
          benefit_type_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          household_tier?: string | null
          id?: string
          iua_id?: string | null
          notes?: string | null
          organization_id: string
          plan_id: string
          price: number
          product_id?: string | null
          tobacco_surcharge?: number | null
          tobacco_surcharge_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          age_bracket_id?: string | null
          benefit_type_id?: string | null
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          household_tier?: string | null
          id?: string
          iua_id?: string | null
          notes?: string | null
          organization_id?: string
          plan_id?: string
          price?: number
          product_id?: string | null
          tobacco_surcharge?: number | null
          tobacco_surcharge_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_matrix_age_bracket_id_fkey"
            columns: ["age_bracket_id"]
            isOneToOne: false
            referencedRelation: "product_age_brackets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_matrix_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "product_benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_matrix_iua_id_fkey"
            columns: ["iua_id"]
            isOneToOne: false
            referencedRelation: "product_iua"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_matrix_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_matrix_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_matrix_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brochure_url: string | null
          category: string | null
          color: string | null
          created_at: string | null
          default_iua_id: string | null
          description: string | null
          end_date: string | null
          features: Json | null
          icon: string | null
          id: string
          is_public: boolean | null
          label: string | null
          max_age: number | null
          min_age: number | null
          name: string
          organization_id: string
          provider: string | null
          require_dependent_address_match: boolean | null
          require_dependent_info: boolean | null
          sort_order: number | null
          start_date: string | null
          status: string | null
          terms_url: string | null
          updated_at: string | null
        }
        Insert: {
          brochure_url?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          default_iua_id?: string | null
          description?: string | null
          end_date?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          label?: string | null
          max_age?: number | null
          min_age?: number | null
          name: string
          organization_id: string
          provider?: string | null
          require_dependent_address_match?: boolean | null
          require_dependent_info?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          terms_url?: string | null
          updated_at?: string | null
        }
        Update: {
          brochure_url?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          default_iua_id?: string | null
          description?: string | null
          end_date?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          label?: string | null
          max_age?: number | null
          min_age?: number | null
          name?: string
          organization_id?: string
          provider?: string | null
          require_dependent_address_match?: boolean | null
          require_dependent_info?: boolean | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          terms_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          crm_role: string | null
          display_name: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          is_super_admin: boolean | null
          organization_id: string
          phone: string | null
          role: string
          time_zone: string | null
          ui_theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          crm_role?: string | null
          display_name?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          organization_id: string
          phone?: string | null
          role?: string
          time_zone?: string | null
          ui_theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          crm_role?: string | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          organization_id?: string
          phone?: string | null
          role?: string
          time_zone?: string | null
          ui_theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_uses: {
        Row: {
          discount_amount: number
          enrollment_id: string
          id: string
          member_id: string
          promo_code_id: string
          used_at: string | null
        }
        Insert: {
          discount_amount: number
          enrollment_id: string
          id?: string
          member_id: string
          promo_code_id: string
          used_at?: string | null
        }
        Update: {
          discount_amount?: number
          enrollment_id?: string
          id?: string
          member_id?: string
          promo_code_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          allowed_advisors: string[] | null
          allowed_products: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_target: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_member: number | null
          min_enrollment_amount: number | null
          organization_id: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          allowed_advisors?: string[] | null
          allowed_products?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_target?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_member?: number | null
          min_enrollment_amount?: number | null
          organization_id: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          allowed_advisors?: string[] | null
          allowed_products?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_target?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_member?: number | null
          min_enrollment_amount?: number | null
          organization_id?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_page_visits: {
        Row: {
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          organization_id: string
          page_icon: string | null
          page_path: string
          page_title: string | null
          profile_id: string
          visited_at: string
        }
        Insert: {
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          page_icon?: string | null
          page_path: string
          page_title?: string | null
          profile_id: string
          visited_at?: string
        }
        Update: {
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          page_icon?: string | null
          page_path?: string
          page_title?: string | null
          profile_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_page_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_page_visits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_alerts: {
        Row: {
          condition_config: Json
          condition_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_enabled: boolean | null
          last_triggered_at: string | null
          name: string
          org_id: string
          recipients: string[] | null
          report_id: string | null
          updated_at: string | null
        }
        Insert: {
          condition_config: Json
          condition_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name: string
          org_id: string
          recipients?: string[] | null
          report_id?: string | null
          updated_at?: string | null
        }
        Update: {
          condition_config?: Json
          condition_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name?: string
          org_id?: string
          recipients?: string[] | null
          report_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_alerts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_run_history: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          executed_at: string
          executed_by: string | null
          export_format: string | null
          filters_used: Json | null
          id: string
          organization_id: string
          report_id: string
          row_count: number | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          export_format?: string | null
          filters_used?: Json | null
          id?: string
          organization_id: string
          report_id: string
          row_count?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          export_format?: string | null
          filters_used?: Json | null
          id?: string
          organization_id?: string
          report_id?: string
          row_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_run_history_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_run_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_run_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          cron_expression: string
          export_format: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          recipients: Json | null
          report_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cron_expression: string
          export_format?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          recipients?: Json | null
          report_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cron_expression?: string
          export_format?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          recipients?: Json | null
          report_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_segments: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          entity_type: string
          filter_snapshot: Json | null
          id: string
          is_dynamic: boolean | null
          last_refreshed_at: string | null
          name: string
          org_id: string
          record_count: number | null
          report_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type: string
          filter_snapshot?: Json | null
          id?: string
          is_dynamic?: boolean | null
          last_refreshed_at?: string | null
          name: string
          org_id: string
          record_count?: number | null
          report_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_type?: string
          filter_snapshot?: Json | null
          id?: string
          is_dynamic?: boolean | null
          last_refreshed_at?: string | null
          name?: string
          org_id?: string
          record_count?: number | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_segments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          context: string
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          organization_id: string
          owner_profile_id: string
          updated_at: string
        }
        Insert: {
          context: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          owner_profile_id: string
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          owner_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_appointments: {
        Row: {
          attendee_email: string
          attendee_name: string
          attendee_notes: string | null
          attendee_phone: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_id: string | null
          created_at: string
          end_time: string
          id: string
          lead_id: string | null
          location: string | null
          meeting_type: string
          meeting_url: string | null
          org_id: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          scheduling_link_id: string
          start_time: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          attendee_email: string
          attendee_name: string
          attendee_notes?: string | null
          attendee_phone?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_type: string
          meeting_url?: string | null
          org_id: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          scheduling_link_id: string
          start_time: string
          status?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          attendee_email?: string
          attendee_name?: string
          attendee_notes?: string | null
          attendee_phone?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_type?: string
          meeting_url?: string | null
          org_id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          scheduling_link_id?: string
          start_time?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_appointments_scheduling_link_id_fkey"
            columns: ["scheduling_link_id"]
            isOneToOne: false
            referencedRelation: "scheduling_links"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_links: {
        Row: {
          availability: Json
          buffer_minutes: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          location: string | null
          max_days_in_advance: number
          meeting_type: string
          min_notice_hours: number
          name: string
          org_id: string
          owner_id: string
          slug: string
          timezone: string
          updated_at: string
          video_provider: string | null
        }
        Insert: {
          availability?: Json
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          location?: string | null
          max_days_in_advance?: number
          meeting_type?: string
          min_notice_hours?: number
          name: string
          org_id: string
          owner_id: string
          slug: string
          timezone?: string
          updated_at?: string
          video_provider?: string | null
        }
        Update: {
          availability?: Json
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          location?: string | null
          max_days_in_advance?: number
          meeting_type?: string
          min_notice_hours?: number
          name?: string
          org_id?: string
          owner_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
          video_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          advisor_id: string | null
          bcc_emails: string[] | null
          billing_id: string | null
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          cc_emails: string[] | null
          click_count: number | null
          clicked_at: string | null
          complained_at: string | null
          context: Json | null
          created_at: string | null
          delivered_at: string | null
          email_type: string | null
          enrollment_id: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          from_email: string
          from_name: string | null
          id: string
          max_retries: number | null
          member_id: string | null
          metadata: Json | null
          next_retry_at: string | null
          open_count: number | null
          opened_at: string | null
          organization_id: string
          provider_message_id: string | null
          provider_response: Json | null
          recipient_email: string
          recipient_id: string | null
          recipient_name: string | null
          recipient_type: string | null
          reply_to: string | null
          resend_id: string | null
          resend_response: Json | null
          retry_count: number | null
          sent_at: string | null
          status: string
          status_reason: string | null
          subject: string
          template_id: string | null
          triggered_by: string | null
          triggered_by_profile_id: string | null
        }
        Insert: {
          advisor_id?: string | null
          bcc_emails?: string[] | null
          billing_id?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          cc_emails?: string[] | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          context?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          email_type?: string | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          max_retries?: number | null
          member_id?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          organization_id: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string | null
          reply_to?: string | null
          resend_id?: string | null
          resend_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          status_reason?: string | null
          subject: string
          template_id?: string | null
          triggered_by?: string | null
          triggered_by_profile_id?: string | null
        }
        Update: {
          advisor_id?: string | null
          bcc_emails?: string[] | null
          billing_id?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          cc_emails?: string[] | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          context?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          email_type?: string | null
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          max_retries?: number | null
          member_id?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          organization_id?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient_email?: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string | null
          reply_to?: string | null
          resend_id?: string | null
          resend_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          status_reason?: string | null
          subject?: string
          template_id?: string | null
          triggered_by?: string | null
          triggered_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_triggered_by_profile_id_fkey"
            columns: ["triggered_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_sessions: {
        Row: {
          active_organization_id: string | null
          created_at: string | null
          id: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string | null
          id?: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string | null
          id?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_sessions_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_admin_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          allowed_values: Json | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          is_sensitive: boolean | null
          label: string
          last_changed_at: string | null
          last_changed_by: string | null
          organization_id: string
          placeholder: string | null
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          subcategory: string | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          allowed_values?: Json | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          is_sensitive?: boolean | null
          label: string
          last_changed_at?: string | null
          last_changed_by?: string | null
          organization_id: string
          placeholder?: string | null
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          subcategory?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          allowed_values?: Json | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          is_sensitive?: boolean | null
          label?: string
          last_changed_at?: string | null
          last_changed_by?: string | null
          organization_id?: string
          placeholder?: string | null
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          subcategory?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          organization_id: string
          priority: string
          record_id: string | null
          record_type: string | null
          reminder_at: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          priority?: string
          record_id?: string | null
          record_type?: string | null
          reminder_at?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          priority?: string
          record_id?: string | null
          record_type?: string | null
          reminder_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          body: string
          created_at: string | null
          created_by_profile_id: string
          id: string
          is_internal: boolean | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by_profile_id: string
          id?: string
          is_internal?: boolean | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by_profile_id?: string
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          advisor_id: string | null
          agency_name: string | null
          assigned_to_profile_id: string | null
          category: string
          created_at: string | null
          created_by_profile_id: string
          description: string
          id: string
          member_id: string | null
          organization_id: string
          priority: string
          sla_target_at: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          advisor_id?: string | null
          agency_name?: string | null
          assigned_to_profile_id?: string | null
          category?: string
          created_at?: string | null
          created_by_profile_id: string
          description: string
          id?: string
          member_id?: string | null
          organization_id: string
          priority?: string
          sla_target_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string | null
          agency_name?: string | null
          assigned_to_profile_id?: string | null
          category?: string
          created_at?: string | null
          created_by_profile_id?: string
          description?: string
          id?: string
          member_id?: string | null
          organization_id?: string
          priority?: string
          sla_target_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "advisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_profile_id_fkey"
            columns: ["assigned_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_domain_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          domain_id: string
          id: string
          is_primary: boolean | null
          org_id: string
          profile_id: string
          sender_addresses: string[] | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          domain_id: string
          id?: string
          is_primary?: boolean | null
          org_id: string
          profile_id: string
          sender_addresses?: string[] | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          domain_id?: string
          id?: string
          is_primary?: boolean | null
          org_id?: string
          profile_id?: string
          sender_addresses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_domain_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_domain_assignments_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_domain_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_domain_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_settings: {
        Row: {
          allowed_domain_ids: string[] | null
          created_at: string | null
          daily_send_limit: number | null
          default_bcc: string[] | null
          default_cc: string[] | null
          default_reply_to: string | null
          default_sender_address_id: string | null
          default_signature_id: string | null
          emails_sent_today: number | null
          id: string
          last_send_reset_at: string | null
          org_id: string
          preferred_send_time: string | null
          profile_id: string
          timezone: string | null
          track_clicks: boolean | null
          track_opens: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_domain_ids?: string[] | null
          created_at?: string | null
          daily_send_limit?: number | null
          default_bcc?: string[] | null
          default_cc?: string[] | null
          default_reply_to?: string | null
          default_sender_address_id?: string | null
          default_signature_id?: string | null
          emails_sent_today?: number | null
          id?: string
          last_send_reset_at?: string | null
          org_id: string
          preferred_send_time?: string | null
          profile_id: string
          timezone?: string | null
          track_clicks?: boolean | null
          track_opens?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_domain_ids?: string[] | null
          created_at?: string | null
          daily_send_limit?: number | null
          default_bcc?: string[] | null
          default_cc?: string[] | null
          default_reply_to?: string | null
          default_sender_address_id?: string | null
          default_signature_id?: string | null
          emails_sent_today?: number | null
          id?: string
          last_send_reset_at?: string | null
          org_id?: string
          preferred_send_time?: string | null
          profile_id?: string
          timezone?: string | null
          track_clicks?: boolean | null
          track_opens?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_email_settings_default_sender_address_id_fkey"
            columns: ["default_sender_address_id"]
            isOneToOne: false
            referencedRelation: "email_sender_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_settings_default_signature_id_fkey"
            columns: ["default_signature_id"]
            isOneToOne: false
            referencedRelation: "email_signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_changes: {
        Row: {
          applied_at: string | null
          change_data: Json | null
          change_type: string
          created_at: string | null
          detected_at: string | null
          entity_id: string | null
          entity_type: string
          external_id: string | null
          field_changed: string | null
          file_id: string | null
          file_row_id: string | null
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          applied_at?: string | null
          change_data?: Json | null
          change_type: string
          created_at?: string | null
          detected_at?: string | null
          entity_id?: string | null
          entity_type: string
          external_id?: string | null
          field_changed?: string | null
          file_id?: string | null
          file_row_id?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          applied_at?: string | null
          change_data?: Json | null
          change_type?: string
          created_at?: string | null
          detected_at?: string | null
          entity_id?: string | null
          entity_type?: string
          external_id?: string | null
          field_changed?: string | null
          file_id?: string | null
          file_row_id?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_changes_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "vendor_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_changes_file_row_id_fkey"
            columns: ["file_row_id"]
            isOneToOne: false
            referencedRelation: "vendor_file_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_changes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_changes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_changes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_connectors: {
        Row: {
          column_mapping: Json | null
          config: Json | null
          connector_type: string
          created_at: string | null
          created_by: string | null
          error_action: string | null
          error_threshold: number | null
          failed_runs: number | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          notification_emails: string[] | null
          org_id: string
          schedule_cron: string | null
          schedule_type: string | null
          successful_runs: number | null
          total_runs: number | null
          transformations: Json | null
          updated_at: string | null
          updated_by: string | null
          validation_rules: Json | null
          vendor_id: string
        }
        Insert: {
          column_mapping?: Json | null
          config?: Json | null
          connector_type: string
          created_at?: string | null
          created_by?: string | null
          error_action?: string | null
          error_threshold?: number | null
          failed_runs?: number | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          notification_emails?: string[] | null
          org_id: string
          schedule_cron?: string | null
          schedule_type?: string | null
          successful_runs?: number | null
          total_runs?: number | null
          transformations?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
          vendor_id: string
        }
        Update: {
          column_mapping?: Json | null
          config?: Json | null
          connector_type?: string
          created_at?: string | null
          created_by?: string | null
          error_action?: string | null
          error_threshold?: number | null
          failed_runs?: number | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          notification_emails?: string[] | null
          org_id?: string
          schedule_cron?: string | null
          schedule_type?: string | null
          successful_runs?: number | null
          total_runs?: number | null
          transformations?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_connectors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connectors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connectors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connectors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_costs: {
        Row: {
          age_bracket_id: string | null
          benefit_type_id: string | null
          cost: number
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          id: string
          iua_id: string | null
          organization_id: string | null
          plan_id: string | null
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          age_bracket_id?: string | null
          benefit_type_id?: string | null
          cost: number
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          iua_id?: string | null
          organization_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          age_bracket_id?: string | null
          benefit_type_id?: string | null
          cost?: number
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          id?: string
          iua_id?: string | null
          organization_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_type: string
          credentials_encrypted: Json
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          last_verified_at: string | null
          name: string
          organization_id: string
          updated_at: string
          vendor_code: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_type: string
          credentials_encrypted?: Json
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          last_verified_at?: string | null
          name: string
          organization_id: string
          updated_at?: string
          vendor_code: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_type?: string
          credentials_encrypted?: Json
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          last_verified_at?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
          vendor_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_eligibility_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          job_run_id: string | null
          members_checked: number | null
          members_eligible: number | null
          members_error: number | null
          members_ineligible: number | null
          members_pending: number | null
          organization_id: string
          request_payload: Json | null
          response_payload: Json | null
          retried_from_id: string | null
          retry_count: number | null
          run_type: string
          started_at: string | null
          status: string
          trigger_type: string
          triggered_by: string | null
          vendor_code: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_run_id?: string | null
          members_checked?: number | null
          members_eligible?: number | null
          members_error?: number | null
          members_ineligible?: number | null
          members_pending?: number | null
          organization_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          retried_from_id?: string | null
          retry_count?: number | null
          run_type: string
          started_at?: string | null
          status?: string
          trigger_type?: string
          triggered_by?: string | null
          vendor_code: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          job_run_id?: string | null
          members_checked?: number | null
          members_eligible?: number | null
          members_error?: number | null
          members_ineligible?: number | null
          members_pending?: number | null
          organization_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          retried_from_id?: string | null
          retry_count?: number | null
          run_type?: string
          started_at?: string | null
          status?: string
          trigger_type?: string
          triggered_by?: string | null
          vendor_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_eligibility_runs_job_run_id_fkey"
            columns: ["job_run_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_eligibility_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_eligibility_runs_retried_from_id_fkey"
            columns: ["retried_from_id"]
            isOneToOne: false
            referencedRelation: "vendor_eligibility_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_eligibility_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_file_rows: {
        Row: {
          action_taken: string | null
          created_at: string | null
          error_message: string | null
          file_id: string
          id: string
          match_confidence: number | null
          match_method: string | null
          matched_entity_id: string | null
          matched_entity_type: string | null
          normalized_data: Json | null
          org_id: string
          processed_at: string | null
          raw_data: Json
          row_index: number
          status: string
          validation_errors: Json | null
          validation_warnings: Json | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          error_message?: string | null
          file_id: string
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          normalized_data?: Json | null
          org_id: string
          processed_at?: string | null
          raw_data: Json
          row_index: number
          status?: string
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          error_message?: string | null
          file_id?: string
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          normalized_data?: Json | null
          org_id?: string
          processed_at?: string | null
          raw_data?: Json
          row_index?: number
          status?: string
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_file_rows_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "vendor_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_file_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_files: {
        Row: {
          completed_at: string | null
          created_at: string | null
          detect_changes: boolean | null
          duplicate_strategy: string | null
          error_details: Json | null
          error_message: string | null
          error_rows: number | null
          file_format: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          new_records: number | null
          org_id: string
          processed_rows: number | null
          started_at: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          total_rows: number | null
          unchanged_records: number | null
          updated_at: string | null
          updated_records: number | null
          upload_source: string
          uploaded_by: string | null
          valid_rows: number | null
          validation_errors: Json | null
          validation_warnings: Json | null
          vendor_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          detect_changes?: boolean | null
          duplicate_strategy?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_rows?: number | null
          file_format?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          id?: string
          new_records?: number | null
          org_id: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          total_rows?: number | null
          unchanged_records?: number | null
          updated_at?: string | null
          updated_records?: number | null
          upload_source?: string
          uploaded_by?: string | null
          valid_rows?: number | null
          validation_errors?: Json | null
          validation_warnings?: Json | null
          vendor_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          detect_changes?: boolean | null
          duplicate_strategy?: string | null
          error_details?: Json | null
          error_message?: string | null
          error_rows?: number | null
          file_format?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          new_records?: number | null
          org_id?: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          total_rows?: number | null
          unchanged_records?: number | null
          updated_at?: string | null
          updated_records?: number | null
          upload_source?: string
          uploaded_by?: string | null
          valid_rows?: number | null
          validation_errors?: Json | null
          validation_warnings?: Json | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_files_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_job_configs: {
        Row: {
          alert_on_failure: boolean
          alert_recipients: Json | null
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          job_type: string
          last_failure_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          name: string
          organization_id: string
          retry_delay_seconds: number | null
          retry_enabled: boolean
          retry_max_attempts: number | null
          schedule_cron: string | null
          schedule_enabled: boolean
          schedule_timezone: string | null
          total_failures: number | null
          total_runs: number | null
          total_successes: number | null
          updated_at: string
          vendor_code: string
        }
        Insert: {
          alert_on_failure?: boolean
          alert_recipients?: Json | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          job_type: string
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name: string
          organization_id: string
          retry_delay_seconds?: number | null
          retry_enabled?: boolean
          retry_max_attempts?: number | null
          schedule_cron?: string | null
          schedule_enabled?: boolean
          schedule_timezone?: string | null
          total_failures?: number | null
          total_runs?: number | null
          total_successes?: number | null
          updated_at?: string
          vendor_code: string
        }
        Update: {
          alert_on_failure?: boolean
          alert_recipients?: Json | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          job_type?: string
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name?: string
          organization_id?: string
          retry_delay_seconds?: number | null
          retry_enabled?: boolean
          retry_max_attempts?: number | null
          schedule_cron?: string | null
          schedule_enabled?: boolean
          schedule_timezone?: string | null
          total_failures?: number | null
          total_runs?: number | null
          total_successes?: number | null
          updated_at?: string
          vendor_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_job_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_job_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          api_endpoint: string | null
          api_key_enc: string | null
          code: string
          column_mapping: Json | null
          connection_type: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          date_format: string | null
          default_file_format: string | null
          description: string | null
          file_delimiter: string | null
          has_header_row: boolean | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          logo_url: string | null
          name: string
          org_id: string
          settings: Json | null
          sftp_host: string | null
          sftp_password_enc: string | null
          sftp_path: string | null
          sftp_username: string | null
          status: string
          sync_enabled: boolean | null
          sync_schedule: string | null
          updated_at: string | null
          updated_by: string | null
          vendor_type: string
          website_url: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_enc?: string | null
          code: string
          column_mapping?: Json | null
          connection_type?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          default_file_format?: string | null
          description?: string | null
          file_delimiter?: string | null
          has_header_row?: boolean | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          logo_url?: string | null
          name: string
          org_id: string
          settings?: Json | null
          sftp_host?: string | null
          sftp_password_enc?: string | null
          sftp_path?: string | null
          sftp_username?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_schedule?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_type?: string
          website_url?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_enc?: string | null
          code?: string
          column_mapping?: Json | null
          connection_type?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          default_file_format?: string | null
          description?: string | null
          file_delimiter?: string | null
          has_header_row?: boolean | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          logo_url?: string | null
          name?: string
          org_id?: string
          settings?: Json | null
          sftp_host?: string | null
          sftp_password_enc?: string | null
          sftp_path?: string | null
          sftp_username?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_schedule?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_type?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempt_number: number | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          request_headers: Json | null
          response_body: string | null
          response_headers: Json | null
          started_at: string | null
          status: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          started_at?: string | null
          status?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          started_at?: string | null
          status?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          auth_type: string | null
          auth_value: string | null
          created_at: string | null
          created_by: string | null
          custom_headers: Json | null
          description: string | null
          events: string[]
          failed_calls: number | null
          id: string
          is_active: boolean | null
          last_called_at: string | null
          last_status_code: number | null
          name: string
          organization_id: string
          retry_count: number | null
          successful_calls: number | null
          timeout_seconds: number | null
          total_calls: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          auth_type?: string | null
          auth_value?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_headers?: Json | null
          description?: string | null
          events: string[]
          failed_calls?: number | null
          id?: string
          is_active?: boolean | null
          last_called_at?: string | null
          last_status_code?: number | null
          name: string
          organization_id: string
          retry_count?: number | null
          successful_calls?: number | null
          timeout_seconds?: number | null
          total_calls?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          auth_type?: string | null
          auth_value?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_headers?: Json | null
          description?: string | null
          events?: string[]
          failed_calls?: number | null
          id?: string
          is_active?: boolean | null
          last_called_at?: string | null
          last_status_code?: number | null
          name?: string
          organization_id?: string
          retry_count?: number | null
          successful_calls?: number | null
          timeout_seconds?: number | null
          total_calls?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      change_feed_view: {
        Row: {
          actor_avatar_url: string | null
          actor_full_name: string | null
          actor_id: string | null
          actor_name: string | null
          actor_type: string | null
          change_type: string | null
          content_hash: string | null
          created_at: string | null
          description: string | null
          detected_at: string | null
          diff: Json | null
          entity_id: string | null
          entity_title: string | null
          entity_type: string | null
          id: string | null
          org_id: string | null
          payload: Json | null
          previous_hash: string | null
          reconciliation_status: string | null
          requires_review: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_full_name: string | null
          severity: string | null
          source_id: string | null
          source_name: string | null
          source_type: string | null
          sync_status: string | null
          synced_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _parse_import_boolean: { Args: { bool_str: string }; Returns: boolean }
      _parse_import_date: { Args: { date_str: string }; Returns: string }
      _parse_import_datetime: { Args: { dt_str: string }; Returns: string }
      _parse_import_number: { Args: { num_str: string }; Returns: number }
      accept_team_invitation: {
        Args: { p_full_name: string; p_token: string }
        Returns: string
      }
      calculate_enrollment_commission: {
        Args: { p_commission_type?: string; p_enrollment_id: string }
        Returns: number
      }
      calculate_next_billing_date: {
        Args: {
          p_billing_day: number
          p_current_date: string
          p_frequency: string
        }
        Returns: string
      }
      calculate_next_retry_time: {
        Args: { attempt_number: number }
        Returns: string
      }
      can_access_organization: { Args: { p_org_id: string }; Returns: boolean }
      can_user_send_email: { Args: { p_profile_id: string }; Returns: boolean }
      check_approval_required: {
        Args: {
          p_module_id: string
          p_org_id: string
          p_record_data: Json
          p_trigger_context?: Json
          p_trigger_type: string
        }
        Returns: {
          process_id: string
          rule_id: string
          rule_name: string
        }[]
      }
      check_product_eligibility: {
        Args: {
          p_household_size?: number
          p_member_age: number
          p_member_state?: string
          p_plan_id: string
        }
        Returns: {
          failed_rules: Json
          is_eligible: boolean
        }[]
      }
      claim_scheduler_job: { Args: { p_job_id: string }; Returns: boolean }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      complete_scheduler_job: {
        Args: {
          p_error?: string
          p_job_id: string
          p_result?: Json
          p_status: string
        }
        Returns: undefined
      }
      convert_lead_to_member: {
        Args: { p_lead_record_id: string; p_user_id: string }
        Returns: Json
      }
      create_team_invitation: {
        Args: {
          p_email: string
          p_expires_in_days?: number
          p_org_id: string
          p_role?: string
        }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      deactivate_team_member: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      generate_invitation_token: { Args: never; Returns: string }
      generate_record_title: { Args: { p_data: Json }; Returns: string }
      generate_webhook_secret: { Args: never; Returns: string }
      get_advisor_downline_count: {
        Args: { p_advisor_id: string }
        Returns: number
      }
      get_advisor_upline: {
        Args: { p_advisor_id: string; p_max_levels?: number }
        Returns: {
          advisor_id: string
          level: number
        }[]
      }
      get_age_up_out_summary: {
        Args: { p_days_ahead?: number; p_org_id: string }
        Returns: {
          count: number
          earliest_event_date: string
          event_type: string
          latest_event_date: string
          status: string
        }[]
      }
      get_approval_detail: {
        Args: { p_approval_id: string }
        Returns: {
          action_payload: Json
          applied_at: string
          context: Json
          created_at: string
          current_step: number
          entity_snapshot: Json
          expires_at: string
          id: string
          module_id: string
          module_key: string
          module_name: string
          org_id: string
          process_description: string
          process_id: string
          process_name: string
          process_steps: Json
          record_data: Json
          record_id: string
          record_title: string
          requested_by: string
          requested_by_name: string
          resolved_at: string
          resolved_by: string
          resolved_by_name: string
          status: string
          updated_at: string
        }[]
      }
      get_approval_inbox: {
        Args: {
          p_assigned_to_me?: boolean
          p_entity_type?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_profile_id: string
          p_requested_by_me?: boolean
          p_status?: string
          p_user_role: string
        }
        Returns: {
          context: Json
          created_at: string
          current_step: number
          id: string
          module_key: string
          module_name: string
          process_id: string
          process_name: string
          record_id: string
          record_title: string
          requested_by: string
          requested_by_name: string
          status: string
          total_steps: number
          updated_at: string
        }[]
      }
      get_approval_rules_for_module: {
        Args: { p_module_id: string; p_trigger_type?: string }
        Returns: {
          conditions: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          process_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_approval_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_billing_summary: {
        Args: { p_end_date: string; p_org_id: string; p_start_date: string }
        Returns: {
          avg_transaction: number
          by_payment_method: Json
          failed_count: number
          refund_count: number
          success_count: number
          total_collected: number
          total_declined: number
          total_refunded: number
          transaction_count: number
        }[]
      }
      get_busy_slots: {
        Args: { p_end: string; p_owner_id: string; p_start: string }
        Returns: {
          busy_end: string
          busy_start: string
        }[]
      }
      get_calendar_events_range: {
        Args: { p_end: string; p_owner_id: string; p_start: string }
        Returns: {
          attendees: Json | null
          connection_id: string
          created_at: string
          description: string | null
          end_time: string
          etag: string | null
          external_calendar_id: string
          external_id: string
          id: string
          is_all_day: boolean
          is_recurring: boolean
          last_synced_at: string
          linked_contact_id: string | null
          linked_deal_id: string | null
          linked_task_id: string | null
          location: string | null
          meeting_provider: string | null
          meeting_url: string | null
          org_id: string
          organizer_email: string | null
          organizer_name: string | null
          owner_id: string
          provider: string
          raw_data: Json | null
          recurrence_rule: string | null
          recurring_event_id: string | null
          start_time: string
          status: string
          timezone: string | null
          title: string
          updated_at: string
          visibility: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_campaign_stats: { Args: { p_campaign_id: string }; Returns: Json }
      get_change_feed_stats: { Args: { p_org_id: string }; Returns: Json }
      get_commission_summary: {
        Args: {
          p_organization_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          avg_commission: number
          count_bonuses: number
          count_transactions: number
          total_bonuses: number
          total_earned: number
          total_paid: number
          total_pending: number
        }[]
      }
      get_deal_stages: {
        Args: { p_org_id: string }
        Returns: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_lost: boolean | null
          is_won: boolean | null
          key: string
          name: string
          org_id: string
          probability: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_deal_stages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_declined_today: {
        Args: { p_org_id: string }
        Returns: {
          amount: number
          created_at: string
          decline_category: string
          decline_code: string
          error_message: string
          id: string
          last_four: string
          member_email: string
          member_id: string
          member_name: string
          payment_method: string
          retry_count: number
        }[]
      }
      get_default_processor: { Args: { p_org_id: string }; Returns: string }
      get_entity_columns: { Args: { p_entity_type: string }; Returns: Json }
      get_integration_health_summary: {
        Args: { p_org_id: string }
        Returns: {
          connected_count: number
          error_count: number
          last_sync_at: string
          pending_count: number
          recent_errors: number
          total_connections: number
        }[]
      }
      get_invoice_generation_summary: {
        Args: { p_organization_id: string }
        Returns: {
          last_generation_date: string
          retro_amount: number
          retro_count: number
          total_amount: number
          total_generated: number
        }[]
      }
      get_linked_records: {
        Args: { p_record_id: string }
        Returns: {
          created_at: string
          direction: string
          is_primary: boolean
          link_id: string
          link_type: string
          record_id: string
          record_module_key: string
          record_module_name: string
          record_title: string
        }[]
      }
      get_member_default_payment_profile: {
        Args: { p_member_id: string }
        Returns: string
      }
      get_module_blueprint: {
        Args: { p_module_id: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          stages: Json
          transitions: Json
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_blueprints"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_next_round_robin_agent: {
        Args: { p_rule_id: string }
        Returns: string
      }
      get_org_by_slug: { Args: { p_slug: string }; Returns: string }
      get_payables_summary: {
        Args: {
          p_end_date?: string
          p_organization_id: string
          p_start_date?: string
        }
        Returns: {
          count_approved: number
          count_overdue: number
          count_paid: number
          count_pending: number
          total_approved: number
          total_overdue: number
          total_paid: number
          total_pending: number
        }[]
      }
      get_pending_approvals_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_pending_scheduler_jobs: {
        Args: { p_job_types?: string[]; p_limit?: number }
        Returns: {
          attempts: number
          entity_id: string
          entity_type: string
          id: string
          job_type: string
          max_attempts: number
          org_id: string
          payload: Json
          record_id: string
          run_at: string
        }[]
      }
      get_product_features: {
        Args: { p_plan_id: string }
        Returns: {
          category: string
          custom_description: string
          custom_value: string
          description: string
          feature_id: string
          icon: string
          is_highlighted: boolean
          is_included: boolean
          name: string
          sort_order: number
        }[]
      }
      get_product_price: {
        Args: {
          p_age: number
          p_benefit_type_id: string
          p_is_tobacco_user?: boolean
          p_iua_id: string
          p_product_id: string
        }
        Returns: number
      }
      get_record_stage_history: {
        Args: { p_record_id: string }
        Returns: {
          changed_by: string
          changed_by_name: string
          created_at: string
          duration_seconds: number
          from_stage: string
          id: string
          reason: string
          to_stage: string
        }[]
      }
      get_stage_validation_rules: {
        Args: { p_from_stage: string; p_module_id: string; p_to_stage: string }
        Returns: {
          applies_on: string[]
          conditions: Json
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          error_message: string
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          rule_type: string
          stage_triggers: Json | null
          target_field: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_validation_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_super_admin_active_org: { Args: never; Returns: string }
      get_team_members: {
        Args: { p_org_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_advisor_id: { Args: never; Returns: string }
      get_user_crm_role: { Args: { p_org_id: string }; Returns: string }
      get_user_default_signature: {
        Args: { p_profile_id: string }
        Returns: {
          content_html: string
          content_text: string
          id: string
          name: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_profile_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      get_user_sender_addresses: {
        Args: { p_profile_id: string }
        Returns: {
          domain: string
          email: string
          id: string
          is_default: boolean
          name: string
        }[]
      }
      get_validation_rules_for_module: {
        Args: { p_module_id: string; p_trigger?: string }
        Returns: {
          applies_on: string[]
          conditions: Json
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          error_message: string
          id: string
          is_enabled: boolean | null
          module_id: string
          name: string
          org_id: string
          priority: number | null
          rule_type: string
          stage_triggers: Json | null
          target_field: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_validation_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_vendor_cost: {
        Args: {
          p_age_bracket_id: string
          p_benefit_type_id: string
          p_iua_id: string
          p_product_id: string
        }
        Returns: number
      }
      get_vendor_eligibility_summary: {
        Args: { p_org_id: string; p_vendor_code?: string }
        Returns: {
          avg_duration_ms: number
          failed_runs: number
          last_run_at: string
          last_success_at: string
          successful_runs: number
          total_eligible: number
          total_ineligible: number
          total_members_checked: number
          total_runs: number
          vendor_code: string
        }[]
      }
      get_vendor_stats: {
        Args: { p_org_id: string }
        Returns: {
          active_vendors: number
          changes_last_7_days: number
          files_in_progress: number
          total_vendors: number
        }[]
      }
      has_crm_governance_role: {
        Args: { p_role_keys: string[] }
        Returns: boolean
      }
      has_crm_role: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      has_pending_approval: { Args: { p_record_id: string }; Returns: boolean }
      has_permission: { Args: { p_permission_key: string }; Returns: boolean }
      import_contacts_from_staging: {
        Args: never
        Returns: {
          errors: number
          imported: number
          skipped: number
        }[]
      }
      increment_report_run_count: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      increment_user_email_count: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      increment_webform_submit_count: {
        Args: { p_webform_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_crm_member: { Args: { p_org_id: string }; Returns: boolean }
      is_email_unsubscribed: {
        Args: { p_email: string; p_org_id: string }
        Returns: boolean
      }
      is_staff_or_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_admin_activity: {
        Args: {
          p_action: string
          p_description?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: string
      }
      log_integration_event: {
        Args: {
          p_connection_id: string
          p_direction?: string
          p_event_type: string
          p_metadata?: Json
          p_org_id: string
          p_provider: string
          p_status?: string
        }
        Returns: string
      }
      log_ops_audit: {
        Args: {
          p_changes?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_metadata?: Json
          p_org_id: string
          p_vendor_code?: string
        }
        Returns: string
      }
      log_report_run: {
        Args: {
          p_duration_ms: number
          p_error_message?: string
          p_export_format?: string
          p_filters_used?: Json
          p_org_id: string
          p_report_id: string
          p_row_count: number
          p_status?: string
          p_user_id: string
        }
        Returns: string
      }
      log_validation_run: {
        Args: {
          p_context?: Json
          p_errors?: Json
          p_field_value?: Json
          p_org_id: string
          p_record_id: string
          p_result: string
          p_rule_id: string
          p_trigger: string
        }
        Returns: string
      }
      log_vendor_change: {
        Args: {
          p_change_type: string
          p_entity_id: string
          p_entity_type: string
          p_field_changed: string
          p_file_id: string
          p_new_value: string
          p_old_value: string
          p_org_id: string
          p_severity?: string
          p_vendor_id: string
        }
        Returns: string
      }
      preview_round_robin_assignments: {
        Args: { p_count?: number; p_rule_id: string }
        Returns: {
          advisor_id: string
          assignment_position: number
        }[]
      }
      reactivate_team_member: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      record_change_event: {
        Args: {
          p_actor_id?: string
          p_actor_type?: string
          p_change_type: string
          p_description?: string
          p_diff?: Json
          p_entity_id: string
          p_entity_title: string
          p_entity_type: string
          p_org_id: string
          p_payload?: Json
          p_requires_review?: boolean
          p_severity?: string
          p_source_name: string
          p_source_type: string
          p_title: string
        }
        Returns: string
      }
      record_tracking_event: {
        Args: {
          p_clicked_url?: string
          p_event_type: string
          p_ip_address?: string
          p_tracking_id: string
          p_user_agent?: string
        }
        Returns: Json
      }
      reset_daily_email_counts: { Args: never; Returns: undefined }
      revoke_team_invitation: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
      seed_default_deal_stages: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      seed_default_email_templates: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      seed_default_settings: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      seed_member_stages: { Args: { p_org_id: string }; Returns: undefined }
      set_super_admin_active_org: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      track_link_visit: {
        Args: {
          p_ip_address?: string
          p_link_slug: string
          p_referrer_url?: string
          p_session_id: string
          p_user_agent?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
          p_visitor_id?: string
        }
        Returns: string
      }
      update_team_member_role: {
        Args: { p_new_role: string; p_profile_id: string }
        Returns: boolean
      }
      upsert_recent_view: {
        Args: {
          p_module_id: string
          p_org_id: string
          p_record_id: string
          p_user_id: string
        }
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
    Enums: {},
  },
} as const
