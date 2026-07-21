# PhaseBinder

I started PhaseBinder for my brother in law. He is a general contractor getting ready to manage five big projects with forty apartments total. Each building has eight apartments. That means he has to keep track of a lot of workers, deliveries, inspections, photos, and documents at the same time.

My goal is simple. I want him to open a project and quickly see what is ready, what is stuck, what arrived, what needs to be checked, and who can see it.

## Try PhaseBinder

Live demo: https://phasebinder.com

Code: https://github.com/DwellerD/AmmonsSoftware

Category: Work and Productivity

Judges do not need to build the app. They can create a free account or use the test account in the private Devpost instructions.

## Why I built it

Construction information often gets split between texts, calls, spreadsheets, photos, and paper notes. That gets confusing when several projects are moving at once. One late delivery or missed repair can hold up a crew and slow down the whole project.

PhaseBinder puts that information in one place that is easy to use on a phone or computer. It is supposed to help a contractor keep the job moving without giving them another confusing system to manage.

## What it does

Each project has its own Overview, Trade Phases, Materials, Punch List, and Documents page. The Overview shows current work and things that need attention. The other pages keep the details inside the correct project.

Trade phases move through steps such as Ready, Scheduled, Complete, Inspected, and Approved. Material orders show the supplier, arrival date, status, cost, tracking details, and notes. It is easy to see late materials and unfinished repairs.

A project manager can create a secure receipt link. A person receiving a delivery can open the link without an account. They can upload photos and notes for the manager to check. The link expires and can only be used once.

PhaseBinder also stores proof of finished work, inspections, repair items, documents, and important plans. Project owners can invite people and choose what each person can see or change.

## Project access

Project access is checked by the app and by Firebase security rules. A person only sees the pages allowed by the project owner. For example, someone can see Trade Phases and Materials without seeing Punch List, Documents, or user settings.

If the owner removes someone, the project disappears from that person's account. They also cannot open the project with a direct link.

## How I built it

PhaseBinder is a website built with Next.js 16, React 19, TypeScript, Tailwind CSS, Firebase, and Playwright. It works on computers and phones.

Firebase Authentication handles accounts. Cloud Firestore stores project information. Cloud Storage stores photos and documents.

Firestore rules check who can read or change each part of a project. Storage rules protect uploaded photos and documents. The app checks a person's access before it loads each project page.

## How I used GPT 5.6 and Codex

I used GPT 5.6 and Codex to help me build and check PhaseBinder. The finished app does not use AI while people are using it.

I built most of the new features in VS Code with GitHub Copilot Chat using GPT 5.6 Sol. It helped me understand the code, plan changes, build the receipt and project workspace features, and write browser tests. I checked the changes with code checks, production builds, and Playwright tests.

Before submitting, I opened the same project in the official Codex desktop app. Codex checked the permissions, receipt links, Firebase rules, and browser tests. It found a few real problems and helped fix them. People can no longer give themselves more access. Files now follow the same project permissions as the rest of the app. Invites expire correctly. Direct material links also keep working when there are many orders.

Here is the dated proof in the repository.

1. On July 16, 2026, GPT 5.6 Sol helped improve data access, account changes, and Firebase cost controls. See commit [`27e4f4a`](https://github.com/DwellerD/AmmonsSoftware/commit/27e4f4a).

2. On July 17, 2026, GPT 5.6 Sol helped build the material receipt photo system. See commit [`74fa098`](https://github.com/DwellerD/AmmonsSoftware/commit/74fa098).

3. On July 17, 2026, GPT 5.6 Sol helped build project workspaces with permissions and browser tests. See commit [`411bb41`](https://github.com/DwellerD/AmmonsSoftware/commit/411bb41).

4. On July 21, 2026, official Codex checked the final app, fixed the problems it found, ran the tests again, and helped release it. See commit [`66ef0c9`](https://github.com/DwellerD/AmmonsSoftware/commit/66ef0c9).

I put the official Codex Session ID for the July 21 review in the private Devpost form. I explained the earlier GPT 5.6 Sol work and the final Codex work separately so judges can see what each tool helped with.

## Work completed during the submission period

PhaseBinder existed before the contest started. I added the work below during the contest on July 16, July 17, and July 21, 2026.

1. I made project data safer and reduced extra Firebase reads.

2. I added material receipt checking. A manager can create a limited upload link. A receiver can send delivery photos. The manager can check the proof before accepting the delivery.

3. I added a project workspace with permissions. Each project now keeps its phases, materials, repairs, documents, plans, activity, and people in one place.

4. I added browser tests for owners, invited people, permission changes, receipt photos, removed access, and separate project data.

5. During the final Codex review, I fixed permission problems, protected stored files, tested receipt links, and fixed direct material links.

The first four items are shown in the July 16 and July 17 commits above. The fifth item and the final release are shown in `66ef0c9`.

## How judges can test it

Judges do not need to build the app.

1. Open https://phasebinder.com

2. Select Sign in and create a free account.

3. Create a project and open it to view the project workspace.

4. Add trade phases, material orders, repair items, or documents. Make sure they appear inside that project.

5. Open a material order and create a receipt upload link. Open that link in a private browser window and send delivery photos. Return to the signed in account to review the receipt.

6. To test access, invite a second email address from the project Overview. Sign in with that address and accept the invite. Make sure the project only shows the allowed pages.

7. Return to the owner account and change the permissions. Sign back in with the invited account and make sure the project pages change.

8. Revoke access and confirm the participant can no longer see or open the project.

## Supported platforms

PhaseBinder works on computers and phones. It supports current versions of Chrome, Safari, Firefox, and Edge.

## Run locally

Install Node.js 20 or newer.

```bash
npm install
```

Create the local environment file from the included example.

```bash
cp .env.local.example .env.local
```

Add the Firebase web application values to `.env.local`, then start the app.

```bash
npm run dev
```

Open http://localhost:3000

## Validation

I ran these final checks on July 21, 2026.

1. ESLint passed.

2. The Next.js production build passed and created 18 routes.

3. The Playwright tests finished with 15 passed and 1 skipped test for a contractor portal that is not part of this version.

4. The Firestore and Storage rules passed their checks. Extra tests covered invite permissions, project changes, document access, receipt uploads, and making sure a receipt link only works once.

5. Commit `66ef0c9` was released through Vercel. The checked Firestore and Storage rules were released to Firebase.

```bash
npm run lint
npm run build
npm run test:e2e
```

The browser tests use a Firebase test account saved in the ignored file `tests/e2e/.env`. The tests run one at a time because some of them create and check shared project data.

## Security

Private settings and Firebase service account files are ignored by Git. Firestore rules protect project access. Firestore and Storage rules protect receipt uploads with file size limits, expiration, and one time use.

## License

This project is available under the MIT License in `LICENSE`.
