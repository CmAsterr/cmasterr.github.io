/* === js/tabs_scroll.js ===
 * 核心功能：
 * 1. 页面缩放控件：自由拖拽 + 物理视觉恒定 + 适配黑夜模式轨道
 * 2. 昼夜切换：图标对调 + 瞬时同步 Wipe 动画 (消除切换割裂感)
 * 3. 变量分发：包含紧凑模态框与灰色预览区变量
 */
(function() {
    const THEMES = {
        light: {
            wallpaper: './day.png',
            glassBg: 'rgba(255, 255, 255, 0.55)',
            modalBg: 'rgba(255, 255, 255, 0.99)',
            glassBorder: 'rgba(255, 255, 255, 0.4)',
            textMain: '#1d1d1f',
            textSub: 'rgba(0, 0, 0, 0.5)',
            accent: '#007AFF',
            glassInset: 'rgba(0, 0, 0, 0.05)'
        },
        dark: {
            wallpaper: './night.png',
            glassBg: 'rgba(28, 28, 30, 0.65)',
            modalBg: 'rgba(35, 35, 37, 0.99)', 
            glassBorder: 'rgba(255, 255, 255, 0.12)',
            textMain: '#f5f5f7',
            textSub: 'rgba(255, 255, 255, 0.5)',
            accent: '#0A84FF',
            glassInset: 'rgba(255, 255, 255, 0.1)'
        }
    };

    function applyThemeVariables(themeName) {
        const root = document.documentElement;
        const cfg = THEMES[themeName];
        root.setAttribute('data-theme', themeName);
        root.style.setProperty('--ios-wallpaper', `url('${cfg.wallpaper}')`);
        root.style.setProperty('--glass-bg', cfg.glassBg);
        root.style.setProperty('--modal-bg', cfg.modalBg);
        root.style.setProperty('--glass-border', cfg.glassBorder);
        root.style.setProperty('--text-main', cfg.textMain);
        root.style.setProperty('--text-sub', cfg.textSub);
        root.style.setProperty('--accent-blue', cfg.accent);
        root.style.setProperty('--glass-inset', cfg.glassInset);
    }

    function initThemeSwitcher() {
        const themeKey = "polyCalc_theme";
        const savedTheme = localStorage.getItem(themeKey) || "light";
        applyThemeVariables(savedTheme);

        const header = document.querySelector("header.glass-island");
        const brand = header ? header.querySelector(".brand") : null;
        if (!header || !brand || document.getElementById("themeToggleBtn")) return;

        const toggleBtn = document.createElement("button");
        toggleBtn.id = "themeToggleBtn";
        Object.assign(toggleBtn.style, {
            background: "none", border: "none", cursor: "pointer", padding: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginLeft: "10px", marginRight: "6px", transition: "transform 0.2s", flexShrink: "0"
        });

        const getIcon = (t) => t === "light" 
            ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

        toggleBtn.innerHTML = getIcon(savedTheme);
        brand.after(toggleBtn);

        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (document.getElementById("theme-wipe-layer")) return;
            const isLight = document.documentElement.getAttribute("data-theme") === "light";
            const nextTheme = isLight ? "dark" : "light";
            const targetImg = isLight ? 'night.png' : 'day.png';

            const wipe = document.createElement("div");
            wipe.id = "theme-wipe-layer";
            wipe.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100vh;z-index:999999;pointer-events:none;background-image:url('${targetImg}');background-size:cover;background-position:center center;clip-path:circle(0% at 0% 50%);transition:clip-path 0.8s cubic-bezier(0.65, 0, 0.35, 1);will-change:clip-path;`;
            document.body.appendChild(wipe);

            requestAnimationFrame(() => { wipe.style.clipPath = "circle(150% at 0% 50%)"; });
            
            setTimeout(() => {
                applyThemeVariables(nextTheme);
                localStorage.setItem(themeKey, nextTheme);
                toggleBtn.innerHTML = getIcon(nextTheme);
            }, 400);
            
            wipe.addEventListener("transitionend", () => wipe.remove(), { once: true });
        });
    }

    function initPageZoom() {
        const key = "polyCalc_pageZoom";
        const posKey = "polyCalc_zoomPos";
        if (document.getElementById("pageZoomControl")) return;

        const style = document.createElement('style');
        style.textContent = `
            #pageZoomControl input[type=range] { -webkit-appearance: none; background: transparent; cursor: pointer; }
            #pageZoomControl input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(0, 0, 0, 0.12); border-radius: 2px; }
            :root[data-theme="dark"] #pageZoomControl input[type=range]::-webkit-slider-runnable-track { background: rgba(255, 255, 255, 0.3); }
            #pageZoomControl input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 22px; width: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.15); margin-top: -9px; border: 0.5px solid rgba(0,0,0,0.04); transition: transform 0.2s; }
            #pageZoomControl input[type=range]:active::-webkit-slider-thumb { transform: scale(1.1); }
        `;
        document.head.appendChild(style);

        const wrap = document.createElement("div");
        wrap.id = "pageZoomControl";
        Object.assign(wrap.style, {
            position: "fixed", display: "flex", alignItems: "center", gap: "12px", padding: "10px 20px", borderRadius: "999px", zIndex: "9999",
            background: "var(--glass-bg)", backdropFilter: "blur(25px) saturate(180%)", webkitBackdropFilter: "blur(25px) saturate(180%)",
            border: "1px solid var(--glass-border)", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", color: "var(--text-main)", fontSize: "14px", fontWeight: "800",
            cursor: "grab", userSelect: "none", transformOrigin: "bottom right"
        });

        let currentPos = JSON.parse(localStorage.getItem(posKey) || '{"right":25, "bottom":25}');
        const label = document.createElement("span"); label.textContent = "页面大小";
        const input = document.createElement("input"); input.type = "range"; input.min = "25"; input.max = "200"; input.value = localStorage.getItem(key) || "100"; input.style.width = "120px";
        const valLabel = document.createElement("span"); valLabel.style.cssText = "min-width: 50px; text-align: right; color: #007AFF; font-size: 16px; font-weight: 900;";

        const apply = (v) => {
            const val = Math.round(v);
            const scale = val / 100;
            document.documentElement.style.zoom = scale;
            valLabel.textContent = val + "%";
            wrap.style.transform = `scale(${1/scale})`;
            wrap.style.right = (currentPos.right / scale) + "px";
            wrap.style.bottom = (currentPos.bottom / scale) + "px";
            localStorage.setItem(key, val);
            window.dispatchEvent(new Event("resize"));
        };

        input.oninput = (e) => apply(e.target.value);
        wrap.append(label, input, valLabel);
        document.body.appendChild(wrap);
        apply(input.value);

        let isDragging = false, startX, startY, initR, initB;
        wrap.addEventListener("mousedown", (e) => {
            if (e.target === input) return;
            isDragging = true; wrap.style.cursor = "grabbing";
            startX = e.clientX; startY = e.clientY;
            initR = currentPos.right; initB = currentPos.bottom;
            e.preventDefault();
        });
        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            currentPos.right = initR + (startX - e.clientX);
            currentPos.bottom = initB + (startY - e.clientY);
            const scale = parseInt(input.value) / 100;
            wrap.style.right = (currentPos.right / scale) + "px";
            wrap.style.bottom = (currentPos.bottom / scale) + "px";
            localStorage.setItem(posKey, JSON.stringify(currentPos));
        });
        window.addEventListener("mouseup", () => { isDragging = false; wrap.style.cursor = "grab"; });
    }

    function initTabsScroll() {
        const tabs = document.querySelector(".tabs");
        if (!tabs) return;
        tabs.querySelectorAll("a.tab").forEach(a => {
            a.setAttribute("draggable", "false");
            a.addEventListener("dragstart", (e) => e.preventDefault());
        });
        const saved = localStorage.getItem("polyCalc_tabsScroll");
        if (saved) tabs.scrollLeft = parseInt(saved, 10);
        let isDown = false, sX, scrollL, moved = false;
        tabs.addEventListener("mousedown", (e) => {
            isDown = true; moved = false; sX = e.pageX; scrollL = tabs.scrollLeft;
            tabs.style.cursor = "grabbing";
        });
        window.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            const dx = e.pageX - sX;
            if (Math.abs(dx) > 5) moved = true;
            tabs.scrollLeft = scrollL - dx;
        });
        window.addEventListener("mouseup", () => {
            if (!isDown) return;
            isDown = false; tabs.style.cursor = "";
            localStorage.setItem("polyCalc_tabsScroll", tabs.scrollLeft);
        });
        tabs.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    }

    document.addEventListener("DOMContentLoaded", () => {
        initThemeSwitcher();
        initTabsScroll();
        initPageZoom();
    });
})();