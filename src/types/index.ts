import type {
  Client,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  PermissionResolvable,
  Collection,
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  User,
  GuildMember,
  APIEmbedField,
} from 'discord.js';

// ─── Extended Client ──────────────────────────────────────────────────────────

export interface VeluClient extends Client {
  commands: Collection<string, Command>;
  components: Map<string, ComponentHandler>;
}

// ─── Command Types ────────────────────────────────────────────────────────────

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction, client?: VeluClient) => Promise<void>;
  autocomplete?: (interaction: ChatInputCommandInteraction, client?: VeluClient) => Promise<void>;
  module?: string;
  userPermission?: PermissionResolvable;
  botPermission?: PermissionResolvable;
  cooldown?: number;
}

// ─── Component Handler Types ──────────────────────────────────────────────────

export interface ComponentContext {
  namespace: string;
  action: string;
  data: Record<string, unknown> | null;
}

export interface ComponentHandler {
  namespace: string;
  execute: (
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
    context: ComponentContext,
    client?: VeluClient,
  ) => Promise<void>;
}

// ─── Event Types ──────────────────────────────────────────────────────────────

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

// ─── State Manager Types ──────────────────────────────────────────────────────

export interface StateRecord<T = unknown> {
  data: T;
  expiresAt: number;
}

export interface ResolvedState<T = unknown> {
  namespace: string;
  action: string;
  data: T | null;
  expired?: boolean;
}

// ─── User Serialization ──────────────────────────────────────────────────────

export interface SerializedUser {
  id: string;
  username: string;
  tag: string;
  avatarURL: string | null;
}

// ─── Game State Types ─────────────────────────────────────────────────────────

export interface TicTacToeState {
  p1: SerializedUser;
  p2: SerializedUser;
  isBot: boolean;
  board: (string | null)[];
  turn: 'p1' | 'p2';
  status: 'playing' | 'finished';
  winner: 'p1' | 'p2' | 'draw' | null;
}

export interface ConnectFourState {
  p1: SerializedUser;
  p2: SerializedUser;
  isBot: boolean;
  board: (string | null)[];
  turn: 'p1' | 'p2';
  status: 'playing' | 'finished';
  winner: 'p1' | 'p2' | 'draw' | null;
}

export interface RpsState {
  p1: SerializedUser;
  p2: SerializedUser;
  isBot: boolean;
  p1Choice: string | null;
  p2Choice: string | null;
  winner: 'p1' | 'p2' | 'draw' | null;
  status: 'pending' | 'playing' | 'finished';
}

export interface MemoryState {
  player: SerializedUser;
  deck: string[];
  revealed: boolean[];
  selected: number[];
  attempts: number;
  maxAttempts: number;
  matched: number;
  status: 'playing' | 'finished' | 'lost';
}

export interface GuessNumberState {
  player: SerializedUser;
  target: number;
  attempts: number;
  maxAttempts: number;
  status: 'playing' | 'won' | 'lost';
  hint: string;
}

// ─── UI Factory Types ─────────────────────────────────────────────────────────

export interface EmbedOptions {
  fields?: APIEmbedField[];
  footer?: false;
  footerText?: string;
  footerIcon?: string;
  thumbnail?: string;
  image?: string;
  author?: {
    name: string;
    iconURL?: string;
    url?: string;
  };
  timestamp?: boolean | false;
  color?: number;
}

// ─── Database Types ───────────────────────────────────────────────────────────

export interface GuildConfig {
  welcomeEnabled: boolean;
  welcomeChannel: string | null;
  welcomeMessage: string;
  welcomeAutoRole: string | null;
  goodbyeEnabled: boolean;
  goodbyeChannel: string | null;
  goodbyeMessage: string;
  logEnabled: boolean;
  logChannel: string | null;
  // Automod
  automodEnabled: boolean;
  automodSpamFilter: boolean;
  automodBlockInvites: boolean;
  automodBadwords: boolean;
  automodBadwordsList: string[];
  customPermissions: Record<string, string[]>;
}

export interface Warning {
  id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  timestamp: number;
}


export interface AfkData {
  reason: string;
  gifUrl: string | null;
  timestamp: number;
}

// ─── Logger Types ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogLevelInfo {
  priority: number;
  color: string;
  label: string;
}

// ─── Permission Manager Types ─────────────────────────────────────────────────

export interface AuthorizeOptions {
  commandName?: string;
  moduleName?: string;
  userPermission?: PermissionResolvable;
  botPermission?: PermissionResolvable;
}

export interface HierarchyOptions {
  checkManagedRole?: boolean;
}
