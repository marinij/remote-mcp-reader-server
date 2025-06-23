import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import type { Props } from "./utils";

interface ReaderCreateResponse {
	id: string;
	url: string;
}

interface ReaderUpdateResponse {
	id: string;
	url: string;
}

interface ReaderTag {
	key: string;
	name: string;
}

interface ReaderTagsResponse {
	count: number;
	nextPageCursor: string | null;
	results: ReaderTag[];
}

export interface ReaderDocument {
	id: string;
	url: string;
	source_url: string;
	title: string;
	author: string;
	source: string;
	category: string;
	location: string;
	tags: Record<string, unknown>;
	site_name: string;
	word_count: number;
	created_at: string;
	updated_at: string;
	notes: string;
	published_date: string | null;
	summary: string;
	image_url: string;
	parent_id: string | null;
	reading_progress: number;
	first_opened_at: string | null;
	last_opened_at: string | null;
	saved_at: string;
	last_moved_at: string;
}

export interface ReaderListResponse {
	count: number;
	nextPageCursor: string | null;
	results: ReaderDocument[];
}

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
					// Set withHtmlContent to true by default to include HTML content in responses
					params.append("withHtmlContent", "true");
					
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

						const data = await response.json() as ReaderListResponse;
						
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

		// Create document tool
		this.server.tool(
			"createDocument",
			"Save a new document to your Readwise Reader library",
			{
				url: z.string().describe("The document's unique URL"),
				html: z.string().optional().describe("The document's content in HTML format"),
				should_clean_html: z.boolean().optional().describe("Whether to automatically clean the HTML and parse metadata"),
				title: z.string().optional().describe("The document's title"),
				author: z.string().optional().describe("The document's author"),
				summary: z.string().optional().describe("Summary of the document"),
				published_date: z.string().optional().describe("When the document was published (ISO 8601 format)"),
				image_url: z.string().optional().describe("An image URL to use as cover image"),
				location: z.enum(["new", "later", "archive", "feed"]).optional().describe("Initial location of the document"),
				category: z.enum(["article", "email", "rss", "highlight", "note", "pdf", "epub", "tweet", "video"]).optional().describe("Document category"),
				saved_using: z.string().optional().describe("Source of the document"),
				tags: z.array(z.string()).optional().describe("List of tags for the document"),
				notes: z.string().optional().describe("Top-level note for the document"),
			},
			async ({ url, html, should_clean_html, title, author, summary, published_date, image_url, location, category, saved_using, tags, notes }) => {
				try {
					const payload: any = { url };
					if (html) payload.html = html;
					if (should_clean_html !== undefined) payload.should_clean_html = should_clean_html;
					if (title) payload.title = title;
					if (author) payload.author = author;
					if (summary) payload.summary = summary;
					if (published_date) payload.published_date = published_date;
					if (image_url) payload.image_url = image_url;
					if (location) payload.location = location;
					if (category) payload.category = category;
					if (saved_using) payload.saved_using = saved_using;
					if (tags) payload.tags = tags;
					if (notes) payload.notes = notes;

					const response = await fetch(
						`https://readwise.io/api/v3/save/`,
						{
							method: "POST",
							headers: {
								"Authorization": `Token ${this.props.apiToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						}
					);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					const data = await response.json() as ReaderCreateResponse;
					
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									message: "Document created successfully",
									document: data,
								}, null, 2),
							},
						],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [
							{
								type: "text",
								text: `Error creating document: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Update document tool
		this.server.tool(
			"updateDocument",
			"Update an existing document in your Readwise Reader library",
			{
				documentId: z.string().describe("The document ID to update"),
				title: z.string().optional().describe("The document's title"),
				author: z.string().optional().describe("The document's author"),
				summary: z.string().optional().describe("Summary of the document"),
				published_date: z.string().optional().describe("When the document was published (ISO 8601 format)"),
				image_url: z.string().optional().describe("An image URL to use as cover image"),
				location: z.enum(["new", "later", "archive", "feed"]).optional().describe("Current location of the document"),
				category: z.enum(["article", "email", "rss", "highlight", "note", "pdf", "epub", "tweet", "video"]).optional().describe("Document category"),
			},
			async ({ documentId, title, author, summary, published_date, image_url, location, category }) => {
				try {
					const payload: any = {};
					if (title) payload.title = title;
					if (author) payload.author = author;
					if (summary) payload.summary = summary;
					if (published_date) payload.published_date = published_date;
					if (image_url) payload.image_url = image_url;
					if (location) payload.location = location;
					if (category) payload.category = category;

					const response = await fetch(
						`https://readwise.io/api/v3/update/${documentId}/`,
						{
							method: "PATCH",
							headers: {
								"Authorization": `Token ${this.props.apiToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						}
					);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					const data = await response.json() as ReaderUpdateResponse;
					
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									message: "Document updated successfully",
									document: data,
								}, null, 2),
							},
						],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [
							{
								type: "text",
								text: `Error updating document: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Get document details tool
		this.server.tool(
			"getDocument",
			"Get detailed information about a specific document",
			{
				documentId: z.string().describe("The document ID to fetch details for"),
			},
			async ({ documentId }) => {
				try {
					const response = await fetch(
						`https://readwise.io/api/v3/list/?id=${documentId}&withHtmlContent=true`,
						{
							headers: {
								"Authorization": `Token ${this.props.apiToken}`,
							},
						}
					);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					const data = await response.json() as ReaderListResponse;
					
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

		// Delete document tool
		this.server.tool(
			"deleteDocument",
			"Delete a document from your Readwise Reader library",
			{
				documentId: z.string().describe("The document ID to delete"),
			},
			async ({ documentId }) => {
				try {
					const response = await fetch(
						`https://readwise.io/api/v3/delete/${documentId}/`,
						{
							method: "DELETE",
							headers: {
								"Authorization": `Token ${this.props.apiToken}`,
							},
						}
					);

					if (!response.ok) {
						throw new Error(`API request failed: ${response.status} ${response.statusText}`);
					}

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									success: true,
									message: "Document deleted successfully",
									documentId: documentId,
								}, null, 2),
							},
						],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [
							{
								type: "text",
								text: `Error deleting document: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Tag list tool
		this.server.tool(
			"tagList",
			"List all available tags from your Readwise Reader library",
			{
				limit: z
					.number()
					.min(1)
					.max(100)
					.default(50)
					.describe("Maximum number of tags to return (default: 50, max: 100)"),
			},
			async ({ limit }) => {
				try {
					// Fetch tags with pagination
					let allTags: ReaderTag[] = [];
					let nextPageCursor: string | null = null;
					let totalFetched = 0;

					do {
						const params = new URLSearchParams();
						if (nextPageCursor) {
							params.set("pageCursor", nextPageCursor);
						}

						const response = await fetch(
							`https://readwise.io/api/v3/tags/?${params.toString()}`,
							{
								headers: {
									"Authorization": `Token ${this.props.apiToken}`,
								},
							}
						);

						if (!response.ok) {
							throw new Error(`API request failed: ${response.status} ${response.statusText}`);
						}

						const data = await response.json() as ReaderTagsResponse;
						
						// Add tags up to the limit
						const remainingSpace = limit - totalFetched;
						const tagsToAdd = data.results.slice(0, remainingSpace);
						allTags = allTags.concat(tagsToAdd);
						totalFetched += tagsToAdd.length;

						// Check if we need more tags
						if (totalFetched >= limit || !data.nextPageCursor) {
							break;
						}

						nextPageCursor = data.nextPageCursor;
					} while (true);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										tags: allTags,
										count: allTags.length,
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
								text: `Error fetching tags: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);
	}
} 