# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses and visualize spending by category. Users can add transactions via a form, view and delete them in a scrollable list, see a running total balance, and view a pie chart of spending distribution by category. The app runs entirely in the browser using HTML, CSS, and JavaScript.

## Glossary

- **App**: The Expense & Budget Visualizer web application
- **Transaction**: A single spending record consisting of an item name, amount, and category
- **Category**: A fixed label used to group transactions — one of: Food, Transport, Fun
- **Transaction_List**: The scrollable UI component displaying all recorded transactions
- **Balance**: The sum of all transaction amounts currently in the Transaction_List
- **Chart**: The pie chart visualizing spending distribution across categories

---

## Requirements

### Requirement 1: Add Transaction Form

**User Story:** As a user, I want to fill out a form to add a transaction, so that I can record my spending quickly.

#### Acceptance Criteria

1. THE App SHALL provide a form with fields for Item Name, Amount, and Category (Food, Transport, Fun).
2. WHEN the user submits the form with all fields filled and a valid positive amount, THE App SHALL add the transaction to the Transaction_List.
3. IF the user submits the form with any field empty, THEN THE App SHALL display a validation error and prevent the transaction from being added.
4. IF the user submits the form with a non-positive or non-numeric amount, THEN THE App SHALL display a validation error and prevent the transaction from being added.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a list of all my transactions, so that I can review what I've recorded.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all added transactions, each showing the item name, amount, and category.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible area.
3. WHEN the user deletes a transaction, THE App SHALL remove that transaction from the Transaction_List.

---

### Requirement 3: Total Balance

**User Story:** As a user, I want to see my total spending at a glance, so that I know how much I've spent overall.

#### Acceptance Criteria

1. THE App SHALL display the total balance as the sum of all transaction amounts at the top of the page.
2. WHEN a transaction is added, THE App SHALL update the total balance to reflect the new sum.
3. WHEN a transaction is deleted, THE App SHALL update the total balance to reflect the new sum.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL display a pie chart showing the proportion of total spending for each category (Food, Transport, Fun).
2. WHEN a transaction is added, THE App SHALL update the chart to reflect the new spending distribution.
3. WHEN a transaction is deleted, THE App SHALL update the chart to reflect the new spending distribution.
4. IF there are no transactions, THE App SHALL display an empty-state message in place of the chart.
