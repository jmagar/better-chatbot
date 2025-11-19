"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Search,
  Copy,
  Check,
  Settings2,
  RotateCw,
  ChevronDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui/table";
import { Badge } from "ui/badge";
import { Input } from "ui/input";
import { Button } from "ui/button";
import { SortableHeader } from "ui/sortable-header";
import JsonView from "ui/json-view";
import { cn } from "lib/utils";
import type { MCPServerInfo } from "app-types/mcp";
import { BasicUser } from "app-types/user";
import { MCPStatusIndicator } from "./mcp-status-indicator";
import { ShareableActions, type Visibility } from "./shareable-actions";
import { useSWRConfig } from "swr";
import { appStore } from "@/app/store";
import { canChangeVisibilityMCP } from "lib/auth/client-permissions";
import { useCopy } from "@/hooks/use-copy";
import { safe } from "ts-safe";
import { handleErrorWithToast } from "ui/shared-toast";
import { toast } from "sonner";
import { ToolDetailPopup } from "./tool-detail-popup";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";

type StatusFilter = "all" | "connected" | "authorizing" | "error";
type SortBy = "status" | "name" | "toolCount";
type SortDirection = "asc" | "desc";

const DEFAULT_SORT_BY: SortBy = "status";
const DEFAULT_SORT_DIRECTION: SortDirection = "asc";

function getComputedStatus(server: MCPServerInfo) {
  if (server.error) return "error" as const;
  if (server.status === "loading") return "loading" as const;
  if (server.status === "authorizing") return "authorizing" as const;
  return "connected" as const;
}

function getStatusOrder(status: ReturnType<typeof getComputedStatus>) {
  if (status === "authorizing") return 0;
  if (status === "error") return 1;
  if (status === "loading") return 2;
  return 3;
}

interface MCPTableViewProps {
  servers: MCPServerInfo[];
  currentUser: BasicUser;
}

