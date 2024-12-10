require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { testConnection } = require("./config/database");
const createTables = require("./config/createTables");
const productRoutes = require("./routes/products");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const checkoutRoutes = require("./routes/checkout");
const orderRoutes = require('./routes/orders');
// ... other imports ...

const app = express();

// Middleware
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://127.0.0.1:5501",
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// Basic health check route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to the BookStore API!",
    });
});

// Database Initialization
(async function initializeDatabase() {
    try {
        await testConnection();
        console.log("Database connected successfully");

        await createTables();
        console.log("Database tables initialized");
    } catch (error) {
        console.error("Database initialization failed:", error);
        process.exit(1); // Exit the process if DB setup fails
    }
})();

// Routes
app.use("/api/admin", adminRoutes);
app.use('/api/products', orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/checkout", checkoutRoutes);
 



// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
