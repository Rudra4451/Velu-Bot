export const validator = {
  /**
   * Validates if a string is a valid component custom ID within limits
   * Format: namespace:action|payload
   */
  isValidCustomId(customId) {
    if (typeof customId !== 'string') return false;
    if (customId.length > 100) return false;
    
    // Namespace:action|payload pattern
    const pattern = /^[a-z0-9_-]+:[a-z0-9_-]+(?:\|.*)?$/i;
    return pattern.test(customId);
  },

  /**
   * Validates if a string is a valid HTTP/HTTPS URL
   */
  isValidUrl(url) {
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Validates if a value is a valid finite number within a range
   */
  isValidNumber(val, min = -Infinity, max = Infinity) {
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
  },

  /**
   * Validates user input string length and content
   */
  validateString(str, minLen = 1, maxLen = 2000) {
    if (typeof str !== 'string') return false;
    const len = str.trim().length;
    return len >= minLen && len <= maxLen;
  }
};
