#!/bin/bash


# ----------------------------------------
# Define Variables
# ----------------------------------------

LCLST="en_US"
# Format is language_COUNTRY where language is lower case two letter code
# and country is upper case two letter code, separated with an underscore

KEYMP="us"
# Use lower case two letter country code

KEYMOD="pc105"
# pc105 and pc104 are modern standards, all others need to be researched

MYUSERNM="live"
# use all lowercase letters only

MYUSRPASSWD="live"
# Pick a password of your choice

RTPASSWD="root"
# Pick a root password

MYHOSTNM="ShastraOS"
# Pick a hostname for the machine

# ----------------------------------------
# Functions
# ----------------------------------------

# Test for root user
rootuser () {
  if [[ "$EUID" = 0 ]]; then
    continue
  else
    echo "Please Run As Root"
    sleep 2
    exit
  fi
}

# Display line error
handlerror () {
clear
set -uo pipefail
trap 's=$?; echo "$0: Error on line "$LINENO": $BASH_COMMAND"; exit $s' ERR
}

# Clean up working directories
cleanup () {
[[ -d ./mkshastra ]] && rm -r ./mkshastra
[[ -d ./work ]] && rm -r ./work
[[ -d ./out ]] && mv ./out ../
sleep 2
}

# Requirements and preparation
#prepreqs () {
#pacman -S --noconfirm archlinux-keyring
#pacman -S --needed --noconfirm archiso mkinitcpio-archiso
#}

# Copy mkshastra to working directory
cpmkshastra () {
cp -r /usr/share/archiso/configs/releng/ ./mkshastra
rm -r ./mkshastra/efiboot
rm -r ./mkshastra/syslinux
}

# Copy shastrarepo to opt
cpshastrarepo () {
cp -r ./opt/shastrarepo /opt/
}

# Remove shastrarepo from opt
rmshastrarepo () {
rm -r /opt/shastrarepo
}

# Delete automatic login
# nalogin () {
# [[ -d ./mkshastra/airootfs/etc/systemd/system/getty@tty1.service.d ]] && rm -r ./mkshastra/airootfs/etc/systemd/system/getty@tty1.service.d
# }

# Remove cloud-init and other stuff
rmunitsd () {
[[ -d ./mkshastra/airootfs/etc/systemd/system/cloud-init.target.wants ]] && rm -r ./mkshastra/airootfs/etc/systemd/system/cloud-init.target.wants
[[ -f ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants/iwd.service ]] && rm ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants/iwd.service
[[ -f ./mkshastra/airootfs/etc/xdg/reflector/reflector.conf ]] && rm ./mkshastra/airootfs/etc/xdg/reflector/reflector.conf
}

# Add Bluetooth, cups, haveged, NetworkManager, & gdm systemd links,
addnmlinks () {
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/network-online.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/network-online.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/printer.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/printer.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/sockets.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/sockets.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/timers.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/timers.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/bluetooth.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/bluetooth.target.wants
[[ ! -d ./mkshastra/airootfs/etc/systemd/system/sysinit.target.wants ]] && mkdir -p ./mkshastra/airootfs/etc/systemd/system/sysinit.target.wants
ln -sf /usr/lib/systemd/system/NetworkManager.service ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants/NetworkManager.service
ln -sf /usr/lib/systemd/system/NetworkManager-dispatcher.service ./mkshastra/airootfs/etc/systemd/system/dbus-org.freedesktop.nm-dispatcher.service
ln -sf /usr/lib/systemd/system/NetworkManager-wait-online.service ./mkshastra/airootfs/etc/systemd/system/network-online.target.wants/NetworkManager-wait-online.service
ln -sf /usr/lib/systemd/system/cups.service ./mkshastra/airootfs/etc/systemd/system/printer.target.wants/cups.service
ln -sf /usr/lib/systemd/system/cups.socket ./mkshastra/airootfs/etc/systemd/system/sockets.target.wants/cups.socket
ln -sf /usr/lib/systemd/system/cups.path ./mkshastra/airootfs/etc/systemd/system/multi-user.target.wants/cups.path
ln -sf /usr/lib/systemd/system/bluetooth.service ./mkshastra/airootfs/etc/systemd/system/dbus-org.bluez.service
ln -sf /usr/lib/systemd/system/bluetooth.service ./mkshastra/airootfs/etc/systemd/system/bluetooth.target.wants/bluetooth.service
ln -sf /usr/lib/systemd/system/gdm.service ./mkshastra/airootfs/etc/systemd/system/display-manager.service
ln -sf /usr/lib/systemd/system/haveged.service ./mkshastra/airootfs/etc/systemd/system/sysinit.target.wants/haveged.service
}

