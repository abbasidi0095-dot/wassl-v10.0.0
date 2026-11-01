import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const orderPayload = {
  citySlug: "dakhla",
  storeId: "store_dakhla_grill",
  customerName: "E2E Staff",
  customerPhone: "+212 600 777 666",
  address: "12 Rue de la Plage",
  landmark: "Near the lighthouse",
  lat: 23.69,
  lng: -15.94,
  items: [{ productId: "product_001", qty: 1 }],
};

const ADMIN_EMAIL = "admin@wassl.ma";
const ADMIN_PASSWORD = "admin";
const STORE_EMAIL = "store@wassl.ma";
const STORE_PASSWORD = "Wsl-Store-4Dkh!2026";
const DRIVER_EMAIL = "driver@wassl.ma";
const DRIVER_PASSWORD = "Wsl-Driver-9Lay!2026";

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const response = await request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
}

/** Complete the email + password sign-in flow in the browser. */
async function loginViaUi(
  page: Page,
  email: string,
  password: string,
  expectedPath: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(expectedPath), {
    timeout: 15_000,
  });
}

async function signupMerchant(
  page: Page,
  input: { email: string; name: string; password: string; storeName: string },
) {
  await page.goto("/signup?role=merchant");
  await page.getByLabel("Full name").fill(input.name);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Phone").fill("+212 600 111 222");
  await page.getByLabel("Store name").fill(input.storeName);
  await page.getByLabel("Password", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm password").fill(input.password);

  // The signup response carries the test-mode code; production sends it by
  // email through Brevo and never returns it to the browser.
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/auth/signup") &&
        candidate.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  const body = (await response.json()) as { devCode?: string };
  expect(body.devCode).toMatch(/^\d{6}$/);
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

  for (let index = 0; index < 6; index += 1) {
    await page.getByLabel(`Digit ${index + 1}`).fill(body.devCode![index]);
  }
  await expect(page).toHaveURL(/\/pending/, { timeout: 15_000 });
}

test("refuses an illegal jump and records each legal transition", async ({ request }) => {
  await login(request, STORE_EMAIL, STORE_PASSWORD);

  const created = await request.post("/api/orders", { data: orderPayload });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as { order: { id: string } };

  const illegal = await request.post(`/api/orders/${order.id}/status`, {
    data: { status: "delivered" },
  });
  expect(illegal.status()).toBe(409);
  expect((await illegal.json()).code).toBe("illegal_transition");

  const unchanged = await request.get(`/api/orders/${order.id}`);
  expect(((await unchanged.json()) as { order: { status: string } }).order.status).toBe(
    "placed",
  );

  for (const status of ["accepted", "preparing", "ready"]) {
    const response = await request.post(`/api/orders/${order.id}/status`, {
      data: { status },
    });
    expect(response.ok()).toBeTruthy();
  }

  await login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const state = await request.get("/api/admin/state");
  const { auditLogs } = (await state.json()) as {
    auditLogs: {
      entityId: string;
      actorRole: string;
      action: string;
      after?: string;
    }[];
  };

  const mine = auditLogs.filter((entry) => entry.entityId === order.id);
  // Newest first, including the customer's create event.
  expect(mine.map((entry) => entry.after)).toEqual([
    "ready",
    "preparing",
    "accepted",
    "placed",
  ]);
  const transitions = mine.filter((entry) => entry.after !== "placed");
  expect(transitions.every((entry) => entry.actorRole === "merchant")).toBe(true);
  expect(transitions.every((entry) => entry.action.startsWith("order."))).toBe(true);
  expect(mine.some((entry) => entry.after === "delivered")).toBe(false);
});

test("blocks a merchant acting on another store's order", async ({ request }) => {
  const created = await request.post("/api/orders", { data: orderPayload });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as { order: { id: string } };

  await login(request, "sahara@wassl.ma", STORE_PASSWORD);
  const response = await request.post(`/api/orders/${order.id}/status`, {
    data: { status: "accepted" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe("wrong_store");
});

test("admin activity tab filters the audit trail by entity", async ({ page }) => {
  await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");

  const created = await page.request.post("/api/orders", { data: orderPayload });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as { order: { id: string; code: string } };

  const accepted = await page.request.post(`/api/orders/${order.id}/status`, {
    data: { status: "accepted" },
  });
  expect(accepted.ok()).toBeTruthy();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Activity" }).click();
  await page.getByLabel("Filter activity").selectOption("order");
  await expect(page.getByText(new RegExp(order.code)).first()).toBeVisible();

  await page.getByLabel("Filter activity").selectOption("city");
  await expect(page.getByText("No activity recorded for this entity yet.")).toBeVisible();
});

test("merchant sees a new order without reloading", async ({ page }) => {
  await loginViaUi(page, STORE_EMAIL, STORE_PASSWORD, "/merchant");

  const created = await page.request.post("/api/orders", {
    data: { ...orderPayload, customerName: "Live Merchant E2E" },
  });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as { order: { code: string } };

  await expect(page.getByText(order.code).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("driver receives a ready order live and activates the route", async ({
  page,
  request,
}) => {
  await login(request, STORE_EMAIL, STORE_PASSWORD);
  const created = await request.post("/api/orders", {
    data: { ...orderPayload, customerName: "Live Driver E2E" },
  });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as {
    order: { id: string; code: string };
  };

  for (const status of ["accepted", "preparing", "ready"]) {
    const response = await request.post(`/api/orders/${order.id}/status`, {
      data: { status },
    });
    expect(response.ok()).toBeTruthy();
  }

  await loginViaUi(page, DRIVER_EMAIL, DRIVER_PASSWORD, "/driver");

  const queueCard = page.locator(`[data-order-id="${order.id}"]`);
  await expect(queueCard).toBeVisible({ timeout: 15_000 });
  await queueCard.getByRole("button", { name: "Accept delivery" }).click();

  const routeCard = page.locator(`article[data-order-id="${order.id}"]`);
  await expect(routeCard).toBeVisible({ timeout: 15_000 });
  await expect(
    routeCard.getByRole("button", { name: /Picked up from store/ }),
  ).toBeVisible();
});

test("a brand-new store owner signs up and lands in review", async ({ page }) => {
  const email = `new-owner-${Date.now()}@wassl.test`;
  const password = "New-Owner-Pass-1!";

  await signupMerchant(page, {
    email,
    name: "New Owner",
    password,
    storeName: "New Owner Kitchen",
  });

  await expect(
    page.getByRole("heading", { name: /Almost there/i }),
  ).toBeVisible();
  await expect(page.getByText("Store owner", { exact: true }).first()).toBeVisible();
});

test("an admin approves a new account so it can enter its workspace", async ({
  page,
  browser,
}) => {
  const email = `approve-${Date.now()}@wassl.test`;
  const password = "Approved-Owner-Pass-1!";

  // 1. Self-service sign-up: pending until operations approves it.
  await signupMerchant(page, {
    email,
    name: "Approved Owner",
    password,
    storeName: "Approved Kitchen",
  });

  // 2. Operations approves it and gets a storefront provisioned.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUi(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");
  await adminPage.goto("/admin/accounts");

  const row = adminPage.getByRole("row", { name: new RegExp(email) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByText(/Storefront provisioned/i)).toBeVisible();
  await adminContext.close();

  // 3. The same email now signs in to the store workspace.
  await page.request.post("/api/auth/logout");
  await loginViaUi(page, email, password, "/merchant");
});

test("admin enables a service per city without disabling the others", async ({
  page,
}) => {
  await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");

  const patched = await page.request.patch("/api/admin/cities", {
    data: { cityId: "city_039", services: { express: true } },
  });
  expect(patched.ok()).toBeTruthy();
  const patchedBody = (await patched.json()) as {
    city: { services: Record<string, boolean> };
  };
  expect(patchedBody.city.services.express).toBe(true);
  expect(patchedBody.city.services.grocery).toBe(true);

  await page.goto("/admin");
  await page.getByRole("button", { name: "Cities" }).click();
  const row = page.locator("tr").filter({ hasText: "Dakhla" }).first();
  await row.getByRole("button", { name: "Services" }).click();
  const dialog = page.getByRole("dialog", { name: /Services in Dakhla/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator("label").filter({ hasText: "Express" }).locator("input"),
  ).toBeChecked();
  await expect(
    dialog.locator("label").filter({ hasText: "Grocery" }).locator("input"),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("admin grocery shows inventory intelligence", async ({ page }) => {
  await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");
  await page.goto("/admin/grocery");
  await expect(page.getByText("Inventory intelligence")).toBeVisible();
  await expect(page.getByText("Top sellers")).toBeVisible();
  await expect(page.getByText("Suggested restock")).toBeVisible();
  await expect(page.getByText("Stock movements")).toBeVisible();
});

test("admin adjusts Wassl Club points with an audited note", async ({ page }) => {
  await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");
  await page.goto("/admin/accounts");
  const row = page.locator("tr").filter({ hasText: "customer@wassl.ma" }).first();
  let step = 0;
  page.on("dialog", async (dialog) => {
    await dialog.accept(step === 0 ? "25" : "E2E goodwill");
    step += 1;
  });
  await row.getByRole("button", { name: "Adjust" }).click();
  await expect(page.getByText(/25 points for/)).toBeVisible();
  await expect(row.getByText("25")).toBeVisible();
});
