import {instance} from "./index.js";

interface ApiUrls {
	api: string;
	gateway: string;
	cdn: string;
	wellknown: string;
}

function normalizeGatewayBaseUrl(gateway: string, instanceOriginHint?: string): string {
	let instanceHost: string | undefined;
	if (instanceOriginHint && URL.canParse(instanceOriginHint)) {
		try {
			instanceHost = new URL(instanceOriginHint).host;
		} catch {
			// ignore
		}
	}

	try {
		const u = new URL(gateway);
		if ((u.pathname === "" || u.pathname === "/") && (!instanceHost || u.host === instanceHost)) {
			u.pathname = "/gateway";
		}
		return u.toString().replace(/\/$/, "");
	} catch {
		if (instanceOriginHint && (instanceOriginHint.startsWith("http://") || instanceOriginHint.startsWith("https://"))) {
			const base = instanceOriginHint.replace(/\/$/, "");
			const wsOrigin = base.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
			return (wsOrigin + "/gateway").replace(/\/$/, "");
		}
		return gateway;
	}
}

export async function getApiUrls(
	url: string,
	instances: instance[],
	check = true,
): Promise<ApiUrls | null> {
	if (!url.endsWith("/")) {
		url += "/";
	}

	if (check) {
		let valid = false;
		console.log(`[getApiUrls] Checking URL: ${url}, Instances:`, instances);
		for (const instance of instances) {
			const urlstr = instance.url || instance.urls?.api;
			if (!urlstr) {
				console.log(`[getApiUrls] Skipping instance without URL:`, instance);
				continue;
			}
			try {
				const instanceHost = new URL(urlstr).host;
				const inputHost = new URL(url).host;
				console.log(`[getApiUrls] Comparing hosts: "${instanceHost}" === "${inputHost}"`);
				if (instanceHost === inputHost) {
					valid = true;
					console.log(`[getApiUrls] Host match found!`);
					break;
				}
			} catch (e) {
				console.error(`[getApiUrls] Error parsing URL:`, e, urlstr, url);
			}
		}
		if (!valid) {
			console.error(`[getApiUrls] No valid instance found for URL: ${url}`);
			throw new Error("Invalid instance");
		}
	}

	const hostName = new URL(url).hostname;
	try {
		return await getApiUrlsV2(url);
	} catch (e) {
		console.warn(
			`[WARN] Failed to get V2 API URLs for ${hostName}, trying V1...`,
			(e as Error).message,
		);
		try {
			return await getApiUrlsV1(url);
		} catch (e) {
			console.error(`[ERROR] Failed to get V1 API URLs for ${hostName}:`, (e as Error).message);
			throw e;
		}
	}
}

//region Well-Known V1 Interfaces

interface WellKnownV1 {
	api: string;
}

export async function getApiUrlsV1(url: string): Promise<ApiUrls | null> {
	const info: WellKnownV1 = await fetch(`${url}.well-known/spacebar`).then((res) => res.json());
	const api = info.api;
	const apiUrl = new URL(api);
	const policies: any = await fetch(
		`${api}${apiUrl.pathname.includes("api") ? "" : "api"}/policies/instance/domains`,
	).then((res) => res.json());
	return {
		api: policies.apiEndpoint,
		gateway: normalizeGatewayBaseUrl(policies.gateway, apiUrl.origin),
		cdn: policies.cdn,
		wellknown: url,
	};
}
//endregion

//region Well-Known V2 Interfaces
interface WellKnownV2BasicEndpoint {
	baseUrl: string;
}

interface WellKnownV2ApiVersions {
	default: string;
	active: string[];
}

interface WellKnownV2GatewayOptions {
	encoding: ("json" | "etf")[];
	compression: ("zlib-stream" | "zstd-stream" | null)[];
}

interface WellKnownV2 {
	admin?: WellKnownV2BasicEndpoint;
	api: WellKnownV2BasicEndpoint & {apiVersions: WellKnownV2ApiVersions};
	cdn: WellKnownV2BasicEndpoint;
	gateway: WellKnownV2BasicEndpoint & WellKnownV2GatewayOptions;
}

export async function getApiUrlsV2(url: string): Promise<ApiUrls | null> {
	const wellKnownUrl = `${url}.well-known/spacebar/client`;
	console.log(`[getApiUrlsV2] Fetching well-known from: ${wellKnownUrl}`);
	try {
		const response = await fetch(wellKnownUrl);
		console.log(`[getApiUrlsV2] Response status: ${response.status}, ok: ${response.ok}`);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		const info: WellKnownV2 = await response.json();
		console.log(`[getApiUrlsV2] Well-known data received:`, info);
		return {
			api: info.api.baseUrl + "/api/v" + info.api.apiVersions.default,
			gateway: normalizeGatewayBaseUrl(info.gateway.baseUrl, info.api.baseUrl ?? url),
			cdn: info.cdn.baseUrl,
			wellknown: url,
		};
	} catch (e) {
		console.error(`[getApiUrlsV2] Error fetching well-known:`, e);
		throw e;
	}
}
//endregion