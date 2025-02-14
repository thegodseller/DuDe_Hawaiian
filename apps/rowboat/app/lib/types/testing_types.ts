import { z } from "zod";
export const Scenario = z.object({
    projectId: z.string(),
    name: z.string().min(1, "Name cannot be empty"),
    description: z.string().min(1, "Description cannot be empty"),
    context: z.string().default(''),
    createdAt: z.string().datetime(),
    lastUpdatedAt: z.string().datetime(),
});export const SimulationArticleData = z.object({
    articleUrl: z.string(),
    articleTitle: z.string().default('').optional(),
    articleContent: z.string().default('').optional(),
});
export const SimulationScenarioData = z.object({
    scenario: z.string(),
    context: z.string().default(''),
});
export const SimulationChatMessagesData = z.object({
    chatMessages: z.string(),
});
export const SimulationData = z.union([SimulationArticleData, SimulationScenarioData, SimulationChatMessagesData]);

