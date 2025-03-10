interface AtMentionItem {
    id: string;
    value: string;
    [key: string]: string;  // Add index signature to allow any string key
}

interface CreateAtMentionsProps {
    agents: any[];
    prompts: any[];
    tools: any[];
    currentAgentName?: string;
}

export function createAtMentions({ agents, prompts, tools, currentAgentName }: CreateAtMentionsProps): AtMentionItem[] {
    const atMentions: AtMentionItem[] = [];

    // Add agents
    for (const a of agents) {
        if (a.disabled || a.name === currentAgentName) {
            continue;
        }
        const id = `agent:${a.name}`;
        atMentions.push({
            id,
            value: id,
            denotationChar: "@",    // Add required properties for Match type
            link: id,
            target: "_self"
        });
    }

    // Add prompts
    for (const prompt of prompts) {
        const id = `prompt:${prompt.name}`;
        atMentions.push({
            id,
            value: id,
            denotationChar: "@",
            link: id,
            target: "_self"
        });
    }

    // Add tools
    for (const tool of tools) {
        const id = `tool:${tool.name}`;
        atMentions.push({
            id,
            value: id,
            denotationChar: "@",
            link: id,
            target: "_self"
        });
    }

    return atMentions;
} 