import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Avatar,
    Menu,
    MenuItem,
    Box,
    IconButton,
    useTheme,
    useMediaQuery
} from '@mui/material';
import {
    Menu as MenuIcon,
    AccountCircle,
    Logout,
    Settings,
    Dashboard
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
    const { isAuthenticated, logout, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setMobileMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setMobileMenuAnchor(null);
    };

    const handleLogout = () => {
        logout();
        handleMenuClose();
        navigate('/login');
    };

    const handleProfile = () => {
        handleMenuClose();
        navigate('/profile');
    };

    const handleDashboard = () => {
        handleMenuClose();
        navigate('/');
    };

    const handleProjects = () => {
        handleMenuClose();
        navigate('/projects');
    };

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    if (loading) {
        return null;
    }
    if (!isAuthenticated) {
        return null;
    }

    return (
        <AppBar 
            position="fixed" 
            sx={{ 
                zIndex: theme.zIndex.drawer + 1,
                background: '#212134',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                borderBottom: '1px solid #32324d'
            }}
        >
            <Toolbar>
                <Typography
                    variant="body1"
                    component="div"
                    sx={{ 
                        flexGrow: 0, 
                        mr: 4, 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#fff',
                        fontSize: '1.125rem'
                    }}
                    onClick={() => navigate('/')}
                >
                    Bugtracker
                </Typography>

                {!isMobile && (
                    <Box sx={{ display: 'flex', gap: 2, flexGrow: 1 }}>
                        <Button
                            color="inherit"
                            onClick={() => navigate('/')}
                            sx={{
                                color: isActive('/') ? '#7b79ff' : '#ffffff',
                                fontSize: '0.875rem',
                                textTransform: 'none',
                                bgcolor: isActive('/') ? '#181826' : 'transparent',
                                '&:hover': { bgcolor: '#181826' }
                            }}
                        >
                            Главная
                        </Button>
                        <Button
                            color="inherit"
                            onClick={() => navigate('/projects')}
                            sx={{
                                color: isActive('/projects') ? '#7b79ff' : '#ffffff',
                                fontSize: '0.875rem',
                                textTransform: 'none',
                                bgcolor: isActive('/projects') ? '#181826' : 'transparent',
                                '&:hover': { bgcolor: '#181826' }
                            }}
                        >
                            Проекты
                        </Button>
                    </Box>
                )}

                {isMobile && (
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={handleMobileMenuOpen}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                        size="large"
                        edge="end"
                        aria-label="account of current user"
                        aria-controls="menu-appbar"
                        aria-haspopup="true"
                        onClick={handleProfileMenuOpen}
                        color="inherit"
                    >
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#7b79ff' }}>
                            <AccountCircle />
                        </Avatar>
                    </IconButton>
                </Box>

                <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            background: '#212134',
                            border: '1px solid #32324d',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            mt: 1
                        }
                    }}
                >
                    <MenuItem onClick={handleProfile} sx={{ color: '#ffffff', fontSize: '0.875rem' }}>
                        <AccountCircle sx={{ mr: 1, color: '#fff' }} />
                        Профиль
                    </MenuItem>
                    <MenuItem onClick={handleLogout} sx={{ color: '#fff', fontSize: '0.875rem' }}>
                        <Logout sx={{ mr: 1 }} />
                        Выйти
                    </MenuItem>
                </Menu>

                <Menu
                    anchorEl={mobileMenuAnchor}
                    open={Boolean(mobileMenuAnchor)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            background: '#212134',
                            border: '1px solid #32324d',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                            mt: 1
                        }
                    }}
                >
                    <MenuItem onClick={handleDashboard} sx={{ color: '#ffffff', fontSize: '0.875rem' }}>
                        <Dashboard sx={{ mr: 1, color: '#fff' }} />
                        Главная
                    </MenuItem>
                    <MenuItem onClick={handleProjects} sx={{ color: '#ffffff', fontSize: '0.875rem' }}>
                        <Dashboard sx={{ mr: 1, color: '#fff' }} />
                        Проекты
                    </MenuItem>
                </Menu>
            </Toolbar>
        </AppBar>
    );
};

export default Header; 