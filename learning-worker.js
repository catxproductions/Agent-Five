"use strict";

self.addEventListener("message", event => {
    const message = event.data || {};
    if (!message.requestId || !Array.isArray(message.jobs)) return;

    const results = [];
    for (const job of message.jobs) {
        try {
            const trained = self.AgentLearning.trainPPO(
                job.policy,
                job.critic,
                job.rollout,
                job.options
            );
            results.push({
                id: job.id,
                generation: job.generation,
                token: job.token,
                policy: trained.policy,
                critic: trained.critic,
                stats: trained.stats
            });
        } catch (error) {
            results.push({
                id: job.id,
                generation: job.generation,
                token: job.token,
                error: error && error.message ? error.message : "Unknown worker training error"
            });
        }
    }

    self.postMessage({ requestId: message.requestId, results });
});
