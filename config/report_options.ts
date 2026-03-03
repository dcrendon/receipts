const normalizeUsername = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const parseAttributionUsername = (value?: string): string | undefined =>
  normalizeUsername(value);
