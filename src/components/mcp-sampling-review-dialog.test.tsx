import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SamplingReviewDialog } from "./mcp-sampling-review-dialog";

afterEach(() => {
  cleanup();
});

describe("SamplingReviewDialog", () => {
  const mockMessages = [
    {
      role: "user" as const,
      content: { type: "text" as const, text: "Hello, please analyze this" },
    },
  ];

  it("renders sampling review dialog with messages", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText(/Review Sampling Request/i)).toBeInTheDocument();
    expect(screen.getByText(/test-server/i)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Hello, please analyze this"),
    ).toBeInTheDocument();
  });

  it("allows editing message text", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    const textarea = screen.getByDisplayValue("Hello, please analyze this");
    fireEvent.change(textarea, { target: { value: "Modified text" } });

    expect(screen.getByDisplayValue("Modified text")).toBeInTheDocument();
  });

  it("calls onApprove with edited messages", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    const textarea = screen.getByDisplayValue("Hello, please analyze this");
    fireEvent.change(textarea, { target: { value: "Modified text" } });

    const approveButton = screen.getByRole("button", {
      name: /Approve & Submit/i,
    });
    fireEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledWith([
      {
        role: "user",
        content: { type: "text", text: "Modified text" },
      },
    ]);
  });

  it("calls onReject when reject button clicked", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    const rejectButton = screen.getByRole("button", { name: /Reject/i });
    fireEvent.click(rejectButton);

    expect(onReject).toHaveBeenCalled();
  });

  it("displays system prompt when provided", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        systemPrompt="You are a helpful assistant"
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("You are a helpful assistant")).toBeInTheDocument();
  });

  it("displays model preferences and parameters", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <SamplingReviewDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        messages={mockMessages}
        modelPreferences={{ hints: [{ name: "claude-3-sonnet" }] }}
        temperature={0.7}
        maxTokens={1000}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText(/claude-3-sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.7/i)).toBeInTheDocument();
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
  });
});
