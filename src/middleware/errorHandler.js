/**
 * Global error handling middleware
 * Must be used after all routes
 */
const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);

    // If response already sent, delegate to default handler
    if (res.headersSent) {
        return next(err);
    }

    // Determine status code
    const statusCode = err.status || err.statusCode || 500;

    // Error response
    const errorResponse = {
        error: err.message || "Internal Server Error",
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === "development") {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Must be used after all routes but before error handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
