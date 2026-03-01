/* === js/page_operate.js ===
 * 修改逻辑：存储切换立即更新估算信息；操作符切换需点击开始计算按钮触发运算
 */
(function() {
    function boot() {
        if (!window.PolyCore || !window.UI) { setTimeout(boot, 50); return; }

        const EPS = 1e-9;

        // --- 1. 初始化输入 A & B ---
        const inputA = UI.initInputWidget({
            display: 'exprADisplay', editBtn: 'exprAEditBtn', copyBtn: 'exprACopyBtn',
            panel: 'exprAPanel', input: 'exprAInput', preview: 'exprAPreview',
            err: 'exprAErr', okBtn: 'exprAOkBtn', cancelBtn: 'exprACancelBtn'
        }, (val) => {
            if (!val) return null;
            try { PolyCore.parseStr(val); return null; } catch (e) { return e.message; }
        });

        const inputB = UI.initInputWidget({
            display: 'exprBDisplay', editBtn: 'exprBEditBtn', copyBtn: 'exprBCopyBtn',
            panel: 'exprBPanel', input: 'exprBInput', preview: 'exprBPreview',
            err: 'exprBErr', okBtn: 'exprBOkBtn', cancelBtn: 'exprBCancelBtn'
        }, (val) => {
            if (!val) return null;
            try { PolyCore.parseStr(val); return null; } catch (e) { return e.message; }
        });

        // --- 2. 初始化交互元素 ---
        const outputWidget = UI.initOutputWidget('exprOutDisplay', 'exprOutCopyBtn');
        const calcBtn = document.getElementById('btnCalc');
        const sortBtn = document.getElementById('sortOrderBtn');
        const opBtns = document.querySelectorAll('.op-btn');
        const storeBtns = document.querySelectorAll('.store-btn');
        const storeInfo = document.getElementById('storeInfo');

        // --- 3. 状态维护 ---
        let currentOp = 'add';
        let currentStore = 'dyn'; 
        let lastResultPoly = null;
        let lastVarName = "x";
        let isAscending = false;
        
        // 缓存各部分大小，用于即时反馈存储切换
        let cache = { sA: 0, sB: 0, sR: 0, dA: 0, dB: 0, dR: 0 };

        function updateOpUI() {
            opBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.op === currentOp));
        }

        function updateStoreUI() {
            storeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.store === currentStore));
        }

        function saveState() {
            UI.Storage.save('operate', {
                exprA: inputA.getExpr(), exprB: inputB.getExpr(),
                op: currentOp, asc: isAscending, store: currentStore
            });
        }

        function updateOutput() {
            if (!lastResultPoly) return;
            const latex = PolyCore.toLatex(lastResultPoly, lastVarName, isAscending);
            outputWidget.set(latex);
            if (sortBtn) sortBtn.textContent = isAscending ? "降幂排列" : "升幂排列";
        }

        function seqFromPoly(poly) {
            let maxExp = 0;
            if (poly) { poly.forEach((c, e) => { if (Math.abs(c) > EPS && e > maxExp) maxExp = e; }); }
            const arr = new Array(maxExp + 1).fill(0);
            if (poly) { poly.forEach((c, e) => { if (Math.abs(c) > EPS) arr[e] = c; }); }
            return arr;
        }

        // 【核心优化】即时更新存储空间显示逻辑
        function updateStoreInfo() {
            if (!storeInfo) return;
            const seqUnit = 8; const dynUnit = 16;
            const { sA, sB, sR, dA, dB, dR } = cache;

            if (currentStore === "seq") {
                const sTotal = sA + sB + sR;
                storeInfo.textContent = `≈ A ${seqUnit}×${sA} + B ${seqUnit}×${sB} + R ${seqUnit}×${sR} = ${sTotal * seqUnit} B`;
            } else {
                const dTotal = dA + dB + dR;
                storeInfo.textContent = `≈ A ${dynUnit}×${dA} + B ${dynUnit}×${dB} + R ${dynUnit}×${dR} = ${dTotal * dynUnit} B`;
            }
        }

        // --- 4. 核心计算逻辑：仅在点击 calcBtn 时调用 ---
        function run(autoSave = true) {
            try {
                const strA = inputA.getExpr();
                const strB = inputB.getExpr();
                if (!strA || !strB) {
                    outputWidget.set("");
                    if (storeInfo) storeInfo.textContent = "≈ --";
                    return;
                }

                const resA = PolyCore.parseStr(strA);
                const resB = PolyCore.parseStr(strB);

                if (resA.varName !== resB.varName && resA.poly.size > 0 && resB.poly.size > 0) {
                    outputWidget.set("\\textcolor{#ff3b30}{\\text{错误：变量名不一致}}");
                    if (storeInfo) storeInfo.textContent = "≈ --";
                    return;
                }

                let resultPoly = null;
                if (currentOp === 'add') resultPoly = PolyCore.add(resA.poly, resB.poly);
                else if (currentOp === 'sub') resultPoly = PolyCore.sub(resA.poly, resB.poly);
                else resultPoly = PolyCore.mul(resA.poly, resB.poly);

                // 更新缓存
                const seqA = seqFromPoly(resA.poly);
                const seqB = seqFromPoly(resB.poly);
                const seqR = seqFromPoly(resultPoly);
                cache = { 
                    sA: seqA.length, sB: seqB.length, sR: seqR.length,
                    dA: resA.poly.size, dB: resB.poly.size, dR: resultPoly.size 
                };

                lastResultPoly = resultPoly;
                lastVarName = resA.varName;
                
                updateOutput();
                updateStoreInfo();

                if (autoSave) saveState();
            } catch (e) {
                console.error(e);
                outputWidget.set(`\\textcolor{#ff3b30}{\\text{计算出错：}${e.message}}`);
            }
        }

        // --- 5. 事件绑定：调整触发逻辑 ---
        opBtns.forEach(btn => {
            btn.onclick = () => { 
                currentOp = btn.dataset.op; 
                updateOpUI(); 
                saveState(); // 仅保存状态，点击按钮才计算
            };
        });

        storeBtns.forEach(btn => {
            btn.onclick = () => { 
                currentStore = btn.dataset.store; 
                updateStoreUI(); 
                updateStoreInfo(); // 核心：切换存储方式立即反馈，不触发重算
                saveState();
            };
        });

        if (calcBtn) calcBtn.onclick = () => run(true); 

        if (sortBtn) {
            sortBtn.onclick = () => { 
                if (lastResultPoly) { isAscending = !isAscending; updateOutput(); saveState(); } 
            };
        }

        // --- 6. 加载初始化 ---
        const saved = UI.Storage.load('operate');
        if (saved) {
            inputA.setExpr(saved.exprA || "");
            inputB.setExpr(saved.exprB || "");
            currentOp = saved.op || 'add';
            currentStore = saved.store || 'dyn';
            isAscending = !!saved.asc;
            updateOpUI(); updateStoreUI(); run(false);
        } else {
            inputA.setExpr("x+1"); inputB.setExpr("x-1"); run(false);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();