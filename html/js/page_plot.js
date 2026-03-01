/* === js/page_plot.js ===
 * 函数图像绘制 - 完美适配移动端（双指缩放、单指拖拽、点击标点）
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

    // 获取当前主题配色
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
        try { return katex.renderToString((tex || "").replace(/\*/g, " \\cdot "), { throwOnError: false, displayMode: false }); } catch (e) { return tex; }
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height;
        if (!originX && !originY) { originX = rect.width / 2; originY = rect.height / 2; }
        draw();
    }

    function buildEvaluator(expr) {
        let s = String(expr || "").trim().replace(/^[a-zA-Z]\s*:\s*/g, "");
        if (s.includes("=")) { const p = s.split("="); s = p[1].trim(); }
        if (!s || /[^0-9x+\-*/^().,\sA-Za-z]/.test(s)) return null;

        s = s.replace(/(\d)(x)/g, "$1*x").replace(/(x)(\d)/g, "$1*$2").replace(/(\))(x)/g, ")*$2").replace(/(x)(\()/g, "$1*(").replace(/(\d)(\()/g, "$1*(").replace(/(\))(\d)/g, ")*$2");
        s = s.replace(/\^/g, "**").replace(/\bln\b/g, "log").replace(/\bpi\b/g, "Math.PI").replace(/\be\b/g, "Math.E");
        s = s.replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|log|exp|pow|min|max)\b/g, "Math.$1");
        try { return new Function("x", `"use strict"; return ${s};`); } catch (e) { return null; }
    }

    function addItem(expr) {
        items.push({ label: labels[items.length % labels.length], color: colors[items.length % colors.length], expr: expr || "" });
        renderList(); draw();
    }

    function removeItem(idx) { items.splice(idx, 1); renderList(); draw(); }

    function openEditPanel(idx) {
        editingIndex = idx;
        editInput.value = items[idx].expr;
        editPreview.innerHTML = renderMath(items[idx].expr || "\\text{请输入公式...}");
        editPanel.classList.remove("hidden", "is-closing");
        void editPanel.offsetWidth; 
        editPanel.classList.add("is-opening"); 
        setTimeout(() => editInput.focus(), 50);
    }

    function closeEditPanel() {
        if (editPanel.classList.contains("hidden")) return;
        editPanel.classList.remove("is-opening");
        editPanel.classList.add("is-closing");
        editPanel.addEventListener("animationend", () => {
            editPanel.classList.add("hidden");
            editPanel.classList.remove("is-closing");
        }, { once: true });
        editingIndex = -1;
    }

    editCancelBtn.onclick = closeEditPanel;
    editOkBtn.onclick = () => {
        if (editingIndex > -1) { items[editingIndex].expr = editInput.value; renderList(); draw(); }
        closeEditPanel();
    };
    editInput.oninput = () => editPreview.innerHTML = renderMath(editInput.value || "\\text{...}");

    function renderList() {
        listEl.innerHTML = "";
        items.forEach((it, i) => {
            const wrap = document.createElement("div"); wrap.className = "plot-item";
            if (!buildEvaluator(it.expr) && it.expr.trim() !== "") wrap.classList.add("invalid");

            wrap.innerHTML = `
                <div class="plot-info">
                    <span class="plot-color" style="background:${it.color}"></span>
                    <span class="plot-name">${it.label}(x) = </span>
                    <span class="plot-latex">${renderMath(it.expr || "\\cdots")}</span>
                </div>
                <div class="plot-actions">
                    <button class="plot-edit-btn">编辑</button>
                    <button class="plot-del-btn">删除</button>
                </div>
            `;
            wrap.querySelector(".plot-edit-btn").onclick = () => openEditPanel(i);
            wrap.querySelector(".plot-del-btn").onclick = () => removeItem(i);
            listEl.appendChild(wrap);
        });
    }

    function worldToScreen(x, y) { return { x: originX + x * scale, y: originY - y * scale }; }
    function screenToWorld(x, y) { return { x: (x - originX) / scale, y: (originY - y) / scale }; }

    function drawGrid() {
        const w = canvas.width, h = canvas.height, theme = getTheme(); 
        ctx.save(); ctx.clearRect(0, 0, w, h);
        const units = 80 / scale, base = Math.pow(10, Math.floor(Math.log10(units)));
        gridUnit = [1, 2, 5].find(s => s * base >= units) * base; 
        const minor = gridUnit / 5;
        ctx.lineWidth = 1; ctx.font = "13px 'JetBrains Mono', 'Fira Code', monospace"; ctx.fillStyle = theme.text;

        const drawLines = (step, isMajor) => {
            for (let x = Math.floor((-originX/scale) / step) * step; x <= Math.ceil(((w-originX)/scale) / step) * step; x += step) {
                const sx = originX + x * scale;
                ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
                ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
                if (isMajor && Math.abs(x) > 1e-9) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(Number.isInteger(x) ? x : x.toFixed(2), sx, Math.max(0, Math.min(originY + 5, h - 20))); }
            }
            for (let y = Math.floor(((originY-h)/scale) / step) * step; y <= Math.ceil((originY/scale) / step) * step; y += step) {
                const sy = originY - y * scale;
                ctx.strokeStyle = isMajor ? theme.gridMajor : theme.gridMinor;
                ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
                if (isMajor && Math.abs(y) > 1e-9) { ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(Number.isInteger(y) ? y : y.toFixed(2), Math.max(30, Math.min(originX - 5, w)), sy); }
            }
        };

        if (gridToggle.checked) { drawLines(minor, false); drawLines(gridUnit, true); }
        ctx.strokeStyle = theme.axis; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(w, originY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, h); ctx.stroke();
        if (gridToggle.checked) { ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText("0", Math.max(15, Math.min(originX - 5, w)), Math.max(0, Math.min(originY + 5, h - 15))); }
        ctx.restore();
    }

    function drawFunctions() {
        items.forEach((it) => {
            const fn = buildEvaluator(it.expr); if (!fn) return;
            ctx.strokeStyle = it.color; ctx.lineWidth = 2.5; ctx.beginPath();
            let started = false, prevY = null;
            for (let sx = 0; sx <= canvas.width; sx += 1) {
                let wy = fn((sx - originX) / scale);
                if (!Number.isFinite(wy)) { started = false; continue; }
                const sy = originY - wy * scale;
                if (!started || (prevY !== null && Math.abs(sy - prevY) > 200)) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
                prevY = sy;
            }
            ctx.stroke();
        });
    }

    function drawTracker() {
        if (mouseX === null || mouseY === null || isDragging) return;
        const theme = getTheme(); 
        let snapX = (mouseX - originX) / scale, snapY = (originY - mouseY) / scale, isSnapped = false, minD = 25; 

        if (snapToggle && snapToggle.checked) {
            items.forEach(it => {
                const fn = buildEvaluator(it.expr); if (!fn) return;
                let wy = fn(snapX); 
                if (Number.isFinite(wy) && Math.abs(mouseY - (originY - wy * scale)) < minD) {
                    minD = Math.abs(mouseY - (originY - wy * scale)); snapY = wy; isSnapped = true;
                }
            });
            if (!isSnapped && gridToggle.checked) {
                let gwX = Math.round(snapX / gridUnit) * gridUnit, gwY = Math.round(snapY / gridUnit) * gridUnit;
                if (Math.hypot(mouseX - (originX + gwX * scale), mouseY - (originY - gwY * scale)) < 20) { snapX = gwX; snapY = gwY; isSnapped = true; }
            }
        }

        let dX = originX + snapX * scale, dY = originY - snapY * scale;
        ctx.save(); ctx.strokeStyle = theme.trackerBorder; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(dX, 0); ctx.lineTo(dX, canvas.height); ctx.moveTo(0, dY); ctx.lineTo(canvas.width, dY); ctx.stroke();

        const text = `(${Number.isInteger(snapX) ? snapX : snapX.toFixed(2)}, ${Number.isInteger(snapY) ? snapY : snapY.toFixed(2)})`;
        ctx.font = "bold 13px 'Inter', sans-serif"; const tW = ctx.measureText(text).width + 20;
        let bX = dX + 12, bY = dY + 12;
        if (bX + tW > canvas.width) bX = dX - tW - 12;
        if (bY + 26 > canvas.height) bY = dY - 36;

        ctx.shadowColor = "rgba(0,0,0,0.12)"; ctx.shadowBlur = 10; ctx.fillStyle = theme.trackerBg;
        ctx.beginPath(); ctx.roundRect(bX, bY, tW, 26, 8); ctx.fill();
        ctx.shadowColor = "transparent"; ctx.fillStyle = theme.trackerText; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, bX + tW / 2, bY + 13);
        
        if (isSnapped) { ctx.beginPath(); ctx.arc(dX, dY, 9, 0, Math.PI * 2); ctx.strokeStyle = theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(107, 114, 128, 0.25)"; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(dX, dY, isSnapped ? 4 : 3, 0, Math.PI * 2); ctx.fillStyle = theme.isDark ? "#ffffff" : "#ffffff"; ctx.fill();
        ctx.strokeStyle = isSnapped ? (theme.isDark ? "#ffffff" : "#374151") : "#9ca3af"; ctx.lineWidth = isSnapped ? 2 : 1.5; ctx.stroke();
        ctx.restore();
    }

    function draw() { ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid(); drawFunctions(); drawTracker(); }

    // ==========================================
    // 电脑端：鼠标事件支持
    // ==========================================
    let startX = 0, startY = 0, startOX = 0, startOY = 0;
    canvas.addEventListener("mousedown", (e) => { if (e.button !== 0) return; isDragging = true; canvas.classList.add("dragging"); startX = e.clientX; startY = e.clientY; startOX = originX; startOY = originY; });
    window.addEventListener("mousemove", (e) => { 
        const r = canvas.getBoundingClientRect(); 
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { mouseX = e.clientX - r.left; mouseY = e.clientY - r.top; } else { mouseX = null; mouseY = null; } 
        if (isDragging) { originX = startOX + (e.clientX - startX); originY = startOY + (e.clientY - startY); } 
        requestAnimationFrame(draw); 
    });
    window.addEventListener("mouseup", () => { if (!isDragging) return; isDragging = false; canvas.classList.remove("dragging"); draw(); });
    canvas.addEventListener("mouseleave", () => { mouseX = null; mouseY = null; draw(); });
    canvas.addEventListener("wheel", (e) => { 
        e.preventDefault(); const zoom = Math.exp(-e.deltaY * 0.001); const mx = e.offsetX, my = e.offsetY, wx = (mx - originX) / scale, wy = (originY - my) / scale; 
        scale = Math.max(10, Math.min(300, scale * zoom)); originX = mx - wx * scale; originY = my + wy * scale; draw(); 
    }, { passive: false });

    // ==========================================
    // 手机端：触屏与双指手势支持 (核心新增)
    // ==========================================
    let initialPinchDist = null;
    let initialScale = null;
    let pinchStartCenter = null;
    let pinchStartOrigin = null;

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault(); // 阻止手机浏览器原生滑动
        const rect = canvas.getBoundingClientRect();
        
        if (e.touches.length === 1) {
            // 单指：拖拽平移 & 标点
            isDragging = true;
            canvas.classList.add("dragging");
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startOX = originX;
            startOY = originY;
            mouseX = t.clientX - rect.left;
            mouseY = t.clientY - rect.top;
        } else if (e.touches.length === 2) {
            // 双指：记录初始距离和中心点，准备缩放
            isDragging = false; 
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            initialScale = scale;
            pinchStartCenter = {
                x: (t1.clientX + t2.clientX) / 2 - rect.left,
                y: (t1.clientY + t2.clientY) / 2 - rect.top
            };
            pinchStartOrigin = { x: originX, y: originY };
            mouseX = pinchStartCenter.x;
            mouseY = pinchStartCenter.y;
        }
        draw();
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();

        if (e.touches.length === 1 && isDragging) {
            // 单指拖拽更新
            const t = e.touches[0];
            mouseX = t.clientX - rect.left;
            mouseY = t.clientY - rect.top;
            originX = startOX + (t.clientX - startX);
            originY = startOY + (t.clientY - startY);
        } else if (e.touches.length === 2 && initialPinchDist) {
            // 双指缩放更新
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const zoom = currentDist / initialPinchDist;
            
            const currentCenter = {
                x: (t1.clientX + t2.clientX) / 2 - rect.left,
                y: (t1.clientY + t2.clientY) / 2 - rect.top
            };

            scale = Math.max(10, Math.min(300, initialScale * zoom));
            
            // 矩阵补偿：保证以双指中心点为几何中心进行缩放，并支持边缩放边平移
            const wx = (pinchStartCenter.x - pinchStartOrigin.x) / initialScale;
            const wy = (pinchStartOrigin.y - pinchStartCenter.y) / initialScale;
            originX = currentCenter.x - wx * scale;
            originY = currentCenter.y + wy * scale;

            mouseX = currentCenter.x;
            mouseY = currentCenter.y;
        }
        requestAnimationFrame(draw);
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        if (e.touches.length < 2) initialPinchDist = null;
        
        if (e.touches.length === 1) {
            // 如果放开一根手指，剩下的那一根无缝切换回单指拖拽模式
            isDragging = true;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startOX = originX;
            startOY = originY;
        } else if (e.touches.length === 0) {
            isDragging = false;
            canvas.classList.remove("dragging");
            // 注意：这里没有像 mouseleave 一样清空 mouseX/Y。
            // 这样手机端点击后，追踪的坐标气泡会一直悬浮在屏幕上供用户阅读！
        }
        draw();
    }, { passive: false });

    canvas.addEventListener("touchcancel", () => {
        isDragging = false;
        initialPinchDist = null;
        canvas.classList.remove("dragging");
        draw();
    }, { passive: false });


    if (gridToggle) gridToggle.addEventListener("change", draw);
    if (snapToggle) snapToggle.addEventListener("change", draw);
    if (addBtn) addBtn.addEventListener("click", () => addItem(""));
    window.addEventListener("resize", resizeCanvas);

    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    addItem("x^2"); addItem("sin(x)"); resizeCanvas();
})();
