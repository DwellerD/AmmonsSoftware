# PhaseBinder

PhaseBinder is a construction workflow app I built for general contractors and site supervisors. It puts project readiness, materials, inspections, punch work, documents, and participant access in one place so important job information does not stay scattered across texts and spreadsheets.

## Live project

Live demo: https://phasebinder.com

Code: https://github.com/DwellerD/AmmonsSoftware

Category: Work and Productivity

## The problem

A general contractor has to keep track of many trades, deliveries, inspections, and documents at the same time. A missed delivery or hidden punch item can hold up several people. PhaseBinder gives the contractor a clear view of each project and gives participants access only to the information they need.

## What it does

1. Creates and organizes construction projects.

2. Tracks trades and trade phases from readiness through approval.

3. Tracks material orders, expected arrival dates, delays, and verified receipts.

4. Lets a receiver upload delivery photos through a secure one time link without creating an account.

5. Lets the general contractor review delivery proof before marking material as received.

6. Tracks completion proof, inspections, and punch items.

7. Stores project documents and keeps important plans easy to find.

8. Invites project participants and controls which project areas each person can see or edit.

9. Gives every project its own workspace with Overview, Trade Phases, Materials, Punch List, and Documents.

## Participant permissions

Project access is enforced in the interface and in Firebase security rules. A participant only sees project tabs that match the permissions granted by the project owner. For example, a participant can receive access to Trade Phases and Materials without seeing Punch List, Documents, or user management.

Removing a participant removes the project from their account and prevents direct access to the project address.

## Work completed during the submission period

PhaseBinder existed before the submission period. The work listed here was added on July 16 and July 17, 2026.

1. I hardened project data access with bounded reads, duplicate protection, permission checks, safer account transitions, and improved Firebase cost controls.

2. I added secure material receipt verification. A contractor can create a limited upload link, a receiver can submit delivery photos, and the contractor can review the proof before accepting the delivery.

3. I added a permission aware project workspace. Each project now brings its phases, materials, punch items, documents, plans, activity, and participant controls into one organized view.

4. I added live browser tests for owner access, participant access, permission changes, receipt verification, revocation, and project isolation.

The dated commits that contain this work are `27e4f4a`, `74fa098`, and `411bb41`.

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

## Technology

PhaseBinder uses Next.js 16, React 19, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, Cloud Storage, and Playwright.

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

```bash
npm run lint
npm run build
npm run test:e2e
```

The browser tests use a live Firebase test account configured through the ignored file `tests/e2e/.env`. The full suite runs serially because several workflows create and verify shared project data.

## Security

Local environment values and Firebase service account files are ignored by Git. Firestore and Storage rules enforce project access, scoped receipt uploads, file limits, token expiration, and one time use.

## License

This project is available under the MIT License in `LICENSE`.
