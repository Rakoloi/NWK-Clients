# Clients System - Test Data Automation Framework
## Architecture and How It Works

---

## 1. Purpose

The Clients System project is an automated test-data generator built on top of
Playwright. It drives the NWK Clients web application (QA environment) through
its full "Create Client" workflow for every row in an Excel workbook. Each
successfully created client becomes real test data in the system. A persistent
JSON store makes the suite resumable, and a custom PDF reporter produces a
polished execution report after every run.

The framework was designed around four non-negotiable goals:

1. Data-driven: tests are generated at runtime from an Excel workbook.
2. Resumable: a row that already passed in a previous run must be skipped so
   the suite can be stopped and resumed without re-doing work or creating
   duplicates.
3. Evidence-rich: every failed test must leave behind a screenshot, video and
   trace that the author can inspect without rerunning anything.
4. Human-readable reporting: the result of every run is published as a PDF
   that non-technical stakeholders can open directly.

---

## 2. Technology Stack

- **Language**: TypeScript (Node.js runtime, Windows host).
- **Test runner**: @playwright/test v1.60.
- **Browser automation**: Playwright (Chromium, headed by default).
- **Excel reader**: xlsx (SheetJS) v0.18.
- **PDF rendering**: pdfkit v0.19.
- **Config / secrets**: dotenv (loads QA credentials from .env).

Dependencies are declared in package.json; no build step is required because
Playwright executes the TypeScript sources directly.

---

## 3. Folder Layout

```
Clients-System/
  playwright.config.ts        # Playwright configuration + reporter wiring
  package.json                # Dependencies
  .env                        # QA_Username / QA_Password (not committed)
  images/
    NWK-logo.png              # Logo used in the PDF report header
  pages/
    createAccount.ts          # Page Object Model for the Create Client flow
  tests/
    auth/
      login.setup.ts          # One-time sign-in, saves storageState.json
      storageState.json       # Reusable auth cookies / localStorage
    workflows/
      create-client.spec.ts   # Data-driven test: one test per Excel row
  utils/
    excelReader.ts            # Reads clientsData.xlsx -> { sheet: rows[] }
    clientsData.xlsx          # Source of truth for test data
    testResultsStore.ts       # Read/upsert reports/testResults.json
  reporters/
    pdf-reporter.ts           # Custom Playwright reporter -> PDF
  reports/
    testResults.json          # Persistent per-row status (resumability)
    reportNN/                 # One folder per run (PDF + evidence)
      reportNN.pdf
      <failed-test-name>/     # Screenshot, video, trace, error.txt
  playwright-report/          # Standard Playwright HTML report
```

---

## 4. High-Level Flow

```
+---------------------+        +--------------------------+
| clientsData.xlsx    |        | reports/testResults.json |
|  (test data)        |        |  (persistent history)    |
+----------+----------+        +------------+-------------+
           |                                |
           v                                v
  +--------+--------+              +--------+--------+
  | utils/          |              | utils/          |
  | excelReader.ts  |              | testResultsStore|
  +--------+--------+              +--------+--------+
           |                                |
           +--------------+-----------------+
                          v
         +----------------+----------------+
         | tests/workflows/                |
         | create-client.spec.ts           |
         |  - describe(sheetName)          |
         |     test(TC-No)                 |
         +----------------+----------------+
                          |
                          v
              +-----------+-----------+
              | pages/createAccount.ts|
              |  (Page Object Model)  |
              +-----------+-----------+
                          |
                          v  Playwright drives Chromium
              +-----------+-----------+
              | NWK Clients QA site   |
              +-----------+-----------+
                          |
                          v
              +-----------+---------------+
              | reporters/pdf-reporter.ts |
              |  onTestEnd -> JSON upsert |
              |  onEnd     -> render PDF  |
              |  onExit    -> evidence    |
              +---------------------------+
```

---

## 5. Configuration (playwright.config.ts)

Key settings:

