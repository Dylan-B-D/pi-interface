import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from '../components/Login';
import { User } from '../interfaces';

/**
 * Login page component.
 * Handles user login and navigation to the interface page.
 * 
 * @returns {JSX.Element} The rendered LoginPage component.
 */
const LoginPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const navigate = useNavigate();

    // Parse the VITE_USERS environment variable on component mount
    useEffect(() => {
        try {
            const parsedUsers: User[] = JSON.parse(import.meta.env.VITE_USERS);
            setUsers(parsedUsers);
        } catch (error) {
            console.error("Error parsing VITE_USERS:", error);
        }
    }, []);

    /**
     * Handle user login.
     * 
     * @param {User} user - The user object.
     */
    const handleLogin = (user: User) => {
        // Navigate to interface page on successful login
        navigate('/interface', { state: { user } });
    };

    // Render the Login component
    return (
        <Login users={users} onLogin={handleLogin} />
    );
};

export default LoginPage;
