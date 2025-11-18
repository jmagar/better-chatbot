import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SplitButton } from "../split-button";
import { DropdownMenuItem } from "../dropdown-menu";

describe("SplitButton", () => {
  it("renders main button label", () => {
    render(
      <SplitButton
        onClick={vi.fn()}
        dropdownContent={<DropdownMenuItem>Export</DropdownMenuItem>}
      >
        Add Server
      </SplitButton>,
    );

    expect(screen.getByText("Add Server")).toBeDefined();
  });

  it("calls onClick when main button is clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <SplitButton
        onClick={handleClick}
        dropdownContent={<DropdownMenuItem>Export</DropdownMenuItem>}
        data-testid="split-button"
      >
        Add Server
      </SplitButton>,
    );

    await user.click(screen.getByTestId("split-button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("opens dropdown when chevron is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SplitButton
        onClick={vi.fn()}
        dropdownContent={<DropdownMenuItem>Export All</DropdownMenuItem>}
        data-testid="split-button"
      >
        Add Server
      </SplitButton>,
    );

    const [dropdownTrigger] = screen.getAllByTestId("split-button-dropdown");
    await user.click(dropdownTrigger);

    expect(dropdownTrigger.getAttribute("data-state")).toBe("open");
  });
});
