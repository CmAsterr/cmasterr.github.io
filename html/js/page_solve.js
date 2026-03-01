/* === js/page_solve.js ===
 * 一元方程求解页面控制器 - 支持四次及以下
 */
(function() {
    function boot() {
        if (!window.PolyCore || !window.UI) { setTimeout(boot, 50); return; }

        const EPS = 1e-9;

        const inputWidget = UI.initInputWidget({
            display: 'exprInDisplay',
            editBtn: 'exprInEditBtn', copyBtn: 'exprInCopyBtn',
            panel: 'exprInPanel', input: 'exprInInput',
            preview: 'exprInPreview', err: 'exprInErr',
            okBtn: 'exprInOkBtn', cancelBtn: 'exprInCancelBtn'
        }, (val) => {
            if (!val) return null;
            const res = parseEquation(val);
            return res.error || null;
        });

        const outputWidget = UI.initOutputWidget('eqOutDisplay', 'eqOutCopyBtn');
        const msgEl = document.getElementById('solveMsg');
        const solveBtn = document.getElementById('btnSolve');
        const resultBox = document.getElementById('solveResult');

        function setMsg(text) {
            if (msgEl) msgEl.textContent = text || "";
        }

        function showHint(text) {
            if (!resultBox) return;
            resultBox.innerHTML = `<div class="solve-hint">${text}</div>`;
        }

        function showError(text) {
            if (!resultBox) return;
            resultBox.innerHTML = `<div class="solve-error">${text}</div>`;
        }

        function showNoSolution() {
            if (!resultBox) return;
            const html = `<div class="solve-list"><div class="solve-line">${UI.renderMath("\\text{无解}")}</div></div>`;
            resultBox.innerHTML = html;
        }

        function showInfinite() {
            if (!resultBox) return;
            const html = `<div class="solve-list"><div class="solve-line">${UI.renderMath("\\text{任意实数都是解}")}</div></div>`;
            resultBox.innerHTML = html;
        }

        function formatVarName(name) {
            if (window.PolyCore && PolyCore.formatVarName) return PolyCore.formatVarName(name);
            return String(name || "x");
        }

        function showSolutions(roots, varName) {
            if (!resultBox) return;
            if (!roots.length) { showNoSolution(); return; }
            const v = formatVarName(varName);
            const vIndexed = "{" + v + "}";
            const summary = `\\text{共 } ${roots.length} \\text{ 个解}`;
            let html = `<div class="solve-summary">${UI.renderMath(summary)}</div>`;
            html += `<div class="solve-list">`;
            roots.forEach((r, i) => {
                const line = `${vIndexed}_{${i + 1}} = ${formatComplexLatex(r)}`;
                html += `<div class="solve-line">${UI.renderMath(line)}</div>`;
            });
            html += `</div>`;
            resultBox.innerHTML = html;
        }

        function saveState() {
            UI.Storage.save('solve', {
                expr: inputWidget.getExpr()
            });
        }

        function hasInvalidSymbol(s) {
            return /[<>≤≥≠]/.test(s);
        }

        function detectVarNames(expr) {
            if (!expr) return [];
            const tokens = PolyCore.tokenize(expr);
            const set = new Set();
            tokens.forEach(t => {
                if (t.type === "id") set.add(t.text);
            });
            return Array.from(set);
        }

        function parseEquation(expr) {
            const raw = String(expr || "").trim();
            if (!raw) return { empty: true };
            if (hasInvalidSymbol(raw)) return { error: "只支持等号方程，不能包含 < 或 > 等符号" };

            const parts = raw.split("=");
            if (parts.length > 2) return { error: "等式中不能出现多个等号" };

            let left = raw;
            let right = "0";
            if (parts.length === 2) {
                left = parts[0].trim();
                right = parts[1].trim();
                if (!left || !right) return { error: "等式两边不能为空" };
            }

            let vars = new Set();
            try {
                detectVarNames(left).forEach(v => vars.add(v));
                detectVarNames(right).forEach(v => vars.add(v));
            } catch (e) {
                return { error: "语法错误: " + e.message };
            }

            if (vars.size > 1) return { error: "只支持一元方程" };
            const varName = vars.size === 1 ? Array.from(vars)[0] : "x";

            let resL, resR;
            try {
                resL = PolyCore.parseStr(left);
                resR = PolyCore.parseStr(right);
            } catch (e) {
                return { error: "语法错误: " + e.message };
            }

            return { poly: PolyCore.sub(resL.poly, resR.poly), varName };
        }

        function cleanPoly(poly) {
            const cleaned = new Map();
            poly.forEach((c, e) => {
                if (Math.abs(c) > EPS) cleaned.set(e, c);
            });
            return cleaned;
        }

        function polyToDesc(poly) {
            let maxExp = -1;
            poly.forEach((c, e) => {
                if (Math.abs(c) > EPS && e > maxExp) maxExp = e;
            });
            if (maxExp < 0) return { degree: 0, coeffs: [0] };

            const asc = new Array(maxExp + 1).fill(0);
            poly.forEach((c, e) => {
                if (Math.abs(c) > EPS) asc[e] = c;
            });

            while (maxExp > 0 && Math.abs(asc[maxExp]) < EPS) maxExp--;

            const desc = [];
            for (let e = maxExp; e >= 0; e--) desc.push(asc[e] || 0);
            return { degree: maxExp, coeffs: desc };
        }

        function c(re, im) { return { re: re, im: im }; }
        function cFrom(z) { return (typeof z === "number") ? c(z, 0) : c(z.re, z.im); }
        function cAdd(a, b) { a = cFrom(a); b = cFrom(b); return c(a.re + b.re, a.im + b.im); }
        function cSub(a, b) { a = cFrom(a); b = cFrom(b); return c(a.re - b.re, a.im - b.im); }
        function cMul(a, b) {
            a = cFrom(a); b = cFrom(b);
            return c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
        }
        function cDiv(a, b) {
            a = cFrom(a); b = cFrom(b);
            const den = b.re * b.re + b.im * b.im;
            return c((a.re * b.re + a.im * b.im) / den, (a.im * b.re - a.re * b.im) / den);
        }
        function cNeg(a) { a = cFrom(a); return c(-a.re, -a.im); }
        function cAbs(a) { a = cFrom(a); return Math.hypot(a.re, a.im); }

        function cSqrt(z) {
            z = cFrom(z);
            if (cAbs(z) < EPS) return c(0, 0);
            const r = Math.hypot(z.re, z.im);
            const t = Math.atan2(z.im, z.re);
            const sr = Math.sqrt(r);
            return c(sr * Math.cos(t / 2), sr * Math.sin(t / 2));
        }

        function cCbrt(z) {
            z = cFrom(z);
            if (Math.abs(z.im) < 1e-12) return c(Math.cbrt(z.re), 0);
            const r = Math.hypot(z.re, z.im);
            const t = Math.atan2(z.im, z.re);
            const cr = Math.cbrt(r);
            return c(cr * Math.cos(t / 3), cr * Math.sin(t / 3));
        }

        function solveLinear(a, b) {
            if (Math.abs(a) < EPS) return [];
            return [c(-b / a, 0)];
        }

        function solveQuadraticComplex(a, b, c0) {
            const A = cFrom(a);
            const B = cFrom(b);
            const C = cFrom(c0);
            if (cAbs(A) < EPS) return solveLinear(B.re, C.re);

            const fourAC = cMul(c(4, 0), cMul(A, C));
            const disc = cSub(cMul(B, B), fourAC);
            const sqrtDisc = cSqrt(disc);
            const twoA = cMul(c(2, 0), A);
            const negB = cNeg(B);

            const r1 = cDiv(cAdd(negB, sqrtDisc), twoA);
            const r2 = cDiv(cSub(negB, sqrtDisc), twoA);
            return [r1, r2];
        }

        function solveCubic(a, b, c0, d) {
            if (Math.abs(a) < EPS) return solveQuadraticComplex(b, c0, d);

            const a1 = b / a;
            const a2 = c0 / a;
            const a3 = d / a;

            const p = a2 - (a1 * a1) / 3;
            const q = (2 * a1 * a1 * a1) / 27 - (a1 * a2) / 3 + a3;

            const halfQ = c(q / 2, 0);
            const thirdP = c(p / 3, 0);
            const delta = cAdd(cMul(halfQ, halfQ), cMul(cMul(thirdP, thirdP), thirdP));
            const sqrtDelta = cSqrt(delta);

            const u = cCbrt(cAdd(cNeg(halfQ), sqrtDelta));
            const v = cCbrt(cSub(cNeg(halfQ), sqrtDelta));

            const omega = c(-0.5, Math.sqrt(3) / 2);
            const omega2 = c(-0.5, -Math.sqrt(3) / 2);

            const y0 = cAdd(u, v);
            const y1 = cAdd(cMul(u, omega), cMul(v, omega2));
            const y2 = cAdd(cMul(u, omega2), cMul(v, omega));

            const shift = a1 / 3;
            return [
                cSub(y0, c(shift, 0)),
                cSub(y1, c(shift, 0)),
                cSub(y2, c(shift, 0))
            ];
        }

        function solveQuartic(a, b, c0, d, e) {
            if (Math.abs(a) < EPS) return solveCubic(b, c0, d, e);

            const A = b / a;
            const B = c0 / a;
            const C = d / a;
            const D = e / a;

            const p = B - (3 * A * A) / 8;
            const q = (A * A * A) / 8 - (A * B) / 2 + C;
            const r = (-3 * Math.pow(A, 4)) / 256 + (A * A * B) / 16 - (A * C) / 4 + D;

            if (Math.abs(q) < EPS) {
                const zRoots = solveQuadraticComplex(1, p, r);
                const roots = [];
                zRoots.forEach(z => {
                    const y = cSqrt(z);
                    roots.push(y, cNeg(y));
                });
                return roots.map(y => cSub(y, c(A / 4, 0)));
            }

            const cubicRoots = solveCubic(
                1,
                -p / 2,
                -r,
                (p * r) / 2 - (q * q) / 8
            );

            let z = null;
            let t = null;
            for (let i = 0; i < cubicRoots.length; i++) {
                const cand = cubicRoots[i];
                const tCand = cSqrt(cSub(cMul(c(2, 0), cand), c(p, 0)));
                if (cAbs(tCand) > EPS) {
                    z = cand;
                    t = tCand;
                    break;
                }
            }

            if (!z) {
                z = cubicRoots[0];
                t = cSqrt(cSub(cMul(c(2, 0), z), c(p, 0)));
                if (cAbs(t) < EPS) return solveCubic(b, c0, d, e);
            }

            const u = cNeg(cDiv(c(q, 0), cMul(c(2, 0), t)));

            const quad1 = solveQuadraticComplex(1, t, cAdd(z, u));
            const quad2 = solveQuadraticComplex(1, cNeg(t), cSub(z, u));
            const yRoots = quad1.concat(quad2);

            return yRoots.map(y => cSub(y, c(A / 4, 0)));
        }

        function normalizeComplex(z) {
            const re = Math.abs(z.re) < 1e-10 ? 0 : z.re;
            const im = Math.abs(z.im) < 1e-10 ? 0 : z.im;
            return c(re, im);
        }

        function dedupeRoots(roots) {
            const unique = [];
            roots.forEach(r => {
                const nr = normalizeComplex(r);
                const exists = unique.some(u => Math.abs(u.re - nr.re) < 1e-7 && Math.abs(u.im - nr.im) < 1e-7);
                if (!exists) unique.push(nr);
            });
            return unique;
        }

        function formatReal(n) {
            let v = Math.abs(n) < 1e-10 ? 0 : n;
            const rounded = Math.round(v);
            if (Math.abs(v - rounded) < 1e-8) return String(rounded);
            let s = v.toFixed(6);
            return s.replace(/\.?0+$/, "");
        }

        function formatComplexLatex(z) {
            const re = Math.abs(z.re) < 1e-10 ? 0 : z.re;
            const im = Math.abs(z.im) < 1e-10 ? 0 : z.im;

            if (Math.abs(im) < 1e-10) return formatReal(re);

            const reStr = formatReal(re);
            const imAbsStr = formatReal(Math.abs(im));
            const imPart = (imAbsStr === "1") ? "i" : imAbsStr + "\\,i";

            if (Math.abs(re) < 1e-10) return (im < 0 ? "-" : "") + imPart;
            return reStr + (im < 0 ? " - " : " + ") + imPart;
        }

        function solvePolynomial(coeffs) {
            const degree = coeffs.length - 1;
            if (degree === 1) return solveLinear(coeffs[0], coeffs[1]);
            if (degree === 2) return solveQuadraticComplex(coeffs[0], coeffs[1], coeffs[2]);
            if (degree === 3) return solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
            if (degree === 4) return solveQuartic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4]);
            return [];
        }

        function run(autoSave = true) {
            try {
                const expr = inputWidget.getExpr();

                if (!expr) {
                    outputWidget.set("");
                    showHint("等待解方程...");
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                const parsed = parseEquation(expr);
                if (parsed.error) {
                    outputWidget.set("");
                    showError(parsed.error);
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                const cleaned = cleanPoly(parsed.poly);
                const { degree, coeffs } = polyToDesc(cleaned);

                const stdLatex = PolyCore.toLatex(cleaned, parsed.varName, false);
                outputWidget.set(stdLatex + " = 0");

                if (degree > 4) {
                    showError("暂不支持五次及以上方程");
                    setMsg("");
                    if (autoSave) saveState();
                    return;
                }

                if (degree === 0) {
                    if (Math.abs(coeffs[0]) < EPS) showInfinite();
                    else showNoSolution();
                    setMsg("解方程完成");
                    if (autoSave) saveState();
                    return;
                }

                let roots = solvePolynomial(coeffs);
                roots = dedupeRoots(roots);
                roots.sort((a, b) => (a.re === b.re ? a.im - b.im : a.re - b.re));

                showSolutions(roots, parsed.varName);
                setMsg("");
                if (autoSave) saveState();
            } catch (e) {
                console.error(e);
                outputWidget.set("");
                showError("计算出错: " + e.message);
                setMsg("");
            }
        }

        if (solveBtn) solveBtn.onclick = () => run(true);

        const saved = UI.Storage.load('solve');
        if (saved) {
            inputWidget.setExpr(saved.expr || "");
            run(false);
        } else {
            inputWidget.setExpr("x^2-1=0");
            showHint("等待解方程...");
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
