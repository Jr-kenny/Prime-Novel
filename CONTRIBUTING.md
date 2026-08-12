# Contributing

Contributions are welcome. Prime Novel is a reading product, so changes should keep the experience calm, reliable, and easy to understand.

## The bar

**No AI slop.** AI tools can help with coding, but every line still needs to be understood, reviewed, and tested. Dead code, unnecessary abstractions, guessed APIs, and comments that explain obvious code do not belong here.

**It has to actually run.** Before opening a pull request, run the relevant checks and describe the exact commands and results. A change that affects the reader, downloads, progress, sources, or navigation needs a real flow test as well as a typecheck.

**Small and focused.** One pull request should do one thing. Keep unrelated formatting, refactors, and product changes out of the same diff.

**Match what's there.** Follow the existing Expo Router structure, component patterns, visual language, and state boundaries. Add a dependency only when the existing platform cannot solve the problem cleanly.

**No secrets, ever.** API keys, tokens, private source credentials, signing material, and personal data never go into the repository. Use local environment variables and keep local env files ignored.

**Handle the sad path.** Offline reading, missing chapters, failed downloads, unavailable sources, malformed content, and interrupted updates need clear behavior. Do not catch an error and silently continue as if the operation succeeded.

## Product boundaries

- Prime Novel owns and maintains its catalogue and source connections. Do not add user-facing source toggles, repository controls, or source package installation flows without a product decision.
- Source adapters and the internal source registry stay behind the app's existing data and utility boundaries.
- Shosetsu is an architectural reference for reader behavior, progress restoration, downloads, and update flows. Prime Novel keeps its own product language and visual design.
- Reading progress must restore the reader to the same place after leaving and reopening a chapter.
- Mobile remains the primary product. The web build uses the same screens and shared state, with web-specific behavior kept inside platform boundaries.

## Process

1. Open an issue before starting substantial work so the approach can be agreed first. Small fixes can go straight to a pull request.
2. Use a focused branch name such as `reader/progress-restore`, `web/vercel-deploy`, or `sources/catalog-update`.
3. Open the pull request with what changed, why it changed, what could fail, and the exact checks you ran.
4. A maintainer reviews and merges the pull request. Review comments are about the code and the product, not about the person who wrote it.

## Checks

Run these from the repository root when they apply:

```shell
pnpm run typecheck
pnpm --filter @workspace/novel-reader exec expo export --platform web
pnpm --filter @workspace/novel-reader exec expo export --platform android
```

On macOS with the iOS toolchain available, also run:

```shell
pnpm --filter @workspace/novel-reader exec expo export --platform ios
```

For reader, download, source, or update changes, test the affected flow on a device or emulator and include what happened in the pull request.

## If you're stuck

Say where the flow stops, include the command or error that shows it, and explain what you tried. A clear blocked report is more useful than a half-working change with no context.
