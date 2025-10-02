export const generateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2, 10);
  const timestamp = Date.now().toString(16);
  return `id-${timestamp}-${random}`;
};
