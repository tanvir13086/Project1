const express = require('express');
const OrderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get user's orders
router.get('/myorders', authMiddleware, OrderController.getMyOrders);

module.exports = router;