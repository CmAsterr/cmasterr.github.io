/* === js/ui_shared.js ===
 * UI共享组件库 - 自动增高 + 动画支持 + 复制提示
 */
(function() {
    const UI = {};

    // --- 1. 本地存储辅助 ---
    UI.Storage = {
        save: function(key, data) {
            try { localStorage.setItem("polyCalc_" + key, JSON.stringify(data)); } catch (e) {}
        },
        load: function(key) {
            try { return JSON.parse(localStorage.getItem("polyCalc_" + key)); } catch (e) { return null; }
        }
    };

    // --- 2. 渲染 LaTeX 辅助 ---
    UI.renderMath = function(tex) {
        if (!window.katex) return tex;
        try {
            const displayTex = (tex || "").replace(/\*/g, " \\cdot ");
            return katex.renderToString(displayTex, { throwOnError: false, displayMode: false });
        } catch (e) { return tex; }
    };
    
    UI.escHtml = function(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    // --- 3. 复制成功提示 (新增) ---
    let copyToastTimeout;
    UI.showCopyToast = function(message = "已复制") {
        const toast = document.getElementById('copySuccessToast');
        if (!toast) return;

        // 清除任何正在进行的计时器
        clearTimeout(copyToastTimeout);

        // 设置消息并显示
        const messageSpan = toast.querySelector('span');
        if (messageSpan) messageSpan.textContent = message;
        toast.classList.add('show');

        // 2秒后隐藏
        copyToastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    };


    // --- 4. 初始化输入组件 ---
    UI.initInputWidget = function(ids, onConfirm) {
        const el = (id) => document.getElementById(id);
        const dom = {
            display: el(ids.display), editBtn: el(ids.editBtn), copyBtn: el(ids.copyBtn),
            panel: el(ids.panel), input: el(ids.input), preview: el(ids.preview),
            err: el(ids.err), okBtn: el(ids.okBtn), cancelBtn: el(ids.cancelBtn)
        };

        let currentExpr = ""; 

        const updateDisplay = () => {
            if (!currentExpr) {
                dom.display.innerHTML = '<span style="color:#999; font-size:18px; font-style:italic;">点击编辑输入表达式...</span>';
            } else {
                dom.display.innerHTML = UI.renderMath(currentExpr);
            }
        };

        const openPanel = () => {
            if (dom.panel) {
                dom.panel.classList.remove("hidden", "is-closing");
                void dom.panel.offsetWidth; // Force reflow
                dom.panel.classList.add("is-opening");
            }
            if (dom.input) {
                dom.input.value = currentExpr;
                dom.input.focus();
                updatePreview();
            }
        };

        const closePanel = () => {
            if (dom.panel) {
                dom.panel.classList.remove("is-opening");
                dom.panel.classList.add("is-closing");
                dom.err.innerHTML = "";
                dom.panel.addEventListener('animationend', function handler() {
                    dom.panel.classList.add("hidden");
                    dom.panel.classList.remove("is-closing");
                    dom.panel.removeEventListener('animationend', handler);
                }, {once: true});
            }
        };

        const updatePreview = () => {
            if (!dom.preview || !dom.input) return;
            const val = dom.input.value.trim();
            dom.preview.innerHTML = val ? UI.renderMath(val) : "";
        };

        if (dom.editBtn) dom.editBtn.onclick = openPanel;
        if (dom.cancelBtn) dom.cancelBtn.onclick = closePanel;
        // 【修改】调用 showCopyToast
        if (dom.copyBtn) dom.copyBtn.onclick = () => {
            navigator.clipboard.writeText(currentExpr);
            UI.showCopyToast("表达式已复制");
        };
        
        if (dom.input) {
            dom.input.oninput = () => {
                updatePreview();
            };
        }

        if (dom.okBtn) {
            dom.okBtn.onclick = () => {
                const val = dom.input ? dom.input.value.trim() : "";
                
                if (onConfirm) {
                    const err = onConfirm(val);
                    if (dom.err && err) { 
                        dom.err.innerHTML = UI.renderMath(err); 
                        return; 
                    }
                }
                currentExpr = val;
                updateDisplay();
                closePanel();
            };
        }

        updateDisplay();
        
        return {
            getExpr: () => currentExpr,
            setExpr: (v) => { currentExpr = v; updateDisplay(); }
        };
    };

    // --- 5. 初始化输出组件 ---
    UI.initOutputWidget = function(displayId, copyBtnId) {
        const disp = document.getElementById(displayId);
        const copy = document.getElementById(copyBtnId);
        let rawValue = "";
        // 【修改】调用 showCopyToast
        if (copy) copy.onclick = () => {
            navigator.clipboard.writeText(rawValue);
            UI.showCopyToast("结果已复制");
        };

        return {
            set: (text) => {
                rawValue = text;
                if (!text) {
                    if (disp) disp.innerHTML = "";
                } else {
                    if (disp) disp.innerHTML = UI.renderMath(text);
                }
            },
            get: () => rawValue
        };
    };

    window.UI = UI;
})();
