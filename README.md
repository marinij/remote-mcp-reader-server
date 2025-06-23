# Readwise Reader Remote MCP Server

A remote Model Context Protocol (MCP) server that provides access to your Readwise Reader documents through a secure OAuth flow. Built on Cloudflare Workers.

## Features

- **Secure Authentication**: Users authenticate using their own Readwise API tokens
- **Document Management**: Create, list, update, and manage documents in your Reader library
- **Tag Management**: List and manage tags from your Reader library
- **OAuth Flow**: Standard OAuth 2.0 flow for secure token management
- **Cloudflare Workers**: Serverless deployment with global edge distribution
- **Full Content Access**: HTML content included by default for comprehensive document processing

## Available Tools

### `listDocuments`
List documents from your Readwise Reader library with optional filters:
- `location`: Filter by document location (new, later, shortlist, archive, feed)
- `category`: Filter by category (article, email, rss, highlight, note, pdf, epub, tweet, video)
- `tag`: Filter by tag key
- `updatedAfter`: Fetch only documents updated after this date (ISO 8601 format)
- `limit`: Maximum number of documents to return (default: 20, max: 100)

Returns formatted document data including HTML content, metadata, reading progress, and tags.

### `getDocument`
Get detailed information about a specific document by ID:
- `documentId` (required): The document ID to fetch details for

Returns the complete document data including HTML content, metadata, reading progress, tags, and all other available fields.

### `createDocument`
Save a new document to your Readwise Reader library:
- `url` (required): The document's unique URL
- `html`: The document's content in HTML format
- `should_clean_html`: Whether to automatically clean the HTML and parse metadata
- `title`: The document's title
- `author`: The document's author
- `summary`: Summary of the document
- `published_date`: When the document was published (ISO 8601 format)
- `image_url`: An image URL to use as cover image
- `location`: Initial location of the document (new, later, archive, feed)
- `category`: Document category (article, email, rss, highlight, note, pdf, epub, tweet, video)
- `saved_using`: Source of the document
- `tags`: List of tags for the document
- `notes`: Top-level note for the document

### `updateDocument`
Update an existing document in your Readwise Reader library:
- `documentId` (required): The document ID to update
- `title`: The document's title
- `author`: The document's author
- `summary`: Summary of the document
- `published_date`: When the document was published (ISO 8601 format)
- `image_url`: An image URL to use as cover image
- `location`: Current location of the document (new, later, archive, feed)
- `category`: Document category (article, email, rss, highlight, note, pdf, epub, tweet, video)

### `deleteDocument`
Delete a document from your Readwise Reader library:
- `documentId` (required): The document ID to delete

Permanently removes the document from your library. This action cannot be undone.

### `tagList`
List all available tags from your Readwise Reader library:
- `limit`: Maximum number of tags to return (default: 50, max: 100)

Returns all tags with their keys and names, supporting pagination for large tag collections.

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
