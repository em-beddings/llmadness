const NAMED_CONFIDENCE_MAP: Record<string, number> = {
  "very low": 0.52,
  low: 0.58,
  medium: 0.68,
  moderate: 0.68,
  high: 0.82,
  "very high": 0.93
};

export function normalizeConfidenceValue(value: unknown) {
  if (typeof value === "number") {
    if (value > 1 && value <= 100) {
      return value / 100;
    }

    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const normalizedLabel = trimmed.toLowerCase();
    if (normalizedLabel in NAMED_CONFIDENCE_MAP) {
      return NAMED_CONFIDENCE_MAP[normalizedLabel];
    }

    const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
      return Number(percentMatch[1]) / 100;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
    }
  }

  return value;
}
