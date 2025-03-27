import clsx from "clsx";

export function ActionButton({
    icon = null,
    children,
    onClick = undefined,
    disabled = false,
    primary = false,
}: {
    icon?: React.ReactNode;
    children: React.ReactNode;
    onClick?: () => void | undefined;
    disabled?: boolean;
    primary?: boolean;
}) {
    const onClickProp = onClick ? { onClick } : {};
    return <button
        disabled={disabled}
        className={clsx("rounded-md text-xs flex items-center gap-1 disabled:text-gray-300 dark:disabled:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300", {
            "text-blue-600 dark:text-blue-400": primary,
            "text-gray-400 dark:text-gray-500": !primary,
        })}
        {...onClickProp}
    >
        {icon}
        {children}
    </button>;
}

interface PanelProps {
    title: React.ReactNode;
    rightActions?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    maxHeight?: string;
    variant?: 'default' | 'copilot' | 'projects';
}

export function Panel({
    title,
    rightActions,
    actions,
    children,
    maxHeight,
    variant = 'default',
}: PanelProps) {
    return <div className={clsx(
        "flex flex-col overflow-hidden rounded-xl border",
        "border-zinc-200 dark:border-zinc-800",
        "bg-white dark:bg-zinc-900",
        maxHeight ? "max-h-[var(--panel-height)]" : "h-full"
    )}
    style={{ '--panel-height': maxHeight } as React.CSSProperties}
    >
        <div className={clsx(
            "shrink-0 border-b border-zinc-100 dark:border-zinc-800",
            variant === 'projects' ? "flex flex-col gap-3 px-4 py-3" : "flex items-center justify-between px-4 py-3"
        )}>
            {variant === 'projects' ? (
                <>
                    <div className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {title}
                    </div>
                    {actions && <div className="flex items-center gap-2">
                        {actions}
                    </div>}
                </>
            ) : variant === 'copilot' ? (
                <>
                    <div className="flex items-center gap-2">
                        {title}
                    </div>
                    {rightActions}
                </>
            ) : (
                <>
                    {title}
                    {rightActions}
                </>
            )}
        </div>
        <div className={clsx(
            "min-h-0 flex-1 overflow-y-auto",
            variant === 'projects' && "custom-scrollbar"
        )}>
            {variant === 'projects' ? (
                <div className="px-3 py-2 pb-4">
                    {children}
                </div>
            ) : children}
        </div>
    </div>;
}