# KKApp

KKApp immersive character world demo application.

## Download the complete source

The source archive is split into two parts because GitHub's browser uploader limits individual files. Download both `KKApp-source.zip.part-aa` and `KKApp-source.zip.part-ab` from this repository, place them in the same folder, then join them:

**macOS / Linux**

```sh
cat KKApp-source.zip.part-aa KKApp-source.zip.part-ab > KKApp-source.zip
unzip KKApp-source.zip
```

**Windows (Command Prompt)**

```bat
copy /b KKApp-source.zip.part-aa+KKApp-source.zip.part-ab KKApp-source.zip
```

Extract the resulting zip. To run locally, install Node.js 20+, run `npm install`, copy `.env.example` to `.env.local`, configure the service keys you have, then run `npm run dev`.

The public demo is available at https://lumi-world-kkapp.gentle-slug-1144.chatgpt.site/.

Secrets are not included. Configure your own API keys locally in `.env.local`; do not commit that file.
