import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { tinyPngFile } from "../helpers/files";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName } from "../helpers/testData";

export async function runMaterialReceiptVerificationTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, projects, materialOrders, page } = app;
  const projectName = uniqueName("Receipt project");
  const materialName = uniqueName("Window package");

  await loginPage.signInAsGc();
  await projects.createProject(projectName);
  await materialOrders.createMaterialOrder({
    projectName,
    materialName,
    supplier: "Northwest Windows",
  });
  await materialOrders.openMaterial(materialName);
  const uploadUrl = await materialOrders.generateReceiptUploadLink();
  await captureMilestone(page, testInfo, "GC generated receipt upload link");

  await nav.signOut();
  await page.goto(uploadUrl);
  await page.getByLabel("Your name (optional)").fill("Site receiver");
  await page.getByLabel("Notes (optional)").fill("All pallets unloaded at staging.");
  await page.getByLabel("Delivery photos").setInputFiles(
    tinyPngFile("material-receipt.png"),
  );
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await page.getByText("Delivery photos submitted for GC verification.").waitFor();
  await captureMilestone(page, testInfo, "Receiver submitted delivery proof");

  await loginPage.signInAsGc();
  await materialOrders.openMaterial(materialName);
  await materialOrders.expectPendingVerification();
  await materialOrders.markReceiptReceived();
  await captureMilestone(page, testInfo, "GC verified material receipt");
}