- `testDir: './tests'` discovers both the auth setup and the workflow spec.
- `fullyParallel: false` and `workers: 1` keep rows sequential, because the
  app under test does not tolerate concurrent client creation.
- `maxFailures: 0` means Playwright keeps running the full suite even when
  individual rows fail; this is critical for a batch of data where we want
  every row attempted.
- `timeout: 0`, `expect.timeout: 0`, `actionTimeout: 0`, `navigationTimeout: 0`
  disable Playwright's hard timeouts (the suite relies on explicit waits
  inside the Page Object Model).
- `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`,
  `trace: 'retain-on-failure'` capture evidence only when a test fails.
- Two reporters are wired:
  1. `html` - standard Playwright report under `playwright-report/`.
  2. `./reporters/pdf-reporter.ts` - the custom PDF + JSON upsert.
- Two projects:
  1. `setup` - runs `login.setup.ts`.
  2. `chromium` - runs the workflow spec, `dependencies: ['setup']` and
     `storageState: 'tests/auth/storageState.json'` so every test starts
     already logged in. `headless: false` is on so the operator can watch
     the browser.

---

## 6. Authentication (tests/auth/login.setup.ts)

A single Playwright "setup" test logs into the QA environment, waits until
"Welcome to NWK," is visible, and persists cookies + storage via
`page.context().storageState({ path: 'tests/auth/storageState.json' })`.

Every subsequent worker in the `chromium` project boots with that storage
state injected, so no row re-logs in. Credentials come from `.env`
(`QA_Username`, `QA_Password`) loaded with dotenv.

---

## 7. Data Source (utils/excelReader.ts)

`getWorkbookData()` reads `utils/clientsData.xlsx` with SheetJS and returns
an object of the shape:

```
{
  "Monthly accounts":              [ {row object}, ... ],
  "Cash accounts (Miscellane) (ZL)": [ {row object}, ... ],
  "Maise account (X)":             [ {row object}, ... ],
  "Production & Month account(A-S)": [ {row object}, ... ],
   ...
}
```

Each row is a `{ columnName: cellValue }` map (empty cells become empty
strings via `defval: ''`). Sheet names in the workbook correspond directly
to the account types the UI supports; this is how a single spec can handle
every variant.

---

## 8. Page Object Model (pages/createAccount.ts)

`CreateAccountPage` wraps every interaction with the Create Client wizard:

- `openSystem()` - navigates to the clients list (via the sign-in URL that
  redirects post-auth) and clicks "Create Client".
- `createClient()` - selects the account type passed in the constructor.
- `clientInformation(...)` - fills the client's legal / personal details.
- `contactInformation(...)` - cellphone, email, physical + postal addresses.
- `businessInformation(...)` - tax country, VAT, farmer flags, silo, etc.
- `peopleOfInterest(...)` - loops over the "|" delimited PI fields.
- `Fica(fica_date)`, `Session(session_date)` - optional sub-forms triggered
  by Excel flags.
- `enterAccountInfo(accountNumber, ...)` - assigns the account number and
  any sheet-specific extras (trial balance indicator, product type, etc.).
- `saveClient()` - submits the wizard and asserts the "Success" and
  "Client created successfully" toasts.

The class is instantiated per test with `(page, accountType)`; the
constructor logs the account type so the console trace shows which branch
is running.

---

## 9. Data-Driven Spec (tests/workflows/create-client.spec.ts)

High-level logic:

