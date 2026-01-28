export interface MCPConfig {
  command?: string[];
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  type: 'local' | 'sse' | 'remote';
  timeout?: number;
  environment?: Record<string, string>;
  oauth?: {
    clientId: string;
    clientSecret?: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes?: string[];
  };
}

export interface ModelAlias {
  provider: string;
  model: string;
}

export type PermissionValue = 'ask' | 'allow' | 'deny';

export interface PermissionConfig {
  '*'?: PermissionValue;
  read?: PermissionValue | { allow?: string[]; deny?: string[] };
  edit?: PermissionValue | { allow?: string[]; deny?: string[] };
  glob?: PermissionValue | { allow?: string[]; deny?: string[] };
  grep?: PermissionValue | { allow?: string[]; deny?: string[] };
  list?: { allow?: string[]; deny?: string[] };
  bash?: { allow?: string[]; deny?: string[] };
  task?: { allow?: string[]; deny?: string[] };
  skill?: PermissionValue;
  lsp?: PermissionValue;
  todoread?: PermissionValue;
  todowrite?: PermissionValue;
  webfetch?: { allow?: string[]; deny?: string[] };
  external_directory?: { allow?: string[]; deny?: string[] };
  doom_loop?: PermissionValue;
}

export type PermissionToolKey = keyof PermissionConfig;

export interface AgentConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: Record<string, boolean>;
  permissions?: PermissionConfig;
  permission?: PermissionConfig;
  description?: string;
  color?: string;
  maxSteps?: number;
  mode?: 'subagent' | 'primary' | 'all';
  disable?: boolean;
  hidden?: boolean;
}

export type AgentSource = 'json' | 'markdown' | 'builtin';

export interface AgentInfo extends AgentConfig {
  name: string;
  source: AgentSource;
  disabled?: boolean;
}

export interface AgentsResponse {
  agents: AgentInfo[];
}

export interface AgentsConfig {
  plan?: AgentConfig;
  build?: AgentConfig;
  general?: AgentConfig;
  explore?: AgentConfig;
  title?: AgentConfig;
  summary?: AgentConfig;
  compaction?: AgentConfig;
}

export interface ProviderOptions {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

export interface ProviderConfig {
  api?: string;
  name?: string;
  env?: string[];
  npm?: string;
  models?: Record<string, {
    id?: string;
    name?: string;
    release_date?: string;
    attachments?: boolean;
    reasoning?: boolean;
    limit?: {
      context?: number;
      output?: number;
    };
    cost?: {
      input: number;
      output: number;
      cache_read?: number;
    };
    modalities?: {
      input: string[];
      output: string[];
    };
    variants?: Record<string, {
      reasoning?: boolean;
      options?: {
        thinkingConfig?: {
          thinkingLevel?: 'low' | 'medium' | 'high' | 'minimal';
          thinkingBudget?: number;
          includeThoughts?: boolean;
        };
      };
    }>;
    options?: {
      thinkingConfig?: {
        thinkingLevel?: 'low' | 'medium' | 'high' | 'minimal';
        thinkingBudget?: number;
        includeThoughts?: boolean;
      };
    };
  }>;
  whitelist?: string[];
  blacklist?: string[];
  options?: ProviderOptions;
}

export interface TUIConfig {
  scroll_speed?: number;
  scroll_acceleration?: {
    enabled?: boolean;
  };
  diff_style?: 'auto' | 'stacked';
}

export interface KeybindsConfig {
  leader?: string;
  app_exit?: string;
  app_help?: string;
  editor_open?: string;
  session_new?: string;
  session_list?: string;
  session_compact?: string;
  session_interrupt?: string;
  history_prev?: string;
  history_next?: string;
  input_clear?: string;
  input_submit?: string;
  input_paste?: string;
  input_newline?: string;
  messages_scroll_up?: string;
  messages_scroll_down?: string;
  messages_page_up?: string;
  messages_page_down?: string;
  messages_home?: string;
  messages_end?: string;
  messages_copy_last?: string;
  messages_copy_last_code?: string;
  file_tree_toggle?: string;
  file_tree_open?: string;
  file_tree_expand?: string;
  file_tree_collapse?: string;
  file_tree_navigate_up?: string;
  file_tree_navigate_down?: string;
  diagnostics_toggle?: string;
  debug_toggle?: string;
  model_selector?: string;
  [key: string]: string | undefined;
}

export interface CompactionConfig {
  auto?: boolean;
  prune?: boolean;
  minTokens?: number;
  maxTokens?: number;
}

export interface WatcherConfig {
  ignore?: string[];
}

export interface LSPConfig {
  [language: string]: {
    disabled?: boolean;
    command?: string[];
    args?: string[];
    extensions?: string[];
    env?: Record<string, string>;
    initialization?: Record<string, any>;
  };
}

export interface FormatterConfig {
  [language: string]: {
    disabled?: boolean;
    command?: string[];
    args?: string[];
    extensions?: string[];
    environment?: Record<string, string>;
  };
}

export interface HooksConfig {
  pre_tool?: string[];
  post_tool?: string[];
  pre_message?: string[];
  post_message?: string[];
}

export interface ExperimentalConfig {
  hooks?: HooksConfig;
  chatMaxRetries?: number;
  batch_tool?: boolean;
  openTelemetry?: {
    enabled?: boolean;
    endpoint?: string;
  };
}

export interface ModelConfig {
  aliases?: Record<string, ModelAlias>;
  providers?: Record<string, ProviderConfig>;
}

export interface OpencodeConfig {
  base_url?: string;
  theme?: 'dark' | 'light' | 'auto';
  model?: string | ModelConfig;
  small_model?: string;
  username?: string;
  autoupdate?: boolean | 'notify';
  share?: 'manual' | 'auto' | 'disabled';
  default_agent?: string;
  snapshot?: boolean;
  mcp?: Record<string, MCPConfig>;
  permission?: PermissionConfig;
  agent?: AgentsConfig;
  tools?: Record<string, boolean>;
  tui?: TUIConfig;
  keybinds?: KeybindsConfig;
  compaction?: CompactionConfig;
  watcher?: WatcherConfig;
  lsp?: LSPConfig;
  formatter?: FormatterConfig;
  command?: Record<string, { template: string }>;
  plugin?: string[];
  experimental?: ExperimentalConfig;
  provider?: Record<string, ProviderConfig>;
}

export interface SkillFile {
  name: string;
  description: string;
  content: string;
  rawContent: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  enabled: boolean;
}

export interface PluginFile {
  name: string;
  content: string;
}

export interface PluginInfo {
  name: string;
  type: 'file' | 'npm';
  enabled: boolean;
}

export interface PathsInfo {
  detected: string | null;
  manual: string | null;
  current: string | null;
  candidates: string[];
}

export interface AuthCredential {
  id: string;
  name: string;
  type: 'oauth' | 'api';
  isExpired: boolean;
  expiresAt: number | null;
  active?: string | null;
  profiles?: string[];
  hasCurrentAuth?: boolean;
}

export interface AuthInfo {
  credentials: AuthCredential[];
  authFile: string | null;
  message?: string;
  hasGeminiAuthPlugin?: boolean;
  installedGooglePlugins: ('gemini' | 'antigravity')[];
  activeGooglePlugin: 'gemini' | 'antigravity' | null;
}

export interface PluginModelsConfig {
  [plugin: string]: {
    activeModels: string[];
    blacklist: string[];
  };
}

export interface StudioConfig {
  disabledSkills: string[];
  disabledPlugins: string[];
  activeGooglePlugin: 'gemini' | 'antigravity' | null;
  pluginModels: PluginModelsConfig;
  activeProfiles: Record<string, string>;
  presets: Preset[];
}

export interface PresetConfig {
  skills?: string[];
  plugins?: string[];
  mcps?: string[];
  commands?: string[];
}

export interface Preset {
  id: string;
  name: string;
  description?: string;
  config: PresetConfig;
}

export interface SystemToolInfo {
  name: string;
  path?: string;
  available: boolean;
}

export interface RulesResponse {
  content: string;
  source: 'AGENTS.md' | 'CLAUDE.md' | 'none';
  path: string | null;
}


export interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth' | 'api';
  description: string;
}

