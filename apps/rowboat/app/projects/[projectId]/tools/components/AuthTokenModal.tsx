'use client';

import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Key, AlertCircle, Eye, EyeOff } from "lucide-react";
import { setServerAuthToken } from '@/app/actions/klavis_actions';
import { MCPServer } from '@/app/lib/types/types';
import { z } from 'zod';

type McpServerType = z.infer<typeof MCPServer>;

interface AuthTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: McpServerType | null;
  onSuccess: () => void;
}

export function AuthTokenModal({ isOpen, onClose, server, onSuccess }: AuthTokenModalProps) {
  const [authToken, setAuthToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = async () => {
    if (!server?.instanceId || !authToken.trim()) {
      setError('Please enter a valid auth token');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await setServerAuthToken(server.instanceId, authToken.trim());
      
      if (result.success) {
        // Success - close modal and refresh data
        setAuthToken('');
        setError(null);
        onSuccess();
        onClose();
      } else {
        // Show validation error
        setError(result.error || 'Failed to set auth token');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAuthToken('');
    setError(null);
    onClose();
  };

  if (!server) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={handleClose}
      size="lg"
      classNames={{
        base: "bg-white dark:bg-gray-900",
        header: "border-b border-gray-200 dark:border-gray-800",
        footer: "border-t border-gray-200 dark:border-gray-800",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex gap-2 items-center">
          <Key className="w-5 h-5 text-blue-500" />
          <span>Authenticate {server.name}</span>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You&apos;ll need to obtain an authentication token from {server.name}. Please refer to their documentation or settings page to find your API key or access token.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="auth-token" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auth Token
              </label>
              <div className="relative">
                <input
                  id="auth-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your auth token..."
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSubmitting) {
                      handleSubmit();
                    }
                  }}
                  className="w-full pr-10 pl-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 border-0 shadow-none"
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 items-start p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>
          <style jsx>{`
            #auth-token {
              box-shadow: none !important;
              outline: none !important;
              border: none !important;
              background: #f3f4f6 !important;
              font-size: 1.05rem;
            }
            #auth-token:focus {
              box-shadow: none !important;
              outline: none !important;
              border: none !important;
              background: #e0e7ef !important;
            }
            .dark #auth-token {
              background: #23272f !important;
              color: #f3f4f6 !important;
            }
            .dark #auth-token:focus {
              background: #1a1d23 !important;
            }
          `}</style>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !authToken.trim()}
            isLoading={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Authenticating...
              </>
            ) : (
              'Authenticate'
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
} 