# Copy files to customize the ISO
cpmyfiles () {
cp packages.x86_64 ./mkshastra/
cp pacman.conf ./mkshastra/
cp profiledef.sh ./mkshastra/
cp -r efiboot ./mkshastra/
cp -r syslinux ./mkshastra/
cp -r usr ./mkshastra/airootfs/
cp -r etc ./mkshastra/airootfs/
cp -r root ./mkshastra/airootfs/
cp -r opt ./mkshastra/airootfs/
ln -sf /usr/share/shastra ./mkshastra/airootfs/etc/skel/shastra
}

# Set hostname
sethostname () {
echo "${MYHOSTNM}" > ./mkshastra/airootfs/etc/hostname
}

# Create passwd file
crtpasswd () {
echo "root:x:0:0:root:/root:/usr/bin/bash
"${MYUSERNM}":x:1010:1010::/home/"${MYUSERNM}":/bin/bash" > ./mkshastra/airootfs/etc/passwd
}

# Create group file
crtgroup () {
echo "root:x:0:root
sys:x:3:"${MYUSERNM}"
adm:x:4:"${MYUSERNM}"
wheel:x:10:"${MYUSERNM}"
log:x:19:"${MYUSERNM}"
network:x:90:"${MYUSERNM}"
floppy:x:94:"${MYUSERNM}"
scanner:x:96:"${MYUSERNM}"
power:x:98:"${MYUSERNM}"
rfkill:x:850:"${MYUSERNM}"
users:x:985:"${MYUSERNM}"
video:x:860:"${MYUSERNM}"
storage:x:870:"${MYUSERNM}"
optical:x:880:"${MYUSERNM}"
lp:x:840:"${MYUSERNM}"
audio:x:890:"${MYUSERNM}"
"${MYUSERNM}":x:1010:" > ./mkshastra/airootfs/etc/group
}

# Create shadow file
crtshadow () {
usr_hash=$(openssl passwd -6 "${MYUSRPASSWD}")
root_hash=$(openssl passwd -6 "${RTPASSWD}")
echo "root:"${root_hash}":14871::::::
"${MYUSERNM}":"${usr_hash}":14871::::::" > ./mkshastra/airootfs/etc/shadow
}

# create gshadow file
crtgshadow () {
echo "root:!*::root
"${MYUSERNM}":!*::" > ./mkshastra/airootfs/etc/gshadow
}

# Set the keyboard layout
setkeylayout () {
echo "KEYMAP="${KEYMP}"" > ./mkshastra/airootfs/etc/vconsole.conf
}

# Create 00-keyboard.conf file
crtkeyboard () {
mkdir -p ./mkshastra/airootfs/etc/X11/xorg.conf.d
echo "Section \"InputClass\"
        Identifier \"system-keyboard\"
        MatchIsKeyboard \"on\"
        Option \"XkbLayout\" \""${KEYMP}"\"
        Option \"XkbModel\" \""${KEYMOD}"\"
EndSection" > ./mkshastra/airootfs/etc/X11/xorg.conf.d/00-keyboard.conf
}

# Fix 40-locale-gen.hook and create locale.conf
crtlocalec () {
sed -i "s/en_US/"${LCLST}"/g" ./mkshastra/airootfs/etc/pacman.d/hooks/40-locale-gen.hook
echo "LANG="${LCLST}".UTF-8" > ./mkshastra/airootfs/etc/locale.conf
}

# Start mkarchiso
runmkarchiso () {
mkarchiso -v -w ./work -o ./out ./mkshastra
}

# ----------------------------------------
# Run Functions
# ----------------------------------------

rootuser
handlerror
#prepreqs
cleanup
cpmkshastra
addnmlinks
cpshastrarepo
#nalogin 
rmunitsd
cpmyfiles
sethostname
crtpasswd
crtgroup
crtshadow
crtgshadow
setkeylayout
crtkeyboard
crtlocalec
runmkarchiso
rmshastrarepo
