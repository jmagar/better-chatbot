import { render, screen, fireEvent } from "@testing-library/react";
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
  config: { command: "test" },
  error: null,
  status: "connected",
  name: "Test Server",
  toolInfo: [{ name: "test-tool", description: "A test tool" }],
  visibility: "private",
  enabled: true,
  userId: "user1",
  userName: "Test User",
  userAvatar: null,
  user: mockUser,
};

describe("MCPCard Collapse", () => {
  it("renders collapsed by default (content hidden)", () => {
    render(<MCPCard {...baseMcpProps} />);

    // CardContent should not be visible
    const content = screen.queryByText("configuration");
    expect(content).not.toBeInTheDocument();
  });

  it("shows collapse toggle button", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector(
      '[data-testid="collapse-toggle"]',
    );
    expect(toggleButton).toBeInTheDocument();
  });

  it("expands content when toggle button clicked", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector(
      '[data-testid="collapse-toggle"]',
    ) as HTMLElement;

    fireEvent.click(toggleButton);

    // Configuration section should now be visible
    const configSection = screen.getByText("configuration");
    expect(configSection).toBeInTheDocument();
  });

  it("collapses content when toggle button clicked again", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector(
      '[data-testid="collapse-toggle"]',
    ) as HTMLElement;

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByText("configuration")).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByText("configuration")).not.toBeInTheDocument();
  });

  it("shows ChevronDown icon when collapsed", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const chevronDown = container.querySelector('[data-icon="chevron-down"]');
    expect(chevronDown).toBeInTheDocument();
  });

  it("shows ChevronUp icon when expanded", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector(
      '[data-testid="collapse-toggle"]',
    ) as HTMLElement;

    fireEvent.click(toggleButton);

    const chevronUp = container.querySelector('[data-icon="chevron-up"]');
    expect(chevronUp).toBeInTheDocument();
  });
});
