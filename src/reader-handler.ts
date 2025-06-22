import { env } from "cloudflare:workers";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import type { Props } from "./utils";
import {
	clientIdAlreadyApproved,
	parseRedirectApproval,
	renderApprovalDialog,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

// Custom HTML page for API token entry
function renderTokenEntryPage(oauthReqInfo: AuthRequest): Response {
	const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Connect Your Readwise Reader Account</title>
			<style>
				:root {
					--primary-color: #0070f3;
					--background-color: #f9fafb;
					--text-color: #333;
					--border-color: #e5e7eb;
					--card-shadow: 0 8px 36px 8px rgba(0, 0, 0, 0.1);
				}
				
				body {
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
					line-height: 1.6;
					color: var(--text-color);
					background-color: var(--background-color);
					margin: 0;
					padding: 0;
					display: flex;
					justify-content: center;
					align-items: center;
					min-height: 100vh;
				}
				
				.container {
					max-width: 500px;
					width: 90%;
					margin: 2rem;
				}
				
				.card {
					background: white;
					border-radius: 12px;
					box-shadow: var(--card-shadow);
					padding: 2.5rem;
				}
				
				.logo {
					text-align: center;
					margin-bottom: 2rem;
				}
				
				.logo svg {
					width: 60px;
					height: 60px;
				}
				
				h1 {
					text-align: center;
					margin: 0 0 0.5rem 0;
					font-size: 1.75rem;
					font-weight: 600;
				}
				
				.subtitle {
					text-align: center;
					color: #666;
					margin-bottom: 2rem;
					font-size: 1.1rem;
				}
				
				.info-box {
					background: #f3f4f6;
					border: 1px solid var(--border-color);
					border-radius: 8px;
					padding: 1rem;
					margin-bottom: 1.5rem;
					font-size: 0.95rem;
				}
				
				.info-box a {
					color: var(--primary-color);
					text-decoration: none;
				}
				
				.info-box a:hover {
					text-decoration: underline;
				}
				
				label {
					display: block;
					margin-bottom: 0.5rem;
					font-weight: 500;
				}
				
				input[type="password"] {
					width: 100%;
					padding: 0.75rem;
					border: 2px solid var(--border-color);
					border-radius: 8px;
					font-size: 1rem;
					transition: border-color 0.2s;
					box-sizing: border-box;
				}
				
				input[type="password"]:focus {
					outline: none;
					border-color: var(--primary-color);
				}
				
				.button {
					width: 100%;
					padding: 0.875rem;
					margin-top: 1.5rem;
					background: var(--primary-color);
					color: white;
					border: none;
					border-radius: 8px;
					font-size: 1rem;
					font-weight: 600;
					cursor: pointer;
					transition: background-color 0.2s;
				}
				
				.button:hover {
					background: #0051cc;
				}
				
				.button:disabled {
					background: #ccc;
					cursor: not-allowed;
				}
				
				.error {
					color: #dc2626;
					margin-top: 0.5rem;
					font-size: 0.875rem;
					display: none;
				}
				
				.footer {
					text-align: center;
					margin-top: 2rem;
					font-size: 0.875rem;
					color: #666;
				}
			</style>
		</head>
		<body>
			<div class="container">
				<div class="card">
					<div class="logo">
						<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="50" cy="50" r="45" fill="#0070f3"/>
							<path d="M30 40 L50 60 L70 40" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</div>
					
					<h1>Connect Your Readwise Reader</h1>
					<p class="subtitle">Enter your API token to access your documents</p>
					
					<div class="info-box">
						📚 You can find your API token at 
						<a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer">
							readwise.io/access_token
						</a>
					</div>
					
					<form id="tokenForm">
						<input type="hidden" name="state" value="${btoa(JSON.stringify(oauthReqInfo))}">
						
						<label for="apiToken">Readwise API Token</label>
						<input 
							type="password" 
							id="apiToken" 
							name="apiToken" 
							placeholder="readwise_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
							required
							pattern="readwise_[A-Za-z0-9]{38}"
							title="API token should start with 'readwise_' followed by 38 characters"
						>
						<div class="error" id="error">Please enter a valid Readwise API token</div>
						
						<button type="submit" class="button" id="submitBtn">
							Connect Account
						</button>
					</form>
					
					<div class="footer">
						Your token will be securely encrypted and stored
					</div>
				</div>
			</div>
			
			<script>
				document.getElementById('tokenForm').addEventListener('submit', async (e) => {
					e.preventDefault();
					
					const apiToken = document.getElementById('apiToken').value;
					const submitBtn = document.getElementById('submitBtn');
					const errorDiv = document.getElementById('error');
					
					// Basic validation
					if (!apiToken.match(/^readwise_[A-Za-z0-9]{38}$/)) {
						errorDiv.style.display = 'block';
						return;
					}
					
					errorDiv.style.display = 'none';
					submitBtn.disabled = true;
					submitBtn.textContent = 'Verifying...';
					
					// Submit form
					const form = e.target;
					form.method = 'POST';
					form.submit();
				});
			</script>
		</body>
		</html>
	`;

	return new Response(html, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	// Check if client already approved
	if (
		await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, env.COOKIE_ENCRYPTION_KEY)
	) {
		// If already approved, render the token entry page
		return renderTokenEntryPage(oauthReqInfo);
	}

	// Show approval dialog first
	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		server: {
			description: "Access your Readwise Reader documents through MCP",
			logo: "https://readwise.io/favicon.ico",
			name: "Readwise Reader MCP Server",
		},
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	// Clone the request to read the body multiple times if needed
	const request = c.req.raw.clone();
	
	// Check if this is a token submission by looking for apiToken in form data
	let formData: FormData | null = null;
	let apiToken: string | null = null;
	
	try {
		formData = await c.req.formData();
		apiToken = formData.get("apiToken") as string;
	} catch (e) {
		// If form parsing fails, it might be the approval form
	}

	// If we have an API token, this is the token submission
	if (apiToken && formData) {
		const state = formData.get("state") as string;
		const oauthReqInfo = JSON.parse(atob(state)) as AuthRequest;

		// Verify the token is valid by making a test API call
		const verifyResponse = await fetch("https://readwise.io/api/v2/auth/", {
			headers: {
				"Authorization": `Token ${apiToken}`,
			},
		});

		if (verifyResponse.status !== 204) {
			return c.text("Invalid API token", 400);
		}

		// Get user info from the API
		const userResponse = await fetch("https://readwise.io/api/v3/list/?pageCursor=", {
			headers: {
				"Authorization": `Token ${apiToken}`,
			},
		});

		if (!userResponse.ok) {
			return c.text("Failed to fetch user data", 500);
		}

		// Complete the authorization
		const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
			metadata: {
				label: "Readwise Reader User",
			},
			props: {
				apiToken,
			} as Props,
			request: oauthReqInfo,
			scope: oauthReqInfo.scope,
			userId: `reader_user_${Date.now()}`, // Generate a unique user ID
		});

		return Response.redirect(redirectTo);
	}

	// Otherwise, this is the approval form submission
	// Use the cloned request to avoid body already used error
	const { state, headers } = await parseRedirectApproval(request, env.COOKIE_ENCRYPTION_KEY);
	if (!state.oauthReqInfo) {
		return c.text("Invalid request", 400);
	}

	// After approval, show the token entry page
	return new Response(renderTokenEntryPage(state.oauthReqInfo).body, {
		headers: {
			...headers,
			"Content-Type": "text/html; charset=utf-8",
		},
	});
});

export { app as ReaderHandler }; 