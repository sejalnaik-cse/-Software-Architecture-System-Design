function notFoundHandler(req, res, next) {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    error.status = 404;
    error.code = "NOT_FOUND";
    next(error);
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = error.code || (status === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
    if (status >= 500) console.error(`[${req.id || "unknown"}]`, error);

    return res.status(status).json({
        success: false,
        error: {
            code,
            message: status === 500 ? "An unexpected error occurred" : error.message,
            ...(error.details ? { details: error.details } : {})
        },
        requestId: req.id
    });
}

module.exports = { notFoundHandler, errorHandler };
