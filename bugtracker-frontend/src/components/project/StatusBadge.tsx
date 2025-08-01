import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
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

interface StatusBadgeProps {
    type: 'status' | 'priority';
    value: string;
    size?: 'small' | 'medium' | 'large';
    variant?: 'chip' | 'badge' | 'pill';
    showIcon?: boolean;
    showText?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
    type,
    value,
    size = 'medium',
    variant = 'chip',
    showIcon = true,
    showText = true
}) => {
    const getColor = type === 'status' ? getStatusColor : getPriorityColor;
    const getText = type === 'status' ? getStatusText : getPriorityText;
    const getIcon = type === 'status' ? getStatusIcon : getPriorityIcon;
    const getBgColor = type === 'status' ? getStatusBgColor : getPriorityBgColor;
    const getBorderColor = type === 'status' ? getStatusBorderColor : getPriorityBorderColor;

    const color = getColor(value);
    const text = getText(value);
    const icon = getIcon(value);
    const bgColor = getBgColor(value);
    const borderColor = getBorderColor(value);

    const sizeStyles = {
        small: {
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: '4px',
            iconSize: 10
        },
        medium: {
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: '6px',
            iconSize: 12
        },
        large: {
            fontSize: 14,
            padding: '6px 12px',
            borderRadius: '8px',
            iconSize: 14
        }
    };

    const currentSize = sizeStyles[size];

    if (variant === 'chip') {
        return (
            <Chip
                label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {showIcon && (
                            <span style={{ fontSize: currentSize.iconSize }}>{icon}</span>
                        )}
                        {showText && <span>{text}</span>}
                    </Box>
                }
                size={size === 'small' ? 'small' : 'medium'}
                sx={{
                    bgcolor: bgColor,
                    color: color,
                    border: `1px solid ${borderColor}`,
                    fontWeight: 'bold',
                    fontSize: currentSize.fontSize,
                    borderRadius: currentSize.borderRadius,
                    '& .MuiChip-label': {
                        px: 1
                    },
                    '&:hover': {
                        bgcolor: bgColor.replace('0.15', '0.25'),
                        borderColor: borderColor.replace('0.6', '0.8')
                    }
                }}
            />
        );
    }

    if (variant === 'badge') {
        return (
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: bgColor,
                    color: color,
                    border: `1px solid ${borderColor}`,
                    borderRadius: currentSize.borderRadius,
                    padding: currentSize.padding,
                    fontSize: currentSize.fontSize,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: bgColor.replace('0.15', '0.25'),
                        borderColor: borderColor.replace('0.6', '0.8')
                    }
                }}
            >
                {showIcon && (
                    <span style={{ fontSize: currentSize.iconSize }}>{icon}</span>
                )}
                {showText && <span>{text}</span>}
            </Box>
        );
    }

    if (variant === 'pill') {
        return (
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: bgColor,
                    color: color,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '20px',
                    padding: currentSize.padding,
                    fontSize: currentSize.fontSize,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: bgColor.replace('0.15', '0.25'),
                        borderColor: borderColor.replace('0.6', '0.8')
                    }
                }}
            >
                {showIcon && (
                    <span style={{ fontSize: currentSize.iconSize }}>{icon}</span>
                )}
                {showText && <span>{text}</span>}
            </Box>
        );
    }

    return null;
};

export default StatusBadge; 