/* === js/page_simplify.js ===
 * 表达式化简页面控制器 - 允许空状态 + 记忆
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
            // 校验逻辑：如果输入为空，通过；如果不为空，尝试解析
            if (!val) return null;
            try { PolyCore.parseStr(val); return null; } 
            catch (e) { return "语法错误: " + e.message; }
        });

        const outputWidget = UI.initOutputWidget('exprOutDisplay', 'exprOutCopyBtn');
        const msgEl = document.getElementById('simplifyMsg');
        const runBtn = document.getElementById('btnSimplify');
        const sortBtn = document.getElementById('sortOrderBtn');

        let lastPoly = null;
        let lastVarName = "x";
        let isAscending = false;

        function saveState() {
            UI.Storage.save('simplify', {
                expr: inputWidget.getExpr(),
                asc: isAscending
            });
        }

        function updateOutput() {
            if (!lastPoly) return;
            const latexStr = PolyCore.toLatex(lastPoly, lastVarName, isAscending);
            outputWidget.set(latexStr);
            if (sortBtn) sortBtn.textContent = isAscending ? "降幂排列" : "升幂排列";
        }

        function run(autoSave = true) {
            try {
                const expr = inputWidget.getExpr();
                
                if (!expr) {
                    lastPoly = null;
                    outputWidget.set(""); 
                    if(msgEl) msgEl.textContent = ""; 
                    if (autoSave) saveState();
                    return;
                }

                const result = PolyCore.parseStr(expr);
                lastPoly = result.poly;
                lastVarName = result.varName;
                
                updateOutput();
                
                // 【修改】用户要求不显示“化简完成”
                if(msgEl) msgEl.textContent = "";

                if (autoSave) saveState();

            } catch (e) {
                console.error(e);
                if(msgEl) msgEl.textContent = "错误: " + e.message;
            }
        }

        if (runBtn) runBtn.onclick = () => run(true);
        
        if (sortBtn) {
            sortBtn.onclick = () => {
                if (!lastPoly) return;
                isAscending = !isAscending;
                updateOutput();
                saveState();
            };
        }

        // 加载状态
        const savedState = UI.Storage.load('simplify');
        if (savedState) {
            inputWidget.setExpr(savedState.expr || ""); 
            isAscending = !!savedState.asc;
            run(false);
        } else {
            inputWidget.setExpr("(x+1)^3");
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
