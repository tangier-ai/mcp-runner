import { tryCatchPromise } from "@/utils/try-catch-promise";
import { Injectable } from "@nestjs/common";
import { exec } from "child_process";
import { randomBytes } from "crypto";
import { promisify } from "util";

const execAsync = promisify(exec);

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
    await execAsync(`useradd -r -s /bin/false -M ${username}`);

    // get the uid and gid
    const [userInfo, userInfoError] = await tryCatchPromise(
      this.getUserInfo(username),
    );

    // if we can't parse the uid and gid, cleanup and delete the user before throwing
    if (userInfoError || !userInfo) {
      await this.deleteUser(username).catch(() =>
        console.warn(`unable to delete user: ${username}`),
      );

      throw new Error(`Failed to get user info for ${username}`);
    }

    return userInfo;
  }

  async deleteUser(username: string): Promise<void> {
    await execAsync(`userdel ${username}`);
  }

  async userExists(username: string): Promise<boolean> {
    const [idResult, idError] = await tryCatchPromise(
      execAsync(`id ${username}`),
    );

    return !idError && Boolean(idResult);
  }

  async getUserInfo(username: string): Promise<UserInfo | null> {
    const [idResult, idError] = await tryCatchPromise(
      execAsync(`id ${username}`),
    );

    if (idError || !idResult) {
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
