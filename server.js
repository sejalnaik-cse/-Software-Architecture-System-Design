require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const orderRoutes = require("./routes/OrderRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

const {
    notFoundHandler,
    errorHandler
} = require("./middleware/errorHandler");

const app = express();

const PORT = process.env.PORT || 3000;

// 1. Security Middleware
app.use(helmet());

app.use(cors());

app.use(express.json());

// 2. Rate Limiting
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: "draft-7",
        legacyHeaders: false
    })
);

// 3. Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Order Management API",
            version: "1.0.0",
            description: "Order Management REST API Documentation"
        },
        servers: [
            {
                url: "http://localhost:3000"
            }
        ]
    },
    apis: ["./routes/*.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// 4. Home API
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Order Management API is running!"
    });
});

// 5. Health Check API
app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is healthy"
    });
});

// 6. Swagger JSON Documentation
app.get("/api-docs.json", (req, res) => {
    res.json(swaggerSpec);
});

// 7. Swagger UI Documentation
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// 8. Order Routes
app.use("/api/v1/orders", orderRoutes);

// 9. Webhook Routes
app.use("/api/v1/webhooks", webhookRoutes);

// 10. Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// 11. Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`Swagger JSON: http://localhost:${PORT}/api-docs.json`);
});