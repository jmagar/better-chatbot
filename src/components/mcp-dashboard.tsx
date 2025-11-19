"use client";
import { MCPCard } from "@/components/mcp-card";
import { MCPTableView } from "@/components/mcp-table-view";
import { canCreateMCP } from "lib/auth/client-permissions";

import { Button } from "@/components/ui/button";
import { SplitButton } from "@/components/ui/split-button";
import { MCPOverview } from "@/components/mcp-overview";

import { Skeleton } from "ui/skeleton";

import { ScrollArea } from "ui/scroll-area";
import { useTranslations } from "next-intl";
import { MCPIcon } from "ui/mcp-icon";
import { useMcpList } from "@/hooks/queries/use-mcp-list";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, LayoutGrid, Loader2, Table2 } from "lucide-react";
import { cn } from "lib/utils";
import { useRouter } from "next/navigation";
import { BasicUser } from "app-types/user";
import { DropdownMenuItem } from "ui/dropdown-menu";

const LightRays = dynamic(() => import("@/components/ui/light-rays"), {
  ssr: false,
});

interface MCPDashboardProps {
  message?: string;
  user: BasicUser;
}

export default function MCPDashboard({ message, user }: MCPDashboardProps) {
  const t = useTranslations("MCP");
  const router = useRouter();

  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/mcp/export");

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const data = await response.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mcp-config-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("MCP.exportSuccess"));
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t("MCP.exportError"));
    }
  };

  const handleAddServer = () => {
    router.push("/mcp/create");
  };

  // Check if user can create MCP connections using Better Auth permissions
  const canCreate = canCreateMCP(user?.role);

  const {
    data: mcpList,
    isLoading,
    isValidating,
  } = useMcpList({
    refreshInterval: 10000,
  });

  const { myServers, featuredServers } = useMemo(() => {
    if (!mcpList) return { myServers: [], featuredServers: [] };

    const sortFn = (a: any, b: any) => {
      if (a.status === b.status) return 0;
      if (a.status === "authorizing") return -1;
      if (b.status === "authorizing") return 1;
      return 0;
    };

    const owned = mcpList.filter((s) => s.userId === user?.id).sort(sortFn);
    const featured = mcpList
      .filter((s) => s.userId !== user?.id && s.visibility === "public")
      .sort(sortFn);

    return { myServers: owned, featuredServers: featured };
  }, [mcpList]);

  // Delay showing validating spinner until validating persists for 500ms
  const [showValidating, setShowValidating] = useState(false);

  const particle = useMemo(() => {
    return (
      <>
        <div className="absolute opacity-30 pointer-events-none top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <LightRays className="bg-transparent" />
        </div>

        <div className="absolute pointer-events-none top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-t from-background to-50% to-transparent z-20" />
        </div>
        <div className="absolute pointer-events-none top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-l from-background to-20% to-transparent z-20" />
        </div>
        <div className="absolute pointer-events-none top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-r from-background to-20% to-transparent z-20" />
        </div>
      </>
    );
  }, [isLoading, mcpList?.length]);

  useEffect(() => {
    if (isValidating) {
      setShowValidating(false);
      const timerId = setTimeout(() => setShowValidating(true), 500);
      return () => clearTimeout(timerId);
    }
    setShowValidating(false);
  }, [isValidating]);

  useEffect(() => {
    if (message) {
      toast(<p className="whitespace-pre-wrap break-all">{message}</p>, {
        id: "mcp-list-message",
      });
    }
  }, []);

  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  return (
    <>
      {particle}
      <ScrollArea className="h-full w-full z-40 ">
        <div
          className={cn(
            "pt-8 flex-1 relative flex flex-col gap-4 px-8 h-full mx-auto pb-8",
            viewMode === "table" ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          <div className={cn("flex items-center pb-8 gap-3 flex-wrap")}>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {canCreate ? t("mcpServers") : t("availableMcpServers")}
              {showValidating && isValidating && !isLoading && (
                <Loader2 className="size-4 animate-spin" />
              )}
            </h1>

            <div className="flex-1" />

            <div className="flex flex-col items-end gap-2">
              {canCreate && (
                <SplitButton
                  onClick={handleAddServer}
                  variant="outline"
                  className="font-semibold bg-input/20"
                  icon={<MCPIcon className="fill-foreground size-3.5" />}
                  data-testid="add-mcp-server-button"
                  dropdownContent={
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={handleExportAll}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t("exportAll")}
                    </DropdownMenuItem>
                  }
                >
                  {t("addMcpServer")}
                </SplitButton>
              )}
              <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-0.5 text-xs">
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  className="h-7 w-7"
                  aria-label="Cards view"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  className="h-7 w-7"
                  aria-label="Table view"
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-60 w-full" />
              <Skeleton className="h-60 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
          ) : myServers?.length || featuredServers?.length ? (
            viewMode === "table" ? (
              <MCPTableView servers={mcpList ?? []} currentUser={user} />
            ) : (
              <div
                className="flex flex-col gap-8 mb-4"
                data-testid="mcp-servers-section"
              >
                {myServers?.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                      {t("myMcpServers")}
                    </h2>
                    <div
                      className="flex flex-col gap-6"
                      data-testid="my-mcp-servers-section"
                    >
                      {myServers.map((mcp) => (
                        <MCPCard key={mcp.id} {...mcp} user={user} />
                      ))}
                    </div>
                  </div>
                )}
                {featuredServers?.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                      {t("featuredMcpServers")}
                    </h2>
                    <div
                      className="flex flex-col gap-6"
                      data-testid="featured-mcp-servers-section"
                    >
                      {featuredServers.map((mcp) => (
                        <MCPCard key={mcp.id} {...mcp} user={user} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : // When MCP list is empty
          canCreate ? (
            <MCPOverview />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 my-20 text-center">
              <h3 className="text-2xl md:text-4xl font-semibold">
                {t("noMcpServersAvailable")}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {t("noMcpServersAvailableDescription")}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
