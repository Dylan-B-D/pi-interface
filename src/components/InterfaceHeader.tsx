import { Box, Title } from "@mantine/core";
import { Button, Progress } from "@nextui-org/react";
import { IoExit } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { InterfaceHeaderProps } from "../interfaces";
import { formatFileSize } from "../utils";

/**
 * Header component for the interface.
 * 
 * @param {InterfaceHeaderProps} props - Props incluidng the user object.
 * @returns {JSX.Element} The rendered InterfaceHeader component.
 */
const InterfaceHeader: React.FC<InterfaceHeaderProps> = ({ user, storageUsed }: InterfaceHeaderProps): JSX.Element => {
    const navigate = useNavigate();

    return (
        <Box
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                background: '#112229',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                gap: '1rem',
            }}
        >
            <Title order={4} style={{ color: 'white' }}>{user ? user.name : 'No user logged in'}</Title>
            <>
            {storageUsed !== null && user !== null && (
                            <Progress
                                aria-label={"Storage"}
                                size="sm"
                                classNames={{
                                    base: "max-w-md",
                                    track: "drop-shadow-md border border-default",
                                    indicator: "#59c59f",
                                    label: "text-foreground/50",
                                    value: "tracking-wider text-foreground/50",
                                }}
                                label={`${formatFileSize(storageUsed)} / ${formatFileSize(user.storage_limit * 1000 * 1000 * 1000)}`}
                                value={(storageUsed / (user.storage_limit * 1000 * 1000 * 1000)) * 100}
                                color="primary"
                                showValueLabel={true}
                            />
                        )}
                        </>
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