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
   **Never give this key to a student.** The placeholder is written in this public repository,
   so the server refuses every teacher action until you have changed it. Choose something only
   you know, for example four words joined by dashes, and keep it out of the repository.
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

1. **Write the questions**, in the Sheet or, faster, in a CSV that you import from the dashboard
   (**Questions → Download the CSV model**). Columns:

   | Id | Theme | Type | Question | Code | A | B | C | D | E | Correct | Expect | Points |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | Q1 | Ch. 4 | single | Which widget makes one choice among n alternatives? | | Check box | Radio button | Text field | Scrollbar | | B | | 1 |
   | Q2 | Ch. 4 | multi | Which of these are utility windows? | | Tooltip | Dialog box | Floating palette | Progress | | A,C,D | | 1 |
   | Q3 | Ch. 4 | open | Write the Swing code of an empty window 600x400, centred. | | | | | | | | JFrame \| setTitle("*") \| setSize(600,400) | 3 |

   - **Type**: `single` (one answer), `multi` (several), `open` (written answer).
   - **Correct**: `B`, or `A,C,D` for several. Empty for a written answer.
   - **Code**: an optional piece of code shown with the question.
   - **Points**: used only when "same mark for every question" is off. The import turns it off
     by itself when your questions do not all carry the same points.
   - The import also reads a **.json** file in the format of your `questions.json`
     (`{questions:[{id,theme,text,options,answer}]}`), so your three subjects go in directly.

2. **The settings** (dashboard → Settings): module, which exam, title, minutes, groups, shuffle,
   **mark out of** (15 brings the total back to 15), same mark for every question or the Points
   column, partial points for several answers, and the two limits of the analyser.
   You can also write a **case study** that students read in the waiting room and keep during the exam.
3. Press **1 · Open the waiting room** and give the students the link of `exam.html`.
4. Accept the students, then **2 · Start the exam**.
5. At the end, **3 · Stop and collect** closes every copy that is still open.
6. Download the CSV of the results, and open the Drive folder for the PDF copies.

## Written answers: the analyser

For a question of type `open` you write, in **Expect**, the elements you expect, separated by `|`:

```
JFrame | setTitle("*") | setSize(600,400) | setLocationRelativeTo(null)
       | setDefaultCloseOperation | setVisible(true) | addActionListener:2 | !System.exit
```

| You write | It means |
| --- | --- |
| `setSize(600,400)` | this Java code, spaces anywhere do not matter |
| `setTitle("*")` | `*` stands for anything |
| `addActionListener:2` | this element counts double |
| `~feedback` | plain words, upper and lower case ignored |
| `!System.exit` | must **not** be there; it takes points away |
| `# ...` | a note for you, not read by the analyser |

The server counts the share of the expected elements that are present:
**complete** above `OpenComplete` (0.85 by default) gives all the points, **partial** above
`OpenPartial` (0.40) gives points in proportion, below that it is **wrong**. A question with an
empty `Expect` is left for you to mark by hand.

Every written answer is listed in the dashboard under **Written answers** with the verdict, what
is missing and the student's text. Change any mark there: the total of that student is computed again.

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
