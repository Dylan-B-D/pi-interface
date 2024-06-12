use std::{env, fs::{self, File}, io::{Read, Write}, net::TcpStream, path::{Path, PathBuf}};

use serde::Serialize;
use ssh2::Session;
use tauri::{api::path::download_dir, command, AppHandle, Manager};
use zip::{write::FileOptions, ZipWriter};
use chrono::Utc;

/// Struct to represent a file on the Raspberry Pi.
#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub file_type: String,
    pub size: u64,
    pub last_modified: String,
}

const CHUNK_SIZE: usize = 1 * 1024 * 1024; // 1MB

//================================================================================================
//                              Commands for SSH connection
//================================================================================================

/// Uses a .env file to load the IP address, username, and password of the Raspberry Pi.
/// 
/// * `Input`: User's name and optional path
/// * `Output`: List of files in the specified directory on the Raspberry Pi
#[command]
pub async fn connect_to_pi(user_name: String, path: Option<String>) -> Result<Vec<FileInfo>, String> {
    dotenv::dotenv().ok();

    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;
    
    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let base_dir = verify_base_directory(&mut session, &home_dir)?;
    let remote_dir = create_user_directory(&mut session, &base_dir, &user_name)?;

    let target_dir = if let Some(path) = path {
        format!("{}/{}", remote_dir, path)
    } else {
        remote_dir
    };

    let files = list_files_in_directory(&mut session, &target_dir)?;

    Ok(files)
}



/// Command called by the frontend to download files from the Raspberry Pi.
/// Uses a .env file to load the IP address, username, and password of the Raspberry Pi.
/// Downloads the file to the user's Downloads directory in chunks to prevent memory issues.
/// 
/// * `Input`: User's name, current path, file names, and app handle for emitting events
/// * `Output`: None
#[command]
pub async fn download_files(user_name: String, current_path: Vec<String>, file_names: Vec<String>, app_handle: AppHandle) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;

    if file_names.len() == 1 {
        let file_name = &file_names[0];
        let remote_file_path = format!("{}/{}", current_remote_dir, file_name);
        let file_stat = sftp.stat(Path::new(&remote_file_path))
            .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_file_path, e))?;

        if file_stat.is_file() {
            // Download single file directly
            let local_file_path = download_single_file(&mut session, &remote_file_path, &app_handle)?;
            println!("File downloaded to: {}", local_file_path.display());
        } else if file_stat.is_dir() {
            // Download single directory as zip
            download_files_as_zip(&mut session, &current_remote_dir, vec![file_name.clone()], &app_handle)?;
        }
    } else {
        // Download multiple files as zip
        download_files_as_zip(&mut session, &current_remote_dir, file_names, &app_handle)?;
    }

    Ok(())
}

/// Command called by the frontend to upload files to the Raspberry Pi.
/// * `Input`: User's name, current path, local file paths, and app handle for emitting events
/// * `Output`: None
#[command]
pub async fn upload_files(user_name: String, current_path: Vec<String>, local_file_paths: Vec<String>, app_handle: AppHandle) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    for local_file_path in local_file_paths {
        let file_name = Path::new(&local_file_path).file_name().unwrap().to_str().unwrap();
        let remote_file_path = format!("{}/{}", current_remote_dir, file_name);
        upload_file_in_chunks(&mut session, &remote_file_path, Path::new(&local_file_path), &app_handle)?;
    }

    Ok(())
}

/// Command to create a new folder in the current directory.
/// * `Input`: User's name, current path, folder name
/// * `Output`: None
#[command]
pub async fn create_folder(user_name: String, current_path: Vec<String>, folder_name: String) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let remote_folder_path = format!("{}/{}", current_remote_dir, folder_name);

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    sftp.mkdir(Path::new(&remote_folder_path), 0o755).map_err(|e| format!("Failed to create folder '{}': {}", remote_folder_path, e))?;

    Ok(())
}

