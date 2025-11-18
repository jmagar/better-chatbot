import { memo } from "react";

type MCPStatus = "connected" | "error" | "loading" | "authorizing";

interface MCPStatusIndicatorProps {
  status: MCPStatus;
}

export const MCPStatusIndicator = memo(function MCPStatusIndicator({
  status,
}: MCPStatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "loading":
        return "bg-yellow-500";
      case "authorizing":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const isPulsing = status === "loading";

  return (
    <div
      className={`size-2 rounded-full ${getStatusColor()} ${isPulsing ? "animate-pulse" : ""}`}
      data-status={status}
      aria-label={`Status: ${status}`}
    />
  );
});
