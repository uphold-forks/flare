#!/bin/bash -x

# Update, Upgrade, Clean
sudo apt update -y && sudo apt full-upgrade -y && sudo apt autoremove -y && sudo apt clean -y && sudo apt autoclean -y && sudo snap refresh

# Install Deps
sudo apt install -y jq

# Install Go at 1.14.10
sudo apt remove 'golang-*'
wget https://golang.org/dl/go1.14.10.linux-amd64.tar.gz
tar xf go1.14.10.linux-amd64.tar.gz
sha256sum go1.14.10.linux-amd64.tar.gz
sudo chown -R root:root ./go
sudo mv go /usr/local
rm go1.14.10.linux-amd64.tar.gz
# Set GO env up
export GOPATH=$HOME/go
export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin
cat <<EOT >> ~/.profile
export GOPATH=$HOME/go
export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin
EOT
go env

# Install Node at 10.22.1
sudo apt install -y npm
sudo npm cache clean -f
sudo npm install -g n
sudo n 10.22.1
node --version  # Should be v10.22.1

# Install yarn at v1.22.10
wget https://github.com/yarnpkg/yarn/releases/download/v1.22.10/yarn_1.22.10_all.deb
sudo dpkg -i yarn_1.22.10_all.deb
rm yarn_1.22.10_all.deb
yarn --version  # Should be 1.22.10
yarn
