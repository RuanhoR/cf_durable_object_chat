export const supportMethod = ["get", "post", "delete", "put", "option"] as const
export type HandlerFn = (data: Map<string, string>, request: Request, url: URL, env: Env) => Response | Promise<Response>;
export type HandlerGroup = {
	url: string;
	handler: HandlerFn;
	method: typeof supportMethod[number]
}
export type HandlerRecord = HandlerGroup[]
export type JSTypes = "string" | "number" | "boolean" | "undefined" | "object" | "bigint" | "symbol"

export type MiddlewareContext = {
	request: Request;
	urlParse: URL;
	paramMap: Map<string, string>;
}

export type Middleware = (context: MiddlewareContext, next: () => Promise<Response>) => Response | Promise<Response>;

export type MiddlewareWithPaths = {
	paths: string[];
	middleware: Middleware;
}
