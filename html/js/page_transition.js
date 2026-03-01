/* === js/page_transition.js ===
 * 拦截导航栏点击，实现 3D 转盘翻页过渡效果
 */
(function() {
    // 定义页面的顺序，用于判断是向左翻还是向右翻
    const pageOrder = [
        "index.html",
        "sparse.html",
        "operate.html",
        "solve.html",
        "factor.html",
        "eval.html",
        "plot.html"
    ];

    function getPageIndex(url) {
        let file = url.split('/').pop().split('?')[0].split('#')[0];
        if (!file || file === "") file = "index.html";
        return pageOrder.indexOf(file);
    }

    document.addEventListener("DOMContentLoaded", () => {
        const mainContent = document.querySelector(".page-content");
        if (!mainContent) return;

        // 1. 处理页面进入动画 (读取上一次记录的进入方向)
        const enterDirection = sessionStorage.getItem("polyCalc_transition_enter");
        if (enterDirection) {
            mainContent.classList.add(enterDirection === "right" ? "carousel-enter-right" : "carousel-enter-left");
            sessionStorage.removeItem("polyCalc_transition_enter"); // 用完即焚
            
            // 动画结束后清理类名，防止影响内部弹窗的定位
            mainContent.addEventListener("animationend", () => {
                mainContent.classList.remove("carousel-enter-right", "carousel-enter-left");
            }, { once: true });
        } else {
            // 如果是首次加载页面，给个简单的淡入上滑效果
            mainContent.animate([
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 400, easing: 'ease-out' });
        }

        // 2. 拦截导航点击，执行退出动画
        const tabs = document.querySelectorAll(".tabs a.tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", (e) => {
                const targetHref = tab.getAttribute("href");
                const targetIndex = getPageIndex(targetHref);
                const currentIndex = getPageIndex(window.location.pathname);

                // 如果点击的是当前所在页，或者是不在列表里的非法页，直接放行
                if (targetIndex === currentIndex || targetIndex === -1) return;

                // 阻止浏览器默认的立即跳转
                e.preventDefault(); 

                // 判断目标页是在当前页的左侧还是右侧
                const isMovingForward = targetIndex > currentIndex;
                
                // 给当前页面添加对应的转盘退出动画
                mainContent.classList.add(isMovingForward ? "carousel-exit-left" : "carousel-exit-right");

                // 记录进入方向供下一个页面读取
                sessionStorage.setItem("polyCalc_transition_enter", isMovingForward ? "right" : "left");

                // 等待动画即将结束时跳转 (设定 350ms，比 CSS 的 400ms 略短一点防止闪烁)
                // 给当前页面添加对应的转盘退出动画
                mainContent.classList.add(isMovingForward ? "carousel-exit-left" : "carousel-exit-right");

                // 记录进入方向供下一个页面读取
                sessionStorage.setItem("polyCalc_transition_enter", isMovingForward ? "right" : "left");

                // 优化：等待动画几乎完全结束时再跳转 (将之前的 350 改为 380)
                // 留出 20ms 的缓冲期，防止浏览器强行回收重绘导致黑屏闪烁
                setTimeout(() => {
                    window.location.href = targetHref;
                }, 380);
            });
        });
    });
})();