#!/usr/bin/env node
/**
 * Documentation link checker for wecms-web.
 *
 *   node scripts/check-doc-links.mjs              # repo-aware (default)
 *   node scripts/check-doc-links.mjs --standalone # treat out-of-repo trees as absent
 *   node scripts/check-doc-links.mjs --detail     # list every finding
 *   node scripts/check-doc-links.mjs --json       # machine-readable summary
 *
 * Exit code is 1 when a link that *should* resolve does not, else 0. Out-of-repo
 * links are reported as a dependency count, never as a failure — see the tier
 * model in docs/references/README.md § Out-of-repo links.
 *
 * Zero dependencies — plain Node (>=22, matching package.json engines).
 *
 * WHY THIS EXISTS
 * ---------------
 * The docs tree carries ~3.6k links across ~450 files and needed three
 * remediation passes (P0 factual, P1 structural, P2 maintainability) to reach
 * zero broken in-repo links. This script makes that state cheap to re-verify so
 * a fourth pass is not needed. Nothing in CI runs it — see
 * docs/testing/testing-strategy.md § What does not exist — so run it by hand
 * after editing docs.
 *
 * CORRECTNESS NOTES (these are the cases naive checkers get wrong)
 *  - Balanced parentheses in destinations: `app/(dashboard)/banking/` must not
 *    terminate the destination at the first `)`.
 *  - Fenced code blocks (``` and ~~~, any fence length) are masked, so example
 *    links inside them are not treated as real links.
 *  - Inline code spans are masked for the same reason.
 *  - Angle-bracket destinations `[x](<a b>)` are supported.
 *  - Optional link titles `[x](dest "Title")` are stripped.
 *  - Nested brackets in link text `[![img](a)](b)` are handled.
 *  - Anchors and query strings are stripped before resolution; anchor *targets*
 *    are not verified (heading slugs are renderer-specific).
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const MODE = argv.includes("--standalone") ? "standalone" : "repo";
const DETAIL = argv.includes("--detail");
const JSON_OUT = argv.includes("--json");

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT = path.resolve(ROOT, "..");
const SIBLING_API = path.join(PARENT, "wecms-api");

/** Directories and root files that carry documentation links. */
const SCAN_DIRS = ["docs", ".claude", ".agents"];
const SCAN_FILES = ["README.md", "CLAUDE.md", "AGENTS.md"];

