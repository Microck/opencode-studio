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
  edit?: PermissionValue | { allow?: string[]; deny?: string[] };
  bash?: PermissionValue | { allow?: string[]; deny?: string[] };
  skill?: PermissionValue;
  webfetch?: PermissionValue | { allow?: string[]; deny?: string[] };
  doom_loop?: PermissionValue;
  external_directory?: PermissionValue | { allow?: string[]; deny?: string[] };
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: Record<string, boolean>;
  permissions?: PermissionConfig;
  color?: string;
  maxSteps?: number;
  mode?: 'subagent' | 'primary' | 'all';
  disable?: boolean;
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
    name?: string;
    attachments?: boolean;
    reasoning?: boolean;
    limit?: {
      context?: number;
      output?: number;
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
    factor?: number;
  };
  diff_style?: 'auto' | 'stacked' | 'inline';
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
    command: string[];
    args?: string[];
  };
}

export interface FormatterConfig {
  [language: string]: {
    command: string[];
    args?: string[];
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
  theme?: 'dark' | 'light' | 'auto';
  model?: string | ModelConfig;
  small_model?: string;
  username?: string;
  autoupdate?: boolean | 'notify';
  share?: 'manual' | 'auto' | 'disabled';
  default_agent?: string;
  snapshot?: boolean;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  mcp?: Record<string, MCPConfig>;
  permissions?: PermissionConfig;
  agents?: AgentsConfig;
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
}

export interface AuthInfo {
  credentials: AuthCredential[];
  authFile: string | null;
  message?: string;
  hasGeminiAuthPlugin?: boolean;
}

export interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth' | 'api';
  description: string;
}
