# Continuous evaluation — student page and teacher dashboard

Prof. Izountar Yousra · University of Algiers 1 · Computer Science Department

Each student signs in and sees **only their own** continuous evaluation:
mark /20 and its parts, attendance per session, lab reports.
They can send a **claim** and an **absence note with a document**.
You answer from the dashboard; the student reads your answer on their page.

The pages are on GitHub Pages. The marks stay in the Google Sheet, the documents in a Drive folder.
GitHub never sees the teacher key, the marks or the documents.

| File | What it is |
| --- | --- |
| `evaluation.html` | the page for the students |
| `evaluation-prof.html` | your dashboard (teacher key needed) |
| `evaluation-config.js` | the address of the server |
| `backend/Code.gs` | the code to paste into Apps Script |

## How a student signs in

**Matricule + registration number** (the `UN1601…` number of the official list, on the student card).
The server checks both against the **Students** tab. After 6 wrong tries for one matricule,
it waits 15 minutes. A student who reloads the page stays signed in on that device.

## What the server reads

- **Students** tab: the official list (Matricule, Inscription, LastName, FirstName, Group).
  It is already filled for M2 ASD S3 (76 students). Token and LastSeen are written by the server.
- The tabs listed in **Settings → EvalTabs** (now `EvaluationContinuG1,EvaluationContinuG2`).
  The server finds the student by the **Matricule** column (8 digits, as in the official list).
  - Columns named like a date (`7/10`, `25/11`) are the sessions: `P` present, `A` absent.
  - `Rap1`…`Rap4` are the lab reports (`Oui` / `Non`).
  - `Note rapport/3`, `présence/2`, `Bonus…`, `Controle/15`, `Note/20` make the mark card.
  - Any other column is shown under the reports. A new date column appears by itself.

## Setting it up (once)

1. Open the Sheet **NoSQL & Cloud - Student Registration Form (réponses)**.
2. **Extensions → Apps Script**. Delete the example code, paste everything from `backend/Code.gs`, save.
3. At the top of the code, replace `CHANGE-THIS-KEY` with your own key.
   **Never give this key to a student and never put it in this repository.**
   The server refuses every teacher action until you change it.
4. Run the function `setupSheets` once (choose it in the list, press **Run**) and accept the authorisation
   with your own account. It adds the tabs **Settings, Claims, Absences, Log** (it keeps **Students**)
   and creates the Drive folder for the documents.
5. **Deploy → New deployment → Web app** — Execute as: **Me** — Who has access: **Anyone**.
   Copy the address that ends in `/exec`.
6. Paste it in `evaluation-config.js`: `window.EVAL_API = 'https://script.google.com/.../exec';`
   then change `evaluation-config.js?v=1` to `?v=2` in both HTML files, commit and push.
7. Give the students the link to `evaluation.html`. Keep `evaluation-prof.html` for yourself.

After changing `Code.gs`: **Deploy → Manage deployments → pencil → Version: New version → Deploy**.
Forgetting this is the usual reason "nothing changed".

## Every day

- **Requests** tab of the dashboard: the waiting claims and absence notes. Open the document, write an
  answer, then **Accept**, **Refuse** or **Keep waiting**. The student sees the status and your answer.
- Accepting an absence note **does not change the marks**: change the cell (`A`) in the evaluation tab
  yourself if you decide to. The student page shows the new value at once.
- **Students** tab: who has signed in, and the full record of a student in one click.
- **Settings**: open or close claims, write a message such as "Claims until 10/12/2026",
  the largest file size, the tabs to read.
- **Export CSV**: the requests you are looking at.

## Good to know

- Documents: PDF, JPG or PNG, 5 MB by default. They are saved in the Drive folder made by the server,
  named `group - matricule - name - kind - date`. Only you can open them.
- Five students of the official list are in no evaluation tab yet. They can sign in; their page says
  that their marks are not in the table yet and lets them send a claim.
- The registration number protects the page as long as students do not share it. If one student
  shares it, only their own record is exposed.
