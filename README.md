# Readwise Reader Remote MCP Server

A remote Model Context Protocol (MCP) server that provides access to your Readwise Reader documents through a secure OAuth flow. Built on Cloudflare Workers.

## Features

- **Secure Authentication**: Users authenticate using their own Readwise API tokens
- **Document Listing**: List and filter documents from your Reader library
- **OAuth Flow**: Standard OAuth 2.0 flow for secure token management
- **Cloudflare Workers**: Serverless deployment with global edge distribution

## Available Tools

### `listDocuments`
List documents from your Readwise Reader library with optional filters:
- `location`: Filter by document location (new, later, shortlist, archive, feed)
- `category`: Filter by category (article, email, rss, highlight, note, pdf, epub, tweet, video)
- `tag`: Filter by tag key
- `updatedAfter`: Fetch only documents updated after this date (ISO 8601 format)
- `limit`: Maximum number of documents to return (default: 20, max: 100)

### `getDocument`
Get detailed information about a specific document by ID.

## Usage

### MCP Clients

**Claude Desktop**:
```json
{
  "mcpServers": {
    "readwise-reader": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://remote-mcp-reader-server.julien-marinica.workers.dev/sse"
      ]
    }
  }
}
```

### Authentication Flow

1. When connecting, users will be prompted to approve the MCP client
2. After approval, users enter their Readwise API token
3. The token is securely encrypted and stored
4. Users can find their API token at: https://readwise.io/access_token

## Security

- API tokens are encrypted before storage
- OAuth tokens are issued separately from Readwise tokens
- All communication uses HTTPS
- Tokens are scoped to individual users

## Architecture

Based on the [Cloudflare blog post about remote MCP servers](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/), this implementation uses:

- **workers-oauth-provider**: OAuth 2.0 provider implementation
- **McpAgent**: Cloudflare's MCP SDK for handling remote transport
- **Durable Objects**: Stateful sessions with isolated storage
- **Workers KV**: Encrypted token storage
