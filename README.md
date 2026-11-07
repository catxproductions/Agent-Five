# Agent Five

Agent Five is a browser-based autonomous learning agent built from scratch without external API keys.

## Current neural architecture

- Actor policy network with 16 normalized perception inputs.
- 26 fully connected hidden layers: [15, 16, 15, 14, 15, 13, 14, 12, 13, 11, 12, 10, 11, 12, 10, 9, 10, 8, 9, 7, 8, 6, 7, 5, 6, 4].
- Three continuous actor outputs: thrust X, thrust Y, and braking.
- Separate value critic with the same 16-input and 26-hidden-layer topology and one value output.
- PPO-style on-policy reinforcement learning with generalized advantage estimation.
- Optional background PPO training through a Web Worker.
- Short-horizon look-ahead route planning that biases, but does not replace, neural policy decisions.
- Prioritized state memory and short episodic sequence memory.
- Evolutionary training with an unchanged elite, mutated actor/critic descendants, isolated environments, and adaptive mutation.
- Fixed 60 Hz simulation stepping with bounded catch-up to reduce frame-rate-dependent behavior.

## Perception inputs

1. Current speed X
2. Current speed Y
3. Goal location X
4. Goal location Y
5. Obstacle location X
6. Obstacle location Y
7. Obstacle clearance
8. Current location X
9. Current location Y
10. Energy remaining
11. Left wall clearance
12. Right wall clearance
13. Top wall clearance
14. Bottom wall clearance
15. Goal distance
16. Energy usage rate

Energy usage rate is a smoothed, normalized measure of recent per-step energy consumption. It gives the policy a signal about how costly its recent actions have been.

## Compatibility

Agent Five v8 migrates valid v5, v6, and v7 actor/critic models into the expanded architecture. Existing learned connections are carried forward through a neutral bridge, while the new perception input starts with a neutral weight. V7 memories and episodic sequences are remapped to the new goal-distance and energy-usage input order; older 9-input and 10-input memories are padded with neutral values.

## Evolution rules

- Population size: 15–300.
- First agent to collect five goals wins.
- One unchanged elite is preserved in the next generation.
- Other agents are mutated descendants of the winner.
- Every descendant receives a fresh independent environment.
- If the two-minute generation limit is reached, candidates are ranked by goals collected, measured goal progress, and remaining energy.

See [neural-planner.txt](neural-planner.txt) for the complete architecture notes.


## Modular architecture

Agent Five's reusable runtime is separated from the browser demo:

- `agent-five.js` — reusable Agent Five core runtime, downloaded from Cloudflare after the user supplies `MASTER_TOKEN.token`.
- `agent-learning.js` — neural-network learning primitives, action sampling, PPO training, and planning, downloaded from Cloudflare after authorization.
- `learning-worker.js` — optional background PPO worker.
- `agent-five-browser.js` — browser demo adapter: DOM controls, canvas rendering, analytics, file import/export, local persistence, worker creation, and frame scheduling.
- `network-visualizer.js` — standalone neural-network visualization.
- `index.html` and `styles.css` — demo page structure and presentation.

### Using the Agent Five runtime in another system

Load `agent-learning.js` and `agent-five.js`, then create a runtime with injected host services:

```js
const agent = AgentFiveCore.create({
  world: { width: 500, height: 500 },
  learning: AgentLearning,
  storage: myStorageAdapter,
  createWorker: url => new Worker(url),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(handle),
  ui: {
    drawWorld(snapshot) {
      // Render the snapshot using your own engine.
    },
    updateDiagnostics(data) {
      // Optional telemetry adapter.
    }
  }
});

agent.start();
```

The renderer is optional. The core exposes `start`, `stop`, `getSnapshot`,
`setPopulationSize`, `setEvolutionMode`, `setAgentRadius`, `reward`,
`correct`, `clearMemory`, `reset`, `exportData`, and `importData`.
The browser demo wiring lives in `agent-five-browser.js`, not in the runtime.


## Cloudflare authorization and runtime delivery

The only file users select is `MASTER_TOKEN.token`. Cloudflare validates it
and issues a short-lived access token. The browser then downloads
`agent-five.js` and `agent-learning.js` from authenticated Cloudflare routes.
Neither runtime file is requested from GitHub Pages, and the master token is
never stored in the browser.

The bearer token remains in memory for 15 minutes. The Agent Five core runtime
is checked against its approved SHA-256 release fingerprint before execution.
See [AGENT_FIVE_INTEGRATION.md](AGENT_FIVE_INTEGRATION.md) for the Worker routes
and the Cloudflare module-wrapper setup.

The GitHub Pages files provide the browser presentation and host adapter.
The PPO learning worker is assembled with the downloaded Agent Learning source
so it does not need to fetch an unauthenticated copy of that module.
