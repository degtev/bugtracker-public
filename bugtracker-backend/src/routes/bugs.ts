import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import pool from '../db';
import { notifyProjectUpdate } from '../index';
import { getUserById, isEmailNotificationEnabled } from '../models/user';
import { 
    createBugList, 
    getBugListById, 
    getBugListWithUsers,
    getBugListsByProject, 
    updateBugList, 
    deleteBugList,
    createBugComment,
    getBugComments,
    isProjectMember,
    getProjectById
} from '../models/project';
import { renderEmailTemplate } from '../emailTemplates';
const { io } = require('../index');

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendBugAssignmentEmail(
    assigneeEmail: string,
    assigneeName: string,
    bugTitle: string,
    projectName: string,
    assignedByName: string,
    bugId: number,
    projectId: number
) {
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const bugUrl = `${frontendUrl}/project/${projectId}?bug=${bugId}`;
        
        const { subject, html } = renderEmailTemplate('bug_assignment', {
            assigneeName,
            bugTitle,
            projectName,
            assignedByName,
            bugUrl
        });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: assigneeEmail,
            subject,
            html
        });
        
    } catch (error) {
        console.error(`Ошибка отправки email уведомления о назначении бага пользователю ${assigneeEmail}:`);
        console.error(`   - Детали ошибки:`, error);
        console.error(`   - SMTP конфигурация:`, {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            hasPass: !!process.env.SMTP_PASS
        });
        throw error;
    }
}

async function sendBugCommentEmail(
    recipientEmail: string,
    recipientName: string,
    bugTitle: string,
    projectName: string,
    commentAuthorName: string,
    commentText: string,
    bugId: number,
    projectId: number,
    isReply: boolean = false,
    parentCommentAuthor?: string
) {
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const bugUrl = `${frontendUrl}/project/${projectId}?bug=${bugId}`;
        
        const { subject: commentSubject, html: commentHtml } = renderEmailTemplate(isReply ? 'bug_comment_reply' : 'bug_comment', {
            recipientName,
            bugTitle,
            projectName,
            commentAuthorName,
            commentText,
            bugUrl,
            parentCommentAuthor
        });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: recipientEmail,
            subject: commentSubject,
            html: commentHtml
        });
        
    } catch (error) {
        console.error(`Ошибка отправки email уведомления о комментарии к багу пользователю ${recipientEmail}:`);
        console.error(`   - Детали ошибки:`, error);
        console.error(`   - SMTP конфигурация:`, {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            hasPass: !!process.env.SMTP_PASS
        });
        throw error;
    }
}

async function sendBugVerificationEmail(
    creatorEmail: string,
    creatorName: string,
    bugTitle: string,
    projectName: string,
    bugId: number,
    projectId: number
) {
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const bugUrl = `${frontendUrl}/project/${projectId}?bug=${bugId}`;
        const { subject: verifySubject, html: verifyHtml } = renderEmailTemplate('bug_verification', {
            creatorName,
            bugTitle,
            projectName,
            bugUrl
        });
        await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: creatorEmail,
            subject: verifySubject,
            html: verifyHtml
        });
    } catch (error) {
        console.error(`Ошибка отправки email уведомления о необходимости проверки бага постановщику ${creatorEmail}:`, error);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/bug-attachments';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bug-attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла!'));
        }
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { project_id, title, description, status, priority, assigned_to } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (!project_id || !title || !description) {
            return res.status(400).json({ message: 'ID проекта, название и описание обязательны' });
        }

        const hasAccess = await isProjectMember(project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const bugList = await createBugList({
            project_id: parseInt(project_id),
            title,
            description,
            status: status || 'open',
            priority: priority || 'medium',
            created_by: authReq.user.userId,
            assigned_to: assigned_to ? parseInt(assigned_to) : undefined
        });

        const fullBugData = await getBugListWithUsers(bugList.id!);

        if (assigned_to && assigned_to !== authReq.user.userId) {
            try {
                const assignee = await getUserById(parseInt(assigned_to));
                if (assignee) {
                    const creator = await getUserById(authReq.user.userId);
                    if (creator) {
                        const project = await getProjectById(parseInt(project_id));
                        if (project) {
                            
                            const notificationsEnabled = await isEmailNotificationEnabled(assignee.id!, 'bug_assignments');
                            
                            if (notificationsEnabled) {
                                sendBugAssignmentEmail(
                                    assignee.email,
                                    `${assignee.first_name} ${assignee.last_name}`,
                                    title,
                                    project.name,
                                    `${creator.first_name} ${creator.last_name}`,
                                    bugList.id!,
                                    parseInt(project_id)
                                ).then(() => {
                                }).catch(error => {
                                });
                            } else {
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при отправке email уведомления о назначении бага:', error);
            }
        }

        const { io } = require('../index');
        if (io && project_id) {
            io.to(`project_${project_id}`).emit('bug_created', {
                projectId: project_id,
                bug: fullBugData
            });
        }

        notifyProjectUpdate(project_id.toString(), {
            type: 'bug_created',
            bug: fullBugData
        });

        res.status(201).json(fullBugData);
    } catch (error) {
        console.error('Error creating bug list:', error);
        res.status(500).json({ message: 'Ошибка создания баг-листа' });
    }
});

router.get('/project/:projectId', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.projectId);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Неверный ID проекта' });
        }

        const hasAccess = await isProjectMember(projectId, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const bugLists = await getBugListsByProject(projectId);
        res.json(bugLists);
    } catch (error) {
        console.error('Error getting bug lists:', error);
        res.status(500).json({ message: 'Ошибка получения баг-листов' });
    }
});

