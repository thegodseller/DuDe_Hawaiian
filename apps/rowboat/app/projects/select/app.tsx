'use client';

import { Project } from "../../lib/types/project_types";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { listProjects, createProject, createProjectFromPrompt } from "../../actions/project_actions";
import { useRouter } from 'next/navigation';
import { tokens } from "@/app/styles/design-tokens";
import clsx from 'clsx';
import { templates, starting_copilot_prompts } from "@/app/lib/project_templates";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { SearchProjects } from "./components/search-projects";
import { CustomPromptCard } from "./components/custom-prompt-card";
import { Submit } from "./components/submit-button";
import { PageHeading } from "@/components/ui/page-heading";
import { USE_MULTIPLE_PROJECTS } from "@/app/lib/feature_flags";
import { FolderOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

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
    Blank: 'blank',
    Example: 'example'
} as const;

type TabState = typeof TabType[keyof typeof TabType];

// Add a type guard to help TypeScript understand the comparison
const isNotBlankTemplate = (tab: TabState): boolean => tab !== 'blank';

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

const sectionHeaderStyles = clsx(
    "text-sm font-medium",
    "text-gray-900 dark:text-gray-100"
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
    "border border-gray-200 dark:border-gray-700" // Border for all states
);

const selectedTabStyles = clsx(
    tabButtonStyles,
    "text-gray-900 dark:text-gray-100",
    "text-base" // Normal font size for selected tab
);

const unselectedTabStyles = clsx(
    tabButtonStyles,
    "text-gray-900 dark:text-gray-100",
    "text-sm" // Smaller font size for unselected tabs
);

