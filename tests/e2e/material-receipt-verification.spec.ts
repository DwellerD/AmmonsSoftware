import { test } from "./fixtures";
import { runMaterialReceiptVerificationTest } from "./flows/materialReceiptFlows";

test.describe("Material receipt verification", () => {
  test("receiver uploads delivery photos and GC verifies receipt", ({ app }, testInfo) =>
    runMaterialReceiptVerificationTest(app, testInfo));
});