# DSH Assistant Suite

A single DeepSeek Harness plugin combining the dsh-model-usage and dsh-reminding features.

- Adds a Usage control to conversation headers with balance and quota information for the selected model.
- Sends system notifications for approvals, model questions, completed turns, failures, and output truncation; clicking a reminder returns to its conversation.
- Registers a dedicated **Settings → Assistant Suite** page for system reminder controls, notification permission status, and notification testing.
- Lets you show or hide the conversation-header Usage button and choose which dialog sections appear, including balance and quota, query target, refresh controls, history, source details, manual refresh, and raw response access. Choices apply immediately and are saved locally.
- Preserves both features' localization namespaces and host routes behind one plugin row.

This is a local combined package and leaves both source plugin folders untouched. It has no runtime npm dependencies. Run npm test to build and verify the combined package.
