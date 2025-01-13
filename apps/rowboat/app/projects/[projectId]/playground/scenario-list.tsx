'use client';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Spinner, Textarea } from "@nextui-org/react";
import { useState, useEffect } from "react";
import { getScenarios, createScenario, updateScenario, deleteScenario } from "@/app/actions";
import { Scenario, WithStringId } from "@/app/lib/types";
import { z } from "zod";
import { EditableField } from "@/app/lib/components/editable-field";
import { HamburgerIcon } from "@/app/lib/components/icons";
import { EllipsisVerticalIcon } from "lucide-react";

export function AddScenarioForm({
    onAdd,
}: {
    onAdd: (name: string, description: string) => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleAdd = async () => {
        try {
            setSaving(true);
            await onAdd(name, description);
            setName("");
            setDescription("");
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid input");
        } finally {
            setSaving(false);
        }
    };

    return <div className="flex flex-col gap-2 border rounded-lg p-4 shadow-sm">
        <div className="font-semibold text-gray-500">Add Scenario</div>
        <Input
            label="Scenario Name"
            labelPlacement="outside"
            value={name}
            placeholder="Provide a name for the scenario"
            size="sm"
            variant="bordered"
            onChange={(e) => setName(e.target.value)}
            isInvalid={!!error}
            required
        />
        <Textarea
            label="Scenario Description"
            labelPlacement="outside"
            value={description}
            placeholder="Describe the test scenario"
            size="sm"
            variant="bordered"
            onChange={(e) => setDescription(e.target.value)}
            isInvalid={!!error}
            required
        />
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <Button
            onClick={handleAdd}
            isLoading={saving}
            isDisabled={saving}
            size="sm"
            className="self-start"
            variant="bordered"
            startContent={
                <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 12h14m-7 7V5" />
                </svg>
            }
        >
            Add Scenario
        </Button>
    </div>
}

export function ScenarioList({
    projectId,
    onPlay,
}: {
    projectId: string;
    onPlay: (scenario: z.infer<typeof Scenario>) => void;
}) {
    const [scenarios, setScenarios] = useState<WithStringId<z.infer<typeof Scenario> & {
        tmp?: boolean;
    }>[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tmpScenarioId, setTmpScenarioId] = useState<number>(0);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        getScenarios(projectId)
            .then(setScenarios)
            .finally(() => setLoading(false));
    }, [projectId]);

    async function handleAddScenario(name: string, description: string) {
        try {
            const tmpId = 'tmp-' + tmpScenarioId;
            setTmpScenarioId(tmpScenarioId + 1);
            setSaving(true);
            setShowAddForm(false);
            setScenarios([...scenarios, {
                _id: tmpId,
                name,
                description,
                projectId,
                createdAt: new Date().toISOString(),
                lastUpdatedAt: new Date().toISOString(),
                tmp: true,
            }]);
            const id = await createScenario(projectId, name, description);
            setScenarios([...scenarios, {
                _id: id,
                name,
                description,
                projectId,
                createdAt: new Date().toISOString(),
                lastUpdatedAt: new Date().toISOString(),
                tmp: false,
            }]);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid input");
        } finally {
            setSaving(false);
        }
    };

    async function handleEditScenario(scenarioId: string, name: string, description: string) {
        setSaving(true);
        setScenarios(scenarios.map(scenario => scenario._id === scenarioId ? { ...scenario, name, description } : scenario));
        await updateScenario(projectId, scenarioId, name, description);
        setSaving(false);
    }

    async function handleDeleteScenario(scenarioId: string) {
        setSaving(true);
        setScenarios(scenarios.filter(scenario => scenario._id !== scenarioId));
        await deleteScenario(projectId, scenarioId);
        setSaving(false);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-2 items-center">
                <div className="font-semibold text-gray-500">Scenarios</div>
                {saving && <div className="flex items-center gap-2">
                    <Spinner />
                    <div className="text-sm text-gray-500">Saving...</div>
                </div>}
                {!showAddForm && <Button
                    onClick={() => setShowAddForm(true)}
                    size="sm"
                    variant="bordered"
                >
                    Add Scenario
                </Button>}
            </div>
            {loading && <div className="flex justify-center items-center p-8 gap-2">
                <Spinner size="sm" />
                <div className="text-sm text-gray-500">Loading scenarios...</div>
            </div>}

            {showAddForm && <AddScenarioForm onAdd={handleAddScenario} />}

            {!loading && scenarios.length === 0 && <div className="flex justify-center items-center p-8 gap-2">
                <div className="text-sm text-gray-500">No scenarios added</div>
            </div>}

            {scenarios.length > 0 && <div className="flex flex-col gap-2">
                {scenarios.map((scenario) => (
                    <div key={scenario._id} className="flex justify-between gap-2 border p-2 rounded-md shadow-sm">
                        <div className="flex flex-col gap-1 grow">
                            <EditableField
                                key={'name'}
                                label="Name"
                                placeholder="Scenario Name"
                                value={scenario.name}
                                onChange={(value) => handleEditScenario(scenario._id, value, scenario.description)}
                                locked={scenario.tmp}
                            />
                            <EditableField
                                key={'description'}
                                label="Description"
                                multiline
                                markdown
                                light
                                placeholder="Scenario Description"
                                value={scenario.description}
                                onChange={(value) => handleEditScenario(scenario._id, scenario.name, value)}
                                locked={scenario.tmp}
                            />
                        </div>
                        <button
                            className="text-sm text-blue-500 hover:text-gray-700 font-semibold uppercase"
                            onClick={() => onPlay(scenario)}
                        >
                            Run &rarr;
                        </button>
                        <Dropdown>
                            <DropdownTrigger>
                                <button className="text-gray-300 hover:text-gray-700">
                                    <EllipsisVerticalIcon size={16} />
                                </button>
                            </DropdownTrigger>
                            <DropdownMenu
                                disabledKeys={scenario.tmp ? ['delete'] : ['']}
                                onAction={(key) => {
                                    if (key === 'delete') {
                                        handleDeleteScenario(scenario._id);
                                    }
                                }}
                            >
                                <DropdownItem
                                    key="delete"
                                    color="danger"
                                >
                                    Delete
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                ))}
            </div>}

        </div>
    );
}
