const { validationResult } = require("express-validator");

function validateRequest(req, res, next) {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const error = new Error("Request validation failed");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    error.details = result.array().map(({ path, msg, location }) => ({ field: path, message: msg, location }));
    return next(error);
}

module.exports = validateRequest;
