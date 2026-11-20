const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");
const app = require("../server");

const dataFile = path.join(__dirname, "..", "data", "orders.json");
const originalData = fs.readFileSync(dataFile, "utf8");
let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.writeFileSync(dataFile, originalData, "utf8");
});

async function request(route, options) {
    const response = await fetch(`${baseUrl}${route}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...(options?.body ? { body: JSON.stringify(options.body) } : {})
    });
    return { response, body: await response.json() };
}

test("order API validates input, paginates, and supports CRUD and webhook updates", async () => {
    const list = await request("/api/v1/orders?page=1&limit=1");
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.meta.pagination.total, 4);

    const filtered = await request("/api/v1/orders?status=delivered&q=Sam");
    assert.equal(filtered.response.status, 200);
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].customerName, "Sam Rivera");

    const invalidQuery = await request("/api/v1/orders?page=0");
    assert.equal(invalidQuery.response.status, 400);
    assert.equal(invalidQuery.body.error.code, "VALIDATION_ERROR");

    const docs = await request("/api-docs.json");
    assert.equal(docs.response.status, 200);
    assert.ok(docs.body.paths["/orders"].get);
    assert.ok(docs.body.paths["/webhooks/orders"].post);

    const invalid = await request("/api/v1/orders", {
        method: "POST",
        body: { customerName: "X", email: "not-an-email", items: [] }
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.success, false);
    assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(invalid.body.error.details));

    const created = await request("/api/v1/orders", {
        method: "POST",
        body: {
            customerName: "Taylor Green",
            email: "taylor.green@example.com",
            items: [{ name: "Pen Set", quantity: 2, unitPrice: 3.25 }]
        }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.total, 6.5);
    const orderId = created.body.data.id;

    const updated = await request(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        body: { status: "confirmed" }
    });
    assert.equal(updated.body.data.status, "confirmed");

    const webhook = await request("/api/v1/webhooks/orders", {
        method: "POST",
        body: { orderId, event: "order.status_changed", status: "shipped" }
    });
    assert.equal(webhook.response.status, 200);
    assert.equal(webhook.body.data.order.status, "shipped");
    assert.ok(webhook.body.data.eventId);

    const deleted = await request(`/api/v1/orders/${orderId}`, { method: "DELETE" });
    assert.equal(deleted.response.status, 200);
    const missing = await request(`/api/v1/orders/${orderId}`);
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.error.code, "ORDER_NOT_FOUND");
});
