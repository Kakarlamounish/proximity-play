import { gql } from '@apollo/client';

// User queries
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      firstName
      lastName
      profilePhotoUrl
      bio
      interests
      age
      location {
        latitude
        longitude
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_USER_PROFILE = gql`
  query GetUserProfile($userId: ID!) {
    user(id: $userId) {
      id
      firstName
      lastName
      profilePhotoUrl
      bio
      interests
      age
      location {
        latitude
        longitude
      }
      badges {
        id
        name
        description
        icon
        earnedAt
      }
      bubbles {
        id
        name
        interestTag
        memberCount
        joinedAt
      }
      stats {
        totalBubbles
        totalMessages
        totalFriends
        totalBadges
      }
      createdAt
      lastActive
    }
  }
`;

// Bubble queries
export const GET_BUBBLES = gql`
  query GetBubbles($first: Int, $after: String, $filter: BubbleFilter) {
    bubbles(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
          description
          interestTag
          memberCount
          maxMembers
          isPrivate
          latitude
          longitude
          creator {
            id
            firstName
            profilePhotoUrl
          }
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_BUBBLE_DETAILS = gql`
  query GetBubbleDetails($id: ID!) {
    bubble(id: $id) {
      id
      name
      description
      interestTag
      memberCount
      maxMembers
      isPrivate
      latitude
      longitude
      creator {
        id
        firstName
        profilePhotoUrl
      }
      members(first: 50) {
        edges {
          node {
            id
            firstName
            profilePhotoUrl
            role
            joinedAt
          }
        }
      }
      messages(first: 50) {
        edges {
          node {
            id
            content
            author {
              id
              firstName
              profilePhotoUrl
            }
            createdAt
            updatedAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
      createdAt
      updatedAt
    }
  }
`;

// Message queries
export const GET_MESSAGES = gql`
  query GetMessages($bubbleId: ID!, $first: Int, $after: String) {
    messages(bubbleId: $bubbleId, first: $first, after: $after) {
      edges {
        node {
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
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Friend queries
export const GET_FRIENDS = gql`
  query GetFriends($first: Int, $after: String) {
    friends(first: $first, after: $after) {
      edges {
        node {
          id
          firstName
          lastName
          profilePhotoUrl
          bio
          interests
          location {
            latitude
            longitude
          }
          lastActive
          friendshipStatus
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_FRIEND_REQUESTS = gql`
  query GetFriendRequests {
    friendRequests {
      sent {
        id
        to {
          id
          firstName
          profilePhotoUrl
        }
        status
        createdAt
      }
      received {
        id
        from {
          id
          firstName
          profilePhotoUrl
        }
        status
        createdAt
      }
    }
  }
`;

// Notification queries
export const GET_NOTIFICATIONS = gql`
  query GetNotifications($first: Int, $after: String) {
    notifications(first: $first, after: $after) {
      edges {
        node {
          id
          type
          title
          message
          data
          read
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Story queries
export const GET_STORIES = gql`
  query GetStories($first: Int, $after: String) {
    stories(first: $first, after: $after) {
      edges {
        node {
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
          views {
            count
            users {
              id
              firstName
            }
          }
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Search queries
export const SEARCH_USERS = gql`
  query SearchUsers($query: String!, $first: Int) {
    searchUsers(query: $query, first: $first) {
      edges {
        node {
          id
          firstName
          lastName
          profilePhotoUrl
          bio
          interests
          location {
            latitude
            longitude
          }
        }
      }
    }
  }
`;

export const SEARCH_BUBBLES = gql`
  query SearchBubbles($query: String!, $first: Int) {
    searchBubbles(query: $query, first: $first) {
      edges {
        node {
          id
          name
          description
          interestTag
          memberCount
          latitude
          longitude
        }
      }
    }
  }
`;

// Analytics queries
export const GET_USER_STATS = gql`
  query GetUserStats {
    userStats {
      totalBubbles
      totalMessages
      totalFriends
      totalBadges
      activeStreaks
      weeklyActivity {
        day
        bubbles
        messages
        friends
      }
      monthlyActivity {
        month
        bubbles
        messages
        friends
      }
    }
  }
`;

export const GET_APP_ANALYTICS = gql`
  query GetAppAnalytics {
    appAnalytics {
      totalUsers
      totalBubbles
      totalMessages
      activeUsers
      growthRate
      popularInterests {
        interest
        count
      }
      geographicDistribution {
        country
        count
      }
    }
  }
`;