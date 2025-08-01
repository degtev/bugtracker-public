import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        userType: string;
    };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Нет токена авторизации' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Токен отсутствует' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            email: string;
            role: string;
            iat: number;
            exp: number;
        };

        req.user = {
            userId: decoded.id,
            userType: decoded.role,
        };

        next();
    } catch {
        res.status(401).json({ message: 'Неверный токен' });
    }
}
