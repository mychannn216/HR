# Global Coding Rules — Evidence First, Minimal Changes

## 1. Understand Before Editing

* Inspect relevant source files, project configuration, dependencies, and existing patterns before making changes.
* Check `git status` and preserve all pre-existing user changes. Never discard or overwrite unrelated work.
* Do not assume the framework, library version, architecture, or intended behavior. Verify them from the actual repository.
* For non-trivial tasks, provide a brief implementation plan before editing.

## 2. Debug Root Causes, Not Symptoms

* For bug fixes, trace the actual execution path and data flow before changing code.
* Identify the root cause using concrete evidence: source code, error messages, stack traces, reproduction steps, or failing tests.
* Distinguish verified facts from hypotheses. If the root cause is uncertain, investigate further instead of presenting a guess as fact.
* Do not make speculative changes across multiple unrelated components in the hope that the bug disappears.
* Fix the underlying cause, not merely the visible symptom.

## 3. Minimize the Blast Radius

* Make the smallest change that fully solves the requested problem.
* Modify only relevant files and preserve existing APIs, behavior, architecture, and conventions unless a change is necessary.
* Do not perform unrelated refactoring, redesign components, rename public interfaces, or reorganize folders without a clear reason.
* Do not introduce dependencies or change framework versions without justification and explicit approval.
* Never disable tests, lint rules, type checks, or error handling merely to make a change pass.
* Never run destructive Git commands or overwrite user work without explicit approval.
* Before deleting any unused files or code, always archive them into `backup_unused_files.zip` first.

## 4. Follow Existing Project Conventions

* Treat the repository's source code, configuration, and established patterns as the primary source of truth.
* Reuse existing utilities, components, hooks, design tokens, and abstractions when appropriate.
* Avoid duplicating functionality or introducing a new abstraction for a one-off problem.
* Do not invent nonexistent functions, exports, package scripts, environment variables, or APIs. Verify that they exist before using them.

## 5. Verify Every Meaningful Change

* After editing, inspect the diff for accidental changes, regressions, unused imports, incorrect assumptions, and unnecessary complexity.
* Run the most relevant available checks, prioritizing targeted tests, type checking, linting, and builds as appropriate.
* When a check fails, investigate whether the failure is caused by the change. Do not silently ignore it.
* If verification is blocked or cannot be performed, clearly state what was not verified.
* Never claim that tests, builds, or browser checks passed unless they were actually executed and passed.

## 6. Protect Existing Behavior

* Consider downstream consumers, shared components, state transitions, API contracts, and edge cases before modifying code.
* Do not replace real data or error handling with mocks, hardcoded values, empty fallbacks, or fake success states unless explicitly requested.
* Avoid unrelated cleanup and speculative improvements during bug fixes.

## 7. Final Response

After completing a task, report:

1. Root cause or implementation rationale.
2. Files and behaviors changed.
3. Verification commands executed and their actual results.
4. Remaining risks, failed checks, or unverified behavior.

Be concise, evidence-based, and honest. A smaller verified fix is better than a broad unverified rewrite.
