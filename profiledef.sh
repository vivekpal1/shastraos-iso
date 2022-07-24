#!/usr/bin/env bash
# shellcheck disable=SC2034

iso_name="Shastra-Beta"
iso_label="Shastra-Beta_$(date +%Y%m)"
iso_publisher="Vivek Pal <http://www.vivekpal.in>"
iso_application="ShastraOS DVD"
iso_version="$(date +%Y.%m.%d)"
install_dir="arch"
buildmodes=('iso')
bootmodes=('bios.syslinux.mbr' 'bios.syslinux.eltorito' 'uefi-x64.systemd-boot.esp' 'uefi-x64.systemd-boot.eltorito')
arch="x86_64"
quiet="n"
work_dir="work"
out_dir="out"
pacman_conf="./pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'xz' '-Xbcj' 'x86' '-b' '1M' '-Xdict-size' '1M')
file_permissions=(
  ["/etc/shadow"]="0:0:0400"
  ["/etc/gshadow"]="0:0:0400"
  ["/etc/sudoers"]="0:0:0440"
  ["/root"]="0:0:750"
  ["/root/.automated_script.sh"]="0:0:755"
  ["/etc/sudoers.d"]="0:0:750"
  ["/etc/calamares"]="0:0:750"
  ["/usr/bin/postinstall.sh"]="0:0:755"
  ["/usr/local/bin/livecd-sound"]="0:0:755"
  ["/usr/local/bin/shastra.bios"]="0:0:755"
  ["/usr/local/bin/shastra.uefi"]="0:0:755"
  ["/usr/local/bin/shastramanager"]="0:0:755"
)
