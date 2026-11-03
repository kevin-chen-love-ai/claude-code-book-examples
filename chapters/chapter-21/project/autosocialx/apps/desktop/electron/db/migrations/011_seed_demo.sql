-- Migration 011: Curated professional demo data
-- Clears agents / agent_runs / campaigns / content and seeds
-- 12 agents, 6 campaigns, and 8 content pieces with realistic detail.
-- Persona IDs reference built-in personas seeded by PersonaHub.init().
-- Channel IDs reference built-in channels seeded by migration 009.

-- ─── Clear existing data ──────────────────────────────────────────────────────
DELETE FROM content;
DELETE FROM agent_runs;
DELETE FROM campaigns;
DELETE FROM agents;

-- ─── Agents (12 total) ────────────────────────────────────────────────────────

INSERT INTO agents (
  id, name, platform, persona_id, skill_ids, cron_expr, status,
  security_profile, created_at, updated_at, provider, model,
  custom_instructions, channel_id
) VALUES

-- 1. The AI Scout — X · every 4 h · Claude Sonnet
(
  'agt_ai_scout',
  'The AI Scout',
  'x',
  'knowledge_mentor',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:hashtag_analyze","tool:read_url"]',
  '0 */4 * * *',
  'idle',
  '{"maxTokensPerRun":4096,"maxRunsPerDay":6,"requireHumanApproval":false}',
  unixepoch() - 864000, unixepoch() - 864000,
  'claude', 'claude-sonnet-4-6',
  'Monitor the latest AI research papers, model releases, and startup announcements. Distill each finding into a punchy, insight-driven 280-character post with a clear takeaway. Always include 2–3 relevant hashtags. Prioritise signal over hype — your audience values depth over clickbait.',
  'builtin-x'
),

-- 2. SaaS Metrics Oracle — LinkedIn · Mon/Wed/Fri 9 AM · Claude Sonnet
(
  'agt_saas_oracle',
  'SaaS Metrics Oracle',
  'linkedin',
  'b2b_thought_leader',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:memory_recall","tool:sentiment_scan"]',
  '0 9 * * 1,3,5',
  'idle',
  '{"maxTokensPerRun":6144,"maxRunsPerDay":3,"requireHumanApproval":false}',
  unixepoch() - 777600, unixepoch() - 777600,
  'claude', 'claude-sonnet-4-6',
  'Publish data-backed SaaS benchmarks with actionable commentary for B2B founders. Focus on NRR, CAC payback, churn drivers, and growth efficiency metrics. Reference real company case studies where available. Write for a senior decision-maker reading on mobile during commute — every sentence must earn its place.',
  'builtin-linkedin'
),

-- 3. Hacker News Digest — X · daily 8 AM · GPT-4o-mini
(
  'agt_hn_digest',
  'Hacker News Digest',
  'x',
  'default',
  '["tool:web_search","tool:read_url","tool:schedule_post","tool:hashtag_analyze"]',
  '0 8 * * *',
  'idle',
  '{"maxTokensPerRun":3072,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 691200, unixepoch() - 691200,
  'openai', 'gpt-4o-mini',
  'Scan the top posts on Hacker News each morning. Select the single most impactful story for a technical but non-specialist audience. Write a 2-sentence summary followed by the core implication in plain language. Keep the post under 240 characters and include the source link.',
  'builtin-x'
),

-- 4. DevRel Advocate — Discord · daily 6 PM · Claude Sonnet
(
  'agt_devrel',
  'DevRel Advocate',
  'discord',
  'default',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:read_url","tool:memory_recall"]',
  '0 18 * * *',
  'idle',
  '{"maxTokensPerRun":4096,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 604800, unixepoch() - 604800,
  'claude', 'claude-sonnet-4-6',
  'Celebrate open-source releases, developer milestones, and community contributions. Write with warmth and genuine enthusiasm that resonates with engineers. Highlight the "why it matters" angle — not just what shipped, but what problem it solves. Use specific version numbers, repo names, and GitHub references.',
  'builtin-discord'
),

-- 5. GTM Strategy Guide — LinkedIn · Tue/Thu 10 AM · Claude Opus
(
  'agt_gtm_playbook',
  'GTM Strategy Guide',
  'linkedin',
  'b2b_thought_leader',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:memory_recall","tool:read_url"]',
  '0 10 * * 2,4',
  'idle',
  '{"maxTokensPerRun":8192,"maxRunsPerDay":2,"requireHumanApproval":false}',
  unixepoch() - 518400, unixepoch() - 518400,
  'claude', 'claude-opus-4-6',
  'Break down go-to-market strategies from successful B2B SaaS companies. Structure every post as: (1) a specific tactical lesson with a concrete example, (2) the underlying principle behind it, (3) one action the reader can take today. Write for VP Sales and founders at the $500K–$5M ARR inflection point.',
  'builtin-linkedin'
),

