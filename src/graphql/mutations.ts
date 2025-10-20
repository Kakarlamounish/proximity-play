import { gql } from '@apollo/client';

// Authentication mutations
export const LOGIN_USER = gql`
  mutation LoginUser($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        id
        email
        firstName
        lastName
        profilePhotoUrl
      }
      token
      refreshToken
    }
  }
`;

export const REGISTER_USER = gql`
  mutation RegisterUser($input: RegisterInput!) {
    register(input: $input) {
      user {
        id
        email
        firstName
        lastName
        profilePhotoUrl
      }
      token
      refreshToken
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
    }
  }
`;

// User mutations
export const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      firstName
      lastName
      bio
      interests
      age
      location {
        latitude
        longitude
      }
      updatedAt
    }
  }
`;

export const UPDATE_USER_LOCATION = gql`
  mutation UpdateUserLocation($latitude: Float!, $longitude: Float!) {
    updateLocation(latitude: $latitude, longitude: $longitude) {
      id
      location {
        latitude
        longitude
      }
      updatedAt
    }
  }
`;

export const UPLOAD_PROFILE_PHOTO = gql`
  mutation UploadProfilePhoto($file: Upload!) {
    uploadProfilePhoto(file: $file) {
      id
      profilePhotoUrl
      updatedAt
    }
  }
`;

// Bubble mutations
export const CREATE_BUBBLE = gql`
  mutation CreateBubble($input: CreateBubbleInput!) {
    createBubble(input: $input) {
      id
      name
      description
      interestTag
      memberCount
      isPrivate
      latitude
      longitude
      createdAt
    }
  }
`;

export const UPDATE_BUBBLE = gql`
  mutation UpdateBubble($id: ID!, $input: UpdateBubbleInput!) {
    updateBubble(id: $id, input: $input) {
      id
      name
      description
      interestTag
      updatedAt
    }
  }
`;

export const JOIN_BUBBLE = gql`
  mutation JoinBubble($bubbleId: ID!) {
    joinBubble(bubbleId: $bubbleId) {
      id
      bubble {
        id
        name
        memberCount
      }
      joinedAt
    }
  }
`;

export const LEAVE_BUBBLE = gql`
  mutation LeaveBubble($bubbleId: ID!) {
    leaveBubble(bubbleId: $bubbleId) {
      success
    }
  }
`;

// Message mutations
export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      messageType
      author {
        id
        firstName
        profilePhotoUrl
      }
      createdAt
    }
  }
`;

export const UPDATE_MESSAGE = gql`
  mutation UpdateMessage($id: ID!, $content: String!) {
    updateMessage(id: $id, content: $content) {
      id
      content
      updatedAt
    }
  }
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($id: ID!) {
    deleteMessage(id: $id) {
      success
    }
  }
`;

export const ADD_MESSAGE_REACTION = gql`
  mutation AddMessageReaction($messageId: ID!, $emoji: String!) {
    addMessageReaction(messageId: $messageId, emoji: $emoji) {
      id
      reactions {
        emoji
        count
        users {
          id
          firstName
        }
      }
    }
  }
`;

export const REMOVE_MESSAGE_REACTION = gql`
  mutation RemoveMessageReaction($messageId: ID!, $emoji: String!) {
    removeMessageReaction(messageId: $messageId, emoji: $emoji) {
      id
      reactions {
        emoji
        count
        users {
          id
          firstName
        }
      }
    }
  }
`;

// Friend mutations
export const SEND_FRIEND_REQUEST = gql`
  mutation SendFriendRequest($userId: ID!) {
    sendFriendRequest(userId: $userId) {
      id
      to {
        id
        firstName
      }
      status
      createdAt
    }
  }
`;

export const ACCEPT_FRIEND_REQUEST = gql`
  mutation AcceptFriendRequest($requestId: ID!) {
    acceptFriendRequest(requestId: $requestId) {
      id
      status
      friendship {
        id
        user1 {
          id
          firstName
        }
        user2 {
          id
          firstName
        }
        createdAt
      }
    }
  }
`;

export const DECLINE_FRIEND_REQUEST = gql`
  mutation DeclineFriendRequest($requestId: ID!) {
    declineFriendRequest(requestId: $requestId) {
      id
      status
    }
  }
`;

export const REMOVE_FRIEND = gql`
  mutation RemoveFriend($friendId: ID!) {
    removeFriend(friendId: $friendId) {
      success
    }
  }
`;

// Story mutations
export const CREATE_STORY = gql`
  mutation CreateStory($input: CreateStoryInput!) {
    createStory(input: $input) {
      id
      content
      mediaUrl
      mediaType
      expiresAt
      createdAt
    }
  }
`;

export const VIEW_STORY = gql`
  mutation ViewStory($storyId: ID!) {
    viewStory(storyId: $storyId) {
      id
      views {
        count
      }
    }
  }
`;

export const DELETE_STORY = gql`
  mutation DeleteStory($storyId: ID!) {
    deleteStory(storyId: $storyId) {
      success
    }
  }
`;

// Notification mutations
export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead {
      count
    }
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id) {
      success
    }
  }
`;

// Settings mutations
export const UPDATE_USER_SETTINGS = gql`
  mutation UpdateUserSettings($input: UpdateSettingsInput!) {
    updateSettings(input: $input) {
      id
      settings {
        notifications {
          messages
          meetups
          bubbles
          push
          email
        }
        privacy {
          locationSharing
          profileVisibility
          ghostMode
        }
        preferences {
          language
          timezone
          theme
        }
      }
      updatedAt
    }
  }
`;

// Admin mutations (for future use)
export const BAN_USER = gql`
  mutation BanUser($userId: ID!, $reason: String!) {
    banUser(userId: $userId, reason: $reason) {
      id
      banned
      banReason
    }
  }
`;

export const REPORT_CONTENT = gql`
  mutation ReportContent($input: ReportContentInput!) {
    reportContent(input: $input) {
      id
      status
      createdAt
    }
  }
`;