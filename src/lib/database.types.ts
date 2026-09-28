/**
 * Hand-maintained types mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript` when connected to a project.
 */
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
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          orb_scale_agorot: number | null;
          reminder_days: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          orb_scale_agorot?: number | null;
          reminder_days?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      merchants: {
        Row: {
          id: string;
          name_he: string;
          slug: string;
          category: string | null;
          website: string | null;
          logo_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name_he: string;
          slug: string;
          category?: string | null;
          website?: string | null;
          logo_color?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Insert"]>;
      };
      merchant_branches: {
        Row: {
          id: string;
          merchant_id: string;
          name_he: string;
          city: string;
          address_he: string;
          lat: number | null;
          lng: number | null;
          acceptance: "verified" | "unverified" | "not_accepted";
          notes_he: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name_he: string;
          city: string;
          address_he: string;
          lat?: number | null;
          lng?: number | null;
          acceptance?: "verified" | "unverified" | "not_accepted";
          notes_he?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["merchant_branches"]["Insert"]
        >;
      };
      vouchers: {
        Row: {
          id: string;
          user_id: string;
          merchant_id: string | null;
          merchant_name: string;
          document_type:
            | "store_credit"
            | "gift_voucher"
            | "shopping_voucher"
            | "receipt";
          status:
            | "active"
            | "partially_redeemed"
            | "fully_redeemed"
            | "expired"
            | "archived";
          original_amount_agorot: number;
          remaining_amount_agorot: number;
          currency: string;
          issue_date: string | null;
          expiry_date: string | null;
          expiry_confidence: "confirmed" | "uncertain" | "missing";
          voucher_code: string | null;
          barcode_value: string | null;
          usage_terms: string | null;
          notes: string | null;
          document_path: string | null;
          document_mime_type: string | null;
          document_file_name: string | null;
          extraction_raw: Json | null;
          fields_confirmed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["vouchers"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vouchers"]["Insert"]>;
      };
      redemptions: {
        Row: {
          id: string;
          voucher_id: string;
          user_id: string;
          amount_agorot: number;
          redeemed_at: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          voucher_id: string;
          user_id: string;
          amount_agorot: number;
          redeemed_at?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["redemptions"]["Insert"]>;
      };
      activity_events: {
        Row: {
          id: string;
          user_id: string;
          voucher_id: string | null;
          kind: string;
          summary_he: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          voucher_id?: string | null;
          kind: string;
          summary_he: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_events"]["Insert"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      document_type:
        | "store_credit"
        | "gift_voucher"
        | "shopping_voucher"
        | "receipt";
      voucher_status:
        | "active"
        | "partially_redeemed"
        | "fully_redeemed"
        | "expired"
        | "archived";
      expiry_confidence: "confirmed" | "uncertain" | "missing";
      branch_acceptance: "verified" | "unverified" | "not_accepted";
    };
  };
}
