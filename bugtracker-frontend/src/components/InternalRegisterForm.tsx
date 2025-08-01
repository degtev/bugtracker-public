import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

import { TextField, Button, Typography, Box, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

function InternalRegister() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        password: '',
        confirmPassword: '',
        email: '',
        role: 'internal' as const,
        position: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isVerificationSent, setIsVerificationSent] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        setVerificationCode('');
        setError('');
        setSuccess('');
        setIsVerificationSent(false);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVerificationCode(e.target.value);
    };

    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const handleClickShowConfirmPassword = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        if (formData.password.length < 6) {
            setError('Пароль должен содержать минимум 6 символов');
            return;
        }

        setLoading(true);
        setError('');
        setVerificationCode('');

        try {
            const { confirmPassword, ...dataToSend } = formData;
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/register/internal`, dataToSend);
            setSuccess('Код подтверждения отправлен на ваш email!');
            setIsVerificationSent(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка регистрации');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!verificationCode || verificationCode.length !== 6) {
            setError('Введите 6-значный код подтверждения');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { confirmPassword, ...dataToSend } = formData;
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/verify-email`, {
                ...dataToSend,
                verificationCode,
            });
            
            setSuccess('Email подтвержден! Регистрация завершена.');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка подтверждения');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setLoading(true);
        setError('');

        try {
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/resend-verification`, {
                email: formData.email,
            });
            setSuccess('Новый код подтверждения отправлен!');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка отправки кода');
        } finally {
            setLoading(false);
        }
    };

    if (isVerificationSent) {
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
                    onSubmit={handleVerifyEmail}
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
                        Подтверждение email
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
                        Мы отправили код подтверждения на {formData.email}
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
                        name="verificationCode"
                        label="Код подтверждения"
                        variant="outlined"
                        value={verificationCode || ''}
                        onChange={handleVerificationCodeChange}
                        required
                        fullWidth
                        placeholder="123456"
                        inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '5px', fontSize: '1rem' } }}
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
                                textAlign: 'center',
                                letterSpacing: '5px',
                                fontSize: '1rem',
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
                        {loading ? 'Подтверждение...' : 'Подтвердить'}
                    </Button>

                    <Button 
                        variant="text" 
                        onClick={handleResendCode}
                        disabled={loading}
                        sx={{ 
                            color: '#a5a5ba', 
                            textTransform: 'none',
                            '&:hover': {
                                color: '#fff',
                                bgcolor: '#181826'
                            }
                        }}
                    >
                        Отправить код повторно
                    </Button>

                    <Button 
                        variant="text" 
                        onClick={() => {
                            setIsVerificationSent(false);
                            setVerificationCode('');
                            setError('');
                            setSuccess('');
                        }}
                        sx={{ 
                            color: '#a5a5ba', 
                            textTransform: 'none',
                            '&:hover': {
                                color: '#fff',
                                bgcolor: '#181826'
                            }
                        }}
                    >
                        Назад к регистрации
                    </Button>
                </Box>
            </Box>
        );
    }

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
                    Регистрация
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
                    name="first_name"
                    label="Имя"
                    variant="outlined"
                    value={formData.first_name}
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
                    name="last_name"
                    label="Фамилия"
                    variant="outlined"
                    value={formData.last_name}
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
                    name="email"
                    label="Почта"
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
                                        color: '#fff',
                                        '&:hover': {
                                            color: '#fff'
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
                    name="confirmPassword"
                    label="Подтвердите пароль"
                    type={showConfirmPassword ? 'text' : 'password'}
                    variant="outlined"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    fullWidth
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle confirm password visibility"
                                    onClick={handleClickShowConfirmPassword}
                                    onMouseDown={handleMouseDownPassword}
                                    edge="end"
                                    sx={{ 
                                        color: '#fff',
                                        '&:hover': {
                                            color: '#fff'
                                        }
                                    }}
                                >
                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
                    name="position"
                    label="Должность"
                    variant="outlined"
                    value={formData.position}
                    onChange={handleChange}
                    fullWidth
                    required
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
                    {loading ? 'Отправка...' : 'Зарегистрироваться'}
                </Button>
            </Box>
        </Box>
    );
}

export default InternalRegister;
