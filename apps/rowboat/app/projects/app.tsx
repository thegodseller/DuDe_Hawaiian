'use client';

import { Link, Button, Spinner } from "@heroui/react";
import { RelativeTime } from "@primer/react";
import { Project } from "../lib/types/project_types";
import { default as NextLink } from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { listProjects } from "../actions/project_actions";
import { useRouter } from 'next/navigation';

export default function App() {
    const router = useRouter();
    const [projects, setProjects] = useState<z.infer<typeof Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let ignore = false;

        async function fetchProjects() {
            setIsLoading(true);
            const projects = await listProjects();
            if (!ignore) {
                setProjects(projects);
                setIsLoading(false);
                if (projects.length === 0) {
                    router.push('/projects/new');
                }
            }
        }

        fetchProjects();

        return () => {
            ignore = true;
        }
    }, [router]);

    return (
        <div className="h-full pt-4 px-4 overflow-auto dark:bg-gray-900">
            <div className="max-w-[768px] mx-auto">
                <div className="flex justify-between items-center">
                    <div className="text-lg dark:text-white">Select a project</div>
                    <Button
                        href="/projects/new"
                        as={Link}
                        startContent={
                            <svg className="w-[18px] h-[18px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7 7V5" />
                            </svg>
                        }
                    >
                        Create new project
                    </Button>
                </div>

                {isLoading && <Spinner size="sm" />}
                {!isLoading && projects.length == 0 && <p className="mt-4 text-center text-gray-600 dark:text-gray-400 text-sm">You do not have any projects.</p>}
                {!isLoading && projects.length > 0 && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {projects.map((project) => (
                        <NextLink
                            key={project._id}
                            href={`/projects/${project._id}`}
                            className="flex flex-col gap-2 border border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500 rounded p-4 bg-white dark:bg-gray-800 dark:text-white"
                        >
                            <div className="text-lg">
                                {project.name}
                            </div>
                            <div className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                                Created <RelativeTime date={new Date(project.createdAt)} />
                            </div>
                        </NextLink>
                    ))}
                </div>}
            </div>
        </div>
    );
} 