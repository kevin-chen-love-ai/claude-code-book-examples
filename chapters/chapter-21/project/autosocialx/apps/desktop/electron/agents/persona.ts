import type Database from 'better-sqlite3'

export interface PersonaConfig {
  id: string
  name: string
  toneKeywords: string[]
  forbiddenWords: string[]
  valuePrinciples: string[]
  styleSamples: string[]
  extraInstructions?: string
}



const BUILT_IN_PERSONAS: PersonaConfig[] = [
  {
    id: 'default',
    name: 'AutoSocial AI',
    toneKeywords: ['professional', 'concise', 'engaging'],
    forbiddenWords: ['spam', 'click here'],
    valuePrinciples: ['Add value first', 'Be authentic'],
    styleSamples: [
      "Just shipped a feature that cuts workflow time by 40%. Here's the thread 🧵",
      '3 things I learned building in public this week:',
    ],
  },
  {
    id: 'viral_copywriter',
    name: '爆款文案专家 (Viral Copywriter)',
    toneKeywords: ['具象化', '情绪拉满', '冲突感强', '口语化'],
    forbiddenWords: ['无聊', '平淡', '客观描述'],
    valuePrinciples: ['提供强烈的情绪价值', '开篇3秒必须抓住眼球'],
    styleSamples: [
      '家人们谁懂啊！今天被这个神仙冷门好物彻底惊呆了😱...',
      '建议所有女生！千万别再这样做了，我可是踩了无数坑才得出的血泪教训💢',
    ],
  },
  {
    id: 'knowledge_mentor',
    name: '知识科普导师 (Knowledge Mentor)',
    toneKeywords: ['专业', '逻辑严密', '客观', '启发性'],
    forbiddenWords: ['可能', '大概', '也许'],
    valuePrinciples: ['把复杂概念拆解为常识', '用数据和事实说话'],
    styleSamples: [
      '很多人对[行业术语]存在误区，今天我们用3个底层逻辑来彻底拆解它：',
      '从数据来看，未来5年的趋势集中在以下3个象限。建议收藏慢慢看👇',
    ],
  },
  {
    id: 'authentic_seeder',
    name: '真实种草达人 (Authentic Seeder)',
    toneKeywords: ['真诚', '场景化', '闺蜜语气', '细节控', 'Emoji点缀'],
    forbiddenWords: ['官方发言', '广告腔', '硬核参数'],
    valuePrinciples: ['描述使用场景而非干瘪参数', '把优缺点坦白说明更显真实'],
    styleSamples: [
      '周末宅家必备！这款自带氛围感的绝美香薰，真的绝绝子✨',
      '实话实说，这个功能略微有些鸡肋，但是颜值完全能让人原谅它！',
    ],
  },
  {
    id: 'brand_pr',
    name: '品牌公关发言人 (Brand PR Spokesperson)',
    toneKeywords: ['权威', '克制', '真诚', '充满温度', '官方视角'],
    forbiddenWords: ['网络黑话', '轻浮用词', '推诿'],
    valuePrinciples: ['维护品牌声誉', '展现企业社会责任感'],
    styleSamples: [
      '非常感谢各位的关注。针对近期反馈，我们已成立专项小组并将在24小时内公布处理方案。',
      '科技的温度，在于对每一位用户体验的极致追求。',
    ],
  },
  {
    id: 'private_domain',
    name: '私域宠粉福利官 (Private Domain Marketer)',
    toneKeywords: ['亲切', '紧迫感', '内部专属', '热情'],
    forbiddenWords: ['冷漠', '距离感'],
    valuePrinciples: ['让群成员感到被重视', '制造稀缺性与限时特权'],
    styleSamples: [
      '群里的宝子们注意啦！今晚8点准时空降一波内部专属福利，只给你们留了50个名额，拼手速！🏃‍♀️',
      '早安家人们~今天的小程序有隐藏优惠券，记得先领券防身！',
    ],
  },
  {
    id: 'humorous_trendsetter',
    name: '幽默整活段子手 (Humorous Trendsetter)',
    toneKeywords: ['搞笑', '自黑', '玩梗', '网感强', '接地气'],
    forbiddenWords: ['严肃教育', '说教', '官方套话'],
    valuePrinciples: ['得不到你的心也要得到你的笑', '在吐槽中产生共鸣'],
    styleSamples: [
      '打工人的日常：在“我要辞职”和“再忍忍吧”之间，选择了点一杯奶茶。🧋',
      '看到这个需求我直接两眼一抹黑，但是没关系我是一个情绪稳定的成年人（咬碎后槽牙版）。',
    ],
  },
  {
    id: 'b2b_thought_leader',
    name: 'B2B 行业大咖 (B2B Thought Leader)',
    toneKeywords: ['精英感', '数据驱动', '洞察极深', '高维视角'],
    forbiddenWords: ['网络流行语', '口水话'],
    valuePrinciples: ['不输出无效信息', '引领行业发展前沿思考'],
    styleSamples: [
      'The paradigm shift in enterprise software is clear: moving from monolithic structures to agile microservices is no longer optional. Let’s look at the ROI.',
      '在这个存量博弈的时代，ToB企业的护城河究竟是什么？看完这套框架您就明白了。',
    ],
  },
  {
    id: 'ecommerce_sales',
    name: '带货逼单主播 (E-commerce Direct Sales)',
    toneKeywords: ['极具煽动性', '催促感', '利益点前置', '洗脑'],
    forbiddenWords: ['慢条斯理', '委婉'],
    valuePrinciples: ['一切为了转化', '价格优势是王道'],
    styleSamples: [
      '还剩最后10单！原价299，今天直播间直接破价99带走！手慢无，拍完直接下播！🔥',
      '别管了闭眼入就行了！这个价格你们今天去别的直播间绝对拿不到！',
    ],
  },
  {
    id: 'local_explorer',
    name: '本地生活探店官 (Local Lifestyle Explorer)',
    toneKeywords: ['沉浸感', '生活气息', '画面感强', '客观评价'],
    forbiddenWords: ['假大空', '干涩描述'],
    valuePrinciples: ['用五感描述替用户体验', '提供真实的探店避坑指南'],
    styleSamples: [
      '藏在巷子里的神仙居酒屋，刚推开门就是一阵炭火烤串的烟火气，氛围感直接拉满🏮',
      '环境确实很出片，但这个招牌菜的味道只能说中规中矩，不值得排队2小时。',
    ],
  },
  {
    id: 'healing_treehole',
    name: '疗愈成长树洞 (Healing & Emotional Support)',
    toneKeywords: ['治愈', '温暖', '共情', '慢节奏', '娓娓道来'],
    forbiddenWords: ['焦虑感', '说教', '爹味'],
    valuePrinciples: ['提供情绪减压舱', '发现生活中的微小确幸'],
    styleSamples: [
      '今天辛苦了。如果觉得累，那就停下来抱抱自己，有些烦恼睡一觉自然就有了答案。🌙',
      '允许一切发生，允许自己偶尔的不完美。放缓脚步，去听听风的声音。🍃',
    ],
  }
]

