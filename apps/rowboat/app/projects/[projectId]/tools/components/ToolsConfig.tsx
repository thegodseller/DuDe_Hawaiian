'use client';

import { useState } from 'react';
import { Tabs, Tab } from '@/components/ui/tabs';
import { HostedServers } from './HostedServers';
import { CustomServers } from './CustomServers';
import { WebhookConfig } from './WebhookConfig';
import { Composio } from './Composio';
import type { Key } from 'react';

export function ToolsConfig({
  useComposioTools,
  useKlavisTools
}: {
  useComposioTools: boolean;
  useKlavisTools: boolean;
}) {
  let defaultActiveTab = 'custom';
  if (useKlavisTools) {
    defaultActiveTab = 'hosted';
  }
  if (useComposioTools) {
    defaultActiveTab = 'composio';
  }
  const [activeTab, setActiveTab] = useState(defaultActiveTab);

  const handleTabChange = (key: Key) => {
    setActiveTab(key.toString());
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs 
        selectedKey={activeTab}
        onSelectionChange={handleTabChange}
        aria-label="Tool configuration options"
        className="w-full"
        fullWidth
      >
        {useComposioTools && (
          <Tab key="composio" title="Composio">
            <div className="mt-4 p-6">
              <Composio />
            </div>
          </Tab>
        )}
        {useKlavisTools && (
          <Tab key="hosted" title={
            <div className="flex items-center gap-2">
              <span>Klavis</span>
              <span className="leading-none px-1.5 py-[2px] text-[9px] font-medium bg-linear-to-r from-pink-500 to-violet-500 text-white rounded-full">
                BETA
              </span>
            </div>
          }>
            <div className="mt-4 p-6">
              <HostedServers onSwitchTab={key => setActiveTab(key)} />
            </div>
          </Tab>
        )}
        <Tab key="custom" title="Custom MCP Servers">
          <div className="mt-4 p-6">
            <CustomServers />
          </div>
        </Tab>
        <Tab key="webhook" title="Webhook">
          <div className="mt-4 p-6">
            <WebhookConfig />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
} 