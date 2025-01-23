import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

export function CopyAsJsonButton({ onCopy }: { onCopy: () => void }) {
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    const handleCopyChat = () => {
        onCopy();
        setShowCopySuccess(true);
        setTimeout(() => {
            setShowCopySuccess(false);
        }, 500);
    };

    return <button
        onClick={handleCopyChat}
        className="absolute top-0 right-0 text-gray-300 hover:text-gray-700 flex items-center gap-1 group"
    >
        {showCopySuccess ? (
            <CheckIcon size={16} />
        ) : (
            <CopyIcon size={16} />
        )}
        <div className="text-xs hidden group-hover:block">
            {showCopySuccess ? 'Copied' : 'Copy as JSON'}
        </div>
    </button>
}