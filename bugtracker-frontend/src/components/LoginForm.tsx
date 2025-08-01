import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { TextField, Button, Typography, Box, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function LoginForm() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/login`, {
                ...formData,
            });

            const token = response.data.token;
            login(token);
            setSuccess('Успех');
            setError('');
            setTimeout(() => navigate('/'), 1000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка авторизации');
            setSuccess('');
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
                    Авторизация
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
                    variant="outlined"
                    value={formData.email}
                    onChange={handleChange}
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

                <TextField
                    name="password"
                    label="Пароль"
                    type={showPassword ? 'text' : 'password'}
                    variant="outlined"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    fullWidth
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={handleClickShowPassword}
                                    onMouseDown={handleMouseDownPassword}
                                    edge="end"
                                    sx={{ 
                                        color: '#cccccc',
                                        '&:hover': {
                                            color: '#1976d2'
                                        }
                                    }}
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
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
                    Войти
                </Button>

                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button 
                        variant="text" 
                        onClick={() => navigate('/auth/register/internal')}
                        sx={{ 
                            color: '#a5a5ba', 
                            textTransform: 'none',
                            '&:hover': {
                                color: '#fff',
                                bgcolor: '#181826'
                            }
                        }}
                    >
                        Создать аккаунт
                    </Button>
                    <Button 
                        variant="text" 
                        onClick={() => navigate('/forgot-password')}
                        sx={{ 
                            color: '#a5a5ba', 
                            textTransform: 'none',
                            '&:hover': {
                                color: '#fff',
                                bgcolor: '#181826'
                            }
                        }}
                    >
                        Забыли пароль?
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}

export default LoginForm;
