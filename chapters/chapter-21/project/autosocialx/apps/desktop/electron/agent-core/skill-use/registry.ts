import { app } from 'electron'
import { join } from 'node:path'
import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import * as os from 'node:os'
import { configStore } from '../../config-store'

export type SkillManifest = {
    name: string
    description?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema?: any
}

// ── Inline SKILL.md parser (replaces openskills dependency) ───────────────────
// Format: optional YAML frontmatter between --- delimiters, then markdown body.

function parseYamlField(frontmatter: string, field: string): string | undefined {
    const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
    return match?.[1]?.trim()
}

interface ParsedSkill {
    name: string
    description?: string
    instructions: string
    inputSchemaRaw?: string
}

function parseSkillMd(content: string): ParsedSkill | null {
    let frontmatter = ''
    let body = content

    if (content.startsWith('---')) {
        const end = content.indexOf('\n---', 3)
        if (end !== -1) {
            frontmatter = content.slice(3, end).trim()
            body = content.slice(end + 4).trim()
        }
    }

    const name = parseYamlField(frontmatter, 'name')
    if (!name) return null

    // Extract inputSchema definition from frontmatter if present
    const schemaMatch = frontmatter.match(/^inputSchema:[\s\S]*?(?=\n\w+:|$)/m)
    const inputSchemaRaw = schemaMatch ? schemaMatch[0] : undefined

    return {
        name,
        description: parseYamlField(frontmatter, 'description'),
        instructions: body,
        inputSchemaRaw
    }
}

function loadSkillsFromDir(rootDir: string): ParsedSkill[] {
    if (!existsSync(rootDir)) return []
    const results: ParsedSkill[] = []

    for (const entry of readdirSync(rootDir)) {
        const skillDir = join(rootDir, entry)
        if (!statSync(skillDir).isDirectory()) continue

        const mdPath = join(skillDir, 'SKILL.md')
        if (!existsSync(mdPath)) continue

        try {
            const content = readFileSync(mdPath, 'utf-8')
            const parsed = parseSkillMd(content)
            if (parsed) results.push(parsed)
        } catch (err) {
            console.warn(`[SkillRegistry] Failed to parse ${mdPath}:`, err)
        }
    }

    return results
}

// ── SkillRegistry ─────────────────────────────────────────────────────────────

export class SkillRegistry {
    private skillsMap = new Map<string, string>() // name -> markdown instructions
    private metadataMap = new Map<string, SkillManifest>() // name -> metadata
    private initialized = false

    async init(): Promise<void> {
        if (this.initialized) return

        const skillsDir = this.getSkillsDir()
        console.log(`[SkillRegistry] Loading skills from ${skillsDir}`)

        try {
            const skills = loadSkillsFromDir(skillsDir)
            if (skills.length === 0) {
                console.log('[SkillRegistry] No skills found.')
            } else {
                console.log(`[SkillRegistry] Loaded ${skills.length} skills`)
            }

            for (const skill of skills) {
                this.skillsMap.set(skill.name, skill.instructions)
                this.metadataMap.set(skill.name, {
                    name: skill.name,
                    description: skill.description,
                })
            }
        } catch (err) {
            console.error('[SkillRegistry] Failed to load skills:', err)
        }

        this.initialized = true
    }

    /** Returns all skills (both enabled and disabled), with their enabled status from configStore. */
    listAll(): Array<SkillManifest & { enabled: boolean }> {
        return Array.from(this.metadataMap.values()).map(skill => ({
            ...skill,
            enabled: configStore.isSkillEnabled(skill.name),
        }))
    }

    /** Returns the XML manifest of all ENABLED skills for injecting into agent prompts. */
    getAvailabilityManifest(): string {
        const skills = Array.from(this.metadataMap.values()).filter(s =>
            configStore.isSkillEnabled(s.name)
        )
        if (skills.length === 0) return ''

        let xml = '<available_skills>\n'
        for (const skill of skills) {
            xml += `  <skill>\n`
            xml += `    <name>${skill.name}</name>\n`
            if (skill.description) {
                xml += `    <description>${skill.description}</description>\n`
            }
            xml += `  </skill>\n`
        }
        xml += '</available_skills>'
        return xml
    }

    getSkillContent(name: string): string | null {
        return this.skillsMap.get(name) || null
    }

    getSkillsDir(): string {
        const base = app?.getPath ? app.getPath('userData') : join(os.homedir(), '.autosocialx')
        const p = join(base, 'skills')
        if (!existsSync(p)) mkdirSync(p, { recursive: true })
        return p
    }

    getTemplatesDir(): string {
        const base = app?.getPath ? app.getPath('userData') : join(os.homedir(), '.autosocialx')
        const p = join(base, 'skills-templates')
        if (!existsSync(p)) mkdirSync(p, { recursive: true })
        return p
    }

    /** Lists valid templates from the skills-templates directory */
    listTemplates(): Array<SkillManifest & { isInstalled: boolean }> {
        const templatesDir = this.getTemplatesDir()
        const parsedTemplates = loadSkillsFromDir(templatesDir)

        return parsedTemplates.map(t => ({
            name: t.name,
            description: t.description,
            isInstalled: this.metadataMap.has(t.name)
        }))
    }

    /** Validate a template from a string content */
    validateTemplate(content: string): { ok: boolean, data?: ParsedSkill, error?: string } {
        const parsed = parseSkillMd(content)
        if (!parsed) return { ok: false, error: 'Failed to parse SKILL.md. Ensure it starts with YAML frontmatter containing `name`.' }
        if (!parsed.name || !/^[a-zA-Z0-9_-]+$/.test(parsed.name)) return { ok: false, error: 'Skill name must be alphanumeric with dashes/underscores only.' }
        if (!parsed.description) return { ok: false, error: 'Missing `description` field.' }
        if (!parsed.instructions || parsed.instructions.trim() === '') return { ok: false, error: 'Missing instructions/content body.' }
        if (parsed.inputSchemaRaw && !parsed.inputSchemaRaw.includes('type: object')) {
            return { ok: false, error: 'Invalid inputSchema format in YAML frontmatter.' }
        }
        return { ok: true, data: parsed }
    }

    /** Clear state and re-scan the skills directory. */
    async reload(): Promise<void> {
        this.skillsMap.clear()
        this.metadataMap.clear()
        this.initialized = false
        await this.init()
    }
}

export const skillRegistry = new SkillRegistry()
