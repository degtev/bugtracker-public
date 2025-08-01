import React from 'react';
import ReactDOM from 'react-dom/client';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    useSearchParams,
    useLocation,
} from 'react-router-dom';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { shouldShowLayout } from './utils/authPages';

import ExternalRegisterForm from './components/ExternalRegisterForm';
import InternalRegisterForm from './components/InternalRegisterForm';
import AuthLoginForm from './components/LoginForm';
import SendInviteForm from './components/SendInviteForm';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import ProjectsList from './components/ProjectsList';
import ProjectView from './components/ProjectView';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import ResetPasswordForm from './components/ResetPasswordForm';
import DebugPage from './components/DebugPage';
import NotificationSettings from './components/NotificationSettings';

import CreateProjectForm from './components/CreateProject';

function SendInvite() {
    const [searchParams] = useSearchParams();

    return (
        <div style={{ padding: 0 }}>
            <SendInviteForm />
        </div>
    );
}

function ExternalRegister() {
    const [searchParams] = useSearchParams();

    return (
        <div style={{ padding: 0 }}>
            <ExternalRegisterForm />
        </div>
    );
}

function InternalRegister() {
    const [searchParams] = useSearchParams();

    return (
        <div style={{ padding: 0 }}>
            <InternalRegisterForm />
        </div>
    );
}

function LoginForm() {
    const [searchParams] = useSearchParams();

    return (
        <div style={{ padding: 0 }}>
            <AuthLoginForm />
        </div>
    );
}

function ForgotPassword() {
    return (
        <div style={{ padding: 0 }}>
            <ForgotPasswordForm />
        </div>
    );
}

function ResetPassword() {
    return (
        <div style={{ padding: 0 }}>
            <ResetPasswordForm />
        </div>
    );
}

function CreateProject() {
    const [searchParams] = useSearchParams();

    return (
        <div style={{ padding: 0 }}>
            <CreateProjectForm />
        </div>
    );
}

function Home() {
    return (
        <div style={{ padding: 0 }}>
            <HomePage />
        </div>
    );
}

function Profile() {
    return (
        <div style={{ padding: 0 }}>
            <ProfilePage />
        </div>
    );
}

function Projects() {
    return (
        <div style={{ padding: 0 }}>
            <ProjectsList />
        </div>
    );
}

function Project() {
    return (
        <div style={{ padding: 0 }}>
            <ProjectView />
        </div>
    );
}

function Debug() {
    return (
        <div style={{ padding: 0 }}>
            <DebugPage />
        </div>
    );
}

function NotificationSettingsPage() {
    return (
        <div style={{ padding: 0 }}>
            <NotificationSettings />
        </div>
    );
}

function App() {
    const { loading } = useAuth();
    if (loading) return null; 
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/project/:projectId" element={<Project />} />
                    <Route path="/send-invite" element={<SendInvite />} />
                    <Route path="/auth/register/invite" element={<SendInvite />} />
                    <Route path="/auth/register/external" element={<ExternalRegister />} />
                    <Route path="/auth/register/internal" element={<InternalRegister />} />
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    <Route path="/projects/create" element={<CreateProject />} />
                    <Route path="/notification-settings" element={<NotificationSettingsPage />} />
                    <Route path="/debug" element={<Debug />} />
                </Routes>
            </Layout>
        </Router>
    );
}

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AuthProvider>
            <App />
        </AuthProvider>
    </ThemeProvider>
);