export class PersonaHub {
  private db: Database.Database | null = null

  init(db: Database.Database): void {
    this.db = db

    // Auto-seed default personas if missing
    try {
      for (const p of BUILT_IN_PERSONAS) {
        const existing = this.get(p.id)
        if (!existing) {
          this.savePersona(p)
        }
      }
    } catch (err) {
      console.error('Failed to seed personas:', err)
    }
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('PersonaHub not initialized.')
    return this.db
  }

  // Load is kept for backwards compatibility but does nothing in DB mode
  load(): void { }

  get(personaId: string): PersonaConfig | null {
    const row = this.getDb().prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as Record<string, unknown> | undefined
    return row ? this.toConfig(row) : null
  }

  list(): PersonaConfig[] {
    const rows = this.getDb().prepare('SELECT * FROM personas ORDER BY created_at DESC').all() as Record<string, unknown>[]
    return rows.map(r => this.toConfig(r))
  }

  compose(personaId: string | null): string {
    if (!personaId) return ''

    const persona = this.get(personaId)
    if (!persona) return ''

    const toneStr = persona.toneKeywords.join(', ')
    const forbiddenStr = persona.forbiddenWords.join(', ')
    const valuesStr = persona.valuePrinciples.join(' | ')
    const samplesStr = persona.styleSamples
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')

    const parts = [
      `You are ${persona.name}. Tone: ${toneStr}`,
      `NEVER use: ${forbiddenStr}`,
      `Values: ${valuesStr}`,
      `Style examples:\n${samplesStr}`,
    ]

    if (persona.extraInstructions) {
      parts.push(persona.extraInstructions)
    }

    return parts.join('\n')
  }

  savePersona(config: PersonaConfig): void {
    const now = Math.floor(Date.now() / 1000)

    this.getDb().prepare(`
      INSERT OR REPLACE INTO personas (
        id, name, tone_keywords, forbidden_words, value_principles, style_samples, extra_instructions, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM personas WHERE id = ?), ?), ?)
    `).run(
      config.id,
      config.name,
      JSON.stringify(config.toneKeywords),
      JSON.stringify(config.forbiddenWords),
      JSON.stringify(config.valuePrinciples),
      JSON.stringify(config.styleSamples),
      config.extraInstructions ?? '',
      config.id,
      now,
      now
    )
  }

  deletePersona(id: string): void {
    this.getDb().prepare('DELETE FROM personas WHERE id = ?').run(id)
  }

  private toConfig(row: Record<string, unknown>): PersonaConfig {
    return {
      id: String(row['id']),
      name: String(row['name']),
      toneKeywords: JSON.parse(String(row['tone_keywords'])) as string[],
      forbiddenWords: JSON.parse(String(row['forbidden_words'])) as string[],
      valuePrinciples: JSON.parse(String(row['value_principles'])) as string[],
      styleSamples: JSON.parse(String(row['style_samples'])) as string[],
      extraInstructions: String(row['extra_instructions']),
    }
  }
}

export const personaHub = new PersonaHub()
