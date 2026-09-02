// Data source and confidence tracking for AI

export type DataSource = "verified" | "imported" | "estimated" | "inferred" | "calculated" | "predicted";

export type ConfidenceLevel = "high" | "medium" | "low" | "very-low";

export type DataRecord<T> = {
  id: string;
  data: T;
  source: DataSource;
  confidence: ConfidenceLevel;
  reasoning: string;
  verificationDate?: string;
  lastUpdated: string;
  metadata?: Record<string, unknown>;
};

// Confidence thresholds (0-100)
export const CONFIDENCE_THRESHOLDS = {
  high: { min: 80, max: 100 },
  medium: { min: 50, max: 79 },
  low: { min: 20, max: 49 },
  "very-low": { min: 0, max: 19 },
};

// Determine confidence level from score
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high.min) return "high";
  if (score >= CONFIDENCE_THRESHOLDS.medium.min) return "medium";
  if (score >= CONFIDENCE_THRESHOLDS.low.min) return "low";
  return "very-low";
}

// Create a data record with confidence tracking
export function createDataRecord<T>(
  data: T,
  source: DataSource,
  confidenceScore: number,
  reasoning: string,
  metadata?: Record<string, unknown>
): DataRecord<T> {
  return {
    id: `dr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    data,
    source,
    confidence: getConfidenceLevel(confidenceScore),
    reasoning,
    lastUpdated: new Date().toISOString(),
    metadata,
  };
}

// AI message builder with confidence
export type AIMessageWithConfidence = {
  message: string;
  confidence: ConfidenceLevel;
  reasoning: string;
  source: DataSource;
};

// High confidence message
export function highConfidenceMessage(
  message: string,
  reasoning: string,
  source: DataSource
): AIMessageWithConfidence {
  return {
    message,
    confidence: "high",
    reasoning,
    source,
  };
}

// Medium confidence message
export function mediumConfidenceMessage(
  message: string,
  reasoning: string,
  source: DataSource
): AIMessageWithConfidence {
  return {
    message,
    confidence: "medium",
    reasoning,
    source,
  };
}

// Low confidence message (should avoid predictions)
export function lowConfidenceMessage(
  message: string,
  reasoning: string,
  source: DataSource
): AIMessageWithConfidence {
  return {
    message,
    confidence: "low",
    reasoning,
    source,
  };
}

// Format confidence message for user display
export function formatConfidenceMessage(msg: AIMessageWithConfidence): string {
  const confidenceText: Record<ConfidenceLevel, string> = {
    high: "This is based on confirmed data:",
    medium: "This is an interpretation based on recent data:",
    low: "There is limited data available:",
    "very-low": "This prediction is unreliable:",
  };

  return `${confidenceText[msg.confidence]} ${msg.message}`;
}

// Ensure predictions don't overwrite verified data
export function canUpdateRecord<T>(
  existingRecord: DataRecord<T>,
  newRecord: DataRecord<T>
): boolean {
  // Verified records cannot be overwritten by inferred or predicted data
  if (
    existingRecord.source === "verified" &&
    (newRecord.source === "inferred" || newRecord.source === "predicted")
  ) {
    return false;
  }

  // Calculated values can only be updated by new calculations
  if (existingRecord.source === "calculated" && newRecord.source === "predicted") {
    return false;
  }

  return true;
}

// Store separate predicted vs actual values
export type PredictedValue<T> = {
  predicted: T;
  predictedAt: string;
  confidence: ConfidenceLevel;
  reasoning: string;
};

export type ActualValue<T> = {
  actual: T;
  verifiedAt: string;
};

export type DualRecord<T> = {
  id: string;
  predicted?: PredictedValue<T>;
  actual?: ActualValue<T>;
  lastUpdated: string;
};

// Create a dual record for tracking both predicted and actual values
export function createDualRecord<T>(
  predicted?: T,
  actual?: T,
  predictedReasoning?: string
): DualRecord<T> {
  return {
    id: `dr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    predicted: predicted
      ? {
          predicted,
          predictedAt: new Date().toISOString(),
          confidence: "medium",
          reasoning: predictedReasoning || "No reasoning provided",
        }
      : undefined,
    actual: actual
      ? {
          actual,
          verifiedAt: new Date().toISOString(),
        }
      : undefined,
    lastUpdated: new Date().toISOString(),
  };
}

// Example: Payment prediction vs actual
export function predictPaymentDate(
  daysToPayment: number,
  historicalAccuracy: number
): AIMessageWithConfidence {
  if (historicalAccuracy < 30) {
    return lowConfidenceMessage(
      "There is not enough historical data to reliably predict payment timing.",
      "Only a few payment records in history",
      "predicted"
    );
  }

  if (historicalAccuracy > 75) {
    return highConfidenceMessage(
      `Based on payment history, this invoice will likely be paid in ${daysToPayment} days.`,
      "Confirmed payment patterns from ${historicalAccuracy}% of recent invoices",
      "predicted"
    );
  }

  return mediumConfidenceMessage(
    `Estimated payment in ${daysToPayment} days, but payment timing varies.`,
    `Confidence based on ${historicalAccuracy}% accuracy from payment history`,
    "predicted"
  );
}

// Data validation before update
export function validateDataUpdate<T>(
  oldValue: DataRecord<T>,
  newValue: DataRecord<T>
): {
  allowed: boolean;
  reason?: string;
} {
  // Prevent predicted data from overwriting verified data
  if (oldValue.source === "verified" && newValue.source === "predicted") {
    return {
      allowed: false,
      reason:
        "Cannot overwrite verified records with predicted values. Store separately.",
    };
  }

  // Prevent inferred data from overwriting verified data
  if (oldValue.source === "verified" && newValue.source === "inferred") {
    return {
      allowed: false,
      reason: "Cannot overwrite verified records with inferred values. Store separately.",
    };
  }

  return { allowed: true };
}
