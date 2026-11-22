# Online exam — HCI

Prof. Izountar Yousra · University of Algiers 1 · Computer Science Department

The exam pages are on GitHub Pages. The questions, the correct answers, the marking
and the copies are on Google (Apps Script, Sheet, Drive). GitHub never sees the key.

| File | What it is |
| --- | --- |
| `exam.html` | the page for the students |
| `exam-prof.html` | your dashboard (teacher key needed) |
| `exam-config.js` | the address of the server |
| `backend/Code.gs` | the code to paste into Apps Script |

## How it works

1. You open the waiting room.
2. A student opens `exam.html`, writes **name, matricule and group**, and asks to enter.
3. You see the request in your dashboard and you accept it (one student, one group, or all).
4. You start the exam. Each accepted student gets the same number of minutes.
5. The student page goes **full screen**. Copy, paste, right click and the usual shortcuts
   are off. Leaving full screen, changing tab or leaving the window is recorded and
   shown to you at once. After **3 warnings** the copy is sent automatically.
6. You can add or remove minutes at any moment: for everybody, for one group, or for one student.
7. When a copy arrives it is marked immediately and saved as a **PDF in a Drive folder**,
   one file per student, named `group - matricule - name.pdf`.

## Setting it up (once)

1. Create a Google Sheet, name it **HCI Exam**.
2. In the Sheet: **Extensions → Apps Script**. Delete the example code,
   paste everything from `backend/Code.gs`, and save.
3. At the top of the code, replace `CHANGE-THIS-KEY` with your own key.
   **Never give this key to a student.**
4. Run the function `setupSheets` once (choose it in the list, press Run).
   Google asks for an authorisation: accept it with your own account.
   This creates the tabs **Settings, Questions, Students, Answers, Events**.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, then copy the address that ends in `/exec`.
6. Open `exam-config.js` in this folder and paste that address:
   `window.EXAM_API = 'https://script.google.com/.../exec';`
   Commit and push.

## Before each exam

1. In the Sheet, tab **Questions**: write your questions.

   | Id | Question | A | B | C | D | E | Correct | Points |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | Q1 | Which widget makes one choice among n alternatives? | Check box | Radio button | Text field | Scrollbar | | B | 1 |

   Leave `E` empty if you only want four choices. `Correct` is the letter of the right answer.

2. Open your dashboard, **Settings**: the title, the module, the number of minutes,
   the list of groups, and `Shuffle = yes` if you want a different order of questions
   for every student.
3. Press **1 · Open the waiting room** and give the students the link of `exam.html`.
4. Accept the students, then **2 · Start the exam**.
5. At the end, **3 · Stop and collect** closes every copy that is still open.
6. Download the CSV of the results, and open the Drive folder for the PDF copies.

## Starting a new exam

Change the questions in the Sheet, then press **Clear the students** in the dashboard.
It empties the students, the answers and the alerts, and asks for a new Drive folder.

## What the students cannot do

Full screen is required, and leaving it is recorded. Copy, cut, paste, the right click,
text selection, drag, printing, `F12` and the usual shortcuts are blocked. Changing tab
or window is recorded. Closing the page asks for a confirmation, and the answers are
saved on the server at every click, so nothing is lost if the connection drops.

This stops the ordinary attempts. It is not a locked-down machine: a student with a
second phone can always read something else. For a high-stakes exam, keep a
surveillance in the room as well.
