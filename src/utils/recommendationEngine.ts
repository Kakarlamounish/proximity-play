interface UserProfile {
  id: string;
  interests: string[];
  bio?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  age?: number;
}

interface Bubble {
  id: string;
  name: string;
  description: string;
  interest_tag: string;
  member_count: number;
  latitude: number;
  longitude: number;
}

export interface RecommendationResult {
  bubbleId: string;
  score: number;
  reasons: string[];
}

export class RecommendationEngine {
  async initialize(): Promise<void> {
    // No-op since we removed TensorFlow
    console.log('Lightweight recommendation engine initialized');
    return Promise.resolve();
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async recommendBubbles(
    userProfile: UserProfile,
    availableBubbles: Bubble[],
    userLocation?: { latitude: number; longitude: number },
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    const recommendations: RecommendationResult[] = [];

    for (const bubble of availableBubbles) {
      let score = 0;
      const reasons: string[] = [];

      // Direct interest tag match
      const directMatch = userProfile.interests.some(interest =>
        bubble.interest_tag.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(bubble.interest_tag.toLowerCase())
      );

      if (directMatch) {
        score += 0.5;
        reasons.push('Direct interest match');
      }

      // Keyword match in description
      const keywordMatch = userProfile.interests.some(interest => 
        bubble.description.toLowerCase().includes(interest.toLowerCase())
      );

      if (keywordMatch && !directMatch) {
        score += 0.3;
        reasons.push('Related interests');
      }

      // Location proximity
      if (userLocation && bubble.latitude && bubble.longitude) {
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          bubble.latitude,
          bubble.longitude
        );

        const proximityScore = Math.max(0, 1 - (distance / 100)); // Max 100km consideration
        score += proximityScore * 0.3;
        reasons.push(`Distance: ${distance.toFixed(1)}km`);
      }

      // Member count preference
      const memberScore = Math.min(bubble.member_count / 50, 1) * (1 - Math.min(bubble.member_count / 50, 1));
      score += memberScore * 0.1;
      reasons.push(`${bubble.member_count} members`);

      if (score > 0) {
        recommendations.push({
          bubbleId: bubble.id,
          score: Math.min(score, 1),
          reasons,
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async findSimilarUsers(
    targetUser: UserProfile,
    allUsers: UserProfile[],
    limit: number = 5
  ): Promise<{ userId: string; similarity: number; reasons: string[] }[]> {
    const similarities: { userId: string; similarity: number; reasons: string[] }[] = [];

    for (const user of allUsers) {
      if (user.id === targetUser.id) continue;

      let similarity = 0;
      const reasons: string[] = [];

      // Shared interests
      const sharedInterests = targetUser.interests.filter(interest =>
        user.interests.some(userInterest =>
          userInterest.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(userInterest.toLowerCase())
        )
      );

      if (sharedInterests.length > 0) {
        similarity += (sharedInterests.length / Math.max(targetUser.interests.length, 1)) * 0.6;
        reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
      }

      // Age similarity
      if (targetUser.age && user.age) {
        const ageDiff = Math.abs(targetUser.age - user.age);
        if (ageDiff <= 5) {
          similarity += 0.2;
          reasons.push('Similar age');
        }
      }

      // Location proximity
      if (targetUser.location && user.location) {
        const distance = this.calculateDistance(
          targetUser.location.latitude,
          targetUser.location.longitude,
          user.location.latitude,
          user.location.longitude
        );

        if (distance <= 50) {
          similarity += 0.2;
          reasons.push(`Nearby: ${distance.toFixed(1)}km away`);
        }
      }

      if (similarity > 0) {
        similarities.push({
          userId: user.id,
          similarity: Math.min(similarity, 1),
          reasons,
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  async analyzeContent(content: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    toxicity: number;
    categories: string[];
    confidence: number;
  }> {
    // Basic rule-based analysis without ML models
    const lowerContent = content.toLowerCase();

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing', 'love', 'happy'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'upset'];

    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';

    const toxicWords = ['hate', 'stupid', 'idiot', 'dumb', 'ugly', 'fat'];
    const toxicity = toxicWords.filter(word => lowerContent.includes(word)).length / toxicWords.length;

    const categories: string[] = [];
    if (lowerContent.includes('music') || lowerContent.includes('song')) categories.push('music');
    if (lowerContent.includes('sport') || lowerContent.includes('game')) categories.push('sports');
    if (lowerContent.includes('food') || lowerContent.includes('eat')) categories.push('food');
    if (lowerContent.includes('tech') || lowerContent.includes('code')) categories.push('technology');

    return Promise.resolve({
      sentiment,
      toxicity,
      categories,
      confidence: 0.5,
    });
  }

  async generateContentSuggestions(userProfile: UserProfile): Promise<string[]> {
    const suggestions: string[] = [];

    if (userProfile.interests.includes('music')) suggestions.push('Share your favorite playlist');
    if (userProfile.interests.includes('sports')) suggestions.push('Discuss recent game highlights');
    if (userProfile.interests.includes('technology')) suggestions.push('Share a cool coding project');
    if (userProfile.interests.includes('food')) suggestions.push('Share a recipe you love');

    if (userProfile.location) suggestions.push('Ask about local events happening nearby');
    if (userProfile.age && userProfile.age < 25) suggestions.push('Share college or school experiences');

    if (suggestions.length === 0) suggestions.push('Say hi to the community!');

    return Promise.resolve(suggestions.slice(0, 5));
  }
}

export const recommendationEngine = new RecommendationEngine();