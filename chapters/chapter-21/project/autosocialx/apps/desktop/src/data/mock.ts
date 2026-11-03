import type {
  Agent, LogEntry, WeekDataPoint, MonthDataPoint,
  PieDataPoint, Campaign, Content, Automation,
} from '../types'

export const AGENTS: Agent[] = [
  { id: 'agt_ai_scout',        nm: 'The AI Scout',                  pl: 'x',           tk: 'Scanning AI news & research',         st: 'idle',     pc: null, cl: '#00E5CC', channelId: 'builtin-x',           personaId: 'knowledge_mentor',   provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
  { id: 'agt_saas_oracle',     nm: 'SaaS Metrics Oracle',           pl: 'linkedin',    tk: 'Compiling SaaS benchmark data',        st: 'idle',     pc: null, cl: '#4EAAFF', channelId: 'builtin-linkedin',    personaId: 'b2b_thought_leader', provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
  { id: 'agt_hn_digest',       nm: 'Hacker News Digest',            pl: 'x',           tk: 'Scanning top HN threads',             st: 'idle',     pc: null, cl: '#FF6640', channelId: 'builtin-x',           personaId: 'default',            provider: 'openai',   model: 'gpt-4o-mini',       topic: '' },
  { id: 'agt_devrel',          nm: 'DevRel Advocate',               pl: 'discord',     tk: 'Curating OSS releases',               st: 'idle',     pc: null, cl: '#5865F2', channelId: 'builtin-discord',     personaId: 'default',            provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
  { id: 'agt_gtm_playbook',    nm: 'GTM Strategy Guide',            pl: 'linkedin',    tk: 'Drafting GTM framework post',         st: 'idle',     pc: null, cl: '#0A66C2', channelId: 'builtin-linkedin',    personaId: 'b2b_thought_leader', provider: 'claude',   model: 'claude-opus-4-6',   topic: '' },
  { id: 'agt_bip',             nm: 'Build in Public',               pl: 'x',           tk: 'Writing daily metrics update',        st: 'idle',     pc: null, cl: '#F0C040', channelId: 'builtin-x',           personaId: 'default',            provider: 'deepseek', model: 'deepseek-chat',     topic: '' },
  { id: 'agt_ph_analyst',      nm: 'Product Hunt Analyst',          pl: 'x',           tk: 'Analysing top PH launch today',       st: 'idle',     pc: null, cl: '#DA552F', channelId: 'builtin-x',           personaId: 'knowledge_mentor',   provider: 'openai',   model: 'gpt-4o',            topic: '' },
  { id: 'agt_venture_signal',  nm: 'Venture Capital Signal',        pl: 'linkedin',    tk: 'Monitoring funding announcements',    st: 'idle',     pc: null, cl: '#7C3AED', channelId: 'builtin-linkedin',    personaId: 'b2b_thought_leader', provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
  { id: 'agt_growth_loop',     nm: 'Growth Loop Architect',         pl: 'linkedin',    tk: 'Drafting growth framework post',      st: 'idle',     pc: null, cl: '#059669', channelId: 'builtin-linkedin',    personaId: 'b2b_thought_leader', provider: 'openai',   model: 'gpt-4o',            topic: '' },
  { id: 'agt_xhs_curator',     nm: 'Xiaohongshu Lifestyle Curator', pl: 'xiaohongshu', tk: 'Creating lifestyle discovery post',   st: 'idle',     pc: null, cl: '#FF2442', channelId: 'builtin-xiaohongshu', personaId: 'authentic_seeder',   provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
  { id: 'agt_thread_weaver',   nm: 'Thread Weaver',                 pl: 'x',           tk: 'Crafting long-form thread',           st: 'idle',     pc: null, cl: '#E879F9', channelId: 'builtin-x',           personaId: 'viral_copywriter',   provider: 'claude',   model: 'claude-opus-4-6',   topic: '' },
  { id: 'agt_weekly_digest',   nm: 'Weekly Tech Digest',            pl: 'linkedin',    tk: 'Packaging weekly tech roundup',       st: 'idle',     pc: null, cl: '#38BDF8', channelId: 'builtin-linkedin',    personaId: 'knowledge_mentor',   provider: 'claude',   model: 'claude-sonnet-4-6', topic: '' },
]

export const LOGS: LogEntry[] = [
  { t: '08:00:01', a: 'AI_SCOUT',      x: 'Fetching AI news from RSS feeds...',                                      c: '#00E5CC' },
  { t: '08:00:03', a: 'AI_SCOUT',      x: 'tool:rss_reader → 14 new items found',                                   c: '#00E5CC' },
  { t: '08:00:05', a: 'AI_SCOUT',      x: 'Selecting top story: Claude extended context benchmark',                  c: '#00E5CC' },
  { t: '08:00:09', a: 'AI_SCOUT',      x: 'tool:schedule_post → published to X successfully',                       c: '#3DD68C' },
  { t: '09:00:01', a: 'SAAS_ORACLE',   x: 'Pulling SaaS benchmark dataset...',                                      c: '#4EAAFF' },
  { t: '09:00:04', a: 'SAAS_ORACLE',   x: 'tool:web_search → "NRR benchmarks SaaS 2026"',                          c: '#4EAAFF' },
  { t: '09:00:11', a: 'SAAS_ORACLE',   x: 'Drafting LinkedIn post: NRR above 120% analysis',                        c: '#4EAAFF' },
  { t: '09:00:18', a: 'SAAS_ORACLE',   x: 'tool:schedule_post → queued for 09:30 AM publish',                      c: '#3DD68C' },
  { t: '10:00:02', a: 'THREAD_WEAVER', x: 'Composing thread: "move fast era is over"',                              c: '#E879F9' },
  { t: '10:00:08', a: 'THREAD_WEAVER', x: 'tool:read_url → reading primary source article',                         c: '#E879F9' },
  { t: '10:00:14', a: 'THREAD_WEAVER', x: 'Thread drafted: 7 tweets, hook + 5 insights + CTA',                     c: '#E879F9' },
  { t: '10:00:16', a: 'THREAD_WEAVER', x: 'tool:schedule_post → scheduled for 07:00 AM Mon',                       c: '#3DD68C' },
]

export const WEEK_DATA: WeekDataPoint[] = [
  { d: 'Mon', i: 18400, e: 1240 },
  { d: 'Tue', i: 22800, e: 1680 },
  { d: 'Wed', i: 31200, e: 2340 },
  { d: 'Thu', i: 26600, e: 1920 },
  { d: 'Fri', i: 38100, e: 3560 },
  { d: 'Sat', i: 41400, e: 4120 },
  { d: 'Sun', i: 44200, e: 4880 },
]

export const MONTH_DATA: MonthDataPoint[] = [
  { m: 'Nov', f: 12400 },
  { m: 'Dec', f: 18600 },
  { m: 'Jan', f: 26200 },
  { m: 'Feb', f: 34800 },
  { m: 'Mar', f: 44200 },
]

export const PIE_DATA: PieDataPoint[] = [
  { name: 'X',        value: 38, color: '#ffffff' },
  { name: 'LinkedIn', value: 31, color: '#0A66C2' },
  { name: 'Discord',  value: 14, color: '#5865F2' },
  { name: '小红书',   value: 11, color: '#FF2442' },
  { name: 'Instagram',value: 6,  color: '#E1306C' },
]

export const CAMPAIGNS: Campaign[] = [
  { id: 'cmp_ai_revolution',     nm: 'AI Revolution 2026',              pl: ['x','linkedin','instagram'],              st: 'active', ps: 31, eng: '5.4%', reach: '189K' },
  { id: 'cmp_saas_playbook',     nm: 'SaaS Founder Playbook',           pl: ['linkedin','x'],                          st: 'active', ps: 22, eng: '7.1%', reach: '124K' },
  { id: 'cmp_devtools_spotlight',nm: 'Developer Tools Spotlight',       pl: ['x','discord'],                           st: 'active', ps: 16, eng: '4.8%', reach: '67K'  },
  { id: 'cmp_build_public',      nm: 'Build in Public: 90-Day',         pl: ['x','linkedin'],                          st: 'active', ps: 47, eng: '9.2%', reach: '92K'  },
  { id: 'cmp_growth_masterclass',nm: 'Growth Masterclass Series',       pl: ['linkedin'],                              st: 'active', ps: 8,  eng: '6.3%', reach: '41K'  },
  { id: 'cmp_launch_amplifier',  nm: 'Global Launch Amplifier',         pl: ['x','linkedin','instagram','xiaohongshu'],st: 'idle',   ps: 0,  eng: '—',    reach: '—'    },
]

export const CONTENTS: Content[] = [
  { id: 'cnt_001', ti: 'Claude extended context changes everything about RAG architectures. Thread 🧵',  pl: 'x',          st: 'published', eg: '41.2K', tm: '2h ago',    tp: 'original' },
  { id: 'cnt_002', ti: 'After analysing 312 SaaS companies: NRR above 120% separates the best',         pl: 'linkedin',   st: 'published', eg: '28.4K', tm: '5h ago',    tp: 'original' },
  { id: 'cnt_003', ti: 'Why "move fast and break things" is over — and what replaces it 🧵',            pl: 'x',          st: 'scheduled', eg: '—',     tm: 'In 4h',     tp: 'original' },
  { id: 'cnt_004', ti: 'OSS highlight: shadcn/ui Blocks — 30+ production-ready page components',        pl: 'discord',    st: 'published', eg: '156 ⚡', tm: '1d ago',    tp: 'original' },
  { id: 'cnt_005', ti: 'The GTM motion that closed $4M seed: community-led, not cold email',            pl: 'linkedin',   st: 'scheduled', eg: '—',     tm: 'In 2h',     tp: 'original' },
  { id: 'cnt_006', ti: 'Tested 12 AI writing tools over 6 weeks. Honest breakdown (no affiliates)',     pl: 'xiaohongshu',st: 'scheduled', eg: '—',     tm: 'In 14h',    tp: 'original' },
  { id: 'cnt_007', ti: 'Day 47. Newsletter: 0 → 2,847 subs. MRR: $0 → $1,240. Full playbook here',    pl: 'x',          st: 'published', eg: '89.6K', tm: '2d ago',    tp: 'original' },
  { id: 'cnt_008', ti: 'This week in tech: five developments that deserve more attention',               pl: 'linkedin',   st: 'draft',     eg: '—',     tm: 'Draft',     tp: 'original' },
]

export const AUTOMATIONS: Automation[] = [
  { id: 1, nm: 'AI Scout → X',              tr: 'Every 4 hours',    pl: 'x',          st: 'running', rn: 47,  lr: '3h 48m ago'   },
  { id: 2, nm: 'SaaS Oracle → LinkedIn',    tr: 'Mon/Wed/Fri 9 AM', pl: 'linkedin',   st: 'running', rn: 28,  lr: '51 min ago'   },
  { id: 3, nm: 'Thread Weaver → X',         tr: 'Mon/Wed/Fri 7 AM', pl: 'x',          st: 'running', rn: 19,  lr: 'Today 07:00'  },
  { id: 4, nm: 'DevRel Advocate → Discord', tr: 'Daily at 6 PM',    pl: 'discord',    st: 'running', rn: 34,  lr: 'Today 18:00'  },
  { id: 5, nm: 'XHS Curator → 小红书',      tr: 'Daily at 10 AM',   pl: 'xiaohongshu',st: 'paused',  rn: 12,  lr: '2d ago'       },
]
