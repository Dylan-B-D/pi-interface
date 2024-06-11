/**
 * User interface.
 * 
 * @interface User
 * @property {string} name - The user name.
 * @property {string} password - The user password.
 */
export interface User {
    name: string;
    password: string;
}

/**
 * FileInfo interface.
 * 
 * @interface FileInfo
 * @property {string} name - The file name.
 * @property {string} file_type - The file type.
 * @property {number} size - The file size.
 * @property {string} last_modified - The last modified date.
 */
export interface FileInfo {
    name: string;
    file_type: string;
    size: number;
    last_modified: string;
}

/**
 * Props for the InterfaceHeader component.
 * 
 * @interface InterfaceHeaderProps
 * @property {{ name: string; } | null} user - The user object or null.
 */
export interface InterfaceHeaderProps {
    user: {
        name: string;
    } | null;
}

/**
 * Props for the Login component.
 * 
 * @interface LoginProps
 * @property {User[]} users - The users array.
 * @property {(user: User) => void} onLogin - The onLogin function.
 */
export interface LoginProps {
    users: User[];
    onLogin: (user: User) => void;
}