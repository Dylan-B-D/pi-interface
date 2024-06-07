import React, { useEffect, useState } from 'react';
import { TextInput, SegmentedControl, Container, Title, Center } from '@mantine/core';
import { Button, Card, CardBody } from '@nextui-org/react';
import { IoEnter } from "react-icons/io5";

interface User {
    name: string;
    password: string;
}

interface LoginProps {
    users: User[];
    onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
    const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        const user = users.find(user => user.name === selectedUser);
        if (user && user.password === password) {
            onLogin(user);
        } else {
            alert('Invalid credentials');
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    };

    useEffect(() => {
        const user = users.find(user => user.name === selectedUser);
        if (user && user.password === password) {
            onLogin(user);
        }
    }, [password, selectedUser, users, onLogin]);

    return (
        <Container
            fluid
            p="md"
            style={{
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'linear-gradient(45deg, #0F2027, #2C5364)',
            }}
        >
            <Card
                isBlurred
                className="border-none bg-background/60 dark:bg-default-40/50 max-w-[610px]"
                shadow="sm"
                radius="none"
                style={{
                    width: '100%',
                    maxWidth: '400px',
                }}
            >
                <CardBody>
                    <Center>
                        <Title order={2} mb="8px">
                            Please login to continue
                        </Title>
                    </Center>
                    <SegmentedControl
                        color="#64B2BE"
                        fullWidth
                        data={users.map(user => user.name)}
                        value={selectedUser}
                        onChange={setSelectedUser}
                        mb="4px"
                    />
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <TextInput
                            placeholder="Enter your password"
                            type="password"
                            variant="filled"
                            radius={0}
                            size='md'
                            value={password}
                            onChange={(event) => setPassword(event.currentTarget.value)}
                            onKeyDown={handleKeyPress}
                            mb="4px"
                            style={{ flex: 1, marginTop: '4px' }}
                        />
                        <Button radius='none' isIconOnly variant="shadow" color="primary" onClick={handleLogin} style={{ marginLeft: '4px' }}>
                            <IoEnter size="1.5em" />
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </Container>
    );
};

export default Login;
