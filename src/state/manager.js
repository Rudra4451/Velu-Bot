import crypto from 'crypto';
import { LIMITS } from '../constants/index.js';
import { logger } from '../utils/logger.js';

// In-memory state store: Map<key, { data, expiresAt }>
const memoryStore = new Map();

/**
 * Clean up expired entries in the in-memory store.
 * Run on-demand during create/resolve to avoid background loops.
 */
const cleanupExpiredState = () => {
  const now = Date.now();
  let count = 0;
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.expiresAt) {
      memoryStore.delete(key);
      count++;
    }
  }
  if (count > 0) {
    logger.debug(`Cleaned up ${count} expired state entries. Current size: ${memoryStore.size}`);
  }
};

export const stateManager = {
  /**
   * Creates a state and returns a compliant customId string
   * @param {string} namespace - Namespace (e.g., 'game', 'utility')
   * @param {string} action - Action identifier
   * @param {any} data - State payload
   * @returns {string} - The final Discord custom ID (max 100 chars)
   */
  create(namespace, action, data) {
    cleanupExpiredState();

    const prefix = `${namespace}:${action}`;
    if (data === undefined || data === null) {
      return prefix;
    }

    // Try to serialize for inline storage
    let serialized = '';
    if (typeof data === 'object') {
      try {
        serialized = JSON.stringify(data);
      } catch (err) {
        logger.error('Failed to serialize state data', err);
        serialized = String(data);
      }
    } else {
      serialized = String(data);
    }

    const inlinePayload = `i:${serialized}`;
    const potentialCustomId = `${prefix}|${inlinePayload}`;

    // If it fits within Discord limits comfortably, store inline
    if (potentialCustomId.length <= LIMITS.DISCORD_CUSTOM_ID_LIMIT) {
      return potentialCustomId;
    }

    // Otherwise, store in memory and return a reference key
    const refId = `_m:${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = Date.now() + LIMITS.STATE_TTL_MS;

    memoryStore.set(refId, {
      data,
      expiresAt
    });

    const refCustomId = `${prefix}|${refId}`;
    if (refCustomId.length > LIMITS.DISCORD_CUSTOM_ID_LIMIT) {
      throw new Error(`Custom ID namespace/action is too long: "${prefix}"`);
    }

    return refCustomId;
  },

  /**
   * Resolves the state from a customId
   * @param {string} customId - The Discord custom ID
   * @returns {{ namespace: string, action: string, data: any }} - Parsed state
   */
  resolve(customId) {
    cleanupExpiredState();

    if (typeof customId !== 'string') {
      throw new Error('Invalid customId: must be a string');
    }

    const delimiterIndex = customId.indexOf('|');
    let prefix = customId;
    let payload = null;

    if (delimiterIndex !== -1) {
      prefix = customId.substring(0, delimiterIndex);
      payload = customId.substring(delimiterIndex + 1);
    }

    const colonIndex = prefix.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Malformed customId prefix: "${prefix}"`);
    }

    const namespace = prefix.substring(0, colonIndex);
    const action = prefix.substring(colonIndex + 1);

    if (!payload) {
      return { namespace, action, data: null };
    }

    // Inline payload resolution
    if (payload.startsWith('i:')) {
      const content = payload.substring(2);
      try {
        const parsed = JSON.parse(content);
        return { namespace, action, data: parsed };
      } catch {
        // Return raw string if JSON parsing fails
        return { namespace, action, data: content };
      }
    }

    // Memory store payload resolution
    if (payload.startsWith('_m:')) {
      const record = memoryStore.get(payload);
      if (!record) {
        logger.warn(`Expired or invalid state resolved for customId: ${customId}`);
        return { namespace, action, data: null, expired: true };
      }
      return { namespace, action, data: record.data };
    }

    // Fallback: raw payload
    return { namespace, action, data: payload };
  }
};
