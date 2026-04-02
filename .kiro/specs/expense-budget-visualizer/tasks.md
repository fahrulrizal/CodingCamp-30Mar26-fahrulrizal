# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a single-page expense tracker as three files (`index.html`, `style.css`, `app.js`) using vanilla JavaScript, Chart.js via CDN, and localStorage for persistence. Implementation follows the data → render cycle defined in the design: every state mutation persists to localStorage and triggers a full re-render of all UI components.

## Tasks

- [x] 1. Create project files and HTML skeleton
  - Create `index.html` with the full page structure: balance display, add-transaction form (Item Name, Amount, Category select, submit button, error paragraph), transaction list container, and chart canvas
  - Create `style.css` with base layout styles (scrollable list, form layout, balance display, category badge, error text)
  - Create `app.js` with an empty module structure and a `DOMContentLoaded` entry point
  - Load Chart.js from CDN in `index.html`
  - _Requirements: 1.1, 2.2, 3.1, 4.1_

- [ ] 2. Implement storage and state
  - [x] 2.1 Implement `loadTransactions()` and `saveTransactions(transactions)`
    - `loadTransactions` reads and JSON-parses `"expense_transactions"` from localStorage; returns `[]` on missing key or parse error (log warning, do not throw)
    - `saveTransactions` JSON-serializes the array and writes it to localStorage; catches write errors and logs a warning
    - Initialize the in-memory `transactions` array by calling `loadTransactions()` on startup
    - _Requirements: 1.2, 2.3_

- [ ] 3. Implement core business logic
  - [x] 3.1 Implement `validateTransaction(name, amount, category)`
    - Returns an error string for: empty/whitespace name, empty amount, non-numeric amount, zero or negative amount, missing category
    - Returns `null` when all fields are valid
    - _Requirements: 1.3, 1.4_

  - [ ]* 3.2 Write property test for `validateTransaction` — Property 2: invalid input rejection
    - **Property 2: Invalid input rejection**
    - **Validates: Requirements 1.3, 1.4**
    - Use fast-check; generate inputs where at least one field is invalid (empty string, `0`, negative, `NaN`, non-numeric string); assert return value is a non-null string
    - `// Feature: expense-budget-visualizer, Property 2: invalid input rejection`

  - [x] 3.3 Implement `addTransaction(name, amount, category)`
    - Creates a `Transaction` object with a unique `id` (`crypto.randomUUID()` or `Date.now().toString()`), trimmed name, parsed amount, and category
    - Pushes to the in-memory array, calls `saveTransactions`, then re-renders all UI components
    - _Requirements: 1.2_

  - [ ]* 3.4 Write property test for `addTransaction` — Property 1: valid transaction addition
    - **Property 1: Valid transaction addition**
    - **Validates: Requirements 1.2**
    - Use fast-check; generate random non-empty string, positive finite number, random element of `["Food", "Transport", "Fun"]`; assert the updated list contains exactly one entry matching all three fields
    - `// Feature: expense-budget-visualizer, Property 1: valid transaction addition`

  - [x] 3.5 Implement `deleteTransaction(id)`
    - Filters the in-memory array to remove the entry with the matching `id`, calls `saveTransactions`, then re-renders all UI components
    - _Requirements: 2.3, 3.3, 4.3_

  - [x] 3.6 Implement `computeBalance(transactions)` and `computeCategoryTotals(transactions)`
    - `computeBalance` returns the arithmetic sum of all `amount` values; returns `0` for an empty array
    - `computeCategoryTotals` returns `{ Food: 0, Transport: 0, Fun: 0 }` with each key summed from matching transactions
    - _Requirements: 3.1, 4.1_

  - [ ]* 3.7 Write property test for `computeBalance` — Property 4: balance equals sum of amounts
    - **Property 4: Balance equals sum of amounts**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Use fast-check; generate random arrays of valid transactions; assert `computeBalance(transactions) === transactions.reduce((s, t) => s + t.amount, 0)`
    - `// Feature: expense-budget-visualizer, Property 4: balance equals sum of amounts`

  - [ ]* 3.8 Write property test for `computeCategoryTotals` — Property 5: category totals correctness
    - **Property 5: Category totals correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Use fast-check; generate random arrays of valid transactions; assert each category value equals the filtered sum
    - `// Feature: expense-budget-visualizer, Property 5: category totals correctness`

- [ ] 4. Checkpoint — Ensure business logic is correct
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement rendering functions
  - [ ] 5.1 Implement `renderBalance(transactions)`
    - Calls `computeBalance`, formats the result as currency (e.g. `$12.50`), and updates the balance DOM element
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Implement `renderTransactionList(transactions)`
    - Clears the list container and renders one row per transaction showing name, formatted amount, category badge, and a delete button wired to `deleteTransaction(id)`
    - When the array is empty, renders a "No transactions yet" placeholder instead
    - _Requirements: 2.1, 2.3_

  - [ ]* 5.3 Write property test for `renderTransactionList` — Property 3: transaction list reflects state
    - **Property 3: Transaction list reflects state**
    - **Validates: Requirements 2.1, 2.3**
    - Use fast-check; generate random arrays of 0–50 valid transactions; assert the rendered DOM contains exactly `transactions.length` rows, each with the correct name, amount, and category
    - `// Feature: expense-budget-visualizer, Property 3: transaction list reflects state`

  - [x] 5.4 Implement `renderChart(transactions)`
    - Calls `computeCategoryTotals` to get per-category sums
    - When transactions is empty: destroys any existing Chart.js instance, hides the canvas, and shows the empty-state message
    - When transactions exist: creates or updates a Chart.js `Pie` instance on the canvas with Food/Transport/Fun data; shows the canvas and hides the empty-state message
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. Implement form submission and wire everything together
  - [ ] 6.1 Implement `handleFormSubmit(event)`
    - Calls `event.preventDefault()`, reads form field values, calls `validateTransaction`
    - On error: displays the error string in the form's error `<p>` element and returns
    - On success: clears the error element, calls `addTransaction`, resets the form
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 6.2 Wire up event listeners and initial render in the `DOMContentLoaded` handler
    - Attach `handleFormSubmit` to the form's `submit` event
    - Call `renderBalance`, `renderTransactionList`, and `renderChart` with the loaded transactions on startup
    - _Requirements: 1.2, 2.1, 3.1, 4.1_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with a minimum of 100 iterations per the design spec
- No build step is required — open `index.html` directly in a browser to run the app
