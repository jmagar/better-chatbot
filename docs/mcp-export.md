# MCP Configuration Export

## Overview

The MCP export system allows you to export Model Context Protocol (MCP) server configurations from the PostgreSQL database to a JSON file. This is useful for:

- Backing up your MCP server configurations
- Migrating configurations between environments
- Integrating with external tools (e.g., Claude Desktop, Claude Code CLI)
- Version controlling MCP server setups (templates only, not credentials)

## Quick Start

```bash
# Export MCP configurations from database to .mcp-config.json
pnpm mcp:export

# Export with custom database connection
pnpm mcp:export --db-url="postgres://user:pass@host:5432/dbname"

# Export using different database host (overrides host in POSTGRES_URL)
pnpm mcp:export --db-host="better-chatbot_db"
```

## Web UI Export

### Individual Server Export

1. Navigate to **Settings → MCP Servers** (`/mcp`).
2. For any owned server card, click the Copy icon (📋) in the header actions.
3. A toast message confirms the configuration is copied as JSON.
4. Paste the clipboard contents into `.mcp-config.json` or another MCP client; the format matches the CLI export:
   ```json
   {
     "server-name": {
       "command": "npx",
       "args": ["package-name", "--option", "value"],
       "env": {
         "API_KEY": "your-api-key"
       }
     }
   }
   ```
5. Only the owner of the server sees the copy button; shared servers omit it for security reasons.

### Export All Servers

1. Still on `/mcp`, click the dropdown arrow next to the **Add Server** button (now a split button).
2. Select **Export All Servers** from the menu.
3. The browser downloads `mcp-config-YYYY-MM-DD.json` with the same structure as `pnpm mcp:export`.
4. Use the exported file to restore servers in Claude Desktop/CLI or to keep a backup.
5. The export honors the same permissions as the UI: only owned servers and public/shared servers are included.

**Security reminder:** exported files contain credentials. Treat them like secrets—never commit them or share them over public channels.

## File Locations

| File | Purpose | Tracked in Git? |
|------|---------|----------------|
| `.mcp-config.json` | Exported MCP configurations with credentials | ❌ No (gitignored) |
| `scripts/export-mcp-config.ts` | Export script source code | ✅ Yes |
| `docs/mcp-export.md` | This documentation | ✅ Yes |

## Output Format

The exported `.mcp-config.json` file follows the standard MCP server configuration format:

