const Order = require('../models/Order');

class OrderController {
    static async getMyOrders(req, res) {
        try {
            // Get user ID from auth middleware
            const userId = req.user.id;
            
            // Get all orders for the user
            const orders = await Order.getUserOrders(userId);

            // Format the response data
            const formattedOrders = orders.map(order => ({
                orderId: order.id,
                transactionId: order.transaction_id,
                orderDate: order.created_at,
                status: order.status,
                shippingAddress: {
                    fullName: order.full_name,
                    address: order.address,
                    city: order.city,
                    state: order.state,
                    zipCode: order.zip_code
                },
                orderSummary: {
                    totalAmount: parseFloat(order.total_amount),
                    totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0)
                },
                products: order.items.map(item => ({
                    productId: item.product_id,
                    name: item.product_name,
                    authors: item.authors,
                    imageUrl: item.image_url,
                    quantity: item.quantity,
                    pricePerUnit: parseFloat(item.price_at_time),
                    totalPrice: parseFloat(item.total_price)
                }))
            }));

            // Add order statistics
            const orderStats = {
                totalOrders: formattedOrders.length,
                statusCounts: formattedOrders.reduce((acc, order) => {
                    acc[order.status] = (acc[order.status] || 0) + 1;
                    return acc;
                }, {})
            };

            res.json({
                success: true,
                message: 'Orders retrieved successfully',
                data: {
                    orders: formattedOrders,
                    statistics: orderStats
                }
            });

        } catch (error) {
            console.error('Error in getMyOrders:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch orders',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = OrderController;