# MCP Card Collapse & Status Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MCP server cards collapsed by default (showing only server name + buttons) and add visual status indicators next to server names.

**Architecture:** Add collapsible state management to MCPCard component, extract status color logic from existing card styling (red border for errors), create status dot indicator component.

**Tech Stack:** React hooks (useState), Tailwind CSS, Lucide icons (ChevronDown/ChevronUp)

---

## Task 1: Create Status Indicator Component

**Files:**
- Create: `src/components/mcp-status-indicator.tsx`
- Test: `tests/components/mcp-status-indicator.test.tsx`

### Step 1: Write the failing test

Create test file at `tests/components/mcp-status-indicator.test.tsx`:

```typescript
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
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/components/mcp-status-indicator.test.tsx`

Expected: FAIL with "Cannot find module '@/components/mcp-status-indicator'"

### Step 3: Write minimal implementation

Create `src/components/mcp-status-indicator.tsx`:

```typescript
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
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/components/mcp-status-indicator.test.tsx`

Expected: PASS (all 5 tests green)

### Step 5: Commit

```bash
git add tests/components/mcp-status-indicator.test.tsx src/components/mcp-status-indicator.tsx
git commit -m "feat: add MCP status indicator component with TDD"
```

---

## Task 2: Determine MCP Server Status from Props

**Files:**
- Modify: `src/components/mcp-card.tsx:45-77`
- Test: `tests/components/mcp-card-status.test.tsx` (new)

### Step 1: Write the failing test

Create test file at `tests/components/mcp-card-status.test.tsx`:

```typescript
import { render } from "@testing-library/react";
import { MCPCard } from "@/components/mcp-card";
import type { MCPServerInfo } from "app-types/mcp";

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
    const { container } = render(<MCPCard {...baseMcpProps} status="connected" error={null} />);
    const statusDot = container.querySelector('[data-status="connected"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows error status when error prop exists", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="connected" error="Connection failed" />
    );
    const statusDot = container.querySelector('[data-status="error"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows loading status when status prop is loading", () => {
    const { container } = render(<MCPCard {...baseMcpProps} status="loading" />);
    const statusDot = container.querySelector('[data-status="loading"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("shows authorizing status when status prop is authorizing", () => {
    const { container } = render(<MCPCard {...baseMcpProps} status="authorizing" />);
    const statusDot = container.querySelector('[data-status="authorizing"]');
    expect(statusDot).toBeInTheDocument();
  });

  it("prioritizes error status over other statuses", () => {
    const { container } = render(
      <MCPCard {...baseMcpProps} status="connected" error="Error occurred" />
    );
    const statusDot = container.querySelector('[data-status="error"]');
    expect(statusDot).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/components/mcp-card-status.test.tsx`

Expected: FAIL with "Unable to find element with data-status"

### Step 3: Add status computation logic to MCPCard

In `src/components/mcp-card.tsx`, add after line 68 (after `canChangeVisibility`):

```typescript
  const computedStatus = useMemo((): "connected" | "error" | "loading" | "authorizing" => {
    if (error) return "error";
    if (status === "loading") return "loading";
    if (status === "authorizing") return "authorizing";
    return "connected";
  }, [error, status]);
```

### Step 4: Import MCPStatusIndicator in MCPCard

At top of `src/components/mcp-card.tsx` (around line 32):

```typescript
import { MCPStatusIndicator } from "./mcp-status-indicator";
```

### Step 5: Add status indicator to CardHeader

In `src/components/mcp-card.tsx`, modify the header section (around line 156-161) to add status indicator before the server name:

```typescript
      <CardHeader
        key={`header-${status}-${needsAuthorization}`}
        className="flex items-center gap-1 mb-2"
      >
        {isLoading && <Loader className="size-4 z-20 animate-spin mr-1" />}

        <MCPStatusIndicator status={computedStatus} />

        <h4 className="font-bold text-xs sm:text-lg flex items-center gap-1">
          {name}
        </h4>
```

### Step 6: Run test to verify it passes

Run: `pnpm test tests/components/mcp-card-status.test.tsx`

Expected: PASS (all 5 tests green)

### Step 7: Commit

```bash
git add tests/components/mcp-card-status.test.tsx src/components/mcp-card.tsx
git commit -m "feat: add status computation and indicator to MCP cards"
```

---

## Task 3: Add Collapse/Expand Functionality