/** Destinations that must never appear — machine-local or editor-internal. */
const UNSAFE = [
    { kind: "vscode-webview://", re: /^vscode-webview:\/\//i },
    { kind: "file://", re: /^file:\/\//i },
    { kind: "windows-absolute", re: /^[a-zA-Z]:[\\/]/ },
    { kind: "unix-home-absolute", re: /^\/(home|Users)\// },
];

function walk(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (/\.md$/i.test(e.name)) acc.push(p);
    }
    return acc;
}

/** Blank out fenced code blocks and inline code spans, preserving line numbers. */
function maskCode(text) {
    const out = [];
    let fence = null;
    for (const line of text.split("\n")) {
        const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
        if (fence) {
            out.push("");
            if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
            continue;
        }
        if (m) {
            fence = m[1];
            out.push("");
            continue;
        }
        out.push(line.replace(/`[^`]*`/g, (s) => " ".repeat(s.length)));
    }
    return out.join("\n");
}

/** Extract inline links, honouring balanced parens and nested brackets. */
function extractLinks(text) {
    const found = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const open = text.indexOf("[", i);
        if (open === -1) break;
        if (open > 0 && text[open - 1] === "\\") { i = open + 1; continue; }

        let depth = 1;
        let j = open + 1;
        while (j < n && depth > 0) {
            if (text[j] === "\\") { j += 2; continue; }
            if (text[j] === "[") depth++;
            else if (text[j] === "]") depth--;
            j++;
        }
        if (depth !== 0) { i = open + 1; continue; }
        const closeBracket = j - 1;
        if (text[j] !== "(") { i = closeBracket + 1; continue; }

        let k = j + 1;
        // `dest` is the CommonMark-unescaped destination used for path
        // resolution. `raw` keeps the bytes as authored, backslashes included.
        // Both are needed: a Windows path like `C:\Users\me\doc.md` unescapes to
        // `C:Usersmedoc.md`, which no longer matches the unsafe-path patterns —
        // so the unsafe check runs against `raw` while resolution uses `dest`.
        let dest = "";
        let raw = "";
        if (text[k] === "<") {
            const end = text.indexOf(">", k);
            if (end === -1) { i = closeBracket + 1; continue; }
            dest = text.slice(k + 1, end);
            raw = dest;
            k = end + 1;
            while (k < n && text[k] !== ")") k++;
        } else {
            let pdepth = 1;
            while (k < n && pdepth > 0) {
                const c = text[k];
                if (c === "\\") {
                    dest += text[k + 1] ?? "";
                    raw += c + (text[k + 1] ?? "");
                    k += 2;
                    continue;
                }
                if (c === "\n") break;
                if (c === "(") { pdepth++; dest += c; raw += c; }
                else if (c === ")") { pdepth--; if (pdepth > 0) { dest += c; raw += c; } }
                else { dest += c; raw += c; }
                k++;
            }
            if (pdepth !== 0) { i = closeBracket + 1; continue; }
        }

        dest = dest.trim();
        raw = raw.trim();
        const titled = dest.match(/^(\S+)\s+["'(].*$/s);
        if (titled) dest = titled[1];
        const titledRaw = raw.match(/^(\S+)\s+["'(].*$/s);
        if (titledRaw) raw = titledRaw[1];

        found.push({ dest, raw, line: text.slice(0, open).split("\n").length });
        i = k;
    }
    return found;
}

// ── collect files ────────────────────────────────────────────────────────────
const files = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
for (const f of SCAN_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
}

const res = {
    filesScanned: files.length,
    totalLinks: 0,
    inRepoLinks: 0,
    inRepoBroken: [],
    siblingApiLinks: [],
    workspaceLinks: [],
    outOfRepoBroken: [],
    unsafe: [],
};

for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll("\\", "/");
    const links = extractLinks(maskCode(fs.readFileSync(file, "utf8")));
    const dir = path.dirname(file);

    for (const { dest, raw, line } of links) {
        if (!dest) continue;
        res.totalLinks++;

        // Check BOTH forms: `raw` catches backslash Windows paths that
        // CommonMark unescaping would otherwise flatten (`C:\Users\x` →
        // `C:Usersx`); `dest` catches everything else. Report the raw text so
        // the finding matches what is actually written in the file.
        const bad = UNSAFE.find((u) => u.re.test(raw) || u.re.test(dest));
        if (bad) { res.unsafe.push({ rel, line, dest: raw || dest, kind: bad.kind }); continue; }

        if (/^[a-z][a-z0-9+.-]*:/i.test(dest)) continue;   // http(s):, mailto:, …
        if (dest.startsWith("#") || dest.startsWith("//")) continue;

        const target = decodeURIComponent(dest.split("#")[0].split("?")[0]);
        if (!target) continue;

        const abs = path.resolve(dir, target);
        const inRepo = abs === ROOT || abs.startsWith(ROOT + path.sep);
        const entry = { rel, line, dest };

        if (inRepo) {
            res.inRepoLinks++;
            if (!fs.existsSync(abs)) res.inRepoBroken.push(entry);
            continue;
        }

        // Out-of-repo: classify by tier.
        const isApi = abs === SIBLING_API || abs.startsWith(SIBLING_API + path.sep);
        (isApi ? res.siblingApiLinks : res.workspaceLinks).push(entry);

        // In repo-aware mode the other trees are expected to be present, so an
        // out-of-repo link that does not resolve is a genuine finding.
        if (MODE === "repo" && !fs.existsSync(abs)) {
            res.outOfRepoBroken.push({ ...entry, tier: isApi ? "sibling-wecms-api" : "workspace" });
        }
    }
}

const summary = {
    mode: MODE,
    filesScanned: res.filesScanned,
    totalLinks: res.totalLinks,
    inRepoLinks: res.inRepoLinks,
    inRepoBroken: res.inRepoBroken.length,
    outOfRepoLinks: res.siblingApiLinks.length + res.workspaceLinks.length,
    siblingApiLinks: res.siblingApiLinks.length,
    siblingApiFiles: new Set(res.siblingApiLinks.map((x) => x.rel)).size,
    workspaceLinks: res.workspaceLinks.length,
    workspaceFiles: new Set(res.workspaceLinks.map((x) => x.rel)).size,
    outOfRepoBroken: MODE === "repo" ? res.outOfRepoBroken.length : null,
    unsafeLinks: res.unsafe.length,
};

if (JSON_OUT) {
    console.log(JSON.stringify(summary, null, 2));
} else {
    const L = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v}`);
    console.log(`\nwecms-web documentation link check  [mode: ${MODE}]\n`);
    L("Markdown files scanned", summary.filesScanned);
    L("Links examined", summary.totalLinks);
    console.log("");
    L("In-repo links", summary.inRepoLinks);
    L("In-repo BROKEN", summary.inRepoBroken);
    console.log("");
    L("Out-of-repo (dependency)", summary.outOfRepoLinks);
    L("  → sibling ../wecms-api/", `${summary.siblingApiLinks} in ${summary.siblingApiFiles} files`);
    L("  → workspace root", `${summary.workspaceLinks} in ${summary.workspaceFiles} files`);
    if (MODE === "repo") L("Out-of-repo BROKEN", summary.outOfRepoBroken);
    else console.log("  (standalone mode: out-of-repo links are not resolved — expected)");
    console.log("");
    L("Unsafe links", summary.unsafeLinks);
    console.log("");
}

if (DETAIL) {
    const dump = (title, rows, fmt = (r) => r.dest) => {
        if (!rows.length) return;
        console.log(`--- ${title} (${rows.length}) ---`);
        for (const r of rows) console.log(`${r.rel}:${r.line}  ${fmt(r)}`);
        console.log("");
    };
    dump("IN-REPO BROKEN", res.inRepoBroken);
    dump("OUT-OF-REPO BROKEN", res.outOfRepoBroken, (r) => `[${r.tier}] ${r.dest}`);
    dump("UNSAFE", res.unsafe, (r) => `[${r.kind}] ${r.dest}`);
}

const failures = res.inRepoBroken.length + res.unsafe.length
    + (MODE === "repo" ? res.outOfRepoBroken.length : 0);

if (failures > 0) {
    if (!DETAIL) console.log("Re-run with --detail to list findings.\n");
    process.exit(1);
}
