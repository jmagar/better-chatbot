import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "lib/utils";

export interface SplitButtonProps {
  /** Main button label */
  children: React.ReactNode;
  /** Main button click handler */
  onClick: () => void;
  /** Dropdown menu content */
  dropdownContent: React.ReactNode;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "destructive";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS classes */
  className?: string;
  /** Icon to display before label */
  icon?: React.ReactNode;
  /** Disable both buttons */
  disabled?: boolean;
  /** Test ID for main button */
  "data-testid"?: string;
}

export function SplitButton({
  children,
  onClick,
  dropdownContent,
  variant = "outline",
  size = "default",
  className,
  icon,
  disabled = false,
  "data-testid": testId,
}: SplitButtonProps) {
  return (
    <div className={cn("inline-flex", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        className="rounded-r-none border-r-0"
      >
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            data-testid={testId ? `${testId}-dropdown` : undefined}
            aria-label="Toggle split button menu"
            className="rounded-l-none px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{dropdownContent}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
