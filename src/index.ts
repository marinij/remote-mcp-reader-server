import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { MyMCP } from "./reader-mcp";
import { ReaderHandler } from "./reader-handler";

// Export the Durable Object class for Wrangler
export { MyMCP };

export default new OAuthProvider({
	apiHandler: MyMCP.mount("/sse") as any,
	apiRoute: "/sse",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: ReaderHandler as any,
	tokenEndpoint: "/token",
});
