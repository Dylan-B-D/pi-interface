import { Box, Title } from "@mantine/core";
import { Button } from "@nextui-org/react";
import { IoExit } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { InterfaceHeaderProps } from "../interfaces";

/**
 * Header component for the interface.
 * 
 * @param {InterfaceHeaderProps} props - Props incluidng the user object.
 * @returns {JSX.Element} The rendered InterfaceHeader component.
 */
const InterfaceHeader: React.FC<InterfaceHeaderProps> = ({ user }: InterfaceHeaderProps): JSX.Element => {
    const navigate = useNavigate();

    return (
        <Box
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                background: 'rgba(0, 0, 0, 0.5)',
                position: 'sticky',
                top: 0,
            }}
        >
            <Title order={4} style={{ color: 'white' }}>{user ? user.name : 'No user logged in'}</Title>
            <Button
                size="sm"
                radius="none"
                variant="shadow"
                color="primary"
                onClick={() => navigate('/')}                           // Navigate to the login page
                style={{ display: 'flex', alignItems: 'center' }}
            >
                Logout <IoExit size="1.5em" style={{ marginLeft: '0.5rem' }} />
            </Button>
        </Box>
    );
};

export default InterfaceHeader;