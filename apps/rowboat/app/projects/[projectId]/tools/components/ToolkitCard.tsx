'use client';

import { useCallback } from 'react';
import { PictureImg } from '@/components/ui/picture-img';
import clsx from 'clsx';
import { z } from 'zod';
import { ZToolkit } from '@/app/lib/composio/composio';
import { Project } from '@/app/lib/types/project_types';
import { Chip } from '@heroui/react';
import { LinkIcon } from 'lucide-react';

type ToolkitType = z.infer<typeof ZToolkit>;
type ProjectType = z.infer<typeof Project>;

const toolkitCardStyles = {
    base: clsx(
        "group p-6 rounded-xl transition-all duration-200 cursor-pointer",
        "bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-700",
        "shadow-md dark:shadow-gray-900/20",
        "hover:shadow-lg dark:hover:shadow-gray-900/30",
        "hover:border-blue-300 dark:hover:border-blue-600",
        "hover:bg-gray-50/50 dark:hover:bg-gray-800/50",
        "hover:-translate-y-1",
        "min-h-[200px] flex flex-col"
    ),
};

interface ToolkitCardProps {
  toolkit: ToolkitType;
  projectId: string;
  isConnected: boolean;
  connectedAccountId?: string;
  projectConfig: ProjectType | null;
  onManageTools: () => void;
  onProjectConfigUpdate: () => void;
  onRemoveToolkitTools: (toolkitSlug: string) => void;
}

export function ToolkitCard({ 
  toolkit, 
  projectId,
  isConnected,
  connectedAccountId,
  projectConfig,
  onManageTools,
  onProjectConfigUpdate,
  onRemoveToolkitTools
}: ToolkitCardProps) {
  const handleCardClick = useCallback(() => {
    onManageTools();
  }, [onManageTools]);

  // Calculate selected tools count for this toolkit
  const selectedToolsCount = projectConfig?.composioSelectedTools?.filter(tool => 
    tool.toolkit.slug === toolkit.slug
  ).length || 0;

  return (
    <div className={toolkitCardStyles.base} onClick={handleCardClick}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {toolkit.meta.logo && (
            <PictureImg 
              src={toolkit.meta.logo} 
              alt={`${toolkit.name} logo`}
              className="w-8 h-8 rounded-md object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
              {toolkit.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Chip
                color="secondary"
                variant="faded"
                size="sm"
              >
                {selectedToolsCount > 0 
                  ? `${toolkit.meta.tools_count} tools, ${selectedToolsCount} selected`
                  : `${toolkit.meta.tools_count} tools`
                }
              </Chip>
            </div>
          </div>
        </div>
        
        {/* Description */}
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {toolkit.meta.description}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected && !toolkit.no_auth && (
                <Chip
                  color='success'
                  variant='flat'
                  size="sm"
                  startContent={<LinkIcon className="w-3 h-3 mr-1" />}
                >
                  Connected
                </Chip>
              )}
              {toolkit.no_auth && (
                <Chip
                  color='success'
                  variant='flat'
                  size="sm"
                >
                  Ready
                </Chip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}