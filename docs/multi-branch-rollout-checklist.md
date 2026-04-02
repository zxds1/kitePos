# Multi-Branch Rollout Checklist

Use this checklist when rolling out a branch with 2 to 5 tills.

## Before Rollout

- Confirm the parent shop account is active and can log in.
- Create the new branch from the owner or admin account.
- Create one checkout record for each physical till.
- Create one staff user per operator. Do not share the owner account.
- Set a temporary PIN for each staff user.
- Write down the staff phone number, assigned branch, and assigned checkout.
- Generate and store the recovery code for each staff user in a secure owner-only place.
- Export the current audit trail and archive it before go-live.

## Device Setup

- Install the app on each branch phone.
- Log in with the assigned staff phone number and temporary PIN.
- Complete the forced PIN change on first login.
- Confirm the app binds to the device after first successful login.
- Verify the correct branch auto-selects or appears in the branch selector.
- Verify the correct checkout auto-selects or is restricted correctly.

## Till Validation

- On every till, load products and confirm stock is visible.
- Record one test sale on each till.
- Confirm each sale appears under the correct branch and checkout.
- Confirm analytics show the branch data correctly after sync.
- Confirm a cashier cannot access another branch or checkout.
- Confirm a branch manager can only access assigned branch data.

## Offline Validation

- Turn one till offline and record a test sale.
- Keep another till online and record a different sale.
- Restore connectivity on the offline till.
- Confirm both sales sync without duplication.
- Confirm stock remains correct after both tills sync.

## Recovery Validation

- Reset one staff device binding from the owner account.
- Regenerate a recovery code.
- Use the recovery flow on a second phone.
- Confirm the old phone can no longer log in.
- Confirm the new phone can log in and complete work normally.

## Audit And Compliance

- Export the audit trail after branch setup.
- Save the exported JSON in an external owner-controlled archive.
- Keep each export with the rollout date in the file name.
- If your business needs stronger compliance, upload each export to immutable cloud storage such as object-lock storage or a company DMS with retention rules.

## Go-Live Signoff

- Branch created
- Checkouts created
- Staff users created
- PINs changed
- Device binding verified
- Offline sync verified
- Recovery flow verified
- Audit export archived
- Owner approved branch for live sales
