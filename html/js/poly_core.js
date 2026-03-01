/* === js/poly_core.js ===
 * 多项式运算核心库 - 支持LaTeX错误格式
 */
(function() {
    const Core = {};

    function isDigit(c) { return /[0-9]/.test(c); }
    function isLetter(c) { return /[a-zA-Z]/.test(c); }
    function norm(n) { return Math.abs(n) < 1e-10 ? 0 : n; }

    function formatVarName(name) {
        const s = String(name || "x");
        const idx = s.indexOf("_");
        if (idx === -1) return s;
        const base = s.slice(0, idx) || "x";
        const sub = s.slice(idx + 1);
        if (!sub) return base;
        return base + "_{" + sub + "}";
    }
    Core.formatVarName = formatVarName;

    // --- 1. 分词 ---
    Core.tokenize = function(expr) {
        const s = (expr || "").replace(/\^\{([0-9]+)\}/g, "^$1");
        const tokens = [];
        let i = 0;
        while (i < s.length) {
            const c = s[i];
            if (/\s/.test(c)) { i++; continue; }
            if ("()+-*^".includes(c)) { tokens.push({ type: c, text: c }); i++; continue; }
            if (isDigit(c)) {
                let j = i; while (j < s.length && isDigit(s[j])) j++;
                tokens.push({ type: "num", text: s.slice(i, j) }); i = j; continue;
            }
            if (isLetter(c)) {
                let j = i; let id = "";
                while (j < s.length) {
                    const ch = s[j];
                    if (isLetter(ch) || isDigit(ch)) { id += ch; j++; continue; }
                    if (ch === '_') {
                        if (s[j + 1] === '{') {
                            let k = j + 2; let sub = "";
                            while (k < s.length && s[k] !== '}') { sub += s[k]; k++; }
                            if (k >= s.length) throw new Error("语法错误: 下标缺少 }");
                            if (!sub) throw new Error("语法错误: 下标不能为空");
                            id += "_" + sub; j = k + 1; continue;
                        }
                        id += "_"; j++; continue;
                    }
                    break;
                }
                tokens.push({ type: "id", text: id }); i = j; continue;
            }
            throw new Error("非法字符: " + c);
        }
        const out = [];
        for (let k = 0; k < tokens.length; k++) {
            out.push(tokens[k]);
            if (k + 1 < tokens.length) {
                const cur = tokens[k], nxt = tokens[k + 1];
                const endF = (cur.type === 'num' || cur.type === 'id' || cur.type === ')');
                const startF = (nxt.type === 'num' || nxt.type === 'id' || nxt.type === '(');
                if (endF && startF) out.push({ type: '*', text: '*' });
            }
        }
        return out;
    };

    // --- 2. 解析 ---
    Core.parse = function(tokens) {
        let p = 0;
        const peek = () => tokens[p];
        const eat = (type) => {
            const tk = peek();
            if (!tk || tk.type !== type) throw new Error("语法错误: 期望 " + type);
            p++; return tk;
        };
        const parseFactor = () => {
            const tk = peek();
            if (!tk) throw new Error("表达式意外结束");
            if (tk.type === 'num') { p++; return { type: 'num', val: parseInt(tk.text, 10) }; }
            if (tk.type === 'id') { p++; return { type: 'id', name: tk.text }; }
            if (tk.type === '(') { p++; const n = parseExpr(); eat(')'); return n; }
            if (tk.type === '-') { p++; return { type: 'neg', v: parseFactor() }; }
            throw new Error("未知符号: " + tk.text);
        };
        const parsePow = () => {
            let n = parseFactor();
            while (peek() && peek().type === '^') { p++; n = { type: '^', base: n, exp: parseInt(eat('num').text, 10) }; }
            return n;
        };
        const parseTerm = () => {
            let n = parsePow();
            while (peek() && peek().type === '*') { p++; n = { type: '*', left: n, right: parsePow() }; }
            return n;
        };
        const parseExpr = () => {
            let n = parseTerm();
            while (peek() && (peek().type === '+' || peek().type === '-')) {
                const op = peek().type; p++; n = { type: op, left: n, right: parseTerm() };
            }
            return n;
        };
        const root = parseExpr();
        if (p < tokens.length) throw new Error("存在未解析字符");
        return root;
    };

    // --- 3. 运算 ---
    Core.PolyConst = (v) => { const m = new Map(); if (norm(v) !== 0) m.set(0, norm(v)); return m; };
    Core.PolyVar = () => { const m = new Map(); m.set(1, 1); return m; };
    Core.addTerm = function(map, exp, coef) {
        const old = map.get(exp) || 0; const val = norm(old + coef);
        if (val === 0) map.delete(exp); else map.set(exp, val);
    };
    Core.add = function(A, B) { const R = new Map(A); B.forEach((c, e) => Core.addTerm(R, e, c)); return R; };
    Core.sub = function(A, B) { const R = new Map(A); B.forEach((c, e) => Core.addTerm(R, e, -c)); return R; };
    Core.mul = function(A, B) { const R = new Map(); A.forEach((c1, e1) => { B.forEach((c2, e2) => Core.addTerm(R, e1 + e2, c1 * c2)); }); return R; };
    Core.pow = function(Base, exp) {
        if (!Number.isInteger(exp) || exp < 0) throw new Error("仅支持非负整数幂");
        let R = Core.PolyConst(1); for (let i = 0; i < exp; i++) R = Core.mul(R, Base); return R;
    };
    Core.evalAst = function(node) {
        if (node.type === 'num') return Core.PolyConst(node.val);
        if (node.type === 'id') return Core.PolyVar();
        if (node.type === 'neg') { const R = new Map(); Core.evalAst(node.v).forEach((c, e) => Core.addTerm(R, e, -c)); return R; }
        const L = node.left ? Core.evalAst(node.left) : null;
        const R = node.right ? Core.evalAst(node.right) : null;
        if (node.type === '+') return Core.add(L, R);
        if (node.type === '-') return Core.sub(L, R);
        if (node.type === '*') return Core.mul(L, R);
        if (node.type === '^') return Core.pow(Core.evalAst(node.base), node.exp);
        return Core.PolyConst(0);
    };

    // --- 4. 接口 (带 LaTeX 报错) ---
    Core.parseStr = function(exprStr) {
        if (!exprStr || !exprStr.trim()) return { poly: new Map(), varName: "x" };

        const tokens = Core.tokenize(exprStr);
        const uniqueVars = new Set();
        let detectedVar = "x";
        
        for (let t of tokens) {
            if (t.type === 'id') {
                uniqueVars.add(t.text);
                detectedVar = t.text;
            }
        }
        
        if (uniqueVars.size > 1) {
            const varsList = Array.from(uniqueVars)
                .map(v => formatVarName(v)) // 格式化为 LaTeX 形式
                .join(", ");
            // 抛出带有特定前缀的错误信息
            throw new Error(`LATEX_ERROR:检测到多个变量: $${varsList}$，目前仅支持一元多项式`);
        }
        
        if (uniqueVars.size === 1) detectedVar = uniqueVars.values().next().value;

        const ast = Core.parse(tokens);
        const poly = Core.evalAst(ast);
        return { poly: poly, varName: detectedVar };
    };

    // --- 稀疏多项式判定逻辑 ---
    Core.analyzeSparse = function(poly, thresholdPct) {
        // 获取所有非零项的指数
        const exps = Array.from(poly.keys());
        
        // 实际非零项数
        const actual = exps.length;
        
        // 找出最高次幂（如果没有任何项，则最高次幂为0）
        const maxExp = actual > 0 ? Math.max(...exps) : 0;
        
        // 理论总项数 (最高次幂 + 1，例如 x^2 有 x^2, x^1, x^0 共3项)
        const theoretical = maxExp + 1;
        
        // 占比 (实际项数 / 理论项数)
        const ratio = actual / theoretical;
        
        // 判定是否为稀疏多项式
        const sparse = (ratio * 100) <= thresholdPct;

        return {
            actual: actual,
            exps: exps,
            maxExp: maxExp,
            theoretical: theoretical,
            ratio: ratio,
            sparse: sparse
        };
    };

    Core.toLatex = function(poly, varName, isAscending) {
        const terms = [];
        poly.forEach((c, e) => terms.push({ c, e }));
        terms.sort((a, b) => isAscending ? a.e - b.e : b.e - a.e);
        if (!terms.length) return "0";
        const v = formatVarName(varName || "x");
        let s = "";
        terms.forEach((t, i) => {
            const abs = Math.abs(t.c);
            const sign = t.c < 0 ? "-" : "+";
            let part = "";
            let coefStr = String(abs);
            if (abs === 1 && t.e !== 0) coefStr = ""; 
            if (t.e === 0) part = String(abs);
            else if (t.e === 1) part = coefStr + v;
            else part = coefStr + v + "^{" + t.e + "}";
            if (i === 0) s += (t.c < 0 ? "-" : "") + part;
            else s += sign + part; 
        });
        return s;
    };

    window.PolyCore = Core;
})();
