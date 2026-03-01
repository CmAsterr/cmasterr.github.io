/* === js/page_plot.js ===
 * 函数图像绘制 - 恢复独立按钮风格，应用标准模态框状态解决穿透BUG
 */
(function() {
    const colors = ["#007AFF", "#FF2D55", "#34C759", "#FF9500", "#5856D6", "#AF52DE", "#FF3B30", "#32ADE6"];
    const labels = ["f", "g", "h", "p", "q", "r", "s", "t", "u", "v"];

    const listEl = document.getElementById("plotList");
    const addBtn = document.getElementById("addFuncBtn");
    const canvas = document.getElementById("plotCanvas");
    const gridToggle = document.getElementById("gridToggle");
    const snapToggle = document.getElementById("snapToggle");

    const editPanel = document.getElementById("plotEditPanel");
    const editInput = document.getElementById("plotEditInput");
    const editPreview = document.getElementById("plotEditPreview");
    const editOkBtn = document.getElementById("plotEditOkBtn");
    const editCancelBtn = document.getElementById("plotEditCancelBtn");

    const ctx = canvas.getContext("2d");

    let items = [];
    let scale = 60;
    let originX = 0;
    let originY = 0;
    let editingIndex = -1;

    let mouseX = null;
    let mouseY = null;
    let isDragging = false;
    let gridUnit = 1; 

    function getTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            isDark,
            gridMajor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(148, 163, 184, 0.4)",
            gridMinor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(148, 163, 184, 0.15)",
            axis: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(17, 24, 39, 0.7)",
            text: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)",
            trackerBg: isDark ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
            trackerText: isDark ? "#ffffff" : "#4b5563",
            trackerBorder: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(156, 163, 175, 0.8)"
        };
    }

    function renderMath(tex) {
        if (!window.katex) return tex;
        try {
            const displayTex = (tex || "").replace(/\*/g, " \\cdot ");
            return katex.renderToString(displayTex, { throwOnError: false, displayMode: false });
        } catch (e) {
            return tex;
        }
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        if (!originX && !originY) {
            originX = rect.width / 2;
            originY = rect.height / 2;
        }
        draw();
    }

    function normalizeExpr(raw) {
        let s = String(raw || "").trim();
        if (!s) return "";
        s = s.replace(/^[a-zA-Z]\s*:\s*/g, "");
        if (s.includes("=")) {
            const parts = s.split("=");
            if (parts.length !== 2) return "";
            const left = parts[0].trim();
            const right = parts[1].trim();
            if (left === "y" || left.endsWith("y") || left.includes("y")) s = right;
            else return "";
        }
        return s;
    }

    function buildEvaluator(expr) {
        const raw = normalizeExpr(expr);
        if (!raw) return null;
        if (/[^0-9x+\-*/^().,\sA-Za-z]/.test(raw)) return null;

        let s = raw;
        s = s.replace(/(\d)(x)/g, "$1*x");
        s = s.replace(/(x)(\d)/g, "$1*$2");
        s = s.replace(/(\))(x)/g, ")*$2");
        s = s.replace(/(x)(\()/g, "$1*(");
        s = s.replace(/(\d)(\()/g, "$1*(");
        s = s.replace(/(\))(\d)/g, ")*$2");

        s = s.replace(/\^/g, "**");
        s = s.replace(/\bln\b/g, "log");
        s = s.replace(/\bpi\b/g, "Math.PI");
        s = s.replace(/\be\b/g, "Math.E");
        s = s.replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|log|exp|pow|min|max)\b/g, "Math.$1");

        try {
            return new Function("x", `"use strict"; return ${s};`);
        } catch (e) {
            return null;
        }
    }

    function addItem(expr) {
        const idx = items.length;
        items.push({
            label: labels[idx % labels.length],
            color: colors[idx % colors.length],
            expr: expr || ""
        });
        renderList();
        draw();
    }

    function removeItem(idx) {
        items.splice(idx, 1);
        renderList();
        draw();
    }

    // 【核心修复】使用 is-opening 状态类，触发正确的交互事件层级
    function openEditPanel(idx) {
        editingIndex = idx;
        const it = items[idx];
        editInput.value = it.expr;
        editPreview.innerHTML = renderMath(it.expr || "\\text{请输入公式...}");
        
        editPanel.classList.remove("hidden", "is-closing");
        void editPanel.offsetWidth; // 触发浏览器重绘
        editPanel.classList.add("is-opening"); // 添加状态，开启 pointer-events
        
        setTimeout(() => editInput.focus(), 50);
    }

    // 【核心修复】使用 is-closing 状态类，平滑过渡动画
    function closeEditPanel() {
        if (editPanel.classList.contains("hidden")) return;
        
        editPanel.classList.remove("is-opening");
        editPanel.classList.add("is-closing");
        
        editPanel.addEventListener("animationend", function handler() {
            editPanel.classList.add("hidden");
            editPanel.classList.remove("is-closing");
            editPanel.removeEventListener("animationend", handler);
        }, { once: true });
        
        editingIndex = -1;
    }

    editCancelBtn.onclick = closeEditPanel;

    editOkBtn.onclick = () => {
        if (editingIndex > -1) {
            items[editingIndex].expr = editInput.value;
            renderList();
            draw();
        }
        closeEditPanel();
    };

    editInput.oninput = () => {
        editPreview.innerHTML = renderMath(editInput.value || "\\text{...}");
    };

    function renderList() {
        listEl.innerHTML = "";
        items.forEach((it, i) => {
            const wrap = document.createElement("div");
            wrap.className = "plot-item";
            
            const fn = buildEvaluator(it.expr);
            if (!fn && it.expr.trim() !== "") wrap.classList.add("invalid");

            const info = document.createElement("div");
            info.className = "plot-info";

            const color = document.createElement("span");
            color.className = "plot-color";
            color.style.background = it.color;

            const name = document.createElement("span");
            name.className = "plot-name";
            name.textContent = `${it.label}(x) = `;

            const latex = document.createElement("span");
            latex.className = "plot-latex";
            latex.innerHTML = renderMath(it.expr || "\\cdots");

            info.appendChild(color);
            info.appendChild(name);
            info.appendChild(latex);

            const actions = document.createElement("div");
            actions.className = "plot-actions";

            const editBtn = document.createElement("button");
            editBtn.className = "plot-edit-btn";
            editBtn.textContent = "编辑";
            editBtn.onclick = () => openEditPanel(i);

            const delBtn = document.createElement("button");
            delBtn.className = "plot-del-btn";
            delBtn.textContent = "删除";
            delBtn.onclick = () => removeItem(i);

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);

            wrap.appendChild(info);
            wrap.appendChild(actions); 
            listEl.appendChild(wrap);
        });
    }

    function worldToScreen(x, y) {
        return { x: originX + x * scale, y: originY - y * scale };
    }

    function screenToWorld(x, y) {
        return { x: (x - originX) / scale, y: (originY - y) / scale };
    }

    function drawGrid() {
        const w = canvas.width;
        const h = canvas.height;
        const theme = getTheme(); 

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        const targetPx = 80;
        const units = targetPx / scale;
        const base = Math.pow(10, Math.floor(Math.log10(units)));
        const steps = [1, 2, 5];
        gridUnit = steps[0] * base; 
        for (let s of steps) {
            if (s * base >= units) { gridUnit = s * base; break; }
        }

        const minor = gridUnit / 5;
        ctx.lineWidth = 1;

        ctx.font = "13px 'JetBrains Mono', 'Fira Code', monospace";
        ctx.fillStyle = theme.text;

        function drawLinesAndNumbers(step, isMajor) {
            const left = screenToWorld(0, 0).x;
            const right = screenToWorld(w, 0).x;
            const top = screenToWorld(0, 0).y;
            const bottom = screenToWorld(0, h).y;

            const xStart = Math.floor(left / step) * step;
            const xEnd = Math.ceil(right / step) * step;
            for (let x = xStart; x <= xEnd; x += step) {
                const sx = worldToScreen(x, 0).x;
                ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
                ctx.beginPath();
                ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
                ctx.stroke();

                if (isMajor && Math.abs(x) > 1e-9) {
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    let textY = Math.max(0, Math.min(originY + 5, h - 20)); 
                    let numStr = Number.isInteger(x) ? x.toString() : parseFloat(x.toFixed(2)).toString();
                    ctx.fillText(numStr, sx, textY);
                }
            }

            const yStart = Math.floor(bottom / step) * step;
            const yEnd = Math.ceil(top / step) * step;
            for (let y = yStart; y <= yEnd; y += step) {
                const sy = worldToScreen(0, y).y;
                ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
                ctx.beginPath();
                ctx.moveTo(0, sy); ctx.lineTo(w, sy);
                ctx.stroke();

                if (isMajor && Math.abs(y) > 1e-9) {
                    ctx.textAlign = "right";
                    ctx.textBaseline = "middle";
                    let textX = Math.max(30, Math.min(originX - 5, w)); 
                    let numStr = Number.isInteger(y) ? y.toString() : parseFloat(y.toFixed(2)).toString();
                    ctx.fillText(numStr, textX, sy);
                }
            }
        }

        if (gridToggle.checked) {
            drawLinesAndNumbers(minor, false);
            drawLinesAndNumbers(gridUnit, true);
        }

        ctx.strokeStyle = theme.axis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, originY); ctx.lineTo(w, originY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(originX, 0); ctx.lineTo(originX, h);
        ctx.stroke();

        if (gridToggle.checked) {
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            let oX = Math.max(15, Math.min(originX - 5, w));
            let oY = Math.max(0, Math.min(originY + 5, h - 15));
            ctx.fillText("0", oX, oY);
        }

        ctx.restore();
    }

    function drawFunctions() {
        const w = canvas.width;
        items.forEach((it) => {
            const fn = buildEvaluator(it.expr);
            if (!fn) return;

            ctx.strokeStyle = it.color;
            ctx.lineWidth = 2.5; 
            ctx.beginPath();

            let started = false;
            let prevY = null;

            for (let sx = 0; sx <= w; sx += 1) {
                const wx = screenToWorld(sx, 0).x;
                let wy = fn(wx);
                if (!Number.isFinite(wy)) {
                    started = false;
                    prevY = null;
                    continue;
                }
                const sy = worldToScreen(0, wy).y;

                if (!started || (prevY !== null && Math.abs(sy - prevY) > 200)) {
                    ctx.moveTo(sx, sy);
                    started = true;
                } else {
                    ctx.lineTo(sx, sy);
                }
                prevY = sy;
            }
            ctx.stroke();
        });
    }

    function drawTracker() {
        if (mouseX === null || mouseY === null || isDragging) return;

        const theme = getTheme(); 
        let wPos = screenToWorld(mouseX, mouseY);
        let snapWorldX = wPos.x;
        let snapWorldY = wPos.y;
        let isSnapped = false;
        let minScreenDist = 25; 

        if (snapToggle && snapToggle.checked) {
            items.forEach(it => {
                const fn = buildEvaluator(it.expr);
                if (!fn) return;
                let wy = fn(wPos.x); 
                if (Number.isFinite(wy)) {
                    let sy = worldToScreen(0, wy).y;
                    let dist = Math.abs(mouseY - sy);
                    if (dist < minScreenDist) {
                        minScreenDist = dist;
                        snapWorldY = wy;
                        isSnapped = true;
                    }
                }
            });

            if (!isSnapped && gridToggle.checked) {
                let gwX = Math.round(wPos.x / gridUnit) * gridUnit;
                let gwY = Math.round(wPos.y / gridUnit) * gridUnit;
                let sx = worldToScreen(gwX, 0).x;
                let sy = worldToScreen(0, gwY).y;
                let dist = Math.hypot(mouseX - sx, mouseY - sy); 
                if (dist < 20) {
                    snapWorldX = gwX;
                    snapWorldY = gwY;
                    isSnapped = true;
                }
            }
        }

        let drawX = worldToScreen(snapWorldX, 0).x;
        let drawY = worldToScreen(0, snapWorldY).y;

        ctx.save();
        
        ctx.strokeStyle = theme.trackerBorder; 
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(drawX, 0); ctx.lineTo(drawX, canvas.height);
        ctx.moveTo(0, drawY); ctx.lineTo(canvas.width, drawY);
        ctx.stroke();

        let fmtX = Number.isInteger(snapWorldX) ? snapWorldX : snapWorldX.toFixed(2);
        let fmtY = Number.isInteger(snapWorldY) ? snapWorldY : snapWorldY.toFixed(2);
        const text = `(${fmtX}, ${fmtY})`;
        
        ctx.font = "bold 13px 'Inter', sans-serif";
        const tWidth = ctx.measureText(text).width + 20;
        
        let boxX = drawX + 12;
        let boxY = drawY + 12;
        if (boxX + tWidth > canvas.width) boxX = drawX - tWidth - 12;
        if (boxY + 26 > canvas.height) boxY = drawY - 36;

        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = theme.trackerBg;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, tWidth, 26, 8); 
        ctx.fill();

        ctx.shadowColor = "transparent"; 
        ctx.fillStyle = theme.trackerText; 
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, boxX + tWidth / 2, boxY + 13);
        
        if (isSnapped) {
            ctx.beginPath();
            ctx.arc(drawX, drawY, 9, 0, Math.PI * 2);
            ctx.strokeStyle = theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(107, 114, 128, 0.25)"; 
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(drawX, drawY, isSnapped ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = theme.isDark ? "#ffffff" : "#ffffff"; 
        ctx.fill();
        ctx.strokeStyle = isSnapped ? (theme.isDark ? "#ffffff" : "#374151") : "#9ca3af"; 
        ctx.lineWidth = isSnapped ? 2 : 1.5;
        ctx.stroke();

        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawFunctions();
        drawTracker(); 
    }

    let startX = 0, startY = 0, startOX = 0, startOY = 0;

    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        canvas.classList.add("dragging");
        startX = e.clientX;
        startY = e.clientY;
        startOX = originX;
        startOY = originY;
    });

    window.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        } else {
            mouseX = null;
            mouseY = null;
        }

        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            originX = startOX + dx;
            originY = startOY + dy;
        }
        
        requestAnimationFrame(draw);
    });

    window.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        canvas.classList.remove("dragging");
        draw();
    });

    canvas.addEventListener("mouseleave", () => {
        mouseX = null;
        mouseY = null;
        draw();
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoom = Math.exp(-e.deltaY * 0.001);
        const mx = e.offsetX;
        const my = e.offsetY;
        const world = screenToWorld(mx, my);

        scale = Math.max(10, Math.min(300, scale * zoom));
        originX = mx - world.x * scale;
        originY = my + world.y * scale;
        draw();
    }, { passive: false });

    if (gridToggle) gridToggle.addEventListener("change", draw);
    if (snapToggle) snapToggle.addEventListener("change", draw);
    if (addBtn) addBtn.addEventListener("click", () => addItem(""));
    window.addEventListener("resize", resizeCanvas);

    // 实时监听 html 上的 data-theme 属性变化重绘画布
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // 初始演示数据
    addItem("x^2");
    addItem("sin(x)");
    resizeCanvas();
})();