**Files:**
- Modify: `src/components/mcp-card.tsx:45-362`
- Test: `tests/components/mcp-card-collapse.test.tsx` (new)

### Step 1: Write the failing test

Create test file at `tests/components/mcp-card-collapse.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { MCPCard } from "@/components/mcp-card";
import type { MCPServerInfo } from "app-types/mcp";

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
    const toggleButton = container.querySelector('[data-testid="collapse-toggle"]');
    expect(toggleButton).toBeInTheDocument();
  });

  it("expands content when toggle button clicked", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector('[data-testid="collapse-toggle"]') as HTMLElement;

    fireEvent.click(toggleButton);

    // Configuration section should now be visible
    const configSection = screen.getByText("configuration");
    expect(configSection).toBeInTheDocument();
  });

  it("collapses content when toggle button clicked again", () => {
    const { container } = render(<MCPCard {...baseMcpProps} />);
    const toggleButton = container.querySelector('[data-testid="collapse-toggle"]') as HTMLElement;

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
    const toggleButton = container.querySelector('[data-testid="collapse-toggle"]') as HTMLElement;

    fireEvent.click(toggleButton);

    const chevronUp = container.querySelector('[data-icon="chevron-up"]');
    expect(chevronUp).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/components/mcp-card-collapse.test.tsx`

Expected: FAIL with "Unable to find element with data-testid='collapse-toggle'"

### Step 3: Add collapse state and imports to MCPCard

In `src/components/mcp-card.tsx`, modify imports at top (line 2-12) to add ChevronDown and ChevronUp:

```typescript
import {
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  ShieldAlertIcon,
  Loader,
  RotateCw,
  Settings,
  Settings2,
  Wrench,
} from "lucide-react";
```

### Step 4: Add isCollapsed state to MCPCard component

In `src/components/mcp-card.tsx`, after the `useState` declarations (around line 60):

```typescript
  const [isCollapsed, setIsCollapsed] = useState(true);
```

### Step 5: Add collapse toggle button to CardHeader

In `src/components/mcp-card.tsx`, add toggle button in CardHeader before the flex-1 div (around line 163):

```typescript
        <h4 className="font-bold text-xs sm:text-lg flex items-center gap-1">
          {name}
        </h4>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setIsCollapsed(!isCollapsed)}
              disabled={isDisabled}
              data-testid="collapse-toggle"
            >
              {isCollapsed ? (
                <ChevronDown className="size-4" data-icon="chevron-down" />
              ) : (
                <ChevronUp className="size-4" data-icon="chevron-up" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCollapsed ? t("expand") : t("collapse")}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />
```

### Step 6: Conditionally render CardContent based on isCollapsed

In `src/components/mcp-card.tsx`, wrap the CardContent section (line 319-359) with conditional:

```typescript
      {!isCollapsed && (
        <div className="relative hidden sm:flex w-full">
          <CardContent className="flex min-w-0 w-full flex-row text-sm max-h-[320px] overflow-hidden border-r-0">
            {/* ... existing CardContent JSX ... */}
          </CardContent>
        </div>
      )}
```

### Step 7: Run test to verify it passes

Run: `pnpm test tests/components/mcp-card-collapse.test.tsx`

Expected: PASS (all 6 tests green)

### Step 8: Commit

```bash
git add tests/components/mcp-card-collapse.test.tsx src/components/mcp-card.tsx
git commit -m "feat: add collapse/expand functionality to MCP cards"
```

---

## Task 4: Add Translation Keys for Expand/Collapse

**Files:**
- Check: `src/i18n/messages/en.json` (or equivalent translation files)
- Modify if needed: Translation file with MCP keys

### Step 1: Locate translation file

Run: `find src -name "*.json" -path "*i18n*" -o -path "*messages*" | grep -E "(en|messages)"`

### Step 2: Check if expand/collapse keys exist

Run: `grep -r "expand\|collapse" src/i18n/ src/messages/ 2>/dev/null || echo "No translation files found"`

### Step 3: Add translation keys if missing

If translations don't exist, add to the MCP section of translation file:

```json
{
  "MCP": {
    "expand": "Expand details",
    "collapse": "Collapse details"
  }
}
```

### Step 4: Verify translations load

Run dev server and check console for translation warnings:

Run: `pnpm dev`

Check: No missing translation warnings in browser console

### Step 5: Commit if translations were added

```bash
git add src/i18n/messages/en.json  # or whichever file was modified
git commit -m "feat: add expand/collapse translation keys for MCP cards"
```

