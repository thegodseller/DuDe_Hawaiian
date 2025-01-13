export function Pane({
    title,
    actions,
    children,
    fancy = false,
}: {
    title: React.ReactNode;
    actions: React.ReactNode[];
    children: React.ReactNode;
    fancy?: boolean;
}) {
    return <div className={`h-full flex flex-col overflow-auto border rounded-md ${fancy ? 'border-blue-200' : 'border-gray-200'}`}>
        <div className={`shrink-0 flex justify-between items-center gap-2 px-2 py-1 bg-gray-50 rounded-t-md ${fancy ? 'bg-blue-50' : ''}`}>
            <div className={`text-sm ${fancy ? 'text-blue-600' : 'text-gray-600'} uppercase font-semibold`}>
                {title}
            </div>
            <div className="rounded-md hover:text-gray-800 px-2 py-1 text-gray-600 text-sm flex items-center gap-1">
                {actions}
            </div>
        </div>
        <div className="grow overflow-auto flex flex-col justify-start p-2">
            {children}
        </div>
    </div>;
}

export function ActionButton({
    icon = null,
    children,
    onClick,
    disabled = false,
    primary = false,
}: {
    icon?: React.ReactNode;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
}) {
    return <button
        disabled={disabled}
        className={`rounded-md hover:text-gray-800 px-2 py-1 ${primary ? 'text-blue-600' : 'text-gray-600'} text-sm flex items-center gap-1 disabled:text-gray-300`}
        onClick={onClick}
    >
        {icon}
        {children}
    </button>;
}