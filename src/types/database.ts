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

export type MediaKind = 'photo' | 'receipt' | 'cover' | 'avatar';

export type ReactionTarget = 'post' | 'mod' | 'comment';

export type ReactionType = 'like';

export type NotificationType =
  | 'reaction'
  | 'comment'
  | 'follow'
  | 'price_alert'
  | 'verification'
  | 'ownership_transfer';

export type WishlistPriority = 'low' | 'medium' | 'high';

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
          total_spend: number;
          build_value: number | null;
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
          total_spend?: number;
          build_value?: number | null;
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
          total_spend?: number;
          build_value?: number | null;
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
          source?: PartSource;
          is_approved?: boolean;
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
      media: {
        Row: {
          id: string;
          owner_id: string;
          mod_id: string | null;
          url: string;
          storage_key: string;
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
          url: string;
          storage_key: string;
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
          url?: string;
          storage_key?: string;
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
      reaction_type: ReactionType;
      notification_type: NotificationType;
      wishlist_priority: WishlistPriority;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
