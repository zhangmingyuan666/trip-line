---
name: record-dev-lessons
description: Record reusable lessons from a development conversation, including the solved problem's target outcome, the implementation decisions that produced it, and detail-level mistakes to avoid next time. Use when the user asks Codex to remember, record, archive, summarize, or preserve development-process lessons, issue resolutions, debugging learnings, target effects, acceptance criteria, or avoidable mistakes from the current or recent coding conversation. Always require explicit user confirmation before writing or modifying any lesson file.
---

# Record Dev Lessons

## Overview

Capture development lessons as durable Markdown notes in a local directory. The record must preserve what the user wanted to achieve, what solved it, and which small mistakes or fragile details should be avoided in future work.

## Core Rules

- Do not write, append, rename, or delete lesson files until the user explicitly confirms the exact content and destination.
- Keep records factual and reusable. Prefer concrete outcomes, constraints, commands, file paths, symptoms, fixes, and gotchas over generic reflections.
- Do not include private secrets, tokens, credentials, API keys, personal data, or irrelevant chat transcript.
- Preserve uncertainty. If a point is inferred rather than directly observed, label it as an inference.
- Keep each lesson self-contained enough to be useful in a future unrelated conversation.

## Workflow

1. Identify the lesson scope from the conversation.
   - Capture the original user goal and the final target effect.
   - Capture the key fix or approach that made the task work.
   - Capture detail mistakes to avoid, especially naming, paths, command flags, environment assumptions, UI constraints, test gaps, and permission issues.

2. Choose a destination directory.
   - If the user names a directory, use it.
   - Otherwise propose `dev-lessons/` in the current workspace.
   - Create the directory only after confirmation.

3. Draft the record before writing.
   - Show the proposed file path.
   - Show the complete Markdown content that will be written.
   - Ask for explicit confirmation such as "确认写入", "yes", or "write it".

4. Write only after confirmation.
   - If the user requests edits to the draft, revise and ask for confirmation again.
   - If a file already exists, ask whether to append, overwrite, or create a new filename.
   - After writing, report the path and a short summary of what was recorded.

## File Naming

Use a readable Markdown filename:

```text
YYYY-MM-DD-short-topic.md
```

Use the current local date for `YYYY-MM-DD`. Keep `short-topic` lowercase, ASCII, hyphen-separated, and under 48 characters. If the topic is unclear, use `development-lesson`.

## Record Template

```markdown
# <Short Topic>

Date: YYYY-MM-DD
Source: development conversation

## Goal Effect

- <What the user wanted the final result to do or look like.>

## What Worked

- <The fix, design decision, workflow, command, or code pattern that solved it.>

## Avoid Next Time

- <Specific mistake, fragile assumption, or detail-level error to avoid.>

## Verification

- <How the result was checked, or what remains unverified.>

## Related Files Or Commands

- `<path-or-command>`
```

Omit a section only if it is genuinely not applicable. Keep entries short, but do not remove concrete details that would prevent a future agent from avoiding the same mistake.
