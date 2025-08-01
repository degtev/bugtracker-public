import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    IconButton
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
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
    getPriorityBorderColor 
} from '../../utils/bugUtils';
import BugCustomDialog from '../BugCustomDialog';
import axios from 'axios';

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

interface ProjectMember {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    position?: string;
    avatar_url?: string;
    joined_at: string;
    is_creator: boolean;
}

interface BugDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isEdit: boolean;
    formData: {
        title: string;
        description: string;
        status: 'open' | 'in_progress' | 'resolved' | 'closed';
        priority: 'low' | 'medium' | 'high' | 'critical';
        assigned_to: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        title: string;
        description: string;
        status: 'open' | 'in_progress' | 'resolved' | 'closed';
        priority: 'low' | 'medium' | 'high' | 'critical';
        assigned_to: string;
    }>>;
    assignmentMembers: ProjectMember[];
    createBugAttachments: File[];
    editBugAttachments: File[];
    createBugLinks: { name: string; url: string }[];
    editBugLinks: { name: string; url: string }[];
    newLinkForm: { name: string; url: string };
    setNewLinkForm: React.Dispatch<React.SetStateAction<{ name: string; url: string }>>;
    handleCreateBugFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleEditBugFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    removeCreateBugFile: (index: number) => void;
    removeEditBugFile: (index: number) => void;
    addCreateBugLink: () => void;
    addEditBugLink: () => void;
    removeCreateBugLink: (index: number) => void;
    removeEditBugLink: (index: number) => void;
    formatFileSize: (bytes: number) => string;
    editingBug?: BugList | null;
    setEditingBug: React.Dispatch<React.SetStateAction<BugList | null>>;
}

