'use client';
import { CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

export function CopyButton({
    onCopy,
    label,
    successLabel,
}: {
    onCopy: () => void;
    label: string;
    successLabel: string;
}) {
    const [showCopySuccess, setShowCopySuccess] = useState(false);
    const handleCopy = () => {
        onCopy();
        setShowCopySuccess(true);
        setTimeout(() => {
            setShowCopySuccess(false);
        }, 500);
    }
    return <button onClick={handleCopy} className="0 text-gray-300 hover:text-gray-700 flex items-center gap-1 group">
        {showCopySuccess ? (
            <CheckIcon size={16} />
        ) : (
            <CopyIcon size={16} />
        )}
        <div className="text-xs hidden group-hover:block">
            {showCopySuccess ? successLabel : label}
        </div>
    </button>
}