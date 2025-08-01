import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {Alert, Box, Button, TextField, Typography, InputAdornment, IconButton} from "@mui/material";
import { Visibility, VisibilityOff } from '@mui/icons-material';

function ExternalRegister() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        password: '',
        confirmPassword: '',
        email: '',
        position: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
        if (!token) {
            setError('Отсутствует токен');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        if (formData.password.length < 6) {
            setError('Пароль должен содержать минимум 6 символов');
            return;
        }

        try {
            const { confirmPassword, ...dataToSend } = formData;
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/register/external/complete`, {
                ...dataToSend,
                token,
            });
            setSuccess('Регистрация успешна!');
            setError('');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка регистрации');
        }
    };

    if (!token) {
        return <p>Токен не найден в URL, регистрация невозможна.</p>;
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
                    onChange={handleChange}
                    required
                    fullWidth
                    disabled
                    value={email || ''}
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
                        '& .Mui-disabled': {
                            backgroundColor: '#2a2a2a',
                            '& fieldset': {
                                borderColor: '#404040',
                            },
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
                    Зарегистрироваться
                </Button>
            </Box>
        </Box>
    );

}

export default ExternalRegister;
