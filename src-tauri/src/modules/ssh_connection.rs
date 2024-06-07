use std::{env, fs::File, io::{Read, Write}, net::TcpStream, path::Path};

use serde::Serialize;
use ssh2::Session;
use tauri::{api::path::download_dir, command};

/// Struct to represent a file on the Raspberry Pi.
#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub file_type: String,
    pub size: u64,
    pub last_modified: String,
}

//================================================================================================
//                              Commands for SSH connection
//================================================================================================

/// Command called by the frontend to connect to the Raspberry Pi.
/// Uses a .env file to load the IP address, username, and password of the Raspberry Pi.
/// 
/// * `Input`: User's name
/// * `Output`: List of files in the user's directory on the Raspberry Pi
#[command]
pub async fn connect_to_pi(user_name: String) -> Result<Vec<FileInfo>, String> {
    dotenv::dotenv().ok();

    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;
    
    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let base_dir = verify_base_directory(&mut session, &home_dir)?;
    let remote_dir = create_user_directory(&mut session, &base_dir, &user_name)?;
    let files = list_files_in_directory(&mut session, &remote_dir)?;

    Ok(files)
}

/// Command called by the frontend to download a file from the Raspberry Pi.
/// Uses a .env file to load the IP address, username, and password of the Raspberry Pi.
/// Downloads the file to the user's Downloads directory in chunks to prevent memory issues.
/// 
/// * `Input`: User's name and file name
/// * `Output`: None
#[command]
pub async fn download_file(user_name: String, file_name: String) -> Result<(), String> {
    dotenv::dotenv().ok();
    
    let pi_ip = env::var("VITE_PI_IP").map_err(|e| format!("Failed to load VITE_PI_IP: {}", e))?;
    let pi_username = env::var("VITE_PI_USERNAME").map_err(|e| format!("Failed to load VITE_PI_USERNAME: {}", e))?;
    let pi_password = env::var("VITE_PI_PASSWORD").map_err(|e| format!("Failed to load VITE_PI_PASSWORD: {}", e))?;

    let mut session = establish_ssh_session(pi_ip, pi_username, pi_password)?;
    let home_dir = get_home_directory(&mut session)?;
    let remote_dir = format!("{}/{}/{}", home_dir, "pi-interface", user_name);
    let remote_file_path = format!("{}/{}", remote_dir, file_name);

    let mut remote_file = session.sftp().map_err(|e| format!("Failed to create SFTP session: {}", e))?
        .open(Path::new(&remote_file_path))
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_file_path, e))?;

    let downloads_dir = download_dir().ok_or("Failed to find the Downloads directory")?;
    let local_file_path = downloads_dir.join(file_name);
    let mut local_file = File::create(&local_file_path)
        .map_err(|e| format!("Failed to create local file at '{}': {}", local_file_path.display(), e))?;

    let mut buffer = [0; 1024]; // Buffer for holding file chunks
    while let Ok(n) = remote_file.read(&mut buffer) {
        if n == 0 {
            break;
        }
        local_file.write_all(&buffer[..n])
            .map_err(|e| format!("Failed to write to local file at '{}': {}", local_file_path.display(), e))?;
    }

    remote_file.close().map_err(|e| format!("Failed to close remote file '{}': {}", remote_file_path, e))?;
    local_file.flush().map_err(|e| format!("Failed to flush local file at '{}': {}", local_file_path.display(), e))?;

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
                "Directory".to_string()
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