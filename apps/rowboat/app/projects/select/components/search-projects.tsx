import { Project } from "@/types/project_types";
import { z } from "zod";
import { ProjectList } from "./project-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { HorizontalDivider } from "@/components/ui/horizontal-divider";
import clsx from 'clsx';

interface SearchProjectsProps {
    projects: z.infer<typeof Project>[];
    isLoading: boolean;
    heading: string;
    subheading: string;
    className?: string;
}

export function SearchProjects({ 
    projects, 
    isLoading,
    heading,
    subheading,
    className
}: SearchProjectsProps) {
    return (
        <div className={clsx("card", className)}>
            <div className="px-4 pt-4 pb-6 flex-none">
                <SectionHeading
                    subheading={subheading}
                >
                    {heading}
                </SectionHeading>
            </div>
            <HorizontalDivider />
            <div className="flex-1 overflow-hidden">
                <ProjectList 
                    projects={projects}
                    isLoading={isLoading}
                    searchQuery=""
                />
            </div>
        </div>
    );
}