router.get('/test-comments', (req, res) => {
    res.json({ message: 'Comments router is working!' });
});

router.get('/:id/comments', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);
        if (!authReq.user) return res.status(401).json({ message: 'Не авторизован' });
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        const bug = await getBugListById(bugId);
        if (!bug) return res.status(404).json({ message: 'Баг не найден' });
        const hasAccess = await isProjectMember(bug.project_id, authReq.user.userId);
        if (!hasAccess) return res.status(403).json({ message: 'Нет доступа к проекту' });
        const comments = await getBugComments(bugId);
        res.json(comments);
    } catch (error) {
        console.error('Error getting bug comments:', error);
        res.status(500).json({ message: 'Ошибка получения комментариев' });
    }
});

router.post('/:id/comments', authMiddleware, upload.single('attachment'), async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);
        const { comment, parent_id } = req.body;
        let attachment_url = undefined;
        if (!authReq.user) return res.status(401).json({ message: 'Не авторизован' });
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        if (!comment) return res.status(400).json({ message: 'Текст комментария обязателен' });
        const bug = await getBugListById(bugId);
        if (!bug) return res.status(404).json({ message: 'Баг не найден' });
        const hasAccess = await isProjectMember(bug.project_id, authReq.user.userId);
        if (!hasAccess) return res.status(403).json({ message: 'Нет доступа к проекту' });
        if (req.file) {
            attachment_url = `/uploads/bug-attachments/${req.file.filename}`;
        }
        const newComment = await createBugComment({
            bug_id: bugId,
            user_id: authReq.user.userId,
            comment,
            attachment_url,
            parent_id: parent_id ? parseInt(parent_id) : null
        });

        try {
            const fullBugData = await getBugListWithUsers(bugId);
            if (fullBugData) {
                const project = await getProjectById(bug.project_id);
                if (project) {
                    const commentAuthor = await getUserById(authReq.user.userId);
                    if (commentAuthor) {

                        if (parent_id) {
                            const parentComment = await getBugComments(bugId);
                            const parentCommentData = parentComment.find(c => c.id === parseInt(parent_id));
                            
                            if (parentCommentData && parentCommentData.user_id !== authReq.user.userId) {
                                const parentCommentAuthor = await getUserById(parentCommentData.user_id);
                                if (parentCommentAuthor) {
                                    
                                    const notificationsEnabled = await isEmailNotificationEnabled(parentCommentAuthor.id!, 'comment_replies');
                                    
                                    if (notificationsEnabled) {
                                        sendBugCommentEmail(
                                            parentCommentAuthor.email,
                                            `${parentCommentAuthor.first_name} ${parentCommentAuthor.last_name}`,
                                            fullBugData.title,
                                            project.name,
                                            `${commentAuthor.first_name} ${commentAuthor.last_name}`,
                                            comment,
                                            bugId,
                                            bug.project_id,
                                            true,
                                            `${parentCommentAuthor.first_name} ${parentCommentAuthor.last_name}`
                                        ).then(() => {
                                        }).catch(error => {
                                        });
                                    } else {
                                    }
                                }
                            }
                        } else {
                            if (fullBugData.assigned_to && fullBugData.assigned_to !== authReq.user.userId) {
                                const assignee = await getUserById(fullBugData.assigned_to);
                                if (assignee) {
                                    
                                    const notificationsEnabled = await isEmailNotificationEnabled(assignee.id!, 'bug_comments');
                                    
                                    if (notificationsEnabled) {
                                        sendBugCommentEmail(
                                            assignee.email,
                                            `${assignee.first_name} ${assignee.last_name}`,
                                            fullBugData.title,
                                            project.name,
                                            `${commentAuthor.first_name} ${commentAuthor.last_name}`,
                                            comment,
                                            bugId,
                                            bug.project_id,
                                            false
                                        ).then(() => {
                                        }).catch(error => {
                                        });
                                    } else {
                                    }
                                }
                            } else {
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при отправке email уведомления о комментарии:', error);
        }

        notifyProjectUpdate(bug.project_id.toString(), {
            type: 'comment_added',
            bugId: bugId,
            comment: newComment
        });

        const { io } = require('../index');
        if (io && bug && bug.project_id) {
          io.to(`project_${bug.project_id}`).emit('new_comment', {
            projectId: bug.project_id,
            bugId: bugId,
            comment: newComment,
            userId: authReq.user.userId
          });
        }

        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error creating bug comment:', error);
        res.status(500).json({ message: 'Ошибка создания комментария' });
    }
});

router.get('/:id/share', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(bugId)) {
            return res.status(400).json({ message: 'Неверный ID баг-листа' });
        }

        const bugList = await getBugListWithUsers(bugId);
        if (!bugList) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const hasAccess = await isProjectMember(bugList.project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const { getProjectById } = require('../models/project');
        const project = await getProjectById(bugList.project_id);
        
        res.json({
            bug: bugList,
            project: project
        });
    } catch (error) {
        console.error('Error getting bug for sharing:', error);
        res.status(500).json({ message: 'Ошибка получения информации о баге' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(bugId)) {
            return res.status(400).json({ message: 'Неверный ID баг-листа' });
        }

        const bugList = await getBugListById(bugId);
        if (!bugList) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }
        const hasAccess = await isProjectMember(bugList.project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        res.json(bugList);
    } catch (error) {
        console.error('Error getting bug list:', error);
        res.status(500).json({ message: 'Ошибка получения баг-листа' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);
        const { title, description, status, priority, assigned_to } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(bugId)) {
            return res.status(400).json({ message: 'Неверный ID баг-листа' });
        }

        const existingBug = await getBugListById(bugId);
        if (!existingBug) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const hasAccess = await isProjectMember(existingBug.project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const updatedBug = await updateBugList(bugId, {
            title,
            description,
            status,
            priority,
            assigned_to: assigned_to ? parseInt(assigned_to) : undefined
        });

        if (!updatedBug) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const fullBugData = await getBugListWithUsers(bugId);

        if (
          status !== undefined &&
          status === 'resolved' &&
          existingBug.status !== 'resolved'
        ) {
          const creator = await getUserById(existingBug.created_by);
          if (creator && creator.email) {
            const notificationsEnabled = await isEmailNotificationEnabled(creator.id!, 'bug_verification');
            if (notificationsEnabled) {
              const project = await getProjectById(existingBug.project_id);
              await sendBugVerificationEmail(
                creator.email,
                `${creator.first_name} ${creator.last_name}`,
                updatedBug.title,
                project?.name || '',
                bugId,
                existingBug.project_id
              );
            }
          }
        }
        
        const assignmentChanged = existingBug.assigned_to !== updatedBug.assigned_to;
        
        if (assignmentChanged && updatedBug.assigned_to && updatedBug.assigned_to !== authReq.user.userId) {
            try {
                const newAssignee = await getUserById(updatedBug.assigned_to);
                if (newAssignee) {
                    const assignedBy = await getUserById(authReq.user.userId);
                    if (assignedBy) {
                        const project = await getProjectById(existingBug.project_id);
                        if (project) {
                            
                            const notificationsEnabled = await isEmailNotificationEnabled(newAssignee.id!, 'bug_assignments');
                            
                            if (notificationsEnabled) {
                                sendBugAssignmentEmail(
                                    newAssignee.email,
                                    `${newAssignee.first_name} ${newAssignee.last_name}`,
                                    updatedBug.title,
                                    project.name,
                                    `${assignedBy.first_name} ${assignedBy.last_name}`,
                                    bugId,
                                    existingBug.project_id
                                ).then(() => {
                                }).catch(error => {
                                });
                            } else {
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при отправке email уведомления об изменении назначения бага:', error);
            }
        }
        
        notifyProjectUpdate(existingBug.project_id.toString(), {
            type: assignmentChanged ? 'bug_assignment_changed' : 'bug_updated',
            bug: fullBugData,
            previousAssignee: existingBug.assigned_to,
            newAssignee: updatedBug.assigned_to
        });

        const { io } = require('../index');
        if (io && existingBug.project_id) {
            io.to(`project_${existingBug.project_id}`).emit('bug_updated', {
                projectId: existingBug.project_id,
                bug: fullBugData
            });
        }

        res.json(fullBugData);
    } catch (error) {
        console.error('Error updating bug list:', error);
        res.status(500).json({ message: 'Ошибка обновления баг-листа' });
    }
});

router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);
        const { status, priority, assigned_to } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(bugId)) {
            return res.status(400).json({ message: 'Неверный ID баг-листа' });
        }

        const existingBug = await getBugListById(bugId);
        if (!existingBug) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const hasAccess = await isProjectMember(existingBug.project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (assigned_to !== undefined) updateData.assigned_to = assigned_to ? parseInt(assigned_to) : undefined;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'Не указаны поля для обновления' });
        }

        const updatedBug = await updateBugList(bugId, updateData);

        if (!updatedBug) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const fullBugData = await getBugListWithUsers(bugId);

        if (
          status !== undefined &&
          status === 'resolved' &&
          existingBug.status !== 'resolved'
        ) {
          const creator = await getUserById(existingBug.created_by);
          if (creator && creator.email) {
            const notificationsEnabled = await isEmailNotificationEnabled(creator.id!, 'bug_verification');
            if (notificationsEnabled) {
              const project = await getProjectById(existingBug.project_id);
              await sendBugVerificationEmail(
                creator.email,
                `${creator.first_name} ${creator.last_name}`,
                updatedBug.title,
                project?.name || '',
                bugId,
                existingBug.project_id
              );
            }
          }
        }
        
        const assignmentChanged = existingBug.assigned_to !== updatedBug.assigned_to;
        
        if (assignmentChanged && updatedBug.assigned_to && updatedBug.assigned_to !== authReq.user.userId) {
            try {
                const newAssignee = await getUserById(updatedBug.assigned_to);
                if (newAssignee) {
                    const assignedBy = await getUserById(authReq.user.userId);
                    if (assignedBy) {
                        const project = await getProjectById(existingBug.project_id);
                        if (project) {

                            const notificationsEnabled = await isEmailNotificationEnabled(newAssignee.id!, 'bug_assignments');
                            
                            if (notificationsEnabled) {
                                sendBugAssignmentEmail(
                                    newAssignee.email,
                                    `${newAssignee.first_name} ${newAssignee.last_name}`,
                                    updatedBug.title,
                                    project.name,
                                    `${assignedBy.first_name} ${assignedBy.last_name}`,
                                    bugId,
                                    existingBug.project_id
                                ).then(() => {
                                }).catch(error => {
                                });
                            } else {
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при отправке email уведомления о быстром изменении назначения бага:', error);
            }
        }

        notifyProjectUpdate(existingBug.project_id.toString(), {
            type: assignmentChanged ? 'bug_assignment_changed' : 'bug_quick_updated',
            bug: fullBugData,
            previousAssignee: existingBug.assigned_to,
            newAssignee: updatedBug.assigned_to
        });

        const { io } = require('../index');
        if (io && existingBug.project_id) {
            io.to(`project_${existingBug.project_id}`).emit('bug_updated', {
                projectId: existingBug.project_id,
                bug: fullBugData
            });
        }

        res.json(fullBugData);
    } catch (error) {
        console.error('Error updating bug list:', error);
        res.status(500).json({ message: 'Ошибка обновления баг-листа' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const bugId = parseInt(req.params.id);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(bugId)) {
            return res.status(400).json({ message: 'Неверный ID баг-листа' });
        }

        const existingBug = await getBugListById(bugId);
        if (!existingBug) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const hasAccess = await isProjectMember(existingBug.project_id, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const deleted = await deleteBugList(bugId);
        if (!deleted) {
            return res.status(404).json({ message: 'Баг-лист не найден' });
        }

        const { io } = require('../index');
        if (io && existingBug.project_id) {
            io.to(`project_${existingBug.project_id}`).emit('bug_deleted', {
                projectId: existingBug.project_id,
                bugId: bugId
            });
        }

        notifyProjectUpdate(existingBug.project_id.toString(), {
            type: 'bug_deleted',
            bugId: bugId
        });

        res.json({ message: 'Баг-лист успешно удален' });
    } catch (error) {
        console.error('Error deleting bug list:', error);
        res.status(500).json({ message: 'Ошибка удаления баг-листа' });
    }
});


router.post('/:id/time-track/start', authMiddleware, async (req, res) => {
    try {
        const bugId = parseInt(req.params.id);
        const userId = (req as AuthRequest).user?.userId;
        if (!userId) return res.status(401).json({ message: 'Не авторизован' });
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        const active = await pool.query(
            'SELECT * FROM bug_time_tracks WHERE bug_id = $1 AND user_id = $2 AND end_time IS NULL',
            [bugId, userId]
        );
        if (active.rows.length > 0) return res.status(400).json({ message: 'Трек уже запущен' });
        const now = new Date();
        await pool.query(
            'INSERT INTO bug_time_tracks (bug_id, user_id, start_time) VALUES ($1, $2, $3)',
            [bugId, userId, now]
        );
        res.json({ message: 'Трек запущен', start_time: now });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка запуска трека' });
    }
});

router.post('/:id/time-track/stop', authMiddleware, async (req, res) => {
    try {
        const bugId = parseInt(req.params.id);
        const userId = (req as AuthRequest).user?.userId;
        if (!userId) return res.status(401).json({ message: 'Не авторизован' });
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        // Найти активный трек
        const active = await pool.query(
            'SELECT * FROM bug_time_tracks WHERE bug_id = $1 AND user_id = $2 AND end_time IS NULL',
            [bugId, userId]
        );
        if (active.rows.length === 0) return res.status(400).json({ message: 'Нет активного трека' });
        const now = new Date();
        const start = new Date(active.rows[0].start_time);
        const duration = Math.floor((now.getTime() - start.getTime()) / 1000);
        await pool.query(
            'UPDATE bug_time_tracks SET end_time = $1, duration = $2 WHERE id = $3',
            [now, duration, active.rows[0].id]
        );
        res.json({ message: 'Трек остановлен', end_time: now, duration });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка остановки трека' });
    }
});

router.get('/:id/time-track', authMiddleware, async (req, res) => {
    try {
        const bugId = parseInt(req.params.id);
        const userId = (req as AuthRequest).user?.userId;
        if (!userId) return res.status(401).json({ message: 'Не авторизован' });
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        // Все треки пользователя по багу
        const tracks = await pool.query(
            'SELECT * FROM bug_time_tracks WHERE bug_id = $1 AND user_id = $2 ORDER BY start_time DESC',
            [bugId, userId]
        );
        res.json(tracks.rows);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка получения треков' });
    }
});

router.get('/:id/time-track/all', authMiddleware, async (req, res) => {
    try {
        const bugId = parseInt(req.params.id);
        if (isNaN(bugId)) return res.status(400).json({ message: 'Неверный ID бага' });
        const tracks = await pool.query(
            `SELECT t.*, u.first_name, u.last_name
             FROM bug_time_tracks t
             JOIN users u ON t.user_id = u.id
             WHERE t.bug_id = $1
             ORDER BY t.start_time DESC`,
            [bugId]
        );
        res.json(tracks.rows);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка получения треков' });
    }
});

export default router;