/// Command to rename a file or folder in the current directory.
/// * `Input`: User's name, current path, old name, new name
/// * `Output`: None
#[command]
pub async fn rename_file(user_name: String, current_path: Vec<String>, old_name: String, new_name: String) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let old_file_path = format!("{}/{}", current_remote_dir, old_name);
    let new_file_path = format!("{}/{}", current_remote_dir, new_name);

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    sftp.rename(Path::new(&old_file_path), Path::new(&new_file_path), None)
        .map_err(|e| format!("Failed to rename '{}': {}", old_file_path, e))?;

    Ok(())
}

/// Command to delete files or folders in the current directory.
/// * `Input`: User's name, current path, file names
/// * `Output`: None
#[command]
pub async fn delete_files(user_name: String, current_path: Vec<String>, file_names: Vec<String>) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;

    for file_name in file_names {
        let remote_file_path = format!("{}/{}", current_remote_dir, file_name);
        let path = Path::new(&remote_file_path);
        if sftp.stat(path).map_err(|e| format!("Failed to stat '{}': {}", remote_file_path, e))?.is_dir() {
            recursive_delete(&sftp, path)?;
        } else {
            sftp.unlink(path).map_err(|e| format!("Failed to delete file '{}': {}", remote_file_path, e))?;
        }
    }

    Ok(())
}

/// Command to read the content of a file.
/// * `Input`: User's name, current path, file name
/// * `Output`: File content as a string
#[command]
pub async fn read_file(user_name: String, current_path: Vec<String>, file_name: String) -> Result<String, String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let remote_file_path = format!("{}/{}", current_remote_dir, file_name);
    let path = Path::new(&remote_file_path);

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let mut remote_file = sftp.open(path).map_err(|e| format!("Failed to open file '{}': {}", remote_file_path, e))?;

    let mut contents = String::new();
    remote_file.read_to_string(&mut contents).map_err(|e| format!("Failed to read file '{}': {}", remote_file_path, e))?;

    Ok(contents)
}

/// Command to save the content to a file.
/// * `Input`: User's name, current path, file name, file content
/// * `Output`: None
#[command]
pub async fn save_file(user_name: String, current_path: Vec<String>, file_name: String, file_content: String) -> Result<(), String> {
    dotenv::dotenv().ok();

    // Load environment variables
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let current_remote_dir = if current_path.is_empty() {
        remote_dir.clone()
    } else {
        format!("{}/{}", remote_dir, current_path.join("/"))
    };

    let remote_file_path = format!("{}/{}", current_remote_dir, file_name);
    let path = Path::new(&remote_file_path);

    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let mut remote_file = sftp.create(path).map_err(|e| format!("Failed to create file '{}': {}", remote_file_path, e))?;

    remote_file.write_all(file_content.as_bytes()).map_err(|e| format!("Failed to write to file '{}': {}", remote_file_path, e))?;

    Ok(())
}

//================================================================================================
//                              Helper functions for SSH connection
//================================================================================================


/// Establishes an SSH session with the Raspberry Pi.
/// 
/// * `Input`: IP address, username, and password of the Raspberry Pi
/// * `Output`: SSH session
fn establish_ssh_session(pi_ip: String, pi_username: String, pi_password: String) -> Result<Session, String> {
    let tcp = TcpStream::connect(format!("{}:22", pi_ip)).map_err(|e| format!("Failed to connect to {}:22: {}", pi_ip, e))?;
    let mut session = Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| format!("SSH handshake failed: {}", e))?;
    session.userauth_password(&pi_username, &pi_password).map_err(|e| format!("SSH authentication failed: {}", e))?;

    if !session.authenticated() {
        return Err("Authentication failed".into());
    }

    Ok(session)
}

/// Gets the home directory of the Raspberry Pi.
/// 
/// * `Input`: SSH session
/// * `Output`: Home directory
fn get_home_directory(session: &mut Session) -> Result<String, String> {
    let mut channel = session.channel_session().map_err(|e| format!("Failed to create channel session: {}", e))?;
    channel.exec("echo $HOME").map_err(|e| format!("Failed to execute command to get home directory: {}", e))?;
    let mut home_dir = String::new();
    channel.read_to_string(&mut home_dir).map_err(|e| format!("Failed to read home directory: {}", e))?;
    channel.wait_close().map_err(|e| format!("Failed to close channel: {}", e))?;
    let exit_status = channel.exit_status().map_err(|e| format!("Failed to get exit status: {}", e))?;
    if exit_status != 0 {
        return Err(format!("Command to get home directory failed with exit status: {}", exit_status));
    }
    Ok(home_dir.trim().to_string()) // Remove any trailing newline or whitespace
}


/// Verifies the existence of the base directory on the Raspberry Pi.
/// If the base directory does not exist, it is created.
/// 
/// * `Input`: SSH session and home directory
/// * `Output`: Base directory
fn verify_base_directory(session: &mut Session, home_dir: &str) -> Result<String, String> {
    let base_dir = format!("{}/pi-interface", home_dir);
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    if sftp.stat(Path::new(&base_dir)).is_err() {
        sftp.mkdir(Path::new(&base_dir), 0o755).map_err(|e| format!("Failed to create base directory {}: {}", base_dir, e))?;
    }
    Ok(base_dir)
}

/// Creates a directory for the user on the Raspberry Pi.
/// 
/// * `Input`: SSH session, base directory, and user's name
/// * `Output`: User's directory
fn create_user_directory(session: &mut Session, base_dir: &str, user_name: &str) -> Result<String, String> {
    let remote_dir = format!("{}/{}", base_dir, user_name);
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    if sftp.stat(Path::new(&remote_dir)).is_err() {
        sftp.mkdir(Path::new(&remote_dir), 0o755).map_err(|e| format!("Failed to create user directory {}: {}", remote_dir, e))?;
    }
    Ok(remote_dir)
}

/// Lists the files in a directory on the Raspberry Pi.
/// 
/// * `Input`: SSH session and directory
/// * `Output`: List of files in the directory
fn list_files_in_directory(session: &mut Session, remote_dir: &str) -> Result<Vec<FileInfo>, String> {
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let mut files = vec![];
    let entries = sftp.readdir(Path::new(remote_dir)).map_err(|e| format!("Failed to read directory {}: {}", remote_dir, e))?;
    for (path, stat) in entries {
        if let Some(file_name) = path.file_name() {
            let file_type = if stat.is_file() {
                path.extension()
                    .map_or_else(|| "Unknown".to_string(), |ext| ext.to_string_lossy().into_owned())
            } else {
                "Folder".to_string()
            };
            files.push(FileInfo {
                name: file_name.to_string_lossy().to_string(),
                file_type,
                size: stat.size.unwrap_or(0),
                last_modified: stat.mtime.unwrap_or(0).to_string(),
            });
        }
    }
    Ok(files)
}

/// Downloads a single file from the Raspberry Pi.
/// 
/// * `Input`: SSH session, remote file path, and app handle for emitting events
/// * `Output`: Local file path
fn download_single_file(session: &mut Session, remote_file_path: &str, app_handle: &AppHandle) -> Result<PathBuf, String> {
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let file_stat = sftp.stat(Path::new(remote_file_path))
        .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_file_path, e))?;
    let total_size = file_stat.size.ok_or("Failed to get file size")?;
    app_handle.emit_all("total-size", total_size).unwrap();

    let mut remote_file = sftp.open(Path::new(remote_file_path))
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_file_path, e))?;

    let downloads_dir = download_dir().ok_or("Failed to find the Downloads directory")?;
    let local_file_path = downloads_dir.join(Path::new(remote_file_path).file_name().unwrap());

    let mut local_file = File::create(&local_file_path)
        .map_err(|e| format!("Failed to create local file at '{}': {}", local_file_path.display(), e))?;

    let mut buffer = [0; CHUNK_SIZE]; // Buffer for holding file chunks
    let mut total_bytes_read = 0;
    while let Ok(n) = remote_file.read(&mut buffer) {
        if n == 0 {
            break;
        }
        local_file.write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write to local file at '{}': {}", local_file_path.display(), e))?;
        total_bytes_read += n as u64;
        // Emit progress event
        app_handle.emit_all("download-progress", total_bytes_read).unwrap();
    }

    remote_file.close().map_err(|e| format!("Failed to close remote file '{}': {}", remote_file_path, e))?;
    local_file.flush().map_err(|e| format!("Failed to flush local file at '{}': {}", local_file_path.display(), e))?;

    Ok(local_file_path)
}


/// Downloads multiple files from the Raspberry Pi as a zip file.
/// 
/// * `Input`: SSH session, remote directory, list of file names, and app handle for emitting events
/// * `Output`: None
fn download_files_as_zip(session: &mut Session, remote_dir: &str, file_names: Vec<String>, app_handle: &AppHandle) -> Result<(), String> {
    let tmp_dir = tempfile::tempdir().map_err(|e| format!("Failed to create temporary directory: {}", e))?;
    let zip_path = tmp_dir.path().join("files.zip");
    let zip_file = File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = ZipWriter::new(zip_file);

    // Calculate total size
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let mut total_size = 0;
    for file_name in &file_names {
        let remote_file_path = format!("{}/{}", remote_dir, file_name);
        let file_stat = sftp.stat(Path::new(&remote_file_path))
            .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_file_path, e))?;
        total_size += file_stat.size.unwrap_or(0);
    }
    app_handle.emit_all("total-size", total_size).unwrap();

    for file_name in file_names {
        let remote_file_path = format!("{}/{}", remote_dir, file_name);
        let file_stat = sftp.stat(Path::new(&remote_file_path))
            .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_file_path, e))?;

        if file_stat.is_file() {
            add_file_to_zip(session, &mut zip, &remote_file_path, &file_name, app_handle)?;
        } else if file_stat.is_dir() {
            add_directory_to_zip(session, &mut zip, &remote_file_path, &file_name, app_handle)?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip file: {}", e))?;

    let downloads_dir = download_dir().ok_or("Failed to find the Downloads directory")?;

    let now = Utc::now();
    let filename = format!("downloaded_files_{}.zip", now.format("%Y%m%d%H%M%S"));

    let local_zip_path = downloads_dir.join(filename);
    fs::rename(zip_path, &local_zip_path).map_err(|e| format!("Failed to move zip file to Downloads: {}", e))?;

    tmp_dir.close().map_err(|e| format!("Failed to clean up temporary files: {}", e))?;
    
    Ok(())
}


/// Adds a file to the zip archive.
/// 
/// * `Input`: SSH session, zip writer, remote file path, and file name
/// * `Output`: None
fn add_file_to_zip(session: &mut Session, zip: &mut ZipWriter<File>, remote_file_path: &str, file_name: &str, app_handle: &AppHandle) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let file_stat = sftp.stat(Path::new(remote_file_path))
        .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_file_path, e))?;
    let total_size = file_stat.size.ok_or("Failed to get file size")?;
    app_handle.emit_all("total-size", total_size).unwrap();

    let mut remote_file = sftp.open(Path::new(remote_file_path))
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_file_path, e))?;

    zip.start_file::<&str, (), &str>(file_name, FileOptions::default())
        .map_err(|e| format!("Failed to add file to zip: {}", e))?;

    let mut buffer = [0; CHUNK_SIZE]; // Buffer for holding file chunks
    let mut total_bytes_read = 0;
    while let Ok(n) = remote_file.read(&mut buffer) {
        if n == 0 {
            break;
        }
        zip.write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write to zip: {}", e))?;
        total_bytes_read += n as u64;
        // Emit progress event
        app_handle.emit_all("zip-progress", total_bytes_read).unwrap();
    }

    Ok(())
}