---

## Task 5: Manual Testing & Verification

**Files:**
- None (manual testing)

### Step 1: Start development server

Run: `pnpm dev`

Expected: Server starts on http://localhost:3000

### Step 2: Navigate to MCP page

Navigate to: `http://localhost:3000/mcp`

Expected: MCP dashboard loads with server cards

### Step 3: Verify collapsed state

Check:
- Cards show only server name, status dot, and buttons
- Configuration and Tools sections are hidden
- ChevronDown icon visible on each card

### Step 4: Verify expand functionality

Action: Click ChevronDown button on a card

Check:
- Card expands to show Configuration and Tools
- ChevronDown changes to ChevronUp
- Content is readable and properly formatted

### Step 5: Verify collapse functionality

Action: Click ChevronUp button

Check:
- Card collapses back to compact view
- ChevronUp changes to ChevronDown
- Only name and buttons visible

### Step 6: Verify status indicators

Check status dots for different server states:
- Green dot for connected servers
- Red dot for servers with errors
- Yellow pulsing dot for loading servers
- Orange dot for servers requiring authorization

### Step 7: Verify status dot accuracy

Action: Compare status dot color to card border color (existing behavior)

Check:
- Servers with red borders show red status dots
- Connected servers show green dots

### Step 8: Test all buttons work when collapsed

Check:
- Copy config button works
- Settings button works
- Refresh button works
- Delete/Edit buttons work (if owner)

### Step 9: Document testing results

Create: `.docs/testing/mcp-card-collapse-testing.md`

Document:
- All test scenarios and results
- Screenshots of collapsed vs expanded states
- Status indicator examples
- Any issues found

---

## Task 6: Run Full Test Suite

**Files:**
- None (test execution)

### Step 1: Run all tests

Run: `pnpm test`

Expected: All tests pass (including new tests from Tasks 1, 2, 3)

### Step 2: Check test coverage

Run: `pnpm test --coverage`

Expected: Coverage maintained or improved for mcp-card.tsx

### Step 3: Fix any failing tests

If tests fail:
- Read error messages carefully
- Fix implementation issues
- Re-run tests until green

### Step 4: Commit test fixes if needed

```bash
git add .
git commit -m "fix: resolve test failures in MCP card collapse feature"
```

---

## Task 7: Final Commit & Summary

**Files:**
- None (git operations)

### Step 1: Review all changes

Run: `git log --oneline -7`

Expected: See 4-6 commits for this feature

### Step 2: Check git status

Run: `git status`

Expected: Clean working directory (no uncommitted changes)

### Step 3: Create feature summary

Summary of changes:
- Created MCPStatusIndicator component with 4 status states (connected, error, loading, authorizing)
- Added status computation logic to MCPCard using existing error/status props
- Implemented collapse/expand functionality (default collapsed)
- Added ChevronDown/ChevronUp toggle button
- Status indicators piggyback on existing error detection (red border → red dot)
- All changes covered by tests (TDD approach)

### Step 4: Verify feature requirements met

Requirements checklist:
- ✅ MCP cards collapsed by default
- ✅ Configuration and Tools sections hidden when collapsed
- ✅ Only server name and buttons visible when collapsed
- ✅ Status indicator added to left of server name
- ✅ Status indicator uses existing status detection logic
- ✅ Status colors: green (connected), red (error), yellow (loading), orange (authorizing)

---

## Notes for Engineer

**Existing Status Detection:**
The codebase already detects server errors and shows red borders on cards with issues (line 144-148 in mcp-card.tsx). We piggyback on this by:
1. Using the `error` prop (truthy = error status)
2. Using the `status` prop ("loading", "authorizing", "connected")
3. Prioritizing error > loading > authorizing > connected

**Why Start Collapsed:**
Reduces visual noise on /mcp page, especially with many servers. Users can expand individual cards to see details.

**Testing Strategy:**
TDD approach ensures:
- Status indicator correctly reflects all 4 states
- Collapse/expand works reliably
- No regressions in existing functionality
- Easy to maintain and extend

**Translation Files:**
If translation keys don't exist, add them to maintain i18n support. Common locations:
- `src/i18n/messages/en.json`
- `src/messages/en.json`
- `locales/en/common.json`

**Accessibility:**
- Status dots have `aria-label` for screen readers
- Toggle button has descriptive tooltip
- Keyboard navigation works (buttons are focusable)
