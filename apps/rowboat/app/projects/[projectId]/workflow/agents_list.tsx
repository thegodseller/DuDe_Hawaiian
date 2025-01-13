import { Dropdown, DropdownItem, DropdownTrigger, DropdownMenu } from "@nextui-org/react";
import { WorkflowAgent } from "@/app/lib/types";
import { z } from "zod";
import { useRef, useEffect } from "react";
import { ActionButton, Pane } from "./pane";

export function AgentsList({
    agents,
    handleSelectAgent,
    handleAddAgent,
    handleToggleAgent,
    selectedAgent,
    handleSetMainAgent,
    handleDeleteAgent,
    startAgentName,
}: {
    agents: z.infer<typeof WorkflowAgent>[];
    handleSelectAgent: (name: string) => void;
    handleAddAgent: (agent: Partial<z.infer<typeof WorkflowAgent>>) => void;
    handleToggleAgent: (name: string) => void;
    selectedAgent: string | null;
    handleSetMainAgent: (name: string) => void;
    handleDeleteAgent: (name: string) => void;
    startAgentName: string | null;
}) {
    const selectedAgentRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const selectedAgentIndex = agents.findIndex(agent => agent.name === selectedAgent);
        if (selectedAgentIndex !== -1 && selectedAgentRef.current) {
            selectedAgentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedAgent, agents]);

    return <Pane title="Agents" actions={[
        <ActionButton
            key="add"
            icon={<svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7 7V5" />
            </svg>}
            onClick={() => handleAddAgent({})}
        >
            Add
        </ActionButton>
    ]}>
        <div className="overflow-auto flex flex-col justify-start">
            {agents.map((agent, index) => (
                <button
                    key={index}
                    ref={selectedAgent === agent.name ? selectedAgentRef : null}
                    onClick={() => handleSelectAgent(agent.name)}
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${selectedAgent === agent.name ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                    <div className={`truncate ${agent.disabled ? 'text-gray-400' : ''}`}>{agent.name}</div>
                    <div className="flex items-center gap-2">
                        {startAgentName === agent.name && <div className="text-xs border bg-blue-500 text-white px-2 py-1 rounded-md">Start</div>}
                        <Dropdown key={agent.name}>
                            <DropdownTrigger>
                                <svg className="w-6 h-6 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="3" d="M12 6h.01M12 12h.01M12 18h.01" />
                                </svg>
                            </DropdownTrigger>
                            <DropdownMenu
                                disabledKeys={[
                                    ...(!agent.toggleAble ? ['toggle'] : []),
                                    ...(agent.locked ? ['delete', 'set-main-agent'] : []),
                                    ...(startAgentName === agent.name ? ['set-main-agent', 'delete', 'toggle'] : []),
                                ]}
                                onAction={(key) => {
                                    switch (key) {
                                        case 'set-main-agent':
                                            handleSetMainAgent(agent.name);
                                            break;
                                        case 'delete':
                                            handleDeleteAgent(agent.name);
                                            break;
                                        case 'toggle':
                                            handleToggleAgent(agent.name);
                                            break;
                                    }
                                }}
                            >
                                <DropdownItem key="set-main-agent">Set as start agent</DropdownItem>
                                <DropdownItem key="toggle">{agent.disabled ? 'Enable' : 'Disable'}</DropdownItem>
                                <DropdownItem key="delete" className="text-danger">Delete</DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                </button>
            ))}
        </div>
    </Pane>;
}
