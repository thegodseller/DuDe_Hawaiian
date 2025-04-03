'use client';

import { Project } from "../../lib/types/project_types";
import { useEffect, useState } from "react";
import { z } from "zod";
import { listProjects, createProject, createProjectFromPrompt } from "../../actions/project_actions";
import { useRouter } from 'next/navigation';
import { tokens } from "@/app/styles/design-tokens";
import clsx from 'clsx';
import { templates } from "@/app/lib/project_templates";
import { SectionHeading } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { TemplateCardsList } from "./components/template-cards-list";
import { SearchProjects } from "./components/search-projects";
import { CustomPromptCard } from "./components/custom-prompt-card";
import { Submit } from "./components/submit-button";
import { PageHeading } from "@/components/ui/page-heading";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function App() {
    const [projects, setProjects] = useState<z.infer<typeof Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedCard, setSelectedCard] = useState<'custom' | any>('custom');
    const [customPrompt, setCustomPrompt] = useState("Create a customer support assistant with one example agent");
    const [name, setName] = useState("");
    const [defaultName, setDefaultName] = useState('Untitled 1');
    const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);

    const getNextUntitledNumber = (projects: z.infer<typeof Project>[]) => {
        const untitledProjects = projects
            .map(p => p.name)
            .filter(name => name.startsWith('Untitled '))
            .map(name => {
                const num = parseInt(name.replace('Untitled ', ''));
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
                const nextNumber = getNextUntitledNumber(sortedProjects);
                const newDefaultName = `Untitled ${nextNumber}`;
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

    async function handleSubmit(formData: FormData) {
        // Check if it's a template (from templates object) or a copilot prompt
        const isTemplate = selectedCard?.id && selectedCard.id in templates;

        if (selectedCard === 'custom' || !isTemplate) {
            // Handle custom prompt or copilot starting prompts
            console.log('Creating project from prompt');
            try {
                const newFormData = new FormData();
                newFormData.append('name', name);
                newFormData.append('prompt', selectedCard === 'custom' ? customPrompt : selectedCard.prompt);
                
                const response = await createProjectFromPrompt(newFormData);
                
                if (!response?.id) {
                    throw new Error('Project creation failed');
                }

                // Store prompt in local storage
                const promptToStore = selectedCard === 'custom' ? customPrompt : selectedCard.prompt;
                if (promptToStore) {
                    localStorage.setItem(`project_prompt_${response.id}`, promptToStore);
                }
                router.push(`/projects/${response.id}/workflow`);
            } catch (error) {
                console.error('Error creating project:', error);
            }
        } else {
            // Handle regular template
            console.log('Creating template project');
            try {
                const newFormData = new FormData();
                newFormData.append('name', name);
                newFormData.append('template', selectedCard.id);
                return await createProject(newFormData);
            } catch (error) {
                console.error('Error creating project:', error);
            }
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
                            <div className="px-4 pt-4 flex justify-between items-start">
                                <div>
                                    <SectionHeading
                                        subheading="Set up a new AI assistant"
                                    >
                                        Create a new project
                                    </SectionHeading>
                                </div>
                                <div className="pt-1">
                                    <Submit />
                                </div>
                            </div>
                            
                            <form
                                id="create-project-form"
                                action={handleSubmit}
                                onKeyDown={handleKeyDown}
                                className="px-4 pt-4 pb-8 space-y-6"
                            >
                                <div className="space-y-3">
                                    <SectionHeading>Name your assistant</SectionHeading>
                                    <Textarea
                                        required
                                        name="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="min-h-[60px] px-4 py-3"
                                        placeholder={defaultName}
                                    />
                                </div>

                                <input type="hidden" name="template" value={selectedCard} />

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <SectionHeading>Start with your own prompt</SectionHeading>
                                        <CustomPromptCard
                                            selected={selectedCard === 'custom'}
                                            onSelect={() => handleCardSelect('custom')}
                                            customPrompt={customPrompt}
                                            onCustomPromptChange={setCustomPrompt}
                                        />
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
                                            className="flex items-center gap-2 w-full"
                                        >
                                            <div className="flex-1 text-left">
                                                <SectionHeading>
                                                    Or choose an example
                                                </SectionHeading>
                                            </div>
                                            {isExamplesExpanded ? (
                                                <ChevronUp className="w-5 h-5 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-500" />
                                            )}
                                        </button>
                                        {isExamplesExpanded && (
                                            <TemplateCardsList
                                                selectedCard={selectedCard}
                                                onSelectCard={handleCardSelect}
                                            />
                                        )}
                                    </div>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
} 