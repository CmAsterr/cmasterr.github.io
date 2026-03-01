/* === js/page_eval.js ===
 * 表达式计算页面控制器 - 支持一元表达式及流畅模态框动画
 */
(function() {
    function boot() {
        if (!window.PolyCore || !window.UI) { setTimeout(boot, 50); return; }

        const inputWidget = UI.initInputWidget({
            display: 'exprInDisplay',
            editBtn: 'exprInEditBtn', copyBtn: 'exprInCopyBtn',
            panel: 'exprInPanel', input: 'exprInInput',
            preview: 'exprInPreview', err: 'exprInErr',
            okBtn: 'exprInOkBtn', cancelBtn: 'exprInCancelBtn'
        }, (val) => {
            if (!val) return null;
            const info = analyzeExpr(val);
            return info.error || null;
        });

        const simplifiedWidget = UI.initOutputWidget('exprOutDisplay', 'exprOutCopyBtn');
        const valueWidget = UI.initOutputWidget('valueOutDisplay', 'valueOutCopyBtn');

        const msgEl = document.getElementById('evalMsg');
        const evalBtn = document.getElementById('btnEval');

        const varDisplay = document.getElementById('varDisplay');
        const varEditBtn = document.getElementById('varEditBtn');
        const varCopyBtn = document.getElementById('varCopyBtn');
        const varPanel = document.getElementById('varPanel');
        const varNameLabel = document.getElementById('varNameLabel');
        const varValueInput = document.getElementById('varValueInput');
        const varErr = document.getElementById('varErr');
        const varOkBtn = document.getElementById('varOkBtn');
        const varCancelBtn = document.getElementById('varCancelBtn');

        let currentVarName = "x";
        let currentValue = null;

        function setMsg(text) {
            if (msgEl) msgEl.textContent = text || "";
        }

        function varNameToLatex(name) {
            if (window.PolyCore && PolyCore.formatVarName) return PolyCore.formatVarName(name);
            const s = String(name || "x");
            const idx = s.indexOf("_");
            if (idx === -1) return s;
            const base = s.slice(0, idx) || "x";
            const sub = s.slice(idx + 1);
            if (!sub) return base;
            return base + "_{" + sub + "}";
        }

        function formatNumber(n) {
            let v = Math.abs(n) < 1e-10 ? 0 : n;
            const rounded = Math.round(v);
            if (Math.abs(v - rounded) < 1e-8) return String(rounded);
            let s = v.toFixed(8);
            return s.replace(/\.?0+$/, "");
        }

        function updateVarName(name) {
            currentVarName = name || "x";
            if (varNameLabel) varNameLabel.innerHTML = UI.renderMath(varNameToLatex(currentVarName));
            updateVarDisplay();
        }

        function updateVarDisplay() {
            if (!varDisplay) return;
            const nameLatex = varNameToLatex(currentVarName);
            if (currentValue === null) {
                varDisplay.innerHTML = `<span style="color:#cbd5e1;font-size:14px;">${UI.renderMath(nameLatex + " = ?")}</span>`;
                return;
            }
            varDisplay.innerHTML = UI.renderMath(`${nameLatex} = ${formatNumber(currentValue)}`);
        }

        function openVarPanel() {
            syncVarNameFromExpr();
            if (varPanel) {
                varPanel.classList.remove("hidden", "is-closing");
                void varPanel.offsetWidth; // 触发回流确保动画生效
            }
            if (varNameLabel) varNameLabel.innerHTML = UI.renderMath(varNameToLatex(currentVarName));
            if (varValueInput) {
                varValueInput.value = (currentValue === null) ? "" : formatNumber(currentValue);
                varValueInput.focus();
            }
            if (varErr) varErr.textContent = "";
        }

        // 【核心修改】加入真正的反向关闭动画逻辑
        function closeVarPanel() {
            if (!varPanel || varPanel.classList.contains("hidden")) return;
            varPanel.classList.add("is-closing");
            varPanel.addEventListener("animationend", function handler() {
                varPanel.classList.add("hidden");
                varPanel.classList.remove("is-closing");
                varPanel.removeEventListener("animationend", handler);
            }, { once: true });
            
            if (varErr) varErr.textContent = "";
        }

        function parseNumber(str) {
            const s = String(str || "").trim();
            if (!s) return null;
            const ok = /^[-+]?(\d+(\.\d+)?|\.\d+)(e[-+]?\d+)?$/i.test(s);
            if (!ok) return null;
            const num = Number(s);
            if (!Number.isFinite(num)) return null;
            return num;
        }

        function detectVarNames(expr) {
            const tokens = PolyCore.tokenize(expr);
            const set = new Set();
            tokens.forEach(t => {
                if (t.type === "id") set.add(t.text);
            });
            return Array.from(set);
        }

        function analyzeExpr(expr) {
            const raw = String(expr || "").trim();
            if (!raw) return { empty: true, varName: "x", hasVar: false, poly: new Map() };
            if (/[=<>≤≥≠]/.test(raw)) return { error: "这里只计算表达式，不支持等号或不等号" };

            let names = [];
            try {
                names = detectVarNames(raw);
            } catch (e) {
                return { error: "语法错误: " + e.message };
            }

            if (names.length > 1) return { error: "只支持一元表达式" };

            let parsed;
            try {
                parsed = PolyCore.parseStr(raw);
            } catch (e) {
                return { error: "语法错误: " + e.message };
            }

            const varName = names.length ? names[0] : parsed.varName || "x";
            return { poly: parsed.poly, varName, hasVar: names.length > 0 };
        }

        function syncVarNameFromExpr() {
            const expr = inputWidget.getExpr();
            if (!expr) { updateVarName("x"); return; }
            const info = analyzeExpr(expr);
            if (!info.error) updateVarName(info.varName);
        }

        function evalPoly(poly, x) {
            let sum = 0;
            poly.forEach((c, e) => {
                sum += c * Math.pow(x, e);
            });
            return sum;
        }

        function saveState() {
            UI.Storage.save('eval', {
                expr: inputWidget.getExpr(),
                value: currentValue
            });
        }

        function run(autoSave = true) {
            try {
                const expr = inputWidget.getExpr();

                if (!expr) {
                    simplifiedWidget.set("");
                    valueWidget.set("");
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                const info = analyzeExpr(expr);
                if (info.error) {
                    simplifiedWidget.set("");
                    valueWidget.set(`\\textcolor{red}{\\text{${info.error}}}`);
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                updateVarName(info.varName);

                const latex = PolyCore.toLatex(info.poly, info.varName, false);
                simplifiedWidget.set(latex);

                if (info.hasVar && currentValue === null) {
                    valueWidget.set(`\\textcolor{#94a3b8}{\\text{请先输入变量取值}}`);
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                const x = (currentValue === null) ? 0 : currentValue;
                const value = evalPoly(info.poly, x);

                if (!Number.isFinite(value)) {
                    valueWidget.set(`\\textcolor{red}{\\text{计算出错}}`);
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                valueWidget.set(formatNumber(value));
                setMsg("");
                if (autoSave) saveState();
            } catch (e) {
                console.error(e);
                simplifiedWidget.set("");
                valueWidget.set(`\\textcolor{red}{\\text{计算出错}}`);
                setMsg("");
            }
        }

        if (varEditBtn) varEditBtn.onclick = openVarPanel;
        if (varCancelBtn) varCancelBtn.onclick = closeVarPanel;
        if (varValueInput) {
            varValueInput.oninput = () => { if (varErr) varErr.textContent = ""; };
            varValueInput.onkeydown = (e) => {
                if (e.key === "Enter") { if (varOkBtn) varOkBtn.click(); }
            };
        }
        if (varCopyBtn) varCopyBtn.onclick = () => {
            const text = (currentValue === null) ? "" : `${currentVarName}=${formatNumber(currentValue)}`;
            navigator.clipboard.writeText(text);
        };

        if (varOkBtn) {
            varOkBtn.onclick = () => {
                const valStr = varValueInput ? varValueInput.value : "";
                const num = parseNumber(valStr);
                if (num === null) {
                    if (varErr) varErr.textContent = "请输入有效数字";
                    return;
                }
                currentValue = num;
                updateVarDisplay();
                closeVarPanel();
                saveState();
            };
        }

        if (evalBtn) evalBtn.onclick = () => run(true);

        updateVarName("x");
        updateVarDisplay();

        const saved = UI.Storage.load('eval');
        if (saved) {
            inputWidget.setExpr(saved.expr || "");
            if (typeof saved.value === "number") currentValue = saved.value;
            updateVarDisplay();
            if (saved.expr) run(false);
        } else {
            inputWidget.setExpr("x^2+1");
            updateVarDisplay();
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();