export function MCPTableView({ servers, currentUser }: MCPTableViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT_BY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  );
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const router = useRouter();

  const filteredServers = useMemo(() => {
    let list = [...servers];

    if (statusFilter !== "all") {
      list = list.filter(
        (server) => getComputedStatus(server) === statusFilter,
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((server) => {
        if (server.name.toLowerCase().includes(q)) return true;
        if (server.userName && server.userName.toLowerCase().includes(q)) {
          return true;
        }
        if (
          server.toolInfo.some((tool) => tool.name.toLowerCase().includes(q))
        ) {
          return true;
        }
        return false;
      });
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (sortBy === "status") {
        const aStatus = getComputedStatus(a);
        const bStatus = getComputedStatus(b);
        const aOrder = getStatusOrder(aStatus);
        const bOrder = getStatusOrder(bStatus);
        if (aOrder === bOrder) {
          return a.name.localeCompare(b.name) * direction;
        }
        return (aOrder - bOrder) * direction;
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name) * direction;
      }

      if (sortBy === "toolCount") {
        const aCount = a.toolInfo.length;
        const bCount = b.toolInfo.length;
        if (aCount === bCount) {
          return a.name.localeCompare(b.name) * direction;
        }
        return (aCount - bCount) * direction;
      }

      return 0;
    });

    return list;
  }, [
    servers,
    currentUser.id,
    statusFilter,
    searchQuery,
    sortBy,
    sortDirection,
  ]);

  const totalCount = servers.length;
  const visibleCount = filteredServers.length;

  const handleSort = (field: string) => {
    const nextDirection: SortDirection =
      sortBy === field && sortDirection === "asc" ? "desc" : "asc";
    setSortBy(field as SortBy);
    setSortDirection(nextDirection);
  };

  const statusFilterOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "connected", label: "Connected" },
    { value: "authorizing", label: "Authorizing" },
    { value: "error", label: "Error" },
  ];

  const handleInlineEditConfig = useCallback(
    (server: MCPServerInfo) => {
      router.push(`/mcp/modify/${encodeURIComponent(server.id)}`);
    },
    [router],
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, owner, or tool"
              className="pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-start md:justify-end text-xs">
            <div className="flex items-center gap-2">
              <span className="hidden text-muted-foreground sm:inline-block">
                Status
              </span>
              <div className="flex gap-1">
                {statusFilterOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={
                      statusFilter === option.value ? "default" : "outline"
                    }
                    className={cn(
                      "h-7 px-2",
                      statusFilter !== option.value && "text-muted-foreground",
                    )}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {visibleCount} of {totalCount} servers
        </div>
        <div className="rounded-lg border bg-card w-full overflow-x-auto">
          <Table className="w-full table-fixed" data-testid="mcp-table-view">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader
                  field="name"
                  currentSortBy={sortBy}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Name
                </SortableHeader>
                <SortableHeader
                  field="toolCount"
                  currentSortBy={sortBy}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="w-[140px] pr-4 text-right"
                >
                  Tools
                </SortableHeader>
                <TableHead className="w-[210px] px-4 text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No MCP servers match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredServers.map((server) => {
                  const status = getComputedStatus(server);
                  const isMine = server.userId === currentUser.id;
                  const toolsCount = server.toolInfo.length;
                  const isExpanded = expandedServerId === server.id;

                  return (
                    <Fragment key={server.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/40",
                        )}
                        onClick={() =>
                          setExpandedServerId((current) =>
                            current === server.id ? null : server.id,
                          )
                        }
                        data-testid={`mcp-table-row-${server.id}`}
                        data-state={isExpanded ? "expanded" : "collapsed"}
                      >
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <MCPStatusIndicator status={status} />
                              <span className="font-medium">{server.name}</span>
                              {isMine && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Mine
                                </Badge>
                              )}
                              {!isMine && server.visibility === "public" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Shared
                                </Badge>
                              )}
                            </div>
                            {server.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {server.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right pr-4">
                          <span className="text-sm text-muted-foreground">
                            {toolsCount} tool{toolsCount === 1 ? "" : "s"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-top px-4">
                          <McpRowActions
                            server={server}
                            currentUser={currentUser}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/40">
                          <TableCell
                            colSpan={3}
                            className="p-0 align-top whitespace-normal"
                          >
                            <div className="px-4 pb-4 pt-0">
                              <div className="mt-2 rounded-md border bg-card">
                                <div className="flex flex-col gap-4 p-4 md:flex-row">
                                  {isMine && server.config && (
                                    <div className="w-full min-w-0 md:w-1/2">
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Configuration
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          Double-click to edit
                                        </span>
                                      </div>
                                      <div
                                        className="max-h-64 max-w-full overflow-y-auto overflow-x-auto rounded border bg-background/80 p-2 text-xs"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onDoubleClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleInlineEditConfig(server);
                                        }}
                                      >
                                        <JsonView data={server.config} />
                                      </div>
                                    </div>
                                  )}
                                  <div
                                    className={cn(
                                      "min-w-0 flex-1",
                                      isMine && server.config
                                        ? "md:w-1/2"
                                        : "w-full",
                                    )}
                                  >
                                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                                      Available tools
                                    </div>
                                    <div
                                      className="max-h-64 space-y-2 overflow-y-auto pr-1"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                    >
                                      {server.toolInfo.length > 0 ? (
                                        server.toolInfo.map((tool) => (
                                          <ToolDetailPopup
                                            key={tool.name}
                                            tool={tool}
                                            serverId={server.id}
                                          >
                                            <div className="flex cursor-pointer items-start gap-2 rounded-md border bg-background/60 p-2 hover:bg-accent/40">
                                              <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium truncate">
                                                  {tool.name}
                                                </p>
                                                {tool.description && (
                                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                                    {tool.description}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          </ToolDetailPopup>
                                        ))
                                      ) : (
                                        <div className="rounded-md bg-secondary/30 p-3 text-center">
                                          <p className="text-xs text-muted-foreground">
                                            No tools available.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

interface McpRowActionsProps {
  server: MCPServerInfo;
  currentUser: BasicUser;
}

function McpRowActions({ server, currentUser }: McpRowActionsProps) {
  const { mutate } = useSWRConfig();
  const appStoreMutate = appStore((state) => state.mutate);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visibilityChangeLoading, setVisibilityChangeLoading] = useState(false);
  const isOwner = server.userId === currentUser.id;
  const canChangeVisibility = useMemo(
    () => canChangeVisibilityMCP(currentUser.role),
    [currentUser.role],
  );
  const { copied, copy } = useCopy(2000);

  const pipeProcessing = useCallback(
    async (fn: () => Promise<unknown>) =>
      safe(() => setIsProcessing(true))
        .ifOk(fn)
        .ifOk(() => mutate("/api/mcp/list"))
        .ifFail(handleErrorWithToast)
        .watch(() => setIsProcessing(false)),
    [mutate],
  );

  const handleRefresh = useCallback(
    () =>
      pipeProcessing(async () => {
        const { refreshMcpClientAction } = await import(
          "@/app/api/mcp/actions"
        );
        return refreshMcpClientAction(server.id);
      }),
    [pipeProcessing, server.id],
  );

  const handleDelete = useCallback(
    () =>
      pipeProcessing(async () => {
        const { removeMcpClientAction } = await import("@/app/api/mcp/actions");
        return removeMcpClientAction(server.id);
      }),
    [pipeProcessing, server.id],
  );

  const handleVisibilityChange = useCallback(
    (newVisibility: Visibility) => {
      const mcpVisibility = newVisibility === "public" ? "public" : "private";
      safe(() => setVisibilityChangeLoading(true))
        .map(async () => {
          const { shareMcpServerAction } = await import(
            "@/app/api/mcp/actions"
          );
          return shareMcpServerAction(server.id, mcpVisibility);
        })
        .ifOk(() => {
          mutate("/api/mcp/list");
        })
        .ifFail(handleErrorWithToast)
        .watch(() => {
          setVisibilityChangeLoading(false);
        });
    },
    [mutate, server.id],
  );

  const handleCustomize = useCallback(() => {
    appStoreMutate({
      mcpCustomizationPopup: {
        id: server.id,
        name: server.name,
        config: server.config,
        status: server.status,
        toolInfo: server.toolInfo,
        error: server.error,
        visibility: server.visibility,
        enabled: server.enabled,
        userId: server.userId,
      },
    });
  }, [appStoreMutate, server]);

  const handleCopyConfig = useCallback(() => {
    if (!server.config) {
      toast.error("Failed to copy MCP config");
      return;
    }

    try {
      const configJson = JSON.stringify(
        { [server.name]: server.config },
        null,
        2,
      );
      copy(configJson);
      toast.success("MCP config copied to clipboard");
    } catch (_error) {
      toast.error("Failed to copy MCP config");
    }
  }, [copy, server.config, server.name]);

  return (
    <>
      {/* Desktop / tablet actions: full icon row */}
      <div className="hidden md:flex items-center justify-end gap-1">
        {isOwner && server.config && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isProcessing}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCopyConfig();
            }}
          >
            {copied ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        )}
        {isOwner && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isProcessing}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCustomize();
            }}
          >
            <Settings2 className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={isProcessing}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleRefresh();
          }}
        >
          <RotateCw className="size-3.5" />
        </Button>
        <ShareableActions
          type="mcp"
          visibility={server.visibility === "public" ? "public" : "private"}
          isOwner={isOwner}
          canChangeVisibility={canChangeVisibility}
          editHref={
            isOwner ? `/mcp/modify/${encodeURIComponent(server.id)}` : undefined
          }
          onVisibilityChange={
            canChangeVisibility ? handleVisibilityChange : undefined
          }
          onDelete={isOwner ? handleDelete : undefined}
          isVisibilityChangeLoading={visibilityChangeLoading}
          isDeleteLoading={isProcessing}
          disabled={isProcessing}
        />
      </div>

      {/* Mobile actions: primary button + dropdown chevron */}
      <div className="flex md:hidden items-center justify-end gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={isProcessing}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleRefresh();
          }}
        >
          <RotateCw className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={isProcessing}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && server.config && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleCopyConfig();
                }}
              >
                Copy config
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleCustomize();
                }}
              >
                Customize
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleRefresh();
              }}
            >
              Refresh
            </DropdownMenuItem>
            {isOwner && canChangeVisibility && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const nextVisibility: Visibility =
                    server.visibility === "public" ? "private" : "public";
                  handleVisibilityChange(nextVisibility);
                }}
              >
                {server.visibility === "public"
                  ? "Make private"
                  : "Feature (public)"}
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDelete();
                }}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
