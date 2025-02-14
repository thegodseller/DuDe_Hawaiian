import { z } from "zod";
export const WorkflowAgent = z.object({
    name: z.string(),
    type: z.union([
        z.literal('conversation'),
        z.literal('post_process'),
        z.literal('escalation'),
    ]),
    description: z.string(),
    disabled: z.boolean().default(false).optional(),
    instructions: z.string(),
    examples: z.string().optional(),
    prompts: z.array(z.string()),
    tools: z.array(z.string()),
    model: z.union([
        z.literal('gpt-4o'),
        z.literal('gpt-4o-mini'),
    ]),
    locked: z.boolean().default(false).describe('Whether this agent is locked and cannot be deleted').optional(),
    toggleAble: z.boolean().default(true).describe('Whether this agent can be enabled or disabled').optional(),
    global: z.boolean().default(false).describe('Whether this agent is a global agent, in which case it cannot be connected to other agents').optional(),
    ragDataSources: z.array(z.string()).optional(),
    ragReturnType: z.union([z.literal('chunks'), z.literal('content')]).default('chunks'),
    ragK: z.number().default(3),
    connectedAgents: z.array(z.string()),
    controlType: z.union([z.literal('retain'), z.literal('relinquish_to_parent'), z.literal('relinquish_to_start')]).default('retain').describe('Whether this agent retains control after a turn, relinquishes to the parent agent, or relinquishes to the start agent'),
});
export const WorkflowPrompt = z.object({
    name: z.string(),
    type: z.union([
        z.literal('base_prompt'),
        z.literal('style_prompt'),
    ]),
    prompt: z.string(),
});
export const WorkflowTool = z.object({
    name: z.string(),
    description: z.string(),
    mockInPlayground: z.boolean().default(false).optional(),
    autoSubmitMockedResponse: z.boolean().default(false).optional(),
    parameters: z.object({
        type: z.literal('object'),
        properties: z.record(z.object({
            type: z.string(),
            description: z.string(),
        })),
        required: z.array(z.string()).optional(),
    }),
});
export const Workflow = z.object({
    name: z.string().optional(),
    agents: z.array(WorkflowAgent),
    prompts: z.array(WorkflowPrompt),
    tools: z.array(WorkflowTool),
    startAgent: z.string(),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
    projectId: z.string(),
});
export const WorkflowTemplate = Workflow
    .omit({
        projectId: true,
        lastUpdatedAt: true,
        createdAt: true,
    })
    .extend({
        name: z.string(),
        description: z.string(),
    });

