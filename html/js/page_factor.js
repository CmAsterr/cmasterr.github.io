/* === js/page_factor.js ===
 * 因式分解页面控制器 - 支持四次及以下
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
            try { PolyCore.parseStr(val); return null; } catch (e) { return e.message; }
        });

        const factorOut = UI.initOutputWidget('factorOutDisplay', 'factorOutCopyBtn');
        const stepsBox = document.getElementById('factorSteps');
        const msgEl = document.getElementById('factorMsg');
        const factorBtn = document.getElementById('btnFactor');
        const domainBtns = document.querySelectorAll('.domain-btn');

        let currentDomain = 'int';

        function setMsg(text) {
            if (msgEl) msgEl.textContent = text || "";
        }

        function formatVarName(name) {
            if (window.PolyCore && PolyCore.formatVarName) return PolyCore.formatVarName(name);
            return String(name || "x");
        }

        function renderSteps(lines) {
            if (!stepsBox) return;
            if (!lines || !lines.length) {
                stepsBox.innerHTML = '<div style="color:#94a3b8;font-style:italic;padding:10px 0;">等待分解...</div>';
                return;
            }
            stepsBox.innerHTML = lines.map(l => `<div>${UI.renderMath(l)}</div>`).join("");
        }

        function updateDomainUI() {
            domainBtns.forEach(btn => {
                if (btn.dataset.domain === currentDomain) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        function gcd(a, b) {
            a = Math.abs(a); b = Math.abs(b);
            while (b) { const t = a % b; a = b; b = t; }
            return a;
        }

        function frac(n, d) {
            if (d === 0) return { n: NaN, d: 0 };
            if (d < 0) { n = -n; d = -d; }
            const g = gcd(n, d);
            return { n: n / g, d: d / g };
        }

        function add(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
        function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
        function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }
        function divf(a, b) { return frac(a.n * b.d, a.d * b.n); }

        function isZeroFrac(a) { return Math.abs(a.n) < EPS; }

        function toFracArray(intCoeffs) {
            return intCoeffs.map(c => frac(c, 1));
        }

        function divs(n) {
            n = Math.abs(n);
            if (n === 0) return [0];
            const res = [];
            for (let i = 1; i * i <= n; i++) {
                if (n % i === 0) {
                    res.push(i);
                    if (i * i !== n) res.push(n / i);
                }
            }
            return res;
        }

        function rationalCandidates(a0, an) {
            if (a0 === 0) return [frac(0, 1)];
            const pList = divs(a0);
            const qList = divs(an);
            const set = new Map();

            for (let p of pList) {
                for (let q of qList) {
                    if (q === 0) continue;
                    const f1 = frac(p, q);
                    const f2 = frac(-p, q);
                    set.set(f1.n + "/" + f1.d, f1);
                    set.set(f2.n + "/" + f2.d, f2);
                }
            }
            return Array.from(set.values());
        }

        function syntheticDivide(coeffs, root) {
            const n = coeffs.length - 1;
            const b = new Array(n + 1);
            b[0] = coeffs[0];
            for (let i = 1; i <= n; i++) {
                b[i] = add(coeffs[i], mul(b[i - 1], root));
            }
            return { quotient: b.slice(0, n), remainder: b[n] };
        }

        function polyToIntDesc(poly) {
            let maxExp = -1;
            poly.forEach((c, e) => { if (Math.abs(c) > EPS && e > maxExp) maxExp = e; });
            if (maxExp < 0) return [0];

            const deg = maxExp;
            const coeffs = new Array(deg + 1).fill(0);
            poly.forEach((c, e) => { coeffs[deg - e] = c; });
            return coeffs;
        }

        function formatFrac(a) {
            if (a.d === 1) return String(a.n);
            return "\\frac{" + a.n + "}{" + a.d + "}";
        }

        function formatNumber(n) {
            let v = Math.abs(n) < 1e-10 ? 0 : n;
            const rounded = Math.round(v);
            if (Math.abs(v - rounded) < 1e-8) return String(rounded);
            let s = v.toFixed(6);
            return s.replace(/\.?0+$/, "");
        }

        function polyFracToLatex(coeffs, varLatex) {
            const deg = coeffs.length - 1;
            let s = "";
            for (let i = 0; i <= deg; i++) {
                const c = coeffs[i];
                if (isZeroFrac(c)) continue;
                const sign = c.n < 0 ? "-" : "+";
                const abs = frac(Math.abs(c.n), c.d);
                let coefStr = formatFrac(abs);
                const exp = deg - i;
                if (exp > 0 && abs.n === abs.d) coefStr = "";
                let part = "";
                if (exp === 0) part = formatFrac(abs);
                else if (exp === 1) part = coefStr + varLatex;
                else part = coefStr + varLatex + "^{" + exp + "}";
                if (!s) s = (c.n < 0 ? "-" : "") + part;
                else s += sign + part;
            }
            return s || "0";
        }

        function linearFactorLatex(varLatex, root) {
            if (root.d === 1 && root.n === 0) return varLatex;
            const r = formatFrac({ n: root.n, d: root.d });
            if (root.n < 0) return varLatex + " + " + formatFrac({ n: Math.abs(root.n), d: root.d });
            return varLatex + " - " + r;
        }

        function factorOverRationals(intCoeffs, domain) {
            let coeffs = toFracArray(intCoeffs);
            const roots = [];
            let degree = coeffs.length - 1;

            while (degree > 0) {
                const a0 = coeffs[coeffs.length - 1].n;
                const an = coeffs[0].n;

                if (a0 === 0) {
                    const root = frac(0, 1);
                    roots.push(root);
                    coeffs = coeffs.slice(0, -1);
                    degree--;
                    continue;
                }

                const candidates = (domain === "int")
                    ? divs(a0).map(d => frac(d, 1)).concat(divs(a0).map(d => frac(-d, 1)))
                    : rationalCandidates(a0, an);

                let found = false;
                for (let r of candidates) {
                    const res = syntheticDivide(coeffs, r);
                    if (isZeroFrac(res.remainder)) {
                        roots.push(r);
                        coeffs = res.quotient;
                        degree--;
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }

            return { roots, rest: coeffs };
        }

        // --- 数值求根（无理数/复数） ---
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

        function dedupeRoots(roots) {
            const unique = [];
            roots.forEach(r => {
                const exists = unique.some(u => Math.abs(u.re - r.re) < 1e-7 && Math.abs(u.im - r.im) < 1e-7);
                if (!exists) unique.push(r);
            });
            return unique;
        }

        function solveAllRoots(coeffs) {
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
                    factorOut.set("");
                    renderSteps([]);
                    setMsg("");
                    return;
                }

                const parsed = PolyCore.parseStr(expr);
                const poly = parsed.poly;
                const varName = parsed.varName || "x";

                const coeffs = polyToIntDesc(poly);
                const degree = coeffs.length - 1;

                if (degree > 4) {
                    factorOut.set("\\textcolor{red}{\\text{暂不支持五次及以上}}");
                    renderSteps([`\\text{原式：}${PolyCore.toLatex(poly, varName, false)}`]);
                    setMsg("");
                    return;
                }

                const allInt = coeffs.every(c => Math.abs(c - Math.round(c)) < EPS);
                if (!allInt) {
                    factorOut.set("\\textcolor{red}{\\text{只支持整数系数}}");
                    renderSteps([`\\text{原式：}${PolyCore.toLatex(poly, varName, false)}`]);
                    setMsg("");
                    return;
                }

                const v = formatVarName(varName);
                const steps = [];
                steps.push(`\\text{原式：} ${PolyCore.toLatex(poly, varName, false)}`);
                steps.push(`\\text{数域：}${currentDomain === "int" ? "整数" : (currentDomain === "rat" ? "有理数" : "无理数")}`);

                let factorLatex = "";
                if (currentDomain === "irr") {
                    const roots = dedupeRoots(solveAllRoots(coeffs));
                    const realRoots = [];
                    const complexRoots = [];

                    roots.forEach(r => {
                        if (Math.abs(r.im) < 1e-8) realRoots.push(r);
                        else if (r.im > 0) complexRoots.push(r);
                    });

                    const rootList = roots.map(r => {
                        if (Math.abs(r.im) < 1e-8) return formatNumber(r.re);
                        return formatNumber(r.re) + (r.im < 0 ? " - " : " + ") + formatNumber(Math.abs(r.im)) + "i";
                    });
                    steps.push(`\\text{数值根：}${rootList.join(", ")}`);

                    const factors = [];
                    realRoots.forEach(r => {
                        const rr = formatNumber(r.re);
                        if (Math.abs(r.re) < 1e-8) factors.push(v);
                        else if (r.re < 0) factors.push(v + " + " + formatNumber(Math.abs(r.re)));
                        else factors.push(v + " - " + rr);
                    });

                    complexRoots.forEach(r => {
                        const a = r.re;
                        const b = r.im;
                        const a2 = formatNumber(-2 * a);
                        const c0 = formatNumber(a * a + b * b);
                        let quad = v + "^2";
                        if (a2 === "0") quad += "";
                        else if (a2.startsWith("-")) quad += " - " + formatNumber(Math.abs(-2 * a)) + v;
                        else quad += " + " + a2 + v;
                        quad += " + " + c0;
                        factors.push(quad);
                    });

                    factorLatex = factors.length ? factors.map(f => "(" + f + ")").join("\\cdot") : PolyCore.toLatex(poly, varName, false);
                } else {
                    const res = factorOverRationals(coeffs, currentDomain);
                    const roots = res.roots;
                    const rest = res.rest;

                    if (roots.length) {
                        const rootList = roots.map(r => formatFrac(r));
                        steps.push(`\\text{找到的根：}${rootList.join(", ")}`);
                    } else {
                        steps.push("\\text{未找到可分解的有理根}");
                    }

                    const factors = [];
                    roots.forEach(r => {
                        factors.push("(" + linearFactorLatex(v, r) + ")");
                    });

                    if (rest.length > 1) {
                        const restLatex = polyFracToLatex(rest, v);
                        factors.push("(" + restLatex + ")");
                    }

                    factorLatex = factors.length ? factors.join("\\cdot") : PolyCore.toLatex(poly, varName, false);
                }

                factorOut.set(factorLatex);
                steps.push(`\\text{因式分解：} ${factorLatex}`);
                renderSteps(steps);
                setMsg("");
            } catch (e) {
                console.error(e);
                factorOut.set("\\textcolor{red}{\\text{计算出错}}");
                renderSteps([`\\text{错误：}${e.message}`]);
                setMsg("");
            }
        }

        domainBtns.forEach(btn => {
            btn.onclick = () => {
                currentDomain = btn.dataset.domain;
                updateDomainUI();
            };
        });

        if (factorBtn) factorBtn.onclick = () => run(true);

        updateDomainUI();
        inputWidget.setExpr("x^4-5x^2+4");
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
