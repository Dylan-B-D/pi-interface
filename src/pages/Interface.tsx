import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Box, Loader, ScrollArea, Table, ActionIcon } from '@mantine/core';
import { invoke } from '@tauri-apps/api/tauri';
import InterfaceHeader from '../components/InterfaceHeader';
import { formatDate, formatFileSize } from '../utils';
import { IoMdCloudDownload } from 'react-icons/io';
import { notifications } from '@mantine/notifications';
import { IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5';

/**
 * User interface.
 */
interface User {
    name: string;
    password: string;
}

/**
 * FileInfo interface.
 */
interface FileInfo {
    name: string;
    file_type: string;
    size: number;
    last_modified: string;
}

/**
 * Interface page componant.
 * Fetches files from the Raspberry Pi and displays them.
 * 
 * @returns {JSX.Element} The rendered Interface component.
 */
const Interface: React.FC = () => {
    const location = useLocation();                             // Get the location object
    const user = location.state?.user as User;                  // Get the user object from the location state
    const [files, setFiles] = useState<FileInfo[]>([]);         // Initialize the files state
    const [loading, setLoading] = useState(true);               // Initialize the loading state
    const [error, setError] = useState<string | null>(null);    // Initialize the error state

    // Fetch the files from the Raspberry Pi
    useEffect(() => {
        if (user) {
            // Call the Tauri command to connect to the Raspberry Pi
            invoke<FileInfo[]>('connect_to_pi', { userName: user.name.toLowerCase() })
                .then((files) => {
                    setFiles(files);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to connect to the Raspberry Pi:', err);
                    setError(err);
                    setLoading(false);
                });
        }
    }, [user]);                                                 // Run the effect when the user object changes  

    // Handle the download of a file
    const handleDownload = (fileName: string) => {
        invoke('download_file', { userName: user.name.toLowerCase(), fileName })
            .then(() => {
                notifications.show({
                    message: 'File downloaded successfully!',
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
            })
            .catch(err => {
                console.error('Failed to download file:', err);
                notifications.show({
                    message: `Failed to download file: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
            });
    };    

    return (
        <Container
            fluid
            p="0"
            style={{
                height: '100vh',
                background: 'linear-gradient(45deg, #0F2027, #2C5364)',
            }}
        >
            <InterfaceHeader user={user} />
            <Container
                fluid
                p="md"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {loading ? (
                    <Loader color="blue" type="dots" size={30} />
                ) : error ? (
                    <Box style={{ color: 'red', textAlign: 'center' }}>
                        <p>Error: {error}</p>
                    </Box>
                ) : (
                    <ScrollArea style={{ height: 'calc(100vh - 48px - 2rem)' }}>
                        <Table.ScrollContainer minWidth={450} type="native">
                            <Table highlightOnHover withTableBorder withColumnBorders withRowBorders={false}>
                                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                    <Table.Tr>
                                        <Table.Th style={{ color: 'white' }}>File Name</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>File Type</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>File Size</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>Last Modified</Table.Th>
                                        <Table.Th></Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {files.map(file => {

                                        // Remove the extension from the file name
                                        const [name] = file.name.split('.');
                                        const displayName = file.file_type !== 'Directory' ? name : file.name;

                                        return (
                                            <Table.Tr key={file.name}>
                                                <Table.Td style={{ color: 'white' }}>{displayName}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{file.file_type}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{formatFileSize(file.size)}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{formatDate(Number(file.last_modified))}</Table.Td>
                                                <Table.Td style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <ActionIcon variant="subtle" color="#64F2BE" size="xs" onClick={() => handleDownload(file.name)}>
                                                        <IoMdCloudDownload size={24} />
                                                    </ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </ScrollArea>
                )}
            </Container>
        </Container>
    );
};

export default Interface;