```ts
const workbookData = getWorkbookData();

Object.entries(workbookData).forEach(([sheetName, rows]) => {
  test.describe(sheetName, () => {
    rows.forEach((row) => {
      test(`${row['TC-No']}`, async ({ page }) => {

        // 1. Expose row context to the reporter.
        test.info().annotations.push({ type: 'account',    description: row['Account number'] });
        test.info().annotations.push({ type: 'identifier', description: row['ID number'] || row['Business registration num'] });

        // 2. Resumability: skip rows already recorded as passed/duplicate.
        const resultsKey = makeKey(row['Account number'], row['TC-No']);
        const previous = findEntry(resultsKey);
        if (previous && (previous.status === 'passed' || previous.status === 'duplicate')) {
          test.skip(true, `Already '${previous.status}' in testResults.json`);
        }

        // 3. Dispatch to the correct account-type branch.
        switch (sheetName) {
          case 'Monthly accounts':             /* build client via CreateAccountPage */ break;
          case 'Cash accounts (Miscellane) (ZL)': ... break;
          case 'Maise account (X)':            ... break;
          case 'Production & Month account(A-S)': ... break;
        }
      });
    });
  });
});
```

Design points:

- **One test per Excel row**, so the HTML report, the PDF report and
  Playwright's own filters (`-g TC-01`) all operate at row granularity.
- **Sheet name == test.describe title == PDF group**: this is the single
  piece of metadata that ties data, UI branch and report row together.
- **Annotations are the metadata channel** between the spec and the custom
  reporter. They are the reason the reporter can print the account number
  and ID / Reg number without parsing the Excel file itself.

---

## 10. Resumable Runs (utils/testResultsStore.ts + reports/testResults.json)

`reports/testResults.json` is the authoritative, cross-run record of what
has already been done. Shape:

```json
{
  "entries": [
    {
      "key": "ZD01749000",
      "testNo": "TC-MA-02",
      "sheetName": "Monthly accounts",
      "identifier": "2011/005182/07",
      "accountNumber": "ZD01749000",
      "status": "passed",
      "isDuplicate": false,
      "durationSec": 57.69,
      "error": "",
      "screenshots": [],
      "lastRunAt": "2026-10-12T10:35:34.483Z"
    }
  ]
}
```

The helper module exposes:

- `makeKey(accountNumber, testNo)` - key is the Account number, falling
  back to TC-No when the account column is blank.
- `findEntry(key)` - used by the spec to decide whether to skip.
- `upsertEntry(entry)` - used by the reporter to insert or replace by key.
- `readResultsFile() / writeResultsFile(data)` - low-level IO.

The skip rule the spec enforces is simple:

```
if previous.status in {'passed', 'duplicate'}  ->  test.skip(...)
otherwise                                      ->  run and let the reporter
                                                   overwrite the entry
```

The reporter adds one safety rule when writing back: a prior `passed` or
`duplicate` entry is NEVER downgraded to `skipped` or `interrupted` by a
later run (only `lastRunAt` is bumped). This means stopping Ctrl-C in the
middle of a batch is always safe.

---

## 11. Custom PDF Reporter (reporters/pdf-reporter.ts)

The reporter implements Playwright's `Reporter` interface and owns three
responsibilities:

1. **Capture per-test metadata** (`onTestEnd`):
   - Reads the test's annotations to pull out the account number and
     identifier.
   - Records duration, status, and (for failures) the error message.
   - Calls `upsertEntry(...)` on `testResultsStore` so the JSON stays
     authoritative, preserving prior `passed/duplicate` entries.
   - If the test failed/timed-out, queues the test's attachments
     (screenshot, video, trace) for later copying.

2. **Render the PDF** (`onEnd`):
   - Creates a new folder `reports/reportNN/` (NN auto-increments).
   - Reads `testResults.json` and renders the report from it. This means
     rows skipped this run still appear in the PDF with their last-known
     status.
   - Page layout:
     - Centered NWK logo at the top.
     - Title: `${projectName}-test data automation report`.
     - Header lines: Generated timestamp, "Automation framework:
       playwright.", total run time.
     - Execution Summary box: Total / Passed / Failed / Skipped.
     - Grouped table: one sub-heading per sheet (describe title), one row
       per test with TC-No, ID / Reg No, STATUS, DURATION. Rows whose
       stored status is `duplicate` render as "DUPLICATE" in blue.

