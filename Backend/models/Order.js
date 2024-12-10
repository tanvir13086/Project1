const { pool } = require('../config/database');

class Order {
    static async validateProducts(products) {
        const connection = await pool.getConnection();
        try {
            // Validate each product
            for (const item of products) {
                const [rows] = await connection.execute(
                    'SELECT price FROM products WHERE id = ?',
                    [item.productId]
                );

                if (rows.length === 0) {
                    throw new Error(`Product with ID ${item.productId} not found`);
                }

                const actualPrice = parseFloat(rows[0].price);
                const sentPrice = parseFloat(item.price);
                const calculatedTotal = actualPrice * item.productQuantity;
                
                // Verify price matches
                if (Math.abs(actualPrice - sentPrice) > 0.01) {
                    throw new Error(`Price mismatch for product ${item.productId}`);
                }

                // Verify total price
                if (Math.abs(calculatedTotal - item.productTotalPrice) > 0.01) {
                    throw new Error(`Total price mismatch for product ${item.productId}`);
                }
            }

            // Validate gross total
            const calculatedGrossTotal = products.reduce(
                (sum, item) => sum + item.productTotalPrice, 
                0
            );

            return calculatedGrossTotal;
        } finally {
            connection.release();
        }
    }

    static async createOrder(userId, orderData, products, totalAmount) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Create main order
            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    user_id, full_name, address, city, state, 
                    zip_code, bkash_number, transaction_id, total_amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    orderData.fullName,
                    orderData.address,
                    orderData.city,
                    orderData.state,
                    orderData.zipCode,
                    orderData.bkashNumber,
                    orderData.transactionId,
                    totalAmount
                ]
            );

            const orderId = orderResult.insertId;

            // Insert order items
            for (const item of products) {
                await connection.execute(
                    `INSERT INTO order_items (
                        order_id, product_id, quantity, 
                        price_at_time, total_price
                    ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        item.productId,
                        item.productQuantity,
                        item.price,
                        item.productTotalPrice
                    ]
                );

                // Update product stock
                await connection.execute(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [item.productQuantity, item.productId]
                );
            }

            await connection.commit();
            return orderId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getOrdersWithStats(page = 1, limit = 50) {
        const connection = await pool.getConnection();
        
        try {
            // Calculate offset for pagination
            const offset = (page -1) * limit;

            // Get paginated orders
            const [orders] = await connection.execute(
                `SELECT 
                    o.id,
                    o.transaction_id,
                    o.full_name,
                    o.total_amount,
                    o.status,
                    o.created_at,
                    u.email as user_email
                FROM orders o
                JOIN users u ON o.user_id = u.id
                ORDER BY o.created_at DESC
                LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            // Get total counts and statistics
            const [stats] = await connection.execute(`
                SELECT
                    COUNT(*) as total_checkouts,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
                    SUM(CASE WHEN status = 'ontransit' THEN 1 ELSE 0 END) as ontransit_count,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled_count
                FROM orders
            `);

            // Calculate pagination info
            const totalPages = Math.ceil(stats[0].total_checkouts / limit);

            return {
                orders,
                stats: stats[0],
                pagination: {
                    totalPages,
                    currentPage: page,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    nextPage: page < totalPages ? page + 1 : null,
                    prevPage: page > 1 ? page - 1 : null
                }
            };

        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getOrderDetails(orderId) {
        const connection = await pool.getConnection();
        
        try {
            // Get main order details with user information
            const [orderDetails] = await connection.execute(
                `SELECT 
                    o.id,
                    o.transaction_id,
                    o.full_name,
                    o.address,
                    o.city,
                    o.state,
                    o.zip_code,
                    o.bkash_number,
                    o.total_amount,
                    o.status,
                    o.created_at,
                    u.email as user_email,
                    u.phone as user_phone
                FROM orders o
                JOIN users u ON o.user_id = u.id
                WHERE o.id = ?`,
                [orderId]
            );

            if (!orderDetails.length) {
                throw new Error('Order not found');
            }

            // Get ordered products details
            const [orderItems] = await connection.execute(
                `SELECT 
                    oi.product_id,
                    oi.quantity,
                    oi.price_at_time,
                    oi.total_price,
                    p.name as product_name,
                    p.authors,
                    p.image_url
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?`,
                [orderId]
            );

            return {
                orderInfo: orderDetails[0],
                orderItems
            };

        } catch (error) {
            console.error('Error fetching order details:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getUserOrders(userId) {
        const connection = await pool.getConnection();
        
        try {
            // Get all orders for the user
            const [orders] = await connection.execute(
                `SELECT 
                    o.id,
                    o.transaction_id,
                    o.full_name,
                    o.address,
                    o.city,
                    o.state,
                    o.zip_code,
                    o.total_amount,
                    o.status,
                    o.created_at
                FROM orders o
                WHERE o.user_id = ?
                ORDER BY o.created_at DESC`,
                [userId]
            );

            // For each order, get its items
            const ordersWithItems = await Promise.all(orders.map(async (order) => {
                const [items] = await connection.execute(
                    `SELECT 
                        oi.product_id,
                        oi.quantity,
                        oi.price_at_time,
                        oi.total_price,
                        p.name as product_name,
                        p.authors,
                        p.image_url
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = ?`,
                    [order.id]
                );

                return {
                    ...order,
                    items
                };
            }));

            return ordersWithItems;

        } catch (error) {
            console.error('Error fetching user orders:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Order;