-- 6. Build in Public — X · daily 8:30 AM · DeepSeek
(
  'agt_bip',
  'Build in Public',
  'x',
  'default',
  '["tool:memory_recall","tool:schedule_post","tool:hashtag_analyze","tool:sentiment_scan"]',
  '30 8 * * *',
  'idle',
  '{"maxTokensPerRun":3072,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 432000, unixepoch() - 432000,
  'deepseek', 'deepseek-chat',
  'Chronicle the raw, unfiltered startup-building journey with radical transparency. Every post must include at least one concrete number — signups, MRR, churn, deploy count, support tickets. End with a lesson learned or an open question that invites real community engagement. No fluff, no motivational filler.',
  'builtin-x'
),

-- 7. Product Hunt Analyst — X · daily 9 AM · GPT-4o
(
  'agt_ph_analyst',
  'Product Hunt Analyst',
  'x',
  'knowledge_mentor',
  '["tool:web_search","tool:read_url","tool:schedule_post","tool:hashtag_analyze","tool:sentiment_scan"]',
  '0 9 * * *',
  'idle',
  '{"maxTokensPerRun":4096,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 345600, unixepoch() - 345600,
  'openai', 'gpt-4o',
  'Analyse the top Product Hunt launch each day. Evaluate product-market fit, pricing clarity, target audience specificity, and differentiation from incumbents. Summarise in 3 punchy lines: what it does, who it is really for, and whether it solves a genuine pain. Provide a candid verdict — avoid generic praise.',
  'builtin-x'
),

-- 8. Venture Capital Signal — LinkedIn · Mon/Fri 11 AM · Claude Sonnet
(
  'agt_venture_signal',
  'Venture Capital Signal',
  'linkedin',
  'b2b_thought_leader',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:read_url","tool:memory_recall"]',
  '0 11 * * 1,5',
  'idle',
  '{"maxTokensPerRun":5120,"maxRunsPerDay":2,"requireHumanApproval":false}',
  unixepoch() - 259200, unixepoch() - 259200,
  'claude', 'claude-sonnet-4-6',
  'Curate meaningful VC funding announcements and decode what they signal for the broader market. Go beyond the headline: identify the thesis behind the investment, the competitive implications, and what founders in adjacent spaces should take away. Write for a sophisticated audience of operators and allocators.',
  'builtin-linkedin'
),

-- 9. Growth Loop Architect — LinkedIn · Wed 2 PM · GPT-4o
(
  'agt_growth_loop',
  'Growth Loop Architect',
  'linkedin',
  'b2b_thought_leader',
  '["tool:web_search","tool:memory_recall","tool:schedule_post","tool:sentiment_scan"]',
  '0 14 * * 3',
  'idle',
  '{"maxTokensPerRun":6144,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 172800, unixepoch() - 172800,
  'openai', 'gpt-4o',
  'Share proven growth frameworks, retention loops, and acquisition strategies backed by real company data. Every post must include a specific metric or outcome that validates the framework. Use a clear structure: the problem → the loop mechanic → the measurable result. Keep it rigorous and practical — not theoretical.',
  'builtin-linkedin'
),

-- 10. Xiaohongshu Lifestyle Curator — xiaohongshu · daily 10 AM · Claude Sonnet
(
  'agt_xhs_curator',
  'Xiaohongshu Lifestyle Curator',
  'xiaohongshu',
  'authentic_seeder',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:hashtag_analyze","tool:translate"]',
  '0 10 * * *',
  'idle',
  '{"maxTokensPerRun":4096,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 86400, unixepoch() - 86400,
  'claude', 'claude-sonnet-4-6',
  'Create authentic product discovery and lifestyle content for Xiaohongshu. Write like a trusted friend recommending something they genuinely love — warm, conversational, specific. Include real use-case scenarios, honest pros and cons, and sensory detail. Always end with a direct question to spark comments.',
  'builtin-xiaohongshu'
),

-- 11. Thread Weaver — X · Mon/Wed/Fri 7 AM · Claude Opus
(
  'agt_thread_weaver',
  'Thread Weaver',
  'x',
  'viral_copywriter',
  '["tool:web_search","tool:rss_reader","tool:read_url","tool:schedule_post","tool:memory_recall","tool:hashtag_analyze"]',
  '0 7 * * 1,3,5',
  'idle',
  '{"maxTokensPerRun":8192,"maxRunsPerDay":3,"requireHumanApproval":false}',
  unixepoch() - 43200, unixepoch() - 43200,
  'claude', 'claude-opus-4-6',
  'Craft long-form Twitter threads on complex technology or business topics. Structure: (1) hook tweet that creates real curiosity — not bait, (2) 5–8 insight tweets each containing one concrete idea, (3) a contrarian take that challenges conventional wisdom, (4) a practical takeaway, (5) a CTA that invites replies. Source from primary materials: papers, interviews, earnings calls. Never summarise Wikipedia.',
  'builtin-x'
),

