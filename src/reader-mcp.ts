import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import type { Props, ReaderListResponse, ReaderDocument } from "./utils";

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Readwise Reader MCP",
		version: "1.0.0",
	});

	async init() {
		// List documents tool
		this.server.tool(
			"listDocuments",
			"List documents from your Readwise Reader library",
			{
				location: z
					.enum(["new", "later", "shortlist", "archive", "feed"])
					.optional()
					.describe("Filter by document location"),
				category: z
					.enum(["article", "email", "rss", "highlight", "note", "pdf", "epub", "tweet", "video"])
					.optional()
					.describe("Filter by document category"),
				tag: z.string().optional().describe("Filter by tag key"),
				updatedAfter: z
					.string()
					.optional()
					.describe("Fetch only documents updated after this date (ISO 8601 format)"),
				limit: z
					.number()
					.min(1)
					.max(100)
					.default(20)
					.describe("Maximum number of documents to return (default: 20, max: 100)"),
			},
			async ({ location, category, tag, updatedAfter, limit }) => {
				try {
					// Build query parameters
					const params = new URLSearchParams();
					if (location) params.append("location", location);
					if (category) params.append("category", category);
					if (tag) params.append("tag", tag);
					if (updatedAfter) params.append("updatedAfter", updatedAfter);
					
					// Fetch documents with pagination
					let allDocuments: ReaderDocument[] = [];
					let nextPageCursor: string | null = null;
					let totalFetched = 0;

					do {
						if (nextPageCursor) {
							params.set("pageCursor", nextPageCursor);
						}

						const response = await fetch(
							`https://readwise.io/api/v3/list/?${params.toString()}`,
							{
								headers: {
									"Authorization": `Token ${this.props.apiToken}`,
								},
							}
						);

						if (!response.ok) {
							throw new Error(`API request failed: ${response.status} ${response.statusText}`);
						}

						const data: ReaderListResponse = await response.json();
						
						// Add documents up to the limit
						const remainingSpace = limit - totalFetched;
						const documentsToAdd = data.results.slice(0, remainingSpace);
						allDocuments = allDocuments.concat(documentsToAdd);
						totalFetched += documentsToAdd.length;

						// Check if we need more documents
						if (totalFetched >= limit || !data.nextPageCursor) {
							break;
						}

						nextPageCursor = data.nextPageCursor;
					} while (true);

					// Format the response
					const formattedDocuments = allDocuments.map((doc) => ({
						id: doc.id,
						title: doc.title,
						author: doc.author || "Unknown",
						url: doc.url,
						source_url: doc.source_url,
						category: doc.category,
						location: doc.location,
						word_count: doc.word_count,
						reading_progress: Math.round(doc.reading_progress * 100),
						summary: doc.summary ? doc.summary.substring(0, 100) + "..." : "No summary",
						saved_at: doc.saved_at,
						tags: Object.keys(doc.tags || {}),
					}));

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										documents: formattedDocuments,
										count: formattedDocuments.length,
										filters: {
											location,
											category,
											tag,
											updatedAfter,
										},
									},
									null,
									2
								),
							},
						],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [
							{
								type: "text",
								text: `Error fetching documents: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Get document details tool (for future implementation)
		this.server.tool(
			"getDocument",
			"Get detailed information about a specific document",
			{
				documentId: z.string().describe("The document ID to fetch details for"),
			},
			async ({ documentId }) => {
				try {
					const response = await fetch(
						`https://readwise.io/api/v3/list/?id=${documentId}`,
						{
							headers: {
								"Authorization": `Token ${this.props.apiToken}`,
							},
						}
					);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					const data: ReaderListResponse = await response.json();
					
					if (data.results.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: "Document not found",
								},
							],
							isError: true,
						};
					}

					const doc = data.results[0];
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(doc, null, 2),
							},
						],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [
							{
								type: "text",
								text: `Error fetching document: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);
	}
} 