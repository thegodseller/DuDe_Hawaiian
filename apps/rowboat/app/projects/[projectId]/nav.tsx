'use client';
import { Tooltip } from "@nextui-org/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import Menu from "./menu";
import { Project } from "@/app/lib/types";
import { z } from "zod";
import { getProjectConfig } from "@/app/actions";

export function Nav({
    projectId,
}: {
    projectId: string;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [project, setProject] = useState<z.infer<typeof Project> | null>(null);

    useEffect(() => {
        let ignore = false;

        async function getProject() {
            const project = await getProjectConfig(projectId);
            if (ignore) {
                return;
            }
            setProject(project);
        }
        getProject();

        return () => {
            ignore = true;
        };
    }, [projectId]);

    function toggleCollapse() {
        setCollapsed(!collapsed);
    }

    return <div className={clsx("bg-gray-50 shrink-0 flex flex-col gap-6 border-r-1 border-gray-100 relative p-4", {
        "w-64": !collapsed,
        "w-16": collapsed
    })}>
        <Tooltip content={collapsed ? "Expand" : "Collapse"} showArrow placement="right">
            <button onClick={toggleCollapse} className="absolute bottom-[100px] right-[-16px] rounded-full border bg-white text-gray-400 border-gray-400 hover:border-black hover:text-black w-[28px] h-[28px] shadow-sm">
                {!collapsed && <svg className="m-auto w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m17 16-4-4 4-4m-6 8-4-4 4-4" />
                </svg>}
                {collapsed && <svg className="m-auto w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m7 16 4-4-4-4m6 8 4-4-4-4" />
                </svg>}
            </button>
        </Tooltip>
        {!collapsed && project && <div className="flex flex-col gap-1">
            <Tooltip content="Change project" showArrow placement="bottom-end">
                <Link className="relative group flex flex-col px-3 py-3 border border-gray-200 rounded-md hover:border-gray-500" href="/projects">
                    <div className="absolute top-[-7px] left-1 px-2 bg-gray-50 text-xs text-gray-400 group-hover:text-gray-600">
                        Project
                    </div>
                    <div className="truncate">
                        {project.name}
                    </div>
                </Link>
            </Tooltip>
        </div>}
        <Menu projectId={projectId} collapsed={collapsed} />
    </div>;
}