# this was tested on / intended for ubuntu 24.04

print_with_borders() {
    echo "$1"
    echo "-----------------------------------------"
}

# make sure the universe repository is enabled
print_with_borders "Enabling universe repository..."

sudo add-apt-repository -y universe > /dev/null

print_with_borders "Updating package lists & upgrading installed packages..."
# make sure all package lists and deps are up to date
sudo apt-get update > /dev/null
sudo apt-get upgrade -y > /dev/null

# enable unattended upgrades
print_with_borders "Enabling unattended upgrades..."
sudo dpkg-reconfigure -plow unattended-upgrades

# configure unattended upgrades for security updates
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
};

Unattended-Upgrade::DevRelease "auto";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "false";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
EOF


# install latest docker engine (from: https://docs.docker.com/engine/install/ubuntu/)
print_with_borders "Installing Docker..."
sudo apt-get install -y ca-certificates curl > /dev/null
sudo install -m 0755 -d /etc/apt/keyrings > /dev/null
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update > /dev/null
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null


# install gVisor runtime (from: https://gvisor.dev/docs/user_guide/install/#install-from-an-apt-repository)
print_with_borders "Installing gVisor runtime..."
sudo apt-get install -y apt-transport-https gnupg > /dev/null
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null
sudo apt-get update > /dev/null
sudo apt-get install -y runsc > /dev/null
sudo runsc install > /dev/null
sudo systemctl restart docker



# install node v24 (from: https://github.com/nodesource/distributions)
print_with_borders "Installing NodeJS 24..."
curl -fsSL https://deb.nodesource.com/setup_24.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh > /dev/null
sudo apt-get install -y nodejs > /dev/null
rm nodesource_setup.sh

print_with_borders "Create /var/mcp-runner directory for storing db..."
mkdir -p /var/mcp-runner > /dev/null

print_with_borders "Done!"
