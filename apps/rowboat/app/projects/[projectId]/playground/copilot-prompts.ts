export const FIX_WORKFLOW_PROMPT = `There is an issue with this turn of chat: "{chat_turn}" 

Fix the issue by updating necessary agents and tools.`;

export const FIX_WORKFLOW_PROMPT_WITH_FEEDBACK = `${FIX_WORKFLOW_PROMPT}

Here are more details: {feedback}`;
