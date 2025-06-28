import { ChildProcess } from "child_process";

export const waitForChildProcess = (cp: ChildProcess) => {
  let stdout = "";
  let stderr = "";

  return new Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }>((resolve, reject) => {
    cp.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    cp.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    cp.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout,
          stderr,
          code,
        });
      } else {
        reject(
          new Error(
            `Child process exited with code ${code}. stdout: ${stdout}, stderr: ${stderr}`,
          ),
        );
      }
    });
  });
};
