import React from 'react';
import { Box } from '@mui/material';
import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';
import { shouldShowLayout } from '../utils/authPages';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    const showLayout = shouldShowLayout(location.pathname);
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: '#181826'
            }}
        >
            {showLayout && <Header />}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    pt: showLayout ? '64px' : 0,
                    pb: { xs: 2, md: 0 }
                }}
            >
                {children}
            </Box>
            {showLayout && <Footer />}
        </Box>
    );
};

export default Layout; 