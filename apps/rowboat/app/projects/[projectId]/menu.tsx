'use client';
import { usePathname } from "next/navigation";
import { Tooltip } from "@nextui-org/react";
import Link from "next/link";
import clsx from "clsx";
import { SettingsIcon, WorkflowIcon } from "lucide-react";

function NavLink({ href, label, icon, collapsed, selected = false }: { href: string, label: string, icon: React.ReactNode, collapsed: boolean, selected?: boolean }) {
    return <Link
        href={href}
        className={clsx("flex px-2 py-2 gap-2 items-center rounded-lg text-sm hover:text-black", {
            "text-black": selected,
            "justify-center": collapsed,
        })}
    >
        {collapsed && <Tooltip content={label} showArrow placement="right">
            <div className="shrink-0">
                {icon}
            </div>
        </Tooltip>}
        {!collapsed && <div className="shrink-0">
            {icon}
        </div>}
        {!collapsed && <div className="truncate">
            {label}
        </div>}
    </Link>;
}

export default function Menu({
    projectId,
    collapsed,
}: {
    projectId: string;
    collapsed: boolean;
}) {
    const pathname = usePathname();

    return <div className="flex flex-col text-gray-500">
        {/* <NavLink
            href={`/projects/${projectId}/playground`}
            label="Playground"
            collapsed={collapsed}
            icon=<svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z" />
            </svg>
            selected={pathname.startsWith(`/projects/${projectId}/playground`)}
        /> */}
        <NavLink
            href={`/projects/${projectId}/workflow`}
            label="Workflow"
            collapsed={collapsed}
            icon={<WorkflowIcon size={16} />}
            selected={pathname.startsWith(`/projects/${projectId}/workflow`)}
        />
        {/* <NavLink
            href={`/projects/${projectId}/sources`}
            label="Data sources"
            collapsed={collapsed}
            icon=<svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 6c0 1.657-3.134 3-7 3S5 7.657 5 6m14 0c0-1.657-3.134-3-7-3S5 4.343 5 6m14 0v6M5 6v6m0 0c0 1.657 3.134 3 7 3s7-1.343 7-3M5 12v6c0 1.657 3.134 3 7 3s7-1.343 7-3v-6" />
            </svg>
            selected={pathname.startsWith(`/projects/${projectId}/sources`)}
        /> */}
        <NavLink
            href={`/projects/${projectId}/config`}
            label="Config"
            collapsed={collapsed}
            icon={<SettingsIcon size={16} />}
            selected={pathname.startsWith(`/projects/${projectId}/config`)}
        />
        {/*<NavLink
            href={`/projects/${projectId}/integrate`}
            label="Integrate"
            collapsed={collapsed}
            icon=<svg className="w-[24px] h-[24px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14" />
            </svg>
            selected={pathname.startsWith(`/projects/${projectId}/integrate`)}
        />*/}
    </div>;
}