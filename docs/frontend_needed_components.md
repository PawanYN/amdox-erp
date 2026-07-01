# Frontend Component Requests & Coordination

This document serves as a bridge between the Backend and Frontend teams. The backend team uses it to request components, notify about schema changes, and coordinate UI integrations.

## Requested & In-Progress Components

### 1. SCM Vendors — Add Vendor Form / Dialog
* **Requested by:** Backend Team
* **Status:** 🔴 Backlog (Stubbed in UI)
* **Details:** The "Add Vendor" button in the SCM Vendors dashboard currently triggers a console log stub. We need a dialog/modal form to collect vendor details and send them to the backend API.
* **API Endpoint:** `POST /scm/vendors`
* **Form Fields Required:**
  * **Name**: Text Input (Required)
  * **Email**: Email Input (Optional)
  * **Webhook URL**: URL Input (Optional)
  * **Is Active**: Checkbox (Optional, defaults to Checked/True)
* **Expected Payload:**
  ```json
  {
    "name": "string",
    "email": "string (optional)",
    "webhookUrl": "string (optional)",
    "isActive": "boolean (optional)"
  }
  ```
* **Tasks for Frontend Team:**
  - [ ] Add `createVendor` (POST), `updateVendor` (PATCH), and `deleteVendor` (DELETE) helpers to `scm-api.ts`.
  - [ ] Create a modal dialog triggered by the "Add Vendor" button.
  - [ ] Implement the form with Name, Email, Webhook URL fields, and the "Is Active" checkbox.
  - [ ] Implement validation (Name is required, Email/URL must be valid formats).
  - [ ] Call the backend API on submit and refresh the vendors table after successful creation.
  - [ ] Add "Edit" and "Delete" actions/buttons to each row in the vendors table.
  - [ ] Clicking "Edit" must open the form modal, pre-populated with the vendor's current details, and submit a PATCH request.
  - [ ] Clicking "Delete" must prompt for user confirmation, send a DELETE request, and refresh the table on success.

### 2. SCM Vendors — Update & Delete Endpoints
* **Requested by:** Backend Team
* **Status:** 🔴 Backlog
* **Update Endpoint:** `PATCH /scm/vendors/:id` (expects partial `name`, `email`, `webhookUrl`, or `isActive`)
* **Delete Endpoint:** `DELETE /scm/vendors/:id`


### 3. SCM Vendors — Phone & Rating Fields Mismatch
* **Requested by:** Backend Team
* **Status:** 🟡 Discussion / In-Progress
* **Details:** The SCM Vendors list page renders `Phone` and `Rating` columns, but these fields do not exist on the database model (`Vendor` model only has `id`, `name`, `email`, `webhookUrl`, `isActive`).
* **Coordination Needed:**
  * **Option A:** Backend team adds `phone` and `rating` to the database schema.
  * **Option B:** Frontend team removes these columns from the table.

