import type { ToolDefinition } from '../../types'
import { skillRegistry } from '../../skill-use/registry'

export const loadSkillTool: ToolDefinition = {
    name: 'read_skill',
    description:
        'Load detailed instructions, guidelines, and SOPs for a specific skill. Use this when you are asked to perform a complex task and there is a matching skill in the <available_skills> block. It provides you with the expert knowledge needed to proceed.',
    inputSchema: {
        type: 'object',
        properties: {
            skill_name: {
                type: 'string',
                description: 'The exact name of the skill to load (e.g., from <available_skills>).',
            },
        },
        required: ['skill_name'],
    },
    requiredPermission: 'tool:read_skill',
    handler: async (args, _ctx) => {
        const skillName = args['skill_name'] as string
        const content = skillRegistry.getSkillContent(skillName)

        if (!content) {
            return {
                error: `Skill '${skillName}' not found. Please verify the name matches an entry in your <available_skills> block.`,
            }
        }

        return {
            message: `Successfully loaded skill '${skillName}'. Please read the following instructions carefully and execute the task based on them.`,
            instructions: content,
        }
    },
}
