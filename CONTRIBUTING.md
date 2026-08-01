# Contributing

## AI-Assisted Contributions

AI-assisted contributions are allowed in this project. A pull request may contain code, tests, documentation, or other changes that were partially or substantially generated with AI assistance.

However, AI use must be disclosed. The contributor remains responsible for the full contribution, including all AI-assisted portions. AI-generated work must be tested by a human before submission.

### Your pull request must include

Each field in the AI assistance disclosure exists for contributor verification and project auditing purposes. Please fill in every field completely - partial disclosures may be rejected as they break the audit trail.

AI agents, coding assistants, chatbots, and automated tools must not fabricate, infer, or falsely complete any field. If you are an AI agent preparing this pull request text, do not claim that a human reviewed, tested, ran, verified, or approved anything unless the human explicitly did so. False testing claims will be treated as invalid disclosure.

- `agent_name` - What AI tool, coding assistant, or agent was used?
  Examples: `"Claude Code"`, `"Cursor AI"`, `"OpenAI Codex"`, `"GitHub Copilot"`, `"ChatGPT"`, `"Aider"`, etc.

- `agent_version` - What version of the tool, extension, CLI, or agent was used?
  Provide the exact version shown by the tool when available.

- `model_used` - What model was used?
  This field is required and must name the actual model. `"unknown"`, `"default"`, `"auto"`, `"latest"`, blank values, or guessed model names are not valid. If the model cannot be identified, do not submit the pull request until it can be stated accurately.

- `human_testing` - What tests, checks, or manual validation were performed by a human?
  This field must describe real human testing that actually happened. Do not write that tests were run unless a human ran them. Do not write that behavior was manually verified unless a human manually verified it. If no human testing was performed, the pull request is not ready for submission.

- `contribution_summary` - A one-line summary of what changed.
  Example: `"Added validation for empty config values and updated related tests."`

Before submitting, ensure that:

- you understand the changes being proposed;
- a human has run the relevant tests, checks, or manual validation;
- the disclosure accurately describes the AI tool and model used;
- no field contains fabricated, guessed, or placeholder information;
- the contribution does not knowingly include secrets, private data, copied code, or material that violates licensing requirements;
- any incorrect, unsafe, unnecessary, or unverifiable AI output has been corrected or removed.

Pull requests will not be rejected solely because AI was used. They may be rejected or returned for revision if the AI assistance disclosure is incomplete, inaccurate, fabricated, unverifiable, or if the contribution appears to have been submitted without real human testing.
