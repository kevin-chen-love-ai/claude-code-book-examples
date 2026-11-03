-- Migration 012: Re-seed campaigns and content that failed in 011 due to
-- a semicolon inside a string value breaking the statement splitter.
-- Uses INSERT OR REPLACE so it is safe to run on both fresh and existing DBs.

DELETE FROM content;

INSERT OR REPLACE INTO campaigns (
  id, name, platforms, status, created_at,
  description, channel_ids, cron_expr, cron_status
) VALUES
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
(
  'cmp_launch_amplifier',
  'Global Launch Amplifier',
  '["x","linkedin","instagram","xiaohongshu"]',
  'idle',
  unixepoch() - 345600,
  'Multi-channel product launch framework for maximum reach across English and Chinese-speaking markets simultaneously. Coordinates platform-specific content variants, optimised posting windows, and localised messaging — managed from a single campaign.',
  '["builtin-x","builtin-linkedin","builtin-instagram","builtin-xiaohongshu"]',
  NULL,
  'active'
);

INSERT OR REPLACE INTO content (
  id, agent_id, platform, text, media_urls, status,
  scheduled_at, published_at, post_id, stats, campaign_id, channel_id
) VALUES
(
  'cnt_001',
  'agt_ai_scout',
  'x',
  'The AI landscape just shifted again. Claude''s extended context now handles 200K tokens with near-perfect recall across adversarial benchmarks. We ran it against 847 internal documents — the retrieval precision changes everything about how you should think about RAG architectures. Thread incoming.',
  '[]',
  'published',
  NULL,
  unixepoch() - 7200,
  'x_post_cnt001',
  '{"likes":847,"reposts":312,"replies":94,"impressions":41200}',
  'cmp_ai_revolution',
  'builtin-x'
),
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
(
  'cnt_003',
  'agt_thread_weaver',
  'x',
  'Why the "move fast and break things" era is over — and what replaces it. The most successful companies in the next decade will be defined by how deliberately they move, not how quickly. A thread on the new operating model taking shape across the industry.',
  '[]',
  'scheduled',
  unixepoch() + 14400,
  NULL,
  NULL,
  '{}',
  'cmp_ai_revolution',
  'builtin-x'
),
(
  'cnt_004',
  'agt_devrel',
  'discord',
  'OSS highlight this week: shadcn/ui just dropped Blocks — 30+ production-ready page components that actually look like real products, not demo templates. Copy-paste into your Next.js project and you are halfway to a shippable MVP. The Kanban board and the Dashboard layout alone are worth a look.',
  '[]',
  'published',
  NULL,
  unixepoch() - 86400,
  'discord_msg_cnt004',
  '{"reactions":156,"replies":34}',
  'cmp_devtools_spotlight',
  'builtin-discord'
),
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
(
  'cnt_007',
  'agt_bip',
  'x',
  'Day 47. Newsletter: 0 to 2,847 subscribers. MRR: $0 to $1,240. The thing that actually moved the needle was not posting more often — it was posting about the metrics themselves. Transparency compounds faster than almost any other growth tactic. Full playbook here, including what completely flopped.',
  '[]',
  'published',
  NULL,
  unixepoch() - 172800,
  'x_post_cnt007',
  '{"likes":2103,"reposts":687,"replies":241,"impressions":89600}',
  'cmp_build_public',
  'builtin-x'
),
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
