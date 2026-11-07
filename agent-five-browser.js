((root) => {
    "use strict";

    const get = id => root.document.getElementById(id);
    const canvas = get("simCanvas");
    if (!canvas) throw new Error("Agent Five browser adapter could not find #simCanvas.");
    const context = canvas.getContext("2d");
    const evolutionCanvas = get("evolutionCanvas");
    const evolutionContext = evolutionCanvas ? evolutionCanvas.getContext("2d") : null;
    const evolutionArenaView = get("evolution-arena-view");
    const legend = root.document.querySelector(".legend");
    const analyticsHistory = [];
    let analyticsLastSampleAt = 0;
    let analyticsLastRenderAt = 0;

    function setText(id, value) {
        const node = get(id);
        if (node) node.textContent = String(value);
    }

    function drawWorld(state) {
        const width = state.dimensions.width;
        const height = state.dimensions.height;
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#111113";
        context.fillRect(0, 0, width, height);

        context.beginPath();
        context.arc(state.obstacle.x, state.obstacle.y,
            state.config.obstacleRadius + state.config.avoidanceRange, 0, Math.PI * 2);
        context.fillStyle = "rgb(100 116 139 / 8%)";
        context.fill();
        context.fillStyle = "#475569";
        context.beginPath();
        context.arc(state.obstacle.x, state.obstacle.y, state.config.obstacleRadius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "#22c99a";
        context.beginPath();
        context.arc(state.goal.x, state.goal.y, state.config.goalRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fb5574";
        context.beginPath();
        context.arc(state.agent.x, state.agent.y, state.agent.radius, 0, Math.PI * 2);
        context.fill();
    }

    function drawEvolution(state) {
        if (!evolutionCanvas || !evolutionContext) return;
        const population = state.evolutionPopulation;
        const count = population.length;
        const tileSize = 132;
        const gap = 7;
        const padding = 10;
        const columns = count <= 1 ? 1 : Math.min(6, Math.max(2, Math.ceil(Math.sqrt(count * 1.1))));
        const rows = Math.max(1, Math.ceil(count / columns));
        const width = padding * 2 + columns * tileSize + (columns - 1) * gap;
        const height = padding * 2 + rows * tileSize + (rows - 1) * gap;

        if (evolutionCanvas.width !== width || evolutionCanvas.height !== height) {
            evolutionCanvas.width = width;
            evolutionCanvas.height = height;
        }
        const draw = evolutionContext;
        draw.clearRect(0, 0, width, height);
        draw.fillStyle = "#090d13";
        draw.fillRect(0, 0, width, height);
        setText("evolution-arena-count", count + " independent arenas");

        const sourceSize = Math.min(state.dimensions.width, state.dimensions.height);
        const arenaSize = 100;
        const scale = arenaSize / sourceSize;
        for (let index = 0; index < count; index++) {
            const candidate = population[index];
            const environment = candidate.environment;
            if (!environment) continue;

            const column = index % columns;
            const row = Math.floor(index / columns);
            const tileX = padding + column * (tileSize + gap);
            const tileY = padding + row * (tileSize + gap);
            const arenaX = tileX + 12;
            const arenaY = tileY + 20;
            const hue = (candidate.id * 31) % 360;
            const agentColor = candidate.isSuccessor ? "#facc15" :
                candidate.energyDepleted ? "#64748b" : "hsl(" + hue + " 78% 64%)";

            draw.fillStyle = "#141c27";
            draw.fillRect(tileX, tileY, tileSize, tileSize);
            draw.strokeStyle = candidate.isSuccessor ? "#d6ae36" : "#34445a";
            draw.lineWidth = candidate.isSuccessor ? 2 : 1;
            draw.strokeRect(tileX + 0.5, tileY + 0.5, tileSize - 1, tileSize - 1);

            draw.font = "10px ui-monospace, monospace";
            draw.textBaseline = "middle";
            draw.textAlign = "left";
            draw.fillStyle = "#dce7f4";
            draw.fillText("AGENT " + String(candidate.id).padStart(3, "0"), tileX + 7, tileY + 10);
            draw.textAlign = "right";
            draw.fillStyle = candidate.isSuccessor ? "#facc15" : "#a8b8ca";
            draw.fillText(candidate.goalsCollected + "/" + state.config.goalsToWin, tileX + tileSize - 7, tileY + 10);

            draw.fillStyle = "#0b1119";
            draw.fillRect(arenaX, arenaY, arenaSize, arenaSize);
            draw.strokeStyle = "#2a3a4d";
            draw.lineWidth = 1;
            draw.strokeRect(arenaX + 0.5, arenaY + 0.5, arenaSize - 1, arenaSize - 1);

            const block = environment.obstacle;
            const target = environment.goal;
            const mapX = value => arenaX + (value / sourceSize) * arenaSize;
            const mapY = value => arenaY + (value / sourceSize) * arenaSize;

            draw.beginPath();
            draw.arc(mapX(block.x), mapY(block.y),
                (state.config.obstacleRadius + state.config.avoidanceRange) * scale, 0, Math.PI * 2);
            draw.fillStyle = "rgba(100, 116, 139, 0.08)";
            draw.fill();

            draw.beginPath();
            draw.arc(mapX(block.x), mapY(block.y), state.config.obstacleRadius * scale, 0, Math.PI * 2);
            draw.fillStyle = "#53657c";
            draw.fill();

            draw.beginPath();
            draw.arc(mapX(target.x), mapY(target.y), Math.max(2.4, state.config.goalRadius * scale), 0, Math.PI * 2);
            draw.fillStyle = "hsl(" + hue + " 78% 62%)";
            draw.fill();

            draw.beginPath();
            draw.arc(mapX(candidate.x), mapY(candidate.y), Math.max(2.7, candidate.radius * scale), 0, Math.PI * 2);
            draw.fillStyle = agentColor;
            draw.fill();
            draw.strokeStyle = "#f8fafc";
            draw.lineWidth = 0.8;
            draw.stroke();

            const energyWidth = arenaSize * Math.max(0, Math.min(1, candidate.energy / state.config.maxEnergy));
            draw.fillStyle = "#263447";
            draw.fillRect(arenaX, tileY + 124, arenaSize, 3);
            draw.fillStyle = candidate.energy <= 20 ? "#fb7185" : "#22c99a";
            draw.fillRect(arenaX, tileY + 124, energyWidth, 3);
        }
    }

    function setEvolutionViewEnabled(enabled) {
        canvas.hidden = enabled;
        if (legend) legend.hidden = enabled;
        if (evolutionArenaView) evolutionArenaView.hidden = !enabled;
    }

    function updateEvolutionStatus(state) {
        if (!state.evolutionaryMode) {
            setText("evolution-generation", "—");
            setText("evolution-population", "0 / " + state.evolutionPopulationSize);
            setText("evolution-successor", "Off");
        } else {
            setText("evolution-generation", state.evolutionGeneration);
            setText("evolution-population", state.evolutionPopulation.length + " / " + state.evolutionPopulationSize);
            const successor = state.evolutionSuccessor;
            const winner = state.evolutionLastSuccessorId;
            setText("evolution-successor", successor ?
                "Agent #" + successor.id + " — generation winner" :
                winner !== null ? "Elite Agent #" + winner : "Searching…");
        }
        setText("evolution-mutation-rate", Number(state.evolutionMutationRate).toFixed(3));
        setText("evolution-diversity", Number(state.evolutionDiversity).toFixed(3));
    }

    function setEvolutionModeState(enabled) {
        const controls = [
            "reward-button", "punish-button", "reset-button", "load-button",
            "brain-file", "clear-memory-button", "evolution-population-size"
        ];
        controls.forEach(id => {
            const element = get(id);
            if (element) element.disabled = enabled;
        });
        const toggle = get("evolution-mode");
        if (toggle) toggle.checked = enabled;
    }

    function setEvolutionStopPending(pending) {
        const toggle = get("evolution-mode");
        if (toggle) toggle.disabled = pending;
    }

    function updateMemoryOverview(data) {
        const summary = data.memorySummary || {};
        const counts = summary.outcomeCounts || {};
        const memoryCount = Number(summary.count) || 0;
        const episodeCount = Number(summary.episodeCount) || 0;
        setText("memory-count", memoryCount + " / " + data.memoryCapacity);
        setText("memory-episodes", episodeCount + " / " + data.episodeCapacity);
        setText("memory-recalled", Number(data.recallCount) || 0);
        setText("memory-breakdown",
            "Goals " + (counts["goal-reward"] || 0) +
            " · Corrections " + (counts["behavior-correction"] || 0) +
            " · Energy " + (counts["energy-depletion"] || 0) +
            " · Walls " + (counts["wall-contact"] || 0));
        const latestNode = get("memory-latest");
        if (latestNode) {
            const outcome = summary.latestOutcome;
            const timestamp = Number(summary.latestCreatedAt) || 0;
            latestNode.textContent = outcome ?
                String(outcome).replaceAll("-", " ") + " · " +
                    (timestamp ? new Date(timestamp).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}) : "recent") :
                "No experiences stored yet";
        }
    }

    function drawAnalyticsLineChart(canvasId, series, maximum, suffix) {
        const chart = get(canvasId);
        if (!chart) return;
        const ctx = chart.getContext("2d");
        const width = chart.width;
        const height = chart.height;
        const padding = {left:42,right:14,top:14,bottom:28};
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const maxValue = Math.max(1, maximum || 1);

        ctx.clearRect(0,0,width,height);
        ctx.fillStyle = "#0d131b";
        ctx.fillRect(0,0,width,height);
        ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let line=0;line<=4;line++) {
            const y=padding.top+(plotHeight*line/4);
            const value=maxValue*(1-line/4);
            ctx.strokeStyle="rgba(148, 163, 184, 0.16)";
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(padding.left,y);
            ctx.lineTo(width-padding.right,y);
            ctx.stroke();
            ctx.fillStyle="#8291a5";
            ctx.fillText(Math.round(value)+(suffix||""),padding.left-7,y);
        }
        series.forEach(item=>{
            ctx.strokeStyle=item.color;
            ctx.lineWidth=2.6;
            ctx.lineJoin="round";
            ctx.lineCap="round";
            ctx.beginPath();
            analyticsHistory.forEach((point,index)=>{
                const x=analyticsHistory.length<=1?padding.left+plotWidth:
                    padding.left+(index/(analyticsHistory.length-1))*plotWidth;
                const value=Math.max(0,Number(point[item.key])||0);
                const y=padding.top+plotHeight-(value/maxValue)*plotHeight;
                if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
            });
            ctx.stroke();
            if(analyticsHistory.length){
                const value=Math.max(0,Number(analyticsHistory[analyticsHistory.length-1][item.key])||0);
                const y=padding.top+plotHeight-(value/maxValue)*plotHeight;
                ctx.fillStyle=item.color;ctx.beginPath();ctx.arc(padding.left+plotWidth,y,3.5,0,Math.PI*2);ctx.fill();
            }
        });
        ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillStyle="#718198";
        ctx.fillText("older",padding.left,height-8);
        ctx.textAlign="right";ctx.fillText("latest",width-padding.right,height-8);
    }

    function drawAnalyticsMemoryChart(counts) {
        const chart=get("analytics-memory-chart");
        if(!chart)return;
        const ctx=chart.getContext("2d"),width=chart.width,height=chart.height;
        const rows=[
            {label:"Goal rewards",value:counts["goal-reward"],color:"#29c99a"},
            {label:"Corrections",value:counts["behavior-correction"],color:"#fb7185"},
            {label:"Energy depletion",value:counts["energy-depletion"],color:"#f59e0b"},
            {label:"Wall contact",value:counts["wall-contact"],color:"#60a5fa"}
        ];
        const maxValue=Math.max(1,...rows.map(row=>row.value));
        const labelWidth=142,rightPadding=40,barWidth=width-labelWidth-rightPadding,rowHeight=48;
        ctx.clearRect(0,0,width,height);ctx.fillStyle="#0d131b";ctx.fillRect(0,0,width,height);
        ctx.font="12px ui-monospace, monospace";ctx.textBaseline="middle";
        rows.forEach((row,index)=>{
            const y=28+index*rowHeight;
            ctx.textAlign="left";ctx.fillStyle="#aab7c8";ctx.fillText(row.label,12,y+8);
            ctx.fillStyle="#263243";ctx.fillRect(labelWidth,y,barWidth,16);
            ctx.fillStyle=row.color;ctx.fillRect(labelWidth,y,Math.max(0,row.value/maxValue*barWidth),16);
            ctx.textAlign="right";ctx.fillStyle="#e6edf6";ctx.fillText(String(row.value),width-10,y+8);
        });
    }

    function updateAnalyticsDashboard(metrics, state) {
        const now = root.performance && typeof root.performance.now === "function" ?
            root.performance.now() : Date.now();
        if (analyticsHistory.length===0 || now-analyticsLastSampleAt>=1000) {
            analyticsHistory.push({
                rewards:metrics.rewards||0,
                corrections:metrics.corrections||0,
                energy:Math.max(0,Math.min(state.config.maxEnergy,Number(metrics.energy)||0))
            });
            if(analyticsHistory.length>60)analyticsHistory.shift();
            analyticsLastSampleAt=now;
        }

        const rewards=Math.max(0,metrics.rewards||0);
        const corrections=Math.max(0,metrics.corrections||0);
        const examples=Math.max(0,metrics.trainingExamples||0);
        const wallFrames=Math.max(0,metrics.wallFrames||0);
        const total=rewards+corrections;
        const memorySummary=metrics.memorySummary||state.memorySummary||{};
        const memoryCount=Math.max(0,Number(memorySummary.count)||0);
        const episodeCount=Math.max(0,Number(memorySummary.episodeCount)||0);
        const recall=Math.max(0,Math.min(1,Number(metrics.memoryRecall)||0));
        const recallCount=Math.max(0,metrics.memoryRecallCount||0);
        const counts=memorySummary.outcomeCounts||{"goal-reward":0,"behavior-correction":0,"energy-depletion":0,"wall-contact":0};
        const priorityAverage=Number(memorySummary.priorityAverage)||0;
        const occurrenceAverage=Number(memorySummary.occurrencesAverage)||0;
        setText("analytics-total-examples",examples.toLocaleString());
        setText("analytics-reward-share",total?(rewards/total*100).toFixed(1)+"%":"—");
        setText("analytics-feedback-ratio",corrections?(rewards/corrections).toFixed(2)+" : 1":rewards?"∞ : 1":"—");
        setText("analytics-wall-share",corrections?(wallFrames/corrections*100).toFixed(1)+"%":"—");
        setText("analytics-rate-base","Server-managed");
        setText("analytics-rate-reward","Server-managed");
        setText("analytics-rate-correction","Server-managed");
        setText("analytics-rate-wall","Server-managed");
        setText("analytics-rate-depletion","Server-managed");
        setText("analytics-rate-replay","Server-managed");
        setText("analytics-ppo-updates",state.counters.ppoUpdateCount.toLocaleString());
        setText("analytics-ppo-reward",state.counters.ppoRewardAverage.toFixed(3));
        setText("analytics-episode-capacity",episodeCount+" / "+state.config.episodeCapacity);
        const memoryPercent=memoryCount/state.config.memoryCapacity*100;
        setText("analytics-memory-capacity",memoryCount+" / "+state.config.memoryCapacity+" ("+memoryPercent.toFixed(0)+"%)");
        setText("analytics-memory-priority",memoryCount?priorityAverage.toFixed(2)+" / 4.00":"—");
        setText("analytics-memory-occurrences",memoryCount?occurrenceAverage.toFixed(2):"—");
        setText("analytics-memory-recall",(recall*100).toFixed(1)+"%");
        setText("analytics-memory-recalled",recallCount.toLocaleString());
        const meter=get("analytics-memory-meter");
        if(meter)meter.style.width=Math.max(0,Math.min(100,memoryPercent))+"%";

        // The text telemetry updates with each state response, but chart canvases
        // redraw once per second rather than on every remote simulation poll.
        if (now - analyticsLastRenderAt < 1000) return;
        analyticsLastRenderAt = now;
        drawAnalyticsMemoryChart(counts);
        const feedbackMax=Math.max(1,...analyticsHistory.map(point=>Math.max(point.rewards,point.corrections)));
        drawAnalyticsLineChart("analytics-feedback-chart",[
            {key:"rewards",color:"#29c99a"},{key:"corrections",color:"#fb7185"}
        ],feedbackMax,"");
        drawAnalyticsLineChart("analytics-energy-chart",[
            {key:"energy",color:"#60a5fa"}
        ],state.config.maxEnergy,"%");
    }

    function updateDiagnostics(payload) {
        const state=payload.snapshot,inputs=payload.inputs,output=payload.output,display=payload.display||{};
        const counters=state.counters;
        const energy=Number.isFinite(display.energy)?display.energy:state.energy;
        const depleted=typeof display.energyDepleted==="boolean"?display.energyDepleted:state.energyDepleted;
        const examples=Number.isFinite(display.trainingExamples)?display.trainingExamples:counters.trainingExamples;
        const rewards=Number.isFinite(display.rewards)?display.rewards:
            (state.evolutionaryMode?counters.evolutionTrainingRewards:counters.trainingRewards);
        const corrections=Number.isFinite(display.corrections)?display.corrections:
            (state.evolutionaryMode?counters.evolutionTrainingCorrections:counters.trainingCorrections);
        const wallFrames=Number.isFinite(display.wallFrames)?display.wallFrames:
            (state.evolutionaryMode?counters.evolutionWallPenaltyFrames:counters.wallPenaltyFrames);
        const memorySummary=display.memorySummary||state.memorySummary||{};
        const recall=Number.isFinite(display.memoryRecall)?display.memoryRecall:state.lastMemoryRecall;
        const recallCount=Number.isFinite(display.memoryRecallCount)?display.memoryRecallCount:state.lastMemoryRecallCount;

        setText("input-speed",inputs[0].toFixed(2)+", "+inputs[1].toFixed(2));
        setText("input-goal",inputs[2].toFixed(2)+", "+inputs[3].toFixed(2));
        setText("input-obstacle",inputs[4].toFixed(2)+", "+inputs[5].toFixed(2));
        setText("input-clearance",inputs[6].toFixed(2));
        setText("input-location",inputs[7].toFixed(2)+", "+inputs[8].toFixed(2));
        setText("input-energy",depleted?"DEPLETED":energy.toFixed(1)+" / "+state.config.maxEnergy);
        const energyMeter=get("energy-meter");
        if(energyMeter){
            energyMeter.value=energy;
            energyMeter.style.accentColor=energy<=20?"#fb5574":energy<=50?"#f59e0b":"#22c99a";
        }
        setText("output-vx",output[0].toFixed(2));
        setText("output-vy",output[1].toFixed(2));
        setText("output-brake",Math.max(0,Math.min(1,output[2])).toFixed(2));
        setText("training-count",examples.toLocaleString());
        setText("training-feedback",rewards.toLocaleString()+" / "+corrections.toLocaleString());
        setText("wall-penalty-frames",wallFrames.toLocaleString());
        setText("ppo-update-count",counters.ppoUpdateCount.toLocaleString());
        setText("memory-count",(Number(memorySummary.count)||0).toLocaleString()+" / "+state.config.memoryCapacity);
        setText("memory-episodes",(Number(memorySummary.episodeCount)||0)+" / "+state.config.episodeCapacity);
        setText("memory-recall",Math.round(recall*100)+"%");
        updateMemoryOverview({
            memorySummary:memorySummary,recallCount:recallCount,
            memoryCapacity:state.config.memoryCapacity,episodeCapacity:state.config.episodeCapacity
        });
        updateAnalyticsDashboard({
            trainingExamples:examples,rewards:rewards,corrections:corrections,
            wallFrames:wallFrames,energy:energy,memorySummary:memorySummary,
            memoryRecall:recall,memoryRecallCount:recallCount
        },state);
    }

    function showFeedback(message) {
        const element=get("feedback-message");
        if(!element)return;
        element.textContent=String(message);
        root.setTimeout(()=>{if(element.textContent===String(message))element.textContent="";},2800);
    }

    const ui = {
        drawWorld:drawWorld,
        drawEvolution:drawEvolution,
        updateDiagnostics:updateDiagnostics,
        updateEvolutionStatus:updateEvolutionStatus,
        updateMemoryOverview:updateMemoryOverview,
        setEvolutionViewEnabled:setEvolutionViewEnabled,
        setEvolutionModeState:setEvolutionModeState,
        setEvolutionStopPending:setEvolutionStopPending,
        setAgentRadius:value=>{
            const slider=get("agent-size"),readout=get("agent-size-value");
            if(slider)slider.value=String(value);
            if(readout)readout.textContent=String(value)+"px";
        },
        setModelStatus:value=>setText("model-status",value),
        showFeedback:showFeedback,
        updateNeuralNetwork:layers=>{
            if(typeof root.updateNeuralVisualizer==="function")root.updateNeuralVisualizer(layers);
        }
    };

    let currentState = null;
    let polling = false;
    let pollTimer = null;
    let pollBusy = false;
    let requestSequence = 0;
    let latestRenderedSequence = 0;
    let lastFeedbackMessage = "";
    let activeMode = "self";

    function stopPolling() {
        polling = false;
        if (pollTimer !== null) root.clearTimeout(pollTimer);
        pollTimer = null;
        pollBusy = false;
    }

    function setModeView(mode) {
        activeMode = mode === "server" ? "server" : "self";
        const serverMode = activeMode === "server";
        const selfButton = get("self-training-mode");
        const serverButton = get("server-trained-mode");
        if (selfButton) {
            selfButton.classList.toggle("is-active", !serverMode);
            selfButton.setAttribute("aria-pressed", String(!serverMode));
        }
        if (serverButton) {
            serverButton.classList.toggle("is-active", serverMode);
            serverButton.setAttribute("aria-pressed", String(serverMode));
        }
        root.document.querySelectorAll(".user-training-only").forEach(element => {
            element.hidden = serverMode;
        });
        const serverPanel = get("server-training-panel");
        if (serverPanel) serverPanel.hidden = !serverMode;
        setText("agent-five-mode-description", serverMode ?
            "Viewing the separate server-trained Agent Five. This mode is read-only; background learning continues independently." :
            "Train Agent Five directly with rewards, corrections, and the existing learning controls.");
    }

    function renderRemoteState(state, sequence) {
        if (!state || typeof state !== "object" || !state.dimensions || !state.counters) {
            throw new Error("The private Agent Five server returned an incomplete state snapshot.");
        }
        if (sequence < latestRenderedSequence) return;
        latestRenderedSequence = sequence;
        currentState = state;

        setEvolutionViewEnabled(Boolean(state.evolutionaryMode));
        setEvolutionModeState(Boolean(state.evolutionaryMode));
        setEvolutionStopPending(false);
        if (state.evolutionaryMode) drawEvolution(state);
        else drawWorld(state);
        updateEvolutionStatus(state);

        const inputs = Array.isArray(state.lastInputs) && state.lastInputs.length === 16 ?
            state.lastInputs : Array(16).fill(0);
        const output = Array.isArray(state.lastOutput) && state.lastOutput.length === 3 ?
            state.lastOutput : [0, 0, 0];
        const memorySummary = state.memorySummary || {};
        const counters = state.counters;
        updateDiagnostics({
            snapshot: state,
            inputs: inputs,
            output: output,
            display: {
                energy: state.energy,
                energyDepleted: state.energyDepleted,
                trainingExamples: state.evolutionaryMode ? counters.evolutionTrainingExamples : counters.trainingExamples,
                rewards: state.evolutionaryMode ? counters.evolutionTrainingRewards : counters.trainingRewards,
                corrections: state.evolutionaryMode ? counters.evolutionTrainingCorrections : counters.trainingCorrections,
                wallFrames: state.evolutionaryMode ? counters.evolutionWallPenaltyFrames : counters.wallPenaltyFrames,
                memorySummary: memorySummary,
                memoryRecall: state.lastMemoryRecall,
                memoryRecallCount: state.lastMemoryRecallCount
            }
        });

        if (Array.isArray(state.neuralVizLayers) && typeof root.updateNeuralVisualizer === "function") {
            root.updateNeuralVisualizer(state.neuralVizLayers);
        }
        setText("model-status", activeMode === "server" ?
            "Server-trained agent · read-only" : (state.modelStatus || "Private server model active"));

        const serverTraining = state.server || {};
        setText("server-training-status", serverTraining.autonomousTrainingEnabled ?
            "ACTIVE · running in background" : "Not started");
        setText("server-training-started", serverTraining.trainingStartedAt ?
            new Date(serverTraining.trainingStartedAt).toLocaleString() : "—");
        setText("server-training-last-run", serverTraining.lastTrainingAt ?
            new Date(serverTraining.lastTrainingAt).toLocaleString() : "Waiting for first batch");
        setText("server-training-steps", Number(serverTraining.simulatedSteps || 0).toLocaleString());

        if (state.feedback && state.feedback !== lastFeedbackMessage) {
            lastFeedbackMessage = state.feedback;
            showFeedback(state.feedback);
        }
    }

    async function pollOnce() {
        if (!polling || pollBusy) return;
        pollBusy = true;
        const sequence = ++requestSequence;
        try {
            const result = activeMode === "server" ?
                await root.AgentFiveAuth.serverTrainedState() :
                await root.AgentFiveAuth.sessionTick();
            renderRemoteState(result.state, sequence);
        } catch (error) {
            showFeedback(error && error.message ? error.message : "Lost connection to the Agent Five server.");
            simulation.stop();
        } finally {
            pollBusy = false;
            if (polling) pollTimer = root.setTimeout(pollOnce, activeMode === "server" ? 1000 : 50);
        }
    }

    async function runAction(action, options = {}) {
        if (activeMode !== "self") {
            throw new Error("The server-trained agent is read-only. Switch to Self Training Mode to train your own session.");
        }
        try {
            const result = await root.AgentFiveAuth.sessionAction(action, options);
            if (result.state) renderRemoteState(result.state, ++requestSequence);
            return result.state || null;
        } catch (error) {
            showFeedback(error && error.message ? error.message : "The server could not apply that action.");
            throw error;
        }
    }

    const simulation = {
        async start() {
            stopPolling();
            setModeView("self");
            const result = await root.AgentFiveAuth.sessionStart();
            renderRemoteState(result.state, ++requestSequence);

            // Start the autonomous model once. Its Durable Object alarm continues
            // after this page closes and does not depend on the user's session ticks.
            try {
                await root.AgentFiveAuth.serverTrainedStart();
            } catch (error) {
                showFeedback("User training is ready, but the background server trainer could not start: " +
                    (error && error.message ? error.message : "server unavailable"));
            }

            polling = true;
            pollTimer = root.setTimeout(pollOnce, 50);
            return result.state;
        },
        async viewServerTrainedAgent() {
            stopPolling();
            setModeView("server");
            try {
                const result = await root.AgentFiveAuth.serverTrainedStart();
                renderRemoteState(result.state, ++requestSequence);
                polling = true;
                pollTimer = root.setTimeout(pollOnce, 1000);
                return result.state;
            } catch (error) {
                setModeView("self");
                throw error;
            }
        },
        async viewSelfTraining() {
            stopPolling();
            setModeView("self");
            const result = await root.AgentFiveAuth.sessionStart();
            renderRemoteState(result.state, ++requestSequence);
            polling = true;
            pollTimer = root.setTimeout(pollOnce, 50);
            return result.state;
        },
        stop() {
            stopPolling();
        },
        getSnapshot() {
            return currentState;
        },
        async setPopulationSize(value) {
            const state = await runAction("setPopulationSize", { value: value });
            return state ? state.evolutionPopulationSize : Number(value);
        },
        setEvolutionMode(enabled) {
            return runAction("setEvolutionMode", { enabled: Boolean(enabled) });
        },
        setAgentRadius(value) {
            return runAction("setAgentRadius", { value: value }).then(state =>
                state && state.agent ? state.agent.radius : Number(value)
            );
        },
        reward() { return runAction("reward"); },
        correct() { return runAction("correct"); },
        clearMemory() { return runAction("clearMemory"); },
        reset() { return runAction("reset"); },
        async exportData() {
            const result = await root.AgentFiveAuth.sessionExport();
            return result.summary;
        },
        async importData(data, fileName) {
            const result = await root.AgentFiveAuth.sessionImport(data, fileName);
            if (result.state) renderRemoteState(result.state, ++requestSequence);
            return "Model imported into the private Cloudflare session.";
        }
    };

    const selfTrainingModeButton = get("self-training-mode");
    if (selfTrainingModeButton) {
        selfTrainingModeButton.addEventListener("click", () => {
            simulation.viewSelfTraining().catch(error =>
                showFeedback(error && error.message ? error.message : "Could not open Self Training Mode.")
            );
        });
    }
    const serverTrainedModeButton = get("server-trained-mode");
    if (serverTrainedModeButton) {
        serverTrainedModeButton.addEventListener("click", () => {
            simulation.viewServerTrainedAgent().catch(error =>
                showFeedback(error && error.message ? error.message : "Could not open the server-trained agent.")
            );
        });
    }

    const populationSizeInput = get("evolution-population-size");
    if (populationSizeInput) {
        populationSizeInput.addEventListener("change", async () => {
            try {
                populationSizeInput.value = String(await simulation.setPopulationSize(populationSizeInput.value));
            } catch {}
        });
    }

    const evolutionToggle = get("evolution-mode");
    if (evolutionToggle) {
        evolutionToggle.addEventListener("change", () => {
            simulation.setEvolutionMode(evolutionToggle.checked).catch(() => {});
        });
    }

    const sizeSlider = get("agent-size");
    if (sizeSlider) {
        sizeSlider.addEventListener("input", () => {
            simulation.setAgentRadius(sizeSlider.value).then(radius =>
                showFeedback("Agent size set to " + radius + "px.")
            ).catch(() => {});
        });
    }

    const rewardButton = get("reward-button");
    if (rewardButton) rewardButton.addEventListener("click", () => simulation.reward().catch(() => {}));
    const punishButton = get("punish-button");
    if (punishButton) punishButton.addEventListener("click", () => simulation.correct().catch(() => {}));
    const clearMemoryButton = get("clear-memory-button");
    if (clearMemoryButton) clearMemoryButton.addEventListener("click", () => simulation.clearMemory().catch(() => {}));
    const resetButton = get("reset-button");
    if (resetButton) resetButton.addEventListener("click", () => simulation.reset().catch(() => {}));

    const exportButton = get("export-button");
    if (exportButton) {
        exportButton.addEventListener("click", async () => {
            try {
                const summary = await simulation.exportData();
                const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = root.document.createElement("a");
                link.href = url;
                link.download = "agent-five-training-summary.json";
                link.click();
                root.setTimeout(() => URL.revokeObjectURL(url), 0);
                showFeedback("A redacted training summary was exported. Model weights and raw memory remain on Cloudflare.");
            } catch {}
        });
    }

    const loadButton = get("load-button");
    const brainFile = get("brain-file");
    if (loadButton && brainFile) {
        loadButton.addEventListener("click", () => brainFile.click());
        brainFile.addEventListener("change", async event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            try {
                if (file.size > 1024 * 1024) throw new Error("File is too large (maximum 1 MB).");
                const data = JSON.parse(await file.text());
                await simulation.importData(data, file.name);
                showFeedback("The selected model was imported into the private Cloudflare session.");
            } catch (error) {
                showFeedback("Could not load brain: " + (error && error.message ? error.message : "invalid file"));
            } finally {
                brainFile.value = "";
            }
        });
    }

    let selectedFile = null;
    const chooseFileButton = get("choose-file-button");
    const generalFileInput = get("general-file-input");
    const selectedFileName = get("selected-file-name");

    function clearSelectedFile() {
        selectedFile = null;
        if (generalFileInput) generalFileInput.value = "";
        if (selectedFileName) selectedFileName.textContent = "No file selected.";
    }

    function getSelectedFile() {
        return selectedFile;
    }

    if (chooseFileButton && generalFileInput) {
        chooseFileButton.addEventListener("click", () => generalFileInput.click());
        generalFileInput.addEventListener("change", event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            selectedFile = file;
            if (selectedFileName) {
                const size = file.size < 1024 * 1024 ?
                    (file.size / 1024).toFixed(1) + " KB" :
                    (file.size / (1024 * 1024)).toFixed(2) + " MB";
                selectedFileName.textContent = "Selected: " + file.name + " (" + size + ")";
            }
            root.dispatchEvent(new CustomEvent("agentfive:file-selected", { detail: { file: file } }));
            showFeedback("File selected. It has not been uploaded or processed.");
        });
    }

    root.addEventListener("pagehide", () => simulation.stop(), { once: true });
    root.AgentFiveBrowser = Object.freeze({
        simulation: simulation,
        getSelectedFile: getSelectedFile,
        clearSelectedFile: clearSelectedFile
    });
})(globalThis);
