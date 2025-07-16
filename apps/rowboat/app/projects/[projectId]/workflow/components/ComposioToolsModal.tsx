'use client';

import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, Tabs, Tab } from '@heroui/react';
import { Composio } from '../../tools/components/Composio';
import { ComposioWithCallback } from './ComposioWithCallback';
import { CustomServers } from '../../tools/components/CustomServers';
import { WebhookConfig } from '../../tools/components/WebhookConfig';
import type { Key } from 'react';

interface ComposioToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onToolsUpdated?: () => void;
}

export function ComposioToolsModal({ isOpen, onClose, projectId, onToolsUpdated }: ComposioToolsModalProps) {
  const [activeTab, setActiveTab] = useState('composio');

  const handleTabChange = (key: Key) => {
    setActiveTab(key.toString());
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[90vh]",
        body: "p-0",
        header: "pb-3"
      }}
    >
      <ModalContent>
        <ModalHeader>
          <h3 className="text-lg font-semibold">
            Tools
          </h3>
        </ModalHeader>
        <ModalBody>
          <Tabs 
            selectedKey={activeTab}
            onSelectionChange={handleTabChange}
            aria-label="Tool configuration options"
            className="w-full h-full"
            fullWidth
            classNames={{
              panel: "h-full min-h-[60vh]"
            }}
          >
            <Tab key="composio" title="Composio">
              <div className="p-6 h-full">
                <ComposioWithCallback projectId={projectId} onToolsUpdated={onToolsUpdated} />
              </div>
            </Tab>
            <Tab key="custom" title="Custom MCP Servers">
              <div className="p-6 h-full">
                <CustomServers onToolsUpdated={onToolsUpdated} />
              </div>
            </Tab>
            <Tab key="webhook" title="Webhook">
              <div className="p-6 h-full">
                <WebhookConfig />
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}