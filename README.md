# PhaseBinder

I started PhaseBinder for my brother in law. He is a general contractor getting ready to manage five major projects with forty apartments total. Each building has eight apartments, which means a lot of trades, deliveries, inspections, punch work, photos, and documents need to stay organized at the same time.

The goal is simple. I want him to open one project and quickly understand what is ready, what is blocked, what arrived, what needs review, and who has access to it.

## Try PhaseBinder

Live demo: https://phasebinder.com

Code: https://github.com/DwellerD/AmmonsSoftware

Category: Work and Productivity

No rebuild is needed. Judges can create a free account or use the dedicated test account included in the private Devpost testing instructions.

## Why I built it

Construction information tends to get split between texts, calls, spreadsheets, photos, and paper notes. That works until several projects are moving at once. One late delivery or missed punch item can hold up a crew and affect the schedule around it.

PhaseBinder puts that information into a project workspace that is easy to use from a phone or computer. It is meant to help a working general contractor keep the job moving, not add another complicated system to manage.

## What it does

Each project has its own Overview, Trade Phases, Materials, Punch List, and Documents area. The Overview shows active work and anything that needs attention. The other sections keep the details inside the project where they belong.

Trade phases move from readiness through scheduling, completion, inspection, and approval. Material orders include suppliers, expected arrival dates, status, cost, tracking information, and notes. Delayed materials and open punch items are easy to spot.

A project manager or participant with material editing permission can create a secure one time receipt link. The person receiving the delivery can open it without an account, upload photos and notes, and submit the delivery for review. The project manager checks the proof before marking the order as received or reporting an issue.

PhaseBinder also stores completion proof, inspections, punch items, project documents, and pinned plans. Project owners can invite participants and decide which parts of the project each person can view or edit.

## Project access

Project access is enforced in the interface and in Firestore security rules. A participant only sees the sections allowed by the project owner. For example, someone can receive access to Trade Phases and Materials without seeing Punch List, Documents, or user management.

Removing a participant removes the project from their account and prevents direct access to the project address.

## How I built it

PhaseBinder is a responsive web application built with Next.js 16, React 19, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, Cloud Storage, and Playwright.

Firebase Authentication manages accounts. Cloud Firestore stores project and workflow records. Cloud Storage stores completion photos, receipt photos, and project documents.

Firestore rules enforce project and section permissions. Firestore and Storage rules limit receipt submissions to the correct project, material order, and active link. The project workspace reads a participant's access before loading its sections, so it does not request information that person is not allowed to see.

## How I used GPT-5.6 and Codex

GPT-5.6 and Codex were development tools for this submission; PhaseBinder does not call a language model at runtime.

I developed most of the submission-period features in VS Code with GitHub Copilot Chat using GPT-5.6 Sol. It helped me inspect the existing code, plan changes, implement the receipt and project workspace flows, and build browser tests. I reviewed those changes and validated the application with lint checks, production builds, and Playwright tests against Firebase.

Before submitting, I opened the same repository in the official Codex desktop app for a final release-candidate review. Codex traced the project permission model through the interface, Firestore, and Storage; checked the one-time receipt transaction; ran the full live browser suite; and made targeted fixes where the review found real security or judge-path problems. Those fixes prevent a participant from expanding their own invite permissions, apply project section permissions to stored files, enforce server-side invite expiration, and keep a project material link working even when the bounded global material list is full.

The dated repository evidence is:

| Date | Tool and contribution | Commit evidence |
| --- | --- | --- |
| July 16, 2026 | GPT-5.6 Sol in Copilot Chat helped harden data access, account transitions, and Firebase cost controls. | [`27e4f4a`](https://github.com/DwellerD/AmmonsSoftware/commit/27e4f4a) |
| July 17, 2026 | GPT-5.6 Sol in Copilot Chat helped build the material receipt photo verification workflow. | [`74fa098`](https://github.com/DwellerD/AmmonsSoftware/commit/74fa098) |
| July 17, 2026 | GPT-5.6 Sol in Copilot Chat helped build permission-aware project workspaces and their browser coverage. | [`411bb41`](https://github.com/DwellerD/AmmonsSoftware/commit/411bb41) |
| July 21, 2026 | Official Codex performed the final security review, fixed the permission and judge-path issues it found, reran validation, and deployed the release. | [`66ef0c9`](https://github.com/DwellerD/AmmonsSoftware/commit/66ef0c9) |

I supplied the official Codex Session ID for the July 21 review in the private Devpost submission field. This README distinguishes the earlier GPT-5.6 Sol work from the final work completed in Codex so judges can evaluate each contribution accurately.

## Work completed during the submission period

PhaseBinder existed before the submission period. The main product work listed below was added on July 16 and July 17, 2026, followed by the final Codex review and targeted hardening on July 21.

1. I tightened project data access with bounded reads, duplicate protection, permission checks, safer account transitions, and improved Firebase cost controls.

2. I added material receipt verification. A project manager can create a limited upload link, a receiver can submit delivery photos, and the project manager can review the proof before accepting the delivery.

3. I added a permission aware project workspace. Each project now brings its phases, materials, punch items, documents, plans, activity, and participant controls into one organized view.

4. I added live browser tests for owner access, participant access, permission changes, receipt verification, revocation, and project isolation.

5. In the final Codex review I closed participant self-escalation paths in Firebase rules, aligned stored project files with section permissions, verified the anonymous receipt batch and one-time replay protection in local emulators, and fixed direct material links after bounded collection reads.

The first four items map to the July 16–17 commits above. The fifth item and final deployed release are recorded in `66ef0c9`.

## How judges can test it

No rebuild is needed.

1. Open https://phasebinder.com

2. Select Sign in and create a free account.

3. Create a project and open it to view the project workspace.

4. Add trade phases, material orders, punch items, or documents and confirm they appear inside that project.

5. Open a material order and create a receipt upload link. Open that link in a private browser window, submit delivery photos, then return to the signed in account to review the receipt.

6. To test participant access, invite a second email address from the project Overview. Sign in with that address, accept the invite, and confirm the project appears with only the permitted tabs.

7. Return to the owner account, change the participant permissions, then sign back in as the participant to confirm the project workspace changes with those permissions.

8. Revoke access and confirm the participant can no longer see or open the project.

## Supported platforms

PhaseBinder is a responsive web application. It supports current versions of Chrome, Safari, Firefox, and Edge on desktop and mobile devices.

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

Final release verification on July 21, 2026:

- ESLint passed.
- The Next.js production build passed and generated 18 routes.
- The full Playwright suite finished with 15 passed and 1 intentionally skipped contractor-portal case.
- Firestore and Storage rules compiled successfully, and focused emulator checks covered invite escalation, participant self-updates, cross-project invite changes, document permissions, anonymous receipt submission, and one-time-link replay protection.
- Commit `66ef0c9` was deployed through Vercel, and the reviewed Firestore and Storage rules were released to Firebase.

```bash
npm run lint
npm run build
npm run test:e2e
```

The browser tests use a live Firebase test account configured through the ignored file `tests/e2e/.env`. The full suite runs serially because several workflows create and verify shared project data.

## Security

Local environment values and Firebase service account files are ignored by Git. Firestore rules enforce project access. Firestore and Storage rules protect receipt uploads with file limits, expiration, and one time use.

## License

This project is available under the MIT License in `LICENSE`.
