'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, XMarkIcon, DocumentDuplicateIcon, EllipsisVerticalIcon, TrashIcon, ChevronRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useParams, useRouter } from 'next/navigation';
import { 
    getScenarios, 
    createScenario, 
    updateScenario, 
    deleteScenario,
} from '@/app/actions/simulation_actions';
import { Scenario, type WithStringId } from '@/app/lib/types';
import { z } from 'zod';

type ScenarioType = WithStringId<z.infer<typeof Scenario>>;

type SimulationResult = {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  details: string;
  scenario: ScenarioType;
};

type SimulationReport = {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  results: SimulationResult[];
  timestamp: Date;
};

const dummySimulator = async (scenario: ScenarioType): Promise<SimulationResult> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const passed = Math.random() > 0.5;
  
  return {
    scenarioId: scenario._id,
    scenarioName: scenario.name,
    passed,
    details: passed 
      ? "The bot successfully completed the conversation"
      : "The bot could not handle the conversation",
    scenario: scenario,
  };
};

export default function SimulationApp() {
  const { projectId } = useParams();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioType[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpenScenarioId, setMenuOpenScenarioId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationReport, setSimulationReport] = useState<SimulationReport | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Load scenarios on mount
  useEffect(() => {
    if (!projectId) return;
    getScenarios(projectId as string).then(setScenarios);
  }, [projectId]);

  useEffect(() => {
    if (menuOpenScenarioId) {
      const closeMenu = () => setMenuOpenScenarioId(null);
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [menuOpenScenarioId]);

  const createNewScenario = async () => {
    if (!projectId) return;
    const newScenarioId = await createScenario(
      projectId as string,
      'New Scenario',
      ''
    );
    // Refresh scenarios list
    const updatedScenarios = await getScenarios(projectId as string);
    setScenarios(updatedScenarios);
    const newScenario = updatedScenarios.find(s => s._id === newScenarioId);
    if (newScenario) {
      setSelectedScenario(newScenario);
      setIsEditing(true);
    }
  };

  const handleUpdateScenario = async (updatedScenario: ScenarioType) => {
    if (!projectId) return;
    await updateScenario(
      projectId as string,
      updatedScenario._id,
      {
        name: updatedScenario.name,
        description: updatedScenario.description,
      }
    );
    // Refresh scenarios list
    const updatedScenarios = await getScenarios(projectId as string);
    setScenarios(updatedScenarios);
    const refreshedScenario = updatedScenarios.find(s => s._id === updatedScenario._id);
    if (refreshedScenario) {
      setSelectedScenario(refreshedScenario);
    }
    setIsEditing(false);
  };

  const handleCloseScenario = () => {
    setSelectedScenario(null);
    setIsEditing(false);
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!projectId) return;
    await deleteScenario(projectId as string, scenarioId);
    const updatedScenarios = await getScenarios(projectId as string);
    setScenarios(updatedScenarios);
    if (selectedScenario?._id === scenarioId) {
      setSelectedScenario(null);
      setIsEditing(false);
    }
    setMenuOpenScenarioId(null);
  };

  const runAllScenarios = async () => {
    setIsRunning(true);
    setSimulationReport(null);

    try {
      const results: SimulationResult[] = [];
      
      // Run each scenario through the simulator
      for (const scenario of scenarios) {
        const result = await dummySimulator(scenario);
        results.push(result);
      }

      // Generate report
      const passedScenarios = results.filter(r => r.passed).length;
      const report: SimulationReport = {
        totalScenarios: scenarios.length,
        passedScenarios,
        failedScenarios: scenarios.length - passedScenarios,
        results,
        timestamp: new Date(),
      };

      setSimulationReport(report);
    } catch (error) {
      console.error('Error running scenarios:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runSingleScenario = (scenario: ScenarioType) => {
    // Navigate to the workflow playground with the scenario
    router.push(`/projects/${projectId}/workflow/playground?scenarioId=${scenario._id}`);
    setMenuOpenScenarioId(null);
  };

  return (
    <div className="flex h-screen">
      {/* Left sidebar */}
      <div className="w-64 border-r border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Scenarios</h2>
          <div className="flex gap-2">
            <button
              onClick={createNewScenario}
              className="p-2 rounded-full hover:bg-gray-100"
              title="New Scenario"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {scenarios.map(scenario => (
            <div
              key={scenario._id}
              className={`p-2 rounded flex justify-between items-center ${
                selectedScenario?._id === scenario._id
                  ? 'bg-blue-100'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div
                onClick={() => setSelectedScenario(scenario)}
                className="cursor-pointer flex-grow"
              >
                {scenario.name}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenScenarioId(menuOpenScenarioId === scenario._id ? null : scenario._id);
                  }}
                  className="p-1 rounded-full hover:bg-gray-200"
                >
                  <EllipsisVerticalIcon className="h-5 w-5 text-gray-600" />
                </button>
                {menuOpenScenarioId === scenario._id && (
                  <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runSingleScenario(scenario);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                      >
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Run Scenario
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScenario(scenario._id);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full"
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Delete Scenario
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {selectedScenario ? (
          isEditing ? (
            <ScenarioEditor
              scenario={selectedScenario}
              onSave={handleUpdateScenario}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <ScenarioViewer
              scenario={selectedScenario}
              onEdit={() => setIsEditing(true)}
              onClose={handleCloseScenario}
            />
          )
        ) : (
          <div className="space-y-6">
            {simulationReport ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h1 className="text-2xl font-bold">Simulation Results</h1>
                    <div className="text-sm text-gray-500 mt-1">
                      Run on {simulationReport.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={runAllScenarios}
                    disabled={isRunning || scenarios.length === 0}
                    className={`px-4 py-2 rounded-md text-white ${
                      isRunning || scenarios.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRunning ? 'Running...' : 'Run All Scenarios'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[100px] flex flex-col justify-center">
                    <div className="text-sm text-gray-500">Total Scenarios</div>
                    <div className="text-2xl font-bold">{simulationReport.totalScenarios}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg min-h-[100px] flex flex-col justify-center">
                    <div className="text-sm text-green-600">Passed</div>
                    <div className="text-2xl font-bold text-green-600">
                      {simulationReport.passedScenarios}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg min-h-[100px] flex flex-col justify-center">
                    <div className="text-sm text-red-600">Failed</div>
                    <div className="text-2xl font-bold text-red-600">
                      {simulationReport.failedScenarios}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-4">Detailed Results</h2>
                  <div className="space-y-2">
                    {simulationReport.results.map((result) => (
                      <div
                        key={result.scenarioId}
                        className={`p-4 rounded-lg border ${
                          result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div 
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => {
                            const newExpandedResults = new Set(expandedResults);
                            if (expandedResults.has(result.scenarioId)) {
                              newExpandedResults.delete(result.scenarioId);
                            } else {
                              newExpandedResults.add(result.scenarioId);
                            }
                            setExpandedResults(newExpandedResults);
                          }}
                        >
                          <div className="font-medium flex items-center gap-2">
                            <ChevronRightIcon 
                              className={`h-5 w-5 transform transition-transform ${
                                expandedResults.has(result.scenarioId) ? 'rotate-90' : ''
                              }`}
                            />
                            {result.scenarioName}
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-sm w-16 text-center ${
                              result.passed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.passed ? 'Passed' : 'Failed'}
                          </div>
                        </div>
                        
                        {expandedResults.has(result.scenarioId) && (
                          <div className="mt-4 pl-7 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
                                  Name
                                </div>
                                <div className="text-sm">{result.scenario.name}</div>
                              </div>
                              
                              <div>
                                <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
                                  Description
                                </div>
                                <div className="text-sm">{result.scenario.description}</div>
                              </div>
                            </div>

                            <div>
                              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
                                Details
                              </div>
                              <div className="text-sm">{result.details}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold">Scenarios</h1>
                  <button
                    onClick={runAllScenarios}
                    disabled={isRunning || scenarios.length === 0}
                    className={`px-4 py-2 rounded-md text-white ${
                      isRunning || scenarios.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRunning ? 'Running...' : 'Run All Scenarios'}
                  </button>
                </div>
                <div className="text-center text-gray-500 mt-10">
                  Select a scenario or run all scenarios
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioViewer({
  scenario,
  onEdit,
  onClose,
}: {
  scenario: ScenarioType;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{scenario.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Close"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">NAME</div>
          <div className="text-base">{scenario.name}</div>
        </div>
        
        <div className="border-t border-gray-200 my-4"></div>
        
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">DESCRIPTION</div>
          <div className="text-base whitespace-pre-wrap">{scenario.description}</div>
        </div>
      </div>
    </div>
  );
}

function ScenarioEditor({
  scenario,
  onSave,
  onCancel,
}: {
  scenario: ScenarioType;
  onSave: (scenario: ScenarioType) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(scenario.name);
  const [description, setDescription] = useState(scenario.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...scenario,
      name,
      description,
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Scenario</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Save"
          >
            <DocumentDuplicateIcon className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Close"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">NAME</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-3 py-2"
          />
        </div>

        <div className="border-t border-gray-200 my-4"></div>

        <div>
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">DESCRIPTION</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-3 py-2"
          />
        </div>
      </form>
    </div>
  );
}