```json
{
  "server-name": {
    "command": "npx",
    "args": ["package-name", "--option", "value"],
    "env": {
      "API_KEY": "your-api-key",
      "CONFIG_VAR": "value"
    }
  },
  "http-server": {
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

### Server Types

#### 1. Command-based Servers (stdio transport)

Run local MCP servers using Node.js, Python, or other executables:

```json
{
  "python-server": {
    "command": "uvx",
    "args": ["mcp-package-name"],
    "env": {
      "OPTIONAL_API_KEY": "value"
    }
  },
  "node-server": {
    "command": "npx",
    "args": ["-y", "package-name"]
  }
}
```

#### 2. HTTP-based Servers (SSE transport)

Connect to remote MCP servers over HTTP:

```json
{
  "remote-server": {
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

## Command-Line Options

### Database Connection

The export script needs to connect to PostgreSQL to read MCP configurations. It resolves the connection in this order:

1. **`--db-url` flag** (highest priority)
   ```bash
   pnpm mcp:export --db-url="postgres://user:pass@host:5432/db"
   ```

2. **`MCP_EXPORT_DB_URL` environment variable**
   ```bash
   export MCP_EXPORT_DB_URL="postgres://user:pass@host:5432/db"
   pnpm mcp:export
   ```

3. **`POSTGRES_URL` from `.env` file** (default)
   ```bash
   # Uses POSTGRES_URL from .env automatically
   pnpm mcp:export
   ```

### Host Override

Override just the database host while keeping other connection details from `POSTGRES_URL`:

```bash
# Override host in POSTGRES_URL
pnpm mcp:export --db-host="better-chatbot_db"

# Or via environment variable
export MCP_EXPORT_DB_HOST="better-chatbot_db"
pnpm mcp:export
```

**Use case:** When running the export script from outside Docker but the database is in a container, you might need to change the host from `better-chatbot_db` (Docker network) to `localhost` or a Tailscale IP.

## Environment Setup

### Password URL Encoding

PostgreSQL connection URLs require special characters in passwords to be URL-encoded:

| Character | Encoded |
|-----------|---------|
| `+` | `%2B` |
| `=` | `%3D` |
| `@` | `%40` |
| `/` | `%2F` |
| `?` | `%3F` |
| `#` | `%23` |
| `&` | `%26` |

**Example:**

```bash
# Original password: myPass+word=123
# Correct URL: postgres://user:myPass%2Bword%3D123@host:5432/db
# Wrong URL:   postgres://user:myPass+word=123@host:5432/db  ❌
```

**Encoding in JavaScript:**

```javascript
const password = "QEPGYlLL+Rx6UDhJhUsz4SD2Zdt4W0uCplYd20Jx+Bk=";
const encoded = encodeURIComponent(password);
console.log(encoded); // QEPGYlLL%2BRx6UDhJhUsz4SD2Zdt4W0uCplYd20Jx%2BBk%3D
```

**Encoding in Bash:**

```bash
node -e "console.log(encodeURIComponent('your-password'))"
```

### Docker Network vs Host Access

When running in different network contexts:

```bash
# Inside Docker Compose network (default in .env)
POSTGRES_URL=postgres://user:pass@better-chatbot_db:5432/db

# From host machine (Tailscale IP)
pnpm mcp:export --db-host="100.120.242.29"

# From host machine (localhost, if port is exposed)
pnpm mcp:export --db-host="localhost"
```

## Security Considerations

### ⚠️ Sensitive Data Warning

The exported `.mcp-config.json` file contains **sensitive credentials**:

- API keys and tokens
- Database passwords
- Authentication headers
- Service credentials

### Best Practices

1. **Never commit `.mcp-config.json` to version control**
   - Already gitignored in [.gitignore:62](/compose/better-chatbot/.gitignore#L62)
   - Verify: `git check-ignore -v .mcp-config.json`

2. **Use environment variables for secrets when possible**
   ```json
   {
     "server": {
       "command": "npx",
       "args": ["package"],
       "env": {
         "API_KEY": "${API_KEY}"  // Reference env var instead of hardcoding
       }
     }
   }
   ```

3. **Restrict file permissions**
   ```bash
   chmod 600 .mcp-config.json  # Owner read/write only
   ```

4. **Rotate credentials if accidentally exposed**
   - Immediately revoke and regenerate any leaked API keys
   - Update credentials in database and re-export

5. **Use separate credentials per environment**
   - Development: Limited-scope test credentials
   - Production: Full-access production credentials
   - Never mix environments

## Troubleshooting

### Authentication Failed Error

```
password authentication failed for user "username"
```

**Causes:**
1. Password contains special characters not URL-encoded
2. Wrong database host (Docker network vs localhost)
3. Incorrect credentials

**Solutions:**

```bash
# 1. URL-encode your password
node -e "console.log(encodeURIComponent('your-password'))"

# 2. Update .env with encoded password
POSTGRES_URL=postgres://user:encoded_password@host:5432/db

# 3. Or override host for local development
pnpm mcp:export --db-host="localhost"
```

### Connection Refused Error

```
Could not connect to Postgres (host:5432). Ensure your database is running.
```

**Causes:**
1. Database container is not running
2. Wrong host/port
3. Network connectivity issues

**Solutions:**

```bash
# 1. Verify database is running
docker ps | grep better-chatbot_db

# 2. Start database if stopped
docker compose up -d better-chatbot_db

# 3. Test connection manually
docker exec better-chatbot_db pg_isready -U username

# 4. Check network from export script perspective
ping better-chatbot_db  # If in Docker network
ping localhost          # If on host machine
```

### Module Not Found Error

```
Cannot find module 'load-env'
```

**Cause:** Dependencies not installed

**Solution:**

```bash
# Install dependencies
pnpm install

# Verify installation
pnpm list load-env
```

### Empty Export (0 servers)

```
Exported 0 MCP servers to .mcp-config.json
```

**Causes:**
1. No MCP servers configured in the application
2. Connected to wrong database
3. Database tables not migrated

**Solutions:**

```bash
# 1. Check database connection
echo $POSTGRES_URL

# 2. Verify you're connected to the right database
pnpm mcp:export --db-url="postgres://user:pass@host:5432/correct_db"

# 3. Run database migrations
pnpm db:migrate

# 4. Check MCP servers table
docker exec better-chatbot_db psql -U username -d dbname -c "SELECT COUNT(*) FROM mcp_servers;"
```

## Integration Examples

### Claude Desktop

Export and copy to Claude Desktop configuration:

```bash
# Export from database
pnpm mcp:export

# Copy to Claude Desktop config location (macOS)
cp .mcp-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Copy to Claude Desktop config location (Linux)
cp .mcp-config.json ~/.config/Claude/claude_desktop_config.json

# Copy to Claude Desktop config location (Windows)
copy .mcp-config.json %APPDATA%\Claude\claude_desktop_config.json
```

### Claude Code CLI

```bash
# Export to custom location
pnpm mcp:export
cp .mcp-config.json ~/.config/claude-code/mcp-config.json
```

### Backup and Restore

```bash
# Backup with timestamp
pnpm mcp:export
cp .mcp-config.json .mcp-config.backup.$(date +%Y%m%d-%H%M%S).json

# Restore from backup (manual process)
# 1. Import backup into database via application UI
# 2. Or restore database from SQL dump
```

## Script Implementation

The export script ([scripts/export-mcp-config.ts](/compose/better-chatbot/scripts/export-mcp-config.ts)) performs these steps:

1. **Load environment variables** from `.env` file
2. **Parse command-line arguments** (--db-url, --db-host)
3. **Prepare database connection** (override host if needed)
4. **Connect to PostgreSQL** using Drizzle ORM
5. **Query MCP servers** from `mcp_servers` table
6. **Transform to JSON format** (server name → config mapping)
7. **Write to `.mcp-config.json`** in project root

### Database Schema

The script reads from the `mcp_servers` table:

```sql
CREATE TABLE mcp_servers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Each row's `config` field contains the MCP server configuration (command/args/env or url/headers).

## Related Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Better Chatbot MCP Integration](../README.md#mcp-integration)
- [Database Configuration](../README.md#database-setup)
- [Environment Variables](.env.example)

## Support

If you encounter issues not covered in this documentation:

1. Check application logs: `docker compose logs better-chatbot`
2. Check database logs: `docker compose logs better-chatbot_db`
3. Verify environment: `pnpm exec tsx -e "import './src/lib/load-env.ts'; console.log('POSTGRES_URL:', process.env.POSTGRES_URL?.substring(0, 30) + '...');"`
4. Open an issue with error details and relevant logs