export interface AuthProfilesInfo {
  [provider: string]: {
    profiles: string[];
    active: string | null;
    hasCurrentAuth: boolean;
  };
}

// Account Pool types for multi-account management
export type AccountStatus = 'active' | 'ready' | 'cooldown' | 'expired';

export interface AccountPoolEntry {
  name: string;
  email: string | null;
  status: AccountStatus;
  lastUsed: number;
  usageCount: number;
  cooldownUntil: number | null;
  createdAt: number;
  projectId?: string | null;
  tier?: string | null;
}

export interface AccountPool {
  provider: string;
  namespace: string;
  accounts: AccountPoolEntry[];
  activeAccount: string | null;
  totalAccounts: number;
  availableAccounts: number;
}

export interface QuotaInfo {
  dailyLimit: number;
  remaining: number;
  used: number;
  resetAt: string;
  percentage: number;
  byAccount: {
    name: string;
    email: string | null;
    used: number;
    limit: number;
  }[];
}

export interface PoolRotationResult {
  success: boolean;
  previousAccount: string | null;
  newAccount: string;
  reason?: string;
}

export interface OhMyThinkingConfig {
  type: 'enabled' | 'disabled';
}

export interface OhMyReasoningConfig {
  effort: 'low' | 'medium' | 'high' | 'xhigh';
}

export interface OhMyModelChoice {
  model: string;
  available: boolean;
  thinking?: OhMyThinkingConfig;
  reasoning?: OhMyReasoningConfig;
}

export interface OhMyAgentPreferences {
  choices: OhMyModelChoice[];
}

export interface OhMyPreferences {
  agents: Record<string, OhMyAgentPreferences>;
}

export interface OhMyConfigResponse {
  path: string | null;
  exists: boolean;
  config: Record<string, unknown> | null;
  preferences: OhMyPreferences;
  warnings?: string[];
}

export interface GitHubBackupConfig {
  owner?: string;
  repo?: string;
  branch?: string;
}

export interface GitHubBackupStatus {
  connected: boolean;
  user?: string;
  config?: GitHubBackupConfig;
  repoExists?: boolean;
  lastUpdated?: string;
  error?: string;
  autoSync?: boolean;
}

export interface GitHubBackupResult {
  success: boolean;
  timestamp?: string;
  commit?: string;
  url?: string;
  error?: string;
}

export interface AgentInfo {
  name: string;
  description?: string;
  enabled: boolean;
  config?: AgentConfig;
}

export interface RulesResponse {
  content: string;
  activeFile?: string;
  files?: string[];
}

export interface SystemToolInfo {
  name: string;
  description?: string;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'mcp' | 'agent' | 'system';
  message: string;
  metadata?: Record<string, unknown>;
}
