import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Box, Loader, ScrollArea, Table, Group, Breadcrumbs, Anchor } from '@mantine/core';
import { invoke } from '@tauri-apps/api/tauri';
import InterfaceHeader from '../components/InterfaceHeader';
import { fetchFiles, formatDate, formatFileSize, getIconByFileExtension } from '../utils';
import { IoMdCloudDownload, IoMdRefresh } from 'react-icons/io';
import { notifications } from '@mantine/notifications';
import { IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5';
import { Button } from '@nextui-org/react';
import { FileInfo, User } from '../interfaces';

/**
 * Interface page component.
 * Fetches files from the Raspberry Pi and displays them.
 * 
 * @returns {JSX.Element} The rendered Interface component.
 */
const Interface: React.FC = () => {
    const location = useLocation();                             // Get the location object
    const user = location.state?.user as User;                  // Get the user object from the location state
    const [files, setFiles] = useState<FileInfo[]>([]);         // Initialize the files state
    const [currentPath, setCurrentPath] = useState<string[]>([]); // Initialize the current path state
    const [loading, setLoading] = useState(true);               // Initialize the loading state
    const [error, setError] = useState<string | null>(null);    // Initialize the error state
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set()); // Initialize the selected files state

    // Fetch the files from the Raspberry Pi
    const fetchFilesCallback = useCallback((path: string[]) => {
        fetchFiles(user, path, setFiles, setLoading, setError);
    }, [user]);

    
    useEffect(() => {
        fetchFilesCallback(currentPath);  // Initial fetch
    }, [user, currentPath, fetchFilesCallback]);

    // Handle the download of selected files
    const handleDownload = () => {
        const fileNames = Array.from(selectedFiles);
        invoke('download_files', { userName: user.name.toLowerCase(), fileNames })
            .then(() => {
                notifications.show({
                    message: `Files downloaded successfully!`,
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
            })
            .catch(err => {
                console.error('Failed to download files:', err);
                notifications.show({
                    message: `Failed to download files: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
            });
    };

    // Handle row click to select/deselect
    const handleRowClick = (fileName: string) => {
        setSelectedFiles(prevSelectedFiles => {
            const newSelectedFiles = new Set(prevSelectedFiles);
            if (newSelectedFiles.has(fileName)) {
                newSelectedFiles.delete(fileName);
            } else {
                newSelectedFiles.add(fileName);
            }
            return newSelectedFiles;
        });
    };

    // Handle double click to navigate into folder
    const handleDoubleClick = (fileName: string) => {
        const file = files.find(f => f.name === fileName);
        if (file && file.file_type === 'Directory') {
            setCurrentPath([...currentPath, fileName]);
            setSelectedFiles(new Set()); // Clear the selected files
        }
    };

    // Handle breadcrumb click to navigate to a specific path
    const handleBreadcrumbClick = (index: number) => {
        setCurrentPath(currentPath.slice(0, index + 1));
        setSelectedFiles(new Set()); // Clear the selected files
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
                <Group mb="md" gap={4}>
                    <Button
                        size='sm'
                        color="primary"
                        variant='flat'
                        radius='none'
                        isIconOnly
                        onClick={() => fetchFilesCallback(currentPath)}
                    >
                        <IoMdRefresh size={22} />
                    </Button>
                    <Button
                        size='sm'
                        isDisabled={selectedFiles.size == 0}
                        color="primary"
                        variant='flat'
                        radius='none'
                        onClick={handleDownload}
                        disabled={selectedFiles.size === 0}
                    >
                        Download Selected
                        <IoMdCloudDownload size={22} style={{ marginLeft: '4px' }} />
                    </Button>
                </Group>
                <Breadcrumbs style={{marginBottom: '4px'}}>
                    <Anchor onClick={() => handleBreadcrumbClick(-1)}>{user.name}</Anchor>
                    {currentPath.map((folder, index) => (
                        <Anchor key={index} onClick={() => handleBreadcrumbClick(index)}>
                            {folder}
                        </Anchor>
                    ))}
                </Breadcrumbs>
                {loading ? (
                    <Loader color="blue" type="dots" size={30} />
                ) : error ? (
                    <Box style={{ color: 'red', textAlign: 'center' }}>
                        <p>Error: {error}</p>
                    </Box>
                ) : (
                    <ScrollArea>
                        <Table.ScrollContainer minWidth={450} type="native">
                            <Table highlightOnHover withColumnBorders withRowBorders={false}>
                                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}>
                                    <Table.Tr>
                                        <Table.Th style={{ color: 'white' }}>Name</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>Date Modified</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>Type</Table.Th>
                                        <Table.Th style={{ color: 'white' }}>Size</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}>
                                    {files.map(file => {

                                        // Remove the extension from the file name
                                        const [name, extension] = file.name.split('.');
                                        const icon = file.file_type !== 'Directory' ? getIconByFileExtension(extension) : '📁';
                                        const displayName = `${icon} ${name}`;

                                        return (
                                            <Table.Tr
                                                className={`table-row ${selectedFiles.has(file.name) ? 'selected' : ''}`}
                                                key={file.name}
                                                onClick={() => handleRowClick(file.name)}
                                                onDoubleClick={() => handleDoubleClick(file.name)}
                                                style={{
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Table.Td style={{ color: 'white' }}>{displayName}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{formatDate(Number(file.last_modified))}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{file.file_type}</Table.Td>
                                                <Table.Td style={{ color: 'white' }}>{formatFileSize(file.size)}</Table.Td>
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
