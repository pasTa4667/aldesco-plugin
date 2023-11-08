import { spawn } from "child_process";

export interface RunOptions {
    cwd: string;
    shell?: boolean;
}

export async function run(command: string, args: string[], options: RunOptions): Promise<void> {
    console.log(`Running ${command} in ${options.cwd}`);
    const process = spawn(command, args, { shell: options.shell ? true : false, cwd: options.cwd});
    return new Promise<void>((resolve, reject) => {
        process.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

export async function runGetOutput(command: string, args: string[], options: RunOptions): Promise<string> {

    return new Promise<string>((resolve, reject) => {
        const process = spawn(command, args, { shell: options.shell ? true : false, cwd: options.cwd, stdio: 'pipe' });
        let output = '';
        process.stdout.on('data', (data) => {
            output += data;
        });
        process.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Command ${command} exited with code ${code}`));
            } else {
                resolve(output);
            }
        });
    });
}