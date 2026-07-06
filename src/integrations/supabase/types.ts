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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          bubble_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          bubble_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          bubble_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      bubble_memberships: {
        Row: {
          bubble_id: string
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          bubble_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          bubble_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bubble_memberships_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      bubbles: {
        Row: {
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          interest_tag: string
          is_private: boolean | null
          latitude: number
          longitude: number
          member_count: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          interest_tag: string
          is_private?: boolean | null
          latitude: number
          longitude: number
          member_count?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          interest_tag?: string
          is_private?: boolean | null
          latitude?: number
          longitude?: number
          member_count?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          bubble_id: string | null
          call_type: string
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          bubble_id?: string | null
          call_type: string
          caller_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          bubble_id?: string | null
          call_type?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_drops: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          latitude: number
          longitude: number
          max_views: number | null
          radius: number
          title: string
          type: Database["public"]["Enums"]["dead_drop_type"]
          viewed_by: string[]
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          latitude: number
          longitude: number
          max_views?: number | null
          radius?: number
          title: string
          type: Database["public"]["Enums"]["dead_drop_type"]
          viewed_by?: string[]
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          latitude?: number
          longitude?: number
          max_views?: number | null
          radius?: number
          title?: string
          type?: Database["public"]["Enums"]["dead_drop_type"]
          viewed_by?: string[]
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: []
      }
      geofences: {
        Row: {
          alert_on_enter: boolean
          alert_on_leave: boolean
          created_at: string
          friend_id: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          radius: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_on_enter?: boolean
          alert_on_leave?: boolean
          created_at?: string
          friend_id?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          radius?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_on_enter?: boolean
          alert_on_leave?: boolean
          created_at?: string
          friend_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hangout_zones: {
        Row: {
          bubble_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          inside_user_ids: string[] | null
          latitude: number
          longitude: number
          name: string
          radius: number
        }
        Insert: {
          bubble_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          inside_user_ids?: string[] | null
          latitude: number
          longitude: number
          name?: string
          radius?: number
        }
        Update: {
          bubble_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          inside_user_ids?: string[] | null
          latitude?: number
          longitude?: number
          name?: string
          radius?: number
        }
        Relationships: [
          {
            foreignKeyName: "hangout_zones_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangout_zones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_locations: {
        Row: {
          bubble_id: string
          created_at: string
          expires_at: string
          id: string
          latitude: number
          longitude: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bubble_id: string
          created_at?: string
          expires_at: string
          id?: string
          latitude: number
          longitude: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bubble_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          latitude?: number
          longitude?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_locations_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_history: {
        Row: {
          accuracy_meters: number | null
          id: string
          intensity: number
          latitude: number
          longitude: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          id?: string
          intensity?: number
          latitude: number
          longitude: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          id?: string
          intensity?: number
          latitude?: number
          longitude?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          latitude: number
          longitude: number
          text_content: string | null
          updated_at: string
          user_id: string
          visibility_radius: number | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          image_url?: string | null
          latitude: number
          longitude: number
          text_content?: string | null
          updated_at?: string
          user_id: string
          visibility_radius?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          latitude?: number
          longitude?: number
          text_content?: string | null
          updated_at?: string
          user_id?: string
          visibility_radius?: number | null
        }
        Relationships: []
      }
      meetup_rsvps: {
        Row: {
          created_at: string | null
          id: string
          meetup_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meetup_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meetup_id?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_rsvps_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          bubble_id: string
          created_at: string | null
          date_time: string
          description: string | null
          id: string
          latitude: number
          location_name: string | null
          longitude: number
          organizer_id: string
          status: Database["public"]["Enums"]["meetup_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bubble_id: string
          created_at?: string | null
          date_time: string
          description?: string | null
          id?: string
          latitude: number
          location_name?: string | null
          longitude: number
          organizer_id: string
          status?: Database["public"]["Enums"]["meetup_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bubble_id?: string
          created_at?: string | null
          date_time?: string
          description?: string | null
          id?: string
          latitude?: number
          location_name?: string | null
          longitude?: number
          organizer_id?: string
          status?: Database["public"]["Enums"]["meetup_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetups_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          bubble_id: string | null
          content: string
          created_at: string | null
          id: string
          is_disappearing: boolean | null
          message_type: string | null
          recipient_id: string | null
          sender_id: string
          viewed_at: string | null
        }
        Insert: {
          bubble_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_disappearing?: boolean | null
          message_type?: string | null
          recipient_id?: string | null
          sender_id: string
          viewed_at?: string | null
        }
        Update: {
          bubble_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_disappearing?: boolean | null
          message_type?: string | null
          recipient_id?: string | null
          sender_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      privacy_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          bio: string | null
          created_at: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          ghost_mode: boolean | null
          id: string
          interests: string[] | null
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          profile_photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          age: number
          bio?: string | null
          created_at?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          ghost_mode?: boolean | null
          id: string
          interests?: string[] | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number
          bio?: string | null
          created_at?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          ghost_mode?: boolean | null
          id?: string
          interests?: string[] | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          referred_email: string
          referred_user_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          referred_email: string
          referred_user_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string
          referred_user_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      safety_alerts: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          response: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          response?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          response?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      snap_scores: {
        Row: {
          created_at: string
          id: string
          snaps_received: number
          snaps_sent: number
          stories_posted: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snaps_received?: number
          snaps_sent?: number
          stories_posted?: number
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snaps_received?: number
          snaps_sent?: number
          stories_posted?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      snap_streaks: {
        Row: {
          created_at: string
          id: string
          last_snap_at: string
          last_snap_by: string | null
          started_at: string
          streak_count: number
          updated_at: string
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_snap_at?: string
          last_snap_by?: string | null
          started_at?: string
          streak_count?: number
          updated_at?: string
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string
          id?: string
          last_snap_at?: string
          last_snap_by?: string | null
          started_at?: string
          streak_count?: number
          updated_at?: string
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: []
      }
      status_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      status_updates: {
        Row: {
          activity_type: string
          bubble_id: string
          created_at: string
          emoji: string
          expires_at: string
          id: string
          status_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          bubble_id: string
          created_at?: string
          emoji?: string
          expires_at: string
          id?: string
          status_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          bubble_id?: string
          created_at?: string
          emoji?: string
          expires_at?: string
          id?: string
          status_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_bubble_id_fkey"
            columns: ["bubble_id"]
            isOneToOne: false
            referencedRelation: "bubbles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: string
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: string
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: string
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "location_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "location_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "location_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string
          current_lat: number | null
          current_lng: number | null
          destination_lat: number
          destination_lng: number
          eta: string | null
          id: string
          name: string
          origin_lat: number
          origin_lng: number
          route: Json | null
          shared_with: string[]
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_lat?: number | null
          current_lng?: number | null
          destination_lat: number
          destination_lng: number
          eta?: string | null
          id?: string
          name: string
          origin_lat: number
          origin_lng: number
          route?: Json | null
          shared_with?: string[]
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_lat?: number | null
          current_lng?: number | null
          destination_lat?: number
          destination_lng?: number
          eta?: string | null
          id?: string
          name?: string
          origin_lat?: number
          origin_lng?: number
          route?: Json | null
          shared_with?: string[]
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_avatars: {
        Row: {
          color: string
          created_at: string
          custom_image_url: string | null
          icon: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          custom_image_url?: string | null
          icon?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          custom_image_url?: string | null
          icon?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_id?: string
          reporter_id?: string
        }
        Relationships: []
      }
      voice_messages: {
        Row: {
          chat_id: string
          created_at: string
          duration: number
          id: string
          is_played: boolean
          sender_id: string
          url: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          duration: number
          id?: string
          is_played?: boolean
          sender_id: string
          url: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          duration?: number
          id?: string
          is_played?: boolean
          sender_id?: string
          url?: string
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          id: string
          last_used: string | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          id?: string
          last_used?: string | null
          name?: string
          type?: string
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          id?: string
          last_used?: string | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_friend_locations: {
        Args: never
        Returns: {
          first_name: string
          ghost_mode: boolean
          id: string
          latitude: number
          longitude: number
          profile_photo_url: string
        }[]
      }
      get_nearby_dead_drops: {
        Args: { user_lat: number; user_lng: number }
        Returns: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          latitude: number
          longitude: number
          max_views: number | null
          radius: number
          title: string
          type: Database["public"]["Enums"]["dead_drop_type"]
          viewed_by: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "dead_drops"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      dead_drop_type: "text" | "image" | "voice"
      gender_type: "male" | "female" | "non_binary" | "prefer_not_to_say"
      meetup_status: "upcoming" | "ongoing" | "completed" | "cancelled"
      report_reason:
        | "spam"
        | "harassment"
        | "inappropriate_content"
        | "fake_profile"
        | "other"
      rsvp_status: "going" | "maybe" | "not_going"
      trip_status: "pending" | "active" | "completed" | "cancelled"
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
      dead_drop_type: ["text", "image", "voice"],
      gender_type: ["male", "female", "non_binary", "prefer_not_to_say"],
      meetup_status: ["upcoming", "ongoing", "completed", "cancelled"],
      report_reason: [
        "spam",
        "harassment",
        "inappropriate_content",
        "fake_profile",
        "other",
      ],
      rsvp_status: ["going", "maybe", "not_going"],
      trip_status: ["pending", "active", "completed", "cancelled"],
    },
  },
} as const
