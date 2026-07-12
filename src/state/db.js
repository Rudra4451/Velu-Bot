// In-memory data store for Zero-Persistence Configurations
const configs = new Map();
const warnings = new Map();
const afkStates = new Map();
const permissions = new Map();

export const db = {
  // --- CONFIG SYSTEM ---
  getConfig(guildId) {
    if (!configs.has(guildId)) {
      configs.set(guildId, {
        welcomeEnabled: false,
        welcomeChannel: null,
        welcomeMessage: 'Welcome {member} to the server!',
        welcomeAutoRole: null,
        goodbyeEnabled: false,
        goodbyeChannel: null,
        logEnabled: false,
        logChannel: null,
      });
    }
    return configs.get(guildId);
  },

  updateConfig(guildId, key, value) {
    const config = this.getConfig(guildId);
    config[key] = value;
    configs.set(guildId, config);
    return config;
  },

  resetConfig(guildId) {
    configs.delete(guildId);
    return this.getConfig(guildId);
  },

  // --- WARNING SYSTEM ---
  getWarnings(guildId, userId) {
    const guildWarns = warnings.get(guildId);
    if (!guildWarns) return [];
    return guildWarns.get(userId) || [];
  },

  addWarning(guildId, userId, moderatorId, reason) {
    if (!warnings.has(guildId)) {
      warnings.set(guildId, new Map());
    }
    const guildWarns = warnings.get(guildId);
    if (!guildWarns.has(userId)) {
      guildWarns.set(userId, []);
    }
    const userWarns = guildWarns.get(userId);
    const newWarn = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      moderatorId,
      reason,
      timestamp: Date.now()
    };
    userWarns.push(newWarn);
    return newWarn;
  },

  clearWarnings(guildId, userId) {
    const guildWarns = warnings.get(guildId);
    if (!guildWarns) return 0;
    const count = guildWarns.get(userId)?.length || 0;
    guildWarns.delete(userId);
    return count;
  },

  // --- AFK SYSTEM ---
  getAFK(userId) {
    return afkStates.get(userId) || null;
  },

  setAFK(userId, reason, gifUrl) {
    const afkData = {
      reason: reason || 'AFK',
      gifUrl: gifUrl || null,
      timestamp: Date.now()
    };
    afkStates.set(userId, afkData);
    return afkData;
  },

  clearAFK(userId) {
    const wasAFK = afkStates.has(userId);
    afkStates.delete(userId);
    return wasAFK;
  },

  // --- PERMISSION SYSTEM ---
  getPermissions(guildId, target) {
    const guildPerms = permissions.get(guildId);
    if (!guildPerms) return [];
    return guildPerms.get(target.toLowerCase()) || [];
  },

  getAllPermissions(guildId) {
    return permissions.get(guildId) || new Map();
  },

  addPermission(guildId, target, roleId) {
    if (!permissions.has(guildId)) {
      permissions.set(guildId, new Map());
    }
    const guildPerms = permissions.get(guildId);
    const normalizedTarget = target.toLowerCase();
    if (!guildPerms.has(normalizedTarget)) {
      guildPerms.set(normalizedTarget, []);
    }
    const roles = guildPerms.get(normalizedTarget);
    if (!roles.includes(roleId)) {
      roles.push(roleId);
    }
    return roles;
  },

  removePermission(guildId, target, roleId) {
    const guildPerms = permissions.get(guildId);
    if (!guildPerms) return [];
    const normalizedTarget = target.toLowerCase();
    const roles = guildPerms.get(normalizedTarget);
    if (!roles) return [];
    const index = roles.indexOf(roleId);
    if (index !== -1) {
      roles.splice(index, 1);
    }
    return roles;
  },

  resetPermissions(guildId) {
    permissions.delete(guildId);
  }
};
