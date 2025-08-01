import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { 
    createProject, 
    getProjectById, 
    getProjectsByUser, 
    updateProject,
    deleteProject,
    addProjectMember, 
    isProjectMember, 
    getProjectMembers,
    getProjectMembersForAssignment,
    findUsersByEmail,
    removeProjectMember
} from '../models/project';
import { getUserById, isEmailNotificationEnabled } from '../models/user';
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


async function sendProjectInvitationEmail(
    userEmail: string, 
    userName: string, 
    projectName: string, 
    inviterName: string,
    projectId: number
) {
    try {
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const projectUrl = `${frontendUrl}/project/${projectId}`;
        
        
        const { subject, html } = renderEmailTemplate('project_invitation', {
            userName,
            projectName,
            inviterName,
            projectUrl
        });
        
        
        const result = await transporter.sendMail({
            from: `"BugTracker" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject,
            html
        });
        
        
    } catch (error) {
        
    }
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/project-icons';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'project-icon-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'));
        }
    }
});


const defaultIcons = [
    '/api/project-icons/default-1.png',
    '/api/project-icons/default-2.png',
    '/api/project-icons/default-3.png',
    '/api/project-icons/default-4.png',
    '/api/project-icons/default-5.png'
];

router.get('/default-icons', (req, res) => {
    res.json({ icons: defaultIcons });
});

router.post('/', authMiddleware, upload.single('icon'), async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { name, description, iconType, members } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (!name || !description) {
            return res.status(400).json({ message: 'Название и описание обязательны' });
        }

        let iconUrl = '';
        
        if (iconType === 'upload' && req.file) {
            iconUrl = `/api/project-icons/${req.file.filename}`;
        } else if (iconType === 'default' && req.body.defaultIcon) {
            iconUrl = req.body.defaultIcon;
        } else {
            iconUrl = defaultIcons[0];
        }

        const project = await createProject({
            name,
            description,
            icon_url: iconUrl,
            created_by: authReq.user.userId
        });

        let memberIds: number[] = [];
        if (members) {
            if (Array.isArray(members)) {
                memberIds = members.map(id => parseInt(id.toString()));
            } else if (typeof members === 'string') {
                memberIds = members.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }
            
            const creator = await getUserById(authReq.user.userId);
            if (!creator) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
            
            for (const memberId of memberIds) {
                if (memberId && memberId !== authReq.user.userId) {
                    try {
                        await addProjectMember(project.id!, memberId, authReq.user.userId);
                        
                        const userToAdd = await getUserById(memberId);
                        if (userToAdd) {

                        const notificationsEnabled = await isEmailNotificationEnabled(userToAdd.id!, 'project_invitations');
                        
                        if (notificationsEnabled) {
                            sendProjectInvitationEmail(
                                userToAdd.email,
                                `${userToAdd.first_name} ${userToAdd.last_name}`,
                                project.name,
                                `${creator.first_name} ${creator.last_name}`,
                                project.id!
                            ).then(() => {
                                
                            }).catch(error => {
                                
                            });
                        } else {
                            
                        }
                        }
                    } catch (error) {
                        
                    }
                }
            }
        }

        if (io && memberIds && memberIds.length > 0) {
            for (const memberId of memberIds) {
                if (memberId && memberId !== authReq.user.userId) {
                    console.log('Emitting project_created to', memberId, project);
                    io.to(`user_${memberId}`).emit('project_created', { project });
                }
            }
        }

        res.status(201).json(project);
    } catch (error) {
        
        res.status(500).json({ 
            message: 'Ошибка создания проекта',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        
        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const projects = await getProjectsByUser(authReq.user.userId);
        res.json(projects);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка получения проектов' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);

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

        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        res.json(project);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка получения проекта' });
    }
});


router.put('/:id', authMiddleware, upload.single('icon'), async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);
        const { name, description, iconType, members } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Неверный ID проекта' });
        }

        const currentProject = await getProjectById(projectId);
        if (!currentProject) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        if (currentProject.created_by !== authReq.user.userId) {
            return res.status(403).json({ message: 'Только создатель проекта может его редактировать' });
        }

        let iconUrl = currentProject.icon_url;
        
        if (iconType === 'upload' && req.file) {
            iconUrl = `/api/project-icons/${req.file.filename}`;
        } else if (iconType === 'default' && req.body.defaultIcon) {
            iconUrl = req.body.defaultIcon;
        } else if (iconType === 'remove') {
            iconUrl = defaultIcons[0];
        }

        const updatedProject = await updateProject(projectId, {
            name: name || currentProject.name,
            description: description || currentProject.description,
            icon_url: iconUrl
        });

        if (!updatedProject) {
            return res.status(500).json({ message: 'Ошибка обновления проекта' });
        }

        const creator = await getUserById(authReq.user.userId);
        if (!creator) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (members) {
            let memberIds: number[] = [];
            
            if (Array.isArray(members)) {
                memberIds = members.map(id => parseInt(id.toString()));
            } else if (typeof members === 'string') {
                memberIds = members.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }
            
            
            for (const memberId of memberIds) {
                if (memberId && memberId !== authReq.user.userId) {
                    try {
                        const isAlreadyMember = await isProjectMember(projectId, memberId);
                        if (!isAlreadyMember) {
                            await addProjectMember(projectId, memberId, authReq.user.userId);
                            
                            const userToAdd = await getUserById(memberId);
                            if (userToAdd) {
                                
                            const notificationsEnabled = await isEmailNotificationEnabled(userToAdd.id!, 'project_invitations');
                            
                            if (notificationsEnabled) {
                                sendProjectInvitationEmail(
                                    userToAdd.email,
                                    `${userToAdd.first_name} ${userToAdd.last_name}`,
                                    updatedProject.name,
                                    `${creator.first_name} ${creator.last_name}`,
                                    projectId
                                ).then(() => {
                                    
                                }).catch(error => {
                                    
                                });
                            } else {
                                
                            }
                            }
                        } else {
                            
                        }
                    } catch (error) {
                        
                    }
                }
            }
        }

        
        res.json(updatedProject);
    } catch (error) {
        
        res.status(500).json({ 
            message: 'Ошибка обновления проекта',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/:id/members', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);

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

        const members = await getProjectMembers(projectId);
        res.json(members);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка получения участников проекта' });
    }
});

router.get('/:id/members/assignment', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);

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

        const members = await getProjectMembersForAssignment(projectId);
        res.json(members);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка получения участников проекта' });
    }
});

router.post('/:id/members', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);
        const { userId } = req.body;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Неверный ID проекта' });
        }

        if (!userId) {
            return res.status(400).json({ message: 'ID пользователя обязателен' });
        }

        const hasAccess = await isProjectMember(projectId, authReq.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ message: 'Нет доступа к проекту' });
        }

        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        const userToAdd = await getUserById(userId);
        if (!userToAdd) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const inviter = await getUserById(authReq.user.userId);
        if (!inviter) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const member = await addProjectMember(projectId, userId, authReq.user.userId);

        const notificationsEnabled = await isEmailNotificationEnabled(userToAdd.id!, 'project_invitations');
        
        if (notificationsEnabled) {
            
            sendProjectInvitationEmail(
                userToAdd.email,
                `${userToAdd.first_name} ${userToAdd.last_name}`,
                project.name,
                `${inviter.first_name} ${inviter.last_name}`,
                projectId
            ).then(() => {
                
            }).catch(error => {
                
            });
        } else {
            
        }

        const projectFull = await getProjectById(projectId);
        if (io && projectFull) {
            io.to(`user_${userId}`).emit('project_updated', { project: projectFull });
        }

        res.status(201).json(member);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка добавления участника' });
    }
});

router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(projectId) || isNaN(userId)) {
            return res.status(400).json({ message: 'Неверный ID проекта или пользователя' });
        }

        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        if (project.created_by !== authReq.user.userId) {
            return res.status(403).json({ message: 'Только создатель проекта может удалять участников' });
        }

        if (userId === authReq.user.userId) {
            return res.status(400).json({ message: 'Нельзя удалить себя из проекта' });
        }

        const isMember = await isProjectMember(projectId, userId);
        if (!isMember) {
            return res.status(404).json({ message: 'Пользователь не является участником проекта' });
        }

        await removeProjectMember(projectId, userId);
        if (io) {
            io.to(`user_${userId}`).emit('project_removed', { projectId });
        }
        res.json({ message: 'Участник удален из проекта' });
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка удаления участника' });
    }
});

router.get('/search/users', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const { email } = req.query;

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ message: 'Email обязателен' });
        }

        const users = await findUsersByEmail(email);
        res.json(users);
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка поиска пользователей' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const authReq = req as AuthRequest;
        const projectId = parseInt(req.params.id);

        if (!authReq.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Неверный ID проекта' });
        }

        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        if (project.created_by !== authReq.user.userId) {
            return res.status(403).json({ message: 'Только создатель проекта может его удалить' });
        }

        const deleted = await deleteProject(projectId);
        if (!deleted) {
            return res.status(404).json({ message: 'Проект не найден' });
        }

        res.json({ message: 'Проект успешно удален' });
    } catch (error) {
        
        res.status(500).json({ message: 'Ошибка удаления проекта' });
    }
});

export default router;