-- 12. Weekly Tech Digest — LinkedIn · Sunday 6 PM · Claude Sonnet
(
  'agt_weekly_digest',
  'Weekly Tech Digest',
  'linkedin',
  'knowledge_mentor',
  '["tool:web_search","tool:rss_reader","tool:schedule_post","tool:memory_recall","tool:read_url"]',
  '0 18 * * 0',
  'idle',
  '{"maxTokensPerRun":6144,"maxRunsPerDay":1,"requireHumanApproval":false}',
  unixepoch() - 3600, unixepoch() - 3600,
  'claude', 'claude-sonnet-4-6',
  'Package the five most significant technology and startup developments of the week into a structured LinkedIn digest. Format: short intro framing the week''s overarching theme → 5 numbered items each with context and implication → a closing observation about the bigger pattern emerging. Readers should finish feeling informed and provoked to think differently.',
  'builtin-linkedin'
);

-- ─── Campaigns (6 total) ──────────────────────────────────────────────────────

INSERT INTO campaigns (
  id, name, platforms, status, created_at,
  description, channel_ids, cron_expr, cron_status
) VALUES

-- 1. AI Revolution 2026 — X + LinkedIn + Instagram · active
(
  'cmp_ai_revolution',
  'AI Revolution 2026',
  '["x","linkedin","instagram"]',
  'active',
  unixepoch() - 1209600,
  'Comprehensive multi-channel campaign covering AI breakthroughs, model releases, and real-world deployment stories. Technical depth for LinkedIn, punchy analysis for X, and visual explainers for Instagram — all coordinated around the same weekly narrative arc.',
  '["builtin-x","builtin-linkedin","builtin-instagram"]',
  '0 9 * * 1,3,5',
  'active'
),

-- 2. SaaS Founder Playbook — LinkedIn + X · active
(
  'cmp_saas_playbook',
  'SaaS Founder Playbook',
  '["linkedin","x"]',
  'active',
  unixepoch() - 1036800,
  'Tactical advice series for B2B SaaS founders navigating growth from 0 to $1M ARR. Covers pricing architecture, retention mechanics, the first sales hire, and fundraising readiness — all grounded in data and named examples rather than generic frameworks.',
  '["builtin-linkedin","builtin-x"]',
  '0 10 * * 2,4',
  'active'
),

-- 3. Developer Tools Spotlight — X + Discord · active
(
  'cmp_devtools_spotlight',
  'Developer Tools Spotlight',
  '["x","discord"]',
  'active',
  unixepoch() - 864000,
  'Weekly showcase of emerging developer tools, libraries, and open-source projects. Each feature includes an honest assessment of production readiness, ecosystem fit, and how it compares to established alternatives — written by engineers, for engineers.',
  '["builtin-x","builtin-discord"]',
  '0 18 * * 1',
  'active'
),

-- 4. Build in Public: 90-Day Challenge — X + LinkedIn · active
(
  'cmp_build_public',
  'Build in Public: 90-Day Challenge',
  '["x","linkedin"]',
  'active',
  unixepoch() - 691200,
  'A 90-day transparent record of building AutoSocialX from early access to first 100 paying customers. Daily X updates on raw metrics and real decisions, plus weekly LinkedIn retrospectives on the lessons behind the numbers. No vanity metrics, no spin.',
  '["builtin-x","builtin-linkedin"]',
  '30 8 * * *',
  'active'
),

-- 5. Growth Masterclass Series — LinkedIn · active
(
  'cmp_growth_masterclass',
  'Growth Masterclass Series',
  '["linkedin"]',
  'active',
  unixepoch() - 518400,
  'Monthly deep-dive into a single growth strategy used by a breakout B2B company. Each edition dissects the mechanism, the metrics, the mistakes made, and a precise adaptation playbook for an early-stage team running the same play with fewer resources.',
  '["builtin-linkedin"]',
  '0 11 * * 3',
  'active'
),

-- 6. Global Launch Amplifier — X + LinkedIn + Instagram + XHS · idle
(
  'cmp_launch_amplifier',
  'Global Launch Amplifier',
  '["x","linkedin","instagram","xiaohongshu"]',
  'idle',
  unixepoch() - 345600,
  'Multi-channel product launch framework designed for maximum reach across English and Chinese-speaking markets simultaneously. Coordinates platform-specific content variants, optimised posting windows, and localised messaging — managed from a single campaign.',
  '["builtin-x","builtin-linkedin","builtin-instagram","builtin-xiaohongshu"]',
  NULL,
  'active'
);

-- ─── Content (8 curated pieces) ───────────────────────────────────────────────