3. **Copy failure evidence** (`onExit`):
   - For each failed/timed-out test queued in step 1, creates
     `reports/reportNN/<safe test name>/` and copies the attachments
     (screenshot, video, trace) plus a plain `error.txt` with the stack.
   - Folder-name conflicts are disambiguated with the project name and a
     counter, and names are sanitised for Windows filesystem rules.

Why the PDF is rendered from the JSON instead of the current run's
results: in a resumable workflow most rows are often skipped in a given
run, and the stakeholder opening the PDF wants to see the latest known
status of every row, not just the ones that happened to execute today.

---

## 12. Reports and Evidence Layout

After a run, the following artefacts exist:

- `reports/testResults.json` - updated with the latest per-row status.
- `reports/reportNN/reportNN.pdf` - the human-readable PDF for this run.
- `reports/reportNN/<Test Name>/` - only for tests that failed in this
  run; contains the raw screenshot, video, trace zip and `error.txt`.
- `playwright-report/` - the standard Playwright HTML report (always
  overwritten, so this is only useful for the most recent run).

---

## 13. End-to-End Execution Walk-through

1. Operator runs `npx playwright test` (optionally `--headed`).
2. Playwright executes the `setup` project:
   - `login.setup.ts` logs into QA, saves `storageState.json`.
3. Playwright starts the `chromium` project (depends on `setup`):
   - Each Chromium worker launches with the saved storage state.
   - `create-client.spec.ts` is loaded; at module load time
     `getWorkbookData()` reads the Excel file and generates one
     `test()` per row inside a `test.describe(sheetName)`.
4. For every generated test, in order:
   - Account / identifier annotations are pushed.
   - `testResults.json` is consulted; if the row was already `passed` or
     `duplicate`, `test.skip(...)` is called and the test ends early.
   - Otherwise the matching sheet branch instantiates `CreateAccountPage`
     and walks the Create Client wizard until `saveClient()` succeeds or
     an expect fails.
5. For each test, the PDF reporter:
   - Upserts the entry in `testResults.json` (never downgrading a prior
     `passed/duplicate`).
   - Queues attachments for failing tests.
6. When the suite ends:
   - `onEnd` builds a new `reports/reportNN/` folder, reads
     `testResults.json`, and renders `reportNN.pdf`.
   - `onExit` writes the per-failed-test evidence folders.
7. Playwright's own `html` reporter also writes `playwright-report/`.

A second invocation of `npx playwright test` with no changes will show
every already-passed row as `skipped` in the console but still produce a
full PDF showing all historical statuses - exactly the behaviour needed
for a long-running test-data generation batch that is paused and resumed
over several days.

---

## 14. Extensibility Notes

- **New account type** - add a new sheet to `clientsData.xlsx` whose name
  matches a new `case` in `create-client.spec.ts`, and add any missing
  helper methods to `CreateAccountPage`.
- **New column** - add it to the Excel sheet; the spec passes it into the
  relevant Page Object method; no reader changes needed because
  `sheet_to_json(..., { defval: '' })` surfaces every column.
- **Different environment** - change `baseURL` in `playwright.config.ts`
  and the two URLs embedded in `login.setup.ts` / `CreateAccountPage.goToClientsList()`.
- **Reset the batch** - delete `reports/testResults.json`; the next run
  will re-attempt every row from scratch.
- **Force a specific row to re-run** - edit that row's `status` in
  `testResults.json` to anything other than `passed`/`duplicate`
  (e.g. `"failed"`) and run again.

---

## 15. Known Constraints / Assumptions

- All Playwright timeouts are disabled; the suite therefore relies on the
  explicit `waitFor` calls inside `CreateAccountPage`. A hung UI will
  hang the suite until the operator cancels the run.
- Workers are forced to 1 because the Create Client wizard touches
  shared, non-reentrant state in the QA app.
- The storage state produced by `login.setup.ts` is written to disk in
  plain JSON; it should be treated as a secret and is already covered by
  `.gitignore` on the repository root.
- `testResults.json` grows unbounded over time. For long campaigns the
  file can be archived and reset between batches.

---

End of document.
