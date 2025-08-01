import React from 'react';
import {
    Box,
    Typography,
    Container,
    Link,
    Divider
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Footer: React.FC = () => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Box
            component="footer"
            sx={{
                background: '#212134',
                borderTop: '1px solid #32324d',
                py: 2,
                mt: 'auto'
            }}
        >
            <Container maxWidth="lg">
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'center', md: 'flex-start' },
                        gap: 1.5
                    }}
                >
                    {/* Логотип и описание */}
                    <Box>
                        <Typography
                            variant="body1"
                            sx={{
                                fontWeight: 'bold',
                                color: '#fff',
                                mb: 0.5
                            }}
                        >
                            Bugtracker
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#a5a5ba',
                                maxWidth: 300,
                                fontSize: '0.75rem'
                            }}
                        >
                            Современная система отслеживания ошибок
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: { xs: 0.5, sm: 2 },
                            alignItems: { xs: 'center', sm: 'flex-start' }
                        }}
                    >
                        <Link
                            href="#"
                            color="inherit"
                            sx={{
                                color: '#a5a5ba',
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                '&:hover': { color: '#f06a6a' }
                            }}
                        >
                            О проекте
                        </Link>
                        
                        <Link
                            href="#"
                            color="inherit"
                            sx={{
                                color: '#a5a5ba',
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                '&:hover': { color: '#f06a6a' }
                            }}
                        >
                            Поддержка
                        </Link>
                    </Box>
                </Box>

                <Divider sx={{ my: 1.5, borderColor: '#404040' }} />

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'center', sm: 'flex-start' },
                        gap: 0.5
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{ color: '#717180', fontSize: '0.75rem' }}
                    >
                        © {new Date().getFullYear()} Bugtracker.
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ color: '#717180', fontSize: '0.75rem' }}
                    >
                        Версия 1.0.4-beta.1
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};

export default Footer; 