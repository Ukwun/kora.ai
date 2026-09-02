// AI Feedback Loop System

export type FeedbackType =
  | "useful"
  | "not-useful"
  | "incorrect"
  | "already-completed"
  | "remind-later"
  | "never-suggest-again";

export type RecommendationFeedback = {
  id: string;
  recommendationId: string;
  userId: string;
  organizationId: string;
  feedbackType: FeedbackType;
  comment?: string;
  createdAt: string;
};

export type UserPreference = {
  id: string;
  userId: string;
  organizationId: string;
  recommendationType: string;
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "never";
  lastSuggested?: string;
  feedbackCount: number;
  positiveRating: number; // count of useful/correct feedback
  createdAt: string;
  updatedAt: string;
};

// Store user feedback (in production, store in database)
const feedbackStore: Map<string, RecommendationFeedback[]> = new Map();
const preferenceStore: Map<string, UserPreference[]> = new Map();

// Record feedback for a recommendation
export async function recordFeedback(
  feedback: Omit<RecommendationFeedback, "id" | "createdAt">
): Promise<RecommendationFeedback> {
  const record: RecommendationFeedback = {
    ...feedback,
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  const key = `${feedback.organizationId}_${feedback.userId}`;
  if (!feedbackStore.has(key)) {
    feedbackStore.set(key, []);
  }

  feedbackStore.get(key)!.push(record);

  // Update user preferences based on feedback
  await updatePreferencesFromFeedback(
    feedback.userId,
    feedback.organizationId,
    feedback.recommendationId,
    feedback.feedbackType
  );

  return record;
}

// Get feedback for a recommendation
export function getFeedbackForRecommendation(
  organizationId: string,
  userId: string,
  recommendationId: string
): RecommendationFeedback | undefined {
  const key = `${organizationId}_${userId}`;
  const userFeedback = feedbackStore.get(key) || [];
  return userFeedback.find((f) => f.recommendationId === recommendationId);
}

// Get all feedback for organization
export function getFeedbackForOrganization(
  organizationId: string,
  userId: string
): RecommendationFeedback[] {
  const key = `${organizationId}_${userId}`;
  return feedbackStore.get(key) || [];
}

// Get feedback statistics
export function getFeedbackStats(organizationId: string, userId: string) {
  const feedback = getFeedbackForOrganization(organizationId, userId);

  const stats = {
    total: feedback.length,
    useful: feedback.filter((f) => f.feedbackType === "useful").length,
    notUseful: feedback.filter((f) => f.feedbackType === "not-useful").length,
    incorrect: feedback.filter((f) => f.feedbackType === "incorrect").length,
    alreadyCompleted: feedback.filter((f) => f.feedbackType === "already-completed")
      .length,
    remindLater: feedback.filter((f) => f.feedbackType === "remind-later").length,
    neverSuggestAgain: feedback.filter((f) => f.feedbackType === "never-suggest-again")
      .length,
  };

  const positiveRate = stats.total > 0 ? (stats.useful / stats.total) * 100 : 0;

  return {
    ...stats,
    positiveRate: Math.round(positiveRate),
  };
}

// Update user preferences based on feedback
async function updatePreferencesFromFeedback(
  userId: string,
  organizationId: string,
  recommendationId: string,
  feedbackType: FeedbackType
): Promise<void> {
  const key = `${organizationId}_${userId}`;

  // Extract recommendation type from ID (in production, look up actual recommendation)
  const recType = recommendationId.split("_")[1] || "general";

  let preferences = preferenceStore.get(key) || [];
  let pref = preferences.find((p) => p.recommendationType === recType);

  if (!pref) {
    pref = {
      id: `pref_${Date.now()}`,
      userId,
      organizationId,
      recommendationType: recType,
      enabled: true,
      frequency: "weekly",
      feedbackCount: 0,
      positiveRating: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    preferences.push(pref);
  }

  // Update based on feedback type
  pref.feedbackCount++;
  pref.updatedAt = new Date().toISOString();

  if (feedbackType === "useful" || feedbackType === "already-completed") {
    pref.positiveRating++;
  } else if (feedbackType === "never-suggest-again") {
    pref.enabled = false;
  } else if (feedbackType === "remind-later") {
    pref.lastSuggested = new Date().toISOString();
  }

  preferenceStore.set(key, preferences);
}

// Get user preferences
export function getUserPreferences(
  organizationId: string,
  userId: string
): UserPreference[] {
  const key = `${organizationId}_${userId}`;
  return preferenceStore.get(key) || [];
}

// Should show recommendation based on preferences
export function shouldShowRecommendation(
  organizationId: string,
  userId: string,
  recommendationType: string
): boolean {
  const key = `${organizationId}_${userId}`;
  const preferences = preferenceStore.get(key) || [];
  const pref = preferences.find((p) => p.recommendationType === recommendationType);

  if (!pref) return true; // Show by default if no preference set

  if (!pref.enabled) return false; // User disabled this type

  // Check frequency
  if (pref.lastSuggested) {
    const lastTime = new Date(pref.lastSuggested).getTime();
    const now = Date.now();
    const frequencyMs = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      never: Infinity,
    };

    const nextShowTime = lastTime + frequencyMs[pref.frequency];
    if (now < nextShowTime) {
      return false;
    }
  }

  return true;
}

// Calculate recommendation score based on feedback
export function calculateRecommendationScore(
  organizationId: string,
  userId: string,
  recommendationType: string
): number {
  const key = `${organizationId}_${userId}`;
  const preferences = preferenceStore.get(key) || [];
  const pref = preferences.find((p) => p.recommendationType === recommendationType);

  if (!pref || pref.feedbackCount === 0) return 50; // Default neutral score

  // Score based on positive feedback ratio
  const positiveRatio = (pref.positiveRating / pref.feedbackCount) * 100;

  // Boost score slightly for high feedback count (indicates relevance)
  const feedbackBoost = Math.min(pref.feedbackCount * 2, 10);

  return Math.min(100, positiveRatio + feedbackBoost);
}

// Filter recommendations based on user preferences and scores
export function filterRecommendationsByScore(
  recommendations: Array<{
    id: string;
    category: string;
    title: string;
  }>,
  organizationId: string,
  userId: string,
  minScore: number = 40
): Array<{
  id: string;
  category: string;
  title: string;
  score: number;
}> {
  return recommendations
    .map((rec) => ({
      ...rec,
      score: calculateRecommendationScore(
        organizationId,
        userId,
        rec.category
      ),
    }))
    .filter(
      (rec) =>
        shouldShowRecommendation(organizationId, userId, rec.category) &&
        rec.score >= minScore
    )
    .sort((a, b) => b.score - a.score);
}

// Human-readable feedback message
export function getFeedbackMessage(feedbackType: FeedbackType): string {
  const messages: Record<FeedbackType, string> = {
    useful: "Glad this was helpful!",
    "not-useful": "We'll improve this recommendation.",
    incorrect: "Thank you for the correction.",
    "already-completed": "Great, that's already done!",
    "remind-later": "We'll suggest this again later.",
    "never-suggest-again": "We won't suggest this again.",
  };

  return messages[feedbackType];
}

// Get recommendation reason based on user feedback history
export function getRecommendationReason(
  organizationId: string,
  userId: string,
  recommendationType: string
): string {
  const pref = getUserPreferences(organizationId, userId).find(
    (p) => p.recommendationType === recommendationType
  );

  if (!pref || pref.feedbackCount === 0) {
    return "Based on your business activity";
  }

  const positiveRatio = (pref.positiveRating / pref.feedbackCount) * 100;

  if (positiveRatio > 75) {
    return "This type of recommendation has been helpful for you";
  } else if (positiveRatio > 50) {
    return "Sometimes useful based on your feedback";
  }

  return "Based on your business activity";
}