const BugDialog: React.FC<BugDialogProps> = ({
    open,
    onClose,
    onSubmit,
    isEdit,
    formData,
    setFormData,
    assignmentMembers,
    createBugAttachments,
    editBugAttachments,
    createBugLinks,
    editBugLinks,
    newLinkForm,
    setNewLinkForm,
    handleCreateBugFileUpload,
    handleEditBugFileUpload,
    removeCreateBugFile,
    removeEditBugFile,
    addCreateBugLink,
    addEditBugLink,
    removeCreateBugLink,
    removeEditBugLink,
    formatFileSize,
    editingBug,
    setEditingBug
}) => {
    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType === 'application/pdf') return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType === 'text/plain') return '📄';
        return '📎';
    };

    const getSafeFileName = (fileName: string) => {
        try {
            return decodeURIComponent(fileName);
        } catch {
            return fileName;
        }
    };

    const currentAttachments = isEdit ? editBugAttachments : createBugAttachments;
    const currentLinks = isEdit ? editBugLinks : createBugLinks;
    const handleFileUpload = isEdit ? handleEditBugFileUpload : handleCreateBugFileUpload;
    const removeFile = isEdit ? removeEditBugFile : removeCreateBugFile;
    const addLink = isEdit ? addEditBugLink : addCreateBugLink;
    const removeLink = isEdit ? removeEditBugLink : removeCreateBugLink;

    const handleDeleteExistingAttachment = async (attachmentId: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/attachments/${attachmentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (editingBug && setEditingBug) {
                setEditingBug(prev => prev ? {
                    ...prev,
                    attachments: (prev.attachments || []).filter(att => att.id !== attachmentId)
                } : null);
            }
        } catch (e) {

        }
    };

    return (
        <BugCustomDialog
            open={open}
            onClose={onClose}
            title={isEdit ? 'Редактировать баг' : 'Создать новый баг'}
            maxWidth="md"
            actions={
                <>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button 
                        onClick={onSubmit}
                        variant="contained"
                        disabled={!formData.title || !formData.description}
                    >
                        {isEdit ? 'Сохранить изменения' : 'Добавить баг'}
                    </Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                    label="Заголовок"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    fullWidth
                    required
                />
                <TextField
                    label="Описание"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    fullWidth
                    multiline
                    rows={4}
                    required
                />

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel sx={{ 
                                color: '#cccccc',
                                '&.Mui-focused': {
                                    color: '#f06a6a',
                                }
                            }}>
                                Статус
                            </InputLabel>
                            <Select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    status: e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed' 
                                }))}
                                sx={{
                                    color: '#ffffff',
                                    borderRadius: '8px',
                                    backgroundColor: '#1a1a1a',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#404040',
                                        borderWidth: '1px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#f06a6a'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#f06a6a'
                                    }
                                }}
                                renderValue={(value) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getStatusIcon(value)}</span>
                                        <span>{getStatusText(value)}</span>
                                    </Box>
                                )}
                            >
                                <MenuItem value="open" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getStatusBgColor('open')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getStatusIcon('open')}</span>
                                        <span>{getStatusText('open')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="in_progress" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getStatusBgColor('in_progress')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getStatusIcon('in_progress')}</span>
                                        <span>{getStatusText('in_progress')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="resolved" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getStatusBgColor('resolved')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getStatusIcon('resolved')}</span>
                                        <span>{getStatusText('resolved')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="closed" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getStatusBgColor('closed')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getStatusIcon('closed')}</span>
                                        <span>{getStatusText('closed')}</span>
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel sx={{ 
                                color: '#cccccc',
                                '&.Mui-focused': {
                                    color: '#f06a6a',
                                }
                            }}>
                                Приоритет
                            </InputLabel>
                            <Select
                                value={formData.priority}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' 
                                }))}
                                sx={{
                                    color: '#ffffff',
                                    borderRadius: '8px',
                                    backgroundColor: '#1a1a1a',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#404040',
                                        borderWidth: '1px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#f06a6a'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#f06a6a'
                                    }
                                }}
                                renderValue={(value) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getPriorityIcon(value)}</span>
                                        <span>{getPriorityText(value)}</span>
                                    </Box>
                                )}
                            >
                                <MenuItem value="low" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getPriorityBgColor('low')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getPriorityIcon('low')}</span>
                                        <span>{getPriorityText('low')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="medium" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getPriorityBgColor('medium')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getPriorityIcon('medium')}</span>
                                        <span>{getPriorityText('medium')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="high" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getPriorityBgColor('high')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getPriorityIcon('high')}</span>
                                        <span>{getPriorityText('high')}</span>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="critical" sx={{ 
                                    bgcolor: '#1a1a1a', 
                                    color: '#ffffff',
                                    '&:hover': {
                                        bgcolor: getPriorityBgColor('critical')
                                    }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span style={{ fontSize: 14 }}>{getPriorityIcon('critical')}</span>
                                        <span>{getPriorityText('critical')}</span>
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <FormControl fullWidth>
                        <InputLabel sx={{ 
                            color: '#cccccc',
                            '&.Mui-focused': {
                                color: '#f06a6a',
                            }
                        }}>
                            Назначить на
                        </InputLabel>
                        <Select
                            value={formData.assigned_to}
                            onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                            sx={{
                                color: '#ffffff',
                                borderRadius: '8px',
                                backgroundColor: '#1a1a1a',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#404040',
                                    borderWidth: '1px'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#f06a6a'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#f06a6a'
                                }
                            }}
                        >
                            <MenuItem value="" sx={{ bgcolor: '#1a1a1a', color: '#ffffff' }}>Не назначен</MenuItem>
                            {assignmentMembers.map((member) => (
                                <MenuItem key={member.id} value={member.id.toString()} sx={{ bgcolor: '#1a1a1a', color: '#ffffff' }}>
                                    {member.first_name} {member.last_name} ({member.email})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Box>
                        <Typography variant="h6" sx={{ 
                            mb: 2, 
                            color: '#f06a6a', 
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                        }}>
                            Вложения
                        </Typography>

                        {isEdit && editingBug && editingBug.attachments && editingBug.attachments.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ 
                                    mb: 1, 
                                    color: '#cccccc',
                                    fontWeight: 'bold'
                                }}>
                                    Существующие вложения
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {editingBug.attachments.map((attachment) => (
                                        <Box
                                            key={attachment.id}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                p: 1,
                                                bgcolor: '#1a1a1a',
                                                borderRadius: 2,
                                                border: '1px solid #404040'
                                            }}
                                        >
                                            <Box sx={{ fontSize: 16 }}>
                                                {attachment.type === 'link' ? '🔗' : getFileIcon(attachment.mime_type || '')}
                                            </Box>
                                            <Typography variant="body2" sx={{ 
                                                color: '#cccccc', 
                                                flex: 1 
                                            }}>
                                                {getSafeFileName(attachment.name)}
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => attachment.type === 'file' 
                                                    ? window.open(`${import.meta.env.VITE_BACKEND_URL}${attachment.url}`, '_blank')
                                                    : window.open(attachment.url, '_blank')
                                                }
                                                sx={{
                                                    borderColor: '#404040',
                                                    color: '#cccccc',
                                                    borderRadius: '6px',
                                                    '&:hover': { 
                                                        borderColor: '#f06a6a',
                                                        color: '#f06a6a',
                                                        bgcolor: 'rgba(240, 106, 106, 0.1)'
                                                    }
                                                }}
                                            >
                                                Открыть
                                            </Button>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDeleteExistingAttachment(attachment.id)}
                                                sx={{
                                                    color: '#cccccc',
                                                    '&:hover': {
                                                        color: '#f44336',
                                                        bgcolor: 'rgba(244, 67, 54, 0.1)'
                                                    }
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ 
                                mb: 1, 
                                color: '#cccccc',
                                fontWeight: 'bold'
                            }}>
                                {isEdit ? 'Добавить файлы' : 'Файлы'}
                            </Typography>
                            <Button
                                variant="outlined"
                                component="label"
                                sx={{
                                    borderColor: '#404040',
                                    color: '#cccccc',
                                    borderRadius: '8px',
                                    '&:hover': { 
                                        borderColor: '#f06a6a',
                                        color: '#f06a6a',
                                        bgcolor: 'rgba(240, 106, 106, 0.1)'
                                    }
                                }}
                            >
                                Выбрать файлы
                                <input
                                    type="file"
                                    hidden
                                    multiple
                                    onChange={handleFileUpload}
                                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                />
                            </Button>
                            {currentAttachments.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {currentAttachments.map((file, index) => (
                                        <Box key={index} sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1,
                                            p: 1,
                                            bgcolor: '#1a1a1a',
                                            borderRadius: 2,
                                            border: '1px solid #404040'
                                        }}>
                                            <Typography variant="body2" sx={{ 
                                                color: '#cccccc', 
                                                flex: 1 
                                            }}>
                                                {file.name} ({formatFileSize(file.size)})
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => removeFile(index)}
                                                sx={{ 
                                                    color: '#cccccc',
                                                    '&:hover': {
                                                        color: '#f44336',
                                                        bgcolor: 'rgba(244, 67, 54, 0.1)'
                                                    }
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ 
                                mb: 1, 
                                color: '#cccccc',
                                fontWeight: 'bold'
                            }}>
                                {isEdit ? 'Добавить ссылки' : 'Ссылки'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <TextField
                                    label="Название"
                                    value={newLinkForm.name}
                                    onChange={(e) => setNewLinkForm(prev => ({ ...prev, name: e.target.value }))}
                                    size="small"
                                    sx={{
                                        flex: 1,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '6px',
                                            backgroundColor: '#1a1a1a',
                                            '& fieldset': {
                                                borderColor: '#404040',
                                                borderWidth: '1px',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#f06a6a',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#f06a6a',
                                                borderWidth: '2px',
                                            },
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: '#cccccc',
                                            '&.Mui-focused': {
                                                color: '#f06a6a',
                                            },
                                        },
                                        '& .MuiInputBase-input': {
                                            color: '#ffffff',
                                        },
                                    }}
                                />
                                <TextField
                                    label="URL"
                                    value={newLinkForm.url}
                                    onChange={(e) => setNewLinkForm(prev => ({ ...prev, url: e.target.value }))}
                                    size="small"
                                    sx={{
                                        flex: 2,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '6px',
                                            backgroundColor: '#1a1a1a',
                                            '& fieldset': {
                                                borderColor: '#404040',
                                                borderWidth: '1px',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#f06a6a',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#f06a6a',
                                                borderWidth: '2px',
                                            },
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: '#cccccc',
                                            '&.Mui-focused': {
                                                color: '#f06a6a',
                                            },
                                        },
                                        '& .MuiInputBase-input': {
                                            color: '#ffffff',
                                        },
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={addLink}
                                    disabled={!newLinkForm.name || !newLinkForm.url}
                                    sx={{
                                        bgcolor: '#f06a6a',
                                        '&:hover': { bgcolor: '#e55a5a' },
                                        '&:disabled': {
                                            bgcolor: '#404040',
                                            color: '#888888'
                                        }
                                    }}
                                >
                                    Добавить
                                </Button>
                            </Box>
                            {currentLinks.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {currentLinks.map((link, index) => (
                                        <Box key={index} sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1,
                                            p: 1,
                                            bgcolor: '#1a1a1a',
                                            borderRadius: 2,
                                            border: '1px solid #404040'
                                        }}>
                                            <Typography variant="body2" sx={{ 
                                                color: '#cccccc', 
                                                flex: 1 
                                            }}>
                                                🔗 {link.name}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => removeLink(index)}
                                                sx={{ 
                                                    color: '#cccccc',
                                                    '&:hover': {
                                                        color: '#f44336',
                                                        bgcolor: 'rgba(244, 67, 54, 0.1)'
                                                    }
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </BugCustomDialog>
    );
};

export default BugDialog; 