INSERT INTO content (
  id, agent_id, platform, text, media_urls, status,
  scheduled_at, published_at, post_id, stats, campaign_id, channel_id
) VALUES

-- 1. Published · X · The AI Scout
(
  'cnt_001',
  'agt_ai_scout',
  'x',
  'The AI landscape just shifted again. Claude''s extended context now handles 200K tokens with near-perfect recall across adversarial benchmarks. We ran it against 847 internal documents — the retrieval precision changes everything about how you should think about RAG architectures. Thread incoming 🧵',
  '[]',
  'published',
  NULL,
  unixepoch() - 7200,
  'x_post_cnt001',
  '{"likes":847,"reposts":312,"replies":94,"impressions":41200}',
  'cmp_ai_revolution',
  'builtin-x'
),

-- 2. Published · LinkedIn · SaaS Metrics Oracle
(
  'cnt_002',
  'agt_saas_oracle',
  'linkedin',
  'After analysing 312 SaaS companies from $1M to $10M ARR, one metric consistently separates top-quartile performers from the rest: Net Revenue Retention above 120%. Here is what the best companies do differently — and why most founders are optimising for entirely the wrong thing.',
  '[]',
  'published',
  NULL,
  unixepoch() - 18000,
  'li_post_cnt002',
  '{"likes":1240,"comments":87,"reposts":203,"impressions":28400}',
  'cmp_saas_playbook',
  'builtin-linkedin'
),

-- 3. Scheduled · X · Thread Weaver
(
  'cnt_003',
  'agt_thread_weaver',
  'x',
  'Why the "move fast and break things" era is over — and what replaces it. The most successful companies in the next decade will be defined by how deliberately they move, not how quickly. A thread on the new operating model taking shape across the industry 🧵',
  '[]',
  'scheduled',
  unixepoch() + 14400,
  NULL,
  NULL,
  '{}',
  'cmp_ai_revolution',
  'builtin-x'
),

-- 4. Published · Discord · DevRel Advocate
(
  'cnt_004',
  'agt_devrel',
  'discord',
  '🚀 OSS highlight this week: shadcn/ui just dropped Blocks — 30+ production-ready page components that actually look like real products, not demo templates. Copy-paste into your Next.js project and you are halfway to a shippable MVP. The Kanban board and the Dashboard layout alone are worth a look.',
  '[]',
  'published',
  NULL,
  unixepoch() - 86400,
  'discord_msg_cnt004',
  '{"reactions":156,"replies":34}',
  'cmp_devtools_spotlight',
  'builtin-discord'
),

-- 5. Scheduled · LinkedIn · GTM Strategy Guide
(
  'cnt_005',
  'agt_gtm_playbook',
  'linkedin',
  'The GTM motion that closed a $4M seed round in under 6 months had nothing to do with cold email or paid acquisition. It started with a 12-page Notion doc shared in three Slack communities. Here is the exact distribution playbook — and why community-led growth is the most defensible early channel for B2B SaaS in 2026.',
  '[]',
  'scheduled',
  unixepoch() + 7200,
  NULL,
  NULL,
  '{}',
  'cmp_saas_playbook',
  'builtin-linkedin'
),

-- 6. Scheduled · Xiaohongshu · XHS Curator
(
  'cnt_006',
  'agt_xhs_curator',
  'xiaohongshu',
  'Tested 12 AI writing tools over 6 weeks so you do not have to. Honest breakdown incoming: which ones genuinely improve your output, which ones are just GPT wrappers with a premium price tag, and the one unexpected tool that became a non-negotiable part of my workflow. No affiliate deals. Just real usage.',
  '[]',
  'scheduled',
  unixepoch() + 50400,
  NULL,
  NULL,
  '{}',
  NULL,
  'builtin-xiaohongshu'
),

-- 7. Published · X · Build in Public
(
  'cnt_007',
  'agt_bip',
  'x',
  'Day 47. Newsletter: 0 → 2,847 subscribers. MRR: $0 → $1,240. The thing that actually moved the needle was not posting more often — it was posting about the metrics themselves. Transparency compounds faster than almost any other growth tactic. Full playbook here, including what completely flopped.',
  '[]',
  'published',
  NULL,
  unixepoch() - 172800,
  'x_post_cnt007',
  '{"likes":2103,"reposts":687,"replies":241,"impressions":89600}',
  'cmp_build_public',
  'builtin-x'
),

-- 8. Draft · LinkedIn · Weekly Tech Digest
(
  'cnt_008',
  'agt_weekly_digest',
  'linkedin',
  'This week in tech: five developments that deserve more attention than they received. From a quiet infrastructure paper out of Google Brain to a pricing model shift that three major SaaS platforms copied within 72 hours — the signals are there for those paying close attention.',
  '[]',
  'draft',
  NULL,
  NULL,
  NULL,
  '{}',
  'cmp_ai_revolution',
  'builtin-linkedin'
);
