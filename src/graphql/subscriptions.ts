import { gql } from '@apollo/client';

// Real-time message subscriptions
export const MESSAGE_ADDED = gql`
  subscription MessageAdded($bubbleId: ID!) {
    messageAdded(bubbleId: $bubbleId) {
      id
      content
      messageType
      author {
        id
        firstName
        profilePhotoUrl
      }
      replyTo {
        id
        content
        author {
          firstName
        }
      }
      reactions {
        emoji
        count
        users {
          id
          firstName
        }
      }
      createdAt
    }
  }
`;

export const MESSAGE_UPDATED = gql`
  subscription MessageUpdated($bubbleId: ID!) {
    messageUpdated(bubbleId: $bubbleId) {
      id
      content
      updatedAt
    }
  }
`;

export const MESSAGE_DELETED = gql`
  subscription MessageDeleted($bubbleId: ID!) {
    messageDeleted(bubbleId: $bubbleId) {
      id
    }
  }
`;

export const MESSAGE_REACTION_ADDED = gql`
  subscription MessageReactionAdded($bubbleId: ID!) {
    messageReactionAdded(bubbleId: $bubbleId) {
      messageId
      reaction {
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

// User presence and status subscriptions
export const USER_ONLINE_STATUS = gql`
  subscription UserOnlineStatus($userIds: [ID!]!) {
    userOnlineStatus(userIds: $userIds) {
      userId
      isOnline
      lastActive
    }
  }
`;

export const USER_LOCATION_UPDATED = gql`
  subscription UserLocationUpdated($bubbleId: ID) {
    userLocationUpdated(bubbleId: $bubbleId) {
      userId
      location {
        latitude
        longitude
      }
      timestamp
    }
  }
`;

export const USER_STATUS_UPDATED = gql`
  subscription UserStatusUpdated($bubbleId: ID) {
    userStatusUpdated(bubbleId: $bubbleId) {
      userId
      status
      customStatus
      timestamp
    }
  }
`;

// Bubble subscriptions
export const BUBBLE_MEMBER_JOINED = gql`
  subscription BubbleMemberJoined($bubbleId: ID!) {
    bubbleMemberJoined(bubbleId: $bubbleId) {
      bubbleId
      member {
        id
        firstName
        profilePhotoUrl
      }
      joinedAt
    }
  }
`;

export const BUBBLE_MEMBER_LEFT = gql`
  subscription BubbleMemberLeft($bubbleId: ID!) {
    bubbleMemberLeft(bubbleId: $bubbleId) {
      bubbleId
      memberId
      leftAt
    }
  }
`;

export const BUBBLE_UPDATED = gql`
  subscription BubbleUpdated($bubbleId: ID!) {
    bubbleUpdated(bubbleId: $bubbleId) {
      id
      name
      description
      interestTag
      memberCount
      updatedAt
    }
  }
`;

// Friend request subscriptions
export const FRIEND_REQUEST_RECEIVED = gql`
  subscription FriendRequestReceived {
    friendRequestReceived {
      id
      from {
        id
        firstName
        profilePhotoUrl
      }
      createdAt
    }
  }
`;

export const FRIEND_REQUEST_ACCEPTED = gql`
  subscription FriendRequestAccepted {
    friendRequestAccepted {
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

// Notification subscriptions
export const NOTIFICATION_RECEIVED = gql`
  subscription NotificationReceived {
    notificationReceived {
      id
      type
      title
      message
      data
      createdAt
    }
  }
`;

// Story subscriptions
export const STORY_ADDED = gql`
  subscription StoryAdded($userIds: [ID!]) {
    storyAdded(userIds: $userIds) {
      id
      content
      mediaUrl
      mediaType
      author {
        id
        firstName
        profilePhotoUrl
      }
      location {
        latitude
        longitude
      }
      expiresAt
      createdAt
    }
  }
`;

export const STORY_VIEWED = gql`
  subscription StoryViewed($storyId: ID!) {
    storyViewed(storyId: $storyId) {
      storyId
      viewer {
        id
        firstName
      }
      viewedAt
    }
  }
`;

// Live activity subscriptions
export const LIVE_ACTIVITY_FEED = gql`
  subscription LiveActivityFeed($bubbleId: ID) {
    liveActivityFeed(bubbleId: $bubbleId) {
      id
      type
      user {
        id
        firstName
        profilePhotoUrl
      }
      action
      target
      metadata
      timestamp
    }
  }
`;

// Typing indicators
export const USER_TYPING = gql`
  subscription UserTyping($bubbleId: ID!) {
    userTyping(bubbleId: $bubbleId) {
      userId
      user {
        firstName
      }
      isTyping
      timestamp
    }
  }
`;

// Real-time analytics subscriptions
export const ANALYTICS_UPDATED = gql`
  subscription AnalyticsUpdated {
    analyticsUpdated {
      type
      data
      timestamp
    }
  }
`;

// Emergency and safety subscriptions
export const EMERGENCY_ALERT = gql`
  subscription EmergencyAlert($bubbleId: ID) {
    emergencyAlert(bubbleId: $bubbleId) {
      id
      type
      user {
        id
        firstName
        profilePhotoUrl
      }
      location {
        latitude
        longitude
      }
      message
      severity
      timestamp
    }
  }
`;

// Geofencing subscriptions
export const GEOFENCE_TRIGGERED = gql`
  subscription GeofenceTriggered($bubbleId: ID!) {
    geofenceTriggered(bubbleId: $bubbleId) {
      userId
      geofenceId
      action
      location {
        latitude
        longitude
      }
      timestamp
    }
  }
`;

// Badge and achievement subscriptions
export const BADGE_EARNED = gql`
  subscription BadgeEarned {
    badgeEarned {
      userId
      badge {
        id
        name
        description
        icon
      }
      earnedAt
    }
  }
`;

// System maintenance subscriptions
export const SYSTEM_MAINTENANCE = gql`
  subscription SystemMaintenance {
    systemMaintenance {
      type
      message
      estimatedDowntime
      timestamp
    }
  }
`;