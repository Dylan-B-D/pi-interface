import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Box, Loader, ScrollArea, Table, Group, Modal, TextInput, Textarea, Space } from '@mantine/core';
import { invoke } from '@tauri-apps/api/tauri';
import { fetchFiles, formatDate, formatFileSize, getIconByFileExtension } from '../utils';
import { IoMdCloudDownload, IoMdCloudUpload, IoMdRefresh } from 'react-icons/io';
import { notifications } from '@mantine/notifications';
import { IoAdd, IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5';
import { BreadcrumbItem, Breadcrumbs, Button } from '@nextui-org/react';
import { FileInfo, User } from '../interfaces';
import DownloadProgress from '../components/DownloadProgress';
import { open } from '@tauri-apps/api/dialog';
import { MdDeleteForever, MdEdit } from "react-icons/md";
import FileExplorerHeader from '../components/FileExplorerHeader';

/**
 * FileExplorer page component.
 * Fetches and displays files from the Raspberry Pi.
 * Lets the user navigate through folders, upload/download files, create folders, rename files, and delete files.
 * 
 * @returns {JSX.Element} The rendered FileExplorer component.
 */
const FileExplorer: React.FC = (): JSX.Element => {
    const location = useLocation();                             // Get the location object
    const user = location.state?.user as User;                  // Get the user object from the location state
    const [files, setFiles] = useState<FileInfo[]>([]);         // Initialize the files state
    const [currentPath, setCurrentPath] = useState<string[]>([]); // Initialize the current path state
    const [loading, setLoading] = useState(true);               // Initialize the loading state
    const [isUploading, setIsUploading] = useState(false);      // Initialize the isUploading state
    const [error, setError] = useState<string | null>(null);    // Initialize the error state
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set()); // Initialize the selected files state
    const [isDownloading, setIsDownloading] = useState(false);  // Initialize the isDownloading state
    const [isAddFolderOpen, setIsAddFolderOpen] = useState(false); // State for handling the add folder modal
    const [newFolderName, setNewFolderName] = useState('');     // State for the new folder name
    const [isRenameOpen, setIsRenameOpen] = useState(false);    // State for handling the rename modal
    const [newFileName, setNewFileName] = useState('');         // State for the new file name
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);    // State for handling the delete confirmation modal
    const [isFileOpen, setIsFileOpen] = useState(false);        // State for handling the file open modal
    const [fileContent, setFileContent] = useState('');         // State for storing the file content
    const [currentFile, setCurrentFile] = useState('');         // State for storing the current file name
    const [storageUsed, setStorageUsed] = useState<number | null>(null); // State for storing the storage used

    // Fetch the files from the Raspberry Pi
    const fetchFilesCallback = useCallback((path: string[]) => {
        fetchFiles(user, path, setFiles, setLoading, setError);
    }, [user]);

    const updateStorageUsed = useCallback(() => {
        if (user) {
            invoke('get_storage_used', { userName: user.name.toLowerCase() })
                .then((size: unknown) => {
                    setStorageUsed(size as number);
                    console.log('Storage used:', size);
                })
                .catch(err => {
                    console.error('Failed to get storage used:', err);
                });
        }
    }, [user]);
    
    useEffect(() => {
        updateStorageUsed();
    }, [updateStorageUsed]);
    
    useEffect(() => {
        fetchFilesCallback(currentPath);  // Initial fetch
    }, [user, currentPath, fetchFilesCallback]);

    // Handle the download of selected files
    const handleDownload = () => {
        setIsDownloading(true);
        const fileNames = Array.from(selectedFiles);
        invoke('download_files', { userName: user.name.toLowerCase(), currentPath, fileNames })
          .then(() => {
            notifications.show({
              message: `Files downloaded successfully!`,
              icon: <IoCheckmarkCircle />,
              autoClose: 5000,
              color: 'green'
            });
            setIsDownloading(false);
          })
          .catch(err => {
            console.error('Failed to download files:', err);
            notifications.show({
              message: `Failed to download files: ${err}`,
              icon: <IoAlertCircle />,
              autoClose: 5000,
              color: 'red'
            });
            setIsDownloading(false);
          });
      };
      
      // Handle the upload of files
      const handleUpload = async () => {
        updateStorageUsed();
        const selectedFiles = await open({
            multiple: true,
            directory: false,
        }) as string[]; // Allow multiple file selection
    
        if (selectedFiles && selectedFiles.length > 0) {
            console.log('Selected files:', selectedFiles);
    
            // Get the total size of the selected files from the backend
            let totalFileSize = 0;
            try {
                const fileSizes = await invoke('get_file_sizes', { filePaths: selectedFiles }) as number[];
                totalFileSize = fileSizes.reduce((total, size) => total + size, 0);
            } catch (err) {
                console.error('Failed to get file sizes:', err);
                notifications.show({
                    message: `Failed to get file sizes: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
                return;
            }
    
            // Convert storage limit to bytes if it's not already
            const storageLimitInBytes = user.storage_limit * 1000 * 1000 * 1000;

            if (storageUsed !== null && storageLimitInBytes && (storageUsed + totalFileSize > storageLimitInBytes)) {
                console.log('Upload failed: Exceeds storage limit.');
                return;
            }
    
            setIsUploading(true);
            invoke('upload_files', { userName: user.name.toLowerCase(), currentPath, localFilePaths: selectedFiles })
                .then(() => {
                    notifications.show({
                        message: `Files uploaded successfully!`,
                        icon: <IoCheckmarkCircle />,
                        autoClose: 5000,
                        color: 'green'
                    });
                    setIsUploading(false);
                    fetchFilesCallback(currentPath);
                    updateStorageUsed();
                })
                .catch(err => {
                    console.error('Failed to upload files:', err);
                    notifications.show({
                        message: `Failed to upload files: ${err}`,
                        icon: <IoAlertCircle />,
                        autoClose: 5000,
                        color: 'red'
                    });
                    setIsUploading(false);
                });
        }
    }
    

    // Handle adding a new folder
    const handleAddFolder = () => {
        setIsAddFolderOpen(true);
    };

    // Handle creating a new folder
    const handleCreateFolder = () => {
        if (newFolderName.trim() === '') {
            notifications.show({
                message: `Folder name cannot be empty`,
                icon: <IoAlertCircle />,
                autoClose: 5000,
                color: 'red'
            });
            return;
        }

        invoke('create_folder', { userName: user.name.toLowerCase(), currentPath, folderName: newFolderName })
            .then(() => {
                notifications.show({
                    message: `Folder created successfully!`,
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
                setIsAddFolderOpen(false);
                setNewFolderName('');
                fetchFilesCallback(currentPath);
            })
            .catch(err => {
                console.error('Failed to create folder:', err);
                notifications.show({
                    message: `Failed to create folder: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
            });
    };

    // Handle renaming a file
    const handleRename = () => {
        const selectedFile = Array.from(selectedFiles)[0];
        setNewFileName(selectedFile);
        setIsRenameOpen(true);
    };

    const handleRenameFile = () => {
        if (newFileName.trim() === '') {
            notifications.show({
                message: `File name cannot be empty`,
                icon: <IoAlertCircle />,
                autoClose: 5000,
                color: 'red'
            });
            return;
        }

        const selectedFile = Array.from(selectedFiles)[0];

        invoke('rename_file', { userName: user.name.toLowerCase(), currentPath, oldName: selectedFile, newName: newFileName })
            .then(() => {
                notifications.show({
                    message: `File renamed successfully!`,
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
                setIsRenameOpen(false);
                setNewFileName('');
                fetchFilesCallback(currentPath);
                setSelectedFiles(new Set());
            })
            .catch(err => {
                console.error('Failed to rename file:', err);
                notifications.show({
                    message: `Failed to rename file: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
            });
    };

    // Handle delete
    const handleDelete = () => {
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = () => {
        const fileNames = Array.from(selectedFiles);

        invoke('delete_files', { userName: user.name.toLowerCase(), currentPath, fileNames })
            .then(() => {
                notifications.show({
                    message: `Files deleted successfully!`,
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
                setIsDeleteOpen(false);
                setSelectedFiles(new Set());
                fetchFilesCallback(currentPath);
                updateStorageUsed();
            })
            .catch(err => {
                console.error('Failed to delete files:', err);
                notifications.show({
                    message: `Failed to delete files: ${err}`,
                    icon: <IoAlertCircle />,
                    autoClose: 5000,
                    color: 'red'
                });
            });
    };

    // Handle opening a file or folder
    const handleOpen = () => {
        const selectedFile = Array.from(selectedFiles)[0];
        const file = files.find(f => f.name === selectedFile);

        if (file) {
            if (file.file_type === 'Folder') {
                // Navigate into the folder
                setCurrentPath([...currentPath, file.name]);
                setSelectedFiles(new Set()); // Clear the selected files
            } else {
                // Read the file content
                setCurrentFile(file.name);
                invoke('read_file', { userName: user.name.toLowerCase(), currentPath, fileName: file.name })
                    .then((content: unknown) => {
                        setFileContent(content as string);
                        setIsFileOpen(true);
                    })
                    .catch(err => {
                        console.error('Failed to read file:', err);
                        notifications.show({
                            message: `Failed to read file: ${err}`,
                            icon: <IoAlertCircle />,
                            autoClose: 5000,
                            color: 'red'
                        });
                    });
            }
        }
    };

    const handleSaveFile = () => {
        invoke('save_file', { userName: user.name.toLowerCase(), currentPath, fileName: currentFile, fileContent })
            .then(() => {
                notifications.show({
                    message: `File saved successfully!`,
                    icon: <IoCheckmarkCircle />,
                    autoClose: 5000,
                    color: 'green'
                });
                setIsFileOpen(false);
                setCurrentFile('');
                setFileContent('');
                updateStorageUsed();
            })
            .catch(err => {
                console.error('Failed to save file:', err);
                notifications.show({
                    message: `Failed to save file: ${err}`,
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
        if (file && file.file_type === 'Folder') {
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
        // Background container
        <Container
            fluid
            p="0"
            style={{
                height: '100vh',
                background: 'linear-gradient(45deg, #0F2027, #2C5364)',
                overflow: 'auto',
            }}
        >
            {/* Header */}
            <FileExplorerHeader user={user} storageUsed={storageUsed} />

            {/* Main content */}
            <Container
                fluid
                p="md"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* File Action Buttons */}
                <Group mb="4px" gap={4}>
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
                            color="primary"
                            variant='flat'
                            radius='none'
                            isDisabled={selectedFiles.size !== 1}
                            onClick={handleOpen}
                        >
                            Open
                        </Button>
                        <Button
                            size='sm'
                            color="primary"
                            variant='flat'
                            radius='none'
                            onClick={handleAddFolder}
                        >
                            Add Folder
                            <IoAdd size={22} style={{ marginLeft: '4px' }} />
                        </Button>
                        <Button
                            size='sm'
                            color="primary"
                            variant='flat'
                            radius='none'
                            isDisabled={selectedFiles.size !== 1}
                            onClick={handleRename}
                        >
                            Rename
                            <MdEdit size={22} style={{ marginLeft: '4px' }} />
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
                        <Button
                            size='sm'
                            color="primary"
                            variant='flat'
                            radius='none'
                            onClick={handleUpload}
                        >
                            Upload Files
                            <IoMdCloudUpload size={22} style={{ marginLeft: '4px' }} />
                        </Button>
                        <Button
                            size='sm'
                            color="danger"
                            variant='ghost'
                            radius='none'
                            onClick={handleDelete}
                        >
                            Delete
                            <MdDeleteForever size={22} style={{ marginLeft: '4px' }} />
                        </Button>
                </Group>

                {/* Progress and Breadcrumbs */}
                <Group mb="xs" gap={4}>   
                    {isUploading && <><Loader color="blue" type="dots" size={30} /></>}
                    <DownloadProgress show={isDownloading} />
                </Group>
                <Breadcrumbs color="primary" style={{ marginBottom: '12px' }}>
                    <BreadcrumbItem onClick={() => handleBreadcrumbClick(-1)}>Home</BreadcrumbItem>
                    {currentPath.map((folder, index) => (
                        <BreadcrumbItem key={index} onClick={() => handleBreadcrumbClick(index)}>
                            {folder}
                        </BreadcrumbItem>
                    ))}
                </Breadcrumbs>

                {/* File Explorer */}
                {loading ? (
                    <Loader color="blue" type="dots" size={30} />
                ) : error ? (

                    // Error message
                    <Box style={{ color: 'red', textAlign: 'center' }}>
                        <p>Error: {error}</p>
                    </Box>
                ) : (
                    // File table
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
                                    {files.sort((a, b) => {
                                        if (a.file_type === 'Folder' && b.file_type !== 'Folder') {
                                            return -1;
                                        }
                                        if (b.file_type === 'Folder' && a.file_type !== 'Folder') {
                                            return 1;
                                        }
                                        return a.name.localeCompare(b.name);
                                    }).map(file => {
                                        // Remove the extension from the file name
                                        const [name, extension] = file.name.split('.');
                                        const icon = file.file_type !== 'Folder' ? getIconByFileExtension(extension) : '📁';
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
                                                <Table.Td style={{ color: 'white' }}>
                                                {file.file_type !== 'Folder' ? formatFileSize(file.size) : ''}
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

            {/* --------- Modals --------- */}

            {/* Add Folder Modal */}
            <Modal
                opened={isAddFolderOpen}
                onClose={() => setIsAddFolderOpen(false)}
                title="Create New Folder"
                centered
                radius={0}
            >
                <Space h='md'/>
                <TextInput
                    placeholder="Enter folder name"
                    value={newFolderName}
                    radius={0}
                    onChange={(event) => setNewFolderName(event.currentTarget.value)}
                />
                <Group mt="md">
                <Button
                    size='sm'
                    color="success"
                    variant='flat'
                    radius='none'
                    onClick={handleCreateFolder}
                    >
                    Create
                </Button>
                </Group>
            </Modal>

            {/* Rename File Modal */}
            <Modal
                opened={isRenameOpen}
                onClose={() => setIsRenameOpen(false)}
                title="Rename File or Folder"
                centered
                radius={0}
            >
                <Space h='md'/>
                <TextInput
                    placeholder="Enter new name"
                    value={newFileName}
                    radius={0}
                    onChange={(event) => setNewFileName(event.currentTarget.value)}
                />
                <Group mt="md">
                    <Button
                        size='sm'
                        color="success"
                        variant='flat'
                        radius='none'
                        onClick={handleRenameFile}
                    >
                        Rename
                    </Button>
                </Group>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                opened={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                title="Confirm Delete"
                centered
                radius={0}
            >
                <Box>
                    Are you sure you want to delete the selected files/folders? This action is irreversible.
                </Box>
                <Group mt="md">
                    <Button
                        size='sm'
                        color="danger"
                        variant='flat'
                        radius='none'
                        onClick={handleConfirmDelete}
                    >
                        Delete
                    </Button>
                    <Button
                        size='sm'
                        color="primary"
                        variant='flat'
                        radius='none'
                        onClick={() => setIsDeleteOpen(false)}
                    >
                        Cancel
                    </Button>
                </Group>
            </Modal>

            {/* Edit File Modal */}
            <Modal
                opened={isFileOpen}
                onClose={() => setIsFileOpen(false)}
                title="Edit File"
                centered
                size="100%"
                radius={0}
            >
                <Space h='md'/>
                <Textarea
                    placeholder="Edit file content"
                    value={fileContent}
                    radius={0}
                    onChange={(event) => setFileContent(event.currentTarget.value)}
                    minRows={10}
                    autosize
                />
                <Group mt="md">
                    <Button
                        size='sm'
                        color="success"
                        variant='flat'
                        radius='none'
                        onClick={handleSaveFile}
                    >
                        Save
                    </Button>
                </Group>
            </Modal>
        </Container>
    );
};

export default FileExplorer;
