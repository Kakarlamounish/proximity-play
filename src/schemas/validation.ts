import { z } from 'zod';

// User schemas
export const userProfileSchema = z.object({
  first_name: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  age: z.number().min(13, 'Must be at least 13 years old').max(120, 'Invalid age'),
  interests: z.array(z.string()).min(1, 'Select at least one interest').max(10, 'Maximum 10 interests'),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

export const userSettingsSchema = z.object({
  notifications: z.object({
    messages: z.boolean(),
    friends: z.boolean(),
    bubbles: z.boolean(),
    system: z.boolean(),
  }),
  privacy: z.object({
    locationSharing: z.boolean(),
    profileVisibility: z.boolean(),
    ghostMode: z.boolean(),
  }),
  preferences: z.object({
    language: z.enum(['en', 'es', 'fr', 'de']),
    timezone: z.string(),
  }),
});

// Bubble schemas
export const createBubbleSchema = z.object({
  name: z.string().min(3, 'Bubble name must be at least 3 characters').max(100, 'Bubble name must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  interest_tag: z.string().min(2, 'Interest tag must be at least 2 characters').max(50, 'Interest tag must be less than 50 characters'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  is_private: z.boolean().default(false),
  max_members: z.number().min(2).max(1000).default(100),
});

export const updateBubbleSchema = createBubbleSchema.partial();

// Message schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message must be less than 2000 characters'),
  bubbleId: z.string().uuid('Invalid bubble ID'),
  replyTo: z.string().uuid().optional(),
});

// Story schemas
export const createStorySchema = z.object({
  content: z.string().max(500, 'Story content must be less than 500 characters').optional(),
  media_url: z.string().url('Invalid media URL').optional(),
  media_type: z.enum(['image', 'video']).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  expires_at: z.date().optional(),
});

// Event schemas
export const createEventSchema = z.object({
  title: z.string().min(3, 'Event title must be at least 3 characters').max(100, 'Event title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  start_time: z.date(),
  end_time: z.date(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
  }),
  max_attendees: z.number().min(2).max(1000).default(50),
  is_private: z.boolean().default(false),
  bubble_id: z.string().uuid('Invalid bubble ID'),
});

// Friend request schemas
export const friendRequestSchema = z.object({
  recipientId: z.string().uuid('Invalid user ID'),
  message: z.string().max(200, 'Message must be less than 200 characters').optional(),
});

// Report schemas
export const reportUserSchema = z.object({
  reportedUserId: z.string().uuid('Invalid user ID'),
  reason: z.enum(['harassment', 'spam', 'inappropriate_content', 'fake_account', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
});

// Search and filter schemas
export const searchBubblesSchema = z.object({
  query: z.string().optional(),
  interest_tags: z.array(z.string()).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().min(1).max(100).default(10), // km
  }).optional(),
  is_private: z.boolean().optional(),
  member_count_min: z.number().min(1).optional(),
  member_count_max: z.number().max(1000).optional(),
});

export const searchUsersSchema = z.object({
  query: z.string().optional(),
  interests: z.array(z.string()).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().min(1).max(100).default(10), // km
  }).optional(),
  age_min: z.number().min(13).optional(),
  age_max: z.number().max(120).optional(),
});

// Authentication schemas
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password must be less than 100 characters'),
  confirmPassword: z.string(),
  first_name: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name must be less than 50 characters'),
  age: z.number().min(13, 'Must be at least 13 years old').max(120, 'Invalid age'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Location and privacy schemas
export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  timestamp: z.date().optional(),
});

export const privacyScheduleSchema = z.object({
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  days_of_week: z.array(z.number().min(0).max(6)).min(1, 'Select at least one day'),
  is_active: z.boolean().default(true),
});

// File upload schemas
export const imageUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024, // 5MB
    'File size must be less than 5MB'
  ).refine(
    (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'File must be a JPEG, PNG, or WebP image'
  ),
});

export const videoUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 50 * 1024 * 1024, // 50MB
    'File size must be less than 50MB'
  ).refine(
    (file) => ['video/mp4', 'video/webm'].includes(file.type),
    'File must be an MP4 or WebM video'
  ),
});

// Type exports for use in components
export type UserProfileForm = z.infer<typeof userProfileSchema>;
export type UserSettingsForm = z.infer<typeof userSettingsSchema>;
export type CreateBubbleForm = z.infer<typeof createBubbleSchema>;
export type SendMessageForm = z.infer<typeof sendMessageSchema>;
export type CreateStoryForm = z.infer<typeof createStorySchema>;
export type CreateEventForm = z.infer<typeof createEventSchema>;
export type FriendRequestForm = z.infer<typeof friendRequestSchema>;
export type ReportUserForm = z.infer<typeof reportUserSchema>;
export type SearchBubblesForm = z.infer<typeof searchBubblesSchema>;
export type SearchUsersForm = z.infer<typeof searchUsersSchema>;
export type SignUpForm = z.infer<typeof signUpSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type UpdateLocationForm = z.infer<typeof updateLocationSchema>;
export type PrivacyScheduleForm = z.infer<typeof privacyScheduleSchema>;
export type ImageUploadForm = z.infer<typeof imageUploadSchema>;
export type VideoUploadForm = z.infer<typeof videoUploadSchema>;