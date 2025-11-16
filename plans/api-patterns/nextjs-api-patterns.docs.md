# Next.js API Route Patterns & Better Auth Integration Research

## Summary
This codebase follows consistent patterns for Next.js 15 API routes with Better Auth integration. All routes use the App Router pattern with route handlers in `app/api/*/route.ts` files. Authentication is handled via `getSession()` from Better Auth, returning a session object with user info and role. Permission checks use a dedicated permissions module with role-based access control (RBAC). Input validation uses Zod schemas, and errors follow standardized NextResponse.json patterns.

## Key Components

### Authentication & Session Management
- `/compose/better-chatbot/src/lib/auth/server.ts` - Re-exports getSession() from auth-instance
- `/compose/better-chatbot/src/lib/auth/auth-instance.ts` - Better Auth setup with session management
- `/compose/better-chatbot/src/lib/auth/permissions.ts` - Role-based permission helpers

### API Route Examples
- `/compose/better-chatbot/src/app/api/mcp/route.ts` - POST endpoint with permission checks
- `/compose/better-chatbot/src/app/api/mcp/[id]/route.ts` - DELETE with ownership verification
- `/compose/better-chatbot/src/app/api/agent/route.ts` - GET/POST with Zod validation
- `/compose/better-chatbot/src/app/api/agent/[id]/route.ts` - Full CRUD with access control
- `/compose/better-chatbot/src/app/api/workflow/route.ts` - Conditional permission checks (create vs edit)
- `/compose/better-chatbot/src/app/api/mcp/server-customizations/[server]/route.ts` - Dynamic params example

### Type Definitions & Schemas
- `/compose/better-chatbot/src/types/agent.ts` - Zod schemas for agent CRUD operations
- `/compose/better-chatbot/src/types/mcp.ts` - MCP-related Zod schemas and types
- `/compose/better-chatbot/src/types/user.ts` - User session types and UserSessionUser
- `/compose/better-chatbot/src/app/api/user/validations.ts` - Complex Zod validation with superRefine

## Implementation Patterns

### 1. Route Handler Structure

**Standard Pattern:**
```typescript
import { getSession } from "auth/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... logic
  return Response.json(data);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const data = SomeSchema.parse(body);
    // ... logic
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid input", details: error.message },
        { status: 400 }
      );
    }
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
```

### 2. Dynamic Route Parameters (Next.js 15)

**IMPORTANT:** Next.js 15 changed params to be async!

```typescript
// New pattern in Next.js 15:
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;  // Must await params!
  const { id } = params;
  // ... rest of logic
}

// Alternative destructuring pattern:
export async function GET(
  _: Request,
  { params }: { params: Promise<{ server: string }> }
) {
  const { server } = await params;  // await params first
  // ... rest of logic
}
```

### 3. Better Auth Integration

**Session Type:**
```typescript
// Session object structure from getSession()
type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;  // "admin" | "editor" | "user"
    image?: string;
    // ... other user fields
  };
  session: {
    id: string;
    expiresAt: Date;
    // ... session metadata
  };
} | null;
```

**Authentication Check:**
```typescript
const session = await getSession();

// Basic check - user must be logged in
if (!session?.user?.id) {
  return new Response("Unauthorized", { status: 401 });
}

// Alternative - using optional user check
if (!session) {
  return new Response("Unauthorized", { status: 401 });
}
```

### 4. Access Control Patterns

**Role-Based Permissions:**
```typescript
import { canCreateAgent, canEditAgent, canDeleteAgent } from "lib/auth/permissions";

// Permission check for create
const hasPermission = await canCreateAgent();
if (!hasPermission) {
  return Response.json(
    { error: "You don't have permission to create agents" },
    { status: 403 }
  );
}
```

**Resource-Based Permissions (Ownership):**
```typescript
import { canManageMCPServer } from "lib/auth/permissions";

// Check ownership and visibility
const mcpServer = await pgMcpRepository.selectById(params.id);
if (!mcpServer) {
  return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
}

const canManage = await canManageMCPServer(
  mcpServer.userId,
  mcpServer.visibility
);
if (!canManage) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

**Repository-Level Access Control:**
```typescript
// Many repositories have checkAccess methods
const hasAccess = await agentRepository.checkAccess(
  id,
  session.user.id,
  true  // destructive = true for delete operations
);
if (!hasAccess) {
  return new Response("Unauthorized", { status: 401 });
}
```

### 5. Input Validation with Zod

**Basic Schema Validation:**
```typescript
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(8000).optional(),
  visibility: z.enum(["public", "private"]).optional().default("private"),
}).strip();

// In route handler:
try {
  const body = await request.json();
  const data = CreateSchema.parse(body);
  // ... use validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: "Invalid input", details: error.message },
      { status: 400 }
    );
  }
  // ... other error handling
}
```

**Complex Validation with superRefine:**
```typescript
const UpdatePasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: passwordSchema,
  currentPassword: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      message: "Passwords do not match",
    });
  }
});
```

**Query Parameter Validation:**
```typescript
const QuerySchema = z.object({
  type: z.enum(["all", "mine", "shared"]).default("all"),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const url = new URL(request.url);
const queryParams = Object.fromEntries(url.searchParams);
const { type, limit } = QuerySchema.parse(queryParams);
```

### 6. Error Response Patterns

**Authentication Errors (401):**
```typescript
// Pattern 1: Plain text response
return new Response("Unauthorized", { status: 401 });

// Pattern 2: JSON response
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Authorization/Permission Errors (403):**
```typescript
return Response.json(
  { error: "You don't have permission to create agents" },
  { status: 403 }
);
```

**Not Found (404):**
```typescript
return NextResponse.json(
  { error: "MCP server not found" },
  { status: 404 }
);
```

**Validation Errors (400):**
```typescript
if (error instanceof z.ZodError) {
  return Response.json(
    { error: "Invalid input", details: error.message },
    { status: 400 }
  );
}
```

**Server Errors (500):**
```typescript
// Pattern 1: Generic message
return new Response("Internal Server Error", { status: 500 });

// Pattern 2: With error details
return NextResponse.json(
  { message: error.message || "Failed to save MCP client" },
  { status: 500 }
);

// Pattern 3: Conditional status based on error
return NextResponse.json(
  {
    error: error instanceof Error
      ? error.message
      : "Failed to delete MCP server",
  },
  {
    status: error instanceof Error && error.message.includes("permission")
      ? 403
      : 500,
  }
);
```

**Success Responses:**
```typescript
// Pattern 1: Return created/updated resource
return Response.json(agent);

// Pattern 2: Success flag with ID
return NextResponse.json({ success: true, id: result.client.getInfo().id });

// Pattern 3: Simple success flag
return NextResponse.json({ success: true });
```

## Considerations

### Security & Authorization
- **Always check session first** - All protected routes must call `getSession()` before any operations
- **Two-level auth checks** - Many routes check both role-based permissions (can user perform action type?) AND resource-based access (can user access this specific resource?)
- **Owner vs Admin access** - `canManageMCPServer()` allows owners to manage private servers, admins to manage all
- **Visibility constraints** - Non-owners of public resources may have read access but can't change visibility
- **Destructive flag** - Repository `checkAccess()` methods have optional `destructive` param for stricter checks on delete operations

### Next.js 15 Breaking Changes
- **Async params** - Route params are now `Promise<{...}>` and MUST be awaited before use
- **Cannot destructure directly** - Must await params before destructuring: `const { id } = await params;`
- **Affects all dynamic routes** - Any route with `[param]` segments must use this pattern

### Error Handling Conventions
- **Mixed response types** - Code uses both `Response` and `NextResponse` interchangeably
- **Inconsistent error formats** - Some use `{ error: "..." }`, others use `{ message: "..." }`
- **Logger usage varies** - Some routes use `logger.error()` (from better-auth), others use `console.error()`
- **Try-catch not universal** - Some routes have comprehensive try-catch blocks, others rely on Next.js error boundaries

### Validation Patterns
- **Schemas co-located with types** - Zod schemas live in `/src/types/` directory alongside TypeScript types
- **`.strip()` modifier** - Common to use `.strip()` on schemas to remove unknown properties
- **Coercion for query params** - Use `z.coerce.number()` for numeric query parameters (they come as strings)
- **Optional with defaults** - Pattern: `.optional().default(value)` for optional fields with fallbacks

### Permission Helpers
- **Resource-specific helpers** - Separate functions for each resource type: `canCreateAgent()`, `canCreateMCP()`, etc.
- **Operation-specific checks** - Different helpers for create/edit/delete: `canEditWorkflow()`, `canDeleteWorkflow()`
- **Return boolean** - All permission helpers return `Promise<boolean>`
- **Internal error handling** - Permission helpers catch errors and return `false` (don't throw)
- **Session retrieval inside helpers** - Helpers call `getSession()` internally, no need to pass session

### Conditional Logic
- **Create vs Update** - Some routes (like workflow/route.ts) check different permissions based on whether `id` exists in request body
- **Self-management allowed** - Users can always manage their own resources without admin permission
- **Public resource editing** - Non-owners may edit public resources but cannot change visibility

## Available Permission Helpers

From `/compose/better-chatbot/src/lib/auth/permissions.ts`:

### Admin Permissions
- `hasAdminPermission()` - Check if user is admin
- `requireAdminPermission(action)` - Throw if not admin

### User Management
- `canListUsers()` - Admin only
- `canManageUsers()` - Admin only
- `canManageUser(targetUserId)` - Self or admin
- `requireUserManagePermissionFor(targetUserId, action)` - Throw if can't manage

### Agent Permissions
- `canCreateAgent()` - Editors and admins
- `canEditAgent()` - Editors and admins
- `canDeleteAgent()` - Editors and admins

### Workflow Permissions
- `canCreateWorkflow()` - Editors and admins
- `canEditWorkflow()` - Editors and admins
- `canDeleteWorkflow()` - Editors and admins

### MCP Permissions
- `canCreateMCP()` - Editors and admins
- `canEditMCP()` - Editors and admins
- `canDeleteMCP()` - Editors and admins
- `canChangeVisibilityMCP()` - Can share MCP servers
- `canManageMCPServer(mcpOwnerId, visibility)` - Owner of private server or admin
- `canShareMCPServer()` - Admin only

### Editor Permissions
- `hasEditorPermission()` - Check if editor or admin
- `requireEditorPermission(action)` - Throw if not editor/admin

### Utility
- `getCurrentUser()` - Get current session user or null

## Next Steps

### For Implementing New API Routes

1. **Start with template** - Copy structure from similar route (e.g., `/api/agent/route.ts` for CRUD operations)

2. **Define Zod schema first** - Create validation schema in `/src/types/[resource].ts`

3. **Add permission helper if needed** - For new resource types, add helpers to `/lib/auth/permissions.ts`

4. **Follow auth pattern:**
   ```typescript
   const session = await getSession();
   if (!session?.user.id) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

5. **Add permission check:**
   ```typescript
   const hasPermission = await canCreateResource();
   if (!hasPermission) {
     return Response.json(
       { error: "You don't have permission to create resources" },
       { status: 403 }
     );
   }
   ```

6. **Validate input with Zod:**
   ```typescript
   try {
     const body = await request.json();
     const data = ResourceSchema.parse(body);
     // ... use data
   } catch (error) {
     if (error instanceof z.ZodError) {
       return Response.json(
         { error: "Invalid input", details: error.message },
         { status: 400 }
       );
     }
   }
   ```

7. **Handle dynamic params (Next.js 15):**
   ```typescript
   export async function DELETE(
     _: Request,
     { params }: { params: Promise<{ id: string }> }
   ) {
     const { id } = await params;  // Don't forget to await!
     // ...
   }
   ```

8. **Check resource access for specific items:**
   ```typescript
   const hasAccess = await repository.checkAccess(id, session.user.id);
   if (!hasAccess) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

### For Adding New Permissions

1. Add to role definitions in `/lib/auth/roles.ts`
2. Create helper function in `/lib/auth/permissions.ts` following existing pattern
3. Use `hasPermission(session.user.role, "operation", "resource")` pattern
4. Include error handling (return false on error, don't throw)

### Testing Checklist

- [ ] Unauthenticated request returns 401
- [ ] User without permission returns 403
- [ ] Invalid input returns 400 with Zod errors
- [ ] Resource not found returns 404
- [ ] Owner can access their private resource
- [ ] Non-owner cannot access private resource
- [ ] Admin can access all resources
- [ ] Public resources are readable by all authenticated users
- [ ] Dynamic params are properly awaited
