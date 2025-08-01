import React, { useState, useEffect, useRef } from 'react';
import { io as socketIOClient } from 'socket.io-client';

declare global {
    interface Window {
        eventSource?: EventSource;
    }
}

const bugCardStyles = `
  .bug-card {
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }
  
  .bug-card.closed {
    transform: scale(0.9);
    opacity: 0.6;
  }
  
  .bug-list-container {
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;
import {
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Avatar,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Divider,
    Snackbar,
    Alert,
    CircularProgress,
    Fab,
    Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    BugReport as BugIcon,
    Group as GroupIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Comment as CommentIcon,
    ArrowBack as ArrowBackIcon,
    CheckCircle as CheckCircleIcon,
    Person as PersonIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    AttachFile as AttachFileIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import BugCard from './project/BugCard';
import BugDialog from './project/BugDialog';
import BugDetailDialog from './project/BugDetailDialog';
import AttachmentsDialog from './project/AttachmentsDialog';
import { getStatusColor, getStatusText, getPriorityColor, getPriorityText, formatTimeAgo, formatFileSize, getFileIcon, getSafeFileName } from '../utils/bugUtils';
import { Project, BugList, BugAttachment, ProjectMember, NewLinkForm, SnackbarState } from '../types/project';
import type { FormData } from '../types/project';
import { useAttachments } from '../hooks/useAttachments';
import BugCustomDialog from './BugCustomDialog';
import NotificationSettings from './NotificationSettings';
import CustomDialog from './CustomDialog';

function ProjectView() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = bugCardStyles;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    const [project, setProject] = useState<Project | null>(null);
    const [bugLists, setBugLists] = useState<BugList[]>([]);
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [assignmentMembers, setAssignmentMembers] = useState<ProjectMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [createBugDialogOpen, setCreateBugDialogOpen] = useState(false);
    const [editBugDialogOpen, setEditBugDialogOpen] = useState(false);
    const [editingBug, setEditingBug] = useState<BugList | null>(null);
    const [selectedBug, setSelectedBug] = useState<BugList | null>(null);
    const selectedBugRef = useRef<BugList | null>(null);
    const [wasAutoOpened, setWasAutoOpened] = useState(false);

    useEffect(() => {
        selectedBugRef.current = selectedBug;
    }, [selectedBug]);

    const [bugDetailDialogOpen, setBugDetailDialogOpen] = useState(false);
    const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
    const [bugToDelete, setBugToDelete] = useState<BugList | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'assigned_to_me'>('all');
    const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
    const [selectedBugForAttachments, setSelectedBugForAttachments] = useState<BugList | null>(null);
    const [attachments, setAttachments] = useState<BugAttachment[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [linkForm, setLinkForm] = useState({ name: '', url: '' });
    const [createBugAttachments, setCreateBugAttachments] = useState<File[]>([]);
    const [createBugLinks, setCreateBugLinks] = useState<{ name: string; url: string }[]>([]);
    const [editBugAttachments, setEditBugAttachments] = useState<File[]>([]);
    const [editBugLinks, setEditBugLinks] = useState<{ name: string; url: string }[]>([]);
    const [newLinkForm, setNewLinkForm] = useState({ name: '', url: '' });
    const [prioritySort, setPrioritySort] = useState<'asc' | 'desc'>('desc');
    const [userActivities, setUserActivities] = useState<any[]>([]); // Удален UserActivity
    const [activityPanelCollapsed, setActivityPanelCollapsed] = useState(() => {
        const saved = localStorage.getItem('activityPanelCollapsed');
        return saved ? JSON.parse(saved) : false;
    });
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'open' as 'open' | 'in_progress' | 'resolved' | 'closed',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
        assigned_to: ''
    });

    const [sortType, setSortType] = useState<'none' | 'priority_desc' | 'priority_asc' | 'newest' | 'oldest'>('none');

    const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
    const [notificationSettingsSaving, setNotificationSettingsSaving] = useState(false);
    const notificationSettingsRef = useRef<any>(null);

    const handleSaveNotificationSettings = async () => {
      if (notificationSettingsRef.current && notificationSettingsRef.current.save) {
        setNotificationSettingsSaving(true);
        await notificationSettingsRef.current.save();
        setNotificationSettingsSaving(false);
      }
    };

    const [unreadBugs, setUnreadBugs] = useState<Set<number>>(new Set());
    const [viewersMap, setViewersMap] = useState<{ [bugId: number]: any[] }>({});
    const socketRef = useRef<any>(null);

    useEffect(() => {
        if (projectId) {
            loadProjectData();
            loadCurrentUser();
            
            setTimeout(() => {
                sendUserActivity('зашел на страницу проекта');
            }, 1000);
        }

        const handleBeforeUnload = () => {
            if (currentUserId && projectId) {
                navigator.sendBeacon(
                    `${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}/activity`,
                    JSON.stringify({
                        action: 'покинул страницу',
                        timestamp: new Date().toISOString(),
                        is_offline: true
                    })
                );
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (window.eventSource) {
                window.eventSource.close();
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [projectId]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (currentUserId && projectId) {
                loadProjectData();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [currentUserId, projectId]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (projectId) {
                loadProjectData();
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [projectId]);

    useEffect(() => {
        if (!projectId || !currentUserId) return;
        const socket = socketIOClient(import.meta.env.VITE_BACKEND_URL);
        socketRef.current = socket;
        socket.emit('join_project', projectId);

        const handleNewComment = (data: any) => {
            if (data.userId === currentUserId) return;
            if (selectedBugRef.current && selectedBugRef.current.id === data.bugId) return;
            setUnreadBugs(prev => new Set(prev).add(data.bugId));
        };
        const handleCommentsRead = (bugId: number) => {
            setUnreadBugs(prev => {
                const updated = new Set(prev);
                updated.delete(bugId);
                return updated;
            });
        };
        const handleBugCreated = (data: any) => {
            setBugLists(prev => {
                if (prev.some(bug => bug.id === data.bug.id)) return prev;
                return [data.bug, ...prev];
            });
        };
        const handleBugDeleted = (data: any) => {
            setBugLists(prev => prev.filter(bug => bug.id !== data.bugId));
        };
        const handleBugUpdated = (data: any) => {
            setBugLists(prev => prev.map(bug => bug.id === data.bug.id ? data.bug : bug));
        };
        socket.on('new_comment', handleNewComment);
        socket.on('comments_read', handleCommentsRead);
        socket.on('bug_created', handleBugCreated);
        socket.on('bug_deleted', handleBugDeleted);
        socket.on('bug_updated', handleBugUpdated);
        const handleBugViewers = (data: any) => {
            console.log('bug_viewers', data);
            setViewersMap(prev => ({ ...prev, [data.bugId]: data.viewers }));
        };
        socket.on('bug_viewers', handleBugViewers);

        return () => {
            socket.off('new_comment', handleNewComment);
            socket.off('comments_read', handleCommentsRead);
            socket.off('bug_created', handleBugCreated);
            socket.off('bug_deleted', handleBugDeleted);
            socket.off('bug_updated', handleBugUpdated);
            socket.off('bug_viewers', handleBugViewers);
            socket.emit('leave_project', projectId);
            socket.disconnect();
        };
    }, [projectId, currentUserId]);

    useEffect(() => {
        if (!projectId || !currentUserId) return;
        const socket = socketIOClient(import.meta.env.VITE_BACKEND_URL);
        socketRef.current = socket;
        socket.emit('join_project', projectId);

        const handleNewComment = (data: any) => {
            if (data.userId === currentUserId) return;
            if (selectedBugRef.current && selectedBugRef.current.id === data.bugId) return;
            setUnreadBugs(prev => new Set(prev).add(data.bugId));
        };
        const handleCommentsRead = (bugId: number) => {
            setUnreadBugs(prev => {
                const updated = new Set(prev);
                updated.delete(bugId);
                return updated;
            });
        };
        const handleBugCreated = (data: any) => {
            setBugLists(prev => {
                if (prev.some(bug => bug.id === data.bug.id)) return prev;
                return [data.bug, ...prev];
            });
        };
        const handleBugDeleted = (data: any) => {
            setBugLists(prev => prev.filter(bug => bug.id !== data.bugId));
        };
        const handleBugUpdated = (data: any) => {
            setBugLists(prev => prev.map(bug => bug.id === data.bug.id ? data.bug : bug));
        };
        socket.on('new_comment', handleNewComment);
        socket.on('comments_read', handleCommentsRead);
        socket.on('bug_created', handleBugCreated);
        socket.on('bug_deleted', handleBugDeleted);
        socket.on('bug_updated', (data) => {
            setBugLists(prev => prev.map(bug =>
                bug.id === data.bug.id ? { ...bug, ...data.bug } : bug
            ));
            if (selectedBug && selectedBug.id === data.bug.id) {
                setSelectedBug(prev => prev ? { ...prev, ...data.bug } : null);
            }
            if (editingBug && editingBug.id === data.bug.id) {
                setEditingBug(prev => prev ? { ...prev, ...data.bug } : null);
            }
        });
        const handleBugViewers = (data: any) => {
            setViewersMap(prev => ({ ...prev, [data.bugId]: data.viewers }));
        };
        socket.on('bug_viewers', handleBugViewers);

        return () => {
            socket.off('new_comment', handleNewComment);
            socket.off('comments_read', handleCommentsRead);
            socket.off('bug_created', handleBugCreated);
            socket.off('bug_deleted', handleBugDeleted);
            socket.off('bug_updated', handleBugUpdated);
            socket.off('bug_viewers', handleBugViewers);
            socket.emit('leave_project', projectId);
            socket.disconnect();
        };
    }, [projectId, currentUserId, selectedBug, editingBug]);

    useEffect(() => {
        if (!selectedBug || !currentUserId || !projectId || !socketRef.current) return;
        socketRef.current.emit('view_bug', {
            projectId,
            bugId: selectedBug.id,
            userId: currentUserId,
            name: localStorage.getItem('userName') || 'Пользователь',
        });
        return () => {
            socketRef.current.emit('leave_bug', {
                projectId,
                bugId: selectedBug.id,
                userId: currentUserId,
            });
        };
    }, [selectedBug, currentUserId, projectId]);

    useEffect(() => {
        if (!projectId) return;
        const fetchViewers = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}/bug-viewers`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setViewersMap(data);
                }
            } catch (e) { }
        };
        fetchViewers();
    }, [projectId]);

    const loadCurrentUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/me`, config);
            setCurrentUserId(response.data.id);
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    };

    const loadProjectData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            const projectResponse = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}`,
                config
            );
            setProject(projectResponse.data);

            const membersResponse = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}/members`,
                config
            );
            setMembers(membersResponse.data);
            
            const assignmentMembersResponse = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}/members/assignment`,
                config
            );
            setAssignmentMembers(assignmentMembersResponse.data);

            const bugsResponse = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/bugs/project/${projectId}`,
                config
            );
            const bugs = bugsResponse.data;
            setBugLists(bugs);

            await loadAllBugAttachments(bugs);
        } catch (error: any) {
            console.error('Error loading project data:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка загрузки данных проекта',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBug = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            const bugData = {
                project_id: parseInt(projectId!),
                title: formData.title,
                description: formData.description,
                status: formData.status,
                priority: formData.priority,
                assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : undefined
            };

            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/bugs`, bugData, config);
            const createdBug = response.data;

            if (createBugAttachments.length > 0 || createBugLinks.length > 0) {
                await uploadAttachments(createdBug.id, createBugAttachments, createBugLinks);
            }

            setSnackbar({
                open: true,
                message: 'Баг успешно создан',
                severity: 'success'
            });

            resetForm();
            setCreateBugDialogOpen(false);
            
            setCreateBugAttachments([]);
            setCreateBugLinks([]);
            
            loadProjectData();
        } catch (error: any) {
            console.error('Error creating bug:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка создания бага',
                severity: 'error'
            });
        }
    };

    const handleEditBug = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            const updateData = {
                title: formData.title,
                description: formData.description,
                status: formData.status,
                priority: formData.priority,
                assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null
            };

            await axios.put(`${import.meta.env.VITE_BACKEND_URL}/bugs/${editingBug!.id}`, updateData, config);

            if (editBugAttachments.length > 0 || editBugLinks.length > 0) {
                await uploadAttachments(editingBug!.id, editBugAttachments, editBugLinks);
            }

            setSnackbar({
                open: true,
                message: 'Баг успешно обновлен',
                severity: 'success'
            });

            setEditBugDialogOpen(false);
            setEditingBug(null);
            
            setEditBugAttachments([]);
            setEditBugLinks([]);
            
            loadProjectData();
        } catch (error: any) {
            console.error('Error updating bug:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка обновления бага',
                severity: 'error'
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return '#ff9800';
            case 'in_progress': return '#2196f3';
            case 'resolved': return '#4caf50';
            case 'closed': return '#9e9e9e';
            default: return '#757575';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'open': return 'Открыт';
            case 'in_progress': return 'В работе';
            case 'resolved': return 'Решен';
            case 'closed': return 'Закрыт';
            default: return status;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'low': return '#4caf50';
            case 'medium': return '#ff9800';
            case 'high': return '#f44336';
            case 'critical': return '#ff1744';
            default: return '#757575';
        }
    };

    const getPriorityText = (priority: string) => {
        switch (priority) {
            case 'low': return 'Низкий';
            case 'medium': return 'Средний';
            case 'high': return 'Высокий';
            case 'critical': return 'Критический';
            default: return priority;
        }
    };

    const handleQuickUpdate = async (bugId: number, field: 'status' | 'priority', value: string) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            const currentBug = bugLists.find(bug => bug.id === bugId);
            if (!currentBug) {
                console.error('Bug not found for quick update');
                return;
            }

            const updateData = { 
                [field]: value,
                assigned_to: currentBug.assigned_to || null
            };
            
            await axios.patch(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}`, updateData, config);

            setBugLists(prev => prev.map(bug => 
                bug.id === bugId ? { ...bug, [field]: value } : bug
            ));

            let message = `${field === 'status' ? 'Статус' : 'Приоритет'} успешно обновлен`;
            if (field === 'status' && value === 'closed') {
                message = 'Баг закрыт и перемещен вниз списка';
            }
            
            setSnackbar({
                open: true,
                message,
                severity: 'success'
            });

            const actionText = field === 'status' 
                ? `изменил статус на "${getStatusText(value)}"`
                : `изменил приоритет на "${getPriorityText(value)}"`;
            sendUserActivity(actionText);
        } catch (error: any) {
            console.error('Error updating bug:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка обновления',
                severity: 'error'
            });
        }
    };

    const openEditDialog = async (bug: BugList) => {
        setEditingBug(bug);
        setFormData({
            title: bug.title,
            description: bug.description,
            status: bug.status,
            priority: bug.priority,
            assigned_to: bug.assigned_to ? bug.assigned_to.toString() : ''
        });
        
        await loadAttachments(bug.id);
        
        setEditBugDialogOpen(true);
    };

    const handleDeleteBug = async (bugId: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}`, config);

            setSnackbar({
                open: true,
                message: 'Баг успешно удален',
                severity: 'success'
            });

            setBugLists(prev => prev.filter(bug => bug.id !== bugId));
            
            setDeleteConfirmDialogOpen(false);
            setBugToDelete(null);
        } catch (error: any) {
            console.error('Error deleting bug:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка удаления бага',
                severity: 'error'
            });
        }
    };

    const openDeleteConfirmDialog = (bug: BugList) => {
        setBugToDelete(bug);
        setDeleteConfirmDialogOpen(true);
    };

    const getPriorityValue = (priority: string) => {
        switch (priority) {
            case 'low': return 1;
            case 'medium': return 2;
            case 'high': return 3;
            case 'critical': return 4;
            default: return 0;
        }
    };

    const getFilteredAndSortedBugs = () => {
        let filteredBugs = [...bugLists];

        if (filterType === 'assigned_to_me' && currentUserId) {
            filteredBugs = filteredBugs.filter(bug => bug.assigned_to === currentUserId);
        }

        const openBugs = filteredBugs.filter(bug => bug.status !== 'closed');
        const closedBugs = filteredBugs.filter(bug => bug.status === 'closed');

        const sortFn = (a: BugList, b: BugList) => {
            if (sortType === 'priority_desc') {
                return getPriorityValue(b.priority) - getPriorityValue(a.priority);
            } else if (sortType === 'priority_asc') {
                return getPriorityValue(a.priority) - getPriorityValue(b.priority);
            } else if (sortType === 'newest') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else if (sortType === 'oldest') {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            } else {
                return getPriorityValue(b.priority) - getPriorityValue(a.priority);
            }
        };

        openBugs.sort(sortFn);
        closedBugs.sort((a, b) => {
            return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        });

        return [...openBugs, ...closedBugs];
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            status: 'open',
            priority: 'medium',
            assigned_to: ''
        });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTimeAgo = (timestamp: string) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) {
            return 'только что';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes} мин. назад`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${hours} ч. назад`;
        } else {
            return time.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };

    const sendUserActivity = async (action: string) => {
        try {
            const token = localStorage.getItem('token');
            if (!token || !projectId || !currentUserId) return;

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (action === 'активен') {
                return; 
            }
            

            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/projects/${projectId}/activity`, {
                action: action,
                timestamp: new Date().toISOString()
            }, config);
        } catch (error) {
            console.error('Error sending user activity:', error);
        }
    };

    const toggleActivityPanelCollapsed = () => {
        const newCollapsed = !activityPanelCollapsed;
        setActivityPanelCollapsed(newCollapsed);
        localStorage.setItem('activityPanelCollapsed', JSON.stringify(newCollapsed));
    };

    const loadAttachments = async (bugId: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            const response = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}/attachments`,
                config
            );
            setAttachments(response.data);
            
            if (editingBug && editingBug.id === bugId) {
                setEditingBug(prev => prev ? { ...prev, attachments: response.data } : null);
            }
            
            if (selectedBug && selectedBug.id === bugId) {
                setSelectedBug(prev => prev ? { ...prev, attachments: response.data } : null);
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
        }
    };

    const loadAllBugAttachments = async (bugs: BugList[]) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            const bugsWithAttachments = await Promise.all(
                bugs.map(async (bug) => {
                    try {
                        const response = await axios.get(
                            `${import.meta.env.VITE_BACKEND_URL}/bugs/${bug.id}/attachments`,
                            config
                        );
                        return { ...bug, attachments: response.data };
                    } catch (error) {
                        console.error(`Error loading attachments for bug ${bug.id}:`, error);
                        return { ...bug, attachments: [] };
                    }
                })
            );

            setBugLists(bugsWithAttachments);
        } catch (error) {
            console.error('Error loading all bug attachments:', error);
        }
    };

    const openAttachmentsDialog = (bug: BugList) => {
        setSelectedBugForAttachments(bug);
        setAttachmentsDialogOpen(true);
        loadAttachments(bug.id);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedBugForAttachments) return;

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            setSnackbar({
                open: true,
                message: 'Размер файла не должен превышать 10MB',
                severity: 'error'
            });
            return;
        }

        setUploadingFile(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const formData = new FormData();
            formData.append('file', file);

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            };

            await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/bugs/${selectedBugForAttachments.id}/attachments/file`,
                formData,
                config
            );

            await loadAttachments(selectedBugForAttachments.id);
            
            setSnackbar({
                open: true,
                message: 'Файл успешно загружен',
                severity: 'success'
            });

            sendUserActivity('добавил файл к багу');
        } catch (error: any) {
            console.error('Error uploading file:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка загрузки файла',
                severity: 'error'
            });
        } finally {
            setUploadingFile(false);
        }
    };

    const handleAddLink = async () => {
        if (!linkForm.name || !linkForm.url || !selectedBugForAttachments) return;

        if (!linkForm.url.startsWith('http://') && !linkForm.url.startsWith('https://')) {
            setSnackbar({
                open: true,
                message: 'URL должен начинаться с http:// или https://',
                severity: 'error'
            });
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/bugs/${selectedBugForAttachments.id}/attachments/link`,
                linkForm,
                config
            );

            await loadAttachments(selectedBugForAttachments.id);
            
            setLinkForm({ name: '', url: '' });
            
            setSnackbar({
                open: true,
                message: 'Ссылка успешно добавлена',
                severity: 'success'
            });

            sendUserActivity('добавил ссылку к багу');
        } catch (error: any) {
            console.error('Error adding link:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка добавления ссылки',
                severity: 'error'
            });
        }
    };

    const handleDeleteAttachment = async (attachmentId: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            await axios.delete(
                `${import.meta.env.VITE_BACKEND_URL}/attachments/${attachmentId}`,
                config
            );

            if (selectedBugForAttachments) {
                await loadAttachments(selectedBugForAttachments.id);
            }

            if (editingBug) {
                setEditingBug(prev => prev ? {
                    ...prev,
                    attachments: prev.attachments?.filter(att => att.id !== attachmentId) || []
                } : null);
            }

            if (selectedBug) {
                setSelectedBug(prev => prev ? {
                    ...prev,
                    attachments: prev.attachments?.filter(att => att.id !== attachmentId) || []
                } : null);
            }

            setBugLists(prev => prev.map(bug => ({
                ...bug,
                attachments: bug.attachments?.filter(att => att.id !== attachmentId) || []
            })));
            
            setSnackbar({
                open: true,
                message: 'Вложение успешно удалено',
                severity: 'success'
            });

            sendUserActivity('удалил вложение из бага');
        } catch (error: any) {
            console.error('Error deleting attachment:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Ошибка удаления вложения',
                severity: 'error'
            });
        }
    };

    const handleCreateBugFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        const maxSize = 10 * 1024 * 1024;
        
        const validFiles = files.filter(file => {
            if (file.size > maxSize) {
                setSnackbar({
                    open: true,
                    message: `Файл "${file.name}" превышает 10MB`,
                    severity: 'error'
                });
                return false;
            }
            return true;
        });
        
        setCreateBugAttachments(prev => [...prev, ...validFiles]);
    };

    const handleEditBugFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        const maxSize = 10 * 1024 * 1024;
        
        const validFiles = files.filter(file => {
            if (file.size > maxSize) {
                setSnackbar({
                    open: true,
                    message: `Файл "${file.name}" превышает 10MB`,
                    severity: 'error'
                });
                return false;
            }
            return true;
        });
        
        setEditBugAttachments(prev => [...prev, ...validFiles]);
    };

    const removeCreateBugFile = (index: number) => {
        setCreateBugAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const removeEditBugFile = (index: number) => {
        setEditBugAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const addCreateBugLink = () => {
        if (!newLinkForm.name || !newLinkForm.url) return;
        
        if (!newLinkForm.url.startsWith('http://') && !newLinkForm.url.startsWith('https://')) {
            setSnackbar({
                open: true,
                message: 'URL должен начинаться с http:// или https://',
                severity: 'error'
            });
            return;
        }
        
        setCreateBugLinks(prev => [...prev, { ...newLinkForm }]);
        setNewLinkForm({ name: '', url: '' });
    };

    const addEditBugLink = () => {
        if (!newLinkForm.name || !newLinkForm.url) return;
        
        if (!newLinkForm.url.startsWith('http://') && !newLinkForm.url.startsWith('https://')) {
            setSnackbar({
                open: true,
                message: 'URL должен начинаться с http:// или https://',
                severity: 'error'
            });
            return;
        }
        
        setEditBugLinks(prev => [...prev, { ...newLinkForm }]);
        setNewLinkForm({ name: '', url: '' });
    };

    const removeCreateBugLink = (index: number) => {
        setCreateBugLinks(prev => prev.filter((_, i) => i !== index));
    };

    const removeEditBugLink = (index: number) => {
        setEditBugLinks(prev => prev.filter((_, i) => i !== index));
    };

    const uploadAttachments = async (bugId: number, files: File[], links: { name: string; url: string }[]) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            };

            try {
                await axios.post(
                    `${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}/attachments/file`,
                    formData,
                    config
                );
            } catch (error: any) {
                console.error('Error uploading file:', error);
                setSnackbar({
                    open: true,
                    message: `Ошибка загрузки файла "${file.name}"`,
                    severity: 'error'
                });
            }
        }

        for (const link of links) {
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            try {
                await axios.post(
                    `${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}/attachments/link`,
                    link,
                    config
                );
            } catch (error: any) {
                console.error('Error adding link:', error);
                setSnackbar({
                    open: true,
                    message: `Ошибка добавления ссылки "${link.name}"`,
                    severity: 'error'
                });
            }
        }

        try {
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const response = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/bugs/${bugId}/attachments`,
                config
            );
            setBugLists(prev => prev.map(bug =>
                bug.id === bugId ? { ...bug, attachments: response.data } : bug
            ));
        } catch (error) {
            //
        }
    };

    const handleOpenBugDialog = (b: BugList) => {
        setSelectedBug(b);
        setBugDetailDialogOpen(true);
        localStorage.setItem('lastViewedBugId', String(b.id));
        setUnreadBugs(prev => {
            const updated = new Set(prev);
            updated.delete(b.id);
            return updated;
        });
    };

    const handleCloseBugDialog = () => {
        setBugDetailDialogOpen(false);
        setSelectedBug(null);
        localStorage.removeItem('lastViewedBugId');
    };

    useEffect(() => {
        if (selectedBug) {
            const found = bugLists.find(bug => bug.id === selectedBug.id);
            if (
                found &&
                found.attachments &&
                selectedBug.attachments &&
                (
                    found.attachments.length !== selectedBug.attachments.length ||
                    found.attachments.some((a, i) => a.id !== selectedBug.attachments?.[i]?.id)
                )
            ) {
                setSelectedBug({ ...found });
            }
        }
        if (editingBug) {
            const found = bugLists.find(bug => bug.id === editingBug.id);
            if (
                found &&
                found.attachments &&
                editingBug.attachments &&
                (
                    found.attachments.length !== editingBug.attachments.length ||
                    found.attachments.some((a, i) => a.id !== editingBug.attachments?.[i]?.id)
                )
            ) {
                setEditingBug({ ...found });
            }
        }
    }, [bugLists]);

    if (loading) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '50vh',
                flexDirection: 'column',
                gap: 2
            }}>
                <CircularProgress sx={{ color: '#f06a6a' }} />
                <Typography variant="body1" sx={{ color: '#cccccc' }}>
                    Загрузка проекта...
                </Typography>
            </Box>
        );
    }

    if (!project) {
        return (
            <Box sx={{ 
                py: 4,
                px: { xs: 2, md: 4 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh'
            }}>
                <Box sx={{
                    textAlign: 'center',
                    p: 4,
                    bgcolor: '#212134',
                    borderRadius: 3,
                    border: '1px solid #32324d',
                    maxWidth: 400
                }}>
                    <Typography variant="h5" sx={{ 
                        color: '#fff',
                        mb: 2,
                        fontWeight: 'bold'
                    }}>
                        Проект не найден
                    </Typography>
                    <Typography variant="body1" sx={{ 
                        color: '#cccccc',
                        mb: 3
                    }}>
                        Запрашиваемый проект не существует или у вас нет к нему доступа.
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/projects')}
                        sx={{
                            bgcolor: '#4945ff',
                                borderColor: '#4945ff',
                            '&:hover': { bgcolor: '#7b79ff', borderColor: '#7b79ff' },
                            color: '#ffffff',
                            fontWeight: 'bold'
                        }}
                    >
                        Вернуться к проектам
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ 
            py: 4,
            px: { xs: 2, md: 4 }
        }}>
            <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <IconButton 
                        onClick={() => navigate('/projects')}
                        sx={{ 
                            color: '#fff', 
                            mr: 2,
                            '&:hover': {
                                color: '#7b79ff',
                                bgcolor: 'rgba(0, 0, 0, 0.1)'
                            }
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Avatar
                        src={project.icon_url}
                        sx={{ 
                            width: 64, 
                            height: 64, 
                            mr: 3,
                            bgcolor: '#181826',
                            color: '#fff',
                            border: '1px solid #4a4a6a'
                        }}
                    >
                        {project.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h4" sx={{ 
                            color: '#fff', 
                            fontWeight: 'bold'
                        }}>
                            {project.name}
                        </Typography>
                        <Typography variant="body1" sx={{ 
                            color: '#cccccc'
                        }}>
                            Создан {formatDate(project.created_at)}
                        </Typography>
                    </Box>
                    
                    <Tooltip title="Настройки уведомлений">
                        <IconButton 
                            onClick={() => setNotificationDialogOpen(true)}
                            sx={{ 
                                color: '#ff9800',
                                '&:hover': { 
                                    bgcolor: '',
                                    color: '#181826'
                                }
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🔔</span>
                        </IconButton>
                    </Tooltip>
                </Box>

                <Typography variant="body1" sx={{ 
                    color: '#cccccc', 
                    mb: 4
                }}>
                    {project.description}
                </Typography>

                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                    gap: 1.5,
                    mb: 3
                }}>
                    <Card sx={{ 
                        bgcolor: '#212134',
                        border: '1px solid #32324d',
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        backgroundImage:'none',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: '#c0c0cf'
                        }
                    }}>
                        <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                <GroupIcon sx={{ fontSize: 20, color: '#fff' }} />
                                <Typography variant="h5" sx={{ 
                                    color: '#fff', 
                                    fontWeight: 'bold'
                                }}>
                                    {members.length}
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ 
                                color: '#cccccc',
                                fontSize: '0.75rem'
                            }}>
                                Участников
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ 
                        bgcolor: '#212134',
                        border: '1px solid #32324d',
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        backgroundImage:'none',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: '#c0c0cf'
                        }
                    }}>
                        <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                <BugIcon sx={{ fontSize: 20, color: '#fff' }} />
                                <Typography variant="h5" sx={{ 
                                    color: '#fff', 
                                    fontWeight: 'bold'
                                }}>
                                    {bugLists.filter(bug => bug.status === 'resolved' || bug.status === 'closed').length}/{bugLists.length}
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ 
                                color: '#cccccc',
                                fontSize: '0.75rem'
                            }}>
                                Закрыто/Всего
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ 
                        bgcolor: '#212134',
                        border: '1px solid #32324d',
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        backgroundImage:'none',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: '#c0c0cf'
                        }
                    }}>
                        <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                <BugIcon sx={{ fontSize: 20, color: '#fff' }} />
                                <Typography variant="h5" sx={{ 
                                    color: '#fff', 
                                    fontWeight: 'bold'
                                }}>
                                    {bugLists.filter(bug => bug.status === 'open').length}
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ 
                                color: '#cccccc',
                                fontSize: '0.75rem'
                            }}>
                                Открытых
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ 
                        bgcolor: '#212134',
                        border: '1px solid #32324d',
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        backgroundImage:'none',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: '#c0c0cf'
                        }
                    }}>
                        <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                                <BugIcon sx={{ fontSize: 20, color: '#fff' }} />
                                <Typography variant="h5" sx={{ 
                                    color: '#fff', 
                                    fontWeight: 'bold'
                                }}>
                                    {bugLists.filter(bug => bug.status === 'resolved' || bug.status === 'closed').length}
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ 
                                color: '#cccccc',
                                fontSize: '0.75rem'
                            }}>
                                Закрытых
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" sx={{ 
                            color: '#fff',
                            fontWeight: 'bold'
                        }}>
                            Список багов
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateBugDialogOpen(true)}
                            size="small"
                            sx={{
                                bgcolor: '#4945ff',
                                borderColor: '#4945ff',
                                fontSize: '0.875rem',
                                px: 2,
                                py: 1,
                                '&:hover': { 
                                    bgcolor: '#7b79ff',
                                    borderColor: '#7b79ff'
                                },
                                color: '#ffffff'
                            }}
                        >
                            Добавить баг
                        </Button>
                    </Box>

                    <Box sx={{ 
                        display: 'flex', 
                        gap: 2, 
                        mb: 3,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        p: 2,
                        bgcolor: '#212134',
                        borderRadius: 3,
                        border: '1px solid #32324d'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ 
                                color: '#fff',
                                fontWeight: 'bold'
                            }}>
                                Показать:
                            </Typography>
                            <Button
                                variant={filterType === 'all' ? 'contained' : 'outlined'}
                                size="small"
                                onClick={() => setFilterType('all')}
                                sx={{
                                    bgcolor: filterType === 'all' ? '#4945ff' : 'transparent',
                                    color: filterType === 'all' ? 'white' : '#cccccc',
                                    borderColor: '#32324d',
                                    borderRadius: '6px',
                                    '&:hover': {
                                        bgcolor: filterType === 'all' ? '#4945ff' : '#4945ff',
                                        borderColor: '#4945ff'
                                    }
                                }}
                            >
                                Все
                            </Button>
                            <Button
                                variant={filterType === 'assigned_to_me' ? 'contained' : 'outlined'}
                                size="small"
                                onClick={() => setFilterType('assigned_to_me')}
                                sx={{
                                    bgcolor: filterType === 'assigned_to_me' ? '#4945ff' : 'transparent',
                                    color: filterType === 'assigned_to_me' ? 'white' : '#cccccc',
                                    borderColor: '#32324d',
                                    borderRadius: '6px',
                                    '&:hover': {
                                        bgcolor: filterType === 'assigned_to_me' ? '#4945ff' : '#4945ff',
                                        borderColor: '#4945ff'
                                    }
                                }}
                            >
                                Назначенные мне
                            </Button>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ 
                                color: '#fff',
                                fontWeight: 'bold'
                            }}>
                                Сортировка:
                            </Typography>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <Select
                                    value={sortType}
                                    onChange={e => setSortType(e.target.value as any)}
                                    displayEmpty
                                    sx={{ 
                                        bgcolor: 'transparent',
                                        color: '#ffffff',
                                        borderColor: '#4945ff',
                                        borderRadius: '6px',
                                        height: 32,
                                        fontSize: 12,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#404040'
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#4945ff'
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#4945ff'
                                        },
                                        '& .MuiSelect-select': {
                                            fontSize: 12,
                                            py: 0.5
                                        }
                                    }}
                                >
                                    <MenuItem value="none" sx={{ bgcolor: '#1a1a1a', color: '#ffffff', fontSize: 12 }}>По умолчанию</MenuItem>
                                    <MenuItem value="priority_desc" sx={{ bgcolor: '#1a1a1a', color: '#ffffff', fontSize: 12 }}>Важные → Неважные</MenuItem>
                                    <MenuItem value="priority_asc" sx={{ bgcolor: '#1a1a1a', color: '#ffffff', fontSize: 12 }}>Неважные → Важные</MenuItem>
                                    <MenuItem value="newest" sx={{ bgcolor: '#1a1a1a', color: '#ffffff', fontSize: 12 }}>Сначала новые</MenuItem>
                                    <MenuItem value="oldest" sx={{ bgcolor: '#1a1a1a', color: '#ffffff', fontSize: 12 }}>Сначала старые</MenuItem>
                                </Select>
                            </FormControl>
                            {sortType !== 'none' && (
                                <Button 
                                    size="small" 
                                    onClick={() => setSortType('none')}
                                    sx={{
                                        color: '#fff',
                                        borderColor: '#404040',
                                        '&:hover': {
                                            
                                        }
                                    }}
                                >
                                    Сбросить
                                </Button>
                            )}
                        </Box>

                        <Typography variant="body2" sx={{ 
                            color: '#fff', 
                            ml: 'auto',
                            fontWeight: ''
                        }}>
                            {getFilteredAndSortedBugs().length} из {bugLists.length} багов
                        </Typography>
                    </Box>

                    {getFilteredAndSortedBugs().length > 0 ? (
                        <Box 
                            className="bug-list-container"
                            sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 1.5
                            }}
                        >
                            {getFilteredAndSortedBugs().map((bug) => {
                                const isAssignedToMe = currentUserId && bug.assigned_to === currentUserId;
                                const isClosed = bug.status === 'closed';
                                return (
                                    <div 
                                        key={bug.id}
                                        className={`bug-card ${isClosed ? 'closed' : ''}`}
                                    >
                                        <BugCard 
                                            bug={bug}
                                            onEdit={openEditDialog}
                                            onDelete={openDeleteConfirmDialog}
                                            onViewDetails={handleOpenBugDialog}
                                            onOpenAttachments={openAttachmentsDialog}
                                            onQuickUpdate={handleQuickUpdate}
                                            formatTimeAgo={formatTimeAgo}
                                            currentUserId={currentUserId}
                                            hasUnreadComments={unreadBugs.has(bug.id)}
                                            viewersCount={viewersMap[bug.id]?.length || 0}
                                        />
                                    </div>
                                );
                            })}
                        </Box>
                    ) : (
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 6,
                            bgcolor: '#212134',
                            borderRadius: 3,
                            border: '1px solid #32324d'
                        }}>
                            <BugIcon sx={{ 
                                fontSize: 64, 
                                color: '#fff', 
                                mb: 2 
                            }} />
                            <Typography variant="h5" sx={{ 
                                color: '#fff', 
                                mb: 1, 
                                fontSize: '1.1rem',
                                fontWeight: 'bold'
                            }}>
                                {bugLists.length === 0 ? 'Багов пока нет' : 
                                 filterType === 'assigned_to_me' ? 'Вам не назначено багов' : 
                                 'Баги не найдены'}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                                color: '#fff', 
                                mb: 3,
                                maxWidth: 500,
                                mx: 'auto'
                            }}>
                                {bugLists.length === 0 ? 'Создайте первый баг' :
                                 filterType === 'assigned_to_me' ? 'Попробуйте изменить фильтр или попросите назначить вам баг' :
                                 'Попробуйте изменить фильтры или сортировку'}
                            </Typography>
                            {bugLists.length === 0 && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => setCreateBugDialogOpen(true)}
                                    size="small"
                                    sx={{
                                        bgcolor: '#4945ff',
                                borderColor: '#4945ff',
                                fontWeight: 'bold',
                                color: '#ffffff',
                                '&:hover': { 
                                    bgcolor: '#7b79ff',
                                    borderColor: '#7b79ff'
                                },
                                    }}
                                >
                                    Добавить баг
                                </Button>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            <BugDialog 
                open={createBugDialogOpen} 
                onClose={() => setCreateBugDialogOpen(false)}
                onSubmit={handleCreateBug}
                isEdit={false}
                formData={formData}
                setFormData={setFormData}
                assignmentMembers={assignmentMembers}
                createBugAttachments={createBugAttachments}
                editBugAttachments={editBugAttachments}
                createBugLinks={createBugLinks}
                editBugLinks={editBugLinks}
                newLinkForm={newLinkForm}
                setNewLinkForm={setNewLinkForm}
                handleCreateBugFileUpload={handleCreateBugFileUpload}
                handleEditBugFileUpload={handleEditBugFileUpload}
                removeCreateBugFile={removeCreateBugFile}
                removeEditBugFile={removeEditBugFile}
                addCreateBugLink={addCreateBugLink}
                addEditBugLink={addEditBugLink}
                removeCreateBugLink={removeCreateBugLink}
                removeEditBugLink={removeEditBugLink}
                formatFileSize={formatFileSize}
                setEditingBug={setEditingBug}
            />

            <BugDialog 
                open={editBugDialogOpen} 
                onClose={() => setEditBugDialogOpen(false)}
                onSubmit={handleEditBug}
                isEdit={true}
                formData={formData}
                setFormData={setFormData}
                assignmentMembers={assignmentMembers}
                createBugAttachments={createBugAttachments}
                editBugAttachments={editBugAttachments}
                createBugLinks={createBugLinks}
                editBugLinks={editBugLinks}
                newLinkForm={newLinkForm}
                setNewLinkForm={setNewLinkForm}
                handleCreateBugFileUpload={handleCreateBugFileUpload}
                handleEditBugFileUpload={handleEditBugFileUpload}
                removeCreateBugFile={removeCreateBugFile}
                removeEditBugFile={removeEditBugFile}
                addCreateBugLink={addCreateBugLink}
                addEditBugLink={addEditBugLink}
                removeCreateBugLink={removeCreateBugLink}
                removeEditBugLink={removeEditBugLink}
                formatFileSize={formatFileSize}
                editingBug={editingBug}
                setEditingBug={setEditingBug}
            />

            <BugDetailDialog 
                open={bugDetailDialogOpen} 
                onClose={handleCloseBugDialog}
                bug={selectedBug}
                currentUserId={currentUserId || undefined}
                projectId={projectId ? parseInt(projectId) : undefined}
                viewers={selectedBug && selectedBug.id ? viewersMap[selectedBug.id] || [] : []}
            />

            <BugCustomDialog
              open={deleteConfirmDialogOpen}
              onClose={() => setDeleteConfirmDialogOpen(false)}
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <DeleteIcon sx={{ color: '#f44336', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f44336' }}>
                    Подтверждение удаления
                  </Typography>
                </Box>
              }
              maxWidth="sm"
              actions={
                <>
                  <Button onClick={() => setDeleteConfirmDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button
                    onClick={() => bugToDelete && handleDeleteBug(bugToDelete.id)}
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    sx={{ fontWeight: 'bold' }}
                  >
                    Удалить
                  </Button>
                </>
              }
            >
              <Box sx={{ pt: 2 }}>
                <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Вы действительно хотите удалить баг <span style={{ color: '#f06a6a' }}>&quot;{bugToDelete?.title}&quot;</span>?
                </Typography>
                <Box data-error="true" sx={{ p: 2 }}>
                  <Typography variant="body2">
                    Это действие нельзя отменить. Баг будет удален навсегда.
                  </Typography>
                </Box>
              </Box>
            </BugCustomDialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert 
                    onClose={handleCloseSnackbar} 
                    severity={snackbar.severity} 
                    sx={{ 
                        width: '100%',
                        bgcolor: snackbar.severity === 'success' ? 'rgba(76, 175, 80, 0.1)' : 
                                snackbar.severity === 'error' ? 'rgba(244, 67, 54, 0.1)' :
                                snackbar.severity === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                                'rgba(33, 150, 243, 0.1)',
                        border: snackbar.severity === 'success' ? '1px solid #4caf50' :
                                snackbar.severity === 'error' ? '1px solid #f44336' :
                                snackbar.severity === 'warning' ? '1px solid #ff9800' :
                                '1px solid #2196f3',
                        color: snackbar.severity === 'success' ? '#4caf50' :
                               snackbar.severity === 'error' ? '#f44336' :
                               snackbar.severity === 'warning' ? '#ff9800' :
                               '#2196f3',
                        '& .MuiAlert-icon': {
                            color: snackbar.severity === 'success' ? '#4caf50' :
                                   snackbar.severity === 'error' ? '#f44336' :
                                   snackbar.severity === 'warning' ? '#ff9800' :
                                   '#2196f3'
                        }
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <AttachmentsDialog 
                open={attachmentsDialogOpen} 
                onClose={() => setAttachmentsDialogOpen(false)}
                bug={selectedBugForAttachments}
                attachments={attachments}
                onFileUpload={handleFileUpload}
                onAddLink={handleAddLink}
                onDeleteAttachment={handleDeleteAttachment}
                newLinkForm={newLinkForm}
                setNewLinkForm={setNewLinkForm}
            />

            <CustomDialog
              open={notificationDialogOpen}
              onClose={() => setNotificationDialogOpen(false)}
              title="Настройки уведомлений"
              maxWidth="sm"
              fullWidth
              actions={
                <>
                  <Button onClick={() => setNotificationDialogOpen(false)}>
                    Закрыть
                  </Button>
                  <Button
                    onClick={handleSaveNotificationSettings}
                    variant="contained"
                    disabled={notificationSettingsSaving}
                  >
                    {notificationSettingsSaving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </>
              }
            >
              <NotificationSettings ref={notificationSettingsRef} />
            </CustomDialog>

        </Box>
    );
}

export default ProjectView; 