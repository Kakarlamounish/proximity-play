import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

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
  private model: use.UniversalSentenceEncoder | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await tf.ready();
      this.model = await use.load();
      this.isInitialized = true;
      console.log('Recommendation engine initialized');
    } catch (error) {
      console.error('Failed to initialize recommendation engine:', error);
      throw error;
    }
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const embeddings = await this.model.embed(texts);
    return embeddings.arraySync() as number[][];
  }

  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (normA * normB);
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
    if (!this.isInitialized) {
      await this.initialize();
    }

    const recommendations: RecommendationResult[] = [];

    // Create user interest text for embedding
    const userInterestsText = userProfile.interests.join(' ') + (userProfile.bio || '');

    // Get embeddings for user interests and bubble descriptions
    const texts = [userInterestsText, ...availableBubbles.map(b => `${b.name} ${b.description} ${b.interest_tag}`)];
    const embeddings = await this.getEmbeddings(texts);

    const userEmbedding = embeddings[0];
    const bubbleEmbeddings = embeddings.slice(1);

    for (let i = 0; i < availableBubbles.length; i++) {
      const bubble = availableBubbles[i];
      const bubbleEmbedding = bubbleEmbeddings[i];

      let score = 0;
      const reasons: string[] = [];

      // Interest similarity (weighted heavily)
      const interestSimilarity = this.calculateCosineSimilarity(userEmbedding, bubbleEmbedding);
      score += interestSimilarity * 0.6;
      reasons.push(`Interest match: ${(interestSimilarity * 100).toFixed(1)}%`);

      // Location proximity (if user location available)
      if (userLocation && bubble.latitude && bubble.longitude) {
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          bubble.latitude,
          bubble.longitude
        );

        // Closer bubbles get higher scores (inverse relationship)
        const proximityScore = Math.max(0, 1 - (distance / 100)); // Max 100km consideration
        score += proximityScore * 0.2;
        reasons.push(`Distance: ${distance.toFixed(1)}km`);
      }

      // Member count preference (medium-sized bubbles preferred)
      const memberScore = Math.min(bubble.member_count / 50, 1) * (1 - Math.min(bubble.member_count / 50, 1));
      score += memberScore * 0.1;
      reasons.push(`${bubble.member_count} members`);

      // Age appropriateness (rough heuristic)
      if (userProfile.age) {
        const ageMatch = bubble.interest_tag.toLowerCase().includes('gaming') ||
                        bubble.interest_tag.toLowerCase().includes('music') ||
                        bubble.interest_tag.toLowerCase().includes('sports') ? 0.1 : 0;
        score += ageMatch;
        if (ageMatch > 0) reasons.push('Age-appropriate content');
      }

      // Direct interest tag match bonus
      const directMatch = userProfile.interests.some(interest =>
        bubble.interest_tag.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(bubble.interest_tag.toLowerCase())
      );
      if (directMatch) {
        score += 0.1;
        reasons.push('Direct interest match');
      }

      recommendations.push({
        bubbleId: bubble.id,
        score: Math.min(score, 1), // Cap at 1.0
        reasons,
      });
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async findSimilarUsers(
    targetUser: UserProfile,
    allUsers: UserProfile[],
    limit: number = 5
  ): Promise<{ userId: string; similarity: number; reasons: string[] }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const similarities: { userId: string; similarity: number; reasons: string[] }[] = [];

    // Create target user text
    const targetText = targetUser.interests.join(' ') + (targetUser.bio || '');

    // Get embeddings for all users
    const texts = [targetText, ...allUsers.map(u => u.interests.join(' ') + (u.bio || ''))];
    const embeddings = await this.getEmbeddings(texts);

    const targetEmbedding = embeddings[0];
    const userEmbeddings = embeddings.slice(1);

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      if (user.id === targetUser.id) continue;

      const userEmbedding = userEmbeddings[i];
      const similarity = this.calculateCosineSimilarity(targetEmbedding, userEmbedding);

      const reasons: string[] = [];

      // Shared interests
      const sharedInterests = targetUser.interests.filter(interest =>
        user.interests.some(userInterest =>
          userInterest.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(userInterest.toLowerCase())
        )
      );

      if (sharedInterests.length > 0) {
        reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
      }

      // Age similarity
      if (targetUser.age && user.age) {
        const ageDiff = Math.abs(targetUser.age - user.age);
        if (ageDiff <= 5) {
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

        if (distance <= 50) { // Within 50km
          reasons.push(`Nearby: ${distance.toFixed(1)}km away`);
        }
      }

      similarities.push({
        userId: user.id,
        similarity,
        reasons,
      });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async analyzeContent(content: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    toxicity: number;
    categories: string[];
    confidence: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Simple rule-based content analysis (in production, use more sophisticated ML models)
    const lowerContent = content.toLowerCase();

    // Sentiment analysis (basic)
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing', 'love', 'like', 'happy', 'excited'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'upset', 'horrible'];

    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';

    // Toxicity detection (basic)
    const toxicWords = ['hate', 'stupid', 'idiot', 'dumb', 'ugly', 'fat', 'ugly', 'disgusting'];
    const toxicity = toxicWords.filter(word => lowerContent.includes(word)).length / toxicWords.length;

    // Content categorization
    const categories: string[] = [];
    if (lowerContent.includes('music') || lowerContent.includes('song') || lowerContent.includes('band')) {
      categories.push('music');
    }
    if (lowerContent.includes('sport') || lowerContent.includes('game') || lowerContent.includes('play')) {
      categories.push('sports');
    }
    if (lowerContent.includes('food') || lowerContent.includes('eat') || lowerContent.includes('cook')) {
      categories.push('food');
    }
    if (lowerContent.includes('tech') || lowerContent.includes('code') || lowerContent.includes('programming')) {
      categories.push('technology');
    }

    return {
      sentiment,
      toxicity,
      categories,
      confidence: 0.7, // Placeholder confidence score
    };
  }

  async generateContentSuggestions(userProfile: UserProfile): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const suggestions: string[] = [];

    // Interest-based suggestions
    if (userProfile.interests.includes('music')) {
      suggestions.push('Share your favorite playlist');
      suggestions.push('Recommend a new artist you discovered');
      suggestions.push('Ask others about concert experiences');
    }

    if (userProfile.interests.includes('sports')) {
      suggestions.push('Share your favorite sports team');
      suggestions.push('Ask about local sports events');
      suggestions.push('Discuss recent game highlights');
    }

    if (userProfile.interests.includes('technology')) {
      suggestions.push('Share a cool coding project');
      suggestions.push('Ask about favorite programming languages');
      suggestions.push('Discuss latest tech news');
    }

    if (userProfile.interests.includes('food')) {
      suggestions.push('Share a recipe you love');
      suggestions.push('Ask for restaurant recommendations');
      suggestions.push('Discuss cooking techniques');
    }

    // Location-based suggestions
    if (userProfile.location) {
      suggestions.push('Ask about local events happening nearby');
      suggestions.push('Share your favorite local spots');
    }

    // Age-based suggestions
    if (userProfile.age && userProfile.age < 25) {
      suggestions.push('Connect with others your age for study groups');
      suggestions.push('Share college or school experiences');
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }
}

// Singleton instance
export const recommendationEngine = new RecommendationEngine();