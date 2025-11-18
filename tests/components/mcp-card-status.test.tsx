import { render } from "@testing-library/react";
import { MCPCard } from "@/components/mcp-card";
import type { MCPServerInfo } from "app-types/mcp";
import { vi } from "vitest";

// Mock the server actions
vi.mock("@/app/api/mcp/actions", () => ({
  refreshMcpClientAction: vi.fn(),
  removeMcpClientAction: vi.fn(),
  shareMcpServerAction: vi.fn(),
}));

// Mock the OAuth redirect
vi.mock("lib/ai/mcp/oauth-redirect", () => ({
  redriectMcpOauth: vi.fn(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/mcp",
}));

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the app store
vi.mock("@/app/store", () => ({
  appStore: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

const mockUser = { id: "user1", role: "user" };

const baseMcpProps: MCPServerInfo & { user: any } = {
  id: "test-server",
  config: {},
  error: null,
  status: "connected",
  name: "Test Server",
  toolInfo: [],
  visibility: "private",
  enabled: true,
  userId: "user1",
  userName: "Test User",
  userAvatar: null,
  user: mockUser,
};

describe("MCPCard Status Logic", () => {
  it("shows connected status when no error and status is connected", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="connected" error={null} />,
    );
    const statusDot = container.querySelector('[data-status="connected"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows error status when error prop exists", () => {
    const { container } = render(
      <MCPCard
        {...baseMcpProps}
        status="connected"
        error="Connection failed"
      />,
    );
    const statusDot = container.querySelector('[data-status="error"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows loading status when status prop is loading", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="loading" />,
    );
    const statusDot = container.querySelector('[data-status="loading"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows authorizing status when status prop is authorizing", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="authorizing" />,
    );
    const statusDot = container.querySelector('[data-status="authorizing"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("prioritizes error status over other statuses", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="connected" error="Error occurred" />,
    );
    const statusDot = container.querySelector('[data-status="error"]');
    expect(statusDot).toBeInTheDocument();
  });
});
