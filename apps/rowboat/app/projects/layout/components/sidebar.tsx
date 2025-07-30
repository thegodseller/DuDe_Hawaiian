'use client';
import { useEffect, useState } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from "@heroui/react";
import { UserButton } from "@/app/lib/components/user_button";
import { 
  SettingsIcon, 
  WorkflowIcon, 
  PlayIcon,
  FolderOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Moon,
  Sun,
  HelpCircle
} from "lucide-react";
import { getProjectConfig, listProjects } from "@/app/actions/project_actions";
import { useTheme } from "@/app/providers/theme-provider";
import { USE_PRODUCT_TOUR } from '@/app/lib/feature_flags';
import { useHelpModal } from "@/app/providers/help-modal-provider";
import { Project } from "@/app/lib/types/project_types";
import { z } from "zod";

interface SidebarProps {
  projectId?: string;
  useAuth: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  useBilling?: boolean;
}

const EXPANDED_ICON_SIZE = 20;
const COLLAPSED_ICON_SIZE = 20; // DO NOT CHANGE THIS

export default function Sidebar({ projectId, useAuth, collapsed = false, onToggleCollapse, useBilling }: SidebarProps) {
  const pathname = usePathname();
  const [projectName, setProjectName] = useState<string>("Select Project");
  const [allProjects, setAllProjects] = useState<z.infer<typeof Project>[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const isProjectsRoute = pathname === '/projects';
  const { theme, toggleTheme } = useTheme();
  const { showHelpModal } = useHelpModal();
  const { isOpen: isAssistantsModalOpen, onOpen: onAssistantsModalOpen, onClose: onAssistantsModalClose } = useDisclosure();

  useEffect(() => {
    async function fetchProjectName() {
      if (!isProjectsRoute && projectId) {
        try {
          const project = await getProjectConfig(projectId);
          setProjectName(project.name);
        } catch (error) {
          console.error('Failed to fetch project name:', error);
          setProjectName("Select Project");
        }
      }
    }
    fetchProjectName();
  }, [projectId, isProjectsRoute]);

  // Load projects when modal opens
  useEffect(() => {
    async function loadProjects() {
      if (isAssistantsModalOpen && !isProjectsRoute) {
        setIsLoadingProjects(true);
        try {
          const projects = await listProjects();
          // Filter out current project and sort by creation date
          const otherProjects = projects.filter(p => p._id !== projectId);
          const sortedProjects = [...otherProjects].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setAllProjects(sortedProjects);
        } catch (error) {
          console.error('Failed to fetch projects:', error);
        } finally {
          setIsLoadingProjects(false);
        }
      }
    }

    loadProjects();
  }, [isAssistantsModalOpen, projectId, isProjectsRoute]);

  const navItems = [
    {
      href: 'workflow',
      label: 'Build',
      icon: WorkflowIcon,
      requiresProject: true
    }
  ];

  const handleStartTour = () => {
    localStorage.removeItem('user_product_tour_completed');
    window.location.reload();
  };

  return (
    <>
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-transparent flex flex-col h-full transition-all duration-300`}>
        <div className="flex flex-col grow">
          {!isProjectsRoute && (
            <>
              {/* Project Selector */}
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                <Tooltip content={collapsed ? projectName : "Change project"} showArrow placement="right">
                  <button 
                    onClick={onAssistantsModalOpen}
                    className={`
                      w-full flex items-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all
                      ${collapsed ? 'justify-center py-4' : 'gap-3 px-4 py-2.5'}
                    `}
                  >
                    <FolderOpenIcon 
                      size={collapsed ? COLLAPSED_ICON_SIZE : EXPANDED_ICON_SIZE} 
                      className="text-zinc-500 dark:text-zinc-400 transition-all duration-200" 
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">
                        {projectName}
                      </span>
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* Project-specific navigation Items */}
              {projectId && <nav className="p-3 space-y-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const fullPath = `/projects/${projectId}/${item.href}`;
                  const isActive = pathname.startsWith(fullPath);
                  const isDisabled = isProjectsRoute && item.requiresProject;
                  
                  return (
                    <Tooltip 
                      key={item.href}
                      content={collapsed ? item.label : ""}
                      showArrow 
                      placement="right"
                    >
                      <Link 
                        href={isDisabled ? '#' : fullPath}
                        className={`
                          relative w-full rounded-md flex items-center
                          text-[15px] font-medium transition-all duration-200
                          ${collapsed ? 'justify-center py-4' : 'px-2.5 py-3 gap-2.5'}
                          ${isActive 
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-600 dark:border-indigo-400' 
                            : isDisabled
                              ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-300'
                          }
                          ${isDisabled ? 'pointer-events-none' : ''}
                        `}
                        data-tour-target={item.href === 'config' ? 'settings' : item.href === 'sources' ? 'entity-data-sources' : undefined}
                      >
                        <Icon 
                          size={collapsed ? COLLAPSED_ICON_SIZE : EXPANDED_ICON_SIZE} 
                          className={`
                            transition-all duration-200
                            ${isDisabled 
                              ? 'text-zinc-300 dark:text-zinc-600' 
                              : isActive
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }
                          `}
                        />
                        {!collapsed && (
                          <span>{item.label}</span>
                        )}
                      </Link>
                    </Tooltip>
                  );
                })}
              </nav>}
            </>
          )}
        </div>

        {/* Bottom section */}
        <div className="mt-auto">
          {/* Collapse Toggle Button */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all"
            >
              {collapsed ? (
                <ChevronRightIcon size={20} className="text-zinc-500 dark:text-zinc-400" />
              ) : (
                <ChevronLeftIcon size={20} className="text-zinc-500 dark:text-zinc-400" />
              )}
            </button>
          </div>

          {/* Theme and Auth Controls */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            {/* Settings */}
            {!isProjectsRoute && projectId && (
              <Tooltip content={collapsed ? "Settings" : ""} showArrow placement="right">
                <Link 
                  href={`/projects/${projectId}/config`}
                  className={`
                    w-full rounded-md flex items-center
                    text-[15px] font-medium transition-all duration-200
                    ${collapsed ? 'justify-center py-4' : 'px-4 py-4 gap-3'}
                    ${pathname.startsWith(`/projects/${projectId}/config`)
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                    }
                  `}
                  data-tour-target="settings"
                >
                  <SettingsIcon size={COLLAPSED_ICON_SIZE} />
                  {!collapsed && <span>Settings</span>}
                </Link>
              </Tooltip>
            )}

            {USE_PRODUCT_TOUR && !isProjectsRoute && (
              <Tooltip content={collapsed ? "Help" : ""} showArrow placement="right">
                <button 
                  onClick={showHelpModal}
                  className={`
                    w-full rounded-md flex items-center
                    text-[15px] font-medium transition-all duration-200
                    ${collapsed ? 'justify-center py-4' : 'px-4 py-4 gap-3'}
                    hover:bg-zinc-100 dark:hover:bg-zinc-800/50
                    text-zinc-600 dark:text-zinc-400
                  `}
                  data-tour-target="tour-button"
                >
                  <HelpCircle size={COLLAPSED_ICON_SIZE} />
                  {!collapsed && <span>Help</span>}
                </button>
              </Tooltip>
            )}

            <Tooltip content={collapsed ? "Appearance" : ""} showArrow placement="right">
              <button 
                onClick={toggleTheme}
                className={`
                  w-full rounded-md flex items-center
                  text-[15px] font-medium transition-all duration-200
                  ${collapsed ? 'justify-center py-4' : 'px-4 py-4 gap-3'}
                  hover:bg-zinc-100 dark:hover:bg-zinc-800/50
                  text-zinc-600 dark:text-zinc-400
                `}
              >
                { theme == "light" ? <Moon size={COLLAPSED_ICON_SIZE} /> : <Sun size={COLLAPSED_ICON_SIZE} /> }
                {!collapsed && <span>Appearance</span>}
              </button>
            </Tooltip>

            {useAuth && (
              <Tooltip content={collapsed ? "Account" : ""} showArrow placement="right">
                <div 
                  className={`
                    w-full rounded-md flex items-center
                    text-[15px] font-medium transition-all duration-200
                    ${collapsed ? 'justify-center py-4' : 'px-4 py-4 gap-3'}
                    hover:bg-zinc-100 dark:hover:bg-zinc-800/50
                  `}
                >
                  <UserButton useBilling={useBilling} />
                  {!collapsed && <span>Account</span>}
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </aside>

      {/* Assistants Modal */}
      <Modal 
        isOpen={isAssistantsModalOpen} 
        onClose={onAssistantsModalClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Select Assistant
          </ModalHeader>
          <ModalBody>
            <div className="space-y-2">
              {/* Current project option */}
              <Link
                href="/projects"
                onClick={onAssistantsModalClose}
                className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30"
              >
                <div className="font-medium text-indigo-700 dark:text-indigo-300">Create New Assistant</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400">
                  Start building a new assistant from scratch
                </div>
              </Link>

              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                  Loading assistants...
                </div>
              ) : allProjects.length > 0 ? (
                <>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 px-1 py-2">
                    Existing Assistants ({allProjects.length})
                  </div>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {allProjects.map((project) => (
                      <Link
                        key={project._id}
                        href={`/projects/${project._id}/workflow`}
                        onClick={onAssistantsModalClose}
                        className="block px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                      >
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-500">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-500 text-center py-8">
                  No other assistants found
                </div>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
} 