const User = require('../models/User');
const JWTUtil = require('../utils/jwt');

class AuthController {
    static async signin(req, res) {
        try {
            const { email, password } = req.body;
            // console.log(email, password);

            // Check if the request is for admin login
            if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
                // Create admin payload for token
                const adminPayload = {
                    name: process.env.ADMIN_NAME,
                    email: process.env.ADMIN_EMAIL,
                    role: 'admin',
                    isAdmin: true
                };

                // Generate JWT token
                const token = JWTUtil.generateToken(adminPayload);

                // Set token in cookie
                JWTUtil.setTokenCookie(res, token);

                // Send response with admin data
                return res.json({
                    success: true,
                    message: 'Admin login successful',
                    data: {
                        token,
                        admin: {
                            name: process.env.ADMIN_NAME,
                            email: process.env.ADMIN_EMAIL,
                            role: 'admin'
                        }
                    }
                });
            }

            // Verify user credentials and check if user exists
            const user = await User.verifyCredentials(email, password);

            // Generate JWT token with user information
            const token = JWTUtil.generateToken({
                id: user.id,
                email: user.email,
                role: user.role
            });

            // Set token in cookies
            JWTUtil.setTokenCookie(res, token);


            // Send success response with user data
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: user.role
                    }
                }
            });

        } catch (error) {
            console.error('Authentication error:', error);

            // Handle specific errors
            if (error.message === 'Invalid credentials') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Authentication failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = AuthController;