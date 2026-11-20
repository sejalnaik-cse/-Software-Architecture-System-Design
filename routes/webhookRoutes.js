const express = require("express");
const { body } = require("express-validator");
const validateRequest = require("../middleware/validateRequest");
const store = require("../lib/orderStore");

const router = express.Router();
const webhookStatuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"];

/**
 * @openapi
 * /webhooks/orders:
 *   post:
 *     summary: Simulate an order status webhook
 *     description: Applies a webhook event to the specified order and returns the event receipt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, event, status]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               event: { type: string, enum: [order.status_changed] }
 *               status: { type: string, enum: [confirmed, processing, shipped, delivered, cancelled] }
 *     responses:
 *       200: { description: Webhook accepted }
 *       400: { description: Validation error }
 *       404: { description: Order not found }
 */
router.post("/orders", [
    body("orderId").isUUID().withMessage("Order id must be a UUID"),
    body("event").equals("order.status_changed").withMessage("Event must be order.status_changed"),
    body("status").isIn(webhookStatuses).withMessage(`Must be one of: ${webhookStatuses.join(", ")}`),
    body().custom((value) => {
        const unexpected = Object.keys(value).filter((key) => !["orderId", "event", "status"].includes(key));
        if (unexpected.length) throw new Error(`Unexpected field: ${unexpected.join(", ")}`);
        return true;
    }),
    validateRequest
], (req, res) => {
    const order = store.updateOrder(req.body.orderId, { status: req.body.status });
    if (!order) {
        const error = new Error("Order not found");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
    }

    return res.json({
        success: true,
        data: {
            eventId: require("node:crypto").randomUUID(),
            event: req.body.event,
            receivedAt: new Date().toISOString(),
            order
        },
        message: "Webhook simulated"
    });
});

module.exports = router;
