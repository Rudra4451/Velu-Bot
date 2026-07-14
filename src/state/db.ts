import type { GuildConfig, Warning, AfkData, UserEconomy } from '../types/index.js';
import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

// In-memory data store for configurations (cache layer)
const configs = new Map<string, GuildConfig>();
const warnings = new Map<string, Map<string, Warning[]>>();
const afkStates = new Map<string, AfkData>();
const permissions = new Map<string, Map<string, string[]>>();
const economy = new Map<string, Map<string, UserEconomy>>(); // guildId -> userId -> UserEconomy

export const db = {
  // --- DATABASE INITIALIZATION FROM SUPABASE ---
  async loadFromSupabase(): Promise<void> {
    if (!supabase) {
      logger.info('⚠️ Skipping Supabase data loading: Supabase client is not initialized.');
      return;
    }

    try {
      logger.info('🔄 Loading cached data from Supabase...');

      // 1. Load Guild Configurations
      const { data: configsData, error: configsErr } = await supabase
        .from('guild_configs')
        .select('*');
      if (configsErr) throw configsErr;
      if (configsData) {
        for (const row of configsData) {
          configs.set(row.guild_id, {
            welcomeEnabled: row.welcome_enabled,
            welcomeChannel: row.welcome_channel,
            welcomeMessage: row.welcome_message,
            welcomeAutoRole: row.welcome_auto_role,
            goodbyeEnabled: row.goodbye_enabled,
            goodbyeChannel: row.goodbye_channel,
            goodbyeMessage: row.goodbye_message,
            logEnabled: row.log_enabled,
            logChannel: row.log_channel,
            automodEnabled: row.automod_enabled ?? false,
            automodSpamFilter: row.automod_spam_filter ?? false,
            automodBlockInvites: row.automod_block_invites ?? false,
            automodBadwords: row.automod_badwords ?? false,
            automodBadwordsList: row.automod_badwords_list ?? [],
          });
        }
        logger.info(`✅ Loaded ${configsData.length} guild configurations from Supabase.`);
      }

      // 2. Load Warnings
      const { data: warningsData, error: warningsErr } = await supabase
        .from('warnings')
        .select('*');
      if (warningsErr) throw warningsErr;
      if (warningsData) {
        for (const row of warningsData) {
          if (!warnings.has(row.guild_id)) {
            warnings.set(row.guild_id, new Map());
          }
          const guildWarns = warnings.get(row.guild_id)!;
          if (!guildWarns.has(row.user_id)) {
            guildWarns.set(row.user_id, []);
          }
          guildWarns.get(row.user_id)!.push({
            id: row.id,
            moderatorId: row.moderator_id,
            reason: row.reason,
            timestamp: Number(row.timestamp),
          });
        }
        logger.info(`✅ Loaded ${warningsData.length} warnings from Supabase.`);
      }

      // 3. Load AFK States
      const { data: afkData, error: afkErr } = await supabase
        .from('afk_states')
        .select('*');
      if (afkErr) throw afkErr;
      if (afkData) {
        for (const row of afkData) {
          afkStates.set(row.user_id, {
            reason: row.reason,
            gifUrl: row.gif_url,
            timestamp: Number(row.timestamp),
          });
        }
        logger.info(`✅ Loaded ${afkData.length} AFK states from Supabase.`);
      }

      // 4. Load Permissions
      const { data: permsData, error: permsErr } = await supabase
        .from('permissions')
        .select('*');
      if (permsErr) throw permsErr;
      if (permsData) {
        for (const row of permsData) {
          if (!permissions.has(row.guild_id)) {
            permissions.set(row.guild_id, new Map());
          }
          const guildPerms = permissions.get(row.guild_id)!;
          const normalizedTarget = row.target.toLowerCase();
          if (!guildPerms.has(normalizedTarget)) {
            guildPerms.set(normalizedTarget, []);
          }
          guildPerms.get(normalizedTarget)!.push(row.role_id);
        }
        logger.info(`✅ Loaded ${permsData.length} permission roles from Supabase.`);
      }

      // 5. Load Economy
      const { data: ecoData, error: ecoErr } = await supabase
        .from('economy')
        .select('*');
      if (ecoErr) throw ecoErr;
      if (ecoData) {
        for (const row of ecoData) {
          if (!economy.has(row.guild_id)) {
            economy.set(row.guild_id, new Map());
          }
          const guildEco = economy.get(row.guild_id)!;
          guildEco.set(row.user_id, {
            userId: row.user_id,
            xp: row.xp,
            level: row.level,
            coins: row.coins,
            lastDaily: Number(row.last_daily),
            lastMessageTime: Number(row.last_message_time),
          });
        }
        logger.info(`✅ Loaded ${ecoData.length} economy profiles from Supabase.`);
      }

      logger.info('🎉 Database cached from Supabase successfully.');
    } catch (err: any) {
      logger.error('❌ Error loading data from Supabase:', err);
    }
  },

  // --- CONFIG SYSTEM ---
  getConfig(guildId: string): GuildConfig {
    if (!configs.has(guildId)) {
      configs.set(guildId, {
        welcomeEnabled: false,
        welcomeChannel: null,
        welcomeMessage: 'Welcome {member} to the server!',
        welcomeAutoRole: null,
        goodbyeEnabled: false,
        goodbyeChannel: null,
        goodbyeMessage: "Farewell {member}! ☁️\nWe hope you had a good time in **{server}**... you will be missed! 🕊️",
        logEnabled: false,
        logChannel: null,
        automodEnabled: false,
        automodSpamFilter: false,
        automodBlockInvites: false,
        automodBadwords: false,
        automodBadwordsList: [],
      });
    }
    return configs.get(guildId)!;
  },

  updateConfig<K extends keyof GuildConfig>(guildId: string, key: K, value: GuildConfig[K]): GuildConfig {
    const config = this.getConfig(guildId);
    config[key] = value;
    configs.set(guildId, config);

    // Sync to Supabase in background
    if (supabase) {
      supabase
        .from('guild_configs')
        .upsert({
          guild_id: guildId,
          welcome_enabled: config.welcomeEnabled,
          welcome_channel: config.welcomeChannel,
          welcome_message: config.welcomeMessage,
          welcome_auto_role: config.welcomeAutoRole,
          goodbye_enabled: config.goodbyeEnabled,
          goodbye_channel: config.goodbyeChannel,
          goodbye_message: config.goodbyeMessage,
          log_enabled: config.logEnabled,
          log_channel: config.logChannel,
          automod_enabled: config.automodEnabled,
          automod_spam_filter: config.automodSpamFilter,
          automod_block_invites: config.automodBlockInvites,
          automod_badwords: config.automodBadwords,
          automod_badwords_list: config.automodBadwordsList,
        })
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to sync config update for guild ${guildId} to Supabase:`, error);
          }
        });
    }

    return config;
  },

  resetConfig(guildId: string): GuildConfig {
    configs.delete(guildId);
    const config = this.getConfig(guildId);

    // Sync to Supabase in background (delete database row to free space)
    if (supabase) {
      supabase
        .from('guild_configs')
        .delete()
        .eq('guild_id', guildId)
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to delete config for guild ${guildId} from Supabase:`, error);
          }
        });
    }

    return config;
  },

  // --- WARNING SYSTEM ---
  getWarnings(guildId: string, userId: string): Warning[] {
    const guildWarns = warnings.get(guildId);
    if (!guildWarns) return [];
    return guildWarns.get(userId) || [];
  },

  addWarning(guildId: string, userId: string, moderatorId: string, reason: string): Warning {
    if (!warnings.has(guildId)) {
      warnings.set(guildId, new Map());
    }
    const guildWarns = warnings.get(guildId)!;
    if (!guildWarns.has(userId)) {
      guildWarns.set(userId, []);
    }
    const userWarns = guildWarns.get(userId)!;
    const newWarn: Warning = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      moderatorId,
      reason,
      timestamp: Date.now()
    };
    userWarns.push(newWarn);

    // Sync to Supabase in background
    if (supabase) {
      supabase
        .from('warnings')
        .insert({
          id: newWarn.id,
          guild_id: guildId,
          user_id: userId,
          moderator_id: moderatorId,
          reason,
          timestamp: newWarn.timestamp,
        })
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to sync new warning for user ${userId} in guild ${guildId} to Supabase:`, error);
          }
        });
    }

    return newWarn;
  },

  clearWarnings(guildId: string, userId: string): number {
    const guildWarns = warnings.get(guildId);
    if (!guildWarns) return 0;
    const count = guildWarns.get(userId)?.length || 0;
    guildWarns.delete(userId);

    // Sync to Supabase in background (delete warnings to clear space)
    if (supabase) {
      supabase
        .from('warnings')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to clear warnings for user ${userId} in guild ${guildId} from Supabase:`, error);
          }
        });
    }

    return count;
  },

  // --- AFK SYSTEM ---
  getAFK(userId: string): AfkData | null {
    return afkStates.get(userId) || null;
  },

  setAFK(userId: string, reason?: string, gifUrl?: string): AfkData {
    const afkData: AfkData = {
      reason: reason || 'AFK',
      gifUrl: gifUrl || null,
      timestamp: Date.now()
    };
    afkStates.set(userId, afkData);

    // Sync to Supabase in background
    if (supabase) {
      supabase
        .from('afk_states')
        .upsert({
          user_id: userId,
          reason: afkData.reason,
          gif_url: afkData.gifUrl,
          timestamp: afkData.timestamp,
        })
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to sync AFK state for user ${userId} to Supabase:`, error);
          }
        });
    }

    return afkData;
  },

  clearAFK(userId: string): boolean {
    const wasAFK = afkStates.has(userId);
    afkStates.delete(userId);

    // Sync to Supabase in background
    if (supabase && wasAFK) {
      supabase
        .from('afk_states')
        .delete()
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to delete AFK state for user ${userId} from Supabase:`, error);
          }
        });
    }

    return wasAFK;
  },

  // --- PERMISSION SYSTEM ---
  getPermissions(guildId: string, target: string): string[] {
    const guildPerms = permissions.get(guildId);
    if (!guildPerms) return [];
    return guildPerms.get(target.toLowerCase()) || [];
  },

  getAllPermissions(guildId: string): Map<string, string[]> {
    return permissions.get(guildId) || new Map();
  },

  addPermission(guildId: string, target: string, roleId: string): string[] {
    if (!permissions.has(guildId)) {
      permissions.set(guildId, new Map());
    }
    const guildPerms = permissions.get(guildId)!;
    const normalizedTarget = target.toLowerCase();
    if (!guildPerms.has(normalizedTarget)) {
      guildPerms.set(normalizedTarget, []);
    }
    const roles = guildPerms.get(normalizedTarget)!;
    if (!roles.includes(roleId)) {
      roles.push(roleId);

      // Sync to Supabase in background
      if (supabase) {
        supabase
          .from('permissions')
          .upsert({
            guild_id: guildId,
            target: normalizedTarget,
            role_id: roleId,
          })
          .then(({ error }) => {
            if (error) {
              logger.error(`Failed to sync added permission for ${target} in guild ${guildId} to Supabase:`, error);
            }
          });
      }
    }
    return roles;
  },

  removePermission(guildId: string, target: string, roleId: string): string[] {
    const guildPerms = permissions.get(guildId);
    if (!guildPerms) return [];
    const normalizedTarget = target.toLowerCase();
    const roles = guildPerms.get(normalizedTarget);
    if (!roles) return [];
    const index = roles.indexOf(roleId);
    if (index !== -1) {
      roles.splice(index, 1);

      // Sync to Supabase in background
      if (supabase) {
        supabase
          .from('permissions')
          .delete()
          .eq('guild_id', guildId)
          .eq('target', normalizedTarget)
          .eq('role_id', roleId)
          .then(({ error }) => {
            if (error) {
              logger.error(`Failed to sync removed permission for ${target} in guild ${guildId} from Supabase:`, error);
            }
          });
      }
    }
    return roles;
  },

  resetPermissions(guildId: string): void {
    permissions.delete(guildId);

    // Sync to Supabase in background
    if (supabase) {
      supabase
        .from('permissions')
        .delete()
        .eq('guild_id', guildId)
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to reset permissions for guild ${guildId} from Supabase:`, error);
          }
        });
    }
  },

  // --- ECONOMY SYSTEM ---
  getEconomy(guildId: string, userId: string): UserEconomy {
    if (!economy.has(guildId)) {
      economy.set(guildId, new Map());
    }
    const guildEco = economy.get(guildId)!;
    if (!guildEco.has(userId)) {
      guildEco.set(userId, {
        userId,
        xp: 0,
        level: 1,
        coins: 0,
        lastDaily: 0,
        lastMessageTime: 0
      });
    }
    return guildEco.get(userId)!;
  },

  updateEconomy(guildId: string, userId: string, data: Partial<UserEconomy>): UserEconomy {
    const eco = this.getEconomy(guildId, userId);
    Object.assign(eco, data);

    // Sync to Supabase in background
    if (supabase) {
      supabase
        .from('economy')
        .upsert({
          guild_id: guildId,
          user_id: userId,
          xp: eco.xp,
          level: eco.level,
          coins: eco.coins,
          last_daily: eco.lastDaily,
          last_message_time: eco.lastMessageTime,
        })
        .then(({ error }) => {
          if (error) {
            logger.error(`Failed to sync economy update for user ${userId} in guild ${guildId} to Supabase:`, error);
          }
        });
    }

    return eco;
  },

  getAllEconomy(guildId: string): UserEconomy[] {
    const guildEco = economy.get(guildId);
    if (!guildEco) return [];
    return Array.from(guildEco.values());
  }
};
