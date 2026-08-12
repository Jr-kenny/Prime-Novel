# Prime Novel

Prime Novel is a native-first reading application for iOS and Android. It is designed to make discovering, organizing, downloading, and reading novels feel calm and personal.

The project uses one shared Expo and React Native codebase for the mobile applications. The reader is built around the reading experience rather than a browser-style interface.

## Product focus

- Discover novels through Prime Novel's built-in catalogue.
- Search, save, favorite, and organize novels in the library.
- Browse chapters, resume from the saved position, and track reading history.
- Download chapters for offline reading.
- Customize text size, line height, paragraph spacing, indentation, margins, fonts, themes, and navigation.
- Read vertically through a chapter or use horizontal page navigation.
- Save reading progress continuously and restore it when the app is reopened.
- Keep reader controls hidden during normal reading and reveal them only when requested.

Prime Novel keeps catalogue and source implementation details inside the app. Users should be able to read without becoming repository managers or learning how the catalogue is assembled. Platform-specific source capabilities remain behind native boundaries so the same product can support iOS and Android responsibly.

The website is the same shared Expo and React Native experience compiled for the browser. It is deployed from this repository through Vercel, while the native builds remain the primary mobile distribution targets.

## Project structure

The mobile application is located at:

```text
artifacts/novel-reader
```

Important areas include:

- `app/` for Expo Router screens and navigation.
- `components/` for shared native UI components.
- `context/` for app, catalogue, and reader state.
- `data/` for the internal source registry and source capability records.
- `utils/` for source adapters, downloads, analytics, shelves, and reader styling.

## Development

Install dependencies from the repository root:

```bash
pnpm install
```

Run the native Expo app from the mobile app directory:

```bash
cd artifacts/novel-reader
pnpm exec expo start
```

Run the shared app in a browser:

```bash
cd artifacts/novel-reader
pnpm exec expo start --web
```

Useful checks:

```bash
pnpm run typecheck
pnpm --filter @workspace/novel-reader exec expo export --platform web
pnpm exec expo export --platform android
pnpm exec expo export --platform ios
```

The production web build is configured in [`vercel.json`](vercel.json). It exports `artifacts/novel-reader/dist` and uses the same app routes and state as the native application.

The app is being developed for mobile first. The website is the shared browser build, not a separate product implementation.