/// Adds a directory and its contents to the zip archive.
/// 
/// * `Input`: SSH session, zip writer, remote directory path, and directory name
/// * `Output`: None
fn add_directory_to_zip(session: &mut Session, zip: &mut ZipWriter<File>, remote_dir_path: &str, dir_name: &str, app_handle: &AppHandle) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let entries = sftp.readdir(Path::new(remote_dir_path))
        .map_err(|e| format!("Failed to read directory '{}': {}", remote_dir_path, e))?;
    
    // Calculate total size of the directory
    let total_size: u64 = entries.iter().map(|(_, stat)| stat.size.unwrap_or(0)).sum();
    app_handle.emit_all("total-size", total_size).unwrap();

    for (path, stat) in entries {
        let file_name = path.file_name().ok_or_else(|| format!("Failed to get file name in directory '{}'", remote_dir_path))?
            .to_string_lossy().to_string();
        let full_remote_path = format!("{}/{}", remote_dir_path, file_name);
        let zip_file_name = format!("{}/{}", dir_name, file_name);

        if stat.is_file() {
            add_file_to_zip(session, zip, &full_remote_path, &zip_file_name, app_handle)?;
        } else if stat.is_dir() {
            add_directory_to_zip(session, zip, &full_remote_path, &zip_file_name, app_handle)?;
        }
    }

    Ok(())
}

/// Uploads a file to the Raspberry Pi in chunks to avoid memory issues.
/// * `Input`: SSH session, remote file path, local file path, and app handle for emitting events
/// * `Output`: None
fn upload_file_in_chunks(session: &mut Session, remote_file_path: &str, local_file_path: &Path, app_handle: &AppHandle) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    let mut remote_file = sftp.create(Path::new(remote_file_path))
        .map_err(|e| format!("Failed to create remote file '{}': {}", remote_file_path, e))?;

    let mut local_file = File::open(local_file_path)
        .map_err(|e| format!("Failed to open local file '{}': {}", local_file_path.display(), e))?;

    let file_size = local_file.metadata().map_err(|e| format!("Failed to get file metadata '{}': {}", local_file_path.display(), e))?.len();
    app_handle.emit_all("total-size", file_size).unwrap();

    let mut buffer = vec![0; CHUNK_SIZE];
    let mut total_bytes_written = 0;

    loop {
        let n = local_file.read(&mut buffer).map_err(|e| format!("Failed to read from local file '{}': {}", local_file_path.display(), e))?;
        if n == 0 {
            break;
        }
        remote_file.write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write to remote file '{}': {}", remote_file_path, e))?;
        total_bytes_written += n as u64;
        app_handle.emit_all("upload-progress", total_bytes_written).unwrap();
    }

    remote_file.close().map_err(|e| format!("Failed to close remote file '{}': {}", remote_file_path, e))?;

    Ok(())
}

/// Recursively delete a directory and its contents.
fn recursive_delete(sftp: &ssh2::Sftp, path: &Path) -> Result<(), String> {
    let entries = sftp.readdir(path).map_err(|e| format!("Failed to read directory '{}': {}", path.display(), e))?;
    for (entry_path, _) in entries {
        if sftp.stat(&entry_path).map_err(|e| format!("Failed to stat '{}': {}", entry_path.display(), e))?.is_dir() {
            recursive_delete(sftp, &entry_path)?;
        } else {
            sftp.unlink(&entry_path).map_err(|e| format!("Failed to delete file '{}': {}", entry_path.display(), e))?;
        }
    }
    sftp.rmdir(path).map_err(|e| format!("Failed to delete directory '{}': {}", path.display(), e))?;
    Ok(())
}