import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { householdErrorMessage } from "./api-errors";

describe("householdErrorMessage", () => {
  it("hides raw database text and names the migration when tables are missing", () => {
    assert.equal(
      householdErrorMessage('relation "public.households" does not exist').error,
      "migration_required",
    );
    assert.equal(householdErrorMessage("already_in_household").status, 409);
    assert.equal(householdErrorMessage("invite_not_found").status, 404);
    assert.match(householdErrorMessage("duplicate key").message, /נכשלה/);
  });
});
