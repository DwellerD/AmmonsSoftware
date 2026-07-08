import { test } from "./fixtures";
import {
  runInviteAcceptEditAndRemoveFlow,
  runInviteRejectFlow,
} from "./flows/projectSharingFlows";

/**
 * Scenario 8 — project sharing controls and invite decisions.
 */
test.describe("Project sharing and invite lifecycle", () => {
  test("owner can edit or remove member access from revoke dialog", ({ app }, testInfo) =>
    runInviteAcceptEditAndRemoveFlow(app, testInfo));

  test("invitee can reject invite and owner sees rejected status", ({ app }, testInfo) =>
    runInviteRejectFlow(app, testInfo));
});
