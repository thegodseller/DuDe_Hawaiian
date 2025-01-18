'use client';
import { Tooltip } from "@nextui-org/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import Menu from "./menu";
import { Project } from "@/app/lib/types";
import { z } from "zod";
import { getProjectConfig } from "@/app/actions";
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

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

    return <div className={clsx("shrink-0 flex flex-col gap-2 border-r-1 border-gray-100 relative p-2", {
        "w-40": !collapsed,
        "w-10": collapsed
    })}>
        <Tooltip content={collapsed ? "Expand" : "Collapse"} showArrow placement="right">
            <button onClick={toggleCollapse} className="absolute bottom-[50px] left-2 text-gray-400 hover:text-black w-[28px] h-[28px]">
                {!collapsed && <ChevronsLeftIcon size={16} className="m-auto" />}
                {collapsed && <ChevronsRightIcon size={16} className="m-auto" />}
            </button>
        </Tooltip>
        {!collapsed && project && <div className="flex flex-col gap-1">
            <Tooltip content="Change project" showArrow placement="bottom-end">
                <Link className="relative group flex flex-col px-2 py-2 border border-gray-200 rounded-md hover:border-gray-500" href="/projects">
                    <div className="absolute top-[-7px] left-1 px-1 bg-gray-100 text-xs text-gray-400 group-hover:text-gray-600">
                        Project
                    </div>
                    <div className="truncate text-sm">
                        {project.name}
                    </div>
                </Link>
            </Tooltip>
        </div>}
        <Menu projectId={projectId} collapsed={collapsed} />
    </div>;
}