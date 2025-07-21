'use client';

import { useEffect, useState, useRef } from "react";
import { createProject, createProjectFromPrompt, createProjectFromWorkflowJson } from "@/app/actions/project_actions";
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { starting_copilot_prompts } from "@/app/lib/project_templates";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { Submit } from "./submit-button";
import { Button } from "@/components/ui/button";
import { FolderOpenIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { USE_MULTIPLE_PROJECTS } from "@/app/lib/feature_flags";
import { HorizontalDivider } from "@/components/ui/horizontal-divider";
import { Tooltip } from "@heroui/react";
import { BillingUpgradeModal } from "@/components/common/billing-upgrade-modal";
import { z } from 'zod';
import { Workflow } from '@/app/lib/types/workflow_types';
import { Modal } from '@/components/ui/modal';
import { FileDown, Send } from "lucide-react";

// Add glow animation styles
const glowStyles = `
    @keyframes glow {
        0% {
            border-color: rgba(99, 102, 241, 0.3);
            box-shadow: 0 0 8px 1px rgba(99, 102, 241, 0.2);
        }
        50% {
            border-color: rgba(99, 102, 241, 0.6);
            box-shadow: 0 0 12px 2px rgba(99, 102, 241, 0.4);
        }
        100% {
            border-color: rgba(99, 102, 241, 0.3);
            box-shadow: 0 0 8px 1px rgba(99, 102, 241, 0.2);
        }
    }

    @keyframes glow-dark {
        0% {
            border-color: rgba(129, 140, 248, 0.3);
            box-shadow: 0 0 8px 1px rgba(129, 140, 248, 0.2);
        }
        50% {
            border-color: rgba(129, 140, 248, 0.6);
            box-shadow: 0 0 12px 2px rgba(129, 140, 248, 0.4);
        }
        100% {
            border-color: rgba(129, 140, 248, 0.3);
            box-shadow: 0 0 8px 1px rgba(129, 140, 248, 0.2);
        }
    }

    .animate-glow {
        animation: glow 2s ease-in-out infinite;
        border-width: 2px;
    }

    .dark .animate-glow {
        animation: glow-dark 2s ease-in-out infinite;
        border-width: 2px;
    }
`;

const TabType = {
    Describe: 'describe',
    Import: 'import',
} as const;

type TabState = typeof TabType[keyof typeof TabType];

const isNotBlankTemplate = (tab: TabState): boolean => true;

const tabStyles = clsx(
    "px-4 py-2 text-sm font-medium",
    "rounded-lg",
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
    "transition-colors duration-150"
);

const activeTabStyles = clsx(
    "bg-white dark:bg-gray-800",
    "text-gray-900 dark:text-gray-100",
    "shadow-sm",
    "border border-gray-200 dark:border-gray-700"
);

const inactiveTabStyles = clsx(
    "text-gray-600 dark:text-gray-400",
    "hover:bg-gray-50 dark:hover:bg-gray-750"
);

const largeSectionHeaderStyles = clsx(
    "text-lg font-medium",
    "text-gray-900 dark:text-gray-100"
);

const textareaStyles = clsx(
    "w-full",
    "rounded-lg p-3",
    "border border-gray-200 dark:border-gray-700",
    "bg-white dark:bg-gray-800",
    "hover:bg-gray-50 dark:hover:bg-gray-750",
    "focus:shadow-inner focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
    "placeholder:text-gray-400 dark:placeholder:text-gray-500",
    "transition-all duration-200"
);

const emptyTextareaStyles = clsx(
    "animate-glow",
    "border-indigo-500/40 dark:border-indigo-400/40",
    "shadow-[0_0_8px_1px_rgba(99,102,241,0.2)] dark:shadow-[0_0_8px_1px_rgba(129,140,248,0.2)]"
);

const tabButtonStyles = clsx(
    "border border-gray-200 dark:border-gray-700"
);

const selectedTabStyles = clsx(
    tabButtonStyles,
    "text-gray-900 dark:text-gray-100",
    "text-base"
);

const unselectedTabStyles = clsx(
    tabButtonStyles,
    "text-gray-900 dark:text-gray-100",
    "text-sm"
);

interface CreateProjectProps {
    defaultName: string;
    onOpenProjectPane: () => void;
    isProjectPaneOpen: boolean;
}

export function CreateProject({ defaultName, onOpenProjectPane, isProjectPaneOpen }: CreateProjectProps) {
    const [selectedTab, setSelectedTab] = useState<TabState>(TabType.Describe);
    const [customPrompt, setCustomPrompt] = useState("");
    const [name, setName] = useState(defaultName);
    const [promptError, setPromptError] = useState<string | null>(null);
    const [billingError, setBillingError] = useState<string | null>(null);
    const [importJson, setImportJson] = useState("");
    const [importError, setImportError] = useState<string | null>(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const router = useRouter();
    const [importLoading, setImportLoading] = useState(false);

    // Add this effect to update name when defaultName changes
    useEffect(() => {
        setName(defaultName);
    }, [defaultName]);

    // Inject glow animation styles
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = glowStyles;
        document.head.appendChild(styleSheet);

        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    // Removed dropdownRef and isExamplesDropdownOpen effect

    const handleTabChange = (tab: TabState) => {
        setSelectedTab(tab);
        setImportError(null);
        if (tab === TabType.Describe) {
            setCustomPrompt('');
        } else if (tab === TabType.Import) {
            setImportJson('');
        }
    };

    async function handleSubmit() {
        try {
            if (!customPrompt.trim()) {
                setPromptError("Prompt cannot be empty");
                return;
            }
            const newFormData = new FormData();
            newFormData.append('name', name);
            newFormData.append('prompt', customPrompt);
            const response = await createProjectFromPrompt(newFormData);
            if ('id' in response) {
                if (customPrompt) {
                    localStorage.setItem(`project_prompt_${response.id}`, customPrompt);
                }
                router.push(`/projects/${response.id}/workflow`);
            } else {
                setBillingError(response.billingError);
            }
        } catch (error) {
            console.error('Error creating project:', error);
        }
    }

    async function handleImportSubmit(e?: React.FormEvent) {
        if (e) e.preventDefault();
        setImportError(null);
        setImportLoading(true);
        let parsed;
        try {
            const json = JSON.parse(importJson);
            parsed = Workflow.safeParse(json);
            if (!parsed.success) {
                setImportError('Invalid workflow JSON: ' + JSON.stringify(parsed.error.issues));
                setImportModalOpen(true);
                setImportLoading(false);
                return;
            }
        } catch (err) {
            setImportError('Invalid JSON: ' + (err instanceof Error ? err.message : String(err)));
            setImportModalOpen(true);
            setImportLoading(false);
            return;
        }
        try {
            const formData = new FormData();
            formData.append('workflowJson', importJson);
            const response = await createProjectFromWorkflowJson(formData);
            if ('id' in response) {
                router.push(`/projects/${response.id}/workflow`);
            } else {
                setBillingError(response.billingError);
            }
        } catch (err) {
            setImportError('Failed to import: ' + (err instanceof Error ? err.message : String(err)));
            setImportModalOpen(true);
        } finally {
            setImportLoading(false);
        }
    }

    return (
        <>
            <div className={clsx(
                "overflow-auto",
                !USE_MULTIPLE_PROJECTS && "max-w-none px-12 py-12",
                USE_MULTIPLE_PROJECTS && !isProjectPaneOpen && "col-span-full"
            )}>
                <section className={clsx(
                    "card h-full",
                    !USE_MULTIPLE_PROJECTS && "px-24",
                    USE_MULTIPLE_PROJECTS && "px-8"
                )}>
                    {USE_MULTIPLE_PROJECTS && (
                        <>
                            <div className="px-4 pt-4 pb-6 flex justify-between items-center">
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                    Create new assistant
                                </h1>
                                {!isProjectPaneOpen && (
                                    <Button
                                        onClick={onOpenProjectPane}
                                        variant="primary"
                                        size="md"
                                        startContent={<FolderOpenIcon className="w-4 h-4" />}
                                    >
                                        View Existing Projects
                                    </Button>
                                )}
                            </div>
                            <HorizontalDivider />
                        </>
                    )}
                    <form
                        id="create-project-form"
                        action={selectedTab !== TabType.Import ? handleSubmit : undefined}
                        className="pt-6 pb-16 space-y-12"
                    >
                        {/* Main Section: What do you want to build? and Import JSON */}
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="flex w-full items-center justify-between">
                                    <label className={largeSectionHeaderStyles}>
                                        ✏️ What do you want to build?
                                    </label>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={() => handleTabChange(TabType.Import)}
                                        type="button"
                                        startContent={<FileDown size={16} />}
                                    >
                                        Import JSON
                                    </Button>
                                </div>
                            </div>
                            {selectedTab === TabType.Describe && (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                In the next step, our AI copilot will create agents for you, complete with mock-tools.
                                            </p>
                                            <Tooltip content={<div>If you already know the specific agents and tools you need, mention them below.<br /><br />Specify &apos;internal agents&apos; for task agents that will not interact with the user and &apos;user-facing agents&apos; for conversational agents that will interact with users.</div>} className="max-w-[560px]">
                                                <InformationCircleIcon className="w-4 h-4 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-help" />
                                            </Tooltip>
                                        </div>
                                        {/* Compose box with send button */}
                                        <div className="relative group">
                                            <Textarea
                                                value={customPrompt}
                                                onChange={(e) => {
                                                    setCustomPrompt(e.target.value);
                                                    setPromptError(null);
                                                }}
                                                placeholder="Example: Create a customer support assistant that can handle product inquiries and returns"
                                                className={clsx(
                                                    textareaStyles,
                                                    "text-base",
                                                    "text-gray-900 dark:text-gray-100",
                                                    promptError && "border-red-500 focus:ring-red-500/20",
                                                    !customPrompt && emptyTextareaStyles,
                                                    "pr-12" // space for send button
                                                )}
                                                style={{ minHeight: "120px" }}
                                                autoFocus
                                                autoResize
                                                required
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSubmit();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={!customPrompt.trim()}
                                                className={clsx(
                                                    "absolute right-3 bottom-3",
                                                    "rounded-full p-2",
                                                    customPrompt.trim()
                                                        ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/60 dark:text-indigo-300"
                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500",
                                                    "transition-all duration-200 scale-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-95 hover:shadow-md dark:hover:shadow-indigo-950/10"
                                                )}
                                            >
                                                <Send size={18} />
                                            </button>
                                            {promptError && (
                                                <p className="text-sm text-red-500 mt-2">
                                                    {promptError}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedTab === TabType.Import && (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-4">
                                        <label className="text-base font-medium text-gray-900 dark:text-gray-100">
                                            🗂️ Paste JSON Contents
                                        </label>
                                        <Textarea
                                            value={importJson}
                                            onChange={e => setImportJson(e.target.value)}
                                            placeholder="Paste your workflow JSON here..."
                                            className={clsx(
                                                textareaStyles,
                                                "text-base",
                                                "text-gray-900 dark:text-gray-100",
                                                !importJson && emptyTextareaStyles
                                            )}
                                            style={{ minHeight: "180px" }}
                                            autoFocus
                                            autoResize
                                            required
                                        />
                                        <div className="flex flex-col items-start gap-2">
                                            {importLoading && (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    Please hold on while we set up your project&hellip;
                                                </div>
                                            )}
                                            <Button
                                                variant="primary"
                                                size="lg"
                                                onClick={handleImportSubmit}
                                                type="button"
                                                isLoading={importLoading}
                                            >
                                                Import and create assistant
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Name Section */}
                        {/* Project name input removed, but naming logic is preserved in state and form submission */}
                        {/* Submit Button */}
                    </form>
                </section>
            </div>
            <BillingUpgradeModal
                isOpen={!!billingError}
                onClose={() => setBillingError(null)}
                errorMessage={billingError || ''}
            />
            <Modal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                title="Import Error"
            >
                <div className="text-red-500 text-sm whitespace-pre-wrap">
                    {importError}
                </div>
            </Modal>
        </>
    );
}
