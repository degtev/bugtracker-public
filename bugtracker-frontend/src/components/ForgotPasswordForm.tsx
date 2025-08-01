import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TextField, Button, Typography, Box, Alert } from '@mui/material';

function ForgotPasswordForm() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/forgot-password`, {
                email,
            });

            setSuccess(response.data.message);
            setEmail('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при отправке запроса');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                py: 4,
                px: { xs: 2, md: 4 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh'
            }}
        >
            <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                    width: '100%',
                    maxWidth: 450,
                    px: { xs: 2, sm: 4 },
                    py: 4,
                    borderRadius: 3,
                    background: '#212134',
                    border: '1px solid #32324d',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}
            >
                <Typography variant="h4" sx={{ 
                    mb: 2, 
                    color: '#fff',
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    textAlign: 'center'
                }}>
                    Восстановление пароля
                </Typography>

                <Typography variant="body2" sx={{ 
                    mb: 2, 
                    color: '#cccccc',
                    textAlign: 'center',
                    bgcolor: 'rgba(240, 106, 106, 0.1)',
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid rgba(240, 106, 106, 0.3)'
                }}>
                    Введите ваш email, и мы отправим инструкции для восстановления пароля.
                </Typography>

                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ 
                            mb: 2,
                            bgcolor: 'rgba(244, 67, 54, 0.1)',
                            border: '1px solid #f44336',
                            color: '#f44336',
                            '& .MuiAlert-icon': {
                                color: '#f44336'
                            }
                        }}
                    >
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert 
                        severity="success" 
                        sx={{ 
                            mb: 2,
                            bgcolor: 'rgba(76, 175, 80, 0.1)',
                            border: '1px solid #4caf50',
                            color: '#4caf50',
                            '& .MuiAlert-icon': {
                                color: '#4caf50'
                            }
                        }}
                    >
                        {success}
                    </Alert>
                )}

                <TextField
                    name="email"
                    label="Email"
                    type="email"
                    variant="outlined"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                            backgroundColor: '#212134',
                            '& fieldset': {
                                borderColor: '#32324d',
                                borderWidth: '1px',
                            },
                            '&:hover fieldset': {
                                borderColor: '#4945ff',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#4945ff',
                                borderWidth: '1px',
                                color:'red!important'
                            },
                        },
                        '& .MuiInputLabel-root': {
                            color: '#cccccc',
                            '&.Mui-focused': {
                                color: '#1976d2',
                            },
                        },
                        '& .MuiInputBase-input': {
                            color: '#ffffff',
                        },
                    }}
                />

                <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={loading}
                    sx={{
                        mt: 2,
                        height: 45,
                        bgcolor: '#4945ff',
                        '&:hover': { bgcolor: '#7b79ff' },
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                    }}
                >
                    {loading ? 'Отправка...' : 'Отправить инструкции'}
                </Button>

                <Button 
                    variant="text" 
                    onClick={() => navigate('/login')}
                    sx={{ 
                        color: '#a5a5ba', 
                        textTransform: 'none',
                        '&:hover': {
                            color: '#fff',
                            bgcolor: '#181826'
                        }
                    }}
                >
                    Вернуться к входу
                </Button>
            </Box>
        </Box>
    );
}

export default ForgotPasswordForm; 