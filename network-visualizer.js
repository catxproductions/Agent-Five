(() => {
    "use strict";
    const canvas = document.getElementById("networkCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const inputLabels = [
        "Current speed X", "Current speed Y", "Goal direction X", "Goal direction Y",
        "Obstacle direction X", "Obstacle direction Y", "Obstacle clearance",
        "Current location X", "Current location Y", "Energy remaining",
        "Left wall clearance", "Right wall clearance", "Top wall clearance",
        "Bottom wall clearance", "Goal distance", "Energy usage rate"
    ];
    const outputLabels = ["Thrust X", "Thrust Y", "Braking"];
    const labels = ["INPUT · 16", "ABSTRACTED ACTIVITY · 6", "OUTPUT · 3"];
    const layerX = [220, 510, 800];
    let latestLayers = null;

    function nodeY(index, count) {
        const top = 66;
        const bottom = canvas.height - 34;
        return count <= 1 ? (top + bottom) / 2 :
            top + index * (bottom - top) / (count - 1);
    }

    function updateNeuralVisualizer(layers) {
        if (!Array.isArray(layers) || layers.length !== 3 ||
            !layers.every(layer => Array.isArray(layer) && layer.every(Number.isFinite)) ||
            layers[0].length !== 16 || layers[1].length !== 6 || layers[2].length !== 3) return;
        latestLayers = layers;
        draw();
    }

    function draw() {
        if (!latestLayers) return;
        const width = 1040;
        if (canvas.width !== width) canvas.width = width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#0c1016";
        ctx.fillRect(0, 0, width, height);

        ctx.font = "700 10px Inter, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        latestLayers.forEach((values, layer) => {
            ctx.fillStyle = layer === 0 ? "#60a5fa" : layer === 2 ? "#a78bfa" : "#4dd8d0";
            ctx.fillText(labels[layer], layerX[layer], 28);
        });

        for (let layer = 0; layer < 2; layer++) {
            const source = latestLayers[layer];
            const target = latestLayers[layer + 1];
            for (let i = 0; i < source.length; i++) {
                for (let j = 0; j < target.length; j++) {
                    const activity = source[i] * target[j];
                    const alpha = Math.min(0.46, 0.08 + Math.abs(activity) * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(layerX[layer], nodeY(i, source.length));
                    ctx.lineTo(layerX[layer + 1], nodeY(j, target.length));
                    ctx.strokeStyle = activity >= 0 ?
                        "rgba(56, 189, 248, " + alpha + ")" :
                        "rgba(251, 85, 116, " + alpha + ")";
                    ctx.lineWidth = 0.6 + Math.min(0.8, Math.abs(activity));
                    ctx.stroke();
                }
            }
        }

        latestLayers.forEach((values, layer) => {
            values.forEach((value, index) => {
                const x = layerX[layer];
                const y = nodeY(index, values.length);
                const intensity = Math.min(1, Math.abs(value));
                const hue = layer === 0 ? "59, 130, 246" :
                    layer === 2 ? "167, 139, 250" : "45, 212, 191";
                const radius = 8;

                ctx.beginPath();
                ctx.arc(x, y, radius + 4 + intensity * 3, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(" + hue + ", " + (0.06 + intensity * 0.2) + ")";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(" + hue + ", " + (0.35 + intensity * 0.65) + ")";
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255," + (0.25 + intensity * 0.65) + ")";
                ctx.lineWidth = 1 + intensity * 1.2;
                ctx.stroke();

                ctx.fillStyle = "#f8fafc";
                ctx.font = "8px ui-monospace, SFMono-Regular, Consolas, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(Number(value).toFixed(1), x, y);
                if (layer === 0) {
                    ctx.textAlign = "right";
                    ctx.fillStyle = "#cbd5e1";
                    ctx.font = "10px Inter, Segoe UI, sans-serif";
                    ctx.fillText(inputLabels[index] || ("Input " + (index + 1)), x - 16, y);
                } else if (layer === 2) {
                    ctx.textAlign = "left";
                    ctx.fillStyle = "#cbd5e1";
                    ctx.font = "10px Inter, Segoe UI, sans-serif";
                    ctx.fillText(outputLabels[index] || ("Output " + (index + 1)), x + 16, y);
                }
            });
        });
    }

    window.updateNeuralVisualizer = updateNeuralVisualizer;
})();