export default function App() {
    const [projects, setProjects] = useState<z.infer<typeof Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProjectPaneOpen, setIsProjectPaneOpen] = useState(false);
    
    const [selectedTab, setSelectedTab] = useState<TabState>(TabType.Describe);
    const [isExamplesDropdownOpen, setIsExamplesDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [customPrompt, setCustomPrompt] = useState("");
    const [name, setName] = useState("");
    const [defaultName, setDefaultName] = useState('Assistant 1');
    const [promptError, setPromptError] = useState<string | null>(null);

    // Inject glow animation styles
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = glowStyles;
        document.head.appendChild(styleSheet);

        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    const getNextAssistantNumber = (projects: z.infer<typeof Project>[]) => {
        const untitledProjects = projects
            .map(p => p.name)
            .filter(name => name.startsWith('Assistant '))
            .map(name => {
                const num = parseInt(name.replace('Assistant ', ''));
                return isNaN(num) ? 0 : num;
            });

        if (untitledProjects.length === 0) return 1;
        return Math.max(...untitledProjects) + 1;
    };

    useEffect(() => {
        let ignore = false;

        async function fetchProjects() {
            setIsLoading(true);
            const projects = await listProjects();
            if (!ignore) {
                // Sort projects by createdAt in descending order (newest first)
                const sortedProjects = [...projects].sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                
                setProjects(sortedProjects);
                setIsLoading(false);
                const nextNumber = getNextAssistantNumber(sortedProjects);
                const newDefaultName = `Assistant ${nextNumber}`;
                setDefaultName(newDefaultName);
                setName(newDefaultName);
            }
        }

        fetchProjects();

        return () => {
            ignore = true;
        }
    }, []);

    // Add click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsExamplesDropdownOpen(false);
            }
        }

        if (isExamplesDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExamplesDropdownOpen]);

    const handleTabChange = (tab: TabState) => {
        setSelectedTab(tab);
        setIsExamplesDropdownOpen(false);

        if (tab === TabType.Blank) {
            setCustomPrompt('');
        } else if (tab === TabType.Describe) {
            setCustomPrompt('');
        }
    };

    const handleBlankTemplateClick = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent any form submission
        handleTabChange(TabType.Blank);
    };

    const handleExampleSelect = (exampleName: string) => {
        setSelectedTab(TabType.Example);
        setCustomPrompt(starting_copilot_prompts[exampleName] || '');
        setIsExamplesDropdownOpen(false);
    };

    const router = useRouter();

    const validatePrompt = (value: string) => {
        if (!value.trim()) {
            return { valid: false, errorMessage: "Prompt cannot be empty" };
        }
        return { valid: true };
    };

    async function handleSubmit(formData: FormData) {
        try {
            // Validate prompt if custom prompt section is shown
            if (selectedTab !== TabType.Blank && !customPrompt.trim()) {
                setPromptError("Prompt cannot be empty");
                return;
            }

            let response;
            
            if (selectedTab === TabType.Blank) {
                const newFormData = new FormData();
                newFormData.append('name', name);
                newFormData.append('template', 'default');
                response = await createProject(newFormData);
            } else {
                const newFormData = new FormData();
                newFormData.append('name', name);
                newFormData.append('prompt', customPrompt);
                response = await createProjectFromPrompt(newFormData);
                
                if (response?.id && customPrompt) {
                    localStorage.setItem(`project_prompt_${response.id}`, customPrompt);
                }
            }

            if (!response?.id) {
                throw new Error('Project creation failed');
            }

            router.push(`/projects/${response.id}/workflow`);
        } catch (error) {
            console.error('Error creating project:', error);
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Only allow Enter key submission for non-blank templates and when not in a textarea
        if (e.key === 'Enter' && 
            selectedTab !== TabType.Blank && 
            (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault();
            const formData = new FormData();
            formData.append('name', name);
            handleSubmit(formData);
        }
    };

    return (
        <div className={clsx(
            "min-h-screen flex flex-col",
            tokens.colors.light.background,
            tokens.colors.dark.background
        )}>
            <div className={clsx(
                "flex-1 px-12 pt-4 pb-32"
            )}>
                <PageHeading 
                    title={USE_MULTIPLE_PROJECTS ? "Projects" : "Let's get started"}
                    description={USE_MULTIPLE_PROJECTS 
                        ? "Select an existing project or create a new one"
                        : "Create a multi-agent assistant in minutes"
                    }
                />

                <div className={clsx(
                    USE_MULTIPLE_PROJECTS 
                        ? "grid grid-cols-1 lg:grid-cols-[1fr,2fr] gap-8 mt-8"
                        : "mt-8 -mx-12"
                )}>
                    {/* Left side: Project Selection */}
                    {USE_MULTIPLE_PROJECTS && isProjectPaneOpen && (
                        <div className="overflow-auto">
                            <SearchProjects
                                projects={projects}
                                isLoading={isLoading}
                                heading="Select an existing project"
                                subheading="Choose from your projects"
                                className="h-full"
                                onClose={() => setIsProjectPaneOpen(false)}
                            />
                        </div>
                    )}

                    {/* Right side: Project Creation */}
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
                                <div className="pt-12 flex justify-between items-center">
                                    <SectionHeading subheading="Set up a new AI assistant">
                                        Create a new project
                                    </SectionHeading>
                                    {!isProjectPaneOpen && (
                                        <Button
                                            onClick={() => setIsProjectPaneOpen(true)}
                                            variant="primary"
                                            size="md"
                                            startContent={<FolderOpenIcon className="w-4 h-4" />}
                                        >
                                            View Projects
                                        </Button>
                                    )}
                                </div>
                            )}
                            
                            <form
                                id="create-project-form"
                                action={handleSubmit}
                                onSubmit={(e) => {
                                    // Prevent default form submission
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    handleSubmit(formData);
                                }}
                                onKeyDown={handleKeyDown}
                                className="pt-12 pb-16 space-y-12"
                            >
                                {/* Tab Section */}
                                <div>
                                    <div className="mb-5">
                                        <SectionHeading>
                                            ✨ Get started
                                        </SectionHeading>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex gap-6 relative">
                                        <Button
                                            variant={selectedTab === TabType.Describe ? 'primary' : 'tertiary'}
                                            size="md"
                                            onClick={() => handleTabChange(TabType.Describe)}
                                            className={selectedTab === TabType.Describe ? selectedTabStyles : unselectedTabStyles}
                                        >
                                           Decsribe your assistant
                                        </Button>
                                        <Button
                                            variant={selectedTab === TabType.Blank ? 'primary' : 'tertiary'}
                                            size="md"
                                            onClick={handleBlankTemplateClick}
                                            type="button"
                                            className={selectedTab === TabType.Blank ? selectedTabStyles : unselectedTabStyles}
                                        >
                                            Start from a blank template
                                        </Button>
                                        <div className="relative" ref={dropdownRef}>
                                            <Button
                                                variant={selectedTab === TabType.Example ? 'primary' : 'tertiary'}
                                                size="md"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setIsExamplesDropdownOpen(!isExamplesDropdownOpen);
                                                }}
                                                type="button"
                                                className={selectedTab === TabType.Example ? selectedTabStyles : unselectedTabStyles}
                                                endContent={
                                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                }
                                            >
                                                Customize an existing example
                                            </Button>
                                            
                                            {isExamplesDropdownOpen && (
                                                <div className="absolute z-10 mt-2 min-w-[200px] max-w-[240px] rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                    <div className="py-1">
                                                        {Object.entries(starting_copilot_prompts)
                                                            .filter(([name]) => name !== 'Blank Template')
                                                            .map(([name]) => (
                                                                <Button
                                                                    key={name}
                                                                    variant="tertiary"
                                                                    size="sm"
                                                                    className="w-full justify-start text-left text-sm py-1.5"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleExampleSelect(name);
                                                                    }}
                                                                    type="button"
                                                                >
                                                                    {name}
                                                                </Button>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Name Section */}
                                {USE_MULTIPLE_PROJECTS && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-4">
                                            <label className={largeSectionHeaderStyles}>
                                                Name
                                            </label>
                                            <Textarea
                                                required
                                                name="name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className={clsx(
                                                    textareaStyles,
                                                    "min-h-[60px]",
                                                    "text-base",
                                                    "text-gray-900 dark:text-gray-100"
                                                )}
                                                placeholder={defaultName}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Custom Prompt Section - Only show when needed */}
                                {(selectedTab === TabType.Describe || selectedTab === TabType.Example) && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-4">
                                            <label className={largeSectionHeaderStyles}>
                                                {selectedTab === TabType.Describe ? '✏️ What do you want to build?' : '✏️ Customize the description'}
                                            </label>
                                            <div className="space-y-2">
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
                                                        !customPrompt && emptyTextareaStyles
                                                    )}
                                                    style={{ minHeight: "120px" }}
                                                    autoFocus
                                                    autoResize
                                                    required={isNotBlankTemplate(selectedTab)}
                                                />
                                                {promptError && (
                                                    <p className="text-sm text-red-500">
                                                        {promptError}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedTab === TabType.Blank && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-4">
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                👇 Click &ldquo;Create assistant&rdquo; below to get started
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <div className="pt-1 w-full -mt-4">
                                    <Submit />
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
} 