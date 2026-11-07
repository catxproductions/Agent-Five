(() => {
    "use strict";
    const AUTH_API = "https://agent-five-auth.dominik112911.workers.dev";
    const MAX_MASTER_TOKEN_BYTES = 1024;
    const MAX_IMPORT_BYTES = 1024 * 1024;
    let accessToken = null;

    async function readJson(response) {
        const text = await response.text();
        try { return text ? JSON.parse(text) : {}; }
        catch { throw new Error("The Agent Five server returned an unreadable response."); }
    }

    async function requestJson(path, body = {}, maximumBytes = 16 * 1024) {
        if (!accessToken) throw new Error("Authorize Agent Five before sending session requests.");
        const payload = JSON.stringify({ ...body, accessToken });
        if (new TextEncoder().encode(payload).byteLength > maximumBytes) throw new Error("The request is too large.");
        let response;
        try {
            response = await fetch(AUTH_API + path, {
                method: "POST",
                headers: {
                    // text/plain is CORS-safelisted, avoiding an OPTIONS preflight per simulation tick.
                    "Content-Type": "text/plain;charset=UTF-8",
                    "Accept": "application/json"
                },
                body: payload,
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer"
            });
        } catch {
            throw new Error("Could not contact the private Agent Five Cloudflare server.");
        }
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || "The Agent Five server rejected the request (HTTP " + response.status + ").");
        return data;
    }

    async function authorize(masterTokenFile) {
        if (!masterTokenFile || masterTokenFile.name !== "MASTER_TOKEN.token") {
            throw new Error('Choose the file named exactly "MASTER_TOKEN.token".');
        }
        if (!masterTokenFile.size || masterTokenFile.size > MAX_MASTER_TOKEN_BYTES) {
            throw new Error("MASTER_TOKEN.token must be between 1 byte and 1 KB.");
        }
        const form = new FormData();
        form.append("file", masterTokenFile, masterTokenFile.name);
        let response;
        try {
            response = await fetch(AUTH_API + "/v1/authorize", {
                method: "POST",
                body: form,
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer"
            });
        } catch {
            throw new Error("Could not reach Cloudflare. Check the authorization service and its website-origin setting.");
        }
        const data = await readJson(response);
        if (!response.ok || data.authorized !== true || data.token_type !== "Bearer" ||
            typeof data.access_token !== "string" || !Number.isInteger(data.expires_in) ||
            data.expires_in < 1 || data.expires_in > 15 * 60) {
            throw new Error(data.error || "The master token was not authorized.");
        }
        return { accessToken: data.access_token, expiresIn: data.expires_in };
    }

    async function verify(token = accessToken) {
        if (typeof token !== "string" || !token) return { valid: false, error: "No access token is available." };
        let response;
        try {
            response = await fetch(AUTH_API + "/v1/verify", {
                method: "POST",
                headers: { "Authorization": "Bearer " + token },
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer"
            });
        } catch {
            throw new Error("Could not contact Cloudflare to verify the access token.");
        }
        const data = await readJson(response);
        if (!response.ok || data.valid !== true) return { valid: false, error: data.error || "The access token is invalid or expired." };
        return { valid: true, expiresAt: data.expires_at || null };
    }

    function setAccessToken(token) {
        if (typeof token !== "string" || !token) throw new Error("A valid temporary access token is required.");
        accessToken = token;
    }

    function clearAccessToken() { accessToken = null; }
    function sessionStart() { return requestJson("/v1/session/start"); }
    function sessionTick() { return requestJson("/v1/session/tick"); }
    function sessionAction(action, options = {}) {
        return requestJson("/v1/session/action", { ...options, action });
    }
    function sessionExport() { return requestJson("/v1/session/export"); }
    function sessionImport(data, fileName) {
        return requestJson("/v1/session/import", { data, fileName }, MAX_IMPORT_BYTES + 16 * 1024);
    }
    function serverTrainedStart() { return requestJson("/v1/server-trained/start"); }
    function serverTrainedState() { return requestJson("/v1/server-trained/state"); }

    globalThis.AgentFiveAuth = Object.freeze({
        authorize, verify, setAccessToken, clearAccessToken,
        sessionStart, sessionTick, sessionAction, sessionExport, sessionImport,
        serverTrainedStart, serverTrainedState
    });
})();
