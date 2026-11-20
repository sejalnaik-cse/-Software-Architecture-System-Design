const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const dataDirectory = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDirectory, "orders.json");

function readOrders() {
    try {
        return JSON.parse(fs.readFileSync(dataFile, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        fs.mkdirSync(dataDirectory, { recursive: true });
        fs.writeFileSync(dataFile, "[]\n", "utf8");
        return [];
    }
}

function writeOrders(orders) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, dataFile);
}

function calculateTotal(items) {
    return Number(items.reduce((total, item) => total + item.quantity * item.unitPrice, 0).toFixed(2));
}

function listOrders() {
    return readOrders();
}

function findOrder(id) {
    return readOrders().find((order) => order.id === id) || null;
}

function createOrder(payload) {
    const now = new Date().toISOString();
    const order = {
        id: randomUUID(),
        customerName: payload.customerName,
        email: payload.email,
        status: payload.status || "pending",
        items: payload.items,
        total: calculateTotal(payload.items),
        createdAt: now,
        updatedAt: now
    };
    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);
    return order;
}

function updateOrder(id, payload) {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return null;

    const order = { ...orders[index], ...payload, updatedAt: new Date().toISOString() };
    if (payload.items) order.total = calculateTotal(payload.items);
    orders[index] = order;
    writeOrders(orders);
    return order;
}

function deleteOrder(id) {
    const orders = readOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return null;

    const [deletedOrder] = orders.splice(index, 1);
    writeOrders(orders);
    return deletedOrder;
}

module.exports = { listOrders, findOrder, createOrder, updateOrder, deleteOrder };
