# Security

Do not publish recordings, credentials, private URLs or client information in issues. Report security concerns privately to the repository owner using an established private channel.

SkillForge uses an isolated/sandboxed renderer with a narrow preload API, denies navigation and new windows, validates IPC senders and confines session identifiers. Model traffic is text-only and fixed to the local Ollama endpoint with redirects disabled. Imported data is normalized; renderer content is created with text nodes, not HTML injection. Export never executes a workflow or overwrites an existing skill folder.

Local files are not encrypted. Pattern-based text scanning cannot guarantee removal of secrets or PII. Video/audio are unredacted. No protection against a compromised OS, malicious local model server or unrestricted local filesystem access is claimed. Treat model responses and recorded content as untrusted drafts.
