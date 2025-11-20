import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ElicitationDialog } from "./mcp-elicitation-dialog";

afterEach(() => {
  cleanup();
});

describe("ElicitationDialog", () => {
  it("renders elicitation dialog in form mode", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    const schema = {
      type: "object",
      properties: {
        apiKey: { type: "string", description: "API Key" },
      },
      required: ["apiKey"],
    };

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Please provide credentials"
        requestedSchema={schema}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/User Approval Required/i)).toBeInTheDocument();
    expect(screen.getByText(/test-server/i)).toBeInTheDocument();
    expect(screen.getByText("Please provide credentials")).toBeInTheDocument();
    expect(screen.getByLabelText(/apiKey/i)).toBeInTheDocument();
  });

  it("validates required fields in form mode", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    const schema = {
      type: "object",
      properties: {
        apiKey: { type: "string" },
      },
      required: ["apiKey"],
    };

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Please provide credentials"
        requestedSchema={schema}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    const acceptButton = screen.getAllByRole("button", { name: /Accept/i })[0];
    fireEvent.click(acceptButton);

    // Should show validation error and not call onAccept
    expect(screen.getByText(/apiKey is required/i)).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("accepts form data when valid", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    const schema = {
      type: "object",
      properties: {
        apiKey: { type: "string" },
      },
      required: ["apiKey"],
    };

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Please provide credentials"
        requestedSchema={schema}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    const input = screen.getByLabelText(/apiKey/i);
    fireEvent.change(input, { target: { value: "test-key-123" } });

    const acceptButton = screen.getAllByRole("button", { name: /Accept/i })[0];
    fireEvent.click(acceptButton);

    expect(onAccept).toHaveBeenCalledWith({ apiKey: "test-key-123" });
  });

  it("renders enum fields as select dropdowns", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    const schema = {
      type: "object",
      properties: {
        region: {
          type: "string",
          enum: ["us-east-1", "eu-west-1"],
        },
      },
    };

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Select region"
        requestedSchema={schema}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    // The message appears in the Alert component
    const messages = screen.getAllByText(/Select region/i);
    expect(messages.length).toBeGreaterThan(0);
    // Check for the select button (combobox)
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders URL mode with external link", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="url"
        message="Please authorize"
        url="https://example.com/oauth"
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Please authorize")).toBeInTheDocument();
    expect(screen.getByText(/Open Authorization Page/i)).toBeInTheDocument();
  });

  it("calls onDecline when decline button clicked", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Test"
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    const declineButton = screen.getByRole("button", { name: /Decline/i });
    fireEvent.click(declineButton);

    expect(onDecline).toHaveBeenCalled();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    render(
      <ElicitationDialog
        open={true}
        onOpenChange={vi.fn()}
        serverName="test-server"
        mode="form"
        message="Test"
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
