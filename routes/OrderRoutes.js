const express = require("express");
const { body, param, query } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const store = require("../lib/orderStore");

const router = express.Router();
const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const allowedOrderFields = ["customerName", "email", "status", "items"];

function onlyAllowedFields(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Request body must be an object");
    }
    const unexpected = Object.keys(value).filter((key) => !allowedOrderFields.includes(key));
    if (unexpected.length) throw new Error(`Unexpected field: ${unexpected.join(", ")}`);
    if (Object.keys(value).length === 0) throw new Error("Request body must not be empty");
    return true;
}

function orderBodyValidation(partial = false) {
    const optional = partial ? { nullable: false, checkFalsy: false, values: "undefined" } : undefined;
    const fields = [
        body().custom(onlyAllowedFields),
        body("customerName").trim().isLength({ min: 2, max: 100 }).withMessage("Must be 2–100 characters")
            .optional(optional),
        body("email").trim().isEmail().withMessage("Must be a valid email address").normalizeEmail()
            .optional(optional),
        body("status").isIn(statuses).withMessage(`Must be one of: ${statuses.join(", ")}`)
            .optional(optional),
        body("items").isArray({ min: 1, max: 50 }).withMessage("Must contain between 1 and 50 items")
            .optional(optional),
        body("items.*.name").trim().isLength({ min: 1, max: 120 }).withMessage("Must be 1–120 characters")
            .optional(optional),
        body("items.*.quantity").isInt({ min: 1, max: 100000 }).withMessage("Must be a positive whole number")
            .toInt().optional(optional),
        body("items.*.unitPrice").isFloat({ min: 0, max: 10000000 }).withMessage("Must be a non-negative price")
            .toFloat().optional(optional)
    ];

    if (!partial) {
        fields.splice(1, 0,
            body("customerName").exists().withMessage("Customer name is required"),
            body("email").exists().withMessage("Email is required"),
            body("items").exists().withMessage("Items are required")
        );
    }
    return fields;
}

const orderIdValidation = param("id").isUUID().withMessage("Order id must be a UUID");

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: List orders with filtering and pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled] }
 *       - in: query
 *         name: q
 *         description: Search customer name and email
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated order list }
 */
router.get("/", [
    query("page").optional().isInt({ min: 1 }).withMessage("Must be a positive integer").toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Must be between 1 and 100").toInt(),
    query("status").optional().isIn(statuses).withMessage(`Must be one of: ${statuses.join(", ")}`),
    query("q").optional().isString().trim().isLength({ max: 100 }).withMessage("Must be at most 100 characters"),
    query("sort").optional().isIn(["createdAt", "updatedAt", "total"]).withMessage("Unsupported sort field"),
    query("order").optional().isIn(["asc", "desc"]).withMessage("Must be asc or desc"),
    query("email").optional().isEmail().withMessage("Must be a valid email address").normalizeEmail(),
    validateRequest
], (req, res) => {
    const { page = 1, limit = 10, status, q, email, sort = "createdAt", order = "desc" } = req.query;
    let orders = store.listOrders();
    if (status) orders = orders.filter((item) => item.status === status);
    if (email) orders = orders.filter((item) => item.email === email);
    if (q) {
        const search = q.toLowerCase();
        orders = orders.filter((item) => item.customerName.toLowerCase().includes(search)
            || item.email.toLowerCase().includes(search));
    }
    orders.sort((a, b) => {
        const comparison = sort === "total" ? a.total - b.total : a[sort].localeCompare(b[sort]);
        return order === "asc" ? comparison : -comparison;
    });

    const total = orders.length;
    const totalPages = Math.ceil(total / limit);
    const data = orders.slice((page - 1) * limit, page * limit);
    return res.json({
        success: true,
        data,
        meta: { pagination: { page, limit, total, totalPages } }
    });
});

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Create an order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, email, items]
 *             properties:
 *               customerName: { type: string }
 *               email: { type: string, format: email }
 *               status: { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled] }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, quantity, unitPrice]
 *                   properties:
 *                     name: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *                     unitPrice: { type: number, minimum: 0 }
 *     responses:
 *       201: { description: Created order }
 *       400: { description: Validation error }
 */
router.post("/", orderBodyValidation(), validateRequest, (req, res) => {
    const order = store.createOrder(req.body);
    return res.status(201).json({ success: true, data: order, message: "Order created" });
});

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Get an order by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Order details }
 *       404: { description: Order not found }
 */
router.get("/:id", orderIdValidation, validateRequest, (req, res) => {
    const order = store.findOrder(req.params.id);
    if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }
    return res.json({ success: true, data: order });
});

/**
 * @openapi
 * /orders/{id}:
 *   put:
 *     summary: Replace an order's editable fields
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated order }
 *       400: { description: Validation error }
 *       404: { description: Order not found }
 *   patch:
 *     summary: Update some order fields
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated order }
 *       400: { description: Validation error }
 *       404: { description: Order not found }
 *   delete:
 *     summary: Delete an order
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Deleted order id }
 *       404: { description: Order not found }
 */
router.put("/:id", orderIdValidation, ...orderBodyValidation(), validateRequest, (req, res) => {
    const order = store.updateOrder(req.params.id, req.body);
    if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }
    return res.json({ success: true, data: order, message: "Order updated" });
});

router.patch("/:id", orderIdValidation, ...orderBodyValidation(true), validateRequest, (req, res) => {
    const order = store.updateOrder(req.params.id, req.body);
    if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }
    return res.json({ success: true, data: order, message: "Order updated" });
});

router.delete("/:id", orderIdValidation, validateRequest, (req, res) => {
    const order = store.deleteOrder(req.params.id);
    if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }
    return res.json({ success: true, data: { id: order.id }, message: "Order deleted" });
});

module.exports = router;
