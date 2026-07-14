export const validator = {
  /**
   * Validates if a string is a valid component custom ID within limits.
   * Format: namespace:action|payload
   */
  isValidCustomId(customId: unknown): customId is string {
    if (typeof customId !== 'string') return false;
    if (customId.length > 100) return false;
    const pattern = /^[a-z0-9_-]+:[a-z0-9_-]+(?:\|.*)?$/i;
    return pattern.test(customId);
  },

  /**
   * Validates if a string is a valid HTTP/HTTPS URL.
   */
  isValidUrl(url: unknown): url is string {
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Validates if a value is a valid finite number within a range.
   */
  isValidNumber(val: unknown, min: number = -Infinity, max: number = Infinity): boolean {
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
  },

  /**
   * Validates user input string length and content.
   */
  validateString(str: unknown, minLen: number = 1, maxLen: number = 2000): str is string {
    if (typeof str !== 'string') return false;
    const len = str.trim().length;
    return len >= minLen && len <= maxLen;
  }
};
