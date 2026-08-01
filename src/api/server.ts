import express from 'express';
import cors from 'cors';
import { db } from '../state/db.js';
import { logger } from '../utils/logger.js';
import type { VeluClient } from '../types/index.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoints for Render / cloud monitoring
app.get(['/', '/healthz', '/ping'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), bot: 'Velu', timestamp: new Date().toISOString() });
});

export function startApiServer(client: VeluClient, port: number = 3001) {
  // Public Bot Stats
  app.get('/api/stats', (_req, res) => {
    res.json({
      servers: client.guilds.cache.size,
      users: client.users.cache.size,
      commands: client.commands.size,
      uptime: process.uptime(),
      ping: client.ws.ping
    });
  });

  // Get Server Config
  app.get('/api/guilds/:id/config', (req, res) => {
    const guildId = req.params.id;
    if (!client.guilds.cache.has(guildId)) {
       res.status(404).json({ error: 'Bot is not in this server' });
       return;
    }
    const config = db.getConfig(guildId);
    res.json(config);
  });

  // Update Server Config
  app.post('/api/guilds/:id/config', (req, res) => {
    const guildId = req.params.id;
    const body = req.body;
    
    if (!client.guilds.cache.has(guildId)) {
      res.status(404).json({ error: 'Bot is not in this server' });
      return;
    }

    try {
      const config = db.getConfig(guildId);
      
      // Update fields
      if (body.welcomeEnabled !== undefined) db.updateConfig(guildId, 'welcomeEnabled', body.welcomeEnabled);
      if (body.welcomeMessage !== undefined) db.updateConfig(guildId, 'welcomeMessage', body.welcomeMessage);
      if (body.goodbyeEnabled !== undefined) db.updateConfig(guildId, 'goodbyeEnabled', body.goodbyeEnabled);
      if (body.goodbyeMessage !== undefined) db.updateConfig(guildId, 'goodbyeMessage', body.goodbyeMessage);
      
      res.json(db.getConfig(guildId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get Economy Leaderboard for Server
  app.get('/api/guilds/:id/leaderboard', (req, res) => {
    const guildId = req.params.id;
    const users = db.getAllEconomy(guildId);
    
    // Sort by level/xp
    users.sort((a, b) => b.xp - a.xp);
    
    // Map with discord username (if cached)
    const enriched = users.slice(0, 10).map(u => {
      const userCache = client.users.cache.get(u.userId);
      return {
        ...u,
        username: userCache?.username || 'Unknown User',
        avatar: userCache?.displayAvatarURL() || null
      };
    });

    res.json(enriched);
  });

  app.listen(port, () => {
    logger.info(`🌐 Velu API Server running on http://localhost:${port}`);

    // ── Self-Ping Keep-Alive (prevents Render free-tier 15-min sleep) ──
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    const fallbackUrl = 'https://velu-bot.onrender.com';
    const keepAliveUrl = renderUrl || fallbackUrl;
    
    // Activate keep-alive in production / when running on cloud hosts
    if (process.env.PORT || process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === 'production') {
      // Ping every 3 minutes (well below Render's 15-minute sleep threshold)
      const PING_INTERVAL_MS = 3 * 60 * 1000;
      
      setInterval(() => {
        const targetUrl = `${keepAliveUrl}/healthz`;
        fetch(targetUrl)
          .then(res => {
            if (res.ok) {
              logger.debug(`🔄 Keep-alive ping successful to ${targetUrl}`);
            } else {
              logger.warn(`Keep-alive ping returned status ${res.status}`);
            }
          })
          .catch(err => {
            logger.warn(`Keep-alive ping error to ${targetUrl}: ${err.message || err}`);
          });
      }, PING_INTERVAL_MS);
      
      logger.info(`🔄 24/7 Uptime Keep-Alive active: pinging ${keepAliveUrl}/healthz every 3 minutes`);
    }
  });
}
