import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Chip,
    Avatar,
    Button,
    Divider,
    IconButton,
    Snackbar,
    Alert,
    Tooltip
} from '@mui/material';
import {
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import {
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import {
    getStatusColor,
    getStatusText,
    getStatusIcon,
    getStatusBgColor,
    getStatusBorderColor,
    getPriorityColor,
    getPriorityText,
    getPriorityIcon,
    getPriorityBgColor,
    getPriorityBorderColor,
    formatDate,
    formatDateTime,
    getFileIcon,
    getSafeFileName
} from '../../utils/bugUtils';
import BugComments from './BugComments';
import StatusBadge from './StatusBadge';
import BugCustomDialog from '../BugCustomDialog';
import { io as socketIOClient } from 'socket.io-client';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface BugList {
    id: number;
    project_id: number;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    created_by: number;
    assigned_to?: number;
    created_at: string;
    updated_at: string;
    creator_first_name: string;
    creator_last_name: string;
    assignee_first_name?: string;
    assignee_last_name?: string;
    attachments?: any[];
}

interface BugDetailDialogProps {
    open: boolean;
    onClose: () => void;
    bug: BugList | null;
    currentUserId?: number;
    projectId?: number;
    viewers: any[];
}

const BugDetailDialog: React.FC<BugDetailDialogProps> = ({ open, onClose, bug, currentUserId, projectId, viewers }) => {
    if (!bug) return null;
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const [isTracking, setIsTracking] = useState(false);
    const [timer, setTimer] = useState(0);
    const [total, setTotal] = useState(0); 
    const [allTracks, setAllTracks] = useState<any[]>([]);
    const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [showUsers, setShowUsers] = useState(false);

    useEffect(() => {
        if (!open || !bug?.id || !currentUserId) return;
        const fetchTracks = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bug.id}/time-track`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const tracks = await res.json();
                let sum = 0;
                let active = null;
                for (const t of tracks) {
                    if (t.end_time) sum += t.duration || 0;
                    else active = t;
                }
                setTotal(sum);
                if (active) {
                    setIsTracking(true);
                    const start = new Date(active.start_time);
                    setTimer(Math.floor((Date.now() - start.getTime()) / 1000));
                } else {
                    setIsTracking(false);
                    setTimer(0);
                }
            }
            const resAll = await fetch(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bug.id}/time-track/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resAll.ok) {
                const all = await resAll.json();
                setAllTracks(all);
            }
        };
        fetchTracks();
        return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
    }, [open, bug?.id, currentUserId]);

    useEffect(() => {
        if (isTracking) {
            timerInterval.current = setInterval(() => setTimer(t => t + 1), 1000);
        } else if (timerInterval.current) {
            clearInterval(timerInterval.current);
        }
        return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
    }, [isTracking]);

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
    };

    const handleStart = async () => {
        const token = localStorage.getItem('token');
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bug.id}/time-track/start`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsTracking(true);
        setTimer(0);
    };
    const handleStop = async () => {
        const token = localStorage.getItem('token');
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/bugs/${bug.id}/time-track/stop`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsTracking(false);
        setTotal(t => t + timer);
        setTimer(0);
    };

    const handleCopyLink = async () => {
        try {
            const link = `${window.location.origin}/project/${projectId}?bug=${bug.id}`;
            await navigator.clipboard.writeText(link);
            setSnackbar({
                open: true,
                message: 'Ссылка на баг скопирована в буфер обмена',
                severity: 'success'
            });
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Ошибка копирования ссылки',
                severity: 'error'
            });
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const totalAll = allTracks.reduce((acc, t) => acc + (t.duration || 0), 0) + (isTracking ? timer : 0);
    const userTimes: { [userId: number]: { name: string, time: number } } = {};
    for (const t of allTracks) {
        if (!userTimes[t.user_id]) userTimes[t.user_id] = { name: `${t.first_name} ${t.last_name}`, time: 0 };
        userTimes[t.user_id].time += t.duration || 0;
    }
    if (isTracking && currentUserId && userTimes[currentUserId]) {
        userTimes[currentUserId].time += timer;
    }

    return (
        <BugCustomDialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            title={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                        {bug.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <IconButton
                        onClick={handleCopyLink}
                        size="small"
                        sx={{
                            color: '#cccccc',
                            backgroundColor: 'transparent',
                            '&:hover': {
                                color: '#7b79ff',
                                backgroundColor: 'rgba(233, 224, 224, 1)',
                            },
                            '&:hover svg': {
                            color: '#7b79ff',
                            },
                            '& svg': {
                            color: '#fff',
                            }
                        }}
                        title="Скопировать ссылку на баг"
                    >
                        <CopyIcon />
                    </IconButton>
                        <Box sx={{ display: 'flex', gap: 1, pr: 5 }}>
                            <StatusBadge type="status" value={bug.status} size="medium" variant="chip" />
                            <StatusBadge type="priority" value={bug.priority} size="medium" variant="chip" />
                        </Box>
                    </Box>
                </Box>
            }
        >
            <Box sx={{ p: 3 }}>
                <Typography variant="body1" sx={{ mb: 3, color: '#fff', lineHeight: 1.6 }}>
                    {bug.description}
                </Typography>
                <Divider sx={{ my: 2, borderColor: '#404040' }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                    <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid #404040' }}>
                        <Typography variant="subtitle2" sx={{ color: '#888888', mb: 1, fontWeight: 'bold' }}>
                            Создатель
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#f06a6a' }}>
                                {(bug.creator_first_name && bug.creator_first_name.charAt(0)) || '?'}
                            </Avatar>
                            <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                {bug.creator_first_name} {bug.creator_last_name}
                            </Typography>
                        </Box>
                    </Box>
                    {bug.assignee_first_name && (
                        <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid #404040' }}>
                            <Typography variant="subtitle2" sx={{ color: '#888888', mb: 1, fontWeight: 'bold' }}>
                                Назначен на
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: '#36b37e' }}>
                                    {(bug.assignee_first_name && bug.assignee_first_name.charAt(0)) || '?'}
                                </Avatar>
                                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                    {bug.assignee_first_name} {bug.assignee_last_name}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                    <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid #404040' }}>
                        <Typography variant="subtitle2" sx={{ color: '#888888', mb: 1, fontWeight: 'bold' }}>
                            Создан
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cccccc' }}>
                            {formatDateTime(bug.created_at)}
                        </Typography>
                    </Box>
                    <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid #404040' }}>
                        <Typography variant="subtitle2" sx={{ color: '#888888', mb: 1, fontWeight: 'bold' }}>
                            Обновлен
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cccccc' }}>
                            {formatDateTime(bug.updated_at)}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                            size="small"
                            onClick={isTracking ? handleStop : handleStart}
                            sx={{
                                bgcolor: '#4945ff !important',
                                color: '#fff !important',
                                '&:hover': { bgcolor: '#7b79ff !important', color: '#fff !important' },
                                width: 18,
                                height: 18
                            }}
                        >
                            {isTracking ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                        <Typography variant="h6" sx={{ fontWeight: 'normal', color: '#fff', minWidth: 70, fontSize: '0.95rem' }}>
                            {formatTime(timer)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#cccccc', ml: 1, fontSize: '0.75rem' }}>
                            Общее: {formatTime(totalAll)}
                        </Typography>
                        <IconButton size="small" onClick={() => setShowUsers(v => !v)}>
                            {showUsers ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                    </Box>
                    {showUsers && Object.keys(userTimes).length > 0 && (
                        <Box sx={{ mt: 1, ml: 1 }}>
                            <Typography variant="body2" sx={{ color: '#cccccc', mb: 1, fontWeight: 'bold' }}>Время по пользователям:</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {Object.entries(userTimes).map(([uid, u]) => (
                                    <Typography key={uid} variant="body2" sx={{ color: '#cccccc' }}>
                                        {u.name}: {formatTime(u.time)}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
                {bug.attachments && bug.attachments.length > 0 && (
                    <>
                        <Divider sx={{ my: 2, borderColor: '#404040' }} />
                        <Box>
                            <Typography variant="h6" sx={{ mb: 2, color: '#f06a6a', fontWeight: 'bold' }}>
                                Вложения ({bug.attachments.length})
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {bug.attachments.map((attachment) => (
                                    <Box
                                        key={attachment.id}
                                        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: '#1a1a1a', borderRadius: 2, border: '1px solid #404040' }}
                                    >
                                        <Box sx={{ fontSize: 16 }}>
                                            {attachment.type === 'link' ? '🔗' : getFileIcon(attachment.mime_type || '')}
                                        </Box>
                                        <Typography variant="body2" sx={{ color: '#cccccc', flex: 1 }}>
                                            {getSafeFileName(attachment.name)}
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => attachment.type === 'file'
                                                ? window.open(`${import.meta.env.VITE_BACKEND_URL}${attachment.url}`, '_blank')
                                                : window.open(attachment.url, '_blank')
                                            }
                                            sx={{ borderColor: '#404040', color: '#cccccc', borderRadius: '6px', '&:hover': { borderColor: '#f06a6a', color: '#f06a6a', bgcolor: 'rgba(240, 106, 106, 0.1)' } }}
                                        >
                                            Открыть
                                        </Button>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </>
                )}
                <Divider sx={{ my: 2, borderColor: '#404040' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {viewers.length === 0 ? (
                        <Typography variant="body2" sx={{ color: '#cccccc' }}>
                            Никто не смотрит
                        </Typography>
                    ) : (
                        <>
                            <Box sx={{ display: 'flex', gap: 0, position: 'relative' }}>
                                {viewers.map((user, idx) => (
                                    <Tooltip key={user.userId} title={user.name} arrow>
                                        <Avatar sx={{
                                            width: 28,
                                            height: 28,
                                            bgcolor: '#7b79ff',
                                            fontSize: 14,
                                            cursor: 'pointer',
                                            position: 'relative',
                                            zIndex: viewers.length - idx,
                                            ml: idx === 0 ? 0 : '-10px',
                                            border: '2px solid #181826',
                                        }}>
                                            {user.name.charAt(0)}
                                        </Avatar>
                                    </Tooltip>
                                ))}
                            </Box>
                            <Typography variant="body2" sx={{ color: '#cccccc', ml: 1 }}>
                                {viewers.length} человек смотрят
                            </Typography>
                        </>
                    )}
                </Box>
                {currentUserId && projectId && (
                    <BugComments bugId={bug.id} currentUserId={currentUserId} projectId={Number(projectId)} />
                )}
            </Box>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={handleCloseSnackbar}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{
                        bgcolor: snackbar.severity === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                        border: snackbar.severity === 'success' ? '1px solid #4caf50' : '1px solid #f44336',
                        color: snackbar.severity === 'success' ? '#4caf50' : '#f44336',
                        '& .MuiAlert-icon': {
                            color: snackbar.severity === 'success' ? '#4caf50' : '#f44336'
                        }
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </BugCustomDialog>
    );
};

export default BugDetailDialog; 