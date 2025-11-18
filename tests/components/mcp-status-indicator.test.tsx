import { render, screen } from "@testing-library/react";
import { MCPStatusIndicator } from "@/components/mcp-status-indicator";

describe("MCPStatusIndicator", () => {
  it("renders green dot for connected status", () => {
    const { container } = render(<MCPStatusIndicator status="connected" />);
    const dot = container.querySelector('[data-status="connected"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-green-500");
  });

  it("renders red dot for error status", () => {
    const { container } = render(<MCPStatusIndicator status="error" />);
    const dot = container.querySelector('[data-status="error"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-red-500");
  });

  it("renders yellow dot for loading status", () => {
    const { container } = render(<MCPStatusIndicator status="loading" />);
    const dot = container.querySelector('[data-status="loading"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-yellow-500");
  });

  it("renders orange dot for authorizing status", () => {
    const { container } = render(<MCPStatusIndicator status="authorizing" />);
    const dot = container.querySelector('[data-status="authorizing"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-orange-500");
  });

  it("has pulsing animation for loading status", () => {
    const { container } = render(<MCPStatusIndicator status="loading" />);
    const dot = container.querySelector('[data-status="loading"]');
    expect(dot).toHaveClass("animate-pulse");
  });
});
