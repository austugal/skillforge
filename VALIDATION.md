# Validation boundaries

Automated tests cover workflow validation/export, common text redaction, URL scrubbing, stable evidence links, revision storage, file path confinement and bounded/validated local-model responses. Renderer tests use the actual Electron application with temporary storage and mocked file dialogs; extension tests use a mock Chrome API. Neither replaces a native desktop/browser acceptance test.

## Verified in the build environment

- 14 automated domain and extension tests passed.
- JavaScript syntax checks passed.
- Electron UI integration passed using isolated temporary storage and mocked OS dialogs: authoring, review, exact export content, approval invalidation, untrusted text rendering and layout at 1,000 px width.
- Synthetic video through the real MediaRecorder and IPC file path passed start, pause/resume and WebM disk storage. This does not prove native screen or microphone capture.
- Production dependency audit reported zero vulnerabilities. Build tools have their own transitive dependencies.

## Version 0.2 sandbox results

- Actual Electron video decoding from the synthetic recording, frame extraction, JPEG persistence, default-off image consent, SRT import and editor/export integration passed.
- Vision-request tests verify approved-image inclusion, evidence IDs, invalid-response handling, traversal rejection and the 12-frame limit using controlled model responses.
- No live Ollama vision model was run. These tests prove request/data handling, not semantic model accuracy.
- Native Windows capture and microphone tests remain pending.

## Native acceptance checklist (pending)

Record the OS, CPU architecture, app version and actual result for each check. Do not label this complete based on CI unit tests.

- [ ] Windows 11 x64: clean `npm ci`, app launch and source enumeration.
- [ ] Choose the intended window; confirm the recording contains it and no other source.
- [ ] Record 20 seconds with optional microphone; verify WebM video/audio playback.
- [ ] Pause, perform a private action, resume; verify the paused period is absent from the saved video/audio.
- [ ] Stop sharing through OS controls; verify the app finalises and saves the recording.
- [ ] Deny microphone/screen permission; verify a clear error and no lingering capture.
- [ ] Make a short recording, save, restart and copy the saved WebM.
- [ ] Save revisions, restore an earlier one, check approval invalidation.
- [ ] Delete a test session and verify its revisions and recording are removed.
- [ ] Select each export format and compare files to the exact preview.
- [ ] Browser extension in Chrome and Edge: opt-in only, no field values, stop halts evidence, no capture across other tabs.
- [ ] Navigate the recorded tab, stop/export and start a new document capture.
- [ ] Local Ollama: valid suggestions, stopped service, missing model, malformed output and timeout.
- [ ] Unsigned Windows installer and portable package launch on a clean computer.
- [ ] macOS screen/microphone prompts and Linux portal behavior.

## Evidence discipline

A recorded action is an observation, not a proven reusable procedure. A reviewed export is a complete draft, not a successful replay. Add real execution results before relying on it in operational systems.

A macOS CI failure exposed equal-millisecond revision ordering. Version 0.2.1 serializes saves and assigns monotonically increasing revision timestamps; a frozen-clock concurrent-save regression test covers this case.
