# Frontend Component Requests & Coordination

This document serves as a bridge between the Backend and Frontend teams. The backend team uses it to request components, notify about schema changes, and coordinate UI integrations.

> **Update:** all 3 items below are now done — verified against the code. Kept here (rather than deleted) as a record of what was coordinated and resolved.

## Requested & In-Progress Components

### 1. SCM Vendors — Add Vendor Form / Dialog

- **Requested by:** Backend Team
- **Status:** ✅ Done — `apps/web/src/app/(dashboard)/scm/vendors/page.tsx` has a full add/edit `Modal` dialog (title toggles "Add Vendor"/"Edit Vendor"), calling `scmApi.createVendor()`/`scmApi.updateVendor()`, not a stub.
- **Details (as originally requested):** The "Add Vendor" button in the SCM Vendors dashboard currently triggers a console log stub. We need a dialog/modal form to collect vendor details and send them to the backend API.
- **API Endpoint:** `POST /scm/vendors`
- **Form Fields Required:**
  - **Name**: Text Input (Required)
  - **Email**: Email Input (Optional)
  - **Webhook URL**: URL Input (Optional)
  - **Is Active**: Checkbox (Optional, defaults to Checked/True)
- **Expected Payload:**
  ```json
  {
    "name": "string",
    "email": "string (optional)",
    "webhookUrl": "string (optional)",
    "isActive": "boolean (optional)"
  }
  ```
- **Tasks for Frontend Team:**
  - [x] Add `createVendor` (POST), `updateVendor` (PATCH), and `deleteVendor` (DELETE) helpers to `scm-api.ts`.
  - [x] Create a modal dialog triggered by the "Add Vendor" button.
  - [x] Implement the form with Name, Email, Webhook URL fields, and the "Is Active" checkbox.
  - [x] Implement validation (Name is required, Email/URL must be valid formats).
  - [x] Call the backend API on submit and refresh the vendors table after successful creation.
  - [x] Add "Edit" and "Delete" actions/buttons to each row in the vendors table.
  - [x] Clicking "Edit" must open the form modal, pre-populated with the vendor's current details, and submit a PATCH request.
  - [x] Clicking "Delete" must prompt for user confirmation, send a DELETE request, and refresh the table on success.

### 2. SCM Vendors — Update & Delete Endpoints

- **Requested by:** Backend Team
- **Status:** ✅ Done — `apps/api/src/scm/vendor/vendor.controller.ts` has both `@Patch(':id')` and `@Delete(':id')`, called from the frontend via `scmApi.updateVendor`/`scmApi.deleteVendor`.
- **Update Endpoint:** `PATCH /scm/vendors/:id` (expects partial `name`, `email`, `webhookUrl`, or `isActive`)
- **Delete Endpoint:** `DELETE /scm/vendors/:id`

### 3. SCM Vendors — Phone & Rating Fields Mismatch

- **Requested by:** Backend Team
- **Status:** ✅ Resolved — Option A taken for `phone` (added to the `Vendor` model in `packages/db/prisma/schema.prisma` and rendered from live data), Option B taken for `rating` (removed from the vendors page — it's no longer rendered at all).
- **Details (as originally requested):** The SCM Vendors list page renders `Phone` and `Rating` columns, but these fields do not exist on the database model (`Vendor` model only has `id`, `name`, `email`, `webhookUrl`, `isActive`).
