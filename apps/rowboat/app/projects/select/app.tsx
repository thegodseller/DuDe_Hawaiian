'use client';

import { Project } from "../../lib/types/project_types";
import { useEffect, useState } from "react";
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

const sectionHeaderStyles = clsx(
    "text-sm font-medium",
    "text-gray-900 dark:text-gray-100"
);
const textareaStyles = clsx(
    "w-full",
    "rounded-lg p-3",
    "border border-gray-200 dark:border-gray-700",
    "bg-white dark:bg-gray-800",
    "hover:bg-gray-50 dark:hover:bg-gray-750",
    "focus:shadow-inner focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
    "placeholder:text-gray-400 dark:placeholder:text-gray-500"
);

export default function App() {
    const [projects, setProjects] = useState<z.infer<typeof Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedCard, setSelectedCard] = useState<'custom' | any>('custom');
    const [customPrompt, setCustomPrompt] = useState("Create a customer support assistant with one example agent");
    const [name, setName] = useState("");
    const [defaultName, setDefaultName] = useState('Assistant 1');
    const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
    const [showCustomPrompt, setShowCustomPrompt] = useState(false);
    const [promptError, setPromptError] = useState<string | null>(null);
    const [hasEditedPrompt, setHasEditedPrompt] = useState(false);

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

    const handleCardSelect = (card: 'custom' | any) => {
        setSelectedCard(card);
        
        if (card === 'custom') {
            setCustomPrompt("Create a customer support assistant with one example agent");
        } else {
            setCustomPrompt(card.prompt || card.description);
        }
    };

    const router = useRouter();

    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedTemplate(value);
        
        if (value === 'blank') {
            setShowCustomPrompt(false);
            setCustomPrompt('');
        } else if (value === 'custom') {
            setShowCustomPrompt(true);
            setCustomPrompt('');
        } else {
            // Handle example prompts
            const prompt = starting_copilot_prompts[value];
            if (prompt) {
                setShowCustomPrompt(true);
                setCustomPrompt(prompt);
            }
        }
    };

    const validatePrompt = (value: string) => {
        if (!value.trim()) {
            return { valid: false, errorMessage: "Prompt cannot be empty" };
        }
        return { valid: true };
    };

    async function handleSubmit(formData: FormData) {
        try {
            // Validate prompt if custom prompt section is shown
            if (showCustomPrompt && !customPrompt.trim()) {
                setPromptError("Prompt cannot be empty");
                return;
            }

            let response;
            
            if (selectedTemplate === 'blank') {
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
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
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
                    title="Projects"
                    description="Select an existing project or create a new one"
                />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr,2fr] gap-8 mt-8">
                    {/* Left side: Project Selection */}
                    <div className="overflow-auto">
                        <SearchProjects
                            projects={projects}
                            isLoading={isLoading}
                            heading="Select an existing project"
                            subheading="Choose from your projects"
                            className="h-full"
                        />
                    </div>

                    {/* Right side: Project Creation */}
                    <div className="overflow-auto">
                        <section className="card h-full">
                            <div className="px-4 pt-4">
                                <SectionHeading subheading="Set up a new AI assistant">
                                    Create a new project
                                </SectionHeading>
                            </div>
                            
                            <form
                                id="create-project-form"
                                action={handleSubmit}
                                onKeyDown={handleKeyDown}
                                className="px-4 pt-4 pb-8 space-y-8"
                            >
                                {/* Name Section */}
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <label className={sectionHeaderStyles}>
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

                                {/* Template Selection Section */}
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <label className={sectionHeaderStyles}>
                                            Choose how to start
                                        </label>
                                        <select
                                            value={selectedTemplate}
                                            onChange={handleTemplateChange}
                                            className={clsx(
                                                "w-[400px]",
                                                "px-4 py-2",
                                                "pr-8",
                                                "rounded-lg",
                                                "border border-gray-200 dark:border-gray-700",
                                                "bg-white dark:bg-gray-800",
                                                "hover:bg-gray-50 dark:hover:bg-gray-750",
                                                "focus:shadow-inner focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20",
                                                "appearance-none",
                                                "text-base",
                                                "text-gray-900 dark:text-gray-100",
                                                "bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]",
                                                "bg-[length:1.25em]",
                                                "bg-[calc(100%-8px)_center]",
                                                "bg-no-repeat",
                                                "dark:bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]"
                                            )}
                                        >
                                            <option value="blank">Start with a blank template</option>
                                            <option value="custom">Write your own starting prompt</option>
                                            <optgroup label="Example Prompts">
                                                {starting_copilot_prompts && 
                                                    Object.entries(starting_copilot_prompts)
                                                        .filter(([name]) => name !== 'Blank Template')
                                                        .map(([name, prompt]) => (
                                                            <option key={name} value={name}>
                                                                {name}
                                                            </option>
                                                        ))
                                                }
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>

                                {/* Custom Prompt Section - Only show when needed */}
                                {showCustomPrompt && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <label className={sectionHeaderStyles}>
                                                {selectedTemplate === 'custom' ? 'Write your prompt' : 'Customize the prompt'}
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
                                                        "min-h-[100px]",
                                                        "text-base",
                                                        "text-gray-900 dark:text-gray-100",
                                                        promptError && "border-red-500 focus:ring-red-500/20"
                                                    )}
                                                    autoResize
                                                    required
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

                                {/* Submit Button */}
                                <div className="pt-6 w-full">
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