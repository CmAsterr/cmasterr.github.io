/* === js/page_sparse.js ===
 * 稀疏判定页面控制器 - 恢复并优化项数显示逻辑
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
            try { PolyCore.parseStr(val); return null; }
            catch (e) { return e.message; }
        });

        const msgEl = document.getElementById('simplifyMsg');
        const runBtn = document.getElementById('btnSimplify');
        const thresholdInput = document.getElementById('thresholdVal');
        const resultBox = document.getElementById('sparseResult');

        let lastPoly = null;
        let lastVarName = "x";

        function formatVarName(name) {
            if (window.PolyCore && PolyCore.formatVarName) return PolyCore.formatVarName(name);
            return String(name || "x");
        }

        function saveState() {
            UI.Storage.save('sparse', {
                expr: inputWidget.getExpr(),
                th: thresholdInput ? thresholdInput.value : 30
            });
        }

        function renderResult(info, threshold, v) {
            const pct = (info.ratio * 100).toFixed(2);
            const verdict = info.sparse ? "稀疏多项式" : "稠密多项式";
            const cmp = info.sparse ? "\\le" : ">";

            const vLatex = formatVarName(v);
            const termHtmlArr = [];
            // 对指数进行降幂排序显示
            const exps = info.exps.slice().sort((a, b) => b - a);
            for (let i = 0; i < exps.length; i++) {
                const e = exps[i];
                const termMath = (e === 0) ? "1" : (e === 1 ? vLatex : (vLatex + "^{" + e + "}"));
                termHtmlArr.push(UI.renderMath(termMath));
            }
            if (termHtmlArr.length === 0) termHtmlArr.push("0");

            const lines = [
                `\\text{判定结果：}${verdict}`,
                `\\text{实际非零项数：}${info.actual}`,
                `\\text{最高次幂：}${vLatex}^{\\text{max}}=${info.maxExp}`,
                `\\text{理论总项数：}(${info.maxExp}+1)=${info.theoretical}`,
                `\\text{占比：}${pct}\\%`,
                `\\text{判据：}${pct}\\% ${cmp} ${threshold}\\%`
            ];

            let html = `<div style="line-height:1.8;">`;
            lines.forEach(l => html += `<div>${UI.renderMath(l)}</div>`);

            // 【核心恢复】添加项数显示框 HTML，对应 CSS 实现水平拉条
            html += `<div class="sparse-terms-box">
                        ${termHtmlArr.join('<span class="term-sep">,</span>')}
                     </div>`;
            html += `</div>`;

            resultBox.innerHTML = html;
        }

        function run(autoSave = true) {
            try {
                const expr = inputWidget.getExpr();
                if (!expr) {
                    lastPoly = null;
                    resultBox.innerHTML = '<div style="opacity:0.5;font-style:italic;">等待计算...</div>';
                    return;
                }

                let th = 30;
                if (thresholdInput) th = parseFloat(thresholdInput.value) || 30;

                const result = PolyCore.parseStr(expr);
                lastPoly = result.poly;
                lastVarName = result.varName;

                const info = PolyCore.analyzeSparse(lastPoly, th);
                renderResult(info, th, lastVarName);

                if (autoSave) saveState();
            } catch (e) {
                console.error(e);
                resultBox.innerHTML = `<div style="color:#ff3b30">计算出错: ${e.message}</div>`;
            }
        }

        if (runBtn) runBtn.onclick = () => run(true);

        // 加载记忆
        const savedState = UI.Storage.load('sparse');
        if (savedState) {
            inputWidget.setExpr(savedState.expr || "");
            if (thresholdInput && savedState.th) thresholdInput.value = savedState.th;
            run(false);
        } else {
            inputWidget.setExpr("x^{50} + 1");
            run(false);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();