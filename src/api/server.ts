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

// Public Terms of Service endpoint for Discord Developer Portal
app.get('/terms', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><title>Velu Bot — Terms of Service</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F0F1A; color: #EEEEEE; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        h1 { color: #8A2BE2; } h2 { color: #00F5D4; margin-top: 30px; }
        a { color: #00B4D8; }
      </style>
    </head>
    <body>
      <h1>Terms of Service — Velu Bot</h1>
      <p>Last updated: August 2026</p>
      <h2>1. Agreement to Terms</h2>
      <p>By inviting or using Velu Bot in your Discord server, you agree to comply with these Terms of Service and Discord's Terms of Service.</p>
      <h2>2. Bot Usage</h2>
      <p>Velu provides high-performance music playback, moderation, and server utility commands. Abuse, automated spamming, or exploitation of the bot is prohibited.</p>
      <h2>3. Availability</h2>
      <p>Velu is provided "as is" with 24/7 uptime. Service may occasionally undergo maintenance or updates.</p>
    </body>
    </html>
  `);
});

// Public Privacy Policy endpoint for Discord Developer Portal
app.get('/privacy', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><title>Velu Bot — Privacy Policy</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F0F1A; color: #EEEEEE; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        h1 { color: #8A2BE2; } h2 { color: #00F5D4; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>Privacy Policy — Velu Bot</h1>
      <p>Last updated: August 2026</p>
      <h2>1. Data We Collect</h2>
      <p>Velu collects minimal data strictly necessary for feature functionality: Discord Guild IDs, User IDs for command preferences, and active music queue state.</p>
      <h2>2. Data Usage</h2>
      <p>Collected data is used solely to store server configuration settings and user preferences. We do NOT sell or share data with third parties.</p>
      <h2>3. Data Deletion</h2>
      <p>Server administrators can request complete data removal by removing the bot from their server or contacting the bot owner.</p>
    </body>
    </html>
  `);
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

  app.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 Velu API Server running on http://0.0.0.0:${port}`);

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
