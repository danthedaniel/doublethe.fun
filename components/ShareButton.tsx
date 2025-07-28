import { useCallback, useState } from "react";
import { ShareIcon } from "@heroicons/react/24/outline";

interface ShareButtonProps {
  onShare: () => void;
}

export default function ShareButton({ onShare }: ShareButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipTimer = useCallback(() => {
    setShowTooltip(true);
    setTimeout(() => {
      setShowTooltip(false);
    }, 1000);
  }, []);

  const handleClick = useCallback(() => {
    onShare();
    tooltipTimer();
  }, [onShare, tooltipTimer]);

  return (
    <div className="relative">
      <button onClick={handleClick} className="p-2 rounded-md text-slate-700 border border-gray-200 bg-white/90 hover:bg-white active:bg-gray-200 cursor-pointer">
        <ShareIcon className="w-6 h-6" />
      </button>
      {showTooltip && (
        <div onClick={() => setShowTooltip(false)} className="absolute top-0 right-14 cursor-pointer bg-white/90 hover:bg-white p-2 w-48 rounded-md shadow-lg border border-gray-200 text-center text-slate-700">
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
