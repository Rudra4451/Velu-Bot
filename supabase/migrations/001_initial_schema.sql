-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Guild Configs
CREATE TABLE guild_configs (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_guild_configs_modtime BEFORE UPDATE ON guild_configs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_guild_configs_id ON guild_configs(id);

-- 2. Warnings
CREATE TABLE warnings (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of warning records
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_warnings_modtime BEFORE UPDATE ON warnings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_warnings_id ON warnings(id);

-- 3. Tickets
CREATE TABLE tickets (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_tickets_modtime BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_tickets_id ON tickets(id);

-- 4. Suggestions
CREATE TABLE suggestions (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_suggestions_modtime BEFORE UPDATE ON suggestions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_suggestions_id ON suggestions(id);

-- 5. Reaction Roles
CREATE TABLE reaction_roles (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_reaction_roles_modtime BEFORE UPDATE ON reaction_roles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_reaction_roles_id ON reaction_roles(id);

-- 6. Starboard
CREATE TABLE starboard (
    id TEXT PRIMARY KEY, -- guild_id
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_starboard_modtime BEFORE UPDATE ON starboard FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_starboard_id ON starboard(id);

-- 7. AFK Status (User specific, not Guild)
CREATE TABLE afk_status (
    id TEXT PRIMARY KEY, -- user_id
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TRIGGER update_afk_status_modtime BEFORE UPDATE ON afk_status FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE INDEX idx_afk_status_id ON afk_status(id);

-- Note: We store the strongly-typed objects inside the JSONB `data` column 
-- so that our BaseRepository<T> can map perfectly back to the TypeScript models 
-- without requiring massive code rewrites in the command logic.
