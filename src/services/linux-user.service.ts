import { tryCatchPromise } from "@/utils/try-catch-promise";
import { waitForChildProcess } from "@/utils/wait-for-child-process";
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { randomBytes } from "crypto";

export interface UserInfo {
  username: string;
  uid: number;
  gid: number;
}

@Injectable()
export class LinuxUserService {
  async createUnprivilegedUser(): Promise<UserInfo> {
    // randomly generated username
    const username = randomBytes(16).toString("hex");

    // create the user
    await waitForChildProcess(
      spawn(`useradd`, ["-r", "-s", "/bin/false", "-M", username], {
        detached: false,
      }),
    );

    // get the uid and gid
    const [userInfo, userInfoError] = await tryCatchPromise(
      this.getUserInfo(username),
    );

    // if we can't parse the uid and gid, cleanup and delete the user before throwing
    if (userInfoError || !userInfo) {
      await this.deleteUser(username).catch(() =>
        console.error(`unable to delete user: ${username}`),
      );

      throw new Error(`Failed to get user info`);
    }

    return userInfo;
  }

  async deleteUser(username: string): Promise<void> {
    await waitForChildProcess(
      spawn("userdel", [username], { detached: false }),
    );
  }

  async getUserInfo(username: string): Promise<UserInfo | null> {
    const [idResult, idError] = await tryCatchPromise(
      waitForChildProcess(spawn("id", [username], { detached: false })),
    );

    if (idError || !idResult?.stdout) {
      return null;
    }

    const match = idResult.stdout.match(/uid=(\d+).*gid=(\d+)/);

    if (!match) {
      return null;
    }

    const uid = parseInt(match[1]);
    const gid = parseInt(match[2]);

    return { username, uid, gid };
  }
}
