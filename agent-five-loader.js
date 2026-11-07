(() => {
    "use strict";
    const root = globalThis;
    const doc = root.document;
    const chooseButton = doc.getElementById("agent-five-token-choose");
    const tokenInput = doc.getElementById("agent-five-master-token");
    const status = doc.getElementById("agent-five-file-status");
    const gate = doc.getElementById("agent-five-file-gate");
    const sandbox = doc.getElementById("sandbox-container");
    const analytics = doc.getElementById("analytics-dashboard");
    const sessionStatus = doc.getElementById("agent-five-session-status");

    if (!chooseButton || !tokenInput || !status || !gate || !sandbox || !analytics) {
        console.error("Agent Five authentication gate could not find its required page elements.");
        return;
    }

    let accessToken = null;
    let accessExpiresAt = 0;
    let expiryTimer = null;
    let authenticating = false;
    let runtimeLoaded = false;
    const loadedPageScripts = new Set();

    function setStatus(message, state) {
        status.textContent = message;
        status.dataset.state = state || "info";
    }

    function setSessionStatus(message) {
        if (!sessionStatus) return;
        sessionStatus.textContent = message;
        sessionStatus.hidden = !message;
    }

    function revealSimulation() {
        sandbox.hidden = false;
        analytics.hidden = false;
        gate.hidden = true;
        doc.body.classList.add("agent-five-ready");
    }

    function stopSimulation() {
        if (root.AgentFiveBrowser && root.AgentFiveBrowser.simulation) {
            root.AgentFiveBrowser.simulation.stop();
        }
    }

    function lockExpiredSession() {
        if (expiryTimer !== null) {
            root.clearTimeout(expiryTimer);
            expiryTimer = null;
        }
        stopSimulation();
        accessToken = null;
        accessExpiresAt = 0;
        root.AgentFiveAuth.clearAccessToken();
        sandbox.hidden = true;
        analytics.hidden = true;
        gate.hidden = false;
        chooseButton.disabled = false;
        tokenInput.value = "";
        setStatus("Your 15-minute authorization session expired. Select MASTER_TOKEN.token to run Agent Five again.", "error");
        setSessionStatus("Agent Five is paused. The master token and private runtime are not stored in this browser.");
    }

    function scheduleSessionExpiry() {
        if (expiryTimer !== null) root.clearTimeout(expiryTimer);
        expiryTimer = root.setTimeout(lockExpiredSession, Math.max(0, accessExpiresAt - Date.now()));
    }

    async function verifyCurrentAccess() {
        if (!accessToken || Date.now() >= accessExpiresAt) {
            lockExpiredSession();
            throw new Error("Your authorization session expired. Select MASTER_TOKEN.token again.");
        }
        const result = await root.AgentFiveAuth.verify(accessToken);
        if (!result.valid) {
            lockExpiredSession();
            throw new Error(result.error || "Cloudflare rejected the access token.");
        }
        return result;
    }

    async function loadPageScript(path) {
        if (loadedPageScripts.has(path)) return;
        await new Promise((resolve, reject) => {
            const script = doc.createElement("script");
            script.src = path;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => {
                script.remove();
                reject(new Error("Could not load " + path + " from the Agent Five website."));
            };
            doc.head.appendChild(script);
        });
        loadedPageScripts.add(path);
    }

    async function startRuntime() {
        await verifyCurrentAccess();
        root.AgentFiveAuth.setAccessToken(accessToken);
        setStatus("Preparing the secure Agent Five interface…", "loading");
        if (!runtimeLoaded) {
            await loadPageScript("network-visualizer.js?v=20261107-fit-canvas");
            await loadPageScript("agent-five-browser.js?v=20261107-self-server-modes");
            if (!root.AgentFiveBrowser || !root.AgentFiveBrowser.simulation) {
                throw new Error("The Agent Five browser interface did not initialize.");
            }
            runtimeLoaded = true;
        }
        setStatus("Starting your private Cloudflare simulation…", "loading");
        await root.AgentFiveBrowser.simulation.start();
        revealSimulation();
        setSessionStatus("Authorized by Cloudflare. Agent Five core, learning, model parameters and private memory stay on the server. This session expires in 15 minutes.");
        setStatus("MASTER_TOKEN.token accepted. Agent Five is running on Cloudflare.", "success");
    }

    async function authorizeWithFile(file) {
        if (authenticating) return;
        authenticating = true;
        chooseButton.disabled = true;
        try {
            if (!file) throw new Error("Select MASTER_TOKEN.token to continue.");
            setStatus("Validating MASTER_TOKEN.token with Cloudflare…", "loading");
            const authorization = await root.AgentFiveAuth.authorize(file);
            const verification = await root.AgentFiveAuth.verify(authorization.accessToken);
            if (!verification.valid) throw new Error(verification.error || "Cloudflare did not validate the new access token.");
            accessToken = authorization.accessToken;
            root.AgentFiveAuth.setAccessToken(accessToken);
            const serverExpiry = verification.expiresAt ? Date.parse(verification.expiresAt) : NaN;
            accessExpiresAt = Number.isFinite(serverExpiry) ? serverExpiry : Date.now() + authorization.expiresIn * 1000;
            scheduleSessionExpiry();
            await startRuntime();
        } catch (error) {
            stopSimulation();
            accessToken = null;
            accessExpiresAt = 0;
            root.AgentFiveAuth.clearAccessToken();
            if (expiryTimer !== null) root.clearTimeout(expiryTimer);
            expiryTimer = null;
            chooseButton.disabled = false;
            setStatus(error && error.message ? error.message : "Agent Five authorization failed.", "error");
        } finally {
            tokenInput.value = "";
            authenticating = false;
        }
    }

    chooseButton.addEventListener("click", () => tokenInput.click());
    tokenInput.addEventListener("change", () => {
        const file = tokenInput.files && tokenInput.files[0];
        if (file) authorizeWithFile(file);
    });

    root.addEventListener("pagehide", () => {
        if (expiryTimer !== null) root.clearTimeout(expiryTimer);
        stopSimulation();
        root.AgentFiveAuth.clearAccessToken();
    }, { once: true });

    setStatus("Select MASTER_TOKEN.token to authorize and run Agent Five.", "info");
})();
