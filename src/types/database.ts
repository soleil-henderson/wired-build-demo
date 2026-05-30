/**
 * Database types for the Wired Build Supabase schema.
 *
 * This file is hand-written for now; once the schema is pushed to Supabase
 * you can regenerate it with:
 *   npx supabase gen types typescript --project-id oappihyoqodqaylqsoqy > src/types/database.ts
 *
 * Keep it in sync with supabase/migrations/*.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionTier = 'free' | 'member' | 'pro' | 'workshop';

export type AccountType = 'builder' | 'workshop';

export type WorkshopEnquiryStatus = 'new' | 'read' | 'archived';

export type ModCategory =
  | 'suspension'
  | 'drivetrain'
  | 'body'
  | 'recovery'
  | 'interior'
  | 'lighting'
  | 'electrical'
  | 'wheels_tyres'
  | 'camping'
  | 'other';

export type InstallerType = 'self' | 'workshop' | 'friend' | 'dealer';

export type ModPrivacy = 'public' | 'followers' | 'private';

export type InstallDifficulty = 'easy' | 'moderate' | 'professional';

export type PartSource = 'brand' | 'wired' | 'community';

export type MediaKind = 'photo' | 'receipt' | 'cover' | 'avatar' | 'video';

export type ReactionTarget = 'post' | 'mod' | 'comment';

export type SavedTargetType = 'post' | 'mod' | 'vehicle';

export type ReactionType = 'like';

export type NotificationType =
  | 'reaction'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'price_alert'
  | 'verification'
  | 'ownership_transfer';

export type WishlistPriority = 'low' | 'medium' | 'high';

export type MaintenanceRecordType =
  | 'oil_change'
  | 'general_service'
  | 'major_service'
  | 'inspection'
  | 'tyres'
  | 'brakes'
  | 'registration'
  | 'insurance'
  | 'other';

export type AiMessageRole = 'user' | 'assistant' | 'tool';

export type DocumentImportBatchStatus = 'analyzing' | 'ready' | 'applied' | 'cancelled';

export type DocumentImportItemStatus = 'pending' | 'accepted' | 'skipped';

export type VehicleDocumentType =
  | 'registration'
  | 'insurance'
  | 'service_receipt'
  | 'invoice'
  | 'inspection'
  | 'other';

export type ToolOwnership = 'owned' | 'hired';

export type EventKind = 'meetup' | 'trip' | 'show' | 'other';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          handle: string;
          display_name: string;
          email: string;
          email_verified: boolean;
          avatar_url: string | null;
          bio: string | null;
          location: Json | null;
          subscription_tier: SubscriptionTier;
          auth_providers: Json;
          push_token: string | null;
          is_identity_verified: boolean;
          is_workshop: boolean;
          is_admin: boolean;
          is_private: boolean;
          account_type: AccountType;
          workshop_onboarding_complete: boolean;
          workshop_name: string | null;
          workshop_phone: string | null;
          workshop_website: string | null;
          workshop_business_email: string | null;
          workshop_contact_name: string | null;
          workshop_abn: string | null;
          workshop_business_type: string | null;
          workshop_address: string | null;
          workshop_service_area: string | null;
          workshop_hours: string | null;
          workshop_tagline: string | null;
          workshop_description: string | null;
          workshop_instagram: string | null;
          workshop_facebook: string | null;
          workshop_logo_url: string | null;
          workshop_cover_url: string | null;
          workshop_booking_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name: string;
          email: string;
          email_verified?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          location?: Json | null;
          subscription_tier?: SubscriptionTier;
          auth_providers?: Json;
          push_token?: string | null;
          is_identity_verified?: boolean;
          is_workshop?: boolean;
          is_admin?: boolean;
          is_private?: boolean;
          account_type?: AccountType;
          workshop_onboarding_complete?: boolean;
          workshop_name?: string | null;
          workshop_phone?: string | null;
          workshop_website?: string | null;
          workshop_business_email?: string | null;
          workshop_contact_name?: string | null;
          workshop_abn?: string | null;
          workshop_business_type?: string | null;
          workshop_address?: string | null;
          workshop_service_area?: string | null;
          workshop_hours?: string | null;
          workshop_tagline?: string | null;
          workshop_description?: string | null;
          workshop_instagram?: string | null;
          workshop_facebook?: string | null;
          workshop_logo_url?: string | null;
          workshop_cover_url?: string | null;
          workshop_booking_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          display_name?: string;
          email?: string;
          email_verified?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          location?: Json | null;
          subscription_tier?: SubscriptionTier;
          auth_providers?: Json;
          push_token?: string | null;
          is_identity_verified?: boolean;
          is_workshop?: boolean;
          is_admin?: boolean;
          is_private?: boolean;
          account_type?: AccountType;
          workshop_onboarding_complete?: boolean;
          workshop_name?: string | null;
          workshop_phone?: string | null;
          workshop_website?: string | null;
          workshop_business_email?: string | null;
          workshop_contact_name?: string | null;
          workshop_abn?: string | null;
          workshop_business_type?: string | null;
          workshop_address?: string | null;
          workshop_service_area?: string | null;
          workshop_hours?: string | null;
          workshop_tagline?: string | null;
          workshop_description?: string | null;
          workshop_instagram?: string | null;
          workshop_facebook?: string | null;
          workshop_logo_url?: string | null;
          workshop_cover_url?: string | null;
          workshop_booking_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          vin: string;
          current_owner_id: string;
          ownership_chain: Json;
          year: number;
          make: string;
          model: string;
          trim: string | null;
          nickname: string | null;
          cover_photo_url: string | null;
          is_public: boolean;
          is_for_sale: boolean;
          asking_price: number | null;
          total_spend: number;
          build_value: number | null;
          valuation_source: string;
          manual_build_value: number | null;
          manual_build_value_at: string | null;
          manual_build_value_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vin: string;
          current_owner_id: string;
          ownership_chain?: Json;
          year: number;
          make: string;
          model: string;
          trim?: string | null;
          nickname?: string | null;
          cover_photo_url?: string | null;
          is_public?: boolean;
          is_for_sale?: boolean;
          asking_price?: number | null;
          total_spend?: number;
          build_value?: number | null;
          valuation_source?: string;
          manual_build_value?: number | null;
          manual_build_value_at?: string | null;
          manual_build_value_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vin?: string;
          current_owner_id?: string;
          ownership_chain?: Json;
          year?: number;
          make?: string;
          model?: string;
          trim?: string | null;
          nickname?: string | null;
          cover_photo_url?: string | null;
          is_public?: boolean;
          is_for_sale?: boolean;
          asking_price?: number | null;
          total_spend?: number;
          build_value?: number | null;
          valuation_source?: string;
          manual_build_value?: number | null;
          manual_build_value_at?: string | null;
          manual_build_value_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_current_owner_id_fkey';
            columns: ['current_owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      parts: {
        Row: {
          id: string;
          brand: string;
          name: string;
          sku: string | null;
          category: ModCategory;
          price_min: number | null;
          price_max: number | null;
          fitment: Json;
          affiliate_links: Json;
          hero_image_url: string | null;
          install_difficulty: InstallDifficulty | null;
          install_count: number;
          avg_rating: number | null;
          review_count: number;
          source: PartSource;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand: string;
          name: string;
          sku?: string | null;
          category: ModCategory;
          price_min?: number | null;
          price_max?: number | null;
          fitment?: Json;
          affiliate_links?: Json;
          hero_image_url?: string | null;
          install_difficulty?: InstallDifficulty | null;
          install_count?: number;
          avg_rating?: number | null;
          review_count?: number;
          source?: PartSource;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand?: string;
          name?: string;
          sku?: string | null;
          category?: ModCategory;
          price_min?: number | null;
          price_max?: number | null;
          fitment?: Json;
          affiliate_links?: Json;
          hero_image_url?: string | null;
          install_difficulty?: InstallDifficulty | null;
          install_count?: number;
          avg_rating?: number | null;
          review_count?: number;
          source?: PartSource;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      part_reviews: {
        Row: {
          id: string;
          part_id: string;
          user_id: string;
          rating: number;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          user_id: string;
          rating: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          user_id?: string;
          rating?: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      part_clicks: {
        Row: {
          id: string;
          part_id: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workshop_reviews: {
        Row: {
          id: string;
          workshop_user_id: string;
          reviewer_user_id: string;
          mod_id: string | null;
          rating: number;
          body: string | null;
          reply_body: string | null;
          reply_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_user_id: string;
          reviewer_user_id: string;
          mod_id?: string | null;
          rating: number;
          body?: string | null;
          reply_body?: string | null;
          reply_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workshop_user_id?: string;
          reviewer_user_id?: string;
          mod_id?: string | null;
          rating?: number;
          body?: string | null;
          reply_body?: string | null;
          reply_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_portfolio_items: {
        Row: {
          id: string;
          workshop_user_id: string;
          mod_id: string | null;
          title: string;
          description: string | null;
          category: ModCategory | null;
          vehicle_label: string | null;
          image_url: string | null;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_user_id: string;
          mod_id?: string | null;
          title: string;
          description?: string | null;
          category?: ModCategory | null;
          vehicle_label?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workshop_user_id?: string;
          mod_id?: string | null;
          title?: string;
          description?: string | null;
          category?: ModCategory | null;
          vehicle_label?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_mod_consents: {
        Row: {
          mod_id: string;
          workshop_user_id: string;
          granted_by_user_id: string;
          portfolio_allowed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          mod_id: string;
          workshop_user_id: string;
          granted_by_user_id: string;
          portfolio_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          mod_id?: string;
          workshop_user_id?: string;
          granted_by_user_id?: string;
          portfolio_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_enquiries: {
        Row: {
          id: string;
          workshop_user_id: string;
          sender_user_id: string | null;
          sender_name: string;
          sender_email: string;
          sender_phone: string | null;
          message: string;
          status: WorkshopEnquiryStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_user_id: string;
          sender_user_id?: string | null;
          sender_name: string;
          sender_email: string;
          sender_phone?: string | null;
          message: string;
          status?: WorkshopEnquiryStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workshop_user_id?: string;
          sender_user_id?: string | null;
          sender_name?: string;
          sender_email?: string;
          sender_phone?: string | null;
          message?: string;
          status?: WorkshopEnquiryStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mods: {
        Row: {
          id: string;
          vehicle_id: string;
          part_id: string | null;
          custom_part_name: string | null;
          category: ModCategory;
          cost: number | null;
          cost_is_approximate: boolean;
          installer_type: InstallerType;
          installer_workshop_id: string | null;
          install_date: string;
          date_is_approximate: boolean;
          notes: string | null;
          receipt_media_id: string | null;
          privacy: ModPrivacy;
          is_verified_by_workshop: boolean;
          from_plan_item_id: string | null;
          product_links: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          part_id?: string | null;
          custom_part_name?: string | null;
          category: ModCategory;
          cost?: number | null;
          cost_is_approximate?: boolean;
          installer_type: InstallerType;
          installer_workshop_id?: string | null;
          install_date: string;
          date_is_approximate?: boolean;
          notes?: string | null;
          receipt_media_id?: string | null;
          privacy?: ModPrivacy;
          is_verified_by_workshop?: boolean;
          from_plan_item_id?: string | null;
          product_links?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          part_id?: string | null;
          custom_part_name?: string | null;
          category?: ModCategory;
          cost?: number | null;
          cost_is_approximate?: boolean;
          installer_type?: InstallerType;
          installer_workshop_id?: string | null;
          install_date?: string;
          date_is_approximate?: boolean;
          notes?: string | null;
          receipt_media_id?: string | null;
          privacy?: ModPrivacy;
          is_verified_by_workshop?: boolean;
          from_plan_item_id?: string | null;
          product_links?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mods_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mods_part_id_fkey';
            columns: ['part_id'];
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
        ];
      };
      mod_tools: {
        Row: {
          id: string;
          mod_id: string;
          name: string;
          brand: string | null;
          url: string | null;
          ownership: ToolOwnership;
          cost: number | null;
          hire_duration: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mod_id: string;
          name: string;
          brand?: string | null;
          url?: string | null;
          ownership?: ToolOwnership;
          cost?: number | null;
          hire_duration?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mod_id?: string;
          name?: string;
          brand?: string | null;
          url?: string | null;
          ownership?: ToolOwnership;
          cost?: number | null;
          hire_duration?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mod_tools_mod_id_fkey';
            columns: ['mod_id'];
            referencedRelation: 'mods';
            referencedColumns: ['id'];
          },
        ];
      };
      media: {
        Row: {
          id: string;
          owner_id: string;
          mod_id: string | null;
          post_id: string | null;
          url: string;
          storage_key: string;
          thumbnail_url: string | null;
          kind: MediaKind;
          width: number | null;
          height: number | null;
          is_sensitive: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          mod_id?: string | null;
          post_id?: string | null;
          url: string;
          storage_key: string;
          thumbnail_url?: string | null;
          kind: MediaKind;
          width?: number | null;
          height?: number | null;
          is_sensitive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          mod_id?: string | null;
          post_id?: string | null;
          url?: string;
          storage_key?: string;
          thumbnail_url?: string | null;
          kind?: MediaKind;
          width?: number | null;
          height?: number | null;
          is_sensitive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_mod_id_fkey';
            columns: ['mod_id'];
            referencedRelation: 'mods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          vehicle_id: string;
          mod_id: string | null;
          body: string | null;
          reaction_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_id: string;
          mod_id?: string | null;
          body?: string | null;
          reaction_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_id?: string;
          mod_id?: string | null;
          body?: string | null;
          reaction_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_mod_id_fkey';
            columns: ['mod_id'];
            referencedRelation: 'mods';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_comment_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          parent_comment_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          parent_comment_id?: string | null;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_comment_id_fkey';
            columns: ['parent_comment_id'];
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
        ];
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          type?: ReactionType;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: ReactionTarget;
          target_id?: string;
          type?: ReactionType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          followee_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_followee_id_fkey';
            columns: ['followee_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          storage_key: string;
          media_kind: 'photo' | 'video';
          thumbnail_url: string | null;
          duration_ms: number | null;
          caption: string | null;
          stickers: unknown;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url: string;
          storage_key: string;
          media_kind?: 'photo' | 'video';
          thumbnail_url?: string | null;
          duration_ms?: number | null;
          caption?: string | null;
          stickers?: unknown;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_url?: string;
          storage_key?: string;
          media_kind?: 'photo' | 'video';
          thumbnail_url?: string | null;
          duration_ms?: number | null;
          caption?: string | null;
          stickers?: unknown;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stories_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      story_likes: {
        Row: {
          story_id: string;
          user_id: string;
          liked_at: string;
        };
        Insert: {
          story_id: string;
          user_id: string;
          liked_at?: string;
        };
        Update: {
          story_id?: string;
          user_id?: string;
          liked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'story_likes_story_id_fkey';
            columns: ['story_id'];
            referencedRelation: 'stories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'story_likes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      story_views: {
        Row: {
          story_id: string;
          viewer_id: string;
          viewed_at: string;
        };
        Insert: {
          story_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: {
          story_id?: string;
          viewer_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'story_views_story_id_fkey';
            columns: ['story_id'];
            referencedRelation: 'stories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'story_views_viewer_id_fkey';
            columns: ['viewer_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      follow_requests: {
        Row: {
          id: string;
          requester_id: string;
          target_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          target_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          target_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follow_requests_requester_id_fkey';
            columns: ['requester_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follow_requests_target_id_fkey';
            columns: ['target_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ownership_transfers: {
        Row: {
          id: string;
          vehicle_id: string;
          from_user_id: string | null;
          to_user_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          from_user_id: string | null;
          to_user_id: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          from_user_id?: string | null;
          to_user_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ownership_transfers_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ownership_transfers_from_user_id_fkey';
            columns: ['from_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ownership_transfers_to_user_id_fkey';
            columns: ['to_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_items: {
        Row: {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          part_id: string | null;
          custom_part_name: string | null;
          category: ModCategory | null;
          target_cost: number | null;
          notes: string | null;
          priority: WishlistPriority;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_id?: string | null;
          part_id?: string | null;
          custom_part_name?: string | null;
          category?: ModCategory | null;
          target_cost?: number | null;
          notes?: string | null;
          priority?: WishlistPriority;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_id?: string | null;
          part_id?: string | null;
          custom_part_name?: string | null;
          category?: ModCategory | null;
          target_cost?: number | null;
          notes?: string | null;
          priority?: WishlistPriority;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_part_id_fkey';
            columns: ['part_id'];
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          kind: EventKind;
          location_name: string;
          location: Json | null;
          starts_at: string;
          ends_at: string | null;
          attendee_count: number;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          description?: string | null;
          kind?: EventKind;
          location_name: string;
          location?: Json | null;
          starts_at: string;
          ends_at?: string | null;
          attendee_count?: number;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          description?: string | null;
          kind?: EventKind;
          location_name?: string;
          location?: Json | null;
          starts_at?: string;
          ends_at?: string | null;
          attendee_count?: number;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['host_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      event_invites: {
        Row: {
          event_id: string;
          user_id: string;
          invited_by: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          invited_by: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          invited_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_invites_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_invites_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_invites_invited_by_fkey';
            columns: ['invited_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      event_attendees: {
        Row: {
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_attendees_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_attendees_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_items: {
        Row: {
          id: string;
          user_id: string;
          target_type: SavedTargetType;
          target_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: SavedTargetType;
          target_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: SavedTargetType;
          target_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_items_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          follows_enabled: boolean;
          reactions_enabled: boolean;
          comments_enabled: boolean;
          ownership_transfers_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          follows_enabled?: boolean;
          reactions_enabled?: boolean;
          comments_enabled?: boolean;
          ownership_transfers_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          follows_enabled?: boolean;
          reactions_enabled?: boolean;
          comments_enabled?: boolean;
          ownership_transfers_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_items: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          title: string;
          target_cost: number | null;
          notes: string | null;
          sort_order: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          title: string;
          target_cost?: number | null;
          notes?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          user_id?: string;
          title?: string;
          target_cost?: number | null;
          notes?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_documents: {
        Row: {
          id: string;
          vehicle_id: string;
          owner_id: string;
          title: string;
          file_name: string;
          storage_key: string;
          mime_type: string;
          file_size: number | null;
          document_type: VehicleDocumentType | null;
          extracted_metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          owner_id: string;
          title: string;
          file_name: string;
          storage_key: string;
          mime_type: string;
          file_size?: number | null;
          document_type?: VehicleDocumentType | null;
          extracted_metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          owner_id?: string;
          title?: string;
          file_name?: string;
          storage_key?: string;
          mime_type?: string;
          file_size?: number | null;
          document_type?: VehicleDocumentType | null;
          extracted_metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_documents_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_documents_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      maintenance_records: {
        Row: {
          id: string;
          vehicle_id: string;
          owner_id: string;
          record_type: MaintenanceRecordType;
          title: string;
          service_date: string;
          date_is_approximate: boolean;
          odometer_km: number | null;
          cost: number | null;
          cost_is_approximate: boolean;
          provider: string | null;
          notes: string | null;
          next_due_date: string | null;
          next_due_odometer_km: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          owner_id: string;
          record_type: MaintenanceRecordType;
          title: string;
          service_date: string;
          date_is_approximate?: boolean;
          odometer_km?: number | null;
          cost?: number | null;
          cost_is_approximate?: boolean;
          provider?: string | null;
          notes?: string | null;
          next_due_date?: string | null;
          next_due_odometer_km?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          owner_id?: string;
          record_type?: MaintenanceRecordType;
          title?: string;
          service_date?: string;
          date_is_approximate?: boolean;
          odometer_km?: number | null;
          cost?: number | null;
          cost_is_approximate?: boolean;
          provider?: string | null;
          notes?: string | null;
          next_due_date?: string | null;
          next_due_odometer_km?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'maintenance_records_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      maintenance_record_documents: {
        Row: {
          maintenance_record_id: string;
          document_id: string;
        };
        Insert: {
          maintenance_record_id: string;
          document_id: string;
        };
        Update: {
          maintenance_record_id?: string;
          document_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'maintenance_record_documents_maintenance_record_id_fkey';
            columns: ['maintenance_record_id'];
            referencedRelation: 'maintenance_records';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_record_documents_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'vehicle_documents';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_id?: string | null;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_conversations_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_conversations_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: AiMessageRole;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: AiMessageRole;
          content: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: AiMessageRole;
          content?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'ai_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage_monthly: {
        Row: {
          user_id: string;
          month: string;
          message_count: number;
          tokens_used: number;
        };
        Insert: {
          user_id: string;
          month: string;
          message_count?: number;
          tokens_used?: number;
        };
        Update: {
          user_id?: string;
          month?: string;
          message_count?: number;
          tokens_used?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_usage_monthly_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      document_import_batches: {
        Row: {
          id: string;
          vehicle_id: string;
          user_id: string;
          status: DocumentImportBatchStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          user_id: string;
          status?: DocumentImportBatchStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          user_id?: string;
          status?: DocumentImportBatchStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_import_batches_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_import_batches_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      document_import_items: {
        Row: {
          id: string;
          batch_id: string;
          temp_storage_key: string;
          file_name: string;
          mime_type: string;
          file_size: number | null;
          proposed_document_type: VehicleDocumentType | null;
          proposed_record_type: MaintenanceRecordType | null;
          proposed_title: string | null;
          proposed_service_date: string | null;
          proposed_cost: number | null;
          proposed_provider: string | null;
          confidence: string | null;
          reasoning: string | null;
          status: DocumentImportItemStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          temp_storage_key: string;
          file_name: string;
          mime_type: string;
          file_size?: number | null;
          proposed_document_type?: VehicleDocumentType | null;
          proposed_record_type?: MaintenanceRecordType | null;
          proposed_title?: string | null;
          proposed_service_date?: string | null;
          proposed_cost?: number | null;
          proposed_provider?: string | null;
          confidence?: string | null;
          reasoning?: string | null;
          status?: DocumentImportItemStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          temp_storage_key?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number | null;
          proposed_document_type?: VehicleDocumentType | null;
          proposed_record_type?: MaintenanceRecordType | null;
          proposed_title?: string | null;
          proposed_service_date?: string | null;
          proposed_cost?: number | null;
          proposed_provider?: string | null;
          confidence?: string | null;
          reasoning?: string | null;
          status?: DocumentImportItemStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_import_items_batch_id_fkey';
            columns: ['batch_id'];
            referencedRelation: 'document_import_batches';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          user_low_id: string;
          user_high_id: string;
          last_message_at: string;
          last_message_body: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_low_id: string;
          user_high_id: string;
          last_message_at?: string;
          last_message_body?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_low_id?: string;
          user_high_id?: string;
          last_message_at?: string;
          last_message_body?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_user_low_id_fkey';
            columns: ['user_low_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_user_high_id_fkey';
            columns: ['user_high_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      direct_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string | null;
          message_type: 'text' | 'image' | 'audio' | 'story_reply' | 'event_share';
          media_url: string | null;
          storage_key: string | null;
          audio_duration_ms: number | null;
          story_id: string | null;
          event_id: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body?: string | null;
          message_type?: 'text' | 'image' | 'audio' | 'story_reply' | 'event_share';
          media_url?: string | null;
          storage_key?: string | null;
          audio_duration_ms?: number | null;
          story_id?: string | null;
          event_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string | null;
          message_type?: 'text' | 'image' | 'audio' | 'story_reply' | 'event_share';
          media_url?: string | null;
          storage_key?: string | null;
          audio_duration_ms?: number | null;
          story_id?: string | null;
          event_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'direct_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'direct_messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'direct_messages_story_id_fkey';
            columns: ['story_id'];
            referencedRelation: 'stories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'direct_messages_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      message_likes: {
        Row: {
          message_id: string;
          user_id: string;
          liked_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          liked_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          liked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_likes_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'direct_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_likes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      transfer_vehicle_ownership: {
        Args: {
          p_vehicle_id: string;
          p_new_owner_id: string;
          p_note?: string | null;
        };
        Returns: void;
      };
      delete_own_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      check_rate_limit: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      workshop_verify_mod: {
        Args: { p_mod_id: string };
        Returns: void;
      };
      recalc_vehicle_total_spend: {
        Args: { p_vehicle_id: string };
        Returns: void;
      };
      get_or_create_conversation: {
        Args: { p_other_user_id: string };
        Returns: string;
      };
      toggle_follow: {
        Args: { p_target_id: string };
        Returns: Json;
      };
      accept_follow_request: {
        Args: { p_request_id: string };
        Returns: void;
      };
      decline_follow_request: {
        Args: { p_request_id: string };
        Returns: void;
      };
      increment_ai_usage: {
        Args: {
          p_user_id: string;
          p_month: string;
          p_tokens?: number;
        };
        Returns: number;
      };
    };
    Enums: {
      subscription_tier: SubscriptionTier;
      mod_category: ModCategory;
      installer_type: InstallerType;
      mod_privacy: ModPrivacy;
      install_difficulty: InstallDifficulty;
      part_source: PartSource;
      media_kind: MediaKind;
      reaction_target: ReactionTarget;
      saved_target_type: SavedTargetType;
      reaction_type: ReactionType;
      notification_type: NotificationType;
      wishlist_priority: WishlistPriority;
      maintenance_record_type: MaintenanceRecordType;
      tool_ownership: ToolOwnership;
      ai_message_role: AiMessageRole;
      document_import_batch_status: DocumentImportBatchStatus;
      document_import_item_status: DocumentImportItemStatus;
      vehicle_document_type: VehicleDocumentType;
      event_kind: EventKind;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
