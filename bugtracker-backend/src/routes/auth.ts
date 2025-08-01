import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

import pool, { query } from '../db';
import { User, createInvitation, getInvitationByToken, updateInvitationStatus, getInvitationsByInviter, getInvitedUsers, getUserById, createInvitationRequest, getInvitationRequests, updateInvitationRequestStatus, getInvitationRequestsByRequester, updateInvitationRegistrationTime, deleteUserSafely, getEmailNotificationSettings, updateEmailNotificationSettings } from '../models/user';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { renderEmailTemplate } from '../emailTemplates';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function isValidEmail(email: string) {
    const trimmedEmail = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
}


function trimEmail(email: string): string {
    return email.trim().toLowerCase();
}


async function userExists(email: string) {
    const trimmedEmail = trimEmail(email);
    const result = await query('SELECT 1 FROM users WHERE email = $1', [trimmedEmail]);
    return result.rows.length > 0;
}


router.post('/register/internal', async (req, res) => {
    try {
        const { email, password, first_name, last_name, position, role, avatar_url } = req.body;

        if (role !== 'internal') {
            return res.status(400).json({ message: 'Несуществующая роль' });
        }

        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
        }

        const trimmedEmail = trimEmail(email);

        if (!isValidEmail(trimmedEmail)) {
            return res.status(400).json({ message: 'Неверный формат почты' });
        }

        if (await userExists(trimmedEmail)) {
            return res.status(400).json({ message: 'Пользователь существует' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpiry = new Date(Date.now() + 15 * 60 * 1000);

        await query(
            `INSERT INTO email_verifications (email, verification_code, expires_at) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (email) 
             DO UPDATE SET verification_code = $2, expires_at = $3`,
            [trimmedEmail, verificationCode, codeExpiry]
        );

        const { subject, html } = renderEmailTemplate('register_confirmation', { verificationCode });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: trimmedEmail,
            subject,
            html
        });
        
        res.json({ message: 'Код подтверждения отправлен на ваш email' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email и пароль обязательны' });
        }

        const trimmedEmail = trimEmail(email);

        const result = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);

        if (result.rows.length === 0) {
            
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        const user: User = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/register/external/invite', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { email } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (!email) {
            return res.status(400).json({ message: 'Email обязателен' });
        }

        const trimmedEmail = trimEmail(email);

        if (!isValidEmail(trimmedEmail)) {
            return res.status(400).json({ message: 'Неверный формат email' });
        }

        const existingUser = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Пользователь существует' });
        }

        const existingInvite = await query('SELECT * FROM invitations WHERE invitee_email = $1 AND status = $2', [trimmedEmail, 'pending']);

        let token: string;

        if (existingInvite.rows.length > 0) {
            token = existingInvite.rows[0].token;
        } else {
            const crypto = await import('crypto');
            token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await createInvitation(authReq.user.userId, trimmedEmail, token, expiresAt);
        }

        const registrationLink = `${process.env.FRONTEND_URL}/auth/register/external?token=${token}&email=${trimmedEmail}`;
        const { subject, html } = renderEmailTemplate('register_invite', { registrationLink });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: trimmedEmail,
            subject,
            html
        });

        res.json({ message: 'Приглашение отправлено' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/register/external/complete', async (req, res) => {
    try {
        const { token, password, first_name, last_name, position, avatar_url } = req.body;

        if (!token || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        const invitation = await getInvitationByToken(token);

        if (!invitation) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const email = invitation.invitee_email;
        const trimmedEmail = trimEmail(email);

        if (await userExists(trimmedEmail)) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, position, avatar_url, user_type, email_verified, invited_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, email, first_name, last_name, role, position, avatar_url`,
            [trimmedEmail, hashedPassword, first_name, last_name, 'external', position || null, avatar_url || null, 'external', true, invitation.inviter_id]
        );

        try {
            await updateInvitationRegistrationTime(invitation.id);
            await updateInvitationStatus(token, 'completed');
        } catch (error) {
            // Не прерываем регистрацию, если не удалось обновить статус
        }

        const user = result.rows[0];
        res.status(201).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email обязателен' });
        }

        const trimmedEmail = trimEmail(email);

        if (!isValidEmail(trimmedEmail)) {
            return res.status(400).json({ message: 'Неверный формат email' });
        }

        const userResult = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
        
        if (userResult.rows.length === 0) {
            return res.json({ message: 'Если пользователь с таким email существует, инструкции отправлены на почту' });
        }

        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await query(
            `INSERT INTO password_resets (email, token, expires_at) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (email) 
             DO UPDATE SET token = $2, expires_at = $3`,
            [trimmedEmail, resetToken, resetTokenExpiry]
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${trimmedEmail}`;
        const { subject, html } = renderEmailTemplate('password_reset', { resetLink });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: trimmedEmail,
            subject,
            html
        });
        res.json({ message: 'Если пользователь с таким email существует, инструкции отправлены на почту' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, password } = req.body;

        if (!token || !email || !password) {
            return res.status(400).json({ message: 'Все поля обязательны' });
        }

        const trimmedEmail = trimEmail(email);

        if (password.length < 6) {
            return res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
        }

        const resetResult = await query(
            'SELECT * FROM password_resets WHERE email = $1 AND token = $2 AND expires_at > NOW()',
            [trimmedEmail, token]
        );

        if (resetResult.rows.length === 0) {
            return res.status(400).json({ message: 'Недействительный или истекший токен' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await query(
            'UPDATE users SET password_hash = $1 WHERE email = $2',
            [hashedPassword, trimmedEmail]
        );

        await query('DELETE FROM password_resets WHERE email = $1', [trimmedEmail]);

        res.json({ message: 'Пароль успешно изменен' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { email, verificationCode, password, first_name, last_name, position, role, avatar_url } = req.body;

        if (!email || !verificationCode || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
        }

        const trimmedEmail = trimEmail(email);

        const verificationResult = await query(
            'SELECT * FROM email_verifications WHERE email = $1 AND verification_code = $2 AND expires_at > NOW()',
            [trimmedEmail, verificationCode]
        );

        if (verificationResult.rows.length === 0) {
            return res.status(400).json({ message: 'Недействительный или истекший код подтверждения' });
        }

        if (await userExists(trimmedEmail)) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, position, avatar_url, email_verified, user_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING id, email, first_name, last_name, role, position, avatar_url`,
            [trimmedEmail, hashedPassword, first_name, last_name, role, position || null, avatar_url || null, true, 'internal']
        );

        await query('DELETE FROM email_verifications WHERE email = $1', [trimmedEmail]);

        const user = result.rows[0];
        res.status(201).json({ user, message: 'Email подтвержден, регистрация завершена' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/smtp-config', async (req, res) => {
    try {
        res.json({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ? '***SET***' : '***NOT SET***',
            frontendUrl: process.env.FRONTEND_URL
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get SMTP config' });
    }
});


router.get('/invitations', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const invitations = await getInvitationsByInviter(authReq.user.userId);
        res.json({ invitations });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/invited-users', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const invitedUsers = await getInvitedUsers(authReq.user.userId);
        res.json({ invitedUsers });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/who-invited-me', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const user = await getUserById(authReq.user.userId);
        if (!user || !user.invited_by) {
            return res.json({ inviter: null });
        }

        const inviter = await getUserById(user.invited_by);
        res.json({ 
            inviter: inviter ? {
                id: inviter.id,
                first_name: inviter.first_name,
                last_name: inviter.last_name,
                email: inviter.email
            } : null 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/invitation-request', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { requestedEmail, message } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (!requestedEmail) {
            return res.status(400).json({ message: 'Email обязателен' });
        }

        const trimmedEmail = trimEmail(requestedEmail);

        if (!isValidEmail(trimmedEmail)) {
            return res.status(400).json({ message: 'Неверный формат email' });
        }

        const user = await getUserById(authReq.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (user.role !== 'external') {
            return res.status(403).json({ message: 'Только внешние пользователи могут создавать запросы приглашений' });
        }

        if (await userExists(trimmedEmail)) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const request = await createInvitationRequest(authReq.user.userId, trimmedEmail, message);

        res.status(201).json({ 
            message: 'Запрос приглашения создан',
            request 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/invitation-requests', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { status } = req.query;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const user = await getUserById(authReq.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (user.role !== 'internal') {
            return res.status(403).json({ message: 'Только внутренние пользователи могут просматривать запросы приглашений' });
        }

        const requests = await getInvitationRequests(status as string);
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/my-invitation-requests', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const requests = await getInvitationRequestsByRequester(authReq.user.userId);
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/invitation-request/:requestId/process', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { requestId } = req.params;
        const { action, message, rejectionReason } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const user = await getUserById(authReq.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (user.role !== 'internal') {
            return res.status(403).json({ message: 'Только внутренние пользователи могут обрабатывать запросы приглашений' });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Неверное действие. Допустимые значения: approve, reject' });
        }

        const status = action === 'approve' ? 'approved' : 'rejected';
        
        const updatedRequest = await updateInvitationRequestStatus(
            parseInt(requestId), 
            status, 
            authReq.user.userId,
            action === 'reject' ? rejectionReason : undefined
        );

        if (action === 'approve') {
            const crypto = await import('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const trimmedEmail = trimEmail(updatedRequest.requested_email);
            await createInvitation(authReq.user.userId, trimmedEmail, token, expiresAt);

            const registrationLink = `${process.env.FRONTEND_URL}/auth/register/external?token=${token}&email=${trimmedEmail}`;

            await transporter.sendMail({
                from: `"BugTracker" <${process.env.SMTP_USER}>`,
                to: trimmedEmail,
                subject: 'Приглашение на регистрацию - BugTracker',
                html: `
                    <h2>Приглашение на регистрацию</h2>
                    <p>Ваш запрос на приглашение был одобрен.</p>
                    <p>Для завершения регистрации нажмите на кнопку ниже:</p>
                    <a href="${registrationLink}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Завершить регистрацию</a>
                    <p>Или перейдите по ссылке: <a href="${registrationLink}">${registrationLink}</a></p>
                    <p>Приглашение действительно в течение 7 дней.</p>
                `
            });
        }

        res.json({ 
            message: `Запрос ${action === 'approve' ? 'одобрен' : 'отклонен'}`,
            request: updatedRequest 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


router.delete('/users/:userId', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { userId } = req.params;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const requester = await getUserById(authReq.user.userId);
        if (!requester) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (requester.role !== 'internal') {
            return res.status(403).json({ message: 'Только внутренние пользователи могут удалять пользователей' });
        }

        if (parseInt(userId) === authReq.user.userId) {
            return res.status(400).json({ message: 'Нельзя удалить самого себя' });
        }

        const userToDelete = await getUserById(parseInt(userId));
        if (!userToDelete) {
            return res.status(404).json({ message: 'Пользователь для удаления не найден' });
        }

        const result = await deleteUserSafely(parseInt(userId));

        res.json({ 
            message: 'Пользователь успешно удален',
            deletedUser: {
                id: userToDelete.id,
                email: userToDelete.email,
                first_name: userToDelete.first_name,
                last_name: userToDelete.last_name
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Ошибка при удалении пользователя',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/debug/users', async (req, res) => {
    try {
        
        const result = await query('SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC');
        
        res.json({
            total_users: result.rows.length,
            users: result.rows
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Ошибка при получении списка пользователей',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/debug/check-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        const trimmedEmail = trimEmail(email);
        
        const result = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
        
        if (result.rows.length === 0) {
            
            const similarEmails = await query('SELECT email FROM users WHERE email ILIKE $1', [`%${trimmedEmail.split('@')[0]}%`]);
            
            res.json({
                found: false,
                checked_email: trimmedEmail,
                similar_emails: similarEmails.rows.map(row => row.email)
            });
        } else {
            const user = result.rows[0];
            
            res.json({
                found: true,
                checked_email: trimmedEmail,
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    has_password_hash: !!user.password_hash
                }
            });
        }
    } catch (error) {
        res.status(500).json({ 
            message: 'Ошибка при проверке email',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/notification-settings', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        
        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const settings = await getEmailNotificationSettings(authReq.user.userId);
        
        res.json({
            success: true,
            settings: settings || {
                project_invitations: true,
                bug_assignments: true,
                bug_comments: true,
                comment_replies: true
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Ошибка получения настроек уведомлений',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.put('/notification-settings', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { project_invitations, bug_assignments, bug_comments, comment_replies } = req.body;
        
        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const settings = {
            project_invitations: typeof project_invitations === 'boolean' ? project_invitations : true,
            bug_assignments: typeof bug_assignments === 'boolean' ? bug_assignments : true,
            bug_comments: typeof bug_comments === 'boolean' ? bug_comments : true,
            comment_replies: typeof comment_replies === 'boolean' ? comment_replies : true
        };

        const updatedSettings = await updateEmailNotificationSettings(authReq.user.userId, settings);
        
        res.json({
            success: true,
            message: 'Настройки уведомлений обновлены',
            settings: updatedSettings
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Ошибка обновления настроек